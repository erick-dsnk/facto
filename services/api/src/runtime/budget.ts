import { PipelineError, PROVIDER_LIMITS, type ProviderContext, type ProviderKind } from '../../../../packages/contracts/src/index.js';

/** Timers may be queued behind synchronous work or promise callbacks. */
export function assertWithinDeadline(context: Pick<ProviderContext, 'signal' | 'now'> & { deadlineAt?: number }): void {
  context.signal.throwIfAborted();
  if (context.deadlineAt !== undefined && context.now() >= context.deadlineAt) throw new PipelineError('timeout');
}

type PerClaimKind = Exclude<ProviderKind, 'jev'>;

/** Attempt allowances from PROVIDER_LIMITS: Jev per request, every other kind per claim. Retries count. */
export class AttemptBudget {
  jev = 0;
  inputTokens = 0;
  searches = new Map<string, number>();
  contents = new Map<string, number>();
  /** The free sources (factcheck, wikipedia, wikidata, weather), keyed `${kind}:${claimId}`. */
  sources = new Map<string, number>();

  /** Attempts already spent on `kind` for `claimId` (Jev: for the request). */
  used(kind: ProviderKind, claimId = 'request'): number {
    if (kind === 'jev') return this.jev;
    const [map, key] = this.slot(kind, claimId);
    return map.get(key) ?? 0;
  }
  consume(kind: ProviderKind, claimId = 'request') {
    if (kind === 'jev') {
      if (this.jev >= PROVIDER_LIMITS.jev) throw new PipelineError('jev_budget_exhausted');
      this.jev++;
      return;
    }
    const [map, key] = this.slot(kind, claimId);
    if ((map.get(key) ?? 0) >= PROVIDER_LIMITS[kind]) throw new PipelineError(`${kind}_budget_exhausted`);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  context(signal: AbortSignal, now: () => number, deadlineAt?: number, reservedJev = 0): ProviderContext & { deadlineAt?: number; canConsume(kind: ProviderKind, claimId?: string): boolean } {
    const fits = (kind: ProviderKind, claimId = 'request') => kind === 'jev' ? this.jev < PROVIDER_LIMITS.jev - reservedJev : this.used(kind, claimId) < PROVIDER_LIMITS[kind];
    return { signal, now, deadlineAt, canConsume: (kind, claimId = 'request') => !signal.aborted && (deadlineAt === undefined || now() < deadlineAt) && fits(kind, claimId),
      consume: (kind, claimId) => { assertWithinDeadline({ signal, now, deadlineAt }); if (kind === 'jev' && this.jev >= PROVIDER_LIMITS.jev - reservedJev) throw new PipelineError('jev_budget_exhausted'); this.consume(kind, claimId); },
      recordUsage: usage => { if (Number.isSafeInteger(usage.inputTokens) && usage.inputTokens! >= 0) this.inputTokens += usage.inputTokens!; } };
  }
  private slot(kind: PerClaimKind, claimId: string): [Map<string, number>, string] {
    if (kind === 'search') return [this.searches, claimId];
    if (kind === 'contents') return [this.contents, claimId];
    return [this.sources, `${kind}:${claimId}`];
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
