import { afterEach, describe, expect, it, vi } from 'vitest';
import { PipelineError, PROVIDER_LIMITS, type ProviderContext, type ProviderKind } from '../../../../packages/contracts/src/index.js';
import { createJevClient } from '../../src/providers/jev/client.js';
import { AbortableExa } from '../../src/providers/exa/client.js';
import { RetryableProviderError, retryAfterDelay, withProviderRetry } from '../../src/runtime/provider-retry.js';
import { AttemptBudget } from '../../src/runtime/budget.js';

const NOW = Date.parse('2026-11-14T10:00:00Z');
function context(options: { deadlineAt?: number; failOnConsume?: number } = {}) {
  const controller = new AbortController(); const attempts: ProviderKind[] = [];
  const providerContext: ProviderContext & { deadlineAt?: number; canConsume(kind: ProviderKind, claimId?: string): boolean } = {
    signal: controller.signal, now: () => Date.now(), deadlineAt: options.deadlineAt,
    canConsume(kind) { return attempts.filter(item => item === kind).length + 1 < (options.failOnConsume ?? Number.POSITIVE_INFINITY)
      && attempts.filter(item => item === kind).length < (kind === 'jev' ? 3 : kind === 'search' ? 2 : 3); },
    consume(kind) { attempts.push(kind); if (attempts.length === options.failOnConsume) throw new PipelineError(`${kind}_budget_exhausted`); }
  };
  return { providerContext, controller, attempts };
}

describe('shared provider retry policy', () => {
  afterEach(() => vi.useRealTimers());

  it('parses Retry-After seconds and HTTP dates, and treats malformed values as absent', () => {
    expect(retryAfterDelay('2', NOW)).toBe(2_000);
    expect(retryAfterDelay('Sat, 14 Nov 2026 10:00:03 GMT', NOW)).toBe(3_000);
    expect(retryAfterDelay('bad', NOW)).toBeUndefined();
    expect(retryAfterDelay('-1', NOW)).toBeUndefined();
    expect(retryAfterDelay('1.5', NOW)).toBeUndefined();
  });

  it('charges both actual attempts and retries one transient operation only once', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { providerContext, attempts } = context(); let calls = 0;
    const promise = withProviderRetry(providerContext, 'search', 'claim-1', async () => {
      if (++calls === 1) throw new RetryableProviderError('exa_rate_limited', 250);
      return 'ok';
    });
    await vi.advanceTimersByTimeAsync(249); expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(attempts).toEqual(['search', 'search']);
  });

  it('does not sleep when Retry-After cannot fit the shared accepted-text deadline', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { providerContext, attempts } = context({ deadlineAt: NOW + 100 }); let calls = 0;
    await expect(withProviderRetry(providerContext, 'jev', undefined, async () => {
      calls++; throw new RetryableProviderError('jev_rate_limited', 100);
    })).rejects.toThrow('jev_rate_limited');
    expect(calls).toBe(1); expect(attempts).toEqual(['jev']);
  });

  it('cancels retry backoff and preserves the original provider error when no budget remains', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { providerContext, controller, attempts } = context();
    const cancelled = withProviderRetry(providerContext, 'search', 'claim-1', async () => {
      throw new RetryableProviderError('exa_rate_limited', 5_000);
    });
    await Promise.resolve(); await Promise.resolve();
    controller.abort(new PipelineError('cancelled'));
    await expect(cancelled).rejects.toThrow('cancelled');
    expect(attempts).toEqual(['search']);

    const exhausted = context({ failOnConsume: 2 }); let calls = 0;
    await expect(withProviderRetry(exhausted.providerContext, 'search', 'claim-1', async () => {
      calls++; throw new RetryableProviderError('exa_unavailable', 0);
    })).rejects.toThrow('exa_unavailable');
    expect(calls).toBe(1); expect(exhausted.attempts).toEqual(['search']);
  });
});

