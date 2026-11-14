/** The four verdict labels the accuracy metric counts. */
export const VERDICT_LABELS = ['true', 'false', 'misleading', 'cant_verify'] as const;
/** Every label a row can carry, expected or predicted. */
export const EVAL_LABELS = [...VERDICT_LABELS, 'speculation', 'not_a_claim', 'needs_confirmation', 'skip', 'error'] as const;
export type EvalLabel = typeof EVAL_LABELS[number];
export type VerdictLabel = typeof VERDICT_LABELS[number];
/** Expected labels that say "this is a claim the checker should answer". */
export const CLAIM_LABELS: ReadonlySet<EvalLabel> = new Set<EvalLabel>([...VERDICT_LABELS, 'speculation']);
/** Predicted labels that count as a skip when a claim was expected. */
export const SKIP_LABELS: ReadonlySet<EvalLabel> = new Set<EvalLabel>(['skip', 'needs_confirmation', 'not_a_claim', 'error']);

const VERDICTS: Readonly<Record<string, EvalLabel>> = {
  supported: 'true', contradicted: 'false', misleading: 'misleading', insufficient_evidence: 'cant_verify', speculation: 'speculation',
};
/**
 * Skip reason codes that mean "not a checkable claim". `not_eligible_public_fact` is what branches before the
 * port send for a confident opinion, so the same script scores older servers fairly.
 */
const NOT_A_CLAIM_REASONS = new Set(['not_a_claim', 'private_or_personal', 'not_eligible_public_fact']);
const REASON_CODE = /^[a-z0-9_]{1,64}$/;

/** A reason code as the server sent it, or `other` for anything that is not a plain code (never free text). */
export const safeReasonCode = (value: unknown): string | null =>
  typeof value === 'string' ? (REASON_CODE.test(value) ? value : 'other') : null;

/** How a check ended, as the driver saw it. */
export type Terminal =
  | { type: 'claim.result' | 'claim.skipped' | 'claim.needs_confirmation' | 'pipeline.error' | 'check.cancelled'; payload: unknown }
  | { type: 'timeout' | 'transport_error'; reasonCode: string };

/** The predicted label and reason code for a terminal event. */
export function labelTerminal(terminal: Terminal): { label: EvalLabel; reasonCode: string | null } {
  if (!('payload' in terminal)) return { label: 'error', reasonCode: safeReasonCode(terminal.reasonCode) };
  const payload = typeof terminal.payload === 'object' && terminal.payload !== null ? terminal.payload as Record<string, unknown> : {};
  const reasonCode = safeReasonCode(payload.reasonCode);
  switch (terminal.type) {
    case 'claim.result': {
      const label = typeof payload.verdict === 'string' ? VERDICTS[payload.verdict] : undefined;
      return { label: label ?? 'error', reasonCode: label ? reasonCode : 'unknown_verdict' };
    }
    case 'claim.skipped':
      return { label: typeof payload.kind === 'string' || (reasonCode !== null && NOT_A_CLAIM_REASONS.has(reasonCode)) ? 'not_a_claim' : 'skip', reasonCode };
    case 'claim.needs_confirmation':
      return { label: 'needs_confirmation', reasonCode };
    default:
      return { label: 'error', reasonCode };
  }
}

/**
 * Expected label from a dataset. Accepts the reference app's labels (true, false, misleading, unverifiable,
 * not_a_claim), AVeriTeC's (Supported, Refuted, Conflicting Evidence/Cherrypicking, Not Enough Evidence) and our own.
 */
export function expectedLabel(value: string): EvalLabel {
  const key = value.trim().toLowerCase();
  const mapped: Record<string, EvalLabel> = {
    true: 'true', supported: 'true', false: 'false', refuted: 'false',
    misleading: 'misleading', conflicting: 'misleading', 'conflicting evidence/cherrypicking': 'misleading',
    unverifiable: 'cant_verify', cant_verify: 'cant_verify', 'not enough evidence': 'cant_verify',
    speculation: 'speculation', not_a_claim: 'not_a_claim', needs_confirmation: 'needs_confirmation',
  };
  const label = mapped[key];
  if (!label) throw new Error(`Unknown expected label: ${value.slice(0, 40)}`);
  return label;
}
