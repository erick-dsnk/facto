import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  codePoints, PipelineError, PROVIDER_LIMITS, type AcceptedClaim, type AdmissionResult, type AttributionFrame, type ClaimResult, type EventEnvelope, type Evidence,
  type EvidenceSources, type FreeEvidence, type PaidSearchRequest, type PipelineAdapters, type ResultBasis, type SourceQuery, type TextInput, type Verdict,
} from '../../../../packages/contracts/src/index.js';
import { eventEnvelopeSchema } from '../../../../packages/contracts/src/wire.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import type { RuntimeAdapters } from './adapters.js';
import { ClaimCache } from './claim-cache.js';
import { PipelineRuntime } from './pipeline.js';
import { Session } from './session.js';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const FREE_ORIGINS = new Set(['fact_check', 'wikipedia', 'wikidata', 'weather', 'calculation']);
const flush = () => vi.advanceTimersByTimeAsync(0);

/** Synthetic passages; the excerpt is too short to read as an echo of anything. */
const ev = (id: string, host: string, origin: Evidence['origin'] = 'web', extra: Partial<Evidence> = {}): Evidence => ({
  id, url: `https://${host}/${id}`, title: `Synthetic ${id}`, publisher: null, publishedAt: null, retrievedAt: new Date(NOW).toISOString(), contentBasis: 'highlight',
  excerpt: `Record ${id}.`, sourceGroup: host, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false,
  stance: 'unrelated', stanceProbability: null, origin, ...extra,
});
const site = (evidence: Evidence) => new URL(evidence.url).hostname.replace(/^www\./, '');

type Script = {
  free?: Evidence[]; answered?: Partial<FreeEvidence['answered']>; trusted?: string[];
  paid?: Partial<Record<PaidSearchRequest['purpose'], Evidence[]>>; paidError?: Partial<Record<PaidSearchRequest['purpose'], PipelineError>>;
};
/** A local stand-in for the sources seam: records every query, enforces the search allowance like the real one. */
function fakeSources(script: Script = {}) {
  const calls = { free: [] as SourceQuery[], paid: [] as { query: SourceQuery; request: PaidSearchRequest }[] };
  const trusted = new Set(script.trusted ?? []);
  const sources: EvidenceSources = {
    async gatherFree(query) {
      calls.free.push(structuredClone(query));
      return { evidence: structuredClone(script.free ?? []), answered: { fact_check: null, wikipedia: true, wikidata: null, weather: null, calculation: true, ...script.answered } };
    },
    async searchPaid(query, request, context) {
      if (context.canConsume && !context.canConsume('search', query.claimId)) throw new PipelineError('search_budget_exhausted');
      context.consume('search', query.claimId);
      calls.paid.push({ query: structuredClone(query), request: structuredClone(request) });
      const error = script.paidError?.[request.purpose];
      if (error) throw error;
      return { evidence: structuredClone(script.paid?.[request.purpose] ?? []), categories: ['web'] };
    },
    rank(free, paid) {
      const order = (list: Evidence[]) => [...list].sort((a, b) => Number(sources.traits(b, null).trusted) - Number(sources.traits(a, null).trusted));
      const seen = new Set<string>();
      return [...order(free).slice(0, paid.length ? 3 : 6), ...order(paid)].filter(item => !seen.has(item.id) && seen.add(item.id)).slice(0, 6);
    },
    traits(evidence, attribution) {
      return { site: site(evidence), trusted: trusted.has(site(evidence)) || FREE_ORIGINS.has(evidence.origin ?? 'web') || (attribution !== null && evidence.origin === 'news') };
    },
  };
  return { sources, calls };
}

type Plan = { label: Verdict; p: number; stances?: Record<string, [Evidence['stance'], number]>; basis?: ResultBasis | null; risk?: AssessedJudgment['claimRisk']['level'] };
/** Scripted Jev judgment: one attempt per call, stances by evidence id, a rated fact check keeps its rating. */
function scriptedJudge(plan: (evidence: Evidence[], call: number) => Plan) {
  let call = 0;
  return vi.fn<PipelineAdapters['judge']>(async (claim, evidence, context): Promise<AssessedJudgment> => {
    context.consume('jev');
    const step = plan(evidence, ++call);
    return {
      checkedText: claim.checkedText, label: step.label, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 0, [step.label]: step.p },
      evidence: evidence.map(source => {
        const [stance, probability] = source.origin === 'fact_check' && source.rating ? [source.rating === 'supported' ? 'supports' : source.rating === 'contradicted' ? 'contradicts' : 'unrelated', 1] as const
          : step.stances?.[source.id] ?? ['unrelated', 0.9] as const;
        return { ...source, stance, stanceProbability: probability, directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true };
      }),
      selectedEvidenceIds: [], misleadingReason: null, misleadingEvidenceIds: [],
      sourceAssessments: Object.fromEntries(evidence.map(source => [source.id, { contentBasis: 'original_record', confidence: 0.99 }])),
      claimRisk: { level: step.risk ?? 'ordinary', confidence: 0.99 }, originAssessments: [],
      ...(step.basis !== undefined ? { basis: step.basis } : {}),
    };
  });
}

