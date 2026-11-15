import { describe, expect, it } from 'vitest';
import { textInputSchema } from '../../../../packages/contracts/src/index.js';
import { runEvaluation, type EvalRow } from './driver.js';
import { FakeServer, supportedResult, type CheckHandler } from './fake-server.js';
import type { EvalCase } from './sets.js';

const sample = (id: string, overrides: Partial<EvalCase> = {}): EvalCase => ({
  set: 'everyday', id, text: `Claim ${id}.`, context: [], mode: 'typed', confidence: null, expected: 'true', ...overrides,
});
const cases = (count: number) => Array.from({ length: count }, (_, index) => sample(`c${index}`));
const run = (server: FakeServer, list: EvalCase[], extra: Partial<Parameters<typeof runEvaluation>[1]> = {}) =>
  runEvaluation(list, { server: 'http://127.0.0.1:3311', joinCode: server.joinCode, transport: server.transport(), timeoutMs: 200, ...extra });
const event = (body: { requestId: string }, claim = 0) => ({ requestId: body.requestId, claimId: `${body.requestId}-claim-${claim}`, revision: 1 });

describe('live eval driver: sessions', () => {
  it('sends valid explicit text inputs and scores each result', async () => {
    const server = new FakeServer();
    const { rows, stopped, joins } = await run(server, [sample('a'), sample('b', { mode: 'audio', confidence: 0.71, context: ['Speaker 1: Hi.'],
      lowConfidenceWords: [{ text: 'on', confidence: 0.42 }] })]);
    expect(stopped).toBeNull(); expect(joins).toBe(1);
    expect(rows.map(row => row.predicted)).toEqual(['true', 'true']);
    const [typed, audio] = server.sessions.get('s1')!.checks;
    expect(textInputSchema.safeParse(typed).success).toBe(true);
    expect(textInputSchema.safeParse(audio).success).toBe(true);
    expect(typed).toMatchObject({ userInitiated: true, mode: 'typed', capture: { source: 'typed_fixture', confidence: null } });
    expect(audio).toMatchObject({ mode: 'audio', context: ['Speaker 1: Hi.'], capture: { source: 'recorded_fixture', confidence: 0.71, lowConfidenceWords: [{ text: 'on', confidence: 0.42 }] } });
    expect(server.sleeps).toEqual([250]);
  });

  it('starts a new session every 40 checks and deletes the old one', async () => {
    const server = new FakeServer();
    const { rows, joins } = await run(server, cases(85));
    expect(rows).toHaveLength(85); expect(joins).toBe(3);
    expect([...server.sessions.values()].map(session => session.checks.length)).toEqual([40, 40, 5]);
    expect([...server.sessions.values()].every(session => session.deleted)).toBe(true);
  });

  it('starts a new session before the current one runs out of time', async () => {
    // 30 s sessions, about 6 s per check: the third check would start with under 20 s left, so it gets a new session.
    const server = new FakeServer(); server.lifetimeMs = 30_000;
    const onCheck: CheckHandler = (body, session, fake) => { supportedResult(body, session, fake); fake.clock += 6_000; };
    server.onCheck = onCheck;
    const { joins } = await run(server, cases(3));
    expect(joins).toBe(2);
    expect(server.sessions.get('s1')!.checks).toHaveLength(2);
    expect(server.sessions.get('s2')!.checks).toHaveLength(1);
  });

  it('rejoins and resends after a 401 on a check', async () => {
    const server = new FakeServer();
    let first = true;
    server.onCheck = (body, session, fake) => {
      if (first) { first = false; return { status: 401, error: 'unauthorized' }; }
      supportedResult(body, session, fake);
    };
    const { rows, joins } = await run(server, [sample('a')]);
    expect(joins).toBe(2);
    expect(rows[0]).toMatchObject({ predicted: 'true' });
    expect(server.sessions.get('s1')!.deleted).toBe(true);
  });

  it('keeps joins under 10 a minute', async () => {
    const server = new FakeServer();
    await run(server, cases(25), { pool: { checksPerSession: 1 } });
    expect(server.joinTimes).toHaveLength(25);
    for (const [index, time] of server.joinTimes.entries()) {
      expect(server.joinTimes.filter(other => other > time - 60_000 && other <= time).length, `join ${index}`).toBeLessThanOrEqual(9);
    }
    expect(server.sleeps.some(ms => ms > 50_000)).toBe(true);
  });

  it('stops on a refused join code without sending it anywhere but the join body', async () => {
    const server = new FakeServer('the-real-code');
    const { rows, stopped } = await runEvaluation(cases(2), { server: 'http://127.0.0.1:3311', joinCode: 'wrong-code-123', transport: server.transport() });
    expect(stopped).toBe('join_unauthorized'); expect(rows).toEqual([]);
    const ok = new FakeServer();
    await run(ok, cases(2));
    for (const call of ok.calls) {
      expect(call.path).not.toContain(ok.joinCode);
      if (call.path !== '/v1/sessions') expect(call.body ?? '').not.toContain(ok.joinCode);
    }
  });

  it('puts the session token only in the Authorization header', async () => {
    const server = new FakeServer();
    await run(server, cases(1));
    const session = server.sessions.get('s1')!;
    expect(session.socket!.token).toBe(session.token);
    expect(session.socket!.url).toBe('ws://127.0.0.1:3311/v1/sessions/s1/stream');
    for (const call of server.calls) {
      expect(call.path).not.toContain(session.token);
      if (call.path !== '/v1/sessions') expect(call.headers.authorization).toBe(`Bearer ${session.token}`);
    }
  });
});

