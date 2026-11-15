import { describe, expect, it } from 'vitest';
import { NON_CLAIM_SUMMARIES, type AdmissionResult, type TextInput } from '../../../../packages/contracts/src/index.js';
import { admissionPayloadSchema } from '../../../../packages/contracts/src/wire.js';
import { admissionOutcome, privateLifeDecision, subjectMissingDecision, VERDICT_SUMMARIES, wireName, withSpeculation } from './outcomes.js';

const input = (overrides: Partial<TextInput> = {}): TextInput => ({ schemaVersion: 1, requestId: 'r', sessionId: 's', sessionEpoch: 1, revision: 1, mode: 'audio',
  text: 'Pineapple pizza is the best pizza.', language: 'en', capturedAt: '2026-11-14T12:00:00Z', capture: { source: 'recorded_fixture', segmentId: 'seg', confidence: 0.9 },
  context: [], userInitiated: true, ...overrides });
const skip = (reasonCode: string, kind?: AdmissionResult['kind'], action: AdmissionResult['action'] = 'skip'): AdmissionResult => ({ action, reasonCode, claims: [], ...(kind ? { kind } : {}) });
const usage = { jevCalls: 1, exaSearches: 0 };

describe('admission outcomes (Q2)', () => {
  it.each(['opinion', 'prediction', 'question', 'instruction', 'other'] as const)('answers an asked %s with its line and no search', kind => {
    const outcome = admissionOutcome(skip('not_a_claim', kind), input(), false, usage);
    expect(outcome).toEqual({ type: 'claim.skipped', payload: { admissionAction: 'skip', reasonCode: 'not_a_claim', kind, summary: NON_CLAIM_SUMMARIES[kind], presentation: { action: 'respond', reasonCode: 'not_a_claim' }, usage } });
    expect(admissionPayloadSchema.safeParse(outcome.payload).success).toBe(true);
  });

  it('keeps overheard and muted non-claims silent', () => {
    expect(admissionOutcome(skip('not_a_claim', 'opinion'), input({ userInitiated: false }), false)).toEqual({ type: 'claim.skipped',
      payload: { admissionAction: 'skip', reasonCode: 'not_a_claim', kind: 'opinion', presentation: { action: 'silent', reasonCode: 'not_a_claim' } } });
    expect(admissionOutcome(skip('not_a_claim', 'opinion'), input(), true).payload.presentation).toEqual({ action: 'silent', reasonCode: 'not_a_claim' });
  });

  it('labels private or personal input as other and a not-a-claim without a kind as other', () => {
    expect(admissionOutcome(skip('private_or_personal', 'opinion'), input(), false).payload).toMatchObject({ kind: 'other', summary: 'Not a checkable fact.' });
    expect(admissionOutcome(skip('not_a_claim'), input(), false).payload).toMatchObject({ kind: 'other', summary: NON_CLAIM_SUMMARIES.other });
  });

  it.each(['audio', 'ocr', 'typed'] as const)('asks to confirm a likely mishearing when asked (%s), silently skips it when overheard', mode => {
    const asked = admissionOutcome(skip('possibly_misheard', undefined, 'needs_confirmation'), input({ mode }), false);
    expect(asked.type).toBe('claim.needs_confirmation');
    expect(asked.payload).toMatchObject({ reasonCode: 'possibly_misheard', presentation: { action: 'respond' } });
    expect(asked.payload.summary).toBe(mode === 'audio' ? "I'm not sure what was said." : mode === 'ocr' ? "I'm not sure what was read." : "I'm not sure what you meant.");
    const overheard = admissionOutcome(skip('possibly_misheard'), input({ mode, userInitiated: false }), false);
    expect(overheard).toEqual({ type: 'claim.skipped', payload: { admissionAction: 'skip', reasonCode: 'possibly_misheard', presentation: { action: 'silent', reasonCode: 'possibly_misheard' } } });
  });

  it('keeps the earlier behaviour for every other reason', () => {
    expect(admissionOutcome(skip('subject_missing'), input({ userInitiated: false }), false)).toEqual({ type: 'claim.skipped',
      payload: { admissionAction: 'skip', reasonCode: 'subject_missing', presentation: { action: 'silent', reasonCode: 'subject_missing' } } });
    expect(admissionOutcome(skip('incomplete', undefined, 'wait'), input(), false).type).toBe('claim.needs_confirmation');
    expect(admissionOutcome(skip('unknown_fixture', undefined, 'needs_confirmation'), input(), false).payload).toEqual({ admissionAction: 'skip', reasonCode: 'unknown_fixture', presentation: { action: 'respond', reasonCode: 'unknown_fixture' } });
  });
});

describe('policy-decided outcomes', () => {
  it('words a private-life allegation as Speculation without evidence', () => {
    expect(privateLifeDecision()).toEqual({ verdict: 'speculation', reasonCode: 'private_life_not_checked', selectedEvidenceIds: [], summary: "Speculation. Claims about someone's private life aren't checked." });
    expect(subjectMissingDecision()).toEqual({ verdict: 'insufficient_evidence', reasonCode: 'subject_missing', selectedEvidenceIds: [], summary: VERDICT_SUMMARIES.insufficient_evidence });
  });

  const abstained = { verdict: 'insufficient_evidence' as const, reasonCode: 'no_direct_evidence', selectedEvidenceIds: [], summary: VERDICT_SUMMARIES.insufficient_evidence };
  const silent = { supporting: 0, contradicting: 0, notAddressing: 2, trustedSupporting: 0, trustedContradicting: 0 };
  it('turns an unsettled rumour with no counted voice into Speculation', () => {
    expect(withSpeculation(abstained, 'insufficient_evidence', { rumour: true }, silent)).toMatchObject({ verdict: 'speculation', reasonCode: 'unconfirmed_rumour', selectedEvidenceIds: [], summary: 'Speculation. No credible source confirms this.' });
    expect(withSpeculation(abstained, null, { rumour: true }, null)).toMatchObject({ verdict: 'speculation' });
  });

  it('leaves ordinary claims, counted voices and policy abstentions alone', () => {
    expect(withSpeculation(abstained, 'insufficient_evidence', { rumour: false }, silent)).toBe(abstained);
    expect(withSpeculation(abstained, 'insufficient_evidence', { rumour: true }, { ...silent, supporting: 1 })).toBe(abstained);
    expect(withSpeculation(abstained, 'insufficient_evidence', { rumour: true }, { ...silent, contradicting: 1 })).toBe(abstained);
    // The rules said True but the strict gate abstained: still Can't verify.
    expect(withSpeculation(abstained, 'supported', { rumour: true }, silent)).toBe(abstained);
    const contradicted = { verdict: 'contradicted' as const, reasonCode: 'qualifying_evidence', selectedEvidenceIds: ['a'], summary: VERDICT_SUMMARIES.contradicted };
    expect(withSpeculation(contradicted, 'contradicted', { rumour: true }, silent)).toBe(contradicted);
  });

  it('bounds names for the wire without splitting a character', () => {
    expect(wireName('  NASA  ')).toBe('NASA');
    expect(wireName('   ')).toBeNull();
    expect(wireName(null)).toBeNull();
    const long = wireName('🦉'.repeat(100))!;
    expect(long.length).toBe(120);
    expect(Array.from(long)).toHaveLength(60);
    expect(wireName('a'.repeat(200))).toHaveLength(120);
  });
});
