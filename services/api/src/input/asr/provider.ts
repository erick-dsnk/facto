import { type AsrAdapter } from '../../transport/audio.js';
import { createDeepgramAdapter, parseKeyterms, type DeepgramTranscriptEntry } from './deepgram-adapter.js';
import { ELEVENLABS_DEFAULT_KEYTERMS, createElevenLabsAdapter, type ElevenLabsTranscriptEntry } from './elevenlabs-adapter.js';

export const ASR_PROVIDERS = ['elevenlabs', 'deepgram'] as const;
export type AsrProvider = typeof ASR_PROVIDERS[number];
export const DEFAULT_ASR_PROVIDER: AsrProvider = 'elevenlabs';
const KEY_NAMES = { elevenlabs: 'ELEVENLABS_API_KEY', deepgram: 'DEEPGRAM_API_KEY' } as const;

/** Reads ASR_PROVIDER, ELEVENLABS_API_KEY, ELEVENLABS_KEYTERMS, DEEPGRAM_API_KEY and DEEPGRAM_KEYTERMS (process.env fits). */
export type AsrEnv = Readonly<Record<string, string | undefined>>;
export type AsrSelection = {
  /** The provider in use, or the preferred one when no key is set. */
  provider: AsrProvider; adapter?: AsrAdapter;
  /** A startup warning: the preferred provider has no key (with or without a fallback). Holds names only, never values. */
  warning?: string;
};
type AsrSelectionOptions = {
  /** Off unless DEBUG_TRANSCRIPTS=1: receives every final result with its words (what bystanders said). */
  transcriptLog?: (entry: DeepgramTranscriptEntry | ElevenLabsTranscriptEntry) => void;
  createElevenLabs?: typeof createElevenLabsAdapter; createDeepgram?: typeof createDeepgramAdapter;
};

/** ASR_PROVIDER: elevenlabs (the default when unset or empty) or deepgram, ignoring case and surrounding spaces. */
export function parseAsrProvider(value: string | undefined): AsrProvider {
  const name = (value ?? '').trim().toLowerCase();
  if (!name) return DEFAULT_ASR_PROVIDER;
  if ((ASR_PROVIDERS as readonly string[]).includes(name)) return name as AsrProvider;
  throw new Error(`ASR_PROVIDER must be one of ${ASR_PROVIDERS.join(', ')}.`);
}

/**
 * Builds the speech recogniser ASR_PROVIDER asks for. When that provider has no key but the other one has, the other one is used
 * and a warning says so, so a deploy that is missing the new key keeps listening. With neither key, there is no adapter and
 * audio.start fails with asr_unavailable. Each provider adds its own comma list (ELEVENLABS_KEYTERMS, DEEPGRAM_KEYTERMS) to its default keyterms.
 */
export function createAsrAdapter(env: AsrEnv, options: AsrSelectionOptions = {}): AsrSelection {
  const preferred = parseAsrProvider(env.ASR_PROVIDER);
  const other: AsrProvider = preferred === 'elevenlabs' ? 'deepgram' : 'elevenlabs';
  const keyOf = (provider: AsrProvider) => (provider === 'elevenlabs' ? env.ELEVENLABS_API_KEY : env.DEEPGRAM_API_KEY)?.trim() || undefined;
  const provider = keyOf(preferred) ? preferred : keyOf(other) ? other : undefined;
  const warning = provider === preferred ? undefined : provider
    ? `ASR_PROVIDER is ${preferred} but ${KEY_NAMES[preferred]} is not set: using ${provider} speech recognition instead.`
    : `Neither ${KEY_NAMES[preferred]} nor ${KEY_NAMES[other]} is set: live mode has no speech recognition and audio.start fails with asr_unavailable.`;
  if (!provider) return { provider: preferred, warning };
  const apiKey = keyOf(provider)!;
  const adapter = provider === 'elevenlabs'
    ? (options.createElevenLabs ?? createElevenLabsAdapter)({ apiKey, keyterms: parseKeyterms(env.ELEVENLABS_KEYTERMS, ELEVENLABS_DEFAULT_KEYTERMS), transcriptLog: options.transcriptLog })
    : (options.createDeepgram ?? createDeepgramAdapter)({ apiKey, keyterms: parseKeyterms(env.DEEPGRAM_KEYTERMS), transcriptLog: options.transcriptLog });
  return { provider, adapter, warning };
}
