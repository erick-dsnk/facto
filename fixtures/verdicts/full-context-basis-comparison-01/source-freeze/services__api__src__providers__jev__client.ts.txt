import { MODEL_VERSION, PipelineError, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { retryAfterDelay, RetryableProviderError, withProviderRetry } from '../../runtime/provider-retry.js';

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string };
export type JevAnswer = { choice?: string; probabilities?: Record<string, number>; noul?: number | null };
export type JevRequest = { state: unknown; questions: Record<string, JevQuestion> };
export interface JevClient {
  ask(request: JevRequest, context: ProviderContext): Promise<Record<string, JevAnswer>>;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const probability = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Only return answers whose shape and fixed options match the actual request. */
export function validateAnswers(value: unknown, questions: Record<string, JevQuestion>): Record<string, JevAnswer> {
  if (!object(value) || !object(value.answers)) throw new PipelineError('malformed_provider');
  const validated: Record<string, JevAnswer> = {};
  for (const [name, question] of Object.entries(questions)) {
    const answer = value.answers[name];
    if (!object(answer)) throw new PipelineError('malformed_provider');
    if (question.type === 'noul') {
      if (answer.noul !== null && !probability(answer.noul)) throw new PipelineError('malformed_provider');
      validated[name] = { noul: answer.noul };
      continue;
    }
    if (typeof answer.choice !== 'string' || !Object.hasOwn(question.criteria, answer.choice) || !object(answer.probabilities)) {
      throw new PipelineError('malformed_provider');
    }
    const probabilities: Record<string, number> = {};
    for (const criterion of Object.keys(question.criteria)) {
      const p = answer.probabilities[criterion];
      if (!probability(p)) throw new PipelineError('malformed_provider');
      probabilities[criterion] = p;
    }
    if (Object.keys(answer.probabilities).some(key => !Object.hasOwn(question.criteria, key))) throw new PipelineError('malformed_provider');
    const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.02) throw new PipelineError('malformed_provider');
    if (probabilities[answer.choice] < Math.max(...Object.values(probabilities))) throw new PipelineError('malformed_provider');
    validated[name] = { choice: answer.choice, probabilities };
  }
  return validated;
}

export function createJevClient(options: { apiKey: string; fetch?: typeof globalThis.fetch }): JevClient {
  const fetcher = options.fetch ?? globalThis.fetch;
  return {
    async ask(request, context) {
      context.signal.throwIfAborted();
      if (!options.apiKey.trim()) throw new PipelineError('missing_jev_key');
      return await withProviderRetry(context, 'jev', undefined, async () => {
        let response: Response;
        try {
          response = await fetcher('https://api.typesafe.ai/v1/systemone', {
            method: 'POST', signal: context.signal,
            headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL_VERSION, state: request.state, questions: request.questions })
          });
        } catch {
          context.signal.throwIfAborted();
          throw new RetryableProviderError('jev_unavailable');
        }
        context.signal.throwIfAborted();
        if (!response.ok) {
          const retryAfter = retryAfterDelay(response.headers.get('retry-after'), context.now());
          await response.body?.cancel().catch(() => undefined);
          if (response.status === 401 || response.status === 403) throw new PipelineError('jev_authentication');
          if (response.status === 429) throw new RetryableProviderError('jev_rate_limited', retryAfter);
          if (response.status >= 500) throw new RetryableProviderError('jev_unavailable', retryAfter);
          throw new PipelineError('jev_unavailable');
        }
        // The fixed answer schema is tiny. Reject unexpectedly large responses without retaining them.
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
              if (bytes > 128_000) {
                await reader.cancel().catch(() => undefined);
                throw new PipelineError('malformed_provider');
              }
              context.signal.throwIfAborted();
              body += decoder.decode(chunk.value, { stream: true });
            }
            body += decoder.decode();
          } catch (error) {
            await reader.cancel().catch(() => undefined);
            context.signal.throwIfAborted();
            if (error instanceof PipelineError) throw error;
            throw new RetryableProviderError('jev_unavailable');
          } finally {
            reader.releaseLock();
          }
        }
        let decoded: unknown;
        try { decoded = JSON.parse(body); } catch { throw new PipelineError('malformed_provider'); }
        if (object(decoded) && object(decoded.usage)) {
          const inputTokens = decoded.usage.input_tokens;
          if (typeof inputTokens === 'number' && Number.isSafeInteger(inputTokens) && inputTokens >= 0) {
            context.recordUsage?.({ inputTokens });
          }
        }
        const answers = validateAnswers(decoded, request.questions);
        context.signal.throwIfAborted();
        return answers;
      });
    }
  };
}
