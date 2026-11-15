import WebSocket from 'ws';
import { z } from 'zod';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { type AsrAdapter, type AsrStream, type AudioFrame } from '../../transport/audio.js';
import { SentenceAssembler, type AsrWord } from './sentence-assembler.js';

/**
 * ElevenLabs Scribe v3 Live, their most accurate realtime model (successor to scribe_v2_realtime):
 * https://elevenlabs.io/docs/overview/models#scribe-v3-live. The key travels only in the xi-api-key header.
 */
export const ELEVENLABS_MODEL_ID = 'scribe_v3_live';
export const ELEVENLABS_REALTIME_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
/**
 * - turn_prediction commits when the model predicts the speaker finished, and still commits after 0.5 s of silence (VAD stays on).
 * - diarize gives partials timed words with draft speakers, and sends a diarized_transcript after each commit.
 * - include_timestamps sends the committed words with timings even when diarization is late.
 * - language_code=en matches the English-only pipeline (Deepgram nova-3 defaults to English too).
 */
const QUERY = {
  model_id: ELEVENLABS_MODEL_ID, audio_format: 'pcm_16000', language_code: 'en', commit_strategy: 'turn_prediction',
  vad_silence_threshold_secs: '0.5', include_timestamps: 'true', diarize: 'true'
} as const;
/**
 * Names Scribe should favour (keyterm prompting). Live testing with Deepgram misheard "Opus" as "Office", "Hey Facto" as
 * "Pay Facto" and "DeepSeek" as "deep". ELEVENLABS_KEYTERMS (comma list) adds to these.
 */
export const ELEVENLABS_DEFAULT_KEYTERMS = ['Facto', 'Hey Facto', 'Anthropic', 'Claude', 'Opus', 'Sonnet', 'Haiku', 'DeepSeek', 'OpenAI', 'ChatGPT',
  'Gemini', 'Meta', 'Ray-Ban', 'Zelensky', 'Donbas', 'NATO'] as const;
/** Realtime keyterm limits: at most 50 terms of at most 20 characters. Longer terms are dropped, not cut. */
const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 20;

/** The realtime URL with one `keyterms` parameter per term that fits the realtime limits. Terms carry no secret. */
export function elevenLabsRealtimeUrl(keyterms: readonly string[]): string {
  const terms = keyterms.filter(term => Array.from(term).length <= MAX_KEYTERM_LENGTH).slice(0, MAX_KEYTERMS);
  const query = [...Object.entries(QUERY), ...terms.map(term => ['keyterms', term] as const)]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&');
  return `${ELEVENLABS_REALTIME_URL}?${query}`;
}

/** The part of a `ws` client socket the adapter uses. Tests inject a fake. */
export interface ElevenLabsSocket {
  send(data: string, callback?: (error?: Error) => void): void;
  close(code?: number): void;
  terminate(): void;
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): unknown;
  on(event: 'close', listener: (code?: number) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}
export type ElevenLabsSocketFactory = (url: string, headers: Record<string, string>) => ElevenLabsSocket;
/** One diagnostic line: an event name plus numbers and fixed codes. Never text, audio or the key. */
export type ElevenLabsLog = (event: string, fields: Record<string, number | string>) => void;
/**
 * One committed segment with ElevenLabs' raw per-word logprob. Debug only: it contains what bystanders said.
 * `words` says where the timings came from: the diarized transcript, the timestamped one, or neither (spread evenly).
 */
export type ElevenLabsTranscriptEntry = {
  generation: number; segmentIndex: number | null; start: number; end: number; transcript: string; words: 'diarized' | 'timestamps' | 'untimed';
  wordDetail: { word: string; logprob: number | null; speaker: number | null }[];
};
export type ElevenLabsOptions = {
  /** `url` replaces the whole realtime URL, keyterms included. */
  apiKey: string; url?: string; socketFactory?: ElevenLabsSocketFactory;
  /** Keyterm prompts. Default ELEVENLABS_DEFAULT_KEYTERMS; pass parseKeyterms(..., ELEVENLABS_DEFAULT_KEYTERMS) output. Terms over 20 characters are dropped. */
  keyterms?: readonly string[];
  /** How long to wait for session_started. */
  openTimeoutMs?: number;
  /** ElevenLabs closes a session after 15 s without client messages and has no keepalive message: after this long without audio, send 100 ms of silence. */
  keepAliveMs?: number;
  closeGraceMs?: number;
  /** How long a commit waits for its diarized words (speakers) before it is finalized with the timestamped words. */
  commitWaitMs?: number;
  /**
   * A commit's tail without terminal punctuation is flushed on its own when the next speech starts this long after it (audio time),
   * or when no new speech arrives within this long after the commit. Otherwise it joins the next segment. Deepgram's utterance_end_ms.
   */
  utteranceGapMs?: number;
  now?: () => number; log?: ElevenLabsLog;
  /** Off unless the server opts in (DEBUG_TRANSCRIPTS=1). Receives every committed segment with its words. */
  transcriptLog?: (entry: ElevenLabsTranscriptEntry) => void;
};

