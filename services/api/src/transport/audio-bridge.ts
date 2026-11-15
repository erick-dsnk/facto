import { z } from 'zod';
import { MAX_LOW_CONFIDENCE_WORDS, PipelineError, lowConfidenceWordSchema } from '../../../../packages/contracts/src/index.js';
import { abortable } from '../runtime/budget.js';
import { type Session } from '../runtime/session.js';
import { AudioFrameValidator, type AsrAdapter, type AsrStream, type AsrTranscript, type AudioStart } from './audio.js';
import { isVoiceTrigger } from './transcript-context.js';
import { LevelHistory, VoiceDimmer, type VoiceDecision, type VoiceGateOptions } from './voice-level.js';

type Generation = {
  config: AudioStart; controller: AbortController; stream?: AsrStream;
  ready: boolean; pendingMs: number; tail: Promise<void>; startedAt: number; frameEndMs: number;
  /** Wall time and audio offset of the first frame: sentence times are counted from here. */
  firstFrameAt?: number; firstFrameOffsetMs?: number;
  /** Loudness of the audio received, and the dimming decision per segment (a corrected revision keeps its segment's decision). */
  levels?: LevelHistory; decisions: Map<string, VoiceDecision>;
};
/** One record per final sentence for the debug feed: its level, the wearer reference and what the gate did. */
export type LevelRecord = { streamGeneration: number; segmentId: string; text: string } & VoiceDecision;
export type AudioBridgeOptions = {
  /** Voice dimming: final sentences far quieter than the wearer are not checked. Absent: no metering at all. dimDb 0: metered, never dimmed. */
  dim?: VoiceGateOptions;
  /** After a spoken answer, words that start within this many ms of the resumed stream are ignored (the answer's tail). Absent or 0: off. */
  echoMs?: number;
  /** Debug feed hook, called once per final segment that was metered. */
  onLevel?: (record: LevelRecord) => void;
};
const DECISION_MEMORY = 256;
const round = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;
const transcriptSchema = z.object({
  text: z.string().refine(text => Array.from(text).length <= 800), final: z.boolean(),
  segmentId: z.string().min(1).max(256),
  confidence: z.number().min(0).max(1).nullable(), captureOffsetMs: z.number().int().min(0).max(0xffffffff),
  speaker: z.number().int().min(0).max(1000).nullable().optional(),
  lowConfidenceWords: z.array(lowConfidenceWordSchema).max(MAX_LOW_CONFIDENCE_WORDS).optional(),
  endOffsetMs: z.number().int().min(0).max(0xffffffff).optional()
}).strict();

/** Transport-owned lifetime/backpressure; the input owner implements AsrAdapter. */
export class AudioBridge {
  private validator: AudioFrameValidator;
  private generation?: Generation;
  private speaking = false;
  private epoch: number;
  private closedStreams = new WeakSet<AsrStream>();
  /** Lives across generations: the wearer's level does not change when listening pauses for a spoken answer. */
  private readonly dimmer?: VoiceDimmer;
  private lastSource?: AudioStart['source'];
  /** Set by a playback pause; the next stream that becomes ready ignores its first echoMs of words. */
  private afterPlayback = false;

  constructor(private readonly session: Session, private readonly adapter: AsrAdapter,
    private readonly onFinalTranscript: (event: AsrTranscript, config: AudioStart, capturedAt: number) => void | Promise<void>,
    private readonly options: AudioBridgeOptions = {}) {
    this.epoch = session.epoch;
    this.validator = new AudioFrameValidator(this.epoch);
    if (options.dim) this.dimmer = new VoiceDimmer(options.dim, () => session.now());
  }

  private current(generation: Generation): boolean {
    return this.generation === generation && !generation.controller.signal.aborted && this.session.active &&
      this.session.epoch === generation.config.sessionEpoch && this.session.now() < this.session.expiresAt && !this.speaking;
  }