describe('provider clients use the shared retry budget', () => {
  afterEach(() => vi.useRealTimers());

  it('retries a Jev 503 once, charges each HTTP call, and cancels the unread error body', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { providerContext, attempts } = context(); let calls = 0; let cancelled = false;
    const fetcher = vi.fn<typeof fetch>(async () => {
      calls++;
      if (calls === 1) {
        const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
        return new Response(body, { status: 503, headers: { 'retry-after': '1' } });
      }
      return Response.json({ answers: { answer: { choice: 'yes', probabilities: { yes: 1 } } } });
    });
    const client = createJevClient({ apiKey: 'test-only', fetch: fetcher });
    const result = client.ask({ state: {}, questions: { answer: { type: 'choice', instructions: '', criteria: { yes: '' } } } }, providerContext);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toMatchObject({ answer: { choice: 'yes' } });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(attempts).toEqual(['jev', 'jev']); expect(cancelled).toBe(true);
  });

  it('retries an Exa operation inside the SDK request seam and charges both searches', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const { providerContext, attempts } = context(); let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => ++calls === 1
      ? new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } })
      : Response.json({ results: [] }));
    const client = new AbortableExa('test-only', providerContext.signal, fetcher, providerContext, 'claim-1');
    const result = client.search('public claim', { type: 'auto', numResults: 5, contents: { highlights: true } });
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ results: [] });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(attempts).toEqual(['search', 'search']);
  });

  it('retries transient stream-read failures but leaves malformed JSON nonretryable', async () => {
    const { providerContext, attempts } = context(); let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      calls++;
      if (calls === 1) return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('socket reset')); } }));
      return Response.json({ results: [] });
    });
    const client = new AbortableExa('key', providerContext.signal, fetcher, providerContext, 'claim-1');
    await expect(client.search('claim')).resolves.toEqual({ results: [] });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(attempts).toEqual(['search', 'search']);

    const malformed = context(); const badFetch = vi.fn<typeof fetch>(async () => new Response('{'));
    await expect(new AbortableExa('key', malformed.providerContext.signal, badFetch, malformed.providerContext, 'claim-1').search('claim')).rejects.toThrow('malformed_exa_response');
    expect(badFetch).toHaveBeenCalledTimes(1);
  });

  it('retries a Jev response-body network failure but does not retry malformed JSON', async () => {
    const { providerContext, attempts } = context(); let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      calls++;
      if (calls === 1) return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('socket reset')); } }));
      return Response.json({ answers: { answer: { choice: 'yes', probabilities: { yes: 1 } } } });
    });
    const client = createJevClient({ apiKey: 'key', fetch: fetcher });
    const request = { state: {}, questions: { answer: { type: 'choice' as const, instructions: '', criteria: { yes: '' } } } };
    await expect(client.ask(request, providerContext)).resolves.toMatchObject({ answer: { choice: 'yes' } });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(attempts).toEqual(['jev', 'jev']);

    const malformed = context(); const badFetch = vi.fn<typeof fetch>(async () => new Response('{'));
    await expect(createJevClient({ apiKey: 'key', fetch: badFetch }).ask(request, malformed.providerContext)).rejects.toThrow('malformed_provider');
    expect(badFetch).toHaveBeenCalledTimes(1);
  });

  it('shares the hard Jev and per-claim search limits across separate provider calls', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    const budget = new AttemptBudget(); const controller = new AbortController();
    budget.jev = PROVIDER_LIMITS.jev - 3; // three attempts left in the request allowance
    const shared = budget.context(controller.signal, () => Date.now(), NOW + 10_000);
    let jevCalls = 0;
    const jev = createJevClient({ apiKey: 'key', fetch: async () => {
      jevCalls++;
      return jevCalls === 2
        ? Response.json({ answers: { answer: { choice: 'yes', probabilities: { yes: 1 } } } })
        : new Response('busy', { status: 503, headers: { 'retry-after': '0' } });
    } });
    const request = { state: {}, questions: { answer: { type: 'choice' as const, instructions: '', criteria: { yes: '' } } } };
    const first = jev.ask(request, shared); await vi.advanceTimersByTimeAsync(0); await expect(first).resolves.toBeTruthy();
    const second = expect(jev.ask(request, shared)).rejects.toThrow('jev_unavailable');
    await vi.advanceTimersByTimeAsync(0); await second;
    expect(jevCalls).toBe(3); expect(budget.jev).toBe(PROVIDER_LIMITS.jev);

    const searchBudget = new AttemptBudget(); const searchCtx = searchBudget.context(controller.signal, () => Date.now(), NOW + 10_000);
    let searchCalls = 0;
    const exa = new AbortableExa('key', controller.signal, async () => {
      searchCalls++;
      return searchCalls === 2 ? Response.json({ results: [] }) : new Response('busy', { status: 429, headers: { 'retry-after': '0' } });
    }, searchCtx, 'same-claim');
    const firstSearch = exa.search('claim'); await vi.advanceTimersByTimeAsync(0); await expect(firstSearch).resolves.toEqual({ results: [] });
    await expect(exa.search('claim')).rejects.toThrow('search_budget_exhausted');
    expect(searchCalls).toBe(2); expect(searchBudget.searches.get('same-claim')).toBe(2);
  });

  it('does not retry auth or malformed provider responses', async () => {
    const auth = context(); const authFetch = vi.fn<typeof fetch>(async () => new Response('unauthorized', { status: 401 }));
    await expect(new AbortableExa('key', auth.providerContext.signal, authFetch, auth.providerContext, 'claim-1').search('claim')).rejects.toThrow('exa_authentication_failed');
    expect(authFetch).toHaveBeenCalledTimes(1); expect(auth.attempts).toEqual(['search']);
    const malformed = context(); const malformedFetch = vi.fn<typeof fetch>(async () => new Response('{'));
    await expect(new AbortableExa('key', malformed.providerContext.signal, malformedFetch, malformed.providerContext, 'claim-1').search('claim')).rejects.toThrow('malformed_exa_response');
    expect(malformedFetch).toHaveBeenCalledTimes(1); expect(malformed.attempts).toEqual(['search']);
  });

  it('rejects a Jev choice that contradicts its own probability ranking without retrying', async () => {
    const { providerContext, attempts } = context();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ answers: { answer: { choice: 'asserted', probabilities: { asserted: .01, nonliteral: .99 } } } }));
    const client = createJevClient({ apiKey: 'test-only', fetch: fetcher });
    await expect(client.ask({ state: {}, questions: { answer: { type: 'choice', instructions: '', criteria: { asserted: '', nonliteral: '' } } } }, providerContext)).rejects.toThrow('malformed_provider');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(attempts).toEqual(['jev']);
  });
});