const defaultSocketFactory: ElevenLabsSocketFactory = (url, headers) => new WebSocket(url, { headers, handshakeTimeout: 10_000 });
const defaultLog: ElevenLabsLog = (event, fields) => console.warn(`[asr] ${event}`, fields);
/** Every documented error type. Each one is followed by the server closing the connection. */
const ERROR_TYPES = new Set(['error', 'auth_error', 'quota_exceeded', 'commit_throttled', 'unaccepted_terms', 'rate_limited', 'queue_overflow',
  'resource_exhausted', 'session_time_limit_exceeded', 'input_error', 'invalid_request', 'chunk_size_exceeded', 'insufficient_audio_activity', 'transcriber_error']);
/** ws reports a refused handshake as "Unexpected server response: 401". Keep only the status code. */
const handshakeStatus = (error: unknown) => Number(/Unexpected server response: (\d{3})/.exec(error instanceof Error ? error.message : '')?.[1] ?? 0);
const messageType = (message: unknown) => {
  const type = typeof message === 'object' && message !== null ? (message as { message_type?: unknown }).message_type : undefined;
  return typeof type === 'string' && /^[a-z_]{1,40}$/.test(type) ? type : 'unknown';
};
const silence = (seconds: number) => Buffer.alloc(Math.round(seconds * SAMPLE_RATE) * 2);
const KEEPALIVE_SECONDS = 0.1;

const wordSchema = z.object({
  text: z.string(), start: z.number().nullable().optional(), end: z.number().nullable().optional(), type: z.string().optional(),
  speaker_id: z.string().nullable().optional(), logprob: z.number().nullable().optional()
}).passthrough();
type Word = z.infer<typeof wordSchema>;
const partialSchema = z.object({ message_type: z.literal('partial_transcript'), text: z.string(), words: z.array(wordSchema).nullable().optional() }).passthrough();
const committedSchema = z.object({ message_type: z.literal('committed_transcript'), text: z.string(), segment_index: z.number().int().nonnegative().optional() }).passthrough();
const timestampsSchema = z.object({ message_type: z.literal('committed_transcript_with_timestamps'), text: z.string(), words: z.array(wordSchema).nullable().optional() }).passthrough();
const diarizedSchema = z.object({ message_type: z.literal('diarized_transcript'), text: z.string(), segment_index: z.number().int().nonnegative().optional(), words: z.array(wordSchema) }).passthrough();
const mergedSchema = z.object({ message_type: z.literal('speakers_merged'), from_speaker_id: z.string(), to_speaker_id: z.string() }).passthrough();
const QUIET_TYPES = new Set(['session_started']);

function decode(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data) && data.every(part => Buffer.isBuffer(part))) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return null;
}

/** Spoken words only: spacing entries and audio events such as "(laughter)" are dropped. */
const spoken = (words: readonly Word[]) => words.filter(word => (word.type ?? 'word') === 'word' && word.text.trim() !== '');
const aligned = (words: readonly Word[]) => words.every(word => typeof word.start === 'number' && typeof word.end === 'number');

type Pending = { index: number | null; text: string; timestamped?: Word[]; timer: ReturnType<typeof setTimeout> };

/**
 * ElevenLabs realtime ASR behind the transport's AsrAdapter seam, feeding the same SentenceAssembler as Deepgram.
 *
 * - A partial transcript is an interim result for the current segment. Only partials whose words all carry timings
 *   are used (each partial arrives first untimed, then timed a few ms later), and a repeat of the same words is skipped,
 *   so the assembler's "unchanged in two consecutive interims" rule still means two real updates.
 * - A commit is a final chunk. Its words come from the diarized transcript (timings, speakers), or after commitWaitMs
 *   from the timestamped transcript, or, if neither arrived, the committed text spread over the segment.
 * - A commit emits its complete sentences. A tail without terminal punctuation joins the next segment when speech resumes
 *   within utteranceGapMs (audio time), and is flushed on its own otherwise, as Deepgram's UtteranceEnd does.
 * - Words get no confidence. Scribe's logprob is not a calibrated probability: clean, correctly heard words score
 *   -0.5 to -1.6 (exp 0.2-0.6), and misheard words in noise score no lower, so a 0.75 cut would flag every word.
 *   lowConfidenceWords therefore stays empty and the misheard check judges the text alone. The opt-in transcriptLog
 *   records logprob so a threshold can be calibrated later.
 *
 * Raw audio and transcript text are never logged except through the opt-in transcriptLog.
 */