  async start(control: unknown): Promise<void> {
    if (!this.session.active || this.session.now() >= this.session.expiresAt) throw new PipelineError('old_epoch');
    if (this.speaking) throw new PipelineError('playback_active');
    if (this.generation) throw new PipelineError('audio_already_started');
    if (this.epoch !== this.session.epoch) {
      this.epoch = this.session.epoch;
      this.validator = new AudioFrameValidator(this.epoch);
    }
    const config = this.validator.start(control);
    const generation: Generation = { config, controller: new AbortController(), ready: false, pendingMs: 0, tail: Promise.resolve(), startedAt: this.session.now(), frameEndMs: 0,
      ...(this.dimmer ? { levels: new LevelHistory() } : {}), decisions: new Map() };
    this.generation = generation;
    // Levels from the glasses and from the phone mic are not comparable.
    if (this.lastSource !== undefined && this.lastSource !== config.source) this.dimmer?.reset();
    this.lastSource = config.source;
    const echoMs = this.afterPlayback ? this.options.echoMs ?? 0 : 0;
    try {
      const onTranscript = (event: AsrTranscript) => {
        void this.transcript(generation, event).catch(async () => {
          if (!this.current(generation)) return;
          await this.stop('invalid_transcript').catch(() => undefined);
          this.session.emit('pipeline.error', { reasonCode: 'invalid_asr_transcript', message: 'Audio transcription could not be completed.' });
        });
      };
      const onFailure = (reasonCode: string) => {
        // A failure while opening rejects start() instead; after audio.ready, stop listening visibly right away.
        if (!generation.ready || !this.current(generation)) return;
        void this.stop('asr_failed').catch(() => undefined).then(() => {
          this.session.emit('pipeline.error', { reasonCode: /^[a-z_]{1,64}$/.test(reasonCode) ? reasonCode : 'asr_unavailable', message: 'Audio transcription could not be completed.' });
        });
      };
      const opening = echoMs > 0
        ? this.adapter.start(config, onTranscript, generation.controller.signal, onFailure, { ignoreWordsBeforeMs: echoMs })
        : this.adapter.start(config, onTranscript, generation.controller.signal, onFailure);
      // An adapter may ignore abort while opening. Close its late resource as soon as it exists.
      void opening.then(stream => { if (!this.current(generation)) return this.closeStream(stream); }).catch(() => undefined);
      const stream = await abortable(opening, generation.controller.signal);
      if (!this.current(generation)) { await this.closeStream(stream); throw new PipelineError('audio_cancelled'); }
      generation.stream = stream;
      generation.startedAt = this.session.now();
      generation.ready = true;
      this.afterPlayback = false;
      this.validator.acknowledge();
      this.session.emit('audio.ready', { streamGeneration: config.streamGeneration, encoding: config.encoding, sampleRateHz: config.sampleRateHz, channels: config.channels, source: config.source });
    } catch (error) {
      if (this.generation === generation) await this.stop('start_failed').catch(() => undefined);
      throw error instanceof PipelineError ? error : new PipelineError('asr_unavailable');
    }
  }

  async accept(bytes: Uint8Array): Promise<void> {
    const generation = this.generation;
    if (!generation || !generation.ready || !this.current(generation) || !generation.stream) throw new PipelineError('audio_not_ready');
    let frame;
    try {
      frame = this.validator.accept(bytes);
      if (generation.pendingMs + frame.durationMs > 2000) throw new PipelineError('audio_backlog');
      generation.frameEndMs = frame.captureOffsetMs + frame.durationMs;
      generation.levels?.add(frame.captureOffsetMs, frame.pcm);
      if (generation.firstFrameAt === undefined) {
        generation.firstFrameAt = this.session.now();
        generation.firstFrameOffsetMs = frame.captureOffsetMs;
      }
    } catch (error) {
      await this.stop('frame_rejected').catch(() => undefined);
      throw error;
    }
    generation.pendingMs += frame.durationMs;
    const write = generation.tail.then(async () => {
      generation.controller.signal.throwIfAborted();
      if (!this.current(generation)) throw new PipelineError('audio_cancelled');
      await abortable(generation.stream!.write(frame), generation.controller.signal);
    });
    generation.tail = write.catch(() => undefined);
    try { await write; }
    catch (error) {
      if (this.generation === generation) await this.stop('asr_failed').catch(() => undefined);
      throw error instanceof PipelineError ? error : new PipelineError('asr_unavailable');
    } finally { generation.pendingMs -= frame.durationMs; }
  }

