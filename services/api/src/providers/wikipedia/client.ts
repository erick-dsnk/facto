import { z } from 'zod';
import { PipelineError, type Evidence, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { freeEvidence } from '../../sources/evidence.js';
import { wikimediaGet, wikipediaThrottle, type WikimediaThrottle } from '../wikimedia/throttle.js';
import { bestPassages, passages } from './passages.js';
import { wikitextPlain } from './wikitext.js';

/** One Wikipedia article as plain text. */
export type WikiPage = { title: string; url: string; text: string };

/** What the sources need from Wikipedia: the top search hits with their text. A failure throws, never returns []. */
export interface Encyclopedia {
  pages(queryText: string, context: ProviderContext, claimId: string): Promise<WikiPage[]>;
}

export const WIKIPEDIA = { pages: 3, maxChars: 200_000, maxQueryWords: 32, maxQueryChars: 250 } as const;

/** Search and page text in one GET on the English edition (port of WikipediaClient.request). */
export function wikipediaRequestUrl(query: string): string {
  const words = query.split(/\s+/u).filter(Boolean).slice(0, WIKIPEDIA.maxQueryWords).join(' ');
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrsearch: Array.from(words).slice(0, WIKIPEDIA.maxQueryChars).join(''),
    gsrlimit: String(WIKIPEDIA.pages), prop: 'revisions|info', inprop: 'url', rvprop: 'content', rvslots: 'main',
  });
  return `https://en.wikipedia.org/w/api.php?${params}`;
}

const pageSchema = z.object({
  title: z.string().min(1), fullurl: z.string(), index: z.number().optional(),
  revisions: z.array(z.object({ slots: z.object({ main: z.object({ content: z.string() }).passthrough() }).passthrough() }).passthrough()).min(1),
}).passthrough();
const responseSchema = z.object({ query: z.object({ pages: z.array(z.unknown()) }).passthrough().optional() }).passthrough();

const onWikipedia = (link: string) => {
  try {
    const url = new URL(link);
    return url.protocol === 'https:' && url.hostname.endsWith('.wikipedia.org');
  } catch { return false; }
};

/**
 * The pages in search order, each cut to `maxChars` of markup before it is cleaned. A search without hits has
 * no `query` and is no pages; a page off wikipedia.org or without text is skipped; any other shape throws.
 */
export function parseWikipediaPages(body: unknown): WikiPage[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PipelineError('malformed_wikipedia_response');
  const pages = (parsed.data.query?.pages ?? []).flatMap(raw => {
    const page = pageSchema.safeParse(raw);
    return page.success && onWikipedia(page.data.fullurl) ? [page.data] : [];
  });
  return pages.sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER))
    .map(page => ({ title: page.title, url: page.fullurl, text: wikitextPlain(page.revisions[0].slots.main.content.slice(0, WIKIPEDIA.maxChars)) }));
}

/** Wikipedia's Action API under the shared Wikimedia throttle, with the app's User-Agent. */
export function createWikipedia(options: { fetch?: typeof fetch; throttle?: WikimediaThrottle } = {}): Encyclopedia {
  const fetcher = options.fetch ?? globalThis.fetch;
  const throttle = options.throttle ?? wikipediaThrottle;
  return {
    async pages(queryText, context, claimId) {
      const body = await wikimediaGet({ fetch: fetcher, url: wikipediaRequestUrl(queryText), throttle, context, service: 'wikipedia', claimId });
      return parseWikipediaPages(body);
    },
  };
}

/** Each page's passage that shares the most words with the claim, as trusted Wikipedia evidence. */
export function wikipediaEvidence(pages: WikiPage[], terms: Set<string>, retrievedAt: string): Evidence[] {
  return pages.flatMap(page => {
    const passage = bestPassages(passages(page.text), terms, 1)[0];
    return passage ? [freeEvidence({ origin: 'wikipedia', url: page.url, title: `${page.title} - Wikipedia`, publisher: 'Wikipedia',
      excerpt: passage, retrievedAt, contentBasis: 'page_text', sourceGroup: 'wikipedia.org' })] : [];
  });
}

/** A scripted Encyclopedia for tests: fixed pages, an error to throw, or a function of the query. */
export function createMockEncyclopedia(answer: WikiPage[] | Error | ((query: string) => Promise<WikiPage[]>)): Encyclopedia & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async pages(queryText, context) {
      context.signal.throwIfAborted();
      queries.push(queryText);
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer(queryText) : answer;
    },
  };
}
