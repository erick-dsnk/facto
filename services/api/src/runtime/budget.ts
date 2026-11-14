import { PipelineError, type ProviderContext, type ProviderKind } from '../../../../packages/contracts/src/index.js';

export class AttemptBudget {
  jev = 0;
  inputTokens = 0;
  searches = new Map<string, number>();
  contents = new Map<string, number>();
  consume(kind: ProviderKind, claimId = 'request') {
    if (kind === 'jev') {
      if (this.jev >= 3) throw new PipelineError('jev_budget_exhausted');
      this.jev++;
      return;
    }
    const map = kind === 'search' ? this.searches : this.contents;
    const limit = kind === 'search' ? 2 : 3;
    if ((map.get(claimId) ?? 0) >= limit) throw new PipelineError(`${kind}_budget_exhausted`);
    map.set(claimId, (map.get(claimId) ?? 0) + 1);
  }
  context(signal: AbortSignal, now: () => number, deadlineAt?: number): ProviderContext & { deadlineAt?: number; canConsume(kind: ProviderKind, claimId?: string): boolean } {
    return { signal, now, deadlineAt, canConsume: (kind, claimId = 'request') => kind === 'jev' ? this.jev < 3 : ((kind === 'search' ? this.searches : this.contents).get(claimId) ?? 0) < (kind === 'search' ? 2 : 3),
      consume: (kind, claimId) => { signal.throwIfAborted(); this.consume(kind, claimId); },
      recordUsage: usage => { if (Number.isSafeInteger(usage.inputTokens) && usage.inputTokens! >= 0) this.inputTokens += usage.inputTokens!; } };
  }
}

/** Enforces cancellation even for an injected provider that ignores its signal. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason ?? new PipelineError('cancelled'));
    if (signal.aborted) { promise.catch(() => undefined); aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted)).catch(() => undefined);
  });
}
