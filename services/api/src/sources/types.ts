import type { PaidEvidence, PaidSearchRequest, ProviderContext, SourceQuery } from '../../../../packages/contracts/src/index.js';

/**
 * The paid layer: Exa news or web for the primary search (news first for recent events, future claims, rumours
 * and "X said"), a web search after a news search with too few usable results, and the corroboration and
 * alternate searches. Every search is guarded by the claim's `search` allowance (PROVIDER_LIMITS.search = 2).
 */
export interface PaidSearch {
  search(query: SourceQuery, request: PaidSearchRequest, context: ProviderContext): Promise<PaidEvidence>;
}
