import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  attributionLabel, BASIS_LABELS, claimFrame, NON_CLAIM_SUMMARIES, PROVIDER_LIMITS, SPECULATION_SUMMARIES, sliceSpan, sourceQuery, sourceQueryText,
  textInputSchema, type AcceptedClaim, type ClaimResult
} from './index.js';
import { admissionPayloadSchema, claimResultSchema, displaySnapshotSchema, eventEnvelopeSchema, evidenceSchema } from './wire.js';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
describe('version 1 golden contracts', () => {
  it('uses Unicode scalar offsets across an emoji and currency sign', () => {
    const input = textInputSchema.parse(fixture('text-unicode'));
    const result = claimResultSchema.parse(fixture('result-manual-supported'));
    expect(sliceSpan(input.text, result.sourceSpan)).toBe(result.checkedText);
    expect(input.text.slice(result.sourceSpan.start, result.sourceSpan.end)).not.toBe(result.checkedText);
    expect(result.sourceSpan).toEqual({ start: 23, end: 55 });
  });
  it.each(['result-manual-supported', 'result-manual-insufficient', 'result-automatic-silent'])('validates %s', name => {
    expect(claimResultSchema.safeParse(fixture(name)).success).toBe(true);
  });
  it('validates results and waiting inside events', () => {
    const events = fixture('events') as unknown[];
    expect(events.every(e => eventEnvelopeSchema.safeParse(e).success)).toBe(true);
    expect(eventEnvelopeSchema.safeParse(fixture('event-waiting')).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...(events[1] as object), payload: {} }).success).toBe(false);
  });
  it('validates the capture.request event added compatibly to version 1', () => {
    const capture = fixture('event-capture-request') as Record<string, unknown>;
    expect(eventEnvelopeSchema.safeParse(capture).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...capture, payload: {} }).success).toBe(false);
  });
  it('validates bounded correlated source progress and reconnect display snapshot', () => {
    const sourceEvent = fixture('event-claim-sources') as Record<string, unknown>;
    expect(eventEnvelopeSchema.safeParse(sourceEvent).success).toBe(true);
    expect(eventEnvelopeSchema.safeParse({ ...sourceEvent, revision: undefined }).success).toBe(false);
    const source = (sourceEvent.payload as { sources: unknown[] }).sources[0];
    expect(eventEnvelopeSchema.safeParse({ ...sourceEvent, payload: { sources: Array(5).fill(source) } }).success).toBe(false);
    const snapshot = displaySnapshotSchema.parse(fixture('display-snapshot'));
    expect(displaySnapshotSchema.safeParse({ ...snapshot, state: { ...snapshot.state, claimText: '🙂'.repeat(800) } }).success).toBe(true);
    expect(displaySnapshotSchema.safeParse({ ...snapshot, state: { ...snapshot.state, claimText: '🙂'.repeat(801) } }).success).toBe(false);
    expect(displaySnapshotSchema.safeParse({ ...(fixture('display-snapshot') as object), state: null }).success).toBe(true);
  });
  it('rejects invented citations and spans that do not select the checked text', () => {
    const result = claimResultSchema.parse(fixture('result-manual-supported'));
    expect(claimResultSchema.safeParse({ ...result, selectedEvidenceIds: ['invented'] }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...result, sourceSpan: { start: 23, end: 53 } }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...result, evidence: [], selectedEvidenceIds: [] }).success).toBe(false);
  });
  it('bounds input in Unicode code points without silently truncating', () => {
    const input = textInputSchema.parse(fixture('text-unicode'));
    expect(textInputSchema.safeParse({ ...input, text: '🙂'.repeat(800) }).success).toBe(true);
    expect(textInputSchema.safeParse({ ...input, text: '🙂'.repeat(801) }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, context: ['a'.repeat(601), 'b'.repeat(600)] }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, text: '  ' }).success).toBe(false);
  });
});

