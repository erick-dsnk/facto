import {
  NEEDS_CONFIRMATION_SUMMARIES, NON_CLAIM_KINDS, NON_CLAIM_SUMMARIES, REASON_CODES, SPECULATION_SUMMARIES,
  type AdmissionPayload, type AdmissionResult, type CheckUsage, type ClaimFrame, type NonClaimKind, type ResultDecision, type TextInput, type Verdict, type VerdictDecision,
} from '../../../../packages/contracts/src/index.js';
import type { SourceCounts } from './source-tally.js';

/** Spoken and card text for each label the rules decide. */
export const VERDICT_SUMMARIES: Readonly<Record<Verdict, string>> = {
  supported: 'Supported by the sources I found.',
  contradicted: 'The evidence I found contradicts that claim.',
  misleading: 'That needs context.',
  insufficient_evidence: 'I couldn’t verify that.',
};

/** A captured name as the wire carries it: trimmed and at most 120 UTF-16 units, never splitting a character. */
export function wireName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  let name = '';
  for (const character of value.trim()) {
    if (name.length + character.length > 120) break;
    name += character;
  }
  name = name.trim();
  return name.length ? name : null;
}

export type AdmissionEvent = { type: 'claim.skipped' | 'claim.needs_confirmation'; payload: AdmissionPayload };

/**
 * How an input that was not admitted for checking is answered (Q2). When the wearer asks, a non-claim gets its
 * kind's line ("That's a prediction.") and a likely mishearing gets "I'm not sure what was said.", spoken unless
 * muted. Overheard, both stay silent. Nothing here is a factual verdict.
 */
export function admissionOutcome(admission: AdmissionResult, input: TextInput, muted: boolean, usage?: CheckUsage): AdmissionEvent {
  const speak = input.userInitiated && !muted;
  const presentation = { action: speak ? 'respond' as const : 'silent' as const, reasonCode: admission.reasonCode };
  const base: AdmissionPayload = { admissionAction: 'skip', reasonCode: admission.reasonCode, presentation, ...(usage ? { usage } : {}) };
  if (admission.reasonCode === REASON_CODES.possiblyMisheard) {
    return input.userInitiated
      ? { type: 'claim.needs_confirmation', payload: { ...base, summary: NEEDS_CONFIRMATION_SUMMARIES[input.mode] } }
      : { type: 'claim.skipped', payload: base };
  }
  if (admission.reasonCode === REASON_CODES.notAClaim || admission.reasonCode === REASON_CODES.privateOrPersonal) {
    const kind: NonClaimKind = admission.reasonCode === REASON_CODES.notAClaim && admission.kind && NON_CLAIM_KINDS.includes(admission.kind) ? admission.kind : 'other';
    return { type: 'claim.skipped', payload: { ...base, kind, ...(input.userInitiated ? { summary: NON_CLAIM_SUMMARIES[kind] } : {}) } };
  }
  const confirm = admission.action === 'needs_confirmation' || (admission.action === 'wait' && input.userInitiated);
  return { type: confirm ? 'claim.needs_confirmation' : 'claim.skipped', payload: base };
}

/** Q3: an allegation about someone's private life is never searched. */
export const privateLifeDecision = (): ResultDecision => ({
  verdict: 'speculation', reasonCode: REASON_CODES.privateLifeNotChecked, selectedEvidenceIds: [], summary: SPECULATION_SUMMARIES.private_life_not_checked,
});

/** Q7: an explicit request whose subject cannot be found answers Can't verify without a search. */
export const subjectMissingDecision = (): ResultDecision => ({
  verdict: 'insufficient_evidence', reasonCode: REASON_CODES.subjectMissing, selectedEvidenceIds: [], summary: VERDICT_SUMMARIES.insufficient_evidence,
});

/**
 * A rumour, allegation or speculation that the rules could not settle, with no counted voice on either side,
 * is Speculation rather than Can't verify. `counts` is null when nothing was judged at all.
 */
export function withSpeculation(decision: VerdictDecision, ruleLabel: Verdict | null, frame: Pick<ClaimFrame, 'rumour'>, counts: SourceCounts | null): ResultDecision {
  const unsettled = (ruleLabel ?? 'insufficient_evidence') === 'insufficient_evidence' && decision.verdict === 'insufficient_evidence';
  const silentSources = !counts || (counts.supporting === 0 && counts.contradicting === 0);
  if (!frame.rumour || !unsettled || !silentSources) return decision;
  return { verdict: 'speculation', reasonCode: REASON_CODES.unconfirmedRumour, selectedEvidenceIds: [], summary: SPECULATION_SUMMARIES.unconfirmed_rumour };
}
