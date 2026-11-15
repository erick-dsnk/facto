import { describe, expect, it } from 'vitest';
import { type AsrTranscript } from '../../transport/audio.js';
import { MAX_LOW_CONFIDENCE_WORDS, lowConfidenceWordSchema } from '../../../../../packages/contracts/src/index.js';
import { LOW_CONFIDENCE_BELOW, SentenceAssembler, lowConfidenceWords, majoritySpeaker, type AsrWord } from './sentence-assembler.js';

/** Words 0.3 s apart from `start`, each 0.25 s long. */
function words(text: string, start = 0, speakers: (number | null)[] = [], confidence = 0.9): AsrWord[] {
  return text.split(' ').map((token, index) => ({ text: token, start: start + index * 0.3, end: start + index * 0.3 + 0.25, confidence, speaker: speakers[index] ?? null }));
}
const endOf = (list: AsrWord[]) => list[list.length - 1].end;
function setup(maxChars?: number) {
  const events: AsrTranscript[] = [];
  const assembler = new SentenceAssembler(event => events.push(event), { idPrefix: 'g1', maxChars });
  const finals = () => events.filter(event => event.final);
  return { assembler, events, finals };
}

describe('sentence assembler', () => {
  it('never ends a sentence after initials or an abbreviation, so a claim keeps its subject', () => {
    const { assembler, finals } = setup();
    const locked = words('The U.S. economy grew 3 percent. Dr. Smith agreed, e.g. on taxes. He moved to the U.S. It was cold.');
    assembler.final(locked, endOf(locked) + 0.1);
    expect(finals().map(event => event.text)).toEqual(['The U.S. economy grew 3 percent.', 'Dr. Smith agreed, e.g. on taxes.', 'He moved to the U.S. It was cold.']);
    const tail = words('She lives in the U.K.', 20);
    assembler.final(tail, endOf(tail) + 0.1);
    expect(finals()).toHaveLength(3);
    assembler.utteranceEnd();
    expect(finals().map(event => event.text).at(-1)).toBe('She lives in the U.K.');

    const early = setup();
    early.assembler.interim(words('Mr. Jones met the U.S. Senate. Then'));
    early.assembler.interim(words('Mr. Jones met the U.S. Senate. Then he'));
    expect(early.finals().map(event => event.text)).toEqual(['Mr. Jones met the U.S. Senate.']);
  });

  it('emits a punctuated sentence early once it is unchanged in two interim results and more words follow', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('The Eiffel Tower opened in 1889. It'));
    expect(finals()).toEqual([]);
    assembler.interim(words('The Eiffel Tower opened in 1889. It is'));
    expect(finals()).toEqual([{ text: 'The Eiffel Tower opened in 1889.', final: true, segmentId: 'g1-1', confidence: 0.9, captureOffsetMs: 0, endOffsetMs: 1750, speaker: null }]);
    const locked = words('The Eiffel Tower opened in 1889. It is tall.');
    assembler.final(locked, endOf(locked) + 0.1);
    expect(finals().map(event => [event.segmentId, event.text])).toEqual([['g1-1', 'The Eiffel Tower opened in 1889.'], ['g1-2', 'It is tall.']]);
  });

  it('waits when the punctuated sentence is the last thing heard or the interim text changed', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('Helsinki is in Finland.'));
    assembler.interim(words('Helsinki is in Finland.'));
    expect(finals()).toEqual([]);
    assembler.interim(words('In 1889. The'));
    assembler.interim(words('In 1889, the tower'));
    assembler.interim(words('In 1889, the tower opened. It'));
    expect(finals()).toEqual([]);
  });

  it('emits punctuated sentences from final chunks and keeps the unpunctuated rest for the next chunk', () => {
    const { assembler, finals } = setup();
    const first = words('Helsinki is the capital. Paris is');
    assembler.final(first, endOf(first));
    expect(finals().map(event => event.text)).toEqual(['Helsinki is the capital.']);
    const second = words('in France.', endOf(first) + 0.05);
    assembler.final(second, endOf(second));
    expect(finals().map(event => [event.segmentId, event.text, event.captureOffsetMs])).toEqual([['g1-1', 'Helsinki is the capital.', 0], ['g1-2', 'Paris is in France.', 1200]]);
  });

  it('re-emits a corrected sentence under the same segmentId when the final text differs', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('It was 70. Sorry'));
    assembler.interim(words('It was 70. Sorry it'));
    expect(finals().map(event => event.text)).toEqual(['It was 70.']);
    const locked = words('It was 17. Sorry it was 17.');
    locked[2] = { ...locked[2], confidence: 0.6 };
    assembler.final(locked, endOf(locked) + 0.1);
    expect(finals().map(event => [event.segmentId, event.text])).toEqual([['g1-1', 'It was 70.'], ['g1-1', 'It was 17.'], ['g1-2', 'Sorry it was 17.']]);
    expect(finals()[1].confidence).toBeCloseTo(0.8);
  });

  it('keeps an early sentence on UtteranceEnd when the finals stopped short of its end', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('Water boils at 100 degrees. At'));
    assembler.interim(words('Water boils at 100 degrees. At sea'));
    const partial = words('Water boils at').slice(0, 3);
    assembler.final(partial, endOf(partial));
    assembler.utteranceEnd();
    expect(finals().map(event => [event.segmentId, event.text])).toEqual([['g1-1', 'Water boils at 100 degrees.']]);
    const late = words('Water boils at 100 degrees. At sea level.').slice(3);
    assembler.final(late, endOf(late) + 0.1);
    assembler.utteranceEnd();
    expect(finals().map(event => [event.segmentId, event.text])).toEqual([['g1-1', 'Water boils at 100 degrees.'], ['g1-2', 'At sea level.']]);
  });

  it('confirms an early sentence only once a final chunk reaches its end', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('Water boils at 90 degrees. At'));
    assembler.interim(words('Water boils at 90 degrees. At sea'));
    const partial = words('Water boils at').slice(0, 3);
    assembler.final(partial, endOf(partial));
    expect(finals()).toHaveLength(1);
    const rest = words('Water boils at 100 degrees. At sea level.').slice(3);
    assembler.final(rest, endOf(rest) + 0.1);
    expect(finals().map(event => [event.segmentId, event.text])).toEqual([['g1-1', 'Water boils at 90 degrees.'], ['g1-1', 'Water boils at 100 degrees.'], ['g1-2', 'At sea level.']]);
  });

  it('flushes leftover unpunctuated text on UtteranceEnd', () => {
    const { assembler, finals } = setup();
    const locked = words('so the bridge is about two kilometres long');
    assembler.final(locked, endOf(locked));
    expect(finals()).toEqual([]);
    assembler.utteranceEnd();
    expect(finals().map(event => event.text)).toEqual(['so the bridge is about two kilometres long']);
    assembler.utteranceEnd();
    expect(finals()).toHaveLength(1);
  });

  it('caps run-on speech at the last comma that fits, or at a space', () => {
    const { assembler, finals } = setup(40);
    const locked = words('the first part goes on, and the second part keeps going and going without any stop at all');
    assembler.final(locked, endOf(locked));
    expect(finals().map(event => event.text)).toEqual(['the first part goes on,', 'and the second part keeps going and']);
    assembler.utteranceEnd();
    expect(finals().map(event => event.text)).toEqual(['the first part goes on,', 'and the second part keeps going and', 'going without any stop at all']);
    expect(finals().every(event => Array.from(event.text).length <= 40)).toBe(true);
    expect(new Set(finals().map(event => event.segmentId)).size).toBe(3);
  });

  it('caps at 300 characters by default', () => {
    const { assembler, finals } = setup();
    const locked = words(Array.from({ length: 80 }, (_, index) => `word${index}`).join(' '));
    assembler.final(locked, endOf(locked));
    assembler.utteranceEnd();
    expect(finals().length).toBeGreaterThan(1);
    expect(finals().every(event => Array.from(event.text).length <= 300)).toBe(true);
    expect(finals().map(event => event.text).join(' ')).toBe(locked.map(word => word.text).join(' '));
  });

  it('labels each sentence with the majority speaker, ties going to the first voice', () => {
    expect(majoritySpeaker(words('a b c', 0, [1, 1, 0]))).toBe(1);
    expect(majoritySpeaker(words('a b', 0, [0, 1]))).toBe(0);
    expect(majoritySpeaker(words('a b', 0, [null, 2]))).toBe(2);
    expect(majoritySpeaker(words('a b'))).toBeNull();
    const { assembler, finals } = setup();
    const locked = words('I think so. Helsinki is the capital.', 0, [0, 0, 0, 1, 1, 0, 1]);
    assembler.final(locked, endOf(locked));
    expect(finals().map(event => event.speaker)).toEqual([0, 1]);
  });

  it('sends interim captions as non-final transcripts that never reach the checker path', () => {
    const { assembler, events } = setup();
    assembler.interim(words('Helsinki is'));
    expect(events).toEqual([expect.objectContaining({ text: 'Helsinki is', final: false, segmentId: 'g1-1' })]);
    assembler.interim([]);
    expect(events).toHaveLength(1);
  });

  it('reports null confidence when the provider gives none', () => {
    const { assembler, finals } = setup();
    const locked = words('No scores here.').map(word => ({ ...word, confidence: null }));
    assembler.final(locked, endOf(locked));
    expect(finals()[0].confidence).toBeNull();
  });

  it('attaches the words below 0.75 confidence to a final sentence, in sentence order and without punctuation', () => {
    const { assembler, events, finals } = setup();
    const locked = words('You heard that on Tropical IPO for $2,500,000,000,000?');
    locked[3] = { ...locked[3], confidence: 0.42 };
    locked[4] = { ...locked[4], confidence: 0.38 };
    locked[7] = { ...locked[7], confidence: 0.7 };
    locked[0] = { ...locked[0], confidence: LOW_CONFIDENCE_BELOW };
    assembler.interim(locked);
    expect(events[0]).not.toHaveProperty('lowConfidenceWords');
    assembler.final(locked, endOf(locked) + 0.1);
    expect(finals()[0].lowConfidenceWords).toEqual([{ text: 'on', confidence: 0.42 }, { text: 'Tropical', confidence: 0.38 }, { text: '$2,500,000,000,000', confidence: 0.7 }]);
    expect(finals()[0].lowConfidenceWords!.every(word => lowConfidenceWordSchema.safeParse(word).success)).toBe(true);
  });

  it('omits low-confidence words when there are none or the provider gives no scores', () => {
    const { assembler, finals } = setup();
    assembler.final(words('Helsinki is the capital.'), 2);
    assembler.final(words('No scores here.', 3).map(word => ({ ...word, confidence: null })), 5);
    expect(finals()).toHaveLength(2);
    expect(finals().every(event => !('lowConfidenceWords' in event))).toBe(true);
  });

  it('keeps the 12 least confident words, still in sentence order, and leaves out overlong or bare punctuation', () => {
    const many = words(Array.from({ length: 20 }, (_, index) => `w${index}`).join(' ')).map((word, index) => ({ ...word, confidence: 0.5 + index * 0.01 }));
    many[19] = { ...many[19], confidence: 0.1 };
    const picked = lowConfidenceWords(many);
    expect(picked).toHaveLength(MAX_LOW_CONFIDENCE_WORDS);
    expect(picked.map(word => word.text)).toEqual([...Array.from({ length: 11 }, (_, index) => `w${index}`), 'w19']);
    const odd = words(`— ${'x'.repeat(65)} fine`).map(word => ({ ...word, confidence: 0.2 }));
    expect(lowConfidenceWords(odd)).toEqual([{ text: 'fine', confidence: 0.2 }]);
  });
});