describe('version 1 additions for the fact-check port', () => {
  const results = ['result-manual-speculation-private', 'result-automatic-future-estimates', 'result-manual-attribution', 'result-manual-calculation'];
  const result = (name: string) => claimResultSchema.parse(fixture(name)) as ClaimResult;
  it.each(results)('validates %s', name => {
    expect(claimResultSchema.safeParse(fixture(name)).success).toBe(true);
  });
  it('keeps every older fixture valid', () => {
    for (const name of ['result-manual-supported', 'result-manual-insufficient', 'result-automatic-silent']) expect(claimResultSchema.safeParse(fixture(name)).success).toBe(true);
    expect(textInputSchema.safeParse(fixture('text-unicode')).success).toBe(true);
    expect((fixture('events') as unknown[]).every(event => eventEnvelopeSchema.safeParse(event).success)).toBe(true);
  });
  it('validates admission outcomes inside events and rejects malformed ones', () => {
    const events = fixture('events-admission-outcomes') as Record<string, unknown>[];
    expect(events.every(event => eventEnvelopeSchema.safeParse(event).success)).toBe(true);
    const [checking, skipped] = events;
    expect(eventEnvelopeSchema.safeParse({ ...skipped, payload: { ...(skipped.payload as object), kind: 'joke' } }).success).toBe(false);
    expect(eventEnvelopeSchema.safeParse({ ...skipped, payload: { admissionAction: 'skip' } }).success).toBe(false);
    expect(eventEnvelopeSchema.safeParse({ ...checking, payload: { ...(checking.payload as object), route: 'gossip' } }).success).toBe(false);
    expect(eventEnvelopeSchema.safeParse({ ...checking, payload: { ...(checking.payload as object), kind: 'opinion' } }).success).toBe(false);
    // The older shapes stay valid: no kind, summary, route or subject.
    expect(admissionPayloadSchema.safeParse({ admissionAction: 'skip', reasonCode: 'wait_expired' }).success).toBe(true);
    expect(admissionPayloadSchema.safeParse({ admissionAction: 'check', reasonCode: 'eligible_public_claim' }).success).toBe(true);
  });
  it('never retains evidence for a private-life claim and ties speculation to its reasons', () => {
    const speculation = result('result-manual-speculation-private');
    const calculation = result('result-manual-calculation');
    expect(claimResultSchema.safeParse({ ...speculation, evidence: calculation.evidence }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...speculation, reasonCode: 'no_evidence' }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...speculation, reasonCode: 'unconfirmed_rumour', summary: SPECULATION_SUMMARIES.unconfirmed_rumour }).success).toBe(true);
    expect(claimResultSchema.safeParse({ ...speculation, reasonCode: 'unconfirmed_rumour', evidence: calculation.evidence }).success).toBe(true);
    expect(claimResultSchema.safeParse({ ...result('result-manual-insufficient'), reasonCode: 'unconfirmed_rumour' }).success).toBe(false);
  });
  it('allows a basis only on a definitive verdict and matches attribution labels to verdicts', () => {
    const future = result('result-automatic-future-estimates');
    expect(claimResultSchema.safeParse({ ...future, verdict: 'insufficient_evidence', selectedEvidenceIds: [] }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...future, basis: 'rumour' }).success).toBe(false);
    const attributed = result('result-manual-attribution');
    expect(claimResultSchema.safeParse({ ...attributed, attribution: { ...attributed.attribution!, label: 'not_said' } }).success).toBe(false);
    expect(claimResultSchema.safeParse({ ...attributed, verdict: 'contradicted', attribution: { ...attributed.attribution!, label: 'not_said' } }).success).toBe(true);
    expect(claimResultSchema.safeParse({ ...attributed, attribution: { ...attributed.attribution!, source: ' ' } }).success).toBe(false);
  });
  it('limits fact-check ratings to fact_check evidence and keeps urls http(s)', () => {
    const [news, check] = result('result-automatic-future-estimates').evidence;
    expect(evidenceSchema.safeParse(check).success).toBe(true);
    expect(evidenceSchema.safeParse({ ...news, rating: 'contradicted' }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...news, origin: 'rumour_mill' }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...news, url: 'file:///etc/passwd' }).success).toBe(false);
  });
  it('accepts bounded low-confidence words on input and older input without them', () => {
    const input = textInputSchema.parse(fixture('text-audio-low-confidence'));
    expect(input.capture.lowConfidenceWords).toEqual([{ text: 'on', confidence: 0.42 }, { text: 'Tropical', confidence: 0.38 }]);
    const words = Array.from({ length: 13 }, () => ({ text: 'on', confidence: 0.4 }));
    expect(textInputSchema.safeParse({ ...input, capture: { ...input.capture, lowConfidenceWords: words } }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, capture: { ...input.capture, lowConfidenceWords: [{ text: 'on', confidence: 1.2 }] } }).success).toBe(false);
    expect(textInputSchema.safeParse({ ...input, capture: { ...input.capture, lowConfidenceWords: [{ text: ' ', confidence: 0.2 }] } }).success).toBe(false);
  });
  it('fills claim-frame defaults and builds source queries from the admitted claim only', () => {
    const claim: AcceptedClaim = { id: 'r-claim-0', originalText: 'My PIN is 1234. It opened in 1889.', checkedText: 'It opened in 1889.', sourceSpan: { start: 16, end: 34 },
      admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' } };
    expect(claimFrame(claim)).toEqual({ route: 'general', subject: null, attribution: null, future: false, rumour: false, privateLife: false, subjectMissing: false });
    const query = sourceQuery({ ...claim, subject: 'Eiffel Tower', route: 'named_fact' }, Date.parse('2026-11-14T23:30:00Z'));
    expect(query).toEqual({ claimId: 'r-claim-0', text: 'It opened in 1889.', subject: 'Eiffel Tower', route: 'named_fact', attribution: null, future: false, rumour: false, asOf: '2026-11-14' });
    expect(JSON.stringify(query)).not.toContain('PIN');
    expect(sourceQueryText(query)).toBe('Eiffel Tower It opened in 1889.');
  });
  it('words labels and limits for the app and the builders', () => {
    expect(attributionLabel({ label: 'reported', source: 'Politico', mode: 'reported' })).toBe('Politico reported this');
    expect(attributionLabel({ label: 'reported', source: 'Kushner', mode: 'said' })).toBe('Kushner said this');
    expect(attributionLabel({ label: 'not_said', source: 'Kushner', mode: 'said' })).toBe('Not what Kushner said');
    expect(attributionLabel({ label: 'not_said', source: 'Politico', mode: 'reported' })).toBe('Not what Politico reported');
    expect(BASIS_LABELS).toEqual({ estimates: 'Based on current estimates', announcement: 'Officially announced' });
    expect(NON_CLAIM_SUMMARIES.prediction).toBe("That's a prediction.");
    expect(NON_CLAIM_SUMMARIES.other).toBe('Not a checkable fact.');
    expect(SPECULATION_SUMMARIES.private_life_not_checked).toBe("Speculation. Claims about someone's private life aren't checked.");
    expect(PROVIDER_LIMITS.search).toBe(2);
  });
});
