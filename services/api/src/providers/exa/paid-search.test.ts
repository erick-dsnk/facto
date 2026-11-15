import { describe, expect, it } from 'vitest';
import { PROVIDER_LIMITS, type PaidSearchRequest, type SourceQuery } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { buildAlternateQuery } from '../../evidence/normalize.js';
import { createDomainLists } from '../../sources/domain-lists.js';
import { createTestContext, jsonResponse, recordingFetch, type RecordedRequest } from '../../sources/testing.js';
import { createExaPaidSearch, yearBefore } from './paid-search.js';
import { createExaSearcher } from './search.js';

const lists = createDomainLists({ lowSignal: ['youtube.com'], trusted: ['reuters.com'], publishers: { 'reuters.com': 'Reuters' } });
const query = (extra: Partial<SourceQuery> = {}): SourceQuery => ({
  claimId: 'c1', text: 'Kushner said the talks failed.', subject: null, route: 'recent_event', attribution: null, future: false, rumour: false, asOf: '2026-11-14', ...extra,
});
const page = (host: string, path = 'a', publishedDate?: string) => ({
  url: `https://${host}/${path}`, title: `Talks on ${host}`, ...(publishedDate ? { publishedDate } : {}),
  highlights: [`Kushner said on Thursday that the talks failed after two days, according to officials at ${host}.`],
});
const results = (...pages: ReturnType<typeof page>[]) => jsonResponse({ results: pages });
const body = (request: RecordedRequest) => JSON.parse(request.body ?? '{}') as Record<string, unknown>;

/** A fetch answering each Exa search in turn from `replies`. */
function exa(...replies: (() => Response)[]) {
  let index = 0;
  const recorded = recordingFetch(() => (replies[index++] ?? (() => results()))());
  const paid = createExaPaidSearch({ exa: createExaSearcher({ apiKey: 'test-key', fetch: recorded.fetch }), lists });
  return { recorded, paid };
}

describe('S1 Exa', () => {
  it('maps a recorded-shape body to schema-valid news evidence, dropping blocked sites and naming publishers', async () => {
    const { recorded, paid } = exa(() => results(page('www.reuters.com', 'talks', '2026-11-13'), page('youtube.com'), page('news.example.org'), page('apnews.example')));
    const found = await paid.search(query(), { purpose: 'primary' }, createTestContext());
    expect(found.categories).toEqual(['news']);
    expect(recorded.requests).toHaveLength(1);
    expect(body(recorded.requests[0])).toMatchObject({ query: 'Kushner said the talks failed.', category: 'news', numResults: 8, type: 'auto' });
    expect(recorded.requests[0].headers['x-api-key']).toBe('test-key');
    expect(found.evidence.map(e => new URL(e.url).hostname)).not.toContain('youtube.com');
    for (const evidence of found.evidence) {
      expect(evidenceSchema.parse(evidence)).toBeTruthy();
      expect(evidence.origin).toBe('news');
    }
    expect(found.evidence.find(e => e.url.includes('reuters'))).toMatchObject({ publisher: 'Reuters', publishedAt: '2026-11-13' });
  });

  it('a malformed body throws', async () => {
    const { paid } = exa(() => jsonResponse({ results: 'x' }));
    await expect(paid.search(query({ route: 'general' }), { purpose: 'primary' }, createTestContext())).rejects.toMatchObject({ code: 'malformed_exa_response' });
  });

  it('web for an ordinary claim, the subject in front of the query', async () => {
    const { recorded, paid } = exa(() => results(page('a.example')));
    const found = await paid.search(query({ route: 'general', text: 'It opened in 1889.', subject: 'Eiffel Tower' }), { purpose: 'primary' }, createTestContext());
    expect(found.categories).toEqual(['web']);
    expect(body(recorded.requests[0]).category).toBeUndefined();
    expect(body(recorded.requests[0]).query).toBe('Eiffel Tower It opened in 1889.');
    expect(found.evidence.every(e => e.origin === 'web')).toBe(true);
  });

  it('future claims search news from a year back and put the newest first', async () => {
    const { recorded, paid } = exa(() => results(page('old.example', 'a', '2026-01-01'), page('new.example', 'a', '2026-11-10'), page('mid.example', 'a', '2026-06-01')));
    const found = await paid.search(query({ route: 'general', future: true, text: 'Anthropic will IPO at a 2.5 trillion dollar valuation.' }), { purpose: 'primary' }, createTestContext());
    expect(body(recorded.requests[0])).toMatchObject({ category: 'news', startPublishedDate: '2025-11-14T00:00:00.000Z' });
    expect(found.evidence.map(e => new URL(e.url).hostname)).toEqual(['new.example', 'mid.example', 'old.example']);
    expect(yearBefore('2028-02-29')).toBe('2027-03-01T00:00:00.000Z');
  });

  it('rumours and "X said" go to news first; corroboration excludes sites; alternate uses the balanced query', async () => {
    for (const extra of [{ route: 'general' as const, rumour: true }, { route: 'general' as const, attribution: { source: 'Kushner', mode: 'said' as const } }]) {
      const { recorded, paid } = exa(() => results(page('a.example'), page('b.example'), page('c.example')));
      await paid.search(query(extra), { purpose: 'primary' }, createTestContext());
      expect(body(recorded.requests[0]).category).toBe('news');
    }
    const corroboration = exa(() => results(page('a.example'), page('news.backing.example'), page('c.example')));
    const found = await corroboration.paid.search(query(), { purpose: 'corroboration', excludeSites: ['backing.example', 'calculation'] }, createTestContext());
    expect(body(corroboration.recorded.requests[0])).toMatchObject({ excludeDomains: ['backing.example'] });
    expect(body(corroboration.recorded.requests[0]).category).toBeUndefined();
    expect(found.evidence.map(e => new URL(e.url).hostname)).toEqual(['a.example', 'c.example']);
    const alternate = exa(() => results(page('a.example')));
    await alternate.paid.search(query({ route: 'general' }), { purpose: 'alternate' }, createTestContext());
    expect(body(alternate.recorded.requests[0]).query).toBe(buildAlternateQuery('Kushner said the talks failed.', 'balanced_evidence'));
  });
});

