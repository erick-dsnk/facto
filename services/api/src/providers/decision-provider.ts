import { ClaimCache } from '../runtime/claim-cache.js';
import { createJevClient, type JevClient } from './jev/client.js';
import { createLayaClient, type LayaDiagnostic } from './laya/client.js';

type Provider = 'jev' | 'laya';
export type DecisionProviderSelection = { provider: Provider; admissionProvider: Provider; client: JevClient; admissionClient: JevClient; cache?: ClaimCache };

/** Resolve admission separately; judgment and source queries use the main decision backend. */
export function selectDecisionProvider(options: {
  mode: 'fixture' | 'live';
  provider?: string;
  admissionProvider?: string;
  jevApiKey?: string;
  layaUrl?: string;
  layaApiKey?: string;
  fetch?: typeof globalThis.fetch;
  diagnostic?: LayaDiagnostic;
}): DecisionProviderSelection {
  const provider = options.provider ?? 'jev';
  if (provider !== 'jev' && provider !== 'laya') throw new Error('DECISION_PROVIDER must be jev or laya.');
  const admissionProvider = options.admissionProvider?.trim() || provider;
  if (admissionProvider !== 'jev' && admissionProvider !== 'laya') throw new Error('ADMISSION_PROVIDER must be jev or laya.');
  const needs = (name: Provider) => provider === name || admissionProvider === name;
  if (options.mode === 'live' && needs('jev') && !options.jevApiKey?.trim()) throw new Error('Live Jev mode requires JEV_API_KEY.');
  if (options.mode === 'live' && needs('laya') && !options.layaUrl?.trim()) throw new Error('Live Laya mode requires LAYA_URL.');
  const makeClient = (name: Provider): JevClient => name === 'laya'
    ? createLayaClient({ url: options.layaUrl ?? '', apiKey: options.layaApiKey, fetch: options.fetch, diagnostic: options.diagnostic })
    : createJevClient({ apiKey: options.jevApiKey ?? '', fetch: options.fetch });
  const client = makeClient(provider);
  return {
    provider, admissionProvider, client,
    admissionClient: admissionProvider === provider ? client : makeClient(admissionProvider),
    // This startup configuration fixes both roles. Never reuse Jev-only decisions in a hybrid/Laya cache.
    ...(needs('laya') ? { cache: new ClaimCache() } : {}),
  };
}