describe('sentence assembler: speakers, echo and timing', () => {
  it('ends a sentence where the diarized speaker changes, so two people never share one claim', () => {
    const { assembler, finals } = setup();
    const locked = words('Lightning never strikes twice you have Moodle right', 0, [0, 0, 0, 0, 1, 1, 1, 1]);
    assembler.final(locked, endOf(locked));
    expect(finals().map(event => [event.text, event.speaker])).toEqual([['Lightning never strikes twice', 0]]);
    assembler.utteranceEnd();
    expect(finals().map(event => [event.text, event.speaker])).toEqual([['Lightning never strikes twice', 0], ['you have Moodle right', 1]]);
  });

  it('keeps one word labelled with another speaker inside its sentence, and words without a speaker do not break a run', () => {
    const { assembler, finals } = setup();
    const flip = words('Helsinki is the capital of Finland.', 0, [0, 0, 1, 0, 0, 0]);
    assembler.final(flip, endOf(flip));
    const gaps = words('So Paris is big and old.', 5, [0, null, 0, null, 1, 1]);
    assembler.final(gaps, endOf(gaps));
    expect(finals().map(event => event.text)).toEqual(['Helsinki is the capital of Finland.', 'So Paris is big', 'and old.']);
  });

  it('emits the first speaker early from interims once the second has said two words', () => {
    const { assembler, finals } = setup();
    assembler.interim(words('It was 70 sorry', 0, [0, 0, 0, 1]));
    assembler.interim(words('It was 70 sorry it', 0, [0, 0, 0, 1, 1]));
    expect(finals()).toEqual([]);
    assembler.interim(words('It was 70 sorry it was', 0, [0, 0, 0, 1, 1, 1]));
    expect(finals().map(event => [event.text, event.speaker])).toEqual([['It was 70', 0]]);
  });

  it('drops words that start before ignoreBefore, such as the tail of a spoken answer', () => {
    const events: AsrTranscript[] = [];
    const assembler = new SentenceAssembler(event => events.push(event), { idPrefix: 'g2', ignoreBefore: 0.8 });
    assembler.interim([...words('Australia.', 0.1), ...words('The', 0.9)]);
    expect(events.map(event => event.text)).toEqual(['The']);
    const locked = [...words('Australia.', 0.1), ...words('The Great Wall is long.', 0.9)];
    assembler.final(locked, endOf(locked));
    expect(events.filter(event => event.final).map(event => [event.text, event.captureOffsetMs])).toEqual([['The Great Wall is long.', 900]]);
  });

  it('reports where the last word ends, for the loudness gate', () => {
    const { assembler, finals, events } = setup();
    assembler.interim(words('Helsinki is', 1));
    expect(events[0]).toMatchObject({ captureOffsetMs: 1000, endOffsetMs: 1550 });
    const locked = words('Helsinki is cold.', 1);
    assembler.final(locked, endOf(locked));
    expect(finals()[0]).toMatchObject({ captureOffsetMs: 1000, endOffsetMs: 1850 });
  });
});

