/**
 * Voice dimming. Only the wearer and the person they are talking to should be checked, not other tables. The wearer's mouth is a few
 * cm from the glasses mic, a conversation partner about 1 m away and background talkers 3 m or more, so a sentence's loudness compared
 * with the wearer's says roughly who spoke it. Pure: no timers, no I/O.
 */

/** Dim a sentence this many dB below the wearer's level (ASR_DIM_DB). 0 turns dimming off. */
export const DEFAULT_DIM_DB = 14;
/**
 * Dim anything quieter than this, whatever the wearer's level (ASR_DIM_FLOOR_DBFS). The wearer's speech at the glasses lands around
 * -20 to -30 dBFS after the phone's gain; -60 dBFS is 30 dB or more under that and near the noise floor of a 16-bit voice stream, so
 * words that quiet are either far away or made up from noise. It only matters when the wearer's level is unusually low.
 */
export const DEFAULT_DIM_FLOOR_DBFS = -60;
/** After a spoken answer, ignore words that start this early in the resumed stream (ASR_ECHO_MS): the answer's tail. 0 turns it off. */
export const DEFAULT_ECHO_MS = 800;

const SAMPLE_RATE = 16000;
const BLOCK_MS = 10;
const SAMPLES_PER_BLOCK = SAMPLE_RATE * BLOCK_MS / 1000;
/** Two minutes of 10 ms blocks: sentences are finalized seconds after their audio arrives. */
const HISTORY_BLOCKS = 12_000;
const FULL_SCALE_SQUARED = 32768 * 32768;
const SILENCE_DBFS = -120;
/** A sentence's level is the 75th percentile of its 10 ms block levels: above the pauses between words, below one-off clicks. */
const LEVEL_PERCENTILE = 0.75;
const MIN_BLOCKS = 3;

/** Per-10 ms energy of the 16 kHz s16le audio one stream generation received, for the last two minutes. */
export class LevelHistory {
  private readonly sums = new Float64Array(HISTORY_BLOCKS);
  private readonly counts = new Uint16Array(HISTORY_BLOCKS);
  private readonly blocks = new Float64Array(HISTORY_BLOCKS).fill(-1);

  /** `captureOffsetMs` is the frame's position in the stream; frames arrive in order and without gaps. */
  add(captureOffsetMs: number, pcm: Uint8Array): void {
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const first = Math.round(captureOffsetMs * SAMPLE_RATE / 1000);
    for (let byte = 0; byte + 1 < pcm.byteLength; byte += 2) {
      const block = Math.floor((first + byte / 2) / SAMPLES_PER_BLOCK);
      const slot = block % HISTORY_BLOCKS;
      if (this.blocks[slot] !== block) { this.blocks[slot] = block; this.sums[slot] = 0; this.counts[slot] = 0; }
      const sample = view.getInt16(byte, true);
      this.sums[slot] += sample * sample; this.counts[slot]++;
    }
  }

  /** The speech level of [startMs, endMs) in dBFS, or null when less than 30 ms of that span is still held. */
  levelDbfs(startMs: number, endMs: number): number | null {
    const first = Math.max(0, Math.floor(startMs / BLOCK_MS));
    const last = Math.min(Math.ceil(endMs / BLOCK_MS), first + HISTORY_BLOCKS);
    const levels: number[] = [];
    for (let block = first; block < last; block++) {
      const slot = block % HISTORY_BLOCKS;
      if (this.blocks[slot] !== block || !this.counts[slot]) continue;
      const meanSquare = this.sums[slot] / this.counts[slot];
      levels.push(meanSquare > 0 ? Math.max(SILENCE_DBFS, 10 * Math.log10(meanSquare / FULL_SCALE_SQUARED)) : SILENCE_DBFS);
    }
    if (levels.length < MIN_BLOCKS) return null;
    levels.sort((a, b) => a - b);
    return levels[Math.min(levels.length - 1, Math.floor(LEVEL_PERCENTILE * levels.length))];
  }
}

/**
 * - kept: within dimDb of the wearer's level and above the floor.
 * - dimmed: too quiet, so not checked.
 * - learning: fewer than 3 reference sentences yet, kept.
 * - trigger: a spoken "check this", never dimmed.
 * - unmeasured: no audio held for its words, kept.
 * - off: dimming is off (ASR_DIM_DB=0), kept; the level is still reported.
 */
