import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { AbortableExa } from './client.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
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
      timer = setTimeout(() => resolve({ code: 'blocked_on_cleanup', retryable: false }), 150);
    })]);
  } finally { clearTimeout(timer); }
}

describe('Exa response cleanup preserves the established error', () => {
  it('preserves an oversized header error when a native HTTP body has already failed', async () => {
    const closed = deferred();
    const server = createServer((_request, response) => {
      response.on('close', closed.resolve);
      response.writeHead(200, { 'content-length': '300000' });
      response.write('x');
      setTimeout(() => response.destroy(), 5);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('local_server_unavailable');
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      const response = await fetch(`http://127.0.0.1:${address.port}`, init);
      // A delivery barrier makes the peer-reset ordering deterministic. This is
      // the actual native Response, with no replacement body or cancel method.
      await closed.promise;
      await new Promise(resolve => setTimeout(resolve, 20));
      return response;
    });
    try {
      const client = new AbortableExa('local-test-key', controller.signal, fetcher);
      await expect(outcome(client.search('Synthetic public control.'))).resolves.toEqual({ code: 'malformed_exa_response', retryable: false });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  // Pending/rejected cancellation below is a legal injected ReadableStream
  // behavior, not a claim that native fetch normally has hanging cleanup.
  for (const cleanup of ['pending', 'rejected'] as const) {
    it.each([
      [401, 'exa_authentication_failed', false],
      [403, 'exa_authentication_failed', false],
      [400, 'exa_unavailable', false],
      [429, 'exa_rate_limited', true],
      [503, 'exa_unavailable', true],
    ] as const)(`preserves HTTP %s classification with ${cleanup} cleanup`, async (status, code, retryable) => {
      const released = deferred();
      const cancel = vi.fn(() => cleanup === 'pending' ? released.promise : Promise.reject(new Error('private_cleanup_details')));
      const body = new ReadableStream<Uint8Array>({ cancel });
      const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { status }));
      const client = new AbortableExa('local-test-key', new AbortController().signal, fetcher);
      const operation = client.search('Synthetic public control.');
      try {
        expect(await beforeCleanup(operation)).toEqual({ code, retryable });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledTimes(1); // A client without runtime context never starts hidden retries.
      } finally { released.resolve(); await operation.catch(() => undefined); }
    });

    it.each(['declared', 'streamed'] as const)(`preserves %s overflow with ${cleanup} cleanup`, async size => {
      const released = deferred();
      const cancel = vi.fn(() => cleanup === 'pending' ? released.promise : Promise.reject(new Error('private_cleanup_details')));
      const body = new ReadableStream<Uint8Array>({
        start(controller) { if (size === 'streamed') controller.enqueue(new Uint8Array(256 * 1024 + 1)); }, cancel,
      });
      const response = new Response(body, { headers: size === 'declared' ? { 'content-length': '300000' } : {} });
      const client = new AbortableExa('local-test-key', new AbortController().signal, async () => response);
      const operation = client.search('Synthetic public control.');
      try {
        expect(await beforeCleanup(operation)).toEqual({ code: 'malformed_exa_response', retryable: false });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(body.locked).toBe(false);
      } finally { released.resolve(); await operation.catch(() => undefined); }
    });
  }

  it('keeps explicit cancellation ahead of a cleanup error', async () => {
    const controller = new AbortController();
    const reason = new PipelineError('cancelled');
    const body = new ReadableStream<Uint8Array>({ cancel() { controller.abort(reason); return Promise.reject(new Error('private_cleanup_details')); } });
    const client = new AbortableExa('local-test-key', controller.signal, async () => new Response(body, { status: 401 }));
    await expect(client.search('Synthetic public control.')).rejects.toBe(reason);
  });
});
