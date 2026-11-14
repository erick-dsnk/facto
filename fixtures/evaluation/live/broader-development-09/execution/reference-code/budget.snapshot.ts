import { PipelineError } from '../../../../packages/contracts/src/index.js';

export type AttemptKind = 'jev' | 'search' | 'contents';
export type LiveLimits = {
  requestBytes: number; totalRequestBytes: number; inputTokens: number;
  unknownInputTokensPerAttempt: number; calls: Record<AttemptKind, number>; wallMs: number;
};

/** Reservations are an explicit policy allowance, never a byte-to-token estimate. */
export const DEVELOPMENT_LIMITS: LiveLimits = {
  requestBytes: 65_536, totalRequestBytes: 1_000_000, inputTokens: 180_000,
  unknownInputTokensPerAttempt: 24_000, calls: { jev: 24, search: 12, contents: 18 }, wallMs: 150_000,
};

export class HarnessStop extends PipelineError {
  constructor(readonly limit: string) { super(`harness_${limit}`); }
}

export type Attempt = {
  kind: AttemptKind; ordinal: number; dispatched: boolean; requestBytes: number; startedMs: number; durationMs: number | null;
  inputTokens: number | null; unknownInputTokenReservation: number; status: number | null;
  outcome: 'pending' | 'response' | 'aborted' | 'network_error' | 'response_limit';
  costUSD: number | null;
};

export class CampaignBudget {
  readonly attempts: Attempt[] = [];
  readonly started: number;
  constructor(readonly limits: LiveLimits = DEVELOPMENT_LIMITS, private clock: () => number = () => performance.now()) {
    this.started = clock();
    const values = [limits.requestBytes, limits.totalRequestBytes, limits.inputTokens, limits.unknownInputTokensPerAttempt, ...Object.values(limits.calls), limits.wallMs];
    if (values.some(value => !Number.isSafeInteger(value) || value <= 0)) throw new Error('Invalid live limits');
  }
  get elapsedMs() { return this.clock() - this.started; }
  get measuredInputTokens() { return this.attempts.reduce((sum, attempt) => sum + (attempt.inputTokens ?? 0), 0); }
  get unknownInputTokenReservations() { return this.attempts.reduce((sum, attempt) => sum + attempt.unknownInputTokenReservation, 0); }
  get chargedInputTokens() { return this.measuredInputTokens + this.unknownInputTokenReservations; }
  begin(kind: AttemptKind, requestBytes: number): Attempt {
    if (this.elapsedMs >= this.limits.wallMs) throw new HarnessStop('wall_limit');
    if (this.attempts.some(attempt => attempt.kind === 'jev' && attempt.durationMs !== null && attempt.inputTokens === null)) throw new HarnessStop('unknown_input_usage');
    if (requestBytes > this.limits.requestBytes) throw new HarnessStop('request_byte_limit');
    if (this.attempts.reduce((sum, attempt) => sum + attempt.requestBytes, 0) + requestBytes > this.limits.totalRequestBytes) throw new HarnessStop('total_byte_limit');
    if (this.attempts.filter(attempt => attempt.kind === kind).length >= this.limits.calls[kind]) throw new HarnessStop(`${kind}_call_limit`);
    const reserve = kind === 'jev' ? this.limits.unknownInputTokensPerAttempt : 0;
    if (this.chargedInputTokens + reserve > this.limits.inputTokens) throw new HarnessStop('input_token_limit');
    const attempt: Attempt = { kind, ordinal: this.attempts.length + 1, dispatched: false, requestBytes, startedMs: this.elapsedMs, durationMs: null,
      inputTokens: null, unknownInputTokenReservation: reserve, status: null, outcome: 'pending', costUSD: null };
    this.attempts.push(attempt);
    return attempt;
  }
  withdraw(attempt: Attempt) {
    if (attempt.dispatched) throw new Error('Cannot withdraw a dispatched attempt');
    const index = this.attempts.indexOf(attempt);
    if (index >= 0) this.attempts.splice(index, 1);
  }
  usage(attempt: Attempt, inputTokens: unknown) {
    if (attempt.kind !== 'jev' || typeof inputTokens !== 'number' || !Number.isSafeInteger(inputTokens) || inputTokens < 0) return;
    attempt.inputTokens = inputTokens; attempt.unknownInputTokenReservation = 0;
    // A provider can exceed a reservation. Charge its actual usage and stop all
    // future dispatch; no harness can retroactively cap a paid provider request.
    if (this.chargedInputTokens > this.limits.inputTokens) throw new HarnessStop('actual_input_token_overrun');
  }
  finish(attempt: Attempt) { attempt.durationMs = Math.round(this.elapsedMs - attempt.startedMs); }
  summary() {
    const dispatched = this.attempts.filter(attempt => attempt.dispatched);
    const knownCosts = dispatched.filter(attempt => attempt.costUSD !== null);
    return { attempts: dispatched.length, pendingDispatchReservations: this.attempts.length - dispatched.length,
      calls: Object.fromEntries((['jev', 'search', 'contents'] as const).map(kind => [kind, dispatched.filter(attempt => attempt.kind === kind).length])),
      requestBytes: dispatched.reduce((sum, attempt) => sum + attempt.requestBytes, 0), measuredInputTokens: this.measuredInputTokens,
      unknownInputTokenReservations: this.unknownInputTokenReservations, chargedInputTokens: this.chargedInputTokens,
      knownCostUSD: knownCosts.length ? knownCosts.reduce((sum, attempt) => sum + attempt.costUSD!, 0) : null,
      attemptsWithUnknownCost: dispatched.length - knownCosts.length, elapsedMs: Math.round(this.elapsedMs) };
  }
}
