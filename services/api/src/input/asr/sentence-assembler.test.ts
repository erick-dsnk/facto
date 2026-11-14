import { describe, expect, it } from 'vitest';
import { type AsrTranscript } from '../../transport/audio.js';
import { SentenceAssembler, majoritySpeaker, type AsrWord } from './sentence-assembler.js';

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
    expect(finals()).toEqual([{ text: 'The Eiffel Tower opened in 1889.', final: true, segmentId: 'g1-1', confidence: 0.9, captureOffsetMs: 0, speaker: null }]);
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
});
