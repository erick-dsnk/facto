import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codePoints, type ClaimResult, type EventEnvelope, type PipelineAdapters, type TextInput } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../../src/policy/assessment.js';
import { PipelineRuntime } from '../../src/runtime/pipeline.js';
import { Session } from '../../src/runtime/session.js';

type Verdict = 'supported' | 'contradicted';

/** Injected exact admissions and stipulated synthetic records; no model or network calls. */
function setup(verdict: (text: string) => Verdict, splitClaims = false) {
  const classified: string[] = [];
  const retrieved: string[] = [];
  const judged: string[] = [];
  const adapters: PipelineAdapters = {
    async classify(input, ctx) {
      ctx.consume('jev'); classified.push(input.text);
      return { action: 'check', reasonCode: 'injected_public_claim', claims: (splitClaims ? input.text.split(' | ') : [input.text]).map(text => {
        const start = codePoints(input.text.slice(0, input.text.indexOf(text))).length;
        return { id: 'admitted', originalText: input.text, checkedText: text, sourceSpan: { start, end: start + codePoints(text).length },
          admission: { admissionAction: 'check', assertionStatus: 'asserted', reasonCode: 'injected', hasPracticalConsequence: .99, matchedSelectedTopic: null } };
      }) };
    },
    async retrieve(claim, ctx) {
      ctx.consume('search', claim.id); retrieved.push(claim.checkedText);
      return ['one', 'two'].map(id => ({ id, url: `https://synthetic-${id}.example/record`, title: `Synthetic comparison ${id}`, publisher: null,
        publishedAt: null, retrievedAt: new Date(ctx.now()).toISOString(), contentBasis: 'page_text' as const,
        excerpt: id === 'one'
          ? 'SYNTHETIC REGISTER: a symbol table assigns MW to megawatt and mW to milliwatt; a normative row reserves special meaning for uppercase MUST; its literal identifier field contains exactly one space in A B.'
          : 'SYNTHETIC INDEPENDENT LEDGER: a separately maintained unit glossary distinguishes megawatt MW from milliwatt mW and kilowatt kW. Its BCP14 interpretation excludes lowercase must, and its identifier transcription preserves the single internal space in A B.',
        sourceGroup: `synthetic-${id}.example`, echoGroup: null, sourceRole: 'unknown' as const,
        directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated' as const, stanceProbability: 0 }));
    },
    async judge(claim, evidence, ctx): Promise<AssessedJudgment> {
      ctx.consume('jev'); judged.push(claim.checkedText);
      const supported = verdict(claim.checkedText) === 'supported';
      return { checkedText: claim.checkedText, label: supported ? 'supported' : 'contradicted',
        probabilities: { supported: supported ? .99 : .001, contradicted: supported ? .001 : .99, misleading: .001, insufficient_evidence: .008 },
        evidence: evidence.map(source => ({ ...source, sourceRole: 'secondary', directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true,
          stance: supported ? 'supports' : 'contradicts', stanceProbability: .99 })), selectedEvidenceIds: evidence.map(source => source.id), misleadingReason: null,
        sourceAssessments: Object.fromEntries(evidence.map(source => [source.id, { contentBasis: 'original_record', confidence: .99 }])),
        claimRisk: { level: 'ordinary', confidence: .99 },
        originAssessments: [{ evidenceIds: [evidence[0].id, evidence[1].id], relationship: 'distinct_origins', confidence: .99 }] };
    }
  };
  const session = new Session(Date.now);
  const events: EventEnvelope[] = [];
  session.listeners.add(event => events.push(event));
  return { session, runtime: new PipelineRuntime(adapters), classified, retrieved, judged,
    results: () => events.filter(event => event.type === 'claim.result').map(event => event.payload as ClaimResult) };
}

function input(session: Session, requestId: string, text: string, overrides: Partial<TextInput> = {}): TextInput {
  return { schemaVersion: 1, requestId, revision: 1, sessionId: session.id, sessionEpoch: session.epoch, text, context: [], language: 'en', mode: 'typed',
    userInitiated: true, capturedAt: new Date(Date.now()).toISOString(), capture: { source: 'typed_fixture', segmentId: 'segment', confidence: 1 }, ...overrides };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('exact admitted proposition identity', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['SI symbol case', 'The SI symbol for megawatt is MW.', 'The SI symbol for megawatt is mW.'],
    ['RFC keyword case', 'RFC 8174 gives "MUST" a special BCP14 meaning.', 'RFC 8174 gives "must" a special BCP14 meaning.'],
    ['quoted internal spacing', 'The recorded identifier is "A B".', 'The recorded identifier is "A  B".'],
  ])('does not reuse a supported verdict for a different %s, but caches an exact repeat', async (_name, first, second) => {
    const { session, runtime, results, classified, retrieved, judged } = setup(text => text === first ? 'supported' : 'contradicted');
    runtime.submit(session, input(session, 'first', first)); await flush();
    runtime.submit(session, input(session, 'second', second)); await flush();
    runtime.submit(session, input(session, 'repeat', second)); await flush();
    expect(classified).toEqual([first, second, second]);
    expect(retrieved).toEqual([first, second]); expect(judged).toEqual([first, second]);
    expect(results().map(result => ({ checkedText: result.checkedText, verdict: result.verdict, cached: result.cached }))).toEqual([
      { checkedText: first, verdict: 'supported', cached: false },
      { checkedText: second, verdict: 'contradicted', cached: false },
      { checkedText: second, verdict: 'contradicted', cached: true },
    ]);
    expect(results().every(result => result.presentation.action === 'respond')).toBe(true);
    expect(session.cache.size).toBe(2);
  });

  it.each([
    ['case-sensitive symbols', 'The SI symbol for kilowatt is MW.', 'The SI symbol for kilowatt is mW.'],
    ['quoted spacing', 'The recorded identifier "A B" equals "Z".', 'The recorded identifier "A  B" equals "Z".'],
  ])('keeps automatic notification identity exact for %s while suppressing the exact repeat across context/mode', async (_name, first, second) => {
    const { session, runtime, results, judged } = setup(() => 'contradicted');
    session.preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };
    runtime.submit(session, input(session, 'first', first, { userInitiated: false, context: ['first context'] })); await flush();
    await vi.advanceTimersByTimeAsync(4_000);
    runtime.submit(session, input(session, 'second', second, { userInitiated: false, context: ['second context'] })); await flush();
    await vi.advanceTimersByTimeAsync(4_000);
    runtime.submit(session, input(session, 'repeat', second, { userInitiated: false, context: ['third context'], mode: 'audio',
      capture: { source: 'recorded_fixture', segmentId: 'audio', confidence: 1 } })); await flush();
    expect(judged).toEqual([first, second, second]); // Every context/mode combination is a factual cache miss.
    expect(results().map(result => result.presentation)).toEqual([
      { action: 'notify', reasonCode: 'practical_contradiction' },
      { action: 'notify', reasonCode: 'practical_contradiction' },
      { action: 'silent', reasonCode: 'duplicate' },
    ]);
    expect(session.recentClaims.size).toBe(2); expect(session.notifications).toHaveLength(2);
  });

  it('judges both separately admitted case-sensitive claims in one request within the original shared allowance', async () => {
    const first = 'The SI symbol for megawatt is MW.';
    const second = 'The SI symbol for megawatt is mW.';
    const { session, runtime, results, judged } = setup(text => text === first ? 'supported' : 'contradicted', true);
    runtime.submit(session, input(session, 'two-claims', `${first} | ${second}`)); await flush();
    expect(judged).toEqual([first, second]);
    expect(results().map(result => result.verdict)).toEqual(['supported', 'contradicted']);
    expect(results().map(result => result.sourceSpan)).toEqual([{ start: 0, end: codePoints(first).length },
      { start: codePoints(first + ' | ').length, end: codePoints(first + ' | ' + second).length }]);
    expect(runtime.metrics).toHaveLength(1);
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 3, searchAttempts: 2, state: 'done' });
  });
});
