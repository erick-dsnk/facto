import type { EvidenceSources, PipelineAdapters } from '../../../../packages/contracts/src/index.js';
import type { ClaimCache } from './claim-cache.js';

/** Server-only capabilities; the frozen app/provider DTOs remain unchanged. */
export interface RuntimeAdapters extends PipelineAdapters {
  retrieveAlternate?: PipelineAdapters['retrieve'];
  /** Free sources first, then at most PROVIDER_LIMITS.search Exa searches. Without it the runtime uses retrieve/judge. */
  sources?: EvidenceSources;
  /** The shared claim cache; the runtime uses one module-level cache when this is absent. */
  cache?: ClaimCache;
}