describe('live eval driver: older servers', () => {
  it('resends once without lowConfidenceWords after 400 invalid_request and flags it', async () => {
    const server = new FakeServer();
    server.onCheck = (body, session, fake) => {
      if (body.capture.lowConfidenceWords) return { status: 400, error: 'invalid_request' };
      supportedResult(body, session, fake);
    };
    const { rows } = await run(server, [sample('words', { mode: 'audio', confidence: 0.9, lowConfidenceWords: [{ text: 'Tropical', confidence: 0.38 }] })]);
    expect(rows[0]).toMatchObject({ predicted: 'true', fieldUnsupported: true });
    const posts = server.calls.filter(call => call.path.endsWith('/checks'));
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[1].body!).capture.lowConfidenceWords).toBeUndefined();
    expect(JSON.parse(posts[0].body!).requestId).toBe(JSON.parse(posts[1].body!).requestId);
  });

  it('does not resend a 400 when the case had no low-confidence words', async () => {
    const server = new FakeServer();
    server.onCheck = () => ({ status: 400, error: 'invalid_request' });
    const { rows } = await run(server, [sample('plain')]);
    expect(rows[0]).toMatchObject({ predicted: 'error', reasonCode: 'http_400_invalid_request', latencyMs: null });
    expect(rows[0].fieldUnsupported).toBeUndefined();
    expect(server.calls.filter(call => call.path.endsWith('/checks'))).toHaveLength(1);
  });
});

describe('live eval driver: terminal events', () => {
  const runWith = async (onCheck: CheckHandler, overrides: Partial<EvalCase> = {}): Promise<{ row: EvalRow; server: FakeServer }> => {
    const server = new FakeServer('join-code-123', onCheck);
    const { rows } = await run(server, [sample('x', overrides)]);
    return { row: rows[0], server };
  };

  it('prefers the first claim when a second claim answers first', async () => {
    const { row } = await runWith((body, session) => {
      session.socket!.push('claim.result', { verdict: 'contradicted', reasonCode: 'contradicted_by_sources' }, event(body, 1));
      session.socket!.push('claim.result', { verdict: 'supported', reasonCode: 'supported_by_sources' }, event(body, 0));
    });
    expect(row).toMatchObject({ predicted: 'true', reasonCode: 'supported_by_sources' });
  });

  it('falls back to a later claim when the first never answers', async () => {
    const { row } = await runWith((body, session) => {
      session.socket!.push('claim.result', { verdict: 'misleading', reasonCode: 'misleading_omitted_condition' }, event(body, 1));
    });
    expect(row).toMatchObject({ predicted: 'misleading' });
    expect(row.latencyMs).toBeLessThan(200);
  });

  it('maps skips, confirmations, errors and speculation', async () => {
    const skip = (payload: unknown, type = 'claim.skipped'): CheckHandler => (body, session) => { session.socket!.push(type, payload, { requestId: body.requestId, revision: 1 }); };
    expect((await runWith(skip({ admissionAction: 'skip', reasonCode: 'not_a_claim', kind: 'opinion', summary: "That's an opinion." }))).row.predicted).toBe('not_a_claim');
    expect((await runWith(skip({ admissionAction: 'skip', reasonCode: 'subject_missing' }))).row).toMatchObject({ predicted: 'skip', reasonCode: 'subject_missing' });
    expect((await runWith(skip({ admissionAction: 'skip', reasonCode: 'possibly_misheard' }, 'claim.needs_confirmation'))).row.predicted).toBe('needs_confirmation');
    expect((await runWith(skip({ reasonCode: 'provider_timeout', message: 'x' }, 'pipeline.error'))).row).toMatchObject({ predicted: 'error', reasonCode: 'provider_timeout' });
    const { row } = await runWith((body, session) => {
      session.socket!.push('claim.result', { verdict: 'speculation', reasonCode: 'private_life_not_checked', usage: { jevCalls: 1, exaSearches: 0 } }, event(body));
    });
    expect(row).toMatchObject({ predicted: 'speculation', jevCalls: 1, exaSearches: 0 });
  });

  it('ignores other requests and a later claim\'s own skip', async () => {
    const { row } = await runWith((body, session) => {
      session.socket!.push('claim.result', { verdict: 'contradicted', reasonCode: 'x' }, { requestId: 'someone-else', claimId: 'someone-else-claim-0', revision: 1 });
      session.socket!.push('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, event(body, 1));
      session.socket!.push('claim.result', { verdict: 'insufficient_evidence', reasonCode: 'insufficient_evidence' }, event(body, 0));
    });
    expect(row).toMatchObject({ predicted: 'cant_verify', jevCalls: null, exaSearches: null });
  });

  it('times out, cancels the request and records the wait', async () => {
    const { row, server } = await runWith(() => undefined);
    expect(row).toMatchObject({ predicted: 'error', reasonCode: 'timeout' });
    expect(row.latencyMs).toBeGreaterThanOrEqual(0);
    expect(server.calls.some(call => /\/checks\/[^/]+\/cancel$/.test(call.path))).toBe(true);
  });

  it('turns a dropped stream into an error and rejoins for the next check', async () => {
    const server = new FakeServer();
    let first = true;
    server.onCheck = (body, session, fake) => {
      if (first) { first = false; setImmediate(() => session.socket!.close()); return; }
      supportedResult(body, session, fake);
    };
    const { rows, joins } = await run(server, cases(2));
    expect(rows.map(row => [row.predicted, row.reasonCode])).toEqual([['error', 'stream_closed'], ['true', 'supported_by_sources']]);
    expect(joins).toBe(2);
  });

  it('never sends an input over 800 code points', async () => {
    const { row, server } = await runWith(supportedResult, { text: 'x'.repeat(801) });
    expect(row).toMatchObject({ predicted: 'error', reasonCode: 'input_too_long' });
    expect(server.calls.filter(call => call.path.endsWith('/checks'))).toHaveLength(0);
  });
});
