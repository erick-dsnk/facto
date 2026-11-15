import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineError, PROVIDER_LIMITS, type AcceptedClaim, type EventEnvelope, type Evidence, type Judgment, type TextInput } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../../src/policy/assessment.js';
import type { RuntimeAdapters } from '../../src/runtime/adapters.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { PipelineRuntime } from '../../src/runtime/pipeline.js';
import { Session } from '../../src/runtime/session.js';
import { createRetriever } from '../../src/providers/exa/retrieval.js';
import { withProviderRetry, RetryableProviderError } from '../../src/runtime/provider-retry.js';

const text = 'Helsinki is the capital of Finland.';
const body = (session: Session, overrides: Partial<TextInput> = {}): TextInput => ({ schemaVersion: 1, requestId: 'req', sessionId: session.id, sessionEpoch: session.epoch, revision: 1, mode: 'typed', text, language: 'en', capturedAt: new Date(Date.now()).toISOString(), capture: { source: 'typed_fixture', segmentId: 'seg', confidence: 1 }, context: [], userInitiated: true, ...overrides });
const flush = () => vi.advanceTimersByTimeAsync(0);
function assessment(claim: AcceptedClaim, evidence: Evidence[], label: Judgment['label'] = 'supported'): AssessedJudgment {
  return { checkedText: claim.checkedText, label, probabilities: { supported: label === 'supported' ? .99 : .001, contradicted: .001, misleading: .001, insufficient_evidence: label === 'insufficient_evidence' ? .99 : .007 },
    evidence: evidence.map(source => ({ ...source, directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: .99 })),
    selectedEvidenceIds: evidence.map(source => source.id), misleadingReason: null,
    sourceAssessments: Object.fromEntries(evidence.map(source => [source.id, { contentBasis: 'original_record', confidence: .99 }])), claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [] };
}
function retentionRecord(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return { id, url: `https://${id}.example/record`, title: 'Synthetic archive', publisher: null, publishedAt: null,
    retrievedAt: new Date(Date.now()).toISOString(), contentBasis: 'highlight', excerpt: `Synthetic archive ${id} stores charter.`,
    sourceGroup: `${id}.example`, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false,
    stance: 'unrelated', stanceProbability: null, ...overrides };
}
function setup() {
  const fixture = fixtureAdapters();
  const adapters: RuntimeAdapters = { ...fixture, retrieve: vi.fn(async (claim, ctx) => (await fixture.retrieve(claim, ctx)).slice(0, 1)),
    retrieveAlternate: vi.fn(async (claim, ctx) => { ctx.consume('search', claim.id); return (await fixture.retrieve(claim, { ...ctx, consume: () => undefined })).slice(1); }),
    judge: vi.fn(async (claim, evidence, ctx) => { ctx.consume('jev'); return assessment(claim, evidence); }) };
  const session = new Session(Date.now); const events: EventEnvelope[] = [];
  session.listeners.add(event => events.push(event));
  return { adapters, session, events, runtime: new PipelineRuntime(adapters) };
}

