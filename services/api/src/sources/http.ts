import { PipelineError } from '../../../../packages/contracts/src/index.js';

/** A completed HTTP exchange. `body` is the parsed JSON of a 2xx response, `undefined` otherwise. */
export type JsonReply = { status: number; retryAfter: string | null; body: unknown };

/** Cleanup must not replace or delay an established provider failure. */
function discard(body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null | undefined): void {
  try { void body?.cancel().catch(() => undefined); } catch { /* best effort, including injected transports */ }
}

/**
 * One GET with a bounded JSON body, cancelled by `signal`. A network failure is `<service>_unavailable`
 * (retryable), an oversize or unreadable body `malformed_<service>_response`. Non-2xx statuses come back
 * without a body so each provider can map them; their bodies are never read or logged.
 */
export async function getJson(fetcher: typeof fetch, url: string, options: {
  service: string; signal: AbortSignal; maxBytes: number; headers?: Record<string, string>;
}): Promise<JsonReply> {
  options.signal.throwIfAborted();
  let response: Response;
  try {
    response = await fetcher(url, { method: 'GET', headers: options.headers, signal: options.signal, redirect: 'error' });
  } catch {
    options.signal.throwIfAborted();
    throw new PipelineError(`${options.service}_unavailable`, true);
  }
  options.signal.throwIfAborted();
  const retryAfter = response.headers.get('retry-after');
  if (!response.ok) {
    discard(response.body);
    return { status: response.status, retryAfter, body: undefined };
  }
  if (Number(response.headers.get('content-length')) > options.maxBytes) {
    discard(response.body);
    throw new PipelineError(`malformed_${options.service}_response`);
  }
  let text = '';
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > options.maxBytes) throw new PipelineError(`malformed_${options.service}_response`);
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      discard(reader);
      options.signal.throwIfAborted();
      if (error instanceof PipelineError) throw error;
      throw new PipelineError(`${options.service}_unavailable`, true);
    } finally { reader.releaseLock(); }
  }
  options.signal.throwIfAborted();
  try { return { status: response.status, retryAfter, body: JSON.parse(text) as unknown }; }
  catch { throw new PipelineError(`malformed_${options.service}_response`); }
}