export type VoiceAction = 'kept' | 'dimmed' | 'learning' | 'trigger' | 'unmeasured' | 'off';
export type VoiceDecision = { action: VoiceAction; level: number | null; reference: number | null; reason?: 'below_reference' | 'below_floor' };
export type VoiceGateOptions = { dimDb: number; floorDbfs: number };

const WINDOW = 30;
const MIN_SAMPLES = 3;
const PERCENTILE_FROM = 10;
const MAX_AGE_MS = 10 * 60_000;
const MAX_RISE_DB = 6;

/**
 * Keeps a rolling reference for the wearer's level and dims sentences far below it. The reference is the 90th percentile of the last 30
 * kept sentence levels (10 minutes at most): the wearer is the loudest regular voice. With fewer than 10 it is the median, and once the
 * percentile is in use a new level counts at most 6 dB above the reference, so one shout or knock on the frame cannot raise it enough
 * to dim the wearer. Dimmed sentences never feed the reference.
 */
export class VoiceDimmer {
  private kept: { level: number; at: number }[] = [];
  constructor(private readonly options: VoiceGateOptions, private readonly now: () => number) {}

  reference(): number | null {
    const cutoff = this.now() - MAX_AGE_MS;
    while (this.kept.length && this.kept[0].at < cutoff) this.kept.shift();
    const count = this.kept.length;
    if (count < MIN_SAMPLES) return null;
    const sorted = this.kept.map(entry => entry.level).sort((a, b) => a - b);
    return count < PERCENTILE_FROM ? sorted[Math.floor(count / 2)] : sorted[Math.ceil(0.9 * count) - 1];
  }

  decide(level: number | null, trigger: boolean): VoiceDecision {
    const reference = this.reference();
    if (level === null) return { action: 'unmeasured', level, reference };
    if (this.options.dimDb <= 0) return { action: 'off', level, reference };
    if (trigger) { this.record(level, reference); return { action: 'trigger', level, reference }; }
    if (reference === null) { this.record(level, reference); return { action: 'learning', level, reference }; }
    if (level < this.options.floorDbfs) return { action: 'dimmed', level, reference, reason: 'below_floor' };
    if (level < reference - this.options.dimDb) return { action: 'dimmed', level, reference, reason: 'below_reference' };
    this.record(level, reference);
    return { action: 'kept', level, reference };
  }

  /** Forget the reference, as when the audio source (glasses or phone mic) changes and levels are no longer comparable. */
  reset(): void { this.kept = []; }

  private record(level: number, reference: number | null) {
    const capped = reference !== null && this.kept.length >= PERCENTILE_FROM ? Math.min(level, reference + MAX_RISE_DB) : level;
    this.kept.push({ level: capped, at: this.now() });
    if (this.kept.length > WINDOW) this.kept.shift();
  }
}

/** Join a sentence that looks unfinished with the same speaker's next sentence within this many ms (ASR_STITCH_MS). 0: no joining. */
export const DEFAULT_STITCH_MS = 4_000;

export type VoiceConfig = { dimDb: number; floorDbfs: number; echoMs: number; stitchMs: number };

/** ASR_DIM_DB (0-60, default 14), ASR_DIM_FLOOR_DBFS (-120 to 0, default -60), ASR_ECHO_MS (0-5000, default 800), ASR_STITCH_MS (0-15000, default 4000). */
export function parseVoiceConfig(env: Readonly<Record<string, string | undefined>>): VoiceConfig {
  const read = (name: string, fallback: number, min: number, max: number) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number from ${min} to ${max}.`);
    return value;
  };
  return { dimDb: read('ASR_DIM_DB', DEFAULT_DIM_DB, 0, 60), floorDbfs: read('ASR_DIM_FLOOR_DBFS', DEFAULT_DIM_FLOOR_DBFS, -120, 0), echoMs: read('ASR_ECHO_MS', DEFAULT_ECHO_MS, 0, 5000),
    stitchMs: read('ASR_STITCH_MS', DEFAULT_STITCH_MS, 0, 15_000) };
}
