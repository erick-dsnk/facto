import { describe, expect, it, vi } from 'vitest';
import { PipelineError, type TextInput } from '../../../../packages/contracts/src/index.js';
import { AttemptBudget } from '../../../../services/api/src/runtime/budget.js';
import { CampaignBudget } from './budget.js';
import { freshObservation, observedProviders } from './observe.js';

const input: TextInput = { schemaVersion: 1, requestId: 'cleanup-control', sessionId: 'synthetic-session', sessionEpoch: 1,
  revision: 1, mode: 'typed', text: 'The synthetic tower opened in 1921.', language: 'en', capturedAt: new Date().toISOString(),
  capture: { source: 'typed_fixture', segmentId: 'synthetic', confidence: 1, final: true }, context: [], userInitiated: true };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function outcomeBeforeCleanup(operation: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation.then(() => 'unexpected_success', (error: unknown) => error instanceof PipelineError ? error.code : 'unexpected_error'),
      new Promise<string>(resolve => { timer = setTimeout(() => resolve('blocked_on_cleanup'), 250); })]);
  } finally { clearTimeout(timer); }
}
function setup(body: ReadableStream<Uint8Array>, controller = new AbortController()) {
  const observation = freshObservation('cleanup-control');
  const budget = new CampaignBudget();
  const fetcher = vi.fn<typeof fetch>(async () => new Response(body));
  const providers = observedProviders({ budget, requests: new Map([[input.requestId, { observation, allowedPublic: [input.text] }]]),
    keys: { jev: 'synthetic-key', exa: 'synthetic-key' }, fetch: fetcher });
  const operation = providers.adapters.classify(input, new AttemptBudget().context(controller.signal, Date.now));
  return { operation, providers, observation, budget, fetcher };
}

describe('live observer response cleanup never delays failure accounting', () => {
  it.each(['pending', 'rejected'] as const)('records oversized response and drains with %s cleanup', async cleanup => {
    const release = deferred();
    const cancel = vi.fn(() => cleanup === 'pending' ? release.promise : Promise.reject(new Error('private_cleanup_details')));
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(262_145)); }, cancel });
    const state = setup(body);
    try {
      expect(await outcomeBeforeCleanup(state.operation)).toBe('harness_response_byte_limit');
      expect(await outcomeBeforeCleanup(state.providers.drain())).toBe('unexpected_success');
      expect(state.budget.summary()).toMatchObject({ attempts: 1, calls: { jev: 1, search: 0, contents: 0 }, unknownInputTokenReservations: 24_000 });
      expect(state.observation.attempts[0]).toMatchObject({ status: 200, outcome: 'response_limit', inputTokens: null });
      expect(state.observation.attempts[0].durationMs).not.toBeNull();
      expect(state.observation.localStops).toEqual(['harness_response_byte_limit']);
      expect(body.locked).toBe(false);
      expect(cancel).toHaveBeenCalledOnce();
      expect(state.fetcher).toHaveBeenCalledOnce();
      expect(JSON.stringify(state.observation)).not.toContain('private_cleanup_details');
    } finally { release.resolve(); await state.operation.catch(() => undefined); await state.providers.drain(); }
  });

  it('preserves cancellation and finalizes the unknown attempt while stream cleanup stays pending', async () => {
    const release = deferred();
    const reading = deferred();
    const controller = new AbortController();
    const cancel = vi.fn(() => release.promise);
    const body = new ReadableStream<Uint8Array>({ pull() { reading.resolve(); }, cancel }, { highWaterMark: 0 });
    const state = setup(body, controller);
    try {
      await reading.promise;
      controller.abort(new PipelineError('cancelled'));
      expect(await outcomeBeforeCleanup(state.operation)).toBe('cancelled');
      await state.providers.drain();
      expect(state.observation.attempts[0]).toMatchObject({ outcome: 'aborted', inputTokens: null, unknownInputTokenReservation: 24_000 });
      expect(state.observation.attempts[0].durationMs).not.toBeNull();
      expect(state.observation.localStops).toEqual([]);
      expect(body.locked).toBe(false);
      expect(cancel).toHaveBeenCalledOnce();
      expect(state.fetcher).toHaveBeenCalledOnce();
    } finally { release.resolve(); await state.operation.catch(() => undefined); await state.providers.drain(); }
  });
});
