import { codePoints } from '../../../../packages/contracts/src/index.js';

export const CONTEXT_WINDOW_MS = 60_000;
export const CONTEXT_MAX_ITEMS = 2;
export const CONTEXT_MAX_CODE_POINTS = 1200;
const RING_SIZE = 8;

type Sentence = { key: string; text: string; speaker: number | null; atMs: number };

/** Diarization indices are 0-based; people read "Speaker 1" for the first voice. */
export const formatContextLine = (text: string, speaker: number | null) => speaker === null ? text : `Speaker ${speaker + 1}: ${text}`;

/**
 * Per-session ring of recent final sentences, used to fill TextInput.context.
 * Holds text in memory only for the life of one audio session; cleared on stop and epoch change.
 */
export class TranscriptContext {
  private ring: Sentence[] = [];

  /** Up to two earlier sentences from the last 60 s, oldest first. Drops whole older sentences to stay within 1,200 code points. */
  contextFor(key: string, atMs: number): string[] {
    const lines: string[] = [];
    let total = 0;
    for (let index = this.ring.length - 1; index >= 0 && lines.length < CONTEXT_MAX_ITEMS; index--) {
      const sentence = this.ring[index];
      if (sentence.key === key) continue;
      if (atMs - sentence.atMs > CONTEXT_WINDOW_MS) break;
      const line = formatContextLine(sentence.text, sentence.speaker);
      const length = codePoints(line).length;
      if (total + length > CONTEXT_MAX_CODE_POINTS) break;
      lines.unshift(line);
      total += length;
    }
    return lines;
  }

  /** Adds a sentence, or updates it in place when a correction reuses the same key. */
  record(key: string, text: string, speaker: number | null, atMs: number): void {
    const existing = this.ring.find(sentence => sentence.key === key);
    if (existing) { existing.text = text; existing.speaker = speaker; return; }
    this.ring.push({ key, text, speaker, atMs });
    if (this.ring.length > RING_SIZE) this.ring.shift();
  }

  clear(): void { this.ring = []; }
}

export const VOICE_TRIGGER_PHRASES = ['check this', 'can you check this', 'could you check this', 'is this true', 'fact check this', 'factcheck this'];
const LEADING_FILLER = '(?:hey|ok|okay|um|uh|so|please|alright)';
// A short bounded tail ("check this one", "check this photo for me"); open-ended continuations stay claims.
const TRAILING_FILLER = '(?:please|now|for me|one|photo|picture|image|sign)';
// Optional app name before the command ("Facto, check this", "Hey Facto, is this true?"); "hey" comes from LEADING_FILLER.
// Deepgram writes the name as "Facto", "Facto." or "Fact o", which normalize to "facto" and "fact o".
// "Factor" and "Fakto" are accepted too, as likely mishearings (issue #44). The rest of the sentence must still be a
// trigger phrase, so they only count in front of a real command and add no new false triggers.
export const VOICE_WAKE_WORDS = ['facto', 'fact o', 'factor', 'fakto'];
// How Deepgram heard "Hey" right before the name on 14 Nov ("Pay Facto, can you check this?", "A Facto."). Accepted only
// directly in front of a wake word, so "Pay, check this" or "A factor" alone still isn't a command.
const WAKE_LEAD = '(?:pay|hay|hi|hei|a|eh|yo)';
const triggerPattern = new RegExp(`^(?:${LEADING_FILLER} )*(?:(?:${WAKE_LEAD} )?(?:${VOICE_WAKE_WORDS.join('|')}) (?:${LEADING_FILLER} )*)?`
  + `(?:${VOICE_TRIGGER_PHRASES.join('|')})(?: ${TRAILING_FILLER})*$`);

/** Lowercase, hyphens to spaces, punctuation removed, whitespace collapsed. */
export const normalizeUtterance = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[-‐-―]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

/**
 * True when the whole sentence is a "check this" command, optionally wrapped in filler words, led by the wake word "Facto",
 * or followed by a short object word.
 * A claim that merely contains the phrase ("I need to check this report", "Facto is a great app") is not a trigger.
 */
export const isVoiceTrigger = (text: string) => triggerPattern.test(normalizeUtterance(text));
