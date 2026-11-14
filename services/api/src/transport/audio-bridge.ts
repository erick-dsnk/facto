import { z } from 'zod';
import { PipelineError } from '../../../../packages/contracts/src/index.js';
import { abortable } from '../runtime/budget.js';
import { type Session } from '../runtime/session.js';
import { AudioFrameValidator, type AsrAdapter, type AsrStream, type AsrTranscript, type AudioStart } from './audio.js';

type Generation = {
  config: AudioStart; controller: AbortController; stream?: AsrStream;
  ready: boolean; pendingMs: number; tail: Promise<void>; startedAt: number; frameEndMs: number;
};
const transcriptSchema = z.object({
  text: z.string().refine(text => Array.from(text).length <= 800), final: z.boolean(),
  segmentId: z.string().min(1).max(256),
  confidence: z.number().min(0).max(1).nullable(), captureOffsetMs: z.number().int().min(0).max(0xffffffff),
  speaker: z.number().int().min(0).max(1000).nullable().optional()
}).strict();

/** Transport-owned lifetime/backpressure; the input owner implements AsrAdapter. */
export class AudioBridge {
  private validator: AudioFrameValidator;
  private generation?: Generation;
  private speaking = false;
  private epoch: number;
  private closedStreams = new WeakSet<AsrStream>();

  constructor(private readonly session: Session, private readonly adapter: AsrAdapter,
    private readonly onFinalTranscript: (event: AsrTranscript, config: AudioStart, capturedAt: number) => void | Promise<void>) {
    this.epoch = session.epoch;
    this.validator = new AudioFrameValidator(this.epoch);
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
    const generation: Generation = { config, controller: new AbortController(), ready: false, pendingMs: 0, tail: Promise.resolve(), startedAt: this.session.now(), frameEndMs: 0 };
    this.generation = generation;
    try {
      const opening = this.adapter.start(config, event => {
        void this.transcript(generation, event).catch(async () => {
          if (!this.current(generation)) return;
          await this.stop('invalid_transcript').catch(() => undefined);
          this.session.emit('pipeline.error', { reasonCode: 'invalid_asr_transcript', message: 'Audio transcription could not be completed.' });
        });
      }, generation.controller.signal, reasonCode => {
        // A failure while opening rejects start() instead; after audio.ready, stop listening visibly right away.
        if (!generation.ready || !this.current(generation)) return;
        void this.stop('asr_failed').catch(() => undefined).then(() => {
          this.session.emit('pipeline.error', { reasonCode: /^[a-z_]{1,64}$/.test(reasonCode) ? reasonCode : 'asr_unavailable', message: 'Audio transcription could not be completed.' });
        });
      });
      // An adapter may ignore abort while opening. Close its late resource as soon as it exists.
      void opening.then(stream => { if (!this.current(generation)) return this.closeStream(stream); }).catch(() => undefined);
      const stream = await abortable(opening, generation.controller.signal);
      if (!this.current(generation)) { await this.closeStream(stream); throw new PipelineError('audio_cancelled'); }
      generation.stream = stream;
      generation.startedAt = this.session.now();
      generation.ready = true;
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
    this.session.emit(event.final ? 'transcript.final' : 'transcript.partial', { ...event, speaker: event.speaker ?? null, streamGeneration: generation.config.streamGeneration, source: generation.config.source });
    if (event.final && this.current(generation)) await this.onFinalTranscript(event, generation.config, generation.startedAt + event.captureOffsetMs);
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
    if (active) await this.stop('playback');
  }
}
