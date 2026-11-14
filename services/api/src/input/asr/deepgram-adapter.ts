import WebSocket from 'ws';
import { z } from 'zod';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { type AsrAdapter, type AsrStream, type AudioFrame } from '../../transport/audio.js';
import { SentenceAssembler, type AsrWord } from './sentence-assembler.js';

/** Live pipeline decision 2a. The key travels only in the Authorization header, never in the URL. */
export const DEEPGRAM_LISTEN_URL = 'wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1' +
  '&interim_results=true&smart_format=true&diarize=true&endpointing=300&utterance_end_ms=1000';

/** The part of a `ws` client socket the adapter uses. Tests inject a fake. */
export interface DeepgramSocket {
  send(data: string | Uint8Array, callback?: (error?: Error) => void): void;
  close(code?: number): void;
  terminate(): void;
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}
export type DeepgramSocketFactory = (url: string, headers: Record<string, string>) => DeepgramSocket;
export type DeepgramOptions = {
  apiKey: string; url?: string; socketFactory?: DeepgramSocketFactory;
  openTimeoutMs?: number; keepAliveMs?: number; closeGraceMs?: number; now?: () => number;
};

const defaultSocketFactory: DeepgramSocketFactory = (url, headers) => new WebSocket(url, { headers, handshakeTimeout: 10_000 });

const wordSchema = z.object({
  word: z.string(), punctuated_word: z.string().optional(), start: z.number(), end: z.number(),
  confidence: z.number().optional(), speaker: z.number().int().nonnegative().optional()
}).passthrough();
const resultsSchema = z.object({
  type: z.literal('Results'), start: z.number(), duration: z.number(), is_final: z.boolean().optional(),
  channel: z.object({ alternatives: z.array(z.object({ transcript: z.string(), words: z.array(wordSchema).optional() }).passthrough()) }).passthrough()
}).passthrough();
const utteranceEndSchema = z.object({ type: z.literal('UtteranceEnd') }).passthrough();

function decode(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data) && data.every(part => Buffer.isBuffer(part))) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return null;
}

function toWords(result: z.infer<typeof resultsSchema>): AsrWord[] {
  const alternative = result.channel.alternatives[0];
  if (!alternative) return [];
  if (alternative.words?.length) {
    return alternative.words.map(word => ({
      text: word.punctuated_word ?? word.word, start: word.start, end: word.end,
      confidence: word.confidence === undefined ? null : Math.min(1, Math.max(0, word.confidence)), speaker: word.speaker ?? null
    }));
  }
  // No word timings: spread the transcript evenly across the chunk.
  const tokens = alternative.transcript.split(/\s+/).filter(Boolean);
  const step = tokens.length ? result.duration / tokens.length : 0;
  return tokens.map((text, index) => ({ text, start: result.start + index * step, end: result.start + (index + 1) * step, confidence: null, speaker: null }));
}

/**
 * Deepgram streaming ASR behind the transport's AsrAdapter seam. One provider socket per stream generation.
 * Raw audio and transcript text are never logged; failures surface only as PipelineError codes.
 */
export function createDeepgramAdapter(options: DeepgramOptions): AsrAdapter {
  if (!options.apiKey) throw new Error('The Deepgram adapter needs DEEPGRAM_API_KEY.');
  const factory = options.socketFactory ?? defaultSocketFactory;
  const openTimeoutMs = options.openTimeoutMs ?? 10_000;
  const keepAliveMs = options.keepAliveMs ?? 3_000;
  const closeGraceMs = options.closeGraceMs ?? 2_000;
  const now = options.now ?? Date.now;

  return {
    async start(config, onTranscript, signal) {
      signal.throwIfAborted();
      const socket = factory(options.url ?? DEEPGRAM_LISTEN_URL, { Authorization: `Token ${options.apiKey}` });
      const assembler = new SentenceAssembler(onTranscript, { idPrefix: `g${config.streamGeneration}` });
      let state: 'opening' | 'open' | 'closing' | 'closed' = 'opening';
      let lastSentAt = now();
      let keepAlive: ReturnType<typeof setInterval> | undefined;
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      let opened!: { resolve: () => void; reject: (error: unknown) => void };
      const opening = new Promise<void>((resolve, reject) => { opened = { resolve, reject }; });
      const openTimer = setTimeout(() => { opened.reject(new PipelineError('asr_unavailable')); shutdown(); }, openTimeoutMs);

      const shutdown = () => {
        if (state === 'closing' || state === 'closed') return;
        const wasOpen = state === 'open';
        state = 'closing';
        clearTimeout(openTimer); clearInterval(keepAlive);
        signal.removeEventListener('abort', onAbort);
        if (!wasOpen) { socket.terminate(); return; }
        try { socket.send(JSON.stringify({ type: 'CloseStream' })); } catch { socket.terminate(); return; }
        closeTimer = setTimeout(() => socket.terminate(), closeGraceMs);
        closeTimer.unref?.();
      };
      const onAbort = () => { opened.reject(signal.reason ?? new PipelineError('audio_cancelled')); shutdown(); };
      signal.addEventListener('abort', onAbort, { once: true });

      socket.on('open', () => {
        if (state !== 'opening') return;
        state = 'open';
        clearTimeout(openTimer);
        lastSentAt = now();
        keepAlive = setInterval(() => {
          if (state !== 'open' || now() - lastSentAt < keepAliveMs) return;
          lastSentAt = now();
          socket.send(JSON.stringify({ type: 'KeepAlive' }));
        }, Math.max(250, Math.floor(keepAliveMs / 2)));
        keepAlive.unref?.();
        opened.resolve();
      });
      socket.on('message', (data, isBinary) => {
        if (state !== 'open' || isBinary) return;
        const text = decode(data);
        if (text === null) return;
        let message: unknown;
        try { message = JSON.parse(text); } catch { return; }
        const results = resultsSchema.safeParse(message);
        if (results.success) {
          const words = toWords(results.data);
          if (results.data.is_final) assembler.final(words, results.data.start + results.data.duration);
          else assembler.interim(words);
          return;
        }
        if (utteranceEndSchema.safeParse(message).success) assembler.utteranceEnd();
      });
      socket.on('error', () => { if (state === 'opening') opened.reject(new PipelineError('asr_unavailable')); });
      socket.on('close', () => {
        if (state === 'opening') opened.reject(new PipelineError('asr_unavailable'));
        state = 'closed';
        clearTimeout(openTimer); clearTimeout(closeTimer); clearInterval(keepAlive);
        signal.removeEventListener('abort', onAbort);
      });

      try { await opening; }
      catch (error) { shutdown(); throw error instanceof PipelineError || error === signal.reason ? error : new PipelineError('asr_unavailable'); }

      const stream: AsrStream = {
        async write(frame: AudioFrame) {
          if (state !== 'open') throw new PipelineError('asr_unavailable');
          await new Promise<void>((resolve, reject) => {
            socket.send(frame.pcm, error => error ? reject(new PipelineError('asr_unavailable')) : resolve());
          });
          lastSentAt = now();
        },
        async stop() { shutdown(); }
      };
      return stream;
    }
  };
}