  private async transcript(generation: Generation, input: AsrTranscript): Promise<void> {
    if (!generation.ready || !this.current(generation)) return;
    const event = transcriptSchema.parse(input);
    if (event.captureOffsetMs > generation.frameEndMs) throw new PipelineError('invalid_asr_capture_time');
    if (!event.text.trim()) return;
    // Low-confidence words go to the checker only and the end time to the level gate; transcript events keep their documented payload.
    const { lowConfidenceWords: _lowConfidenceWords, endOffsetMs: _endOffsetMs, ...shown } = event;
    this.session.emit(event.final ? 'transcript.final' : 'transcript.partial', { ...shown, speaker: event.speaker ?? null, streamGeneration: generation.config.streamGeneration, source: generation.config.source });
    // Count from when audio actually started arriving, not from audio.ready: glasses can start
    // sending audio many seconds after the stream is ready (their camera link comes up first),
    // and startedAt + offset then stamped every sentence that far in the past, so the runtime
    // threw them all away as stale (> 15 s). A transcript that itself arrives late keeps its
    // real capture time.
    const capturedAt = (generation.firstFrameAt ?? generation.startedAt) + event.captureOffsetMs - (generation.firstFrameOffsetMs ?? 0);
    if (!event.final || !this.current(generation)) return;
    // A dimmed sentence is still shown as a transcript but never checked or used as context.
    if (this.judge(generation, event)?.action === 'dimmed') return;
    await this.onFinalTranscript(event, generation.config, capturedAt);
  }

  /** Measures a final sentence over its words' span and asks the gate. A spoken "check this" is never dimmed. */
  private judge(generation: Generation, event: z.infer<typeof transcriptSchema>): VoiceDecision | undefined {
    if (!this.dimmer || !generation.levels) return undefined;
    const trigger = isVoiceTrigger(event.text);
    const known = generation.decisions.get(event.segmentId);
    if (known && !(trigger && known.action === 'dimmed')) return known;
    const end = event.endOffsetMs;
    const level = end !== undefined && end > event.captureOffsetMs ? generation.levels.levelDbfs(event.captureOffsetMs, end) : null;
    const decision = this.dimmer.decide(level, trigger);
    generation.decisions.set(event.segmentId, decision);
    if (generation.decisions.size > DECISION_MEMORY) generation.decisions.delete(generation.decisions.keys().next().value!);
    this.options.onLevel?.({ streamGeneration: generation.config.streamGeneration, segmentId: event.segmentId, text: event.text,
      ...decision, level: round(decision.level), reference: round(decision.reference) });
    return decision;
  }

  async stop(reason = 'stopped'): Promise<void> {
    const generation = this.generation;
    this.generation = undefined;
    this.validator.stop();
    if (!generation) return;
    generation.controller.abort(new PipelineError('audio_cancelled'));
    if (this.session.active && this.session.epoch === generation.config.sessionEpoch) this.session.emit('audio.stopped', { reasonCode: reason, streamGeneration: generation.config.streamGeneration });
    if (generation.stream) {
      try { await this.closeStream(generation.stream); }
      catch { throw new PipelineError('asr_stop_failed'); }
    }
  }

  private async closeStream(stream: AsrStream): Promise<void> {
    if (this.closedStreams.has(stream)) return;
    this.closedStreams.add(stream);
    await stream.stop();
  }

  async playback(active: boolean): Promise<void> {
    this.speaking = active;
    if (!active) return;
    this.afterPlayback = true;
    await this.stop('playback');
  }
}
