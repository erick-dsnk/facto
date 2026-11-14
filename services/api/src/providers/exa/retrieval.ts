import { PipelineError, sliceSpan, type PipelineAdapters } from '../../../../../packages/contracts/src/index.js';
import { getDomain } from 'tldts';
import { buildAlternateQuery, buildHighlightQuery, needsPageText, normalizeEvidence, normalizeUrl, parseExaResponse, RETRIEVAL_OBJECTIVE } from '../../evidence/normalize.js';
import { AbortableExa } from './client.js';

type BudgetAwareContext = Parameters<PipelineAdapters['retrieve']>[1] & { canConsume?(kind: 'contents', claimId?: string): boolean };

export interface ExaClient {
  search(query: string, options: { type: 'auto'; numResults: number; objective: string; contents: { highlights: { query: string; maxCharacters: number } } }): Promise<unknown>;
  getContents(urls: string[], options: { text: { maxCharacters: number }; highlights: { query: string; maxCharacters: number }; livecrawl: 'preferred'; livecrawlTimeout: number }): Promise<unknown>;
}
export type RetrieverOptions = { queryStrategy?: 'balanced_evidence'; apiKey?: string; fetch?: typeof fetch; clientFactory?: (signal: AbortSignal) => ExaClient };

export function createRetriever(options: RetrieverOptions): PipelineAdapters['retrieve'] {
  return async (claim, context) => {
    const budget = context as BudgetAwareContext;
    context.signal.throwIfAborted();
    // Retrieval cannot be called with an unadmitted/reconstructed proposition.
    if (claim.admission.admissionAction !== 'check' || claim.admission.assertionStatus !== 'asserted' || !claim.checkedText.trim() || sliceSpan(claim.originalText, claim.sourceSpan) !== claim.checkedText) {
      throw new PipelineError('claim_not_admitted');
    }
    if (!options.clientFactory && !options.apiKey) throw new PipelineError('missing_exa_key');
    const client = options.clientFactory?.(context.signal) ?? new AbortableExa(options.apiKey!, context.signal, options.fetch);
    context.consume('search', claim.id);
    const highlights = { query: buildHighlightQuery(claim.checkedText), maxCharacters: 4000 };
    const query = options.queryStrategy ? buildAlternateQuery(claim.checkedText, options.queryStrategy) : claim.checkedText;
    const pages = parseExaResponse(await client.search(query, { type: 'auto', numResults: options.queryStrategy ? 8 : 5, objective: RETRIEVAL_OBJECTIVE, contents: { highlights } }));
    context.signal.throwIfAborted();
    const seen = new Set<string>();
    const perDomain = new Map<string, number>();
    const candidates = pages.filter(page => {
      const url = normalizeUrl(page.url);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      if (!needsPageText(page, claim.checkedText, options.queryStrategy === 'balanced_evidence')) return false;
      const domain = getDomain(new URL(url).hostname, { allowPrivateDomains: true })!;
      // At most two pages from one domain can survive the retention cap;
      // preserve the bounded contents allowance for another publisher instead.
      if ((perDomain.get(domain) ?? 0) >= 2) return false;
      perDomain.set(domain, (perDomain.get(domain) ?? 0) + 1);
      return true;
    }).slice(0, 3);
    for (const page of candidates) {
      context.signal.throwIfAborted();
      if (budget.canConsume && !budget.canConsume('contents', claim.id)) break;
      context.consume('contents', claim.id);
      const contents = parseExaResponse(await client.getContents([page.url], { text: { maxCharacters: 12000 }, highlights, livecrawl: 'preferred', livecrawlTimeout: 1500 }));
      context.signal.throwIfAborted();
      const match = contents.find(item => normalizeUrl(item.url) === normalizeUrl(page.url));
      if (match) Object.assign(page, { text: match.text?.trim() ? match.text : page.text,
        highlights: [...new Set([...(match.highlights ?? []), ...(page.highlights ?? [])])].slice(0, 20),
        publishedDate: match.publishedDate ?? page.publishedDate });
    }
    return normalizeEvidence(pages, claim.checkedText, new Date(context.now()).toISOString());
  };
}
