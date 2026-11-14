import { ClaimCache } from '../runtime/claim-cache.js';
import { createJevClient, type JevClient } from './jev/client.js';
import { createLayaClient, type LayaDiagnostic } from './laya/client.js';
import { packForProvider, type PromptPack } from './prompt-pack.js';

export type DecisionProviderSelection = { provider: 'jev' | 'laya'; client: JevClient; cache?: ClaimCache; /** The provider's prompt pack from the registry in prompt-pack.ts. */ pack: PromptPack };

/** Resolve the one decision backend used for classification, judging and source queries. */
export function selectDecisionProvider(options: {
  mode: 'fixture' | 'live';
  provider?: string;
  jevApiKey?: string;
  layaUrl?: string;
  fetch?: typeof globalThis.fetch;
  diagnostic?: LayaDiagnostic;
}): DecisionProviderSelection {
  const provider = options.provider ?? 'jev';
  if (provider !== 'jev' && provider !== 'laya') throw new Error('DECISION_PROVIDER must be jev or laya.');
  if (options.mode === 'live' && provider === 'jev' && !options.jevApiKey?.trim()) throw new Error('Live Jev mode requires JEV_API_KEY.');
  if (options.mode === 'live' && provider === 'laya' && !options.layaUrl?.trim()) throw new Error('Live Laya mode requires LAYA_URL.');
  if (provider === 'laya') {
    return {
      provider,
      client: createLayaClient({ url: options.layaUrl ?? '', fetch: options.fetch, diagnostic: options.diagnostic }),
      // This runtime's provider is fixed at startup. Keep Laya decisions in a distinct cache from Jev.
      cache: new ClaimCache(),
      pack: packForProvider(provider),
    };
  }
  return { provider, client: createJevClient({ apiKey: options.jevApiKey ?? '', fetch: options.fetch }), pack: packForProvider(provider) };
}
