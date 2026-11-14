import { type AsrTranscript } from '../../transport/audio.js';

/** One recognised word. Times are seconds from the start of the audio stream. */
export type AsrWord = { text: string; start: number; end: number; confidence: number | null; speaker: number | null };
export type AssemblerOptions = { idPrefix?: string; maxChars?: number };

type Piece = { words: AsrWord[]; text: string; boundary: boolean };
type Pending = { segmentId: string; text: string; endTime: number };

const TRANSCRIPT_MAX_CODE_POINTS = 800;
const TERMINAL = /[.?!]["'”’)\]]*$/;
const CLOSING = /["'”’)\]]+$/;
/** Dotted initials such as "U.S.", "e.g." or "J.". */
const INITIALS = /^(?:\p{L}\.)+$/u;
/** Titles and abbreviations that smart_format writes with a period. */
const ABBREVIATIONS = new Set(['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'st.', 'mt.', 'vs.', 'gen.', 'sen.', 'rep.', 'gov.', 'lt.', 'col.', 'capt.', 'sgt.',
  'etc.', 'jr.', 'sr.', 'inc.', 'ltd.', 'co.', 'corp.', 'approx.']);
const length = (text: string) => Array.from(text).length;
const middle = (word: AsrWord) => (word.start + word.end) / 2;
const join = (words: AsrWord[]) => words.map(word => word.text).join(' ');
const offsetMs = (words: AsrWord[]) => words.length ? Math.max(0, Math.round(words[0].start * 1000)) : 0;

/** Most frequent diarized speaker; a tie goes to the speaker heard first. */
export function majoritySpeaker(words: AsrWord[]): number | null {
  const counts = new Map<number, number>();
  for (const word of words) if (word.speaker !== null) counts.set(word.speaker, (counts.get(word.speaker) ?? 0) + 1);
  let best: number | null = null;
  for (const [speaker, count] of counts) if (best === null || count > counts.get(best)!) best = speaker;
  return best;
}

function averageConfidence(words: AsrWord[]): number | null {
  const values = words.map(word => word.confidence).filter((value): value is number => value !== null);
  if (!values.length) return null;
  return Math.min(1, Math.max(0, values.reduce((sum, value) => sum + value, 0) / values.length));
}

/**
 * Splits a run-on sentence into pieces of at most `maxChars` code points, cutting after the last comma
 * that fits, or at the last space. Every piece but the last becomes a boundary.
 */
function cap(words: AsrWord[], boundary: boolean, maxChars: number): Piece[] {
  const pieces: Piece[] = [];
  let rest = words;
  while (length(join(rest)) > maxChars && rest.length > 1) {
    let fit = 1;
    while (fit < rest.length && length(join(rest.slice(0, fit + 1))) <= maxChars) fit++;
    let cut = fit;
    for (let index = fit; index >= 1; index--) if (rest[index - 1].text.endsWith(',')) { cut = index; break; }
    const head = rest.slice(0, cut);
    pieces.push({ words: head, text: join(head), boundary: true });
    rest = rest.slice(cut);
  }
  pieces.push({ words: rest, text: join(rest), boundary });
  return pieces;
}

/**
 * True when `word` closes a sentence. "?" and "!" always do. A period after dotted initials ("U.S.") or a known abbreviation
 * ("Dr.", "etc.") never does: "The U.S. economy grew." and "the U.S. Senate" stay whole. Joining "moved to the U.S. It was cold."
 * into one input is safer for the checker than cutting a claim from its subject; UtteranceEnd and the length cap still flush it.
 */
function terminal(word: AsrWord): boolean {
  if (!TERMINAL.test(word.text)) return false;
  const bare = word.text.replace(CLOSING, '');
  return !bare.endsWith('.') || !(INITIALS.test(bare) || ABBREVIATIONS.has(bare.toLowerCase()));
}

/** Sentences end at . ? ! (optionally followed by a closing quote or bracket), except after initials and abbreviations. */
function segment(words: AsrWord[], maxChars: number): Piece[] {
  const pieces: Piece[] = [];
  let current: AsrWord[] = [];
  for (const word of words) {
    current.push(word);
    if (terminal(word)) { pieces.push(...cap(current, true, maxChars)); current = []; }
  }
  if (current.length) pieces.push(...cap(current, false, maxChars));
  return pieces;
}

/**
 * Turns Deepgram interim and final results into one sentence at a time (live pipeline decision 2).
 *
 * - A punctuated sentence that is followed by more words and is unchanged in two consecutive interim
 *   results is emitted early (stable interim).
 * - Final (locked) chunks emit every punctuated sentence they contain.
 * - UtteranceEnd flushes whatever is left, punctuated or not.
 * - Run-on text is capped at ~300 characters, cut at the last comma or space.
 * - When a final chunk changes a sentence already emitted from interim results, the corrected text is
 *   emitted again under the same segmentId; the audio bridge turns that into a new revision.
 *
 * Pure and synchronous: no timers, no I/O, no logging.
 */
export class SentenceAssembler {
  private locked: AsrWord[] = [];
  private pending: Pending[] = [];
  private emittedUntil = -Infinity;
  private finalUntil = -Infinity;
  private previous = new Set<string>();
  private counter = 0;
  private readonly idPrefix: string;
  private readonly maxChars: number;

  constructor(private readonly emit: (event: AsrTranscript) => void, options: AssemblerOptions = {}) {
    this.idPrefix = options.idPrefix ?? 's';
    this.maxChars = options.maxChars ?? 300;
  }

  /** Interim words for the audio after the last final chunk. Replaces the previous interim result. */
  interim(words: AsrWord[]): void {
    const candidates = [...this.locked, ...words].filter(word => middle(word) >= this.emittedUntil);
    const pieces = segment(candidates, this.maxChars);
    const followed = pieces.slice(0, -1);
    let emitted = 0;
    for (const piece of followed) {
      if (!this.previous.has(piece.text)) break;
      const segmentId = this.send(piece.words, true);
      this.pending.push({ segmentId, text: piece.text, endTime: piece.words[piece.words.length - 1].end });
      emitted++;
    }
    this.previous = new Set(followed.slice(emitted).map(piece => piece.text));
    const caption = join(pieces.slice(emitted).flatMap(piece => piece.words));
    if (caption && length(caption) <= TRANSCRIPT_MAX_CODE_POINTS) {
      const words = pieces.slice(emitted).flatMap(piece => piece.words);
      this.emit({ text: caption, final: false, segmentId: this.nextId(), confidence: averageConfidence(words), captureOffsetMs: offsetMs(words), speaker: majoritySpeaker(words) });
    }
  }

  /** Words of a locked chunk; `chunkEnd` is the chunk's start plus duration in seconds. */
  final(words: AsrWord[], chunkEnd: number): void {
    this.locked.push(...words);
    this.finalUntil = Math.max(this.finalUntil, chunkEnd, ...words.map(word => word.end));
    this.confirm(false);
    if (this.pending.length) return;
    const pieces = segment(this.locked.filter(word => middle(word) >= this.emittedUntil), this.maxChars);
    for (const piece of pieces) if (piece.boundary) this.send(piece.words, true);
    const last = pieces[pieces.length - 1];
    this.locked = last && !last.boundary ? last.words : [];
  }

  /** Deepgram detected a pause after the last final word: emit everything that is left. */
  utteranceEnd(): void {
    this.confirm(true);
    const rest = this.locked.filter(word => middle(word) >= this.emittedUntil);
    for (const piece of segment(rest, this.maxChars)) this.send(piece.words, true);
    this.locked = [];
    this.previous.clear();
  }

  /**
   * Reconciles sentences emitted from interim results with the locked words that now cover them.
   * `force` (UtteranceEnd) settles every pending sentence, but only a final that reaches a sentence's end
   * may correct it: a final that stops mid-sentence would otherwise replace it with a truncated revision.
   */
  private confirm(force: boolean): void {
    while (this.pending.length) {
      const sentence = this.pending[0];
      const reached = this.finalUntil >= sentence.endTime;
      if (!force && !reached) return;
      const covered = this.locked.filter(word => middle(word) < sentence.endTime);
      this.locked = this.locked.filter(word => middle(word) >= sentence.endTime);
      const text = join(covered);
      if (reached && text && text !== sentence.text) this.send(covered, false, sentence.segmentId);
      this.pending.shift();
    }
  }

  private nextId(): string { return `${this.idPrefix}-${this.counter + 1}`; }

  private send(words: AsrWord[], advance: boolean, segmentId?: string): string {
    const id = segmentId ?? `${this.idPrefix}-${++this.counter}`;
    const text = join(words);
    if (advance) this.emittedUntil = Math.max(this.emittedUntil, words[words.length - 1].end);
    if (text && length(text) <= TRANSCRIPT_MAX_CODE_POINTS) {
      this.emit({ text, final: true, segmentId: id, confidence: averageConfidence(words), captureOffsetMs: offsetMs(words), speaker: majoritySpeaker(words) });
    }
    return id;
  }
}
