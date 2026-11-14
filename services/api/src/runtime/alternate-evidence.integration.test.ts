import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AcceptedClaim, type ClaimResult, type EventEnvelope, type Evidence, type ProviderContext, type TextInput } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import type { RuntimeAdapters } from './adapters.js';
import { PipelineRuntime } from './pipeline.js';
import { Session } from './session.js';

const checkedText = 'The Meridian bridge opened in 1889.';
const delay = () => new Promise(resolve => setTimeout(resolve, 1_000));
function source(id: string, excerpt: string): Evidence {
  return { id, url: `https://${id}.org/record`, title: 'Synthetic source', publisher: null, publishedAt: null,
    retrievedAt: '2026-11-14T12:00:00Z', contentBasis: 'highlight', excerpt, sourceGroup: `${id}.org`, echoGroup: null,
    sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null };
}
const witnesses = () => [
  source('old-register-a', 'SYNTHETIC civic inauguration ledger A-17 records first public access in eighteen eighty-nine, with an archived entry signed by its keeper.'),
  source('old-register-b', 'SYNTHETIC independently maintained engineering journal B-22 dates the inaugural visitor crossing to the last year of the eighteen-eighties, citing its own field inspection.'),
];
const noise = (id: string) => source(id, `${checkedText} SYNTHETIC topical summary repeats this statement without identifying observations or a source record.`);

function setup(initial: Evidence[], incoming: Evidence[]) {
  const session = new Session(Date.now);
  const events: EventEnvelope[] = [];
  const deadlines: (number | undefined)[] = [];
  session.listeners.add(event => events.push(event));
  let judgments = 0;
  const judge = vi.fn(async (claim: AcceptedClaim, records: Evidence[], context: ProviderContext): Promise<AssessedJudgment> => {
    context.consume('jev'); judgments++;
    return {
      checkedText: claim.checkedText, label: judgments === 1 ? 'insufficient_evidence' : 'supported',
      probabilities: { supported: judgments === 1 ? .01 : .99, contradicted: 0, misleading: 0, insufficient_evidence: judgments === 1 ? .99 : .01 },
      evidence: records.map(record => {
        const direct = record.id.startsWith('old-register-') || record.id === 'new-counterrecord';
        return { ...record, directlyAddressesClaim: direct, matchesTimePlaceAndPopulation: direct,
          stance: record.id === 'new-counterrecord' ? 'contradicts' : direct ? 'supports' : 'unrelated', stanceProbability: .99 };
      }),
      selectedEvidenceIds: records.filter(record => record.id.startsWith('old-register-')).map(record => record.id),
      misleadingReason: null,
      sourceAssessments: Object.fromEntries(records.map(record => [record.id, { contentBasis: record.id.startsWith('old-register-') || record.id === 'new-counterrecord' ? 'original_record' : 'bare_assertion', confidence: .99 }])),
      claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [],
    };
  });
  const retrieve = vi.fn<RuntimeAdapters['retrieve']>(async (claim, context) => {
    context.consume('search', claim.id);
    deadlines.push((context as ProviderContext & { deadlineAt?: number }).deadlineAt);
    await delay(); return structuredClone(initial);
  });
  const alternate = vi.fn<RuntimeAdapters['retrieve']>(async (claim, context) => {
    context.consume('search', claim.id);
    deadlines.push((context as ProviderContext & { deadlineAt?: number }).deadlineAt);
    await delay(); return structuredClone(incoming);
  });
  const adapters: RuntimeAdapters = {
    classify: async (input, context) => {
      context.consume('jev');
      return { action: 'check', reasonCode: 'synthetic_public_fact', claims: [{ id: 'admitted', originalText: input.text, checkedText: input.text,
        sourceSpan: { start: 0, end: Array.from(input.text).length }, admission: { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'synthetic_public_fact', hasPracticalConsequence: null, matchedSelectedTopic: null } }] };
    },
    retrieve, retrieveAlternate: alternate, judge,
  };
  const runtime = new PipelineRuntime(adapters, Date.now, Date.now);
  const input: TextInput = { schemaVersion: 1, requestId: 'retention-integration', sessionId: session.id, sessionEpoch: session.epoch, revision: 1,
    mode: 'typed', text: checkedText, language: 'en', capturedAt: new Date(Date.now()).toISOString(), capture: { source: 'typed_fixture', segmentId: 'seg', confidence: 1 }, context: [], userInitiated: true };
  return { session, events, runtime, input, judge, retrieve, alternate, deadlines };
}

