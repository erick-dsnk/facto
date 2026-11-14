import { describe, expect, it, vi } from 'vitest';
import { PipelineError, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { createLayaClient } from './client.js';
import type { JevRequest } from '../jev/client.js';

const request: JevRequest = {
  state: { checked_proposition: 'Synthetic public control.', evidence: ['synthetic evidence'] },
  questions: { verdict: { type: 'choice', instructions: 'Classify this synthetic control.', criteria: { supported: 'Supported', refuted: 'Refuted' } } },
};
const context = (): ProviderContext => ({ signal: new AbortController().signal, consume: vi.fn(), now: () => 100, recordUsage: vi.fn() });

describe('local Laya decision adapter', () => {
  it('uses the Jev-wire request, validates answers and emits bounded truncation diagnostics', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      answers: { verdict: { choice: 'supported', probabilities: { supported: 0.9, refuted: 0.1 } } },
      usage: { input_tokens: 73, truncated: true, state_tokens_dropped: 12, truncated_questions: ['verdict'] },
    }), { headers: { 'X-Inference-Time-Ms': '42.5' } }));
    const diagnostic = vi.fn();
    const ctx = context();
    const client = createLayaClient({ url: 'http://127.0.0.1:8081/', fetch: fetcher, diagnostic });

    await expect(client.ask(request, ctx)).resolves.toEqual({ verdict: { choice: 'supported', probabilities: { supported: 0.9, refuted: 0.1 } } });
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8081/v1/systemone', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'english', state: request.state, questions: request.questions }),
    }));
    expect(ctx.consume).toHaveBeenCalledOnce();
    expect(ctx.recordUsage).toHaveBeenCalledWith({ inputTokens: 73 });
    expect(diagnostic).toHaveBeenCalledWith('truncated', expect.objectContaining({ inferenceMs: 42.5, inputTokens: 73, stateTokensDropped: 12, truncatedQuestions: 1 }));
  });

  it('rejects invalid decision options through shared Jev answer validation', async () => {
    const invalid = [
      { answers: {} },
      { answers: { verdict: { choice: 'supported', probabilities: { supported: 0.7, refuted: 0.1 } } } },
      { answers: { verdict: { choice: 'supported', probabilities: { supported: 0.4, refuted: 0.6 } } } },
      { answers: { verdict: { choice: 'maybe', probabilities: { maybe: 1 } } } },
    ];
    for (const payload of invalid) {
      const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload)));
      await expect(createLayaClient({ url: 'http://localhost:8765', fetch: fetcher }).ask(request, context()))
        .rejects.toMatchObject({ code: 'malformed_provider' });
      expect(fetcher).toHaveBeenCalledOnce();
    }
  });

  it('stops request retries on cancellation without exposing endpoint details', async () => {
    const controller = new AbortController();
    const reason = new PipelineError('cancelled');
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      (init?.signal as AbortSignal).addEventListener('abort', () => controller.abort(reason));
      controller.abort(reason);
      throw new Error('private_local_endpoint_detail');
    });
    await expect(createLayaClient({ url: 'http://127.0.0.1:8765', fetch: fetcher }).ask(request, { ...context(), signal: controller.signal }))
      .rejects.toBe(reason);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('enforces the shared provider attempt budget and deadline before transport', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createLayaClient({ url: 'http://localhost:8765', fetch: fetcher });
    const exhausted = { ...context(), consume: vi.fn(() => { throw new PipelineError('jev_budget_exhausted'); }) };
    await expect(client.ask(request, exhausted)).rejects.toMatchObject({ code: 'jev_budget_exhausted' });
    const expired = { ...context(), deadlineAt: 99 };
    await expect(client.ask(request, expired)).rejects.toMatchObject({ code: 'timeout' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not fall back to a hosted Jev endpoint when local transport fails', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => { throw new Error('private local failure'); });
    await expect(createLayaClient({ url: 'http://127.0.0.1:8765', fetch: fetcher }).ask(request, context()))
      .rejects.toMatchObject({ code: 'jev_unavailable', retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(2); // One retry is part of the shared provider contract.
    expect(fetcher.mock.calls.every(([url]) => url === 'http://127.0.0.1:8765/v1/systemone')).toBe(true);
  });
});
