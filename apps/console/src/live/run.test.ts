import { describe, expect, it, vi } from 'vitest';
import type { EventEnvelope } from '../../../../packages/contracts/src/index.js';
import type { JevQuestion } from '../../../../services/api/src/providers/jev/client.js';
import { buildAlternateQuery } from '../../../../services/api/src/evidence/normalize.js';
import { DEVELOPMENT_LIMITS } from './budget.js';
import { DEVELOPMENT_CASES, runLiveCampaign, terminalEvent, type LiveCase } from './run.js';

const publicCase = DEVELOPMENT_CASES[0];
const keys = { jev: 'PRIVATE_KEY_MARKER_JEV', exa: 'PRIVATE_KEY_MARKER_EXA' };

function answersFor(init?: RequestInit, personal = false) {
  const request = JSON.parse(String(init?.body)) as { questions: Record<string, JevQuestion> };
  const choices: Record<string, string> = { verdict: 'supported', selected_evidence: 'e0', misleading_reason: 'none', claim_risk: 'ordinary' };
  return Object.fromEntries(Object.entries(request.questions).map(([name, question]) => {
    if (question.type === 'noul') return [name, { noul: name.endsWith('_private_data') ? Number(personal) : name.endsWith('_context_established') ? 0 : 1 }];
    const choice = choices[name] ?? (name.endsWith('_kind') ? personal ? 'personal_experience' : 'public_fact'
      : name.endsWith('_assertion_status') ? 'asserted' : name.endsWith('_claim_structure') ? 'one_coherent'
        : name.endsWith('_stance') ? 'supports' : name.endsWith('_context_reason') ? 'none'
          : name.endsWith('_content_basis') ? 'original_record' : name.endsWith('_origin') ? 'distinct_origins' : Object.keys(question.criteria)[0]);
    return [name, { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, Number(key === choice)])) }];
  }));
}

function syntheticProvider(options: { jevStatus?: number; exaStatus?: number; searchRetry?: boolean; contents?: boolean; personal?: boolean } = {}) {
  let searches = 0;
  return vi.fn<typeof fetch>(async (url, init) => {
    if (String(url).includes('typesafe.ai')) return options.jevStatus
      ? Response.json({ error: 'RAW_PROVIDER_ERROR_MUST_NOT_ESCAPE' }, { status: options.jevStatus })
      : Response.json({ answers: answersFor(init, options.personal), usage: { input_tokens: 1_000 } });
    if (String(url).endsWith('/search')) {
      searches++;
      if (options.exaStatus || (options.searchRetry && searches === 1)) return Response.json({}, { status: options.exaStatus ?? 503, headers: { 'retry-after': '0' } });
      return Response.json({ results: [{ url: 'https://history.example.org/opera', title: 'Sydney Opera House history',
        highlights: [options.contents ? 'Sydney Opera House' : 'The Sydney Opera House opened in 1973. The historical record describes its opening ceremony in Sydney and the detailed programme from that year.'] }], costDollars: { total: 0.007 } });
    }
    return Response.json({ results: [{ url: 'https://history.example.org/opera', title: 'Sydney Opera House history',
      text: 'The Sydney Opera House opened in 1973. The historical record describes its opening ceremony in Sydney and the detailed programme from that year.' }], costDollars: { total: 0.001 } });
  });
}

