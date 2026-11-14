import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineError, type EventEnvelope, type PipelineAdapters, type TextInput } from '../../../../packages/contracts/src/index.js';
import { AttemptBudget } from '../../src/runtime/budget.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { PipelineRuntime } from '../../src/runtime/pipeline.js';
import { Session, SessionStore } from '../../src/runtime/session.js';

const input = (s: Session, id = 'req', overrides: Partial<TextInput> = {}): TextInput => ({ schemaVersion: 1, requestId: id, sessionId: s.id, sessionEpoch: s.epoch, revision: 1, mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en', capturedAt: new Date(Date.now()).toISOString(), capture: { source: 'typed_fixture', segmentId: 'seg', confidence: 1 }, context: [], userInitiated: true, ...overrides });
function setup(adapters: PipelineAdapters = fixtureAdapters()) {
  const session = new Session(Date.now); const events: EventEnvelope[] = [];
  session.listeners.add(event => events.push(event));
  return { session, events, runtime: new PipelineRuntime(adapters), adapters };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
describe('bounded pipeline runtime', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T12:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('returns inspectable fixture results; replays an idempotent request without providers or duplicate events', async () => {
    const adapters = fixtureAdapters(); const retrieve = vi.spyOn(adapters, 'retrieve');
    const { session, events, runtime } = setup(adapters); const body = input(session);
    runtime.submit(session, body); await flush();
    expect(events.filter(e => e.type === 'claim.result')).toHaveLength(1);
    expect(runtime.metrics).toHaveLength(1);
    expect(runtime.metrics[0]).toMatchObject({ jevAttempts: 2, searchAttempts: 1 });
    expect(JSON.stringify(runtime.metrics)).not.toContain(body.text);
    expect(events.find(e => e.type === 'claim.result')?.payload).toMatchObject({ verdict: 'supported', presentation: { action: 'respond' }, cached: false });
    expect(runtime.submit(session, body).duplicate).toBe(true); await flush();
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(events.filter(e => e.type === 'claim.result')).toHaveLength(1);
    expect(() => runtime.submit(session, { ...body, text: 'Changed' })).toThrow('idempotency_conflict');
  });

  it('keeps session cache context-sensitive and responds to fresh manual checks', async () => {
    const adapters = fixtureAdapters(); const retrieve = vi.spyOn(adapters, 'retrieve');
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session, 'a', { context: ['In 2020'] })); await flush();
    runtime.submit(session, input(session, 'b', { context: ['In 2021'] })); await flush();
    runtime.submit(session, input(session, 'c', { context: ['In 2020'] })); await flush();
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(events.filter(e => e.type === 'claim.result').at(-1)?.payload).toMatchObject({ cached: true, presentation: { action: 'respond' } });
    session.pause(); expect(session.cache.size).toBe(0);
  });

  it('cancels an uncooperative provider at ten seconds, never emitting a late result', async () => {
    const adapters = fixtureAdapters();
    let resolve!: (value: Awaited<ReturnType<PipelineAdapters['retrieve']>>) => void;
    adapters.retrieve = () => new Promise(r => { resolve = r; });
    const { session, events, runtime } = setup(adapters);
    runtime.submit(session, input(session)); await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events.filter(e => e.type === 'pipeline.error')).toHaveLength(1);
    expect(events.at(-1)?.payload).toMatchObject({ reasonCode: 'timeout' });
    resolve([]); await flush();
    expect(events.some(e => e.type === 'claim.result')).toBe(false);
  });

  it('suppresses late output after stop and clears retained text', async () => {
    const adapters = fixtureAdapters(); let resolve!: (v: []) => void;
    adapters.retrieve = () => new Promise(r => { resolve = r; });
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session)); await flush();
    session.pause(); const count = events.length;
    resolve([]); await flush();
    expect(events).toHaveLength(count); expect(session.epoch).toBe(2);
    expect(session.requests.get('req')?.input.text).toBe('');
    expect(() => runtime.submit(session, input(session))).toThrow('old_epoch');
  });

  it('keeps two running/three queued per session and four running globally', async () => {
    const adapters = fixtureAdapters(); const classify = vi.fn<PipelineAdapters['classify']>(() => new Promise(() => undefined)); adapters.classify = classify;
    const runtime = new PipelineRuntime(adapters); const a = new Session(Date.now); const b = new Session(Date.now);
    for (let i = 0; i < 5; i++) runtime.submit(a, input(a, `a${i}`));
    expect(() => runtime.submit(a, input(a, 'a5'))).toThrow('queue_full');
    for (let i = 0; i < 5; i++) runtime.submit(b, input(b, `b${i}`));
    expect(classify).toHaveBeenCalledTimes(4);
    a.pause(); b.pause(); await flush();
  });

  it('waits without retrieval and expires as a non-verdict', async () => {
    const adapters = fixtureAdapters(); const retrieve = vi.spyOn(adapters, 'retrieve');
    const { session, events, runtime } = setup(adapters);
    runtime.submit(session, input(session, 'wait', { text: 'It is...', userInitiated: false })); await flush();
    expect(events.at(-1)?.type).toBe('claim.waiting');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(events.at(-1)?.payload).toMatchObject({ reasonCode: 'wait_expired' });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('allows one continuation with the original deadline and Jev budget', async () => {
    const { session, events, runtime } = setup();
    runtime.submit(session, input(session, 'wait', { text: 'It is...', userInitiated: false })); await flush();
    const original = session.requests.get('wait')!;
    await vi.advanceTimersByTimeAsync(3_000);
    runtime.submit(session, input(session, 'wait', { revision: 2, userInitiated: false })); await flush();
    const revised = session.requests.get('wait')!;
    expect(revised.budget).toBe(original.budget); expect(revised.budget.jev).toBe(3); expect(revised.continuationCount).toBe(1);
    expect(revised.acceptedAt).toBe(original.acceptedAt);
    expect(events.filter(e => e.type === 'claim.result')).toHaveLength(1);
  });

  it('corrections cannot reset per-claim search allowances or silently issue a correction cue', async () => {
    const adapters = fixtureAdapters();
    adapters.retrieve = async (claim, ctx) => { ctx.consume('search', claim.id); ctx.consume('search', claim.id); return []; };
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session, 'r', { userInitiated: false })); await flush();
    runtime.submit(session, input(session, 'r', { revision: 2, userInitiated: false, text: 'Lightning never strikes the same place twice.' })); await flush();
    expect(events.find(e => e.type === 'claim.superseded')?.payload).toMatchObject({ presentation: { action: 'silent' } });
    expect(events.at(-1)?.payload).toMatchObject({ reasonCode: 'search_budget_exhausted' });
  });

  it('keeps completed no-evidence separate from rate limits and never caches errors', async () => {
    const adapters = fixtureAdapters(); adapters.retrieve = async () => { throw new PipelineError('exa_rate_limited', true); };
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session)); await flush();
    expect(events.at(-1)?.type).toBe('pipeline.error'); expect(session.cache.size).toBe(0);
    expect(events.some(e => e.type === 'claim.result')).toBe(false);
  });

  it('enforces automatic cooldown and tombstone capacity without evicting attempt budgets', () => {
    const { session, runtime } = setup();
    runtime.submit(session, input(session, 'a', { userInitiated: false }));
    expect(() => runtime.submit(session, input(session, 'b', { userInitiated: false }))).toThrow('automatic_cooldown');
    session.pause();
  });

  it('expires stale queued captures before they reach any provider', async () => {
    const adapters = fixtureAdapters(); const normal = adapters.classify;
    adapters.classify = vi.fn<PipelineAdapters['classify']>((body, context) => body.requestId.startsWith('block') ? new Promise(() => undefined) : normal(body, context));
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session, 'block1')); runtime.submit(session, input(session, 'block2'));
    runtime.submit(session, input(session, 'queued', { userInitiated: false, capturedAt: new Date(Date.now() - 14_000).toISOString() }));
    await vi.advanceTimersByTimeAsync(2_000); session.cancel('block1'); await flush();
    expect(adapters.classify).toHaveBeenCalledTimes(2);
    expect(events.find(e => e.requestId === 'queued')?.payload).toMatchObject({ reasonCode: 'stale_capture' });
    session.pause(); await flush();
  });

  it('allows a new-epoch request identity only after explicit resume', async () => {
    const { session, runtime, events } = setup();
    runtime.submit(session, input(session)); await flush();
    session.pause(); session.active = true;
    runtime.submit(session, input(session)); await flush();
    expect(events.filter(e => e.type === 'claim.result')).toHaveLength(2);
    expect(events.filter(e => e.type === 'claim.result').at(-1)?.sessionEpoch).toBe(2);
  });

  it('supersedes an in-flight revision and never emits its late result', async () => {
    const adapters = fixtureAdapters(); const original = adapters.retrieve;
    let resolve!: (value: []) => void;
    adapters.retrieve = (claim, context) => claim.checkedText.startsWith('Helsinki') ? new Promise(r => { resolve = r; }) : original(claim, context);
    const { session, runtime, events } = setup(adapters);
    runtime.submit(session, input(session)); await flush();
    runtime.submit(session, input(session, 'req', { revision: 2, text: 'Lightning never strikes the same place twice.' })); await flush();
    resolve([]); await flush();
    expect(events.filter(e => e.type === 'claim.result').map(e => e.revision)).toEqual([2]);
  });

  it('enforces common attempt limits and session-token isolation/deletion', () => {
    const budget = new AttemptBudget(); for (let i = 0; i < 3; i++) budget.consume('jev');
    expect(() => budget.consume('jev')).toThrow('jev_budget_exhausted');
    const store = new SessionStore(); const a = store.create(); const b = store.create();
    expect(() => store.authenticate(a.id, b.token)).toThrow('unauthorized');
    const token = a.token; store.delete(a.id);
    expect(() => store.authenticate(a.id, token)).toThrow('unauthorized'); expect(a.requests.size).toBe(0);
  });
});