type Frame = Partial<Pick<AcceptedClaim, 'route' | 'subject' | 'attribution' | 'future' | 'rumour' | 'privateLife' | 'subjectMissing'>>;
/** Admits the whole input as one claim with the given frame, spending one Jev attempt. */
const admitting = (frame: Frame = {}) => vi.fn<PipelineAdapters['classify']>(async (input, context): Promise<AdmissionResult> => {
  context.consume('jev');
  return { action: 'check', reasonCode: 'eligible_public_claim', claims: [{ id: 'admitted', originalText: input.text, checkedText: input.text, sourceSpan: { start: 0, end: codePoints(input.text).length },
    admission: { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'eligible_public_claim', hasPracticalConsequence: null, matchedSelectedTopic: null }, ...frame }] };
});

function setup(options: { script?: Script; frame?: Frame; judge?: ReturnType<typeof scriptedJudge>; classify?: PipelineAdapters['classify']; cache?: ClaimCache } = {}) {
  const { sources, calls } = fakeSources(options.script);
  const retrieve = vi.fn<PipelineAdapters['retrieve']>(async () => { throw new Error('legacy retrieval must not run'); });
  const judge = options.judge ?? scriptedJudge(() => ({ label: 'insufficient_evidence', p: 0.9 }));
  const cache = options.cache ?? new ClaimCache();
  const adapters: RuntimeAdapters = { classify: options.classify ?? admitting(options.frame), retrieve, judge, sources, cache };
  const gatherFree = vi.spyOn(sources, 'gatherFree'), searchPaid = vi.spyOn(sources, 'searchPaid');
  const session = new Session(Date.now);
  const events: EventEnvelope[] = [];
  session.listeners.add(event => events.push(event));
  return { session, events, runtime: new PipelineRuntime(adapters), adapters, judge, retrieve, calls, gatherFree, searchPaid, cache,
    results: () => events.filter(event => event.type === 'claim.result').map(event => event.payload as ClaimResult) };
}
const input = (session: Session, overrides: Partial<TextInput> = {}): TextInput => ({ schemaVersion: 1, requestId: 'req', sessionId: session.id, sessionEpoch: session.epoch, revision: 1,
  mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en', capturedAt: new Date(Date.now()).toISOString(),
  capture: { source: 'typed_fixture', segmentId: 'seg', confidence: 1 }, context: [], userInitiated: true, ...overrides });
const everyEventValid = (events: EventEnvelope[]) => events.forEach(event => expect(eventEnvelopeSchema.safeParse(event).success, `${event.type} ${JSON.stringify(event.payload)}`).toBe(true));

