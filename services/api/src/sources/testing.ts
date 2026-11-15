import {
  PipelineError, PROVIDER_LIMITS, type Evidence, type EvidenceSources, type PaidSearchRequest, type ProviderContext, type ProviderKind,
} from '../../../../packages/contracts/src/index.js';
import type { JevAnswer, JevClient, JevRequest } from '../providers/jev/client.js';
import { createDomainLists } from './domain-lists.js';
import { rankEvidence, sourceTraits } from './ranking.js';

/**
 * Test doubles for the sources: a provider context that enforces PROVIDER_LIMITS like the runtime budget,
 * a scripted Jev client, a recording fetch, and createMockSources for pipeline tests. No live calls, no
 * test-runner import, so this module is safe to ship.
 */
export type TestContext = ProviderContext & {
  canConsume(kind: ProviderKind, claimId?: string): boolean;
  /** Attempts consumed so far; `jev` counts per request, every other kind per claim. */
  used(kind: ProviderKind, claimId?: string): number;
  abort(reason?: unknown): void;
};

export function createTestContext(options: {
  now?: () => number; deadlineAt?: number; limits?: Partial<Record<ProviderKind, number>>; signal?: AbortSignal;
} = {}): TestContext {
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true });
  const now = options.now ?? Date.now;
  const limits = { ...PROVIDER_LIMITS, ...options.limits };
  const counts = new Map<string, number>();
  const key = (kind: ProviderKind, claimId?: string) => kind === 'jev' ? 'jev' : `${kind}:${claimId ?? 'request'}`;
  const fits = (kind: ProviderKind, claimId?: string) => (counts.get(key(kind, claimId)) ?? 0) < limits[kind];
  const live = () => !controller.signal.aborted && (options.deadlineAt === undefined || now() < options.deadlineAt);
  return {
    signal: controller.signal, now, deadlineAt: options.deadlineAt,
    canConsume: (kind, claimId) => live() && fits(kind, claimId),
    consume(kind, claimId) {
      controller.signal.throwIfAborted();
      if (options.deadlineAt !== undefined && now() >= options.deadlineAt) throw new PipelineError('timeout');
      if (!fits(kind, claimId)) throw new PipelineError(`${kind}_budget_exhausted`);
      counts.set(key(kind, claimId), (counts.get(key(kind, claimId)) ?? 0) + 1);
    },
    used: (kind, claimId) => counts.get(key(kind, claimId)) ?? 0,
    abort: reason => controller.abort(reason ?? new PipelineError('cancelled')),
  };
}

/** A Jev client that answers from a script and consumes the request's `jev` allowance like the live client. */
export function scriptedJev(answer: (request: JevRequest) => Record<string, JevAnswer> | Promise<Record<string, JevAnswer>>): JevClient & { requests: JevRequest[] } {
  const requests: JevRequest[] = [];
  return {
    requests,
    async ask(request, context) {
      context.signal.throwIfAborted();
      context.consume('jev');
      requests.push(request);
      return answer(request);
    },
  };
}

export type RecordedRequest = { url: string; method: string; headers: Record<string, string>; body: string | null };

/** A fetch that records every request and answers from `handler`; it honours the request's abort signal. */
export function recordingFetch(handler: (request: RecordedRequest) => Response | Promise<Response>): { fetch: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    init?.signal?.throwIfAborted();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => { headers[name] = value; });
    const request: RecordedRequest = { url: String(input instanceof Request ? input.url : input), method: init?.method ?? 'GET', headers,
      body: typeof init?.body === 'string' ? init.body : null };
    requests.push(request);
    const response = handler(request);
    if (!init?.signal) return response;
    const signal = init.signal;
    return new Promise<Response>((resolve, reject) => {
      const aborted = () => reject(signal.reason);
      signal.addEventListener('abort', aborted, { once: true });
      Promise.resolve(response).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    });
  };
  return { fetch: fetcher as typeof fetch, requests };
}

/** A JSON response for a recorded-shape body. */
export const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/**
 * EvidenceSources from a script, for pipeline tests: `free` is what gatherFree returns, `paid[i]` what the
 * i-th searchPaid call returns, `trusted` the trusted domains. searchPaid consumes the claim's `search`
 * allowance like the live layer and sends nothing once it is spent.
 */
export function createMockSources(script: { free?: Evidence[]; paid?: Evidence[][]; trusted?: string[] } = {}):
  EvidenceSources & { calls: { free: number; paid: PaidSearchRequest[] } } {
  const lists = createDomainLists({ trusted: script.trusted ?? [] });
  const calls = { free: 0, paid: [] as PaidSearchRequest[] };
  return {
    calls,
    async gatherFree(_query, context) {
      context.signal.throwIfAborted();
      calls.free++;
      return { evidence: script.free ?? [], answered: { fact_check: null, wikipedia: true, wikidata: null, weather: null, calculation: true } };
    },
    async searchPaid(query, request, context) {
      context.signal.throwIfAborted();
      if (context.canConsume && !context.canConsume('search', query.claimId)) return { evidence: [], categories: [] };
      context.consume('search', query.claimId);
      const index = calls.paid.length;
      calls.paid.push(request);
      const news = request.purpose === 'primary' && (query.route === 'recent_event' || query.future || query.rumour || query.attribution?.mode === 'said');
      return { evidence: script.paid?.[index] ?? [], categories: [news ? 'news' : 'web'] };
    },
    rank: (free, paid) => rankEvidence(free, paid, lists),
    traits: (evidence, attribution) => sourceTraits(evidence, attribution, lists),
  };
}
