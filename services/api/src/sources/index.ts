import type { EvidenceSources } from '../../../../packages/contracts/src/index.js';
import type { JevClient } from '../providers/jev/client.js';
import { createFactCheckSearch, type FactCheckSearch } from '../providers/googlefactcheck/client.js';
import { createWikipedia, type Encyclopedia } from '../providers/wikipedia/client.js';
import { createWikidata, type FactDatabase } from '../providers/wikidata/client.js';
import { createOpenMeteo, type WeatherService } from '../providers/openmeteo/client.js';
import { createExaPaidSearch } from '../providers/exa/paid-search.js';
import { createExaSearcher } from '../providers/exa/search.js';
import { loadDomainLists, type DomainLists } from './domain-lists.js';
import { gatherFree } from './gather.js';
import { rankEvidence, sourceTraits } from './ranking.js';
import type { PaidSearch } from './types.js';

export type { PaidSearch } from './types.js';
export type { DomainLists } from './domain-lists.js';
export { loadDomainLists, createDomainLists } from './domain-lists.js';
export { rankEvidence, sourceTraits } from './ranking.js';
export { createMockSources } from './testing.js';
export type { FactCheckSearch, Encyclopedia, FactDatabase, WeatherService };

/**
 * Everything the sources need. Optional free sources are skipped when absent (no Google key, for example);
 * `freeDeadlineMs` bounds the free sources together and `now` is the clock for dates and timestamps.
 */
export type SourceDeps = {
  jev: JevClient; paid: PaidSearch; lists: DomainLists; factChecks?: FactCheckSearch; encyclopedia?: Encyclopedia;
  wikidata?: FactDatabase; weather?: WeatherService; freeDeadlineMs?: number; now?: () => number;
};

/** The EvidenceSources seam over injected providers: free sources first, then at most two Exa searches per claim. */
export function createEvidenceSources(deps: SourceDeps): EvidenceSources {
  return {
    gatherFree: (query, context) => gatherFree(deps, query, context),
    searchPaid: (query, request, context) => deps.paid.search(query, request, context),
    rank: (free, paid) => rankEvidence(free, paid, deps.lists),
    traits: (evidence, attribution) => sourceTraits(evidence, attribution, deps.lists),
  };
}

/**
 * The live sources: Exa, Google Fact Check Tools (skipped without a key), Wikipedia, Wikidata and Open-Meteo,
 * the calculation on the server, and the shipped domain lists.
 */
export function createLiveSources(options: { jev: JevClient; exaApiKey: string; googleFactCheckApiKey?: string; fetch?: typeof fetch }): EvidenceSources {
  const lists = loadDomainLists();
  const fetcher = options.fetch ?? globalThis.fetch;
  return createEvidenceSources({
    jev: options.jev, lists,
    paid: createExaPaidSearch({ exa: createExaSearcher({ apiKey: options.exaApiKey, fetch: fetcher }), lists }),
    factChecks: options.googleFactCheckApiKey?.trim() ? createFactCheckSearch({ apiKey: options.googleFactCheckApiKey, fetch: fetcher }) : undefined,
    encyclopedia: createWikipedia({ fetch: fetcher }),
    wikidata: createWikidata({ fetch: fetcher }),
    weather: createOpenMeteo({ fetch: fetcher }),
  });
}