describe('S9 search ledger', () => {
  it('news with one usable result is followed by one web search', async () => {
    const { recorded, paid } = exa(() => results(page('a.example'), page('youtube.com')), () => results(page('b.example'), page('c.example')));
    const context = createTestContext();
    const found = await paid.search(query(), { purpose: 'primary' }, context);
    expect(found.categories).toEqual(['news', 'web']);
    expect(recorded.requests).toHaveLength(2);
    expect(found.evidence.map(e => [new URL(e.url).hostname, e.origin])).toEqual([['a.example', 'news'], ['b.example', 'web'], ['c.example', 'web']]);
    expect(context.used('search', 'c1')).toBe(2);
  });

  it('three usable news results need no web search', async () => {
    const { recorded, paid } = exa(() => results(page('a.example'), page('b.example'), page('c.example')));
    expect((await paid.search(query(), { purpose: 'primary' }, createTestContext())).categories).toEqual(['news']);
    expect(recorded.requests).toHaveLength(1);
  });

  it('after news and web, corroboration sends nothing', async () => {
    const { recorded, paid } = exa(() => results(page('a.example')), () => results(page('b.example')));
    const context = createTestContext();
    await paid.search(query(), { purpose: 'primary' }, context);
    const corroboration = await paid.search(query(), { purpose: 'corroboration', excludeSites: ['a.example'] }, context);
    expect(corroboration).toEqual({ evidence: [], categories: [] });
    expect(recorded.requests).toHaveLength(2);
  });

  it('a retried primary blocks the fallback', async () => {
    const { recorded, paid } = exa(() => jsonResponse('busy', 503, { 'retry-after': '0' }), () => results(page('a.example')));
    const context = createTestContext();
    const found = await paid.search(query(), { purpose: 'primary' }, context);
    expect(recorded.requests).toHaveLength(2);
    expect(recorded.requests.every(request => body(request).category === 'news')).toBe(true);
    expect(found.categories).toEqual(['news']);
    expect(found.evidence).toHaveLength(1);
    expect(context.used('search', 'c1')).toBe(2);
  });

  it('a news failure that was not retried falls back to web; an authentication failure does not', async () => {
    const fallback = exa(() => jsonResponse('bad', 400), () => results(page('a.example')));
    const found = await fallback.paid.search(query(), { purpose: 'primary' }, createTestContext());
    expect(found.categories).toEqual(['news', 'web']);
    expect(found.evidence).toHaveLength(1);
    const rejected = exa(() => jsonResponse('no', 401));
    await expect(rejected.paid.search(query(), { purpose: 'primary' }, createTestContext())).rejects.toMatchObject({ code: 'exa_authentication_failed' });
    expect(rejected.recorded.requests).toHaveLength(1);
  });

  it('with nothing found, a failed web fallback is the answer, never "no evidence"', async () => {
    const { paid } = exa(() => results(), () => jsonResponse('bad', 400));
    await expect(paid.search(query(), { purpose: 'primary' }, createTestContext())).rejects.toMatchObject({ code: 'exa_unavailable' });
  });

  it('no order of calls ever sends a third search', async () => {
    const requests: PaidSearchRequest[] = [{ purpose: 'primary' }, { purpose: 'corroboration', excludeSites: ['a.example'] }, { purpose: 'alternate' }];
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0], [0, 0, 0], [2, 2, 2]];
    for (const order of orders) {
      for (const fewNews of [true, false]) {
        const recorded = recordingFetch(() => fewNews ? results(page('a.example')) : results(page('a.example'), page('b.example'), page('c.example')));
        const paid = createExaPaidSearch({ exa: createExaSearcher({ apiKey: 'test-key', fetch: recorded.fetch }), lists });
        const context = createTestContext();
        for (const index of order) await paid.search(query(), requests[index], context);
        expect(recorded.requests.length, `${order} ${fewNews}`).toBeLessThanOrEqual(PROVIDER_LIMITS.search);
      }
    }
  });
});
