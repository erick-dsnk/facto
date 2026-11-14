import { PipelineError, type ProviderContext, type ProviderKind } from '../../../../packages/contracts/src/index.js';
import { assertWithinDeadline } from './budget.js';

const FALLBACK_BACKOFF_MS = 100;

/** Internal provider failure carrying only bounded retry timing, never a body or key. */
export class RetryableProviderError extends PipelineError {
  constructor(code: string, readonly retryAfterMs?: number) { super(code, true); }
}

type RuntimeProviderContext = ProviderContext & { deadlineAt?: number; canConsume?(kind: ProviderKind, claimId?: string): boolean };

export function retryAfterDelay(value: string | null, now: number): number | undefined {
  if (!value?.trim()) return undefined;
  const header = value.trim();
  if (/^\d+$/.test(header)) {
    const seconds = Number(header);
    const delay = seconds * 1000;
    return Number.isFinite(delay) && delay >= 0 ? delay : undefined;
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) return undefined;
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

/** Make one retry at most; every actual provider attempt consumes the shared allowance. */
export async function withProviderRetry<T>(
  context: ProviderContext,
  kind: ProviderKind,
  claimId: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const runtimeContext = context as RuntimeProviderContext;
  let previousFailure: PipelineError | undefined;
  for (let attempt = 0; ; attempt++) {
    assertWithinDeadline(runtimeContext);
    try {
      if (claimId === undefined) context.consume(kind);
      else context.consume(kind, claimId);
    } catch (error) {
      // A retry that cannot fit the shared allowance is simply unavailable; retain
      // the useful original provider failure instead of obscuring it with budget state.
      if (previousFailure && error instanceof PipelineError && error.code === `${kind}_budget_exhausted`) throw previousFailure;
      throw error;
    }
    try {
      const result = await operation();
      assertWithinDeadline(runtimeContext);
      return result;
    } catch (error) {
      assertWithinDeadline(runtimeContext);
      if (!(error instanceof PipelineError) || !error.retryable || attempt >= 1) throw error;
      previousFailure = error;
      const delay = error instanceof RetryableProviderError && error.retryAfterMs !== undefined
        ? error.retryAfterMs
        : FALLBACK_BACKOFF_MS;
      if (runtimeContext.canConsume && !runtimeContext.canConsume(kind, claimId)) throw error;
      const deadlineAt = runtimeContext.deadlineAt;
      if (delay >= 10_000 || (deadlineAt !== undefined && delay >= Math.max(0, deadlineAt - context.now()))) throw error;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); resolve(); }, delay);
        const aborted = () => { clearTimeout(timer); cleanup(); reject(context.signal.reason ?? new PipelineError('cancelled')); };
        const cleanup = () => context.signal.removeEventListener('abort', aborted);
        context.signal.addEventListener('abort', aborted, { once: true });
        if (context.signal.aborted) aborted();
      });
    }
  }
}
