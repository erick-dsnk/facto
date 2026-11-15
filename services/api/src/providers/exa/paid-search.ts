import { PipelineError, sourceQueryText, type Evidence, type PaidEvidence } from '../../../../../packages/contracts/src/index.js';
import { buildAlternateQuery, groupEchoes, normalizeEvidence, type RetrievedPage } from '../../evidence/normalize.js';
import type { DomainLists } from '../../sources/domain-lists.js';
import { hostOf, linkKey } from '../../sources/evidence.js';
import { evidenceSite, usableCount } from '../../sources/ranking.js';
import type { PaidSearch } from '../../sources/types.js';
import type { ExaSearcher, ExaSearchRequest } from './search.js';

/** Eight results a search; a news search with fewer than three usable results is followed by one web search. */
export const PAID = { numResults: 8, newsMinUsable: 3 } as const;

/** Failures after which a fallback search would not help or is not allowed. */
const final = new Set(['exa_authentication_failed', 'missing_exa_key', 'timeout', 'cancelled', 'search_budget_exhausted']);

/** Exa pages as evidence: blocked sites dropped before selection, origin set, publisher named from the list when Exa has none. */
export function paidEvidence(pages: RetrievedPage[], origin: 'news' | 'web', text: string, retrievedAt: string, lists: DomainLists): Evidence[] {
  const allowed = pages.filter(page => {
    const host = hostOf(page.url);
    return host !== '' && !lists.isBlocked(host);
  });
  return normalizeEvidence(allowed, text, retrievedAt).map(item => ({ ...item, origin, publisher: item.publisher ?? lists.publisher(hostOf(item.url)) }));
}

const published = (item: Evidence) => {
  const time = item.publishedAt ? Date.parse(item.publishedAt.length === 10 ? `${item.publishedAt}T00:00:00Z` : item.publishedAt) : NaN;
  return Number.isNaN(time) ? -Infinity : time;
};

/** One copy of each page, echo groups across both searches, and the newest first for a claim about the future. */
function finish(items: Evidence[], future: boolean): Evidence[] {
  const seen = new Set<string>();
  const unique = items.filter(item => {
    const key = linkKey(item.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const grouped = groupEchoes(unique);
  return future ? [...grouped].sort((a, b) => published(b) - published(a)) : grouped;
}

/** Midnight UTC one year before the check date: future claims want the newest estimates. */
export function yearBefore(asOf: string): string {
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString();
}

/**
 * The paid layer over Exa. Primary: news for a recent event, a future claim, a rumour or "X said", web
 * otherwise; news with fewer than three usable results is followed by one web search. Corroboration: web
 * without the sites already backing the claim. Alternate: web with the balanced-evidence query. Every search
 * first checks the claim's `search` allowance, so no order of calls sends a third search; a retried search
 * spends the allowance its fallback would have used.
 */
export function createExaPaidSearch(options: { exa: ExaSearcher; lists: DomainLists }): PaidSearch {
  const { exa, lists } = options;
  return {
    async search(query, request, context): Promise<PaidEvidence> {
      context.signal.throwIfAborted();
      const claimId = query.claimId;
      const text = sourceQueryText(query);
      const canSearch = () => !context.signal.aborted && (context.canConsume?.('search', claimId) ?? true);
      const categories: PaidEvidence['categories'] = [];
      const run = async (category: 'news' | 'web', extra: Partial<ExaSearchRequest> = {}) => {
        categories.push(category);
        const pages = await exa.search({ query: text, text, category, numResults: PAID.numResults, ...extra }, context, claimId);
        return paidEvidence(pages, category, text, new Date(context.now()).toISOString(), lists);
      };
      const done = (items: Evidence[]): PaidEvidence => ({ evidence: finish(items, query.future), categories });
      // Nothing is sent once the allowance is spent; an empty list with no categories says so.
      if (!canSearch()) return { evidence: [], categories };

      if (request.purpose === 'corroboration') {
        const excluded = new Set(request.excludeSites ?? []);
        const domains = [...excluded].filter(site => site.includes('.'));
        const found = await run('web', domains.length ? { excludeDomains: domains } : {});
        return done(found.filter(item => !excluded.has(evidenceSite(item, lists))));
      }
      if (request.purpose === 'alternate') return done(await run('web', { query: buildAlternateQuery(text, 'balanced_evidence') }));

      const newsFirst = query.route === 'recent_event' || query.future || query.rumour || query.attribution?.mode === 'said';
      if (!newsFirst) return done(await run('web'));
      let found: Evidence[] = [];
      let failure: unknown = null;
      try {
        found = await run('news', query.future ? { startPublishedDate: yearBefore(query.asOf) } : {});
      } catch (error) {
        context.signal.throwIfAborted();
        if (!(error instanceof PipelineError) || final.has(error.code)) throw error;
        failure = error;
      }
      if (failure === null && usableCount(found, lists) >= PAID.newsMinUsable) return done(found);
      if (!canSearch()) {
        if (failure !== null) throw failure;
        return done(found);
      }
      try {
        found = [...found, ...await run('web')];
      } catch (error) {
        // Keep what the news search found; with nothing found, the failure is the answer, never "no evidence".
        if (failure !== null || !found.length) throw error;
      }
      return done(found);
    },
  };
}
