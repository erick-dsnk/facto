import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { retryAfterDelay, RetryableProviderError, withProviderRetry } from '../../runtime/provider-retry.js';
import { validateAnswers, type JevClient, type JevRequest } from '../jev/client.js';

/** Laya diagnostics intentionally contain only bounded metadata, never claim or evidence text. */
export type LayaDiagnostic = (event: 'response' | 'truncated', fields: {
  durationMs?: number;
  inferenceMs?: number;
  inputTokens?: number;
  stateTokensDropped?: number;
  truncatedQuestions?: number;
}) => void;

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeCount = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const discardBody = (body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null | undefined): void => {
  try { void body?.cancel().catch(() => undefined); } catch { /* Best effort cleanup. */ }
};

/** Adapts Laya's local Jev-wire server to the pipeline's existing decision client contract. */
export function createLayaClient(options: { url: string; apiKey?: string; fetch?: typeof globalThis.fetch; diagnostic?: LayaDiagnostic }): JevClient {
  const fetcher = options.fetch ?? globalThis.fetch;
  const endpoint = `${options.url.replace(/\/+$/, '')}/v1/systemone`;
  return {
    async ask(request: JevRequest, context) {
      context.signal.throwIfAborted();
      return await withProviderRetry(context, 'jev', undefined, async () => {
        const started = performance.now();
        let response: Response;
        try {
          response = await fetcher(endpoint, {
            method: 'POST', signal: context.signal,
            headers: { 'Content-Type': 'application/json', ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}) },
            body: JSON.stringify({ model: 'english', state: request.state, questions: request.questions }),
          });
        } catch {
          context.signal.throwIfAborted();
          throw new RetryableProviderError('jev_unavailable');
        }
        context.signal.throwIfAborted();
        if (!response.ok) {
          const retryAfter = retryAfterDelay(response.headers.get('retry-after'), context.now());
          discardBody(response.body);
          context.signal.throwIfAborted();
          if (response.status === 401 || response.status === 403) throw new PipelineError('jev_authentication');
          if (response.status === 429) throw new RetryableProviderError('jev_rate_limited', retryAfter);
          if (response.status >= 500) throw new RetryableProviderError('jev_unavailable', retryAfter);
          throw new PipelineError('jev_unavailable');
        }

        let body = '';
        let bytes = 0;
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.byteLength;
              if (bytes > 128_000) throw new PipelineError('malformed_provider');
              context.signal.throwIfAborted();
              body += decoder.decode(chunk.value, { stream: true });
            }
            body += decoder.decode();
          } catch (error) {
            discardBody(reader);
            context.signal.throwIfAborted();
            if (error instanceof PipelineError) throw error;
            throw new RetryableProviderError('jev_unavailable');
          } finally {
            reader.releaseLock();
          }
        }
        let decoded: unknown;
        try { decoded = JSON.parse(body); } catch { throw new PipelineError('malformed_provider'); }
        if (!object(decoded)) throw new PipelineError('malformed_provider');
        const usage = object(decoded.usage) ? decoded.usage : undefined;
        const inputTokens = safeCount(usage?.input_tokens);
        if (inputTokens !== undefined) context.recordUsage?.({ inputTokens });
        const stateTokensDropped = safeCount(usage?.state_tokens_dropped);
        const truncatedQuestions = Array.isArray(usage?.truncated_questions) ? usage.truncated_questions.length : undefined;
        const inferenceHeader = response.headers.get('x-inference-time-ms');
        const inferenceMsValue = inferenceHeader === null ? NaN : Number(inferenceHeader);
        const inferenceMs = Number.isFinite(inferenceMsValue) && inferenceMsValue >= 0 ? inferenceMsValue : undefined;
        const truncated = usage?.truncated === true || (stateTokensDropped ?? 0) > 0 || (truncatedQuestions ?? 0) > 0;
        const fields = {
          durationMs: Math.max(0, performance.now() - started),
          ...(inferenceMs !== undefined ? { inferenceMs } : {}),
          ...(inputTokens !== undefined ? { inputTokens } : {}),
          ...(stateTokensDropped !== undefined ? { stateTokensDropped } : {}),
          ...(truncatedQuestions !== undefined ? { truncatedQuestions } : {}),
        };
        options.diagnostic?.(truncated ? 'truncated' : 'response', fields);
        const answers = validateAnswers(decoded, request.questions);
        context.signal.throwIfAborted();
        return answers;
      });
    },
  };
}
