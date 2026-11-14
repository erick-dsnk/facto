import { describe, expect, it, vi } from 'vitest';
import { PipelineError, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { createJevClient, type JevRequest } from './client.js';

const request: JevRequest = { state: { checked_proposition: 'Synthetic public control.' }, questions: { relevant: { type: 'noul', instructions: 'Assess this synthetic control.' } } };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function context(controller = new AbortController(), maxAttempts = 1): ProviderContext {
  let attempts = 0;
  return { signal: controller.signal, now: () => 0, consume: vi.fn(() => {
    if (++attempts > maxAttempts) throw new PipelineError('jev_budget_exhausted');
  }) };
}
async function outcome(promise: Promise<unknown>) {
  try { await promise; return { code: 'unexpected_success', retryable: false }; }
  catch (error) {
    return error instanceof PipelineError
      ? { code: error.code, retryable: error.retryable }
      : { code: error instanceof Error ? error.message : 'unknown', retryable: false };
  }
}
async function beforeCleanup(promise: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([outcome(promise), new Promise<{ code: string; retryable: boolean }>(resolve => {
      timer = setTimeout(() => resolve({ code: 'blocked_on_cleanup', retryable: false }), 250);
    })]);
  } finally { clearTimeout(timer); }
}

describe('Jev cleanup preserves established provider errors and attempts', () => {
  for (const cleanup of ['pending', 'rejected'] as const) {
    it.each([
      [401, 'jev_authentication', false],
      [403, 'jev_authentication', false],
      [400, 'jev_unavailable', false],
      [429, 'jev_rate_limited', true],
      [503, 'jev_unavailable', true],
    ] as const)(`preserves HTTP %s with ${cleanup} cancellation`, async (status, code, retryable) => {
      const release = deferred();
      const cancel = vi.fn(() => cleanup === 'pending' ? release.promise : Promise.reject(new Error('private_cleanup_details')));
      const body = new ReadableStream<Uint8Array>({ cancel });
      const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { status }));
      const ctx = context();
      const operation = createJevClient({ apiKey: 'synthetic-test-key', fetch: fetcher }).ask(request, ctx);
      try {
        expect(await beforeCleanup(operation)).toEqual({ code, retryable });
        expect(cancel).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledOnce();
      } finally { release.resolve(); await operation.catch(() => undefined); }
    });

    it(`preserves streamed overflow with ${cleanup} cancellation`, async () => {
      const release = deferred();
      const cancel = vi.fn(() => cleanup === 'pending' ? release.promise : Promise.reject(new Error('private_cleanup_details')));
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(128_001)); }, cancel });
      const fetcher = vi.fn<typeof fetch>(async () => new Response(body));
      const operation = createJevClient({ apiKey: 'synthetic-test-key', fetch: fetcher }).ask(request, context());
      try {
        expect(await beforeCleanup(operation)).toEqual({ code: 'malformed_provider', retryable: false });
        expect(cancel).toHaveBeenCalledOnce();
        expect(body.locked).toBe(false);
        expect(fetcher).toHaveBeenCalledOnce();
      } finally { release.resolve(); await operation.catch(() => undefined); }
    });
  }

  it('retries a retryable status within allowance while earlier cleanup is pending', async () => {
    const release = deferred();
    const firstBody = new ReadableStream<Uint8Array>({ cancel() { return release.promise; } });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(firstBody, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ answers: { relevant: { noul: .9 } } })));
    const ctx = context(new AbortController(), 2);
    const operation = createJevClient({ apiKey: 'synthetic-test-key', fetch: fetcher }).ask(request, ctx);
    try {
      await expect(operation).resolves.toEqual({ relevant: { noul: .9 } });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(ctx.consume).toHaveBeenCalledTimes(2);
    } finally { release.resolve(); }
  });

  it('preserves explicit cancellation triggered during body cleanup', async () => {
    const controller = new AbortController();
    const reason = new PipelineError('cancelled');
    const body = new ReadableStream<Uint8Array>({ cancel() { controller.abort(reason); return Promise.reject(new Error('private_cleanup_details')); } });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { status: 401 }));
    await expect(createJevClient({ apiKey: 'synthetic-test-key', fetch: fetcher }).ask(request, context(controller))).rejects.toBe(reason);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps an interrupted stream an operational failure and releases its reader', async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('private_stream_failure')); } });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body));
    await expect(outcome(createJevClient({ apiKey: 'synthetic-test-key', fetch: fetcher }).ask(request, context())))
      .resolves.toEqual({ code: 'jev_unavailable', retryable: true });
    expect(body.locked).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
