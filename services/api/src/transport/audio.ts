import { z } from 'zod';
import { PipelineError } from '../../../../packages/contracts/src/index.js';

export const AUDIO_HEADER_BYTES = 13;
export const audioStartSchema = z.object({
  type: z.literal('audio.start'), sessionEpoch: z.number().int().positive(),
  streamGeneration: z.number().int().min(1).max(0xffffffff), encoding: z.literal('pcm_s16le'),
  sampleRateHz: z.literal(16000), channels: z.literal(1),
  source: z.enum(['glasses_hfp', 'glasses_stream_audio', 'phone_mic', 'recorded_fixture'])
}).strict();
export type AudioStart = z.infer<typeof audioStartSchema>;
export type AudioFrame = {
  streamGeneration: number; sequence: number; captureOffsetMs: number;
  pcm: Uint8Array; durationMs: number;
};
/** `speaker` is the provider's 0-based diarization index for the sentence, or null/absent when unknown. */
export type AsrTranscript = { text: string; final: boolean; segmentId: string; confidence: number | null; captureOffsetMs: number; speaker?: number | null };
/** The input owner supplies this adapter. Transport never stores audio or chooses a microphone. */
export interface AsrAdapter {
  start(config: AudioStart, onTranscript: (event: AsrTranscript) => void, signal: AbortSignal): Promise<AsrStream>;
}
export interface AsrStream { write(frame: AudioFrame): Promise<void>; stop(): Promise<void>; }

/** One validator per socket. A discontinuity invalidates the whole generation. */
export class AudioFrameValidator {
  private config?: AudioStart;
  private acknowledged = false;
  private lastGeneration = 0;
  private nextSequence = 0;
  private nextOffsetMs = 0;

  constructor(private readonly sessionEpoch: number) {}

  start(input: unknown): AudioStart {
    const result = audioStartSchema.safeParse(input);
    if (!result.success) throw new PipelineError('invalid_audio_start');
    const config = result.data;
    if (config.sessionEpoch !== this.sessionEpoch) throw new PipelineError('old_epoch');
    if (this.config || config.streamGeneration <= this.lastGeneration) throw new PipelineError('invalid_audio_generation');
    this.config = config;
    this.lastGeneration = config.streamGeneration;
    this.nextSequence = 0;
    this.nextOffsetMs = 0;
    this.acknowledged = false;
    return config;
  }

  acknowledge(): void {
    if (!this.config) throw new PipelineError('audio_not_started');
    this.acknowledged = true;
  }

  accept(bytes: Uint8Array): AudioFrame {
    const fail = (code: string): never => { this.stop(); throw new PipelineError(code); };
    if (!this.config || !this.acknowledged) return fail('audio_not_ready');
    const payloadBytes = bytes.byteLength - AUDIO_HEADER_BYTES;
    // 20–200ms per frame, integral milliseconds; transport/ASR separately cap queued RAM at 2s.
    if (payloadBytes < 640 || payloadBytes > 6400 || payloadBytes % 32 !== 0) return fail('invalid_audio_frame_size');
    const header = new DataView(bytes.buffer, bytes.byteOffset, AUDIO_HEADER_BYTES);
    if (header.getUint8(0) !== 1) return fail('invalid_audio_version');
    const streamGeneration = header.getUint32(1, false);
    const sequence = header.getUint32(5, false);
    const captureOffsetMs = header.getUint32(9, false);
    if (streamGeneration !== this.config.streamGeneration) return fail('invalid_audio_generation');
    if (sequence !== this.nextSequence || captureOffsetMs !== this.nextOffsetMs) return fail('audio_gap');
    const durationMs = payloadBytes / 32;
    this.nextSequence += 1;
    this.nextOffsetMs += durationMs;
    return { streamGeneration, sequence, captureOffsetMs, pcm: bytes.subarray(AUDIO_HEADER_BYTES), durationMs };
  }

  stop(): void { this.config = undefined; this.acknowledged = false; }
}