describe('alternate evidence retention through the composed runtime', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('freshly judges useful prior witnesses with new topical noise within the original shared budget and deadline', async () => {
    const { session, events, runtime, input, judge, retrieve, alternate, deadlines } = setup(witnesses(), Array.from({ length: 6 }, (_, index) => noise(`incoming-noise-${index}`)));
    const acceptedAt = Date.now();
    runtime.submit(session, input);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(alternate).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(2);
    const raw = judge.mock.calls[1][1];
    expect(raw).toHaveLength(6);
    expect(raw.map(record => record.id)).toEqual(expect.arrayContaining(['old-register-a', 'old-register-b']));
    expect(raw.some(record => record.id.startsWith('incoming-noise-'))).toBe(true);
    expect(raw.every(record => record.sourceRole === 'unknown' && !record.directlyAddressesClaim && !record.matchesTimePlaceAndPopulation && record.stance === 'unrelated' && record.stanceProbability === 0)).toBe(true);
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    const result = events.at(-1)?.payload as ClaimResult;
    expect(result).toMatchObject({ verdict: 'supported', selectedEvidenceIds: expect.arrayContaining(['old-register-a', 'old-register-b']) });
    expect(result.selectedEvidenceIds).toHaveLength(2);
    expect(runtime.metrics).toHaveLength(1);
    expect(runtime.metrics[0]).toMatchObject({ state: 'done', jevAttempts: 3, searchAttempts: 2, contentAttempts: 0, durationMs: 2_000 });
    expect(deadlines).toEqual([acceptedAt + 10_000, acceptedAt + 10_000]);
  });

  it('keeps a new low-overlap counterrecord in the fresh judgment and vetoes a confident unsupported definitive result', async () => {
    const counter = source('new-counterrecord', 'SYNTHETIC independent archive K-9 records initial public access in eighteen ninety, one year later than the asserted date.');
    const { session, events, runtime, input, judge, alternate } = setup([...witnesses(), ...Array.from({ length: 4 }, (_, index) => noise(`old-noise-${index}`))], [noise('new-noise'), counter]);
    runtime.submit(session, input);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(alternate).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge.mock.calls[1][1].map(record => record.id)).toEqual(expect.arrayContaining(['old-register-a', 'old-register-b', 'new-counterrecord']));
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'conflicting_sources', selectedEvidenceIds: [] });
    expect(runtime.metrics[0]).toMatchObject({ state: 'done', jevAttempts: 3, searchAttempts: 2 });
    expect(events.some(event => event.type === 'pipeline.error')).toBe(false);
  });

  it('rejudges below-threshold prior records without promoting their scheduling preference into a verdict', async () => {
    const { session, events, runtime, input, judge } = setup(witnesses(), Array.from({ length: 6 }, (_, index) => noise(`incoming-noise-${index}`)));
    const originalJudge = judge.getMockImplementation()!;
    judge.mockImplementation(async (claim, records, context) => {
      const result = await originalJudge(claim, records, context);
      for (const record of records.filter(record => record.id.startsWith('old-register-'))) {
        result.sourceAssessments[record.id].confidence = .78;
      }
      return result;
    });
    runtime.submit(session, input);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(judge).toHaveBeenCalledTimes(2);
    const raw = judge.mock.calls[1][1];
    expect(raw).toHaveLength(6);
    expect(raw.filter(record => record.id.startsWith('old-register-'))).toHaveLength(2);
    expect(raw.filter(record => record.id.startsWith('incoming-noise-'))).toHaveLength(4);
    expect(raw.every(record => record.sourceRole === 'unknown' && !record.directlyAddressesClaim && !record.matchesTimePlaceAndPopulation && record.stance === 'unrelated' && record.stanceProbability === 0)).toBe(true);
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'insufficient_independent_evidence', selectedEvidenceIds: [] });
    expect(runtime.metrics[0]).toMatchObject({ state: 'done', jevAttempts: 3, searchAttempts: 2, durationMs: 2_000 });
  });
});
