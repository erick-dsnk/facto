import { describe, expect, it } from 'vitest';
import { SentenceStitcher, looksUnfinished, type Sentence } from './stitch.js';

/** A final sentence as the server sees it; `at` is its capture time in ms. */
const said = (id: string, text: string, at: number, speaker: number | null = 0): Sentence => ({ requestId: `r-${id}`, segmentId: `g1-${id}`, text, speaker, atMs: at });

describe('looks unfinished', () => {
  it.each(['Crocodiles are, uh,', 'Uh Uh...', 'The tower is in the', 'I think that…', 'It was, um', 'Paris and'])('trails off: %s', text => { expect(looksUnfinished(text)).toBe(true); });
  it.each(['From the family of zebras.', 'The Great Wall of China', 'Jensen Huang said Nvidia was founded in 1993', 'And so on.', 'Is it true?'])('reads as finished: %s', text => {
    expect(looksUnfinished(text)).toBe(false);
  });
});

describe('sentence stitcher', () => {
  // Live 15 Nov 02:01:39-43, speaker 0: one claim arrived as three sentences and each was skipped.
  it('joins a hesitation-split claim within the window, drops the fillers and checks it once under the first fragment', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'Crocodiles are, uh,', 39_000))).toMatchObject({ action: 'hold', requestId: 'r-1' });
    expect(stitcher.add(said('2', 'Uh Uh...', 40_000))).toMatchObject({ action: 'hold', requestId: 'r-1' });
    expect(stitcher.add(said('3', 'From the family of zebras.', 43_000))).toEqual({
      action: 'check', requestId: 'r-1', segmentId: 'g1-1', text: 'Crocodiles are from the family of zebras.', speaker: 0, atMs: 39_000 });
    // A correction of the last fragment re-checks the stitched claim, never the fragment alone.
    expect(stitcher.add(said('3', 'From the family of horses.', 43_000))).toMatchObject({ action: 'check', requestId: 'r-1', text: 'Crocodiles are from the family of horses.' });
  });

  // PR #75 review: a claim that opens with a camel-case name was held forever as a "lowercase continuation".
  it.each(['iPhone sales doubled last year.', 'eBay was founded in 1995.', 'iOS 26 shipped in September.'])('checks a sentence that opens with a camel-case name: %s', text => {
    expect(new SentenceStitcher(4000).add(said('1', text, 10_000))).toMatchObject({ action: 'check', requestId: 'r-1', text });
  });

  // Live 15 Nov 09:09:39: the recogniser kept a cut-off "in-" before a claim, so it read as a lowercase continuation and was never checked.
  it('drops a cut-off false start, so the claim behind it is checked', () => {
    expect(new SentenceStitcher(4000).add(said('1', 'in- Uh, Cyberpunk 2077 was released in, uh, 2000.', 10_000)))
      .toMatchObject({ action: 'check', requestId: 'r-1', text: 'Cyberpunk 2077 was released in, 2000.' });
    expect(new SentenceStitcher(4000).add(said('1', 'and- so- The Moon is made of cheese.', 10_000))).toMatchObject({ action: 'check', text: 'The Moon is made of cheese.' });
    // Live 15 Nov 09:20:36: a filler before the false start, and the restarted word in lowercase.
    expect(new SentenceStitcher(4000).add(said('1', 'Uh, hu- humans only use 10% of their brains.', 10_000)))
      .toMatchObject({ action: 'check', text: 'Humans only use 10% of their brains.' });
    // A filler alone is no false start: a lowercase sentence still waits as a continuation.
    expect(new SentenceStitcher(4000).add(said('1', 'Uh, the tower is in Berlin.', 10_000)).action).toBe('hold');
    expect(new SentenceStitcher(4000).add(said('1', 'Self-driving cars never crash.', 10_000))).toMatchObject({ action: 'check', text: 'Self-driving cars never crash.' });
    expect(new SentenceStitcher(4000).add(said('1', 'from the family of zebras.', 10_000)).action).toBe('hold');
  });

  it('checks a trailing-off sentence on its own once nothing continues it within the window, and only once', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'The Eiffel Tower is in Berlin,', 10_000)).action).toBe('hold');
    expect(stitcher.release(13_999)).toEqual([]);
    expect(stitcher.release(14_000)).toEqual([{ action: 'check', requestId: 'r-1', segmentId: 'g1-1', text: 'The Eiffel Tower is in Berlin', speaker: 0, atMs: 10_000 }]);
    expect(stitcher.release(20_000)).toEqual([]);
  });

  it('keeps a released chain, so a slow continuation still joins it and re-checks the whole claim', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'The Eiffel Tower is in Berlin,', 10_000)).action).toBe('hold');
    expect(stitcher.release(15_000)).toMatchObject([{ requestId: 'r-1', text: 'The Eiffel Tower is in Berlin' }]);
    expect(stitcher.add(said('2', 'which is in Germany.', 13_500))).toMatchObject({ action: 'check', requestId: 'r-1', text: 'The Eiffel Tower is in Berlin which is in Germany.' });
  });

  it('never releases a headless continuation or a stitched claim that was already checked', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'from the family of zebras.', 10_000)).action).toBe('hold');
    expect(stitcher.add(said('2', 'Crocodiles are, uh,', 20_000)).action).toBe('hold');
    expect(stitcher.add(said('3', 'From the family of zebras.', 21_000)).action).toBe('check');
    expect(stitcher.release(40_000)).toEqual([]);
  });

  it('does not join after the window, so the late continuation stands alone and the fragment is never checked', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'Crocodiles are, uh,', 39_000)).action).toBe('hold');
    expect(stitcher.add(said('2', 'From the family of zebras.', 43_001))).toMatchObject({ action: 'check', requestId: 'r-2', text: 'From the family of zebras.' });
  });

  it('joins a sentence that continues a finished-looking one, as a revision of the first: "The Great Wall of China… is visible from space"', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'The Great Wall of China', 10_000))).toMatchObject({ action: 'check', requestId: 'r-1', text: 'The Great Wall of China' });
    expect(stitcher.add(said('2', 'Is visible from space.', 12_500))).toMatchObject({ action: 'check', requestId: 'r-1', text: 'The Great Wall of China is visible from space.' });
  });

  it('never joins two speakers, a question, or an ordinary next sentence', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', 'We went to the', 0, 0)).action).toBe('hold');
    expect(stitcher.add(said('2', 'Market is closed today.', 1000, 1))).toMatchObject({ action: 'check', requestId: 'r-2' });
    expect(stitcher.add(said('3', 'Paris is in France.', 2000, 1))).toMatchObject({ action: 'check', requestId: 'r-3' });
    expect(stitcher.add(said('4', 'Is it true that bats are blind?', 3000, 1))).toMatchObject({ action: 'check', requestId: 'r-4', text: 'Is it true that bats are blind?' });
    expect(stitcher.add(said('5', 'The Moon is made of rock.', 4000, 1))).toMatchObject({ action: 'check', requestId: 'r-5' });
    expect(stitcher.add(said('6', 'Uh, um.', 4500, 1))).toEqual({ action: 'skip' });
  });

  // Live 15 Nov 02:05:20-22: a commit boundary split a sentence, the correction cut it short, and the fragment was spoken as False.
  it('holds a sentence a correction cut short, cancels the check of its earlier version, and never checks a lowercase fragment', () => {
    const stitcher = new SentenceStitcher(4000);
    expect(stitcher.add(said('1', "Not Energy Drink, 'cause I can Google it and I can find the one with the Red Bull.", 20_000, 0)))
      .toMatchObject({ action: 'check', requestId: 'r-1' });
    expect(stitcher.add(said('2', 'with electrolytes.', 21_000, 1))).toMatchObject({ action: 'hold', requestId: 'r-2' });
    expect(stitcher.add(said('1', "Not Energy Drink, 'cause I can Google it and I can find the one", 20_000, 0)))
      .toEqual({ action: 'hold', requestId: 'r-1', segmentId: 'g1-1', text: "Not Energy Drink, 'cause I can Google it and I can find the one", speaker: 0, atMs: 20_000, cancel: 'r-1' });
    expect(stitcher.add(said('2', 'with electrolytes. Red', 21_000, 1))).toMatchObject({ action: 'hold', requestId: 'r-2' });
    expect(stitcher.add(said('3', "Bull doesn't have electrolytes.", 22_000, 1))).toMatchObject({ action: 'hold', requestId: 'r-2' });
    // With the assembler carrying "Red" into the next sentence, the same moment yields one checkable sentence.
    const fixed = new SentenceStitcher(4000);
    fixed.add(said('2', 'with electrolytes.', 21_000, 1));
    expect(fixed.add(said('3', "Red Bull doesn't have electrolytes.", 22_000, 1))).toMatchObject({ action: 'check', requestId: 'r-3', text: "Red Bull doesn't have electrolytes." });
  });

  it('joins nothing across an interruption or with a window of 0, and still never checks a fragment', () => {
    const stitcher = new SentenceStitcher(4000);
    stitcher.add(said('1', 'Crocodiles are, uh,', 0));
    stitcher.interrupt();
    expect(stitcher.add(said('2', 'From the family of zebras.', 1000))).toMatchObject({ action: 'check', requestId: 'r-2' });
    const off = new SentenceStitcher(0);
    expect(off.add(said('1', 'Crocodiles are, uh,', 0)).action).toBe('hold');
    expect(off.add(said('2', 'From the family of zebras.', 1000))).toMatchObject({ action: 'check', requestId: 'r-2' });
  });
});
