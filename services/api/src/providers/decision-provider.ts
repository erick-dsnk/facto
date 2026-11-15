import { ClaimCache } from '../runtime/claim-cache.js';
import { createJevClient, type JevClient } from './jev/client.js';
import { createLayaClient, type LayaDiagnostic } from './laya/client.js';

type Provider = 'jev' | 'laya';
/** laya_gate: Laya answers only the admission questions it was fine-tuned on, Jev answers the rest. */
type AdmissionProvider = Provider | 'laya_gate';
export type DecisionProviderSelection = { provider: Provider; admissionProvider: AdmissionProvider; client: JevClient; admissionClient: JevClient; cache?: ClaimCache };

/** The admission questions the Laya admission-v1 checkpoint was trained on (per candidate: c0_kind, c0_private_data, c0_private_life). */
const GATE_QUESTION = /_(kind|private_data|private_life)$/;

/**
 * Laya decides claim-or-not and privacy; Jev answers every other admission question (route, attribution, subject,
 * completeness, scope, mishearing), which Laya's untrained heads answer close to chance. Laya runs first, then Jev.
 */
export function createGatedAdmissionClient(gate: JevClient, rest: JevClient): JevClient {
  return {
    ask: async (request, context) => {
      const split = (trained: boolean) => Object.fromEntries(Object.entries(request.questions).filter(([key]) => GATE_QUESTION.test(key) === trained));
      const gateQuestions = split(true); const restQuestions = split(false);
      const gated = Object.keys(gateQuestions).length ? await gate.ask({ ...request, questions: gateQuestions }, context) : {};
      const others = Object.keys(restQuestions).length ? await rest.ask({ ...request, questions: restQuestions }, context) : {};
      return { ...others, ...gated };
    },
  };
}

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
  const provider = options.provider?.trim() || 'jev';
  if (provider !== 'jev' && provider !== 'laya') throw new Error('DECISION_PROVIDER must be jev or laya.');
  const admissionProvider = (options.admissionProvider?.trim() || provider) as AdmissionProvider;
  if (admissionProvider !== 'jev' && admissionProvider !== 'laya' && admissionProvider !== 'laya_gate') throw new Error('ADMISSION_PROVIDER must be jev, laya or laya_gate.');
  const needs = (name: Provider) => provider === name || admissionProvider === name || (admissionProvider === 'laya_gate' && (name === 'laya' || name === 'jev'));
  if (options.mode === 'live' && needs('jev') && !options.jevApiKey?.trim()) throw new Error('Live Jev mode requires JEV_API_KEY.');
  if (options.mode === 'live' && needs('laya') && !options.layaUrl?.trim()) throw new Error('Live Laya mode requires LAYA_URL.');
  const makeClient = (name: Provider): JevClient => name === 'laya'
    ? createLayaClient({ url: options.layaUrl ?? '', apiKey: options.layaApiKey, fetch: options.fetch, diagnostic: options.diagnostic })
    : createJevClient({ apiKey: options.jevApiKey ?? '', fetch: options.fetch });
  const client = makeClient(provider);
  return {
    provider, admissionProvider, client,
    admissionClient: admissionProvider === provider ? client
      : admissionProvider === 'laya_gate' ? createGatedAdmissionClient(makeClient('laya'), provider === 'jev' ? client : makeClient('jev'))
      : makeClient(admissionProvider),
    // This startup configuration fixes both roles. Never reuse Jev-only decisions in a hybrid/Laya cache.
    ...(needs('laya') ? { cache: new ClaimCache() } : {}),
  };
}
