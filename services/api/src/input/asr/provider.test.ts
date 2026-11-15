import { describe, expect, it } from 'vitest';
import { type AsrAdapter } from '../../transport/audio.js';
import { DEFAULT_KEYTERMS, type DeepgramOptions } from './deepgram-adapter.js';
import { ELEVENLABS_DEFAULT_KEYTERMS, type ElevenLabsOptions } from './elevenlabs-adapter.js';
import { DEFAULT_ASR_PROVIDER, createAsrAdapter, parseAsrProvider } from './provider.js';

const elevenKey = 'test-eleven-key-value';
const deepgramKey = 'test-deepgram-key-value';

function capture(env: Record<string, string | undefined>) {
  const calls: { provider: string; options: ElevenLabsOptions | DeepgramOptions }[] = [];
  const fake = (provider: string) => (options: ElevenLabsOptions | DeepgramOptions): AsrAdapter => {
    calls.push({ provider, options });
    return { start: async () => { throw new Error('not used'); } };
  };
  const selection = createAsrAdapter(env, { createElevenLabs: fake('elevenlabs'), createDeepgram: fake('deepgram') });
  return { selection, calls };
}

describe('ASR provider switch', () => {
  it('defaults to ElevenLabs and accepts deepgram in any case, rejecting anything else', () => {
    expect(DEFAULT_ASR_PROVIDER).toBe('elevenlabs');
    expect(parseAsrProvider(undefined)).toBe('elevenlabs');
    expect(parseAsrProvider('  ')).toBe('elevenlabs');
    expect(parseAsrProvider(' ElevenLabs ')).toBe('elevenlabs');
    expect(parseAsrProvider('DEEPGRAM')).toBe('deepgram');
    expect(() => parseAsrProvider('whisper')).toThrow('ASR_PROVIDER must be one of elevenlabs, deepgram.');
  });

  it('builds ElevenLabs by default with its key and keyterms, and Deepgram when asked, each with its own list', () => {
    const both = { ELEVENLABS_API_KEY: elevenKey, DEEPGRAM_API_KEY: deepgramKey, ELEVENLABS_KEYTERMS: 'Opus 5.5, Junction', DEEPGRAM_KEYTERMS: 'Typesafe' };
    const eleven = capture(both);
    expect(eleven.selection).toMatchObject({ provider: 'elevenlabs', warning: undefined });
    expect(eleven.selection.adapter).toBeDefined();
    expect(eleven.calls).toHaveLength(1);
    expect(eleven.calls[0]).toMatchObject({ provider: 'elevenlabs', options: { apiKey: elevenKey, keyterms: [...ELEVENLABS_DEFAULT_KEYTERMS, 'Opus 5.5', 'Junction'] } });

    const deepgram = capture({ ...both, ASR_PROVIDER: 'deepgram' });
    expect(deepgram.selection).toMatchObject({ provider: 'deepgram', warning: undefined });
    expect(deepgram.calls).toEqual([{ provider: 'deepgram', options: expect.objectContaining({ apiKey: deepgramKey, keyterms: [...DEFAULT_KEYTERMS, 'Typesafe'] }) }]);
  });

  it('falls back to the provider that has a key and says so, naming keys but never their values', () => {
    const fallback = capture({ ASR_PROVIDER: 'elevenlabs', DEEPGRAM_API_KEY: deepgramKey });
    expect(fallback.selection.provider).toBe('deepgram');
    expect(fallback.calls.map(call => call.provider)).toEqual(['deepgram']);
    expect(fallback.selection.warning).toBe('ASR_PROVIDER is elevenlabs but ELEVENLABS_API_KEY is not set: using deepgram speech recognition instead.');

    const reverse = capture({ ASR_PROVIDER: 'deepgram', ELEVENLABS_API_KEY: elevenKey, DEEPGRAM_API_KEY: '   ' });
    expect(reverse.selection.provider).toBe('elevenlabs');
    expect(reverse.selection.warning).toContain('DEEPGRAM_API_KEY is not set');
    for (const selection of [fallback.selection, reverse.selection]) {
      expect(selection.warning).not.toContain(elevenKey); expect(selection.warning).not.toContain(deepgramKey);
    }
  });

  it('has no adapter and a warning when neither key is set', () => {
    const none = capture({});
    expect(none.selection).toEqual({ provider: 'elevenlabs',
      warning: 'Neither ELEVENLABS_API_KEY nor DEEPGRAM_API_KEY is set: live mode has no speech recognition and audio.start fails with asr_unavailable.' });
    expect(none.calls).toEqual([]);
  });

  it('builds the real adapters without opening a connection', () => {
    expect(createAsrAdapter({ ELEVENLABS_API_KEY: elevenKey }).adapter).toBeDefined();
    expect(createAsrAdapter({ ASR_PROVIDER: 'deepgram', DEEPGRAM_API_KEY: deepgramKey }).adapter).toBeDefined();
  });
});