export function createElevenLabsAdapter(options: ElevenLabsOptions): AsrAdapter {
  if (!options.apiKey) throw new Error('The ElevenLabs adapter needs ELEVENLABS_API_KEY.');
  const factory = options.socketFactory ?? defaultSocketFactory;
  const openTimeoutMs = options.openTimeoutMs ?? 10_000;
  const keepAliveMs = options.keepAliveMs ?? 3_000;
  const closeGraceMs = options.closeGraceMs ?? 2_000;
  const commitWaitMs = options.commitWaitMs ?? 250;
  const utteranceGapMs = options.utteranceGapMs ?? 1_000;
  const now = options.now ?? Date.now;
  const log = options.log ?? defaultLog;
  const realtimeUrl = options.url ?? elevenLabsRealtimeUrl(options.keyterms ?? ELEVENLABS_DEFAULT_KEYTERMS);

  return {
    async start(config, onTranscript, signal, onFailure, startOptions) {
      signal.throwIfAborted();
      const socket = factory(realtimeUrl, { 'xi-api-key': options.apiKey });
      const assembler = new SentenceAssembler(onTranscript, { idPrefix: `g${config.streamGeneration}`, ignoreBefore: (startOptions?.ignoreWordsBeforeMs ?? 0) / 1000 });
      const generation = config.streamGeneration;
      const reported = new Set<string>();
      const report = (event: string, fields: Record<string, number | string> = {}) => {
        if (reported.has(event)) return;
        reported.add(event); log(event, { generation, ...fields });
      };
      let failed = false;
      const fail = () => { if (failed) return; failed = true; onFailure?.('asr_unavailable'); };
      // A throw from a message handler or timer would otherwise escape ws or the timer and crash the server: end this stream instead.
      const guarded = (run: () => void) => {
        try { run(); } catch { report('elevenlabs_handler_error'); fail(); shutdown(true); }
      };
      let state: 'opening' | 'open' | 'closing' | 'closed' = 'opening';
      let lastSentAt = now();
      let keepAlive: ReturnType<typeof setInterval> | undefined;
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      let opened!: { resolve: () => void; reject: (error: unknown) => void };
      const opening = new Promise<void>((resolve, reject) => { opened = { resolve, reject }; });
      const openTimer = setTimeout(() => { report('elevenlabs_open_timeout'); opened.reject(new PipelineError('asr_unavailable')); shutdown(); }, openTimeoutMs);

      // The server's clock counts every second of audio it received, including keepalive silence. The bridge counts
      // only the phone's audio, so word times are moved back by the silence injected before them.
      let serverSeconds = 0;
      const gaps: { at: number; seconds: number }[] = [];
      const toCapture = (time: number) => {
        let shift = 0;
        for (const gap of gaps) {
          if (time >= gap.at + gap.seconds) shift += gap.seconds;
          else if (time > gap.at) shift += time - gap.at;
        }
        return Math.max(0, time - shift);
      };

      const merges = new Map<string, string>();
      const speakerOf = (id: string | null | undefined): number | null => {
        let current = id ?? null;
        for (let hops = 0; current !== null && merges.has(current) && hops < 100; hops++) current = merges.get(current)!;
        const index = current === null ? NaN : Number(/^speaker_(\d{1,4})$/.exec(current)?.[1]);
        return Number.isInteger(index) && index <= 1000 ? index : null;
      };
      const toWords = (words: readonly Word[]): AsrWord[] => spoken(words).map(word => {
        const start = toCapture(word.start!);
        return { text: word.text.trim(), start, end: Math.max(start, toCapture(word.end!)), confidence: null, speaker: speakerOf(word.speaker_id) };
      });

      // Segment bookkeeping, all in server seconds.
      let segmentStart: number | null = null;
      let lastCommitEnd = 0;
      let lastPartial = '';
      const pending: Pending[] = [];
      /** True from a commit until its tail is flushed or new speech arrives. */
      let holding = false;

      const flush = () => { clearTimeout(flushTimer); if (!holding) return; holding = false; assembler.utteranceEnd(); };
      const scheduleFlush = () => {
        clearTimeout(flushTimer);
        holding = true;
        flushTimer = setTimeout(() => guarded(() => { if (state === 'open') flush(); }), utteranceGapMs);
        flushTimer.unref?.();
      };
      const finalize = (commit: Pending, diarized?: Word[]) => {
        clearTimeout(commit.timer);
        const at = pending.indexOf(commit);
        if (at < 0) return;
        pending.splice(at, 1);
        let source: ElevenLabsTranscriptEntry['words'] = 'untimed';
        let raw: Word[] | undefined;
        if (diarized && spoken(diarized).length && aligned(spoken(diarized))) { source = 'diarized'; raw = spoken(diarized); }
        else if (commit.timestamped && spoken(commit.timestamped).length && aligned(spoken(commit.timestamped))) { source = 'timestamps'; raw = spoken(commit.timestamped); }
        else {
          // Neither word list arrived: spread the committed text over the segment.
          report('elevenlabs_commit_untimed');
          const tokens = commit.text.split(/\s+/).filter(Boolean);
          const from = Math.min(segmentStart ?? lastCommitEnd, serverSeconds);
          const step = tokens.length ? Math.max(0, serverSeconds - from) / tokens.length : 0;
          raw = tokens.map((text, index) => ({ text, start: from + index * step, end: from + (index + 1) * step, type: 'word' }));
        }
        segmentStart = null; lastPartial = '';
        if (!raw.length) return;
        lastCommitEnd = Math.max(lastCommitEnd, raw[raw.length - 1].end!);
        const words = toWords(raw);
        options.transcriptLog?.({
          generation, segmentIndex: commit.index, start: words[0].start, end: words[words.length - 1].end, transcript: commit.text, words: source,
          wordDetail: raw.map((word, index) => ({ word: words[index].text, logprob: typeof word.logprob === 'number' ? word.logprob : null, speaker: words[index].speaker }))
        });
        assembler.final(words, words[words.length - 1].end);
        scheduleFlush();
      };
      /** Finalize every pending commit up to `last` (all of them by default) with the words it has. */
      const settle = (last = pending[pending.length - 1]) => {
        if (!last || !pending.includes(last)) return;
        while (pending[0] !== last) finalize(pending[0]);
        finalize(last);
      };

      const shutdown = (immediate = false) => {
        if (state === 'closing' || state === 'closed') return;
        const wasOpen = state === 'open';
        state = 'closing';
        clearTimeout(openTimer); clearInterval(keepAlive); clearTimeout(flushTimer);
        for (const commit of pending) clearTimeout(commit.timer);
        pending.length = 0;
        signal.removeEventListener('abort', onAbort);
        if (!wasOpen || immediate) { socket.terminate(); return; }
        // Armed first: a close event fired during close() clears it.
        closeTimer = setTimeout(() => socket.terminate(), closeGraceMs);
        closeTimer.unref?.();
        try { socket.close(1000); } catch { clearTimeout(closeTimer); socket.terminate(); }
      };
      const onAbort = () => { opened.reject(signal.reason ?? new PipelineError('audio_cancelled')); shutdown(); };
      signal.addEventListener('abort', onAbort, { once: true });

      const sendAudio = (pcm: Uint8Array, callback?: (error?: Error) => void) => {
        socket.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64'), commit: false, sample_rate: SAMPLE_RATE }), callback);
        serverSeconds += pcm.byteLength / BYTES_PER_SECOND;
        lastSentAt = now();
      };
      const sendKeepAlive = () => {
        const last = gaps[gaps.length - 1];
        // Consecutive keepalives with no audio between them extend one gap.
        if (last && last.at + last.seconds === serverSeconds) last.seconds += KEEPALIVE_SECONDS;
        else gaps.push({ at: serverSeconds, seconds: KEEPALIVE_SECONDS });
        sendAudio(silence(KEEPALIVE_SECONDS));
      };

      const onMessage = (message: unknown, bytes: number) => {
        const partial = partialSchema.safeParse(message);
        if (partial.success) {
          if (!partial.data.words) { if (partial.data.text.trim()) report('elevenlabs_partial_without_words'); return; }
          const words = spoken(partial.data.words);
          if (!words.length || !aligned(words)) return;
          const key = words.map(word => word.text).join(' ');
          if (key === lastPartial) return;
          // New speech: the server has moved past any commit still waiting for its words. A held tail joins this segment,
          // unless the speech starts utteranceGapMs or more after it, which is a new utterance (Deepgram's UtteranceEnd rule).
          settle();
          if (holding && words[0].start! - lastCommitEnd >= utteranceGapMs / 1000) flush();
          clearTimeout(flushTimer); holding = false;
          lastPartial = key; segmentStart ??= words[0].start!;
          assembler.interim(toWords(words));
          return;
        }
        const committed = committedSchema.safeParse(message);
        if (committed.success) {
          if (!committed.data.text.trim()) return;
          const commit: Pending = { index: committed.data.segment_index ?? null, text: committed.data.text, timer: setTimeout(() => guarded(() => settle(commit)), commitWaitMs) };
          commit.timer.unref?.();
          pending.push(commit);
          return;
        }
        const timestamps = timestampsSchema.safeParse(message);
        if (timestamps.success) {
          const commit = pending.find(item => !item.timestamped && item.text === timestamps.data.text);
          if (commit) commit.timestamped = timestamps.data.words ?? [];
          return;
        }
        const diarized = diarizedSchema.safeParse(message);
        if (diarized.success) {
          const { segment_index: index, text } = diarized.data;
          const commit = pending.find(item => index !== undefined && item.index !== null ? item.index === index : item.text === text);
          if (!commit) return;
          while (pending[0] !== commit) finalize(pending[0]);
          finalize(commit, diarized.data.words);
          return;
        }
        const merged = mergedSchema.safeParse(message);
        if (merged.success) { if (merged.data.from_speaker_id !== merged.data.to_speaker_id) merges.set(merged.data.from_speaker_id, merged.data.to_speaker_id); return; }
        const type = messageType(message);
        if (ERROR_TYPES.has(type)) {
          // A provider error ends recognition (the server closes next): tear the stream down and tell the bridge now.
          report('elevenlabs_provider_error', { type, bytes });
          fail(); shutdown(true); return;
        }
        if (type === 'warning') { report('elevenlabs_warning', { bytes }); return; }
        if (!QUIET_TYPES.has(type)) report('elevenlabs_unexpected_message', { type, bytes });
      };

      socket.on('open', () => { if (state === 'opening') lastSentAt = now(); });
      socket.on('message', (data, isBinary) => {
        if ((state !== 'open' && state !== 'opening') || isBinary) return;
        const text = decode(data);
        if (text === null) { report('elevenlabs_undecodable_message'); return; }
        const bytes = Buffer.byteLength(text);
        let message: unknown;
        try { message = JSON.parse(text); } catch { report('elevenlabs_unparsable_message', { bytes }); return; }
        const type = messageType(message);
        if (state === 'opening') {
          // The session is usable once the server confirmed its configuration; an error before that refuses the start.
          if (type === 'session_started') {
            state = 'open';
            clearTimeout(openTimer);
            lastSentAt = now();
            keepAlive = setInterval(() => {
              if (state !== 'open' || now() - lastSentAt < keepAliveMs) return;
              try { sendKeepAlive(); } catch { report('elevenlabs_keepalive_failed'); }
            }, Math.max(250, Math.floor(keepAliveMs / 2)));
            keepAlive.unref?.();
            opened.resolve();
          } else if (ERROR_TYPES.has(type)) {
            report('elevenlabs_open_failed', { type });
            opened.reject(new PipelineError('asr_unavailable')); shutdown();
          }
          return;
        }
        guarded(() => onMessage(message, bytes));
      });
      socket.on('error', error => {
        if (state === 'opening') {
          report('elevenlabs_open_failed', { status: handshakeStatus(error) });
          opened.reject(new PipelineError('asr_unavailable'));
        } else if (state === 'open') { report('elevenlabs_socket_error'); fail(); shutdown(true); }
      });
      socket.on('close', code => {
        if (state === 'opening') { report('elevenlabs_open_failed', { code: code ?? 1005 }); opened.reject(new PipelineError('asr_unavailable')); }
        else if (state === 'open') { report('elevenlabs_closed', { code: code ?? 1005 }); fail(); }
        state = 'closed';
        clearTimeout(openTimer); clearTimeout(closeTimer); clearInterval(keepAlive); clearTimeout(flushTimer);
        for (const commit of pending) clearTimeout(commit.timer);
        pending.length = 0;
        signal.removeEventListener('abort', onAbort);
      });

      try { await opening; }
      catch (error) { shutdown(); throw error instanceof PipelineError || error === signal.reason ? error : new PipelineError('asr_unavailable'); }
      const isOpen = () => state === 'open';
      if (!isOpen()) { shutdown(); throw new PipelineError('asr_unavailable'); }

      const stream: AsrStream = {
        async write(frame: AudioFrame) {
          if (state !== 'open') throw new PipelineError('asr_unavailable');
          await new Promise<void>((resolve, reject) => {
            sendAudio(frame.pcm, error => error ? reject(new PipelineError('asr_unavailable')) : resolve());
          });
        },
        async stop() { shutdown(); }
      };
      return stream;
    }
  };
}
