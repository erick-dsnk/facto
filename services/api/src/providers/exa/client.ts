import { Exa } from 'exa-js';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';

const MAX_RESPONSE_BYTES = 256 * 1024;

/** Cleanup must not replace or delay an already established provider error. */
function discardBody(body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null): void {
  void body?.cancel().catch(() => undefined);
}

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES || !response.body) {
    discardBody(response.body);
    throw new PipelineError('malformed_exa_response');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new PipelineError('malformed_exa_response');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    discardBody(reader);
    if (error instanceof PipelineError) throw error;
    throw new PipelineError('malformed_exa_response');
  } finally { reader.releaseLock(); }
}

/**
 * Keep official SDK search/content serialization while bounding streamed response
 * bytes and sanitizing provider errors at its public request seam. The supplied
 * common signal cancels the actual HTTP request, including response body reads.
 * Each check gets its own instance; no global fetch or SDK state is changed.
 */
export class AbortableExa extends Exa {
  constructor(private apiKey: string, private signal: AbortSignal, private fetcher: typeof fetch = fetch) { super(apiKey); }

  override async request<T = unknown>(endpoint: string, method: string, body?: unknown): Promise<T> {
    this.signal.throwIfAborted();
    if (!['/search', '/contents'].includes(endpoint) || method !== 'POST') throw new PipelineError('unsupported_exa_operation');
    try {
      const response = await this.fetcher(`https://api.exa.ai${endpoint}`, {
        method, headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: this.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        discardBody(response.body);
        if (response.status === 401 || response.status === 403) throw new PipelineError('exa_authentication_failed');
        if (response.status === 429) throw new PipelineError('exa_rate_limited', true);
        throw new PipelineError('exa_unavailable', response.status >= 500);
      }
      const data = await boundedJson(response);
      this.signal.throwIfAborted();
      return data as T;
    } catch (error) {
      this.signal.throwIfAborted();
      if (error instanceof PipelineError) throw error;
      throw new PipelineError('exa_unavailable', true);
    }
  }
}
