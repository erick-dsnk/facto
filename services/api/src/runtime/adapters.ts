import type { PipelineAdapters } from '../../../../packages/contracts/src/index.js';

/** Server-only capabilities; the frozen app/provider DTOs remain unchanged. */
export interface RuntimeAdapters extends PipelineAdapters {
  retrieveAlternate?: PipelineAdapters['retrieve'];
}