describe('bounded alternate retrieval and fresh judgment', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('rejudges the combined raw set after policy abstention and caches only the final decision', async () => {
    const { adapters, session, events, runtime } = setup();
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adapters.judge).mock.calls[1][1]).toHaveLength(2);
    expect(vi.mocked(adapters.judge).mock.calls[1][1].every(source => source.stance === 'unrelated' && !source.directlyAddressesClaim && source.stanceProbability === 0)).toBe(true);
    const results = events.filter(event => event.type === 'claim.result');
    expect(results).toHaveLength(1);
    expect(results[0].payload).toMatchObject({ verdict: 'supported', selectedEvidenceIds: ['fixture-one', 'fixture-two'] });
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 3, searchAttempts: 2 });
    expect(session.cache.size).toBe(1);
    runtime.submit(session, body(session, { requestId: 'cached' })); await flush();
    expect(adapters.retrieveAlternate).toHaveBeenCalledTimes(1);
    expect(events.filter(event => event.type === 'claim.result').at(-1)?.payload).toMatchObject({ cached: true, verdict: 'supported' });
  });

  it('finishes a definitive first pass without any alternate work', async () => {
    const { adapters, session, events, runtime } = setup();
    adapters.retrieve = fixtureAdapters().retrieve;
    runtime.submit(session, body(session)); await flush();
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'supported' });
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(adapters.judge).toHaveBeenCalledTimes(1);
  });

  it('shares continuation admission attempts and skips an unfunded optional rejudgment', async () => {
    const { adapters, session, events, runtime } = setup();
    // The continuation's admission retries until one Jev attempt is left for its first judgment.
    const classify = adapters.classify;
    adapters.classify = async (input, ctx) => { if (input.revision === 2) for (let i = 0; i < PROVIDER_LIMITS.jev - 3; i++) ctx.consume('jev'); return classify(input, ctx); };
    runtime.submit(session, body(session, { text: 'It is...', userInitiated: false })); await flush();
    const original = session.requests.get('req')!;
    await vi.advanceTimersByTimeAsync(1_000);
    runtime.submit(session, body(session, { revision: 2, userInitiated: false })); await flush();
    expect(session.requests.get('req')?.budget).toBe(original.budget);
    expect(session.requests.get('req')?.acceptedAt).toBe(original.acceptedAt);
    expect(original.budget.jev).toBe(PROVIDER_LIMITS.jev);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence' });
  });

  it('uses the alternate after a successful empty first search without spending an empty judgment', async () => {
    const { adapters, session, events, runtime } = setup();
    adapters.retrieve = async (claim, ctx) => { ctx.consume('search', claim.id); return []; };
    adapters.retrieveAlternate = async (claim, ctx) => fixtureAdapters().retrieve(claim, ctx);
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'supported' });
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 2, searchAttempts: 2 });
  });

  it('does not rejudge identical retained evidence', async () => {
    const { adapters, session, events, runtime } = setup();
    adapters.retrieveAlternate = async (claim, ctx) => { ctx.consume('search', claim.id); return []; };
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(runtime.metrics[0].jevAttempts).toBe(2);
  });

  it('does not spend another judgment on an incoming duplicate with only a new retrieval timestamp', async () => {
    const { adapters, session, events, runtime } = setup();
    adapters.retrieveAlternate = async (claim, ctx) => {
      ctx.consume('search', claim.id);
      const records = await fixtureAdapters().retrieve(claim, { ...ctx, consume: () => undefined });
      return records.slice(0, 1).map(record => ({ ...record, retrievedAt: new Date(Date.now() + 1_000).toISOString() }));
    };
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 2, searchAttempts: 2 });
  });

  it.each([false, true])('retains a prior direct weak-basis conflict but lets fresh scope determine its veto (%s)', async freshScope => {
    const { adapters, session, events, runtime } = setup();
    const old = [retentionRecord('support'), retentionRecord('contrary')];
    const incoming = [retentionRecord('corroborator', { excerpt: 'Separate national directory maintains the civic seat and an independent location register.' })];
    adapters.retrieve = async (claim, ctx) => { ctx.consume('search', claim.id); return old; };
    adapters.retrieveAlternate = async (claim, ctx) => { ctx.consume('search', claim.id); return incoming; };
    let calls = 0;
    adapters.judge = vi.fn<RuntimeAdapters['judge']>(async (claim, evidence, ctx) => {
      ctx.consume('jev'); calls++;
      if (calls === 2) expect(evidence.every(record => record.stance === 'unrelated' && record.stanceProbability === 0
        && !record.directlyAddressesClaim && !record.matchesTimePlaceAndPopulation && record.sourceRole === 'unknown')).toBe(true);
      const result = assessment(claim, evidence);
      const contrary = result.evidence.find(record => record.id === 'contrary')!;
      contrary.stance = calls === 1 || freshScope ? 'contradicts' : 'unrelated';
      contrary.directlyAddressesClaim = calls === 1 || freshScope;
      contrary.matchesTimePlaceAndPopulation = calls === 1 || freshScope;
      contrary.stanceProbability = calls === 1 || freshScope ? .99 : 0;
      result.sourceAssessments.contrary = { contentBasis: 'bare_assertion', confidence: .99 };
      result.selectedEvidenceIds = result.evidence.filter(record => record.id !== 'contrary').map(record => record.id);
      return result;
    });
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adapters.judge).mock.calls[1][1].map(record => record.id)).toContain('contrary');
    expect(events.at(-1)?.payload).toMatchObject(freshScope ? { verdict: 'insufficient_evidence', reasonCode: 'conflicting_sources' } : { verdict: 'supported' });
    expect(session.cache.size).toBe(1);
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 3, searchAttempts: 2 });
  });

  it('rejudges a changed publisher even when the same URL retains exactly the same quoted text', async () => {
    const { adapters, session, runtime } = setup();
    const original = retentionRecord('archive');
    adapters.retrieve = async (claim, ctx) => { ctx.consume('search', claim.id); return [original]; };
    adapters.retrieveAlternate = async (claim, ctx) => { ctx.consume('search', claim.id); return [{ ...original, publisher: 'Revised publisher attribution' }]; };
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adapters.judge).mock.calls[1][1][0]).toMatchObject({ publisher: 'Revised publisher attribution', stance: 'unrelated', directlyAddressesClaim: false });
  });

  it('keeps the initial conflict abstention rather than removing its model-assessed dependence bridge', async () => {
    const { adapters, session, events, runtime } = setup();
    const original = [retentionRecord('support'), retentionRecord('bridge'), retentionRecord('contrary')];
    adapters.retrieve = async (claim, ctx) => { ctx.consume('search', claim.id); return original; };
    adapters.retrieveAlternate = async (claim, ctx) => { ctx.consume('search', claim.id); return Array.from({ length: 4 }, (_, index) => retentionRecord(`new-${index}`)); };
    adapters.judge = vi.fn<RuntimeAdapters['judge']>(async (claim, evidence, ctx) => {
      ctx.consume('jev');
      const result = assessment(claim, evidence);
      result.evidence[1].directlyAddressesClaim = false;
      result.evidence[2].stance = 'contradicts';
      result.originAssessments = [
        { evidenceIds: ['support', 'bridge'], relationship: 'common_origin', confidence: .99 },
        { evidenceIds: ['bridge', 'contrary'], relationship: 'common_origin', confidence: .99 },
      ];
      return result;
    });
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'conflicting_sources', evidence: original.map(record => expect.objectContaining({ id: record.id })) });
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 2, searchAttempts: 2 });
  });

  it('preserves high-risk source-quality abstention after a second pass', async () => {
    const { adapters, session, events, runtime } = setup();
    adapters.judge = vi.fn(async (claim, evidence, ctx) => { ctx.consume('jev'); return { ...assessment(claim, evidence), claimRisk: { level: 'health_safety', confidence: .99 } }; });
    runtime.submit(session, body(session)); await flush();
    expect(adapters.judge).toHaveBeenCalledTimes(2);
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence', selectedEvidenceIds: [] });
  });

  it.each(['exa_authentication_failed', 'malformed_exa_response', 'jev_unavailable'])('optional failure %s emits one terminal error without a fallback result or cache', async code => {
    const { adapters, session, events, runtime } = setup();
    if (code.startsWith('jev')) adapters.judge = vi.fn(async (claim, evidence, ctx) => { ctx.consume('jev'); if (evidence.length > 1) throw new PipelineError(code); return assessment(claim, evidence); });
    else adapters.retrieveAlternate = async () => { throw new PipelineError(code); };
    runtime.submit(session, body(session)); await flush();
    expect(events.filter(event => event.type === 'pipeline.error')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ claimId: 'req-claim-0', payload: { reasonCode: code } });
    expect(events.some(event => event.type === 'claim.result')).toBe(false);
    expect(session.cache.size).toBe(0);
  });

  it('honors the initial remaining-time guard and never resets the accepted deadline', async () => {
    const { adapters, session, events, runtime } = setup();
    const retrieve = adapters.retrieve;
    adapters.retrieve = async (claim, ctx) => { await new Promise(resolve => setTimeout(resolve, 7_001)); return retrieve(claim, ctx); };
    runtime.submit(session, body(session)); await vi.advanceTimersByTimeAsync(7_001);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(session.requests.get('req')?.acceptedAt).toBe(Date.parse('2026-11-14T12:00:00Z'));
  });

  it.each(['cancel', 'deadline', 'supersede'] as const)('suppresses optional late results on %s', async action => {
    const { adapters, session, events, runtime } = setup();
    let resolve!: (evidence: Evidence[]) => void;
    adapters.retrieveAlternate = (claim, ctx) => { ctx.consume('search', claim.id); return new Promise(done => { resolve = done; }); };
    runtime.submit(session, body(session)); await flush();
    if (action === 'cancel') session.cancel('req');
    if (action === 'deadline') await vi.advanceTimersByTimeAsync(10_000);
    if (action === 'supersede') runtime.submit(session, body(session, { revision: 2, text: 'I felt tired after lunch.' }));
    await flush(); const count = events.length;
    resolve([]); await flush();
    expect(events).toHaveLength(count);
    expect(events.some(event => event.type === 'claim.result')).toBe(false);
    expect(session.cache.size).toBe(0);
    expect(session.requests.get('req')?.budget.searches.get('req-claim-0')).toBe(2);
    if (action === 'supersede') expect(session.requests.get('req')?.budget.jev).toBe(3);
    if (action === 'deadline') expect(events.filter(event => event.type === 'pipeline.error')).toHaveLength(1);
  });

  it('reserves a later span initial judgment against a real retry loop and skips optional search', async () => {
    const { adapters, session, events, runtime } = setup();
    const classify = adapters.classify;
    // Admission retries leave two attempts: one for this claim and one reserved for the later span.
    adapters.classify = async (input, ctx) => { for (let i = 0; i < PROVIDER_LIMITS.jev - 3; i++) ctx.consume('jev'); const admitted = await classify(input, ctx); return { ...admitted, claims: [...admitted.claims, { ...admitted.claims[0], id: 'second', checkedText: 'Finland.', sourceSpan: { start: 27, end: 35 } }] }; };
    let attempts = 0;
    adapters.judge = async (claim, evidence, ctx) => withProviderRetry(ctx, 'jev', undefined, async () => {
      attempts++;
      if (claim.id.endsWith('-0')) throw new RetryableProviderError('jev_unavailable', 0);
      return assessment(claim, evidence);
    });
    runtime.submit(session, body(session)); await flush();
    expect(attempts).toBe(1); // the failed first judgment cannot steal the later reserve
    expect(runtime.metrics[0].jevAttempts).toBe(PROVIDER_LIMITS.jev - 1);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(events.at(-1)?.payload).toMatchObject({ reasonCode: 'jev_unavailable' });
  });

  it('keeps a useful first-span result when admission retry leaves one judgment, then errors before second retrieval', async () => {
    const { adapters, session, events, runtime } = setup();
    const classify = adapters.classify;
    adapters.classify = async (input, ctx) => { for (let i = 0; i < PROVIDER_LIMITS.jev - 2; i++) ctx.consume('jev'); const admitted = await classify(input, ctx); return { ...admitted, claims: [...admitted.claims, { ...admitted.claims[0], id: 'second', checkedText: 'Finland.', sourceSpan: { start: 27, end: 35 } }] }; };
    adapters.retrieve = vi.fn(fixtureAdapters().retrieve);
    runtime.submit(session, body(session)); await flush();
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    expect(events.find(event => event.type === 'claim.result')?.payload).toMatchObject({ verdict: 'supported' });
    expect(events.at(-1)).toMatchObject({ type: 'pipeline.error', claimId: 'req-claim-1', payload: { reasonCode: 'jev_budget_exhausted' } });
    expect(adapters.retrieve).toHaveBeenCalledTimes(1);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(runtime.metrics[0].jevAttempts).toBe(PROVIDER_LIMITS.jev);
  });

  it('checks both uncached spans within three Jev attempts without spending optional search capacity', async () => {
    const { adapters, session, events, runtime } = setup();
    const classify = adapters.classify;
    adapters.classify = async (input, ctx) => { const admitted = await classify(input, ctx); return { ...admitted, claims: [...admitted.claims, { ...admitted.claims[0], id: 'second', checkedText: 'Finland.', sourceSpan: { start: 27, end: 35 } }] }; };
    adapters.retrieve = vi.fn(fixtureAdapters().retrieve);
    runtime.submit(session, body(session)); await flush();
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(2);
    expect(adapters.judge).toHaveBeenCalledTimes(2);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 3, searchAttempts: 2 });
  });

  it('skips automatic results that become stale during optional work and does not cache them', async () => {
    const { adapters, session, events, runtime } = setup();
    const alternate = adapters.retrieveAlternate!;
    adapters.retrieveAlternate = async (claim, ctx) => { await new Promise(resolve => setTimeout(resolve, 6_000)); return alternate(claim, ctx); };
    runtime.submit(session, body(session, { userInitiated: false, capturedAt: new Date(Date.now() - 10_000).toISOString() }));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(events.at(-1)).toMatchObject({ type: 'claim.skipped', payload: { reasonCode: 'stale_capture' } });
    expect(events.some(event => event.type === 'claim.result')).toBe(false);
    expect(session.cache.size).toBe(0);
  });

  it('does not start judgment or alternate retrieval when automatic capture becomes stale during initial search', async () => {
    const { adapters, session, events, runtime } = setup();
    const retrieve = adapters.retrieve;
    adapters.retrieve = async (claim, ctx) => { await new Promise(resolve => setTimeout(resolve, 6_000)); return retrieve(claim, ctx); };
    runtime.submit(session, body(session, { userInitiated: false, capturedAt: new Date(Date.now() - 10_000).toISOString() }));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(adapters.judge).not.toHaveBeenCalled();
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: 'claim.skipped', payload: { reasonCode: 'stale_capture' } });
    expect(session.cache.size).toBe(0);
  });

  it('reserves a later judgment when its current cached result will expire within this request deadline', async () => {
    const { adapters, session, events, runtime } = setup();
    const classify = adapters.classify;
    // Populate a legitimate cached first result, then shorten its test lifetime.
    adapters.retrieve = vi.fn(fixtureAdapters().retrieve);
    runtime.submit(session, body(session)); await flush();
    const cached = [...session.cache.values()][0];
    cached.expiresAt = Date.now() + 1_000;
    // Admission retries leave exactly one judgment for each span.
    adapters.classify = async (input, ctx) => { for (let i = 0; i < PROVIDER_LIMITS.jev - 3; i++) ctx.consume('jev'); const admitted = await classify(input, ctx); return { ...admitted, claims: [{ ...admitted.claims[0], checkedText: 'Finland.', sourceSpan: { start: 27, end: 35 } }, admitted.claims[0]] }; };
    const retrieve = adapters.retrieve;
    adapters.retrieve = async (claim, ctx) => { await new Promise(resolve => setTimeout(resolve, 1_001)); return (await retrieve(claim, ctx)).slice(0, 1); };
    runtime.submit(session, body(session, { requestId: 'later-expiry' })); await vi.advanceTimersByTimeAsync(2_002);
    expect(events.filter(event => event.requestId === 'later-expiry' && event.type === 'claim.result')).toHaveLength(2);
    expect(events.some(event => event.requestId === 'later-expiry' && event.type === 'pipeline.error')).toBe(false);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(runtime.metrics.at(-1)?.jevAttempts).toBe(PROVIDER_LIMITS.jev);
  });

  it('lets the actual Exa retry consume the second search allowance instead of starting an alternate', async () => {
    const { adapters, session, events, runtime } = setup();
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
      calls++;
      expect(JSON.parse(String(options?.body)).query).toBe(text);
      if (calls === 1) return new Response('', { status: 503, headers: { 'retry-after': '0' } });
      return new Response(JSON.stringify({ results: [{ url: 'https://source.example/history', highlights: ['Helsinki is the capital of Finland. A national register records Helsinki as its national capital and seat of central government.'] }] }));
    });
    adapters.retrieve = createRetriever({ apiKey: 'synthetic-test-key', fetch: fetcher });
    runtime.submit(session, body(session)); await flush();
    expect(calls).toBe(2);
    expect(adapters.retrieveAlternate).not.toHaveBeenCalled();
    expect(events.at(-1)?.payload).toMatchObject({ verdict: 'insufficient_evidence' });
    expect(runtime.metrics[0]).toMatchObject({ searchAttempts: 2, jevAttempts: 2 });
  });
});
