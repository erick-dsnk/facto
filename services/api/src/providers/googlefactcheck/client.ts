import { z } from 'zod';
import { PipelineError, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { getJson } from '../../sources/http.js';
import { oneLine, publicationDate, shortened, stripWww } from '../../sources/evidence.js';

/** One published fact check of one claim, from Google's Fact Check Tools. */
export type FactCheckReview = {
  /** The claim as the fact-checker wrote it. */
  claim: string; publisher: string;
  /** The publisher's own site, which the review's link must be on. */
  site: string; url: string; title: string | null;
  /** The fact-checker's own words: "False", "Mostly true", "Fehlender Kontext". */
  rating: string; date: string | null;
};

/** What the sources need from Google's fact-check search. A failure throws, never returns []. */
export interface FactCheckSearch {
  reviews(queryText: string, context: ProviderContext, claimId: string): Promise<FactCheckReview[]>;
}

export const FACTCHECK_ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
export const FACTCHECK_PAGE_SIZE = 5;

/** `claims:search` for English reviews. The key never goes in the URL; it travels in `X-Goog-Api-Key`. */
export function factCheckRequestUrl(query: string): string {
  const params = new URLSearchParams({ query: Array.from(query).slice(0, 250).join(''), pageSize: String(FACTCHECK_PAGE_SIZE), languageCode: 'en' });
  return `${FACTCHECK_ENDPOINT}?${params}`;
}

const reviewSchema = z.object({
  publisher: z.object({ name: z.string().optional(), site: z.string().optional() }).passthrough().optional(),
  url: z.string().optional(), title: z.string().optional(), reviewDate: z.string().optional(), textualRating: z.string().optional(),
}).passthrough();
const responseSchema = z.object({
  claims: z.array(z.object({ text: z.string().optional(), claimReview: z.array(z.unknown()).optional() }).passthrough()).optional(),
}).passthrough();

/** The review's link is on the publisher's site or a subdomain of it. */
export function isOnSite(host: string, site: string): boolean {
  const bare = stripWww(site.toLowerCase());
  return host === bare || host.endsWith(`.${bare}`);
}

const plain = (text: string, max: number) => shortened(oneLine(text), max);

/**
 * One review per `claims[].claimReview[]` that names the publisher's site, has an https link on it and a
 * rating (port of FactCheckClient.parse). A review without a site could link anywhere yet count as trusted.
 * Text fields are cut short: they come from markup any site can publish. A body that is not an object throws.
 */
export function parseFactChecks(body: unknown): FactCheckReview[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PipelineError('malformed_factcheck_response');
  const out: FactCheckReview[] = [];
  for (const claim of parsed.data.claims ?? []) {
    if (!claim.text) continue;
    for (const raw of claim.claimReview ?? []) {
      const review = reviewSchema.safeParse(raw);
      if (!review.success) continue;
      const site = review.data.publisher?.site;
      const rating = review.data.textualRating;
      let host = '';
      try {
        const link = new URL(review.data.url ?? '');
        if (link.protocol === 'https:') host = stripWww(link.hostname.toLowerCase());
      } catch { /* not a link */ }
      if (!site || !host || !isOnSite(host, site) || !rating) continue;
      out.push({ claim: plain(claim.text, 300), publisher: plain(review.data.publisher?.name || site, 60), site, url: review.data.url!,
        title: review.data.title ? plain(review.data.title, 160) : null, rating: plain(rating, 80), date: publicationDate(review.data.reviewDate) });
    }
  }
  return out;
}

/** Google Fact Check Tools with the server's key. One request per claim (the `factcheck` allowance), never retried. */
export function createFactCheckSearch(options: { apiKey: string; fetch?: typeof fetch }): FactCheckSearch {
  const fetcher = options.fetch ?? globalThis.fetch;
  return {
    async reviews(queryText, context, claimId) {
      context.signal.throwIfAborted();
      if (!options.apiKey.trim()) throw new PipelineError('missing_factcheck_key');
      context.consume('factcheck', claimId);
      const reply = await getJson(fetcher, factCheckRequestUrl(queryText), {
        service: 'factcheck', signal: context.signal, maxBytes: 1_000_000, headers: { 'X-Goog-Api-Key': options.apiKey, Accept: 'application/json' },
      });
      // Google answers a bad key with 400 as well as 401/403.
      if (reply.status === 400 || reply.status === 401 || reply.status === 403) throw new PipelineError('factcheck_rejected');
      if (reply.status === 429) throw new PipelineError('factcheck_rate_limited');
      if (reply.status !== 200) throw new PipelineError('factcheck_unavailable');
      return parseFactChecks(reply.body);
    },
  };
}

/** A scripted FactCheckSearch for tests. */
export function createMockFactCheckSearch(answer: FactCheckReview[] | Error): FactCheckSearch & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async reviews(queryText, context) {
      context.signal.throwIfAborted();
      queries.push(queryText);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}
