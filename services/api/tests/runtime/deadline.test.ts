import { afterEach, describe, expect, it, vi } from 'vitest';
import { PipelineError, type EventEnvelope, type ProviderKind, type TextInput } from '../../../../packages/contracts/src/index.js';
import { createJevClient } from '../../src/providers/jev/client.js';
import { AbortableExa } from '../../src/providers/exa/client.js';
import { AttemptBudget } from '../../src/runtime/budget.js';
import { RetryableProviderError, withProviderRetry } from '../../src/runtime/provider-retry.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { PipelineRuntime } from '../../src/runtime/pipeline.js';
import { Session } from '../../src/runtime/session.js';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const request = { state: {}, questions: { answer: { type: 'choice' as const, instructions: 'Offline control', criteria: { yes: 'yes' } } } };
const response = () => Response.json({ answers: { answer: { choice: 'yes', probabilities: { yes: 1 } } }, usage: { input_tokens: 13 } });
const flushMicrotasks = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function provider() {
  let clock = NOW;
  const budget = new AttemptBudget(), controller = new AbortController();
  return { budget, controller, context: budget.context(controller.signal, () => clock, NOW + 10_000), expire: () => { clock = NOW + 10_000; } };
}
function pipeline() {
  let clock = NOW;
  const now = () => clock, session = new Session(now), events: EventEnvelope[] = [], adapters = fixtureAdapters();
  session.listeners.add(event => events.push(event));
  const runtime = new PipelineRuntime(adapters, now, () => clock - NOW);
  const input = (id = 'req', overrides: Partial<TextInput> = {}): TextInput => ({ schemaVersion: 1, requestId: id, sessionId: session.id, sessionEpoch: session.epoch, revision: 1,
    mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en', capturedAt: new Date(clock).toISOString(), capture: { source: 'typed_fixture', segmentId: 'seg', confidence: 1 }, context: [], userInitiated: true, ...overrides });
  return { session, events, adapters, runtime, input, setClock: (value: number) => { clock = value; } };
}

describe('absolute request deadlines without a fired timeout timer', () => {
  afterEach(() => vi.useRealTimers());

  it.each<ProviderKind>(['jev', 'search', 'contents'])('rejects expired %s consumption without charging', kind => {
    const p = provider(); p.expire();
    expect(p.context.signal.aborted).toBe(false); expect(p.context.canConsume(kind, 'claim')).toBe(false);
    expect(() => p.context.consume(kind, 'claim')).toThrow('timeout');
    expect(p.budget.jev).toBe(0); expect(p.budget.searches.size).toBe(0); expect(p.budget.contents.size).toBe(0);
  });

  it('blocks the real Jev client before its first fetch', async () => {
    const p = provider(); p.expire(); const fetcher = vi.fn<typeof fetch>(async () => response());
    await expect(createJevClient({ apiKey: 'offline-test-only', fetch: fetcher }).ask(request, p.context)).rejects.toThrow('timeout');
    expect(fetcher).not.toHaveBeenCalled(); expect(p.budget.jev).toBe(0);
  });

  it.each(['search', 'contents'] as const)('blocks the actual Exa %s HTTP seam before its first fetch', async kind => {
    const p = provider(); p.expire(); const fetcher = vi.fn<typeof fetch>(async () => Response.json({ results: [] }));
    const client = new AbortableExa('offline-test-only', p.controller.signal, fetcher, p.context, 'claim');
    await expect(kind === 'search' ? client.search('Public offline claim') : client.getContents(['https://example.org/public'])).rejects.toThrow('timeout');
    expect(fetcher).not.toHaveBeenCalled(); expect(p.budget.searches.size).toBe(0); expect(p.budget.contents.size).toBe(0);
  });

  it('discards a late Jev success while preserving its actual charge and recorded usage', async () => {
    const p = provider(); const fetcher = vi.fn<typeof fetch>(async () => { p.expire(); return response(); });
    await expect(createJevClient({ apiKey: 'offline-test-only', fetch: fetcher }).ask(request, p.context)).rejects.toThrow('timeout');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(p.budget.jev).toBe(1); expect(p.budget.inputTokens).toBe(13);
  });

  it('discards a late Exa success without retrying or refunding its actual attempt', async () => {
    const p = provider(); const fetcher = vi.fn<typeof fetch>(async () => { p.expire(); return Response.json({ results: [] }); });
    await expect(new AbortableExa('offline-test-only', p.controller.signal, fetcher, p.context, 'claim').search('Public claim')).rejects.toThrow('timeout');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(p.budget.searches.get('claim')).toBe(1);
  });

  it('normalizes late provider failures to timeout and preserves cancellation over timeout', async () => {
    const p = provider(); const operation = vi.fn(async () => { p.expire(); throw new RetryableProviderError('jev_rate_limited', 0); });
    await expect(withProviderRetry(p.context, 'jev', undefined, operation)).rejects.toThrow('timeout');
    expect(operation).toHaveBeenCalledTimes(1); expect(p.budget.jev).toBe(1);
    p.controller.abort(new PipelineError('cancelled'));
    await expect(withProviderRetry(p.context, 'jev', undefined, operation)).rejects.toThrow('cancelled');
    expect(operation).toHaveBeenCalledTimes(1); expect(p.budget.jev).toBe(1);
  });

  it('rejects a retry whose backoff callback runs after the deadline without hiding timeout behind the first failure', async () => {
    vi.useFakeTimers(); const p = provider(); const operation = vi.fn(async () => { throw new RetryableProviderError('jev_rate_limited', 0); });
    const result = expect(withProviderRetry(p.context, 'jev', undefined, operation)).rejects.toThrow('timeout');
    await flushMicrotasks(); p.expire(); await vi.advanceTimersByTimeAsync(0); await result;
    expect(operation).toHaveBeenCalledTimes(1); expect(p.budget.jev).toBe(1);
  });

  it('does not replace a timeout thrown by custom consume with the preceding provider failure', async () => {
    vi.useFakeTimers(); const p = provider(); let consumes = 0;
    const context = { ...p.context, consume: () => { if (++consumes > 1) throw new PipelineError('timeout'); } };
    const operation = vi.fn(async () => { throw new RetryableProviderError('jev_unavailable', 0); });
    const result = expect(withProviderRetry(context, 'jev', undefined, operation)).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(0); await result;
    expect(operation).toHaveBeenCalledTimes(1); expect(consumes).toBe(2);
  });

  it.each(['classify', 'judge'] as const)('rejects signal-ignoring late %s success with one timeout and no cache/result', async stage => {
    vi.useFakeTimers(); const p = pipeline();
    if (stage === 'classify') { const original = p.adapters.classify; p.adapters.classify = async (...args) => { const result = await original(...args); p.setClock(NOW + 10_000); return result; }; }
    else { const original = p.adapters.judge; p.adapters.judge = async (...args) => { const result = await original(...args); p.setClock(NOW + 10_000); return result; }; }
    const retrieve = vi.spyOn(p.adapters, 'retrieve'); p.runtime.submit(p.session, p.input()); await flushMicrotasks();
    expect(p.events.filter(event => event.type === 'claim.result')).toHaveLength(0); expect(p.session.cache.size).toBe(0); expect(p.session.notifications).toHaveLength(0);
    expect(p.events.filter(event => event.type === 'pipeline.error').map(event => event.payload)).toMatchObject([{ reasonCode: 'timeout' }]);
    expect(p.session.requests.get('req')?.controller.signal.reason).toMatchObject({ code: 'timeout' });
    expect(retrieve).toHaveBeenCalledTimes(stage === 'classify' ? 0 : 1);
    expect(p.session.requests.get('req')?.budget.jev).toBe(stage === 'classify' ? 1 : 2);
    await vi.advanceTimersByTimeAsync(10_000); expect(p.events.filter(event => event.type === 'pipeline.error')).toHaveLength(1);
  });

  it('checks the commit deadline on an existing factual cache hit without more retrieval', async () => {
    vi.useFakeTimers(); const p = pipeline(), retrieve = vi.spyOn(p.adapters, 'retrieve');
    p.runtime.submit(p.session, p.input('first')); await flushMicrotasks(); expect(p.session.cache.size).toBe(1);
    p.setClock(NOW + 1_000); const get = p.session.cache.get.bind(p.session.cache);
    vi.spyOn(p.session.cache, 'get').mockImplementation(key => { p.setClock(NOW + 11_000); return get(key); });
    const set = vi.spyOn(p.session.cache, 'set'); p.runtime.submit(p.session, p.input('cached')); await flushMicrotasks();
    expect(p.events.filter(event => event.type === 'claim.result')).toHaveLength(1); expect(set).not.toHaveBeenCalled(); expect(retrieve).toHaveBeenCalledTimes(1);
    expect(p.events.filter(event => event.requestId === 'cached' && event.type === 'pipeline.error').map(event => event.payload)).toMatchObject([{ reasonCode: 'timeout' }]);
  });

  it('reports timeout rather than allowance exhaustion when synchronous work crosses the deadline after admission', async () => {
    vi.useFakeTimers(); const p = pipeline(), retrieve = vi.spyOn(p.adapters, 'retrieve');
    vi.spyOn(p.session.cache, 'get').mockImplementation(() => { p.setClock(NOW + 10_000); return undefined; });
    p.runtime.submit(p.session, p.input()); await flushMicrotasks();
    expect(retrieve).not.toHaveBeenCalled(); expect(p.session.requests.get('req')?.budget.jev).toBe(1);
    expect(p.events.filter(event => event.type === 'pipeline.error').map(event => event.payload)).toMatchObject([{ reasonCode: 'timeout' }]);
    expect(p.session.cache.size).toBe(0); expect(p.events.filter(event => event.type === 'claim.result')).toHaveLength(0);
  });

  it('does not run expired queued work when another request releases a slot before timers run', async () => {
    vi.useFakeTimers(); const p = pipeline(); const original = p.adapters.classify;
    const classify = vi.fn<typeof p.adapters.classify>((body, context) => body.requestId.startsWith('block') ? new Promise(() => undefined) : original(body, context)); p.adapters.classify = classify;
    p.runtime.submit(p.session, p.input('block-1')); p.runtime.submit(p.session, p.input('block-2')); p.runtime.submit(p.session, p.input('queued'));
    p.setClock(NOW + 10_000); p.session.cancel('block-1'); await flushMicrotasks();
    expect(classify).toHaveBeenCalledTimes(2); expect(p.session.requests.get('queued')?.budget.jev).toBe(0);
    expect(p.events.filter(event => event.requestId === 'queued' && event.type === 'pipeline.error').map(event => event.payload)).toMatchObject([{ reasonCode: 'timeout' }]);
    p.session.cancel('block-2'); await flushMicrotasks();
  });

  it('keeps the original deadline and allowance when a waiting request receives a correction at expiry', async () => {
    vi.useFakeTimers(); const p = pipeline(), classify = vi.spyOn(p.adapters, 'classify');
    p.runtime.submit(p.session, p.input('waiting', { text: 'The incomplete thought...', userInitiated: false })); await flushMicrotasks();
    const before = p.session.requests.get('waiting')!; expect(before.state).toBe('waiting'); p.setClock(NOW + 10_000);
    p.runtime.submit(p.session, p.input('waiting', { revision: 2 })); await flushMicrotasks(); const after = p.session.requests.get('waiting')!;
    expect(after.acceptedAt).toBe(before.acceptedAt); expect(after.budget).toBe(before.budget); expect(after.budget.jev).toBe(1); expect(classify).toHaveBeenCalledTimes(1);
    expect(p.events.filter(event => event.requestId === 'waiting' && event.type === 'pipeline.error').map(event => event.payload)).toMatchObject([{ reasonCode: 'timeout' }]);
    expect(p.events.filter(event => event.type === 'claim.result')).toHaveLength(0);
  });
});
