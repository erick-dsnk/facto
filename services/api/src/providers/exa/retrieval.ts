import { PipelineError, sliceSpan, type PipelineAdapters } from '../../../../../packages/contracts/src/index.js';
import { getDomain } from 'tldts';
import { needsPageText, normalizeEvidence, normalizeUrl, parseExaResponse } from '../../evidence/normalize.js';
import { AbortableExa } from './client.js';

export interface ExaClient {
  search(query: string, options: { type: 'auto'; numResults: number; contents: { highlights: true } }): Promise<unknown>;
  getContents(urls: string[], options: { text: { maxCharacters: number }; livecrawl: 'preferred'; livecrawlTimeout: number }): Promise<unknown>;
}
export type RetrieverOptions = { apiKey?: string; fetch?: typeof fetch; clientFactory?: (signal: AbortSignal) => ExaClient };

export function createRetriever(options: RetrieverOptions): PipelineAdapters['retrieve'] {
  return async (claim, context) => {
    context.signal.throwIfAborted();
    // Retrieval cannot be called with an unadmitted/reconstructed proposition.
    if (claim.admission.admissionAction !== 'check' || claim.admission.assertionStatus !== 'asserted' || !claim.checkedText.trim() || sliceSpan(claim.originalText, claim.sourceSpan) !== claim.checkedText) {
      throw new PipelineError('claim_not_admitted');
    }
    if (!options.clientFactory && !options.apiKey) throw new PipelineError('missing_exa_key');
    const client = options.clientFactory?.(context.signal) ?? new AbortableExa(options.apiKey!, context.signal, options.fetch);
    context.consume('search', claim.id);
    const pages = parseExaResponse(await client.search(claim.checkedText, { type: 'auto', numResults: 5, contents: { highlights: true } }));
    context.signal.throwIfAborted();
    const seen = new Set<string>();
    const perDomain = new Map<string, number>();
    const candidates = pages.filter(page => {
      const url = normalizeUrl(page.url);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      if (!needsPageText(page, claim.checkedText)) return false;
      const domain = getDomain(new URL(url).hostname, { allowPrivateDomains: true })!;
      // At most two pages from one domain can survive the retention cap;
      // preserve the bounded contents allowance for another publisher instead.
      if ((perDomain.get(domain) ?? 0) >= 2) return false;
      perDomain.set(domain, (perDomain.get(domain) ?? 0) + 1);
      return true;
    }).slice(0, 3);
    for (const page of candidates) {
      context.signal.throwIfAborted();
      context.consume('contents', claim.id);
      const contents = parseExaResponse(await client.getContents([page.url], { text: { maxCharacters: 6000 }, livecrawl: 'preferred', livecrawlTimeout: 1500 }));
      context.signal.throwIfAborted();
      const match = contents.find(item => normalizeUrl(item.url) === normalizeUrl(page.url));
      if (match?.text?.trim()) Object.assign(page, { text: match.text, publishedDate: match.publishedDate ?? page.publishedDate });
    }
    return normalizeEvidence(pages, claim.checkedText, new Date(context.now()).toISOString());
  };
}
