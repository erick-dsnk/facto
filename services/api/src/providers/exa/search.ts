import type { ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { buildHighlightQuery, parseExaResponse, RETRIEVAL_OBJECTIVE, type RetrievedPage } from '../../evidence/normalize.js';
import { AbortableExa } from './client.js';

/** One Exa search as the sources ask for it. `text` is the checked claim (with its subject) for the highlights. */
export type ExaSearchRequest = {
  query: string; text: string; category: 'news' | 'web'; numResults: number;
  /** ISO timestamp: only pages published since then (future claims prefer the newest estimates). */
  startPublishedDate?: string;
  /** Registrable domains kept out (a corroboration search skips the sites that already back the claim). */
  excludeDomains?: string[];
};

/** What the paid search needs from Exa: parsed result pages. Every attempt is consumed from the claim's `search` allowance. */
export interface ExaSearcher {
  search(request: ExaSearchRequest, context: ProviderContext, claimId: string): Promise<RetrievedPage[]>;
}

/**
 * Exa's /search through the existing AbortableExa seam: bounded responses, sanitized errors, the shared
 * deadline and one retry inside the `search` allowance. Highlights and a bounded page text come back in the
 * same request, so no /contents call is spent.
 */
export function createExaSearcher(options: { apiKey: string; fetch?: typeof fetch }): ExaSearcher {
  return {
    async search(request, context, claimId) {
      context.signal.throwIfAborted();
      const exa = new AbortableExa(options.apiKey, context.signal, options.fetch, context, claimId);
      const response = await exa.search(request.query, {
        type: 'auto', numResults: request.numResults, objective: RETRIEVAL_OBJECTIVE,
        ...(request.category === 'news' ? { category: 'news' as const } : {}),
        ...(request.startPublishedDate ? { startPublishedDate: request.startPublishedDate } : {}),
        ...(request.excludeDomains?.length ? { excludeDomains: request.excludeDomains } : {}),
        contents: { highlights: { query: buildHighlightQuery(request.text), maxCharacters: 4000 }, text: { maxCharacters: 6000 } },
      });
      context.signal.throwIfAborted();
      return parseExaResponse(response);
    },
  };
}