describe('sentence assembler: corrections at a commit boundary', () => {
  const timed = (list: [string, number, number, number][]): AsrWord[] => list.map(([text, start, end, speaker]) => ({ text, start, end, confidence: null, speaker }));
  const first = "Not Energy Drink, 'cause I can Google it and I can find the one with the Red Bull.";

  // Live 15 Nov 02:05:20-22. Interims emitted "…with the Red Bull." and "with electrolytes." early; the commit's timings put "Red"
  // inside the second sentence's span, which then read "with electrolytes. Red", and "Bull doesn't have electrolytes." stood alone.
  it('carries a word after a sentence end into the next sentence instead of leaving it on the corrected one', () => {
    const { assembler, finals } = setup();
    const spoken = words(first, 0, Array(18).fill(0));
    const next = (list: [string, number][]) => timed(list.map(([text, start]) => [text, start, start + 0.25, 1]));
    assembler.interim([...spoken, ...next([['with', 5.4]])]);
    assembler.interim([...spoken, ...next([['with', 5.4], ['electrolytes.', 5.7]])]);
    assembler.interim([...spoken, ...next([['with', 5.4], ['electrolytes.', 5.7], ['Red', 6.0]])]);
    assembler.interim([...spoken, ...next([['with', 5.4], ['electrolytes.', 5.7], ['Red', 6.0], ['Bull', 6.3]])]);
    expect(finals().map(event => [event.segmentId, event.text, event.speaker])).toEqual([['g1-1', first, 0], ['g1-2', 'with electrolytes.', 1]]);

    const committed = words("Not Energy Drink, 'cause I can Google it and I can find the one", 0, Array(14).fill(0)).map(word => ({ ...word, start: word.start * 0.95, end: word.end * 0.95 }));
    assembler.final([...committed, ...timed([['with', 5.3, 5.5, 1], ['electrolytes.', 5.5, 5.8, 1], ['Red', 5.8, 5.9, 1]])], 5.9);
    assembler.final(timed([['Bull', 6.0, 6.3, 1], ["doesn't", 6.4, 6.7, 1], ['have', 6.8, 7.0, 1], ['electrolytes.', 7.1, 7.5, 1]]), 7.5);
    expect(finals().map(event => [event.segmentId, event.text, event.speaker])).toEqual([
      ['g1-1', first, 0], ['g1-2', 'with electrolytes.', 1],
      ['g1-1', "Not Energy Drink, 'cause I can Google it and I can find the one", 0],
      ['g1-3', "Red Bull doesn't have electrolytes.", 1]]);
  });
});