describe('evidence-sources pipeline', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => vi.useRealTimers());

  it('V3: a True from the free sources ends the check without any Exa search', async () => {
    const judge = scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { wiki: ['supports', 0.95] } }));
    const t = setup({ script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] }, frame: { route: 'named_fact', subject: 'Finland' }, judge });
    t.runtime.submit(t.session, input(t.session, { context: ['Earlier private sentence about my salary.'] })); await flush();
    expect(t.searchPaid).not.toHaveBeenCalled();
    expect(t.results()).toHaveLength(1);
    expect(t.results()[0]).toMatchObject({ verdict: 'supported', selectedEvidenceIds: ['wiki'], route: 'named_fact', subject: 'Finland', usage: { jevCalls: 2, exaSearches: 0 }, presentation: { action: 'respond' } });
    expect(t.events.find(event => event.type === 'claim.checking')?.payload).toMatchObject({ route: 'named_fact', subject: 'Finland' });
    // Only the checked text and subject reach a source: never context or the captured text around the claim.
    expect(t.calls.free[0]).toMatchObject({ claimId: 'req-claim-0', text: 'Helsinki is the capital of Finland.', subject: 'Finland', route: 'named_fact', asOf: '2026-11-14' });
    expect(JSON.stringify(t.calls)).not.toContain('salary');
    expect(t.retrieve).not.toHaveBeenCalled();
    everyEventValid(t.events);
  });

  it('searches Exa when the free sources do not settle it, and does not rejudge identical evidence', async () => {
    const judge = scriptedJudge(evidence => ({ label: 'supported', p: 0.9, stances: Object.fromEntries(evidence.map(source => [source.id, ['supports', 0.9]])) }));
    const t = setup({ script: { free: [ev('calc', 'facto.invalid', 'calculation', { url: 'https://facto.invalid/calculation' })], paid: { primary: [ev('a', 'a.example'), ev('b', 'b.example')] } }, judge });
    // The calculation is trusted, so one supporting voice settles it before any search.
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.searchPaid).not.toHaveBeenCalled();
    const u = setup({ script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')], paid: { primary: [] } } });
    u.runtime.submit(u.session, input(u.session)); await flush();
    expect(u.calls.paid.map(call => call.request.purpose)).toEqual(['primary', 'alternate']);
    expect(u.judge).toHaveBeenCalledTimes(1); // the free set was already judged; the empty searches added nothing
    expect(u.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', usage: { exaSearches: 2 } });
  });

  it('reports the sites each Exa search found as claim.sources, one per hostname, at most four', async () => {
    const judge = scriptedJudge(() => ({ label: 'insufficient_evidence', p: 0.9 }));
    const t = setup({ judge, script: { paid: {
      primary: [ev('a', 'a.example'), ev('a2', 'a.example'), ev('b', 'b.example')],
      alternate: [ev('c', 'c.example'), ev('d', 'd.example'), ev('e', 'e.example')],
    } } });
    t.runtime.submit(t.session, input(t.session)); await flush();
    const progress = t.events.filter(event => event.type === 'claim.sources');
    // One event after each search, each listing every site found so far for this claim.
    expect(progress.map(event => (event.payload as { sources: { hostname: string }[] }).sources.map(source => source.hostname))).toEqual([
      ['a.example', 'b.example'], ['a.example', 'b.example', 'c.example', 'd.example'],
    ]);
    expect(progress.every(event => event.requestId === 'req' && event.claimId === 'req-claim-0' && event.revision === 1)).toBe(true);
    expect((progress[0].payload as { sources: unknown[] }).sources[0]).toMatchObject({ hostname: 'a.example', title: 'Synthetic a', stage: 'ready', provider: 'exa' });
    // The free sources are not search results and are never shown as sites; the checking card carries the claim and capture.
    const free = setup({ judge: scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { wiki: ['supports', 0.95] } })), script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] } });
    free.runtime.submit(free.session, input(free.session)); await flush();
    expect(free.events.some(event => event.type === 'claim.sources')).toBe(false);
    expect(free.events.find(event => event.type === 'claim.checking')?.payload).toMatchObject({ claimText: 'Helsinki is the capital of Finland.', mode: 'typed', userInitiated: true });
    everyEventValid(t.events);
    everyEventValid(free.events);
  });

  it('V4: corroborates a single untrusted supporting site by searching once more without it', async () => {
    const judge = scriptedJudge(evidence => ({ label: 'supported', p: 0.9, stances: Object.fromEntries(evidence.filter(source => source.id !== 'parking').map(source => [source.id, ['supports', 0.9]])) }));
    const t = setup({ judge, script: { paid: { primary: [ev('one', 'localnews.example'), ev('parking', 'parking.example')], corroboration: [ev('one', 'localnews.example'), ev('two', 'othertown.example')] } } });
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.calls.paid.map(call => call.request)).toEqual([{ purpose: 'primary' }, { purpose: 'corroboration', excludeSites: ['localnews.example'] }]);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge.mock.calls[1][1].map(source => source.id)).toEqual(['one', 'two', 'parking']);
    expect(judge.mock.calls[1][1].every(source => source.stanceProbability === 0 && !source.directlyAddressesClaim)).toBe(true);
    expect(t.results()[0]).toMatchObject({ verdict: 'supported', usage: { exaSearches: 2, jevCalls: 3 } });
  });

  it('V4: runs the alternate search only after Can\'t verify, merges it and never sends a third search', async () => {
    const judge = scriptedJudge(() => ({ label: 'insufficient_evidence', p: 0.9 }));
    const t = setup({ judge, script: { paid: { primary: [ev('a', 'a.example')], alternate: [ev('b', 'b.example'), ev('c', 'c.example')] } } });
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.calls.paid.map(call => call.request.purpose)).toEqual(['primary', 'alternate']);
    expect(judge.mock.calls[1][1].map(source => source.id).sort()).toEqual(['a', 'b', 'c']);
    expect(t.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', usage: { exaSearches: 2 } });
    expect(t.session.requests.get('req')!.budget.used('search', 'req-claim-0')).toBe(PROVIDER_LIMITS.search);
  });

  it('V4: sends no second search after a definitive answer, without time left, or when a later claim still needs work', async () => {
    const decided = setup({ judge: scriptedJudge(() => ({ label: 'contradicted', p: 0.9, stances: { a: ['contradicts', 0.9], b: ['contradicts', 0.9] } })), script: { paid: { primary: [ev('a', 'a.example'), ev('b', 'b.example')] } } });
    decided.runtime.submit(decided.session, input(decided.session)); await flush();
    expect(decided.calls.paid).toHaveLength(1);
    expect(decided.results()[0]).toMatchObject({ verdict: 'contradicted', usage: { exaSearches: 1 } });

    const slow = setup({ script: { paid: { primary: [ev('a', 'a.example')] } } });
    const original = slow.adapters.sources!.gatherFree;
    slow.adapters.sources!.gatherFree = async (query, context) => { await new Promise(resolve => setTimeout(resolve, 7_001)); return original(query, context); };
    slow.runtime.submit(slow.session, input(slow.session)); await vi.advanceTimersByTimeAsync(7_001);
    expect(slow.calls.paid.map(call => call.request.purpose)).toEqual(['primary']);
    expect(slow.results()[0].verdict).toBe('insufficient_evidence');
    // More time might have settled it, so the abstention is not shared.
    expect(slow.cache.size).toBe(0);

    const two = setup({ script: { paid: { primary: [ev('a', 'a.example')] } }, classify: async (body, context) => {
      context.consume('jev');
      const first = 'Helsinki is the capital of Finland.', second = 'Turku is a city.';
      const admission = { assertionStatus: 'asserted' as const, admissionAction: 'check' as const, reasonCode: 'eligible_public_claim', hasPracticalConsequence: null, matchedSelectedTopic: null };
      return { action: 'check', reasonCode: 'eligible_public_claim', claims: [
        { id: 'one', originalText: body.text, checkedText: first, sourceSpan: { start: 0, end: codePoints(first).length }, admission },
        { id: 'two', originalText: body.text, checkedText: second, sourceSpan: { start: codePoints(first).length + 1, end: codePoints(body.text).length }, admission },
      ] };
    } });
    two.runtime.submit(two.session, input(two.session, { text: 'Helsinki is the capital of Finland. Turku is a city.' })); await flush();
    expect(two.calls.paid.map(call => `${call.query.claimId}:${call.request.purpose}`)).toEqual(['req-claim-0:primary', 'req-claim-1:primary', 'req-claim-1:alternate']);
    expect(two.results()).toHaveLength(2);
  });

  it('V4: a correction that already spent the search allowance sends nothing more', async () => {
    const t = setup({ script: { paid: { primary: [ev('a', 'a.example')] } } });
    t.runtime.submit(t.session, input(t.session, { userInitiated: false })); await flush();
    expect(t.calls.paid).toHaveLength(2);
    t.runtime.submit(t.session, input(t.session, { userInitiated: false, revision: 2, text: 'Turku is the capital of Finland.' })); await flush();
    expect(t.calls.paid).toHaveLength(2);
    expect(t.results().at(-1)).toMatchObject({ verdict: 'insufficient_evidence', usage: { exaSearches: 2 } });
  });

  it.each([true, false])('V5: never searches or judges a private-life allegation (asked=%s)', async userInitiated => {
    const t = setup({ frame: { privateLife: true, subject: 'Jensen Huang' } });
    t.session.preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };
    t.runtime.submit(t.session, input(t.session, { text: "Jensen Huang's fourth affair.", userInitiated })); await flush();
    expect(t.gatherFree).not.toHaveBeenCalled();
    expect(t.searchPaid).not.toHaveBeenCalled();
    expect(t.judge).not.toHaveBeenCalled();
    expect(t.results()[0]).toMatchObject({ verdict: 'speculation', reasonCode: 'private_life_not_checked', evidence: [], selectedEvidenceIds: [],
      summary: "Speculation. Claims about someone's private life aren't checked.", subject: 'Jensen Huang', usage: { jevCalls: 1, exaSearches: 0 },
      presentation: userInitiated ? { action: 'respond', reasonCode: 'explicit_request' } : { action: 'notify', reasonCode: 'automatic_speculation' } });
    expect(t.cache.size).toBe(0);
    everyEventValid(t.events);
  });

  it('V6: an unconfirmed rumour that nothing addresses is Speculation', async () => {
    const t = setup({ frame: { rumour: true }, script: { paid: { primary: [ev('a', 'gossip.example')] } } });
    t.runtime.submit(t.session, input(t.session, { text: 'Examplecorp is about to be sold to Megacorp.' })); await flush();
    expect(t.results()[0]).toMatchObject({ verdict: 'speculation', reasonCode: 'unconfirmed_rumour', selectedEvidenceIds: [], summary: 'Speculation. No credible source confirms this.' });
    expect(t.results()[0].evidence.map(source => source.id)).toEqual(['a']);
    const empty = setup({ frame: { rumour: true } });
    empty.runtime.submit(empty.session, input(empty.session, { text: 'Examplecorp is about to be sold to Megacorp.' })); await flush();
    expect(empty.judge).not.toHaveBeenCalled();
    expect(empty.results()[0]).toMatchObject({ verdict: 'speculation', reasonCode: 'unconfirmed_rumour', evidence: [] });
    everyEventValid([...t.events, ...empty.events]);
  });

  it('V6: a rumour a trusted source denies is False, and an ordinary claim nothing addresses is Can\'t verify', async () => {
    const judge = scriptedJudge(() => ({ label: 'contradicted', p: 0.9, stances: { agency: ['contradicts', 0.9] } }));
    const denied = setup({ frame: { rumour: true }, judge, script: { trusted: ['reuters.com'], paid: { primary: [ev('agency', 'reuters.com', 'news')] } } });
    denied.runtime.submit(denied.session, input(denied.session, { text: 'Examplecorp is about to be sold to Megacorp.' })); await flush();
    expect(denied.results()[0]).toMatchObject({ verdict: 'contradicted', selectedEvidenceIds: ['agency'] });
    const ordinary = setup();
    ordinary.runtime.submit(ordinary.session, input(ordinary.session)); await flush();
    expect(ordinary.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'no_evidence', evidence: [] });
    expect(ordinary.calls.paid.map(call => call.request.purpose)).toEqual(['primary', 'alternate']);
  });

  it('V7: one news report settles an attributed claim and labels it', async () => {
    const attribution: AttributionFrame = { source: 'Example Times', mode: 'reported' };
    const judge = scriptedJudge(() => ({ label: 'supported', p: 0.8, stances: { report: ['supports', 0.94] } }));
    const t = setup({ frame: { route: 'recent_event', attribution }, judge, script: { paid: { primary: [ev('report', 'www.example.com', 'news')] } } });
    t.runtime.submit(t.session, input(t.session, { text: 'According to Example Times, the Riverside Bridge reopened on Monday.' })); await flush();
    expect(t.results()[0]).toMatchObject({ verdict: 'supported', attribution: { label: 'reported', source: 'Example Times', mode: 'reported' }, route: 'recent_event' });
    expect(t.calls.paid[0].query.attribution).toEqual(attribution);
    // An attributed recent event is never cached.
    expect(t.cache.size).toBe(0);
    const denied = setup({ frame: { route: 'recent_event', attribution }, judge: scriptedJudge(() => ({ label: 'contradicted', p: 0.8, stances: { report: ['contradicts', 0.94] } })), script: { paid: { primary: [ev('report', 'www.example.com', 'news')] } } });
    denied.runtime.submit(denied.session, input(denied.session, { text: 'According to Example Times, the Riverside Bridge reopened on Monday.' })); await flush();
    expect(denied.results()[0]).toMatchObject({ verdict: 'contradicted', attribution: { label: 'not_said', source: 'Example Times', mode: 'reported' } });
    everyEventValid([...t.events, ...denied.events]);
  });

  it('V8: a future claim far outside current estimates is False with its basis', async () => {
    const judge = scriptedJudge(() => ({ label: 'contradicted', p: 0.8, basis: 'estimates', stances: { a: ['contradicts', 0.9], b: ['contradicts', 0.85] } }));
    const t = setup({ frame: { future: true, subject: 'Anthropic' }, judge, script: { paid: { primary: [ev('a', 'markets.example', 'news'), ev('b', 'wire.example', 'news')] } } });
    t.runtime.submit(t.session, input(t.session, { text: 'Anthropic will IPO at a 2.5 trillion dollar valuation.' })); await flush();
    expect(t.calls.paid[0].query).toMatchObject({ future: true, subject: 'Anthropic' });
    expect(t.results()[0]).toMatchObject({ verdict: 'contradicted', basis: 'estimates', selectedEvidenceIds: ['a', 'b'] });
    everyEventValid(t.events);
  });

  it.each([
    [{ action: 'skip', reasonCode: 'not_a_claim', claims: [], kind: 'prediction' } as AdmissionResult, true, 'claim.skipped', { kind: 'prediction', summary: "That's a prediction.", presentation: { action: 'respond', reasonCode: 'not_a_claim' } }],
    [{ action: 'skip', reasonCode: 'not_a_claim', claims: [], kind: 'opinion' } as AdmissionResult, false, 'claim.skipped', { kind: 'opinion', presentation: { action: 'silent', reasonCode: 'not_a_claim' } }],
    [{ action: 'needs_confirmation', reasonCode: 'possibly_misheard', claims: [] } as AdmissionResult, true, 'claim.needs_confirmation', { summary: "I'm not sure what was said.", presentation: { action: 'respond', reasonCode: 'possibly_misheard' } }],
    [{ action: 'skip', reasonCode: 'possibly_misheard', claims: [] } as AdmissionResult, false, 'claim.skipped', { presentation: { action: 'silent', reasonCode: 'possibly_misheard' } }],
    [{ action: 'skip', reasonCode: 'subject_missing', claims: [] } as AdmissionResult, false, 'claim.skipped', { presentation: { action: 'silent', reasonCode: 'subject_missing' } }],
  ] as const)('V9: answers a non-checkable input without any source or judge (%#)', async (admission, userInitiated, type, payload) => {
    const t = setup({ classify: async (_body, context) => { context.consume('jev'); return admission; } });
    t.runtime.submit(t.session, input(t.session, { mode: 'audio', capture: { source: 'recorded_fixture', segmentId: 'seg', confidence: 0.4 }, userInitiated })); await flush();
    const event = t.events.at(-1)!;
    expect(event.type).toBe(type);
    expect(event.payload).toMatchObject({ admissionAction: 'skip', reasonCode: admission.reasonCode, usage: { jevCalls: 1, exaSearches: 0 }, ...payload });
    if (!userInitiated) expect(event.payload).not.toHaveProperty('summary');
    expect(t.gatherFree).not.toHaveBeenCalled();
    expect(t.judge).not.toHaveBeenCalled();
    everyEventValid(t.events);
  });

  it('V9: an asked claim missing its subject answers Can\'t verify without a search', async () => {
    const t = setup({ frame: { subjectMissing: true } });
    t.runtime.submit(t.session, input(t.session, { text: 'It opened in 1889.' })); await flush();
    expect(t.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'subject_missing', evidence: [], subject: null, presentation: { action: 'respond' } });
    expect(t.gatherFree).not.toHaveBeenCalled();
    expect(t.judge).not.toHaveBeenCalled();
    everyEventValid(t.events);
  });

  it('V10: shares finished checks across sessions for 24 hours, keyed by subject', async () => {
    const cache = new ClaimCache();
    const judge = scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { wiki: ['supports', 0.95] } }));
    const first = setup({ cache, judge, frame: { subject: 'Finland' }, script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] } });
    first.runtime.submit(first.session, input(first.session, { text: 'Helsinki is the capital of Finland.' })); await flush();
    expect(cache.size).toBe(1);
    const second = setup({ cache, judge, frame: { subject: 'Finland' } });
    second.runtime.submit(second.session, input(second.session, { text: 'helsinki is  the capital of Finland.' })); await flush();
    expect(second.gatherFree).not.toHaveBeenCalled();
    expect(second.results()[0]).toMatchObject({ verdict: 'supported', cached: true, checkedText: 'helsinki is  the capital of Finland.', originalText: 'helsinki is  the capital of Finland.', usage: { jevCalls: 1, exaSearches: 0 } });
    expect(second.results()[0].checkedAt).toBe(first.results()[0].checkedAt);
    expect(Date.parse(second.results()[0].expiresAt)).toBeGreaterThan(Date.now());
    const other = setup({ cache, judge, frame: { subject: 'Sweden' }, script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] } });
    other.runtime.submit(other.session, input(other.session)); await flush();
    expect(other.gatherFree).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(2);
    vi.setSystemTime(NOW + 86_400_000);
    const later = setup({ cache, judge, frame: { subject: 'Finland' }, script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] } });
    later.runtime.submit(later.session, input(later.session)); await flush();
    expect(later.gatherFree).toHaveBeenCalledTimes(1);
    expect(later.results()[0].cached).toBe(false);
    everyEventValid([...first.events, ...second.events]);
  });

  it('V10: never caches weather or attributed recent events, and stores no captured text', async () => {
    const cache = new ClaimCache();
    const set = vi.spyOn(cache, 'set');
    const weather = setup({ cache, frame: { route: 'weather' }, judge: scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { forecast: ['supports', 0.9] } })), script: { free: [ev('forecast', 'open-meteo.com', 'weather')] } });
    weather.runtime.submit(weather.session, input(weather.session, { text: 'It will snow in Helsinki tomorrow.' })); await flush();
    expect(weather.results()[0].verdict).toBe('supported');
    expect(set).not.toHaveBeenCalled();
    const said = setup({ cache, frame: { route: 'recent_event', attribution: { source: 'Kushner', mode: 'said' } }, judge: scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { r: ['supports', 0.9] } })), script: { paid: { primary: [ev('r', 'news.example', 'news')] } } });
    said.runtime.submit(said.session, input(said.session, { text: 'Kushner said the talks failed.' })); await flush();
    expect(said.results()[0].verdict).toBe('supported');
    expect(set).not.toHaveBeenCalled();
    const stored = setup({ cache, frame: { subject: 'Finland' }, judge: scriptedJudge(() => ({ label: 'supported', p: 0.9, stances: { wiki: ['supports', 0.95] } })), script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')] } });
    stored.runtime.submit(stored.session, input(stored.session, { context: ['My private context.'] })); await flush();
    expect(set).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(set.mock.calls[0][1])).not.toContain('private');
    expect(set.mock.calls[0][1]).not.toHaveProperty('originalText');
  });

  it('keeps an abstention that rests on a failed free source out of the cache', async () => {
    const t = setup({ script: { answered: { wikipedia: false } } });
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.results()[0].verdict).toBe('insufficient_evidence');
    expect(t.cache.size).toBe(0);
  });

  it('reports a primary Exa failure as an error, unless the free sources already gave a definitive answer', async () => {
    const failing = setup({ script: { paidError: { primary: new PipelineError('exa_unavailable') } } });
    failing.runtime.submit(failing.session, input(failing.session)); await flush();
    expect(failing.results()).toHaveLength(0);
    expect(failing.events.at(-1)).toMatchObject({ type: 'pipeline.error', claimId: 'req-claim-0', payload: { reasonCode: 'exa_unavailable' } });
    expect(failing.cache.size).toBe(0);
    const judge = scriptedJudge(() => ({ label: 'misleading', p: 0.8, stances: { wiki: ['contradicts', 0.9] } }));
    const kept = setup({ judge, script: { free: [ev('wiki', 'en.wikipedia.org', 'wikipedia')], paidError: { primary: new PipelineError('exa_unavailable') } } });
    kept.runtime.submit(kept.session, input(kept.session)); await flush();
    expect(kept.results()[0]).toMatchObject({ verdict: 'misleading', selectedEvidenceIds: ['wiki'] });
    expect(kept.cache.size).toBe(0);
  });

  it('keeps the first answer when the optional second search breaks: not kept and never Speculation', async () => {
    const optional = setup({ frame: { rumour: true }, script: { paid: { primary: [ev('a', 'a.example')] }, paidError: { alternate: new PipelineError('exa_unavailable') } } });
    optional.runtime.submit(optional.session, input(optional.session)); await flush();
    expect(optional.calls.paid.map(call => call.request.purpose)).toEqual(['primary', 'alternate']);
    expect(optional.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', evidence: [{ id: 'a' }], presentation: { action: 'respond' } });
    expect(optional.cache.size).toBe(0);
    const judge = scriptedJudge(evidence => ({ label: 'supported', p: 0.9, stances: Object.fromEntries(evidence.map(source => [source.id, ['supports', 0.9]])) }));
    const corroboration = setup({ judge, script: { paid: { primary: [ev('one', 'localnews.example')] }, paidError: { corroboration: new PipelineError('malformed_exa_response') } } });
    corroboration.runtime.submit(corroboration.session, input(corroboration.session)); await flush();
    expect(corroboration.calls.paid.map(call => call.request.purpose)).toEqual(['primary', 'corroboration']);
    expect(corroboration.results()[0]).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(corroboration.cache.size).toBe(0);
    everyEventValid([...optional.events, ...corroboration.events]);
  });

  it('an outage is never Speculation: failed free sources and an empty search answer Can\'t verify, silent when overheard', async () => {
    const failed = { fact_check: false, wikipedia: false, wikidata: false, calculation: true } as const;
    const asked = setup({ frame: { rumour: true }, script: { answered: failed } });
    asked.runtime.submit(asked.session, input(asked.session, { text: 'Examplecorp is about to be sold to Megacorp.' })); await flush();
    expect(asked.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'no_evidence', presentation: { action: 'respond' } });
    expect(asked.cache.size).toBe(0);
    const overheard = setup({ frame: { rumour: true }, script: { answered: failed } });
    overheard.session.preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };
    overheard.runtime.submit(overheard.session, input(overheard.session, { text: 'Examplecorp is about to be sold to Megacorp.', userInitiated: false })); await flush();
    expect(overheard.results()[0]).toMatchObject({ verdict: 'insufficient_evidence', presentation: { action: 'silent' } });
    everyEventValid([...asked.events, ...overheard.events]);
  });

  it('with no search left and a failed free source there is nothing to answer from: an error, not Can\'t verify', async () => {
    const t = setup({ frame: { rumour: true }, script: { answered: { wikipedia: false }, paid: { primary: [ev('a', 'a.example')] } } });
    t.runtime.submit(t.session, input(t.session, { userInitiated: false })); await flush();
    expect(t.calls.paid).toHaveLength(2);
    t.runtime.submit(t.session, input(t.session, { userInitiated: false, revision: 2, text: 'Turku is the capital of Finland.' })); await flush();
    expect(t.calls.paid).toHaveLength(2);
    expect(t.events.at(-1)).toMatchObject({ type: 'pipeline.error', payload: { reasonCode: 'sources_unavailable', presentation: { action: 'silent' } } });
    // With every free source answering, the spent allowance falls through to Can't verify, never Speculation.
    const u = setup({ frame: { rumour: true }, script: { paid: { primary: [ev('a', 'a.example')] } } });
    u.runtime.submit(u.session, input(u.session, { userInitiated: false })); await flush();
    u.runtime.submit(u.session, input(u.session, { userInitiated: false, revision: 2, text: 'Turku is the capital of Finland.' })); await flush();
    expect(u.results()[0]).toMatchObject({ verdict: 'speculation' });
    expect(u.results().at(-1)).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(u.cache.size).toBe(1); // only the first, complete check
  });

  it('a check that runs out of time is a timeout, never Can\'t verify or Speculation, and nothing is cached', async () => {
    const t = setup({ frame: { rumour: true } });
    const original = t.adapters.sources!.gatherFree;
    t.adapters.sources!.gatherFree = async (query, context) => { const free = await original(query, context); vi.setSystemTime(NOW + 10_001); return free; };
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.results()).toHaveLength(0);
    expect(t.searchPaid).not.toHaveBeenCalled();
    expect(t.events.at(-1)).toMatchObject({ type: 'pipeline.error', payload: { reasonCode: 'timeout' } });
    expect(t.cache.size).toBe(0);
  });

  it('never sends contact data to a source, whatever admission decided', async () => {
    const t = setup({ frame: { subject: 'Jane 415 555 0100' } });
    t.runtime.submit(t.session, input(t.session)); await flush();
    expect(t.gatherFree).not.toHaveBeenCalled();
    expect(t.searchPaid).not.toHaveBeenCalled();
    expect(t.events.at(-1)).toMatchObject({ type: 'pipeline.error', payload: { reasonCode: 'private_or_personal' } });
  });

  it.each([
    ['contradicted', { label: 'contradicted', p: 0.9, stances: { a: ['contradicts', 0.9], b: ['contradicts', 0.9] } }, 'notify', 'automatic_contradiction'],
    ['misleading', { label: 'misleading', p: 0.8, stances: { a: ['contradicts', 0.9] } }, 'notify', 'automatic_misleading'],
    ['supported', { label: 'supported', p: 0.9, stances: { a: ['supports', 0.9], b: ['supports', 0.9] } }, 'silent', 'automatic_noncontradiction'],
    ['insufficient_evidence', { label: 'insufficient_evidence', p: 0.9 }, 'silent', 'automatic_noncontradiction'],
  ] as const)('V11: overheard %s follows the Q2 notification table', async (verdict, plan, action, reasonCode) => {
    const t = setup({ judge: scriptedJudge(() => plan as Plan), script: { paid: { primary: [ev('a', 'a.example'), ev('b', 'b.example')] } } });
    t.session.preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };
    t.runtime.submit(t.session, input(t.session, { userInitiated: false })); await flush();
    expect(t.results()[0]).toMatchObject({ verdict, presentation: { action, reasonCode } });
    everyEventValid(t.events);
  });

  it('V11: an overheard unconfirmed rumour alerts, and nothing alerts with notifications off', async () => {
    const on = setup({ frame: { rumour: true } });
    on.session.preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };
    on.runtime.submit(on.session, input(on.session, { userInitiated: false })); await flush();
    expect(on.results()[0]).toMatchObject({ verdict: 'speculation', presentation: { action: 'notify', reasonCode: 'automatic_speculation' } });
    const off = setup({ frame: { rumour: true } });
    off.runtime.submit(off.session, input(off.session, { userInitiated: false })); await flush();
    expect(off.results()[0].presentation).toEqual({ action: 'silent', reasonCode: 'notifications_disabled' });
  });

  it('cancels with the request: no late result after a correction supersedes a sources check', async () => {
    const t = setup({ script: { paid: { primary: [ev('a', 'a.example')] } } });
    let release!: () => void;
    let calls = 0;
    const original = t.adapters.sources!.gatherFree;
    t.adapters.sources!.gatherFree = async (query, context) => {
      if (++calls === 1) await new Promise<void>(resolve => { release = resolve; });
      return original(query, context);
    };
    t.runtime.submit(t.session, input(t.session)); await flush();
    t.runtime.submit(t.session, input(t.session, { revision: 2, text: 'Turku is the capital of Finland.' })); await flush();
    release(); await flush();
    expect(t.results().map(result => result.checkedText)).toEqual(['Turku is the capital of Finland.']);
    expect(t.events.filter(event => event.revision === 1 && event.type === 'claim.result')).toHaveLength(0);
  });
});
