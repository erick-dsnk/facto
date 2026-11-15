import { describe, expect, it } from 'vitest';
import { TranscriptContext, formatContextLine, isVoiceTrigger, normalizeUtterance } from './transcript-context.js';

const t0 = Date.parse('2026-11-14T10:00:00Z');

describe('conversation context ring', () => {
  it('returns up to the two most recent earlier sentences, oldest first, with speaker labels', () => {
    const ring = new TranscriptContext();
    ring.record('a', 'First sentence.', 0, t0);
    ring.record('b', 'Second sentence.', null, t0 + 1000);
    ring.record('c', 'Third sentence.', 1, t0 + 2000);
    expect(ring.contextFor('d', t0 + 3000)).toEqual(['Second sentence.', 'Speaker 2: Third sentence.']);
    expect(formatContextLine('Hi.', 0)).toBe('Speaker 1: Hi.');
  });

  it('never includes the current sentence and updates a corrected sentence in place', () => {
    const ring = new TranscriptContext();
    ring.record('a', 'It was 70.', 0, t0);
    ring.record('b', 'Sorry, 17.', 0, t0 + 500);
    expect(ring.contextFor('b', t0 + 500)).toEqual(['Speaker 1: It was 70.']);
    ring.record('a', 'It was 17.', 0, t0);
    expect(ring.contextFor('c', t0 + 600)).toEqual(['Speaker 1: It was 17.', 'Speaker 1: Sorry, 17.']);
  });

  it('drops sentences older than 60 seconds', () => {
    const ring = new TranscriptContext();
    ring.record('a', 'Old sentence.', null, t0);
    ring.record('b', 'Recent sentence.', null, t0 + 30_000);
    expect(ring.contextFor('c', t0 + 60_000)).toEqual(['Old sentence.', 'Recent sentence.']);
    expect(ring.contextFor('c', t0 + 60_001)).toEqual(['Recent sentence.']);
    expect(ring.contextFor('c', t0 + 90_001)).toEqual([]);
  });

  it('keeps the combined context within 1,200 code points by dropping the oldest whole sentence', () => {
    const ring = new TranscriptContext();
    ring.record('a', '🙂'.repeat(500), null, t0);
    ring.record('b', 'b'.repeat(701), null, t0 + 1);
    expect(ring.contextFor('c', t0 + 2)).toEqual(['b'.repeat(701)]);
    ring.record('d', 'd'.repeat(499), null, t0 + 3);
    const context = ring.contextFor('e', t0 + 4);
    expect(context).toEqual(['b'.repeat(701), 'd'.repeat(499)]);
    expect(Array.from(context.join('')).length).toBe(1200);
  });

  it('forgets everything on clear', () => {
    const ring = new TranscriptContext();
    ring.record('a', 'Something.', 0, t0);
    ring.clear();
    expect(ring.contextFor('b', t0)).toEqual([]);
  });
});

describe('voice trigger', () => {
  it.each(['Check this.', 'Can you check this?', 'could you check this', 'Is this true?', 'Fact-check this!', 'fact check this', 'Hey, check this, please.', 'Okay, is this true?', 'Can you check this for me?', 'Check this one.', 'Can you check this photo for me?', 'Check this sign, please.'])('matches %s', text => {
    expect(isVoiceTrigger(text)).toBe(true);
  });
  it.each(['I need to check this report before Friday.', 'The Eiffel Tower opened in 1889, is this true?', 'Check this out.', 'Is this true for Finland?', 'Check this one about taxes.', 'This is true.', ''])('ignores %s', text => {
    expect(isVoiceTrigger(text)).toBe(false);
  });
  it.each(['Facto, can you check this?', 'hey facto check this', 'Facto is this true?', 'Hey Facto, check this.', 'HEY FACTO, FACT CHECK THIS!', 'Facto. Check this.',
    'Fact o, can you check this?', 'Fact-o, check this', 'Fakto, check this please', 'Okay Facto, is this true?', 'Facto, please check this photo.', 'factor check this', 'facto can you check this',
    // Live, 23:52:11 and 23:52:28: "Hey" heard as "Pay".
    'Pay Facto, can you check this?', 'A Facto, check this.', 'Hay Facto, is this true?'])('matches wake word %s', text => {
    expect(isVoiceTrigger(text)).toBe(true);
  });
  it.each(['Facto is a great app.', 'Hey Facto.', 'Facto', 'Facto, I need to check this report.', 'Facto, check this out.', 'Hey Facto, is this true for Finland?',
    'Factory, check this.', 'Facts, check this.', 'Factor in the cost, check this.', 'The factor is this true?',
    'Pay Facto.', 'Pay the facto check this.', 'I pay Facto, check this.'])('ignores wake word %s', text => {
    expect(isVoiceTrigger(text)).toBe(false);
  });
  it('normalizes punctuation, case, hyphens and spacing', () => {
    expect(normalizeUtterance('  FACT‑CHECK   this?! ')).toBe('fact check this');
  });
});