describe('bounded authenticated live campaign with injected provider HTTP', () => {
  it('uses real authenticated Fastify HTTP and WS with fresh cache-repeat metrics and public-only sanitized evidence', async () => {
    const providerFetch = syntheticProvider({ contents: true, searchRetry: true });
    const checkpoints: string[] = [];
    const report = await runLiveCampaign({ keys, cases: [publicCase, { ...publicCase, label: 'repeat' }], providerFetch,
      onProgress: progress => { checkpoints.push(JSON.stringify(progress)); } });
    expect(report.completed).toBe(true);
    expect(report.auth).toEqual({ unauthorizedJoinStatus: 401, unauthorizedCheckStatus: 401, unauthorizedWebsocketStatus: 401 });
    expect(report.cases[0].terminalReceived).toBe(true);
    expect(report.cases[0].events.at(-1)?.type).toBe('claim.result');
    expect(report.cases[0].attempts.filter(attempt => attempt.kind === 'search')).toHaveLength(2);
    expect(report.cases[0].attempts.filter(attempt => attempt.kind === 'contents')).toHaveLength(1);
    expect(report.cases[0].events.at(-1)?.cached).toBe(false);
    expect(report.cases[1].events.at(-1)?.cached).toBe(true);
    expect(report.cases[1].attempts.map(attempt => attempt.kind)).toEqual(['jev']);
    expect(report.cases[1].usage.measuredInputTokens).toBe(1_000);
    expect(report.cases[1].runtime).toMatchObject({ jevConsumed: 1, searchConsumed: 0, contentsConsumed: 0 });
    expect(report.cases[0].attempts.filter(attempt => attempt.kind === 'search').map(attempt => attempt.query)).toEqual([publicCase.text, publicCase.text]);
    expect(checkpoints.length).toBe(report.totals.attempts * 2);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(keys.jev); expect(serialized).not.toContain(keys.exa);
    expect(serialized).not.toContain('originalText'); expect(serialized).not.toContain('instructions');
    expect(report.cases[0].evidence.some(record => record.stage === 'judgment' && record.sourceAssessments && record.claimRisk && record.originAssessments)).toBe(true);
    expect(report.cases[0].events[0].receivedMs).toBeLessThanOrEqual(report.cases[0].events.at(-1)!.receivedMs);
  });

  it('distinguishes a local byte stop from a provider error and still receives its correlated terminal WS event', async () => {
    const providerFetch = syntheticProvider();
    const report = await runLiveCampaign({ keys, cases: [publicCase, { ...publicCase, label: 'never-sent' }], providerFetch,
      limits: { ...DEVELOPMENT_LIMITS, requestBytes: 1 } });
    expect(providerFetch).not.toHaveBeenCalled();
    expect(report.completed).toBe(false);
    expect(report.counts).toMatchObject({ declared: 2, observed: 1, terminalReceipts: 1, localStops: 1, providerErrors: 0 });
    expect(report.cases[0]).toMatchObject({ status: 'local_stop', terminalType: 'pipeline.error', terminalReceived: true, localStops: ['harness_request_byte_limit'] });
    expect(report.cases[0].runtime?.jevConsumed).toBe(1);
    expect(report.cases[0].usage.measuredInputTokens).toBe(0);
    expect(report.totals.attempts).toBe(0);
  });

  it('observes a policy-approved alternate after empty retrieval with its exact public query', async () => {
    const ordinary = syntheticProvider(); let searches = 0;
    const providerFetch = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/search') && ++searches === 1) return Response.json({ results: [] });
      return ordinary(url, init);
    });
    const report = await runLiveCampaign({ keys, cases: [publicCase], providerFetch });
    expect(report.completed).toBe(true);
    expect(report.cases[0].attempts.filter(attempt => attempt.kind === 'search').map(attempt => attempt.query)).toEqual([publicCase.text, buildAlternateQuery(publicCase.text, 'balanced_evidence')]);
    expect(report.cases[0].evidence.filter(record => record.stage === 'retrieval')[0].records).toHaveLength(0);
    expect(report.cases[0].evidence.some(record => record.stage === 'alternate' && record.records.length > 0)).toBe(true);
    expect(report.cases[0].terminalReceived).toBe(true);
  });

  it('enforces a campaign wall stop while waiting and still awaits cancellation receipt', async () => {
    const report = await runLiveCampaign({ keys, cases: [{ label: 'wall-wait', text: 'The population is', allowedPublic: [], automatic: true, final: false }],
      limits: { ...DEVELOPMENT_LIMITS, wallMs: 1_000 }, providerFetch: syntheticProvider() });
    expect(report.completed).toBe(false);
    expect(report.cases[0]).toMatchObject({ status: 'local_stop', localStops: ['harness_wall_limit'], terminalType: 'check.cancelled', terminalReceived: true });
    expect(report.cases[0].events.some(event => event.type === 'claim.waiting')).toBe(true);
    expect(report.totals.attempts).toBe(0);
  });

  it.each(['jev', 'exa'] as const)('observes sanitized %s authentication failure through the real runtime and WS', async provider => {
    const report = await runLiveCampaign({ keys, cases: [publicCase], providerFetch: syntheticProvider(provider === 'jev' ? { jevStatus: 401 } : { exaStatus: 401 }) });
    expect(report.completed).toBe(true);
    expect(report.counts.providerErrors).toBe(1);
    expect(report.cases[0]).toMatchObject({ status: 'observed', terminalReceived: true, terminalType: 'pipeline.error', localStops: [] });
    expect(report.cases[0].events.at(-1)?.reasonCode).toBe(provider === 'jev' ? 'jev_authentication' : 'exa_authentication_failed');
    expect(report.cases[0].attempts.at(-1)?.status).toBe(401);
    expect(JSON.stringify(report)).not.toContain('RAW_PROVIDER_ERROR');
    if (provider === 'jev') expect(report.totals.unknownInputTokenReservations).toBe(24_000);
  });

  it('keeps synthetic private input out of reports and dispatches no retrieval', async () => {
    const text = 'I felt SYNTHETIC_PRIVATE_MARKER after lunch.';
    const report = await runLiveCampaign({ keys, cases: [{ label: 'private', text, allowedPublic: [] }], providerFetch: syntheticProvider({ personal: true }) });
    expect(report.completed).toBe(true);
    expect(report.cases[0].terminalType).toBe('claim.skipped');
    expect(report.cases[0].admission?.reasonCode).toBe('private_or_personal');
    expect(report.totals.calls).toEqual({ jev: 1, search: 0, contents: 0 });
    expect(JSON.stringify(report)).not.toContain('SYNTHETIC_PRIVATE_MARKER');
  });

  it('observes cancellation via correlated check.cancelled and preserves unknown in-flight usage', async () => {
    const providerFetch = vi.fn<typeof fetch>(async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
    }));
    const report = await runLiveCampaign({ keys, cases: [{ ...publicCase, cancelAfterDetected: true }], providerFetch });
    expect(report.completed).toBe(true);
    expect(report.cases[0]).toMatchObject({ terminalType: 'check.cancelled', terminalReceived: true, status: 'observed' });
    expect(report.cases[0].runtime?.state).toBe('cancelled');
    expect(report.cases[0].events.some(event => event.type === 'claim.result')).toBe(false);
    expect(report.cases[0].attempts[0]).toMatchObject({ inputTokens: null, unknownInputTokenReservation: 24_000, outcome: 'aborted' });
  });

  it('continues observing after claim.waiting until correlated wait expiry without calling providers', async () => {
    const providerFetch = syntheticProvider();
    const sample: LiveCase = { label: 'wait', text: 'The population is', allowedPublic: [], automatic: true, final: false };
    const report = await runLiveCampaign({ keys, cases: [sample], providerFetch });
    expect(report.completed).toBe(true);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(report.cases[0].events.map(event => event.type)).toEqual(['claim.detected', 'claim.waiting', 'claim.skipped']);
    expect(report.cases[0].events.at(-1)?.reasonCode).toBe('wait_expired');
    expect(report.cases[0].durationMs).toBeGreaterThanOrEqual(7_900);
  }, 12_000);
});

describe('terminal receipt correlation', () => {
  const event = (type: EventEnvelope['type'], requestId = 'request', claimId?: string, revision = 1): EventEnvelope => ({ schemaVersion: 1,
    eventId: 'event', eventSeq: 1, sessionId: 'session', sessionEpoch: 1, type, requestId, claimId, revision, serverAt: new Date().toISOString(), payload: {} });

  it('ignores waiting, other requests and stale revisions, and awaits both admitted claim receipts', () => {
    const events = [event('claim.waiting'), event('claim.result', 'other', 'other'), event('claim.result', 'request', 'old', 2), event('claim.result', 'request', 'one')];
    expect(terminalEvent(events, 'request', 2)).toBeUndefined();
    events.push(event('claim.result', 'request', 'one'));
    expect(terminalEvent(events, 'request', 2)).toBeUndefined();
    events.push(event('claim.result', 'request', 'two'));
    expect(terminalEvent(events, 'request', 2)).toBe(events.at(-1));
  });
});
