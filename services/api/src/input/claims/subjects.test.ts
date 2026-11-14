import { describe, expect, it } from 'vitest';
import { codePoints, type TextInput } from '../../../../../packages/contracts/src/index.js';
import { namedEntities, sourceNameCandidates, subjectCandidates } from './subjects.js';

function input(text: string, context: string[] = [], mode: TextInput['mode'] = 'typed'): TextInput {
  return { schemaVersion: 1, requestId: 'request-1', sessionId: 'session-1', sessionEpoch: 1, revision: 1, mode, text, language: 'en', capturedAt: '2026-11-14T12:00:00Z',
    capture: { source: mode === 'ocr' ? 'phone_camera' : mode === 'audio' ? 'glasses_stream_audio' : 'typed_fixture', segmentId: 'segment-1', confidence: null }, context, userInitiated: true };
}
const spanOf = (text: string, part: string) => {
  const start = codePoints(text.slice(0, text.indexOf(part))).length;
  return { start, end: start + codePoints(part).length };
};

describe('named entities', () => {
  it.each([
    ['Albert Einstein is best known for relativity.', ['Albert Einstein']],
    ['The Eiffel Tower is in Paris.', ['Eiffel Tower', 'Paris']],
    ['The Great Wall of China is visible from space.', ['Great Wall of China']],
    ['The New York Times reported that Apple bought a startup.', ['New York Times', 'Apple']],
    ['Robert Falcon Scott reached the South Pole in 1912. Scott died on the way back.', ['Robert Falcon Scott', 'South Pole']],
  ])('finds people, places and organizations in order: %s', (text, names) => {
    expect(namedEntities(text)).toEqual(names);
  });

  it('knows the demo organizations compromise lacks', () => {
    expect(namedEntities('Anthropic will IPO at a 2.5 trillion dollar valuation.')).toEqual(['Anthropic']);
    expect(namedEntities('Nvidia and OpenAI signed a deal with Meta in New York.')).toEqual(['Nvidia', 'OpenAI', 'Meta', 'New York']);
    expect(namedEntities('Facto runs on Ray-Ban glasses.')).toEqual(['Facto', 'Ray-Ban']);
    expect(namedEntities('A meta analysis of facto studies.')).toEqual([]);
  });

  it('strips trailing punctuation and possessives, and splits at commas', () => {
    expect(namedEntities("Jensen Huang's fourth affair.")).toEqual(['Jensen Huang']);
    expect(namedEntities('I heard that Jensen Huang’s company Nvidia is worth more.')).toEqual(['Jensen Huang', 'Nvidia']);
    expect(namedEntities('According to NASA, the Moon is shrinking.')).toEqual(['NASA', 'Moon']);
    expect(namedEntities('Did you see the news about Anthropic?')).toEqual(['Anthropic']);
  });

  it('keeps an unknown capitalized first word but not a common one', () => {
    expect(namedEntities('Kushner said the talks failed.')).toEqual(['Kushner']);
    expect(namedEntities('Water boils at 100 degrees. Bats are blind. Electric cars will win.')).toEqual([]);
  });

  it('reads shouted OCR headings and returns them as written', () => {
    expect(namedEntities('EIFFEL TOWER, Paris.')).toEqual(['EIFFEL TOWER', 'Paris']);
  });

  it('merges a shorter name into a longer one', () => {
    expect(namedEntities('Einstein worked in Bern. Albert Einstein moved to Princeton.')).toEqual(['Albert Einstein', 'Bern', 'Princeton']);
  });
});

describe('subject candidates', () => {
  it('offers context names nearest first, line by line and within a line, without speaker labels', () => {
    const text = 'It opened in 1889.';
    const candidates = subjectCandidates(input(text, ['Speaker 1: The Eiffel Tower is in Paris.', 'Speaker 2: Gustave Eiffel built it for a world fair.'], 'audio'), spanOf(text, text));
    expect(candidates).toEqual(['Gustave Eiffel', 'Paris', 'Eiffel Tower']);
    expect(candidates.some(name => name.includes('Speaker'))).toBe(false);
  });

  it('leaves out names the candidate already contains', () => {
    const text = 'Albert Einstein was born in Ulm.';
    expect(subjectCandidates(input(text, ['Albert Einstein and Niels Bohr argued about physics.']), spanOf(text, text))).toEqual(['Niels Bohr']);
  });

  it('offers the rest of an OCR photo in reading order, and earlier sentences of spoken or typed input', () => {
    const photo = 'EIFFEL TOWER, Paris. It opened in 1889. Built by Gustave Eiffel.';
    expect(subjectCandidates(input(photo, [], 'ocr'), spanOf(photo, 'It opened in 1889.'))).toEqual(['EIFFEL TOWER', 'Paris', 'Gustave Eiffel']);
    const typed = 'The Eiffel Tower is in Paris. It opened in 1889. Gustave Eiffel built it.';
    expect(subjectCandidates(input(typed), spanOf(typed, 'It opened in 1889.'))).toEqual(['Paris', 'Eiffel Tower']);
  });

  it('returns nothing without names and honours the limit', () => {
    expect(subjectCandidates(input('It opened in 1889.'), { start: 0, end: 18 })).toEqual([]);
    const context = ['Helsinki, Oslo, Stockholm, Copenhagen, Reykjavik, Tallinn, Riga, Vilnius, Warsaw and Berlin are capitals.'];
    expect(subjectCandidates(input('It is big.', context), { start: 0, end: 10 })).toHaveLength(8);
    expect(subjectCandidates(input('It is big.', context), { start: 0, end: 10 }, 3)).toHaveLength(3);
  });
});

describe('source name candidates', () => {
  it('puts X from a leading "According to X," first', () => {
    expect(sourceNameCandidates('According to NASA, the Moon is shrinking.')).toEqual(['NASA', 'Moon']);
    expect(sourceNameCandidates('According to the World Health Organization, measles is rising in Europe.')).toEqual(['World Health Organization', 'Europe']);
    expect(sourceNameCandidates('According to experts, coffee is healthy.')).toEqual(['experts']);
  });

  it('offers the names inside the candidate otherwise, up to the limit', () => {
    expect(sourceNameCandidates('Kushner said the talks failed.')).toEqual(['Kushner']);
    expect(sourceNameCandidates('Goldfish only remember three seconds.')).toEqual(['Goldfish']);
    expect(sourceNameCandidates('the sky is blue.')).toEqual([]);
    expect(sourceNameCandidates('Helsinki, Oslo, Stockholm, Copenhagen, Reykjavik, Tallinn and Riga are capitals.')).toHaveLength(6);
  });
});
