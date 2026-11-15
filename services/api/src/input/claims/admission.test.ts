import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { codePoints, sliceSpan, textInputSchema, type ClaimRoute, type ProviderContext, type SelectionKind, type TextInput } from '../../../../../packages/contracts/src/index.js';
import { ADMISSION_THRESHOLDS, createClassifier, decideKind, decideRoute } from '../../providers/jev/classification.js';
import { createJevClient, type JevAnswer, type JevClient, type JevRequest, validateAnswers } from '../../providers/jev/client.js';
import { containsContactData, deterministicIssue, generateCandidates } from './spans.js';

const NOW = Date.parse('2026-11-14T12:00:00Z');
function input(text: string, userInitiated = false, overrides: Partial<TextInput> = {}): TextInput {
  return { schemaVersion: 1, requestId: 'request-1', sessionId: 'session-1', sessionEpoch: 1, revision: 1, mode: 'typed', text, language: 'en', capturedAt: '2026-11-14T12:00:00Z', capture: { source: 'typed_fixture', segmentId: 'segment-1', confidence: null }, context: [], userInitiated, ...overrides };
}
const heard = (text: string, userInitiated = false, overrides: Partial<TextInput> = {}): TextInput =>
  input(text, userInitiated, { mode: 'audio', capture: { source: 'glasses_stream_audio', segmentId: 'segment-1', confidence: 0.9, final: true }, ...overrides });
const context = (): ProviderContext => ({ signal: new AbortController().signal, consume: vi.fn(), now: () => NOW });

/** Scripted Jev answers for one candidate. A string picks that option at 0.97; a record sets probabilities, the rest share what is left. */
type Script = {
  kind?: SelectionKind | Partial<Record<SelectionKind, number>>; route?: ClaimRoute | Partial<Record<ClaimRoute, number>>;
  attribution?: 'none' | 'named_speaker' | 'named_outlet' | 'hearsay'; source?: string; subject?: string;
  private?: number | null; privateLife?: number | null; rumour?: number | null; future?: number | null; self?: number | null;
  practical?: number | null; scope?: number | null; structure?: 'one_coherent' | 'multiple_propositions' | 'unclear'; subjectPrivate?: number | null;
};
function distribution(criteria: Record<string, string>, wanted: string | Partial<Record<string, number>>): JevAnswer {
  const keys = Object.keys(criteria);
  const given: Partial<Record<string, number>> = typeof wanted === 'string' ? { [wanted]: 0.97 } : wanted;
  const rest = keys.filter(key => given[key] === undefined);
  const left = Math.max(0, 1 - Object.values(given).reduce((sum: number, p) => sum + (p ?? 0), 0));
  const probabilities = Object.fromEntries(keys.map(key => [key, given[key] ?? left / rest.length]));
  const choice = keys.reduce((best, key) => probabilities[key] > probabilities[best] ? key : best, keys[0]);
  return { choice, probabilities };
}
function jev(resolve: (text: string, id: string) => Script = () => ({}), misheard: number | null = 0.02): JevClient & { ask: ReturnType<typeof vi.fn> } {
  return { ask: vi.fn(async (request: JevRequest) => {
    const candidates = (request.state as { candidates: { id: string; text: string }[] }).candidates;
    const answers: Record<string, JevAnswer> = {};
    for (const [name, question] of Object.entries(request.questions)) {
      if (name === 'misheard') { answers[name] = { noul: misheard }; continue; }
      const [, id, field] = /^(span_\d+)_(.+)$/.exec(name)!;
      const candidate = candidates.find(entry => entry.id === id)!;
      const script = resolve(candidate.text, id);
      if (question.type === 'choice') {
        const byName = (value: string | undefined) => Object.entries(question.criteria).find(([key, label]) => key !== 'none' && label === value)?.[0] ?? 'none';
        const wanted = field === 'kind' ? script.kind ?? 'claim' : field === 'route' ? script.route ?? 'general' : field === 'attribution' ? script.attribution ?? 'none'
          : field === 'claim_structure' ? script.structure ?? 'one_coherent' : field === 'source' ? byName(script.source) : field === 'subject' ? byName(script.subject) : 'unexpected';
        answers[name] = distribution(question.criteria, wanted);
      } else {
        const value = { private_data: script.private, private_life: script.privateLife, rumour: script.rumour, future: script.future, self_contained: script.self,
          practical: script.practical, preserves_scope: script.scope, subject_private: script.subjectPrivate }[field];
        const defaults: Record<string, number | null> = { private_data: 0.01, private_life: 0.01, rumour: 0.01, future: 0.01, self_contained: 0.99, practical: null, preserves_scope: 0.99, subject_private: 0.01 };
        answers[name] = { noul: value === undefined ? defaults[field] : value };
      }
    }
    return answers;
  }) };
}
const classify = (client: JevClient, text: TextInput) => createClassifier(client)(text, context());
const requestOf = (client: ReturnType<typeof jev>) => client.ask.mock.calls[0][0] as JevRequest;
const fixture = textInputSchema.parse(JSON.parse(readFileSync(new URL('../../../../../packages/contracts/fixtures/text-audio-low-confidence.json', import.meta.url), 'utf8')));

describe('exact candidate spans', () => {
  it('preserves Unicode code-point offsets, amounts and negation without normalization', () => {
    const text = '🧑🏽 My salary is €4,000 and Water does not boil at 10°C.';
    const candidates = generateCandidates(text);
    expect(candidates.length).toBeLessThanOrEqual(4);
    for (const candidate of candidates) expect(Array.from(text).slice(candidate.span.start, candidate.span.end).join('')).toBe(candidate.text);
    expect(candidates.some(c => c.text === 'Water does not boil at 10°C.')).toBe(true);
  });

  it('never detaches a conditional or quoted proposition at a conjunction', () => {
    expect(generateCandidates('If pressure is low, water boils early and water is not always 100°C.')).toHaveLength(1);
    expect(generateCandidates('She said "Earth is flat and the Moon is cheese."')).toHaveLength(1);
    expect(generateCandidates('A fictional narrator says: “Mars is made of ice cream. Venus is made of cake. Mercury is made of candy.”')).toHaveLength(1);
    expect(generateCandidates('It is not true that antibiotics cure viruses and vaccines cause autism.')).toHaveLength(1);
    expect(generateCandidates('It is false that penicillin cures viral infections and the Moon is made of cheese.')).toHaveLength(1);
  });

  it.each([
    ['My salary is €4,000 AND Helsinki is the capital of Finland.', 'Helsinki is the capital of Finland.'],
    ['My salary is €4,000;Helsinki is the capital of Finland.', 'Helsinki is the capital of Finland.']
  ])('finds exact public subspans across formatting variants: %s', (text, expectedPublicSpan) => {
    const candidates = generateCandidates(text);
    expect(candidates.map(candidate => candidate.text)).toContain(expectedPublicSpan);
    for (const candidate of candidates) expect(Array.from(text).slice(candidate.span.start, candidate.span.end).join('')).toBe(candidate.text);
  });

  it('does not extract an unquoted middle sentence from a multi-sentence quotation', () => {
    const text = 'A fictional narrator says: “Mars is made of ice cream. Venus is made of cake. Mercury is made of candy.” Helsinki is in Finland.';
    expect(generateCandidates(text).map(candidate => candidate.text)).not.toContain('Venus is made of cake.');
    expect(generateCandidates(text).map(candidate => candidate.text)).toContain('Helsinki is in Finland.');
  });

  it.each([
    ['I heard that goldfish only remember three seconds.', 'goldfish only remember three seconds.'],
    ['I heard goldfish only remember three seconds.', 'goldfish only remember three seconds.'],
    ['You heard that Anthropic will IPO next year?', 'Anthropic will IPO next year'],
    ['People say that bats are blind.', 'bats are blind.'],
    ['They say lightning never strikes twice.', 'lightning never strikes twice.'],
    ['Apparently, the Great Wall is visible from space.', 'the Great Wall is visible from space.'],
    ['According to NASA, the Moon is shrinking.', 'the Moon is shrinking.'],
  ])('adds the exact content after a leading frame: %s', (text, content) => {
    const candidates = generateCandidates(text);
    const found = candidates.find(candidate => candidate.text === content);
    expect(found).toMatchObject({ contentOf: 'span_0' });
    expect(sliceSpan(text, found!.span)).toBe(content);
  });

  // Live transcripts from 14 Nov that admission skipped as not_a_claim: the claim was passed on as a question.
  it.each([
    ['Have you heard that Anthropic added to your company?', 'Anthropic added to your company'],
    ['You heard that Anthropic has a two year evaluation?', 'Anthropic has a two year evaluation'],
    ['Did you know that goldfish only remember three seconds?', 'goldfish only remember three seconds'],
    ['Did you know the Eiffel Tower opened in 1889?', 'the Eiffel Tower opened in 1889'],
    ['Did you hear Anthropic raised another round?', 'Anthropic raised another round'],
    ['Is it true that bats are blind?', 'bats are blind'],
    ['Isn’t it true that lightning never strikes twice?', 'lightning never strikes twice'],
    ['So have you guys heard that Anthropic has a two year evaluation?', 'Anthropic has a two year evaluation'],
    ['You know that the Great Wall is visible from space?', 'the Great Wall is visible from space'],
    // Live, 23:33:21: a casual opener before the frame.
    ['Bro, have you heard that deep just released OPUS 5.5?', 'deep just released OPUS 5.5'],
    ['Dude, did you know the Eiffel Tower opened in 1889?', 'the Eiffel Tower opened in 1889'],
  ])('adds the statement without its "?" for a claim passed on as a question: %s', (text, content) => {
    const found = generateCandidates(text).find(candidate => candidate.text === content);
    expect(found).toMatchObject({ contentOf: 'span_0', asked: true });
    expect(sliceSpan(text, found!.span)).toBe(content);
  });

  // More ways people pass a claim on in conversation (14 Nov): each yields the claim as its own candidate.
  it.each([
    ['Have you seen that Tesla stock doubled this week?', 'Tesla stock doubled this week', true, false],
    ['Did you read that coffee causes cancer?', 'coffee causes cancer', true, false],
    ['Did you guys see Apple bought Perplexity?', 'Apple bought Perplexity', true, false],
    ['Do you realise the moon is moving away from Earth?', 'the moon is moving away from Earth', true, false],
    ['Are you aware that bananas are radioactive?', 'bananas are radioactive', true, false],
    ['Can you believe Finland has more saunas than cars?', 'Finland has more saunas than cars', true, false],
    ['Isn’t it crazy that octopuses have three hearts?', 'octopuses have three hearts', true, false],
    ['Is it real that Opus 5.5 came out today?', 'Opus 5.5 came out today', true, false],
    ['Did they really announce that Meta is buying Snap?', 'Meta is buying Snap', true, false],
    ['Opus 5.5 came out today, right?', 'Opus 5.5 came out today', true, false],
    ['The Great Wall is visible from space, isn’t it?', 'The Great Wall is visible from space', true, false],
    ['Bro, have you heard that DeepSeek released a new model, right?', 'DeepSeek released a new model', true, false],
    ['I’m pretty sure the Eiffel Tower is in Berlin.', 'the Eiffel Tower is in Berlin.', false, true],
    ['I think Einstein failed math.', 'Einstein failed math.', false, true],
    ['I swear lightning never strikes the same place twice.', 'lightning never strikes the same place twice.', false, true],
    ['I read that Finland is the happiest country.', 'Finland is the happiest country.', false, false],
    ['I just saw that SpaceX caught the booster again.', 'SpaceX caught the booster again.', false, false],
    ['My dad told me that goldfish have a three second memory.', 'goldfish have a three second memory.', false, false],
    ['Rumour has it Apple is making a car.', 'Apple is making a car.', false, false],
    ['Turns out the Earth is flat.', 'the Earth is flat.', false, false],
    ['Supposedly, bulls hate the colour red.', 'bulls hate the colour red.', false, false],
    ['Studies show that coffee makes you live longer.', 'coffee makes you live longer.', false, false],
    ['Everyone knows that we only use 10% of our brains.', 'we only use 10% of our brains.', false, false],
  ])('adds the claim inside a conversational frame: %s', (text, content, asked, hedged) => {
    const found = generateCandidates(text).find(candidate => candidate.text === content);
    expect(found, `candidates: ${JSON.stringify(generateCandidates(text).map(candidate => candidate.text))}`).toBeDefined();
    expect(sliceSpan(text, found!.span)).toBe(content);
    expect(found!.asked === true).toBe(asked);
    expect(found!.hedged === true).toBe(hedged);
  });

  // Live 15 Nov 08:47: "I've heard this sentence…" was passed on as hearsay and alerted as Speculation.
  it.each(['But I\u2019ve heard this sentence so many times already.', 'I heard it on the news.', 'My dad told me so.', 'Have you seen this video of a cat?',
    'I read them all last year.'])('adds no frame content when an object follows the frame: %s', text => {
    expect(generateCandidates(text)).toHaveLength(1);
  });

  it.each(['Have you seen my keys?', 'Did you read about the merger?', 'Is it crazy?', 'Right?', 'Yeah, right?', 'I think so.', 'I’m pretty sure.',
    'My dad told me.', 'Turns out.', 'Did you see what happened?'])('adds no frame content to a frame with no claim: %s', text => {
    expect(generateCandidates(text)).toHaveLength(1);
  });

  it.each([
    ['Apparently Anthropic has a two year evaluation.', 'Anthropic has a two year evaluation.'],
    ['I heard that Anthropic has a two year evaluation.', 'Anthropic has a two year evaluation.'],
    ['Yeah, I heard that bulls get angry at the colour red.', 'bulls get angry at the colour red.'],
    ['I’ve heard that bats are blind.', 'bats are blind.'],
  ])('adds the content of a stated hearsay frame, spoken filler included, as a statement: %s', (text, content) => {
    const found = generateCandidates(text).find(candidate => candidate.text === content);
    expect(found).toMatchObject({ contentOf: 'span_0' });
    expect(found).not.toHaveProperty('asked');
  });

  it.each(['Why?', 'You know?', 'Did you know?', 'Have you heard?', 'Is it true?', 'Did you know what time it is?', 'Do you know where the station is?',
    'Have you heard about the merger?', 'Is it true if it rains?', 'Yeah.', 'Thank you.', 'Okay.', 'I don\'t heard the Anthropic.', 'Eight pack chicken.', 'A Facto.'])(
    'adds no frame content to a plain question, filler or a garbled fragment: %s', text => {
      expect(generateCandidates(text)).toHaveLength(1);
    });

  it('frames each sentence of a longer input and ignores a frame with nothing after it', () => {
    const text = 'The tower is tall. I heard that it opened in 1889.';
    const candidates = generateCandidates(text);
    const sentence = candidates.find(candidate => candidate.text === 'I heard that it opened in 1889.')!;
    expect(candidates.find(candidate => candidate.text === 'it opened in 1889.')).toMatchObject({ contentOf: sentence.id });
    expect(generateCandidates('According to NASA, yes.').some(candidate => candidate.contentOf)).toBe(false);
    expect(generateCandidates('Helsinki is the capital of Finland.').some(candidate => candidate.contentOf)).toBe(false);
  });
});

describe('contact and privacy backstops', () => {
  it.each(['Call me at +1 415 555 0100.', 'Ring (415) 555-0100 now', 'It is 415-555-0100', 'My number is 040 123 4567', 'Text +358401234567', 'Write to jane.doe@example.com',
    'Call 4155551234 now.', 'Her number is 555-1234.', 'Ring 555 1234.', 'Write to jane at example dot com', 'Mail jane (at) example [dot] org'])('finds contact data in %s', text => {
    expect(containsContactData(text)).toBe(true);
    expect(deterministicIssue(text)).toBe('private_data');
  });

  it.each(['Anthropic will IPO at $2,500,000,000,000.', 'It opened in 1889.', 'About 10 000 000 people live there.', 'The deadline is 2026-11-14.',
    'The vote was on 14.11.2026.', 'They won in 1999 2000 2001.', 'Pi is 3.14159.', 'Call 911.', 'Unemployment is 7%.', 'The book is ISBN 978-3-16-148410-0.',
    'Its number is 978-3-16-148410-0.', 'The war lasted 1914-1918.', 'Earth has 8000000000 people.', 'It cost $2500000000000.', 'The ratio is 123.4567.',
    'Investors looked at the dot com boom.', 'Look at that dot com bubble.'])('does not mistake %s for contact data', text => {
    expect(containsContactData(text)).toBe(false);
  });

  it('keeps only the privacy backstop: no incomplete or nonliteral regex vetoes', () => {
    expect(deterministicIssue('She said it was safe.')).toBeNull();
    expect(deterministicIssue('They have three children.')).toBeNull();
    expect(deterministicIssue('Imagine the Moon is cheese.')).toBeNull();
    expect(deterministicIssue('I think Earth is round.')).toBeNull();
    expect(deterministicIssue('My salary is €4,000.')).toBe('private_data');
    expect(deterministicIssue('I was diagnosed with asthma.')).toBe('private_data');
  });
});

describe('admission decisions', () => {
  it('A1: admits a claim at P(claim) 0.25 even when opinion is the top choice', async () => {
    const text = 'Goldfish only remember three seconds.';
    const result = await classify(jev(() => ({ kind: { claim: 0.25, opinion: 0.5 } })), input(text, true));
    expect(result).toMatchObject({ action: 'check', reasonCode: 'eligible_public_claim' });
    expect(result.claims.map(claim => claim.checkedText)).toEqual([text]);
    expect(await classify(jev(() => ({ kind: { claim: 0.19, opinion: 0.5 } })), input(text, true))).toMatchObject({ action: 'skip', reasonCode: 'not_a_claim', kind: 'opinion' });
  });

  it.each([true, false])('A2: turns away a confident opinion with its kind (asked=%s)', async asked => {
    const result = await classify(jev(() => ({ kind: 'opinion' })), input('Pineapple on pizza is wonderful.', asked));
    expect(result).toEqual({ action: 'skip', reasonCode: 'not_a_claim', claims: [], kind: 'opinion' });
  });

  it.each([['prediction', 'Something big will happen to me one day.'], ['question', 'Is Helsinki the capital of Finland?'], ['instruction', 'Check whether the Moon is shrinking.'], ['other', 'Hello there.']] as const)(
    'reports the whole input kind %s when nothing is a claim', async (kind, text) => {
      expect(await classify(jev(() => ({ kind })), input(text, true))).toMatchObject({ action: 'skip', reasonCode: 'not_a_claim', claims: [], kind });
    });

  it('A3: admits a private-life allegation as one claim that is never searched, whatever private_data says', async () => {
    const text = "Jensen Huang's fourth affair.";
    const result = await classify(jev(() => ({ kind: { claim: 0.3, other: 0.6 }, privateLife: 0.9, private: 0.9 })), input(text));
    expect(result.action).toBe('check');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({ checkedText: text, privateLife: true });
    const below = await classify(jev(() => ({ kind: { claim: 0.3, other: 0.6 }, privateLife: 0.39, private: 0.9 })), input(text, true));
    expect(below).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', kind: 'other' });
  });

  it.each([{}, { structure: 'multiple_propositions' as const }, { private: 0, privateLife: 0.9 }])('A4: never admits a span holding a phone number, whatever Jev says (%o)', async script => {
    const text = 'Call me at +1 415 555 0100, Helsinki is the capital of Finland.';
    const result = await classify(jev(() => script), input(text, true));
    expect(result.claims.some(claim => claim.checkedText.includes('415'))).toBe(false);
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', kind: 'other' });
  });

  it('A4: an email address vetoes the whole input but a separate public clause is still checked', async () => {
    const text = 'Write to jane.doe@example.com and Helsinki is the capital of Finland.';
    const result = await classify(jev((_text, id) => id === 'span_0' ? { structure: 'multiple_propositions' } : {}), input(text, true));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['Helsinki is the capital of Finland.']);
  });

  it('A5: offers names from the context and sets the subject Jev picks', async () => {
    const client = jev(() => ({ subject: 'Albert Einstein' }));
    const result = await classify(client, input('He was born in Ulm in 1879.', false, { context: ['Albert Einstein is best known for relativity.'] }));
    const question = requestOf(client).questions.span_0_subject;
    expect(question).toMatchObject({ type: 'choice', criteria: { none: expect.any(String), 1: 'Albert Einstein' } });
    expect(requestOf(client).questions.span_0_self_contained.instructions).toContain('span_0_subject');
    expect(result.claims[0]).toMatchObject({ checkedText: 'He was born in Ulm in 1879.', subject: 'Albert Einstein', subjectMissing: false });
  });

  it('A5: a picked subject completes the claim even when Jev answered completeness low on its own', async () => {
    const eiffel = (asked: boolean, subject?: string) => classify(jev(() => ({ subject, self: 0.2 })), input('It opened in 1889.', asked, { context: ['The Eiffel Tower is in Paris.'] }));
    expect((await eiffel(false, 'Eiffel Tower')).claims).toMatchObject([{ subject: 'Eiffel Tower', subjectMissing: false }]);
    expect(await eiffel(false)).toEqual({ action: 'skip', reasonCode: 'subject_missing', claims: [] });
    expect((await eiffel(true)).claims).toMatchObject([{ subject: null, subjectMissing: true }]);
  });

  it('A5: never makes a private person, or a name from a sensitive sentence of the same input, the subject', async () => {
    const neighbour = (subjectPrivate: number | null) => classify(jev(() => ({ subject: 'Dave Jones', subjectPrivate, self: 0.2 })), input('He moved to Berlin.', true, { context: ['Dave Jones lives next door.'] }));
    expect((await neighbour(0.9)).claims).toMatchObject([{ subject: null, subjectMissing: true }]);
    expect((await neighbour(null)).claims).toMatchObject([{ subject: null, subjectMissing: true }]);
    expect((await neighbour(0.1)).claims).toMatchObject([{ subject: 'Dave Jones', subjectMissing: false }]);
    // The first sentence is a private-life allegation: its name never travels with the second sentence to a search.
    const text = 'Dave Jones has cancer. He moved to Berlin.';
    const client = jev((candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions', privateLife: 0.9 }
      : candidate.startsWith('Dave') ? { privateLife: 0.9 } : { subject: 'Dave Jones', self: 0.2 });
    const result = await classify(client, input(text, true));
    expect(result.claims.find(claim => claim.checkedText === 'He moved to Berlin.')).toMatchObject({ subject: null, subjectMissing: true });
  });

  it('A6: a missing subject answers Can\'t verify when asked and stays silent when overheard', async () => {
    const client = jev(() => ({ self: 0.2 }));
    const asked = await classify(client, input('It opened in 1889.', true));
    expect(requestOf(client).questions.span_0_subject).toBeUndefined();
    expect(asked).toMatchObject({ action: 'check', claims: [{ checkedText: 'It opened in 1889.', subjectMissing: true, subject: null }] });
    expect(await classify(jev(() => ({ self: 0.2 })), input('It opened in 1889.'))).toEqual({ action: 'skip', reasonCode: 'subject_missing', claims: [] });
    expect(await classify(jev(() => ({ self: ADMISSION_THRESHOLDS.selfContained })), input('It opened in 1889.'))).toMatchObject({ action: 'check' });
  });

  it('A7: a photo offers names from the rest of its OCR text', async () => {
    const text = 'EIFFEL TOWER, Paris. It opened in 1889.';
    const client = jev((candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions' } : candidate.startsWith('It') ? { subject: 'EIFFEL TOWER' } : { kind: 'other' });
    const result = await classify(client, input(text, true, { mode: 'ocr', capture: { source: 'phone_camera', segmentId: 'photo-1', confidence: 0.95 } }));
    const ocrSubject = Object.entries(requestOf(client).questions).find(([name]) => name.endsWith('_subject') && (requestOf(client).state as { candidates: { id: string; text: string }[] }).candidates.find(c => name.startsWith(c.id + '_'))?.text === 'It opened in 1889.');
    expect(ocrSubject?.[1]).toMatchObject({ criteria: { 1: 'EIFFEL TOWER', 2: 'Paris' } });
    expect(result.claims).toMatchObject([{ checkedText: 'It opened in 1889.', subject: 'EIFFEL TOWER' }]);
  });

  it('A8: shows Jev the capture confidence and uncertain words, and holds a likely mishearing', async () => {
    const client = jev(() => ({}), 0.8);
    expect(await classify(client, { ...fixture, userInitiated: true })).toEqual({ action: 'needs_confirmation', reasonCode: 'possibly_misheard', claims: [] });
    expect(requestOf(client).state).toMatchObject({ capture_mode: 'audio', capture_confidence: 0.71, low_confidence_words: ['on (0.42)', 'Tropical (0.38)'] });
    expect(requestOf(client).questions.misheard).toMatchObject({ type: 'noul', instructions: expect.stringContaining('misheard in a way that changes the claim') });
    expect(await classify(jev(() => ({}), 0.8), fixture)).toEqual({ action: 'skip', reasonCode: 'possibly_misheard', claims: [] });
    const typed = jev();
    await classify(typed, input('Helsinki is the capital of Finland.'));
    expect(typed.ask).toHaveBeenCalledTimes(1);
    expect(requestOf(typed).questions.misheard).toBeUndefined();
    expect(requestOf(typed).state).not.toHaveProperty('low_confidence_words');
  });

  it('A9: an "According to X" claim checks the report; "X said" checks the statement only for recent events', async () => {
    const nasa = jev(() => ({ attribution: 'named_outlet', source: 'NASA' }));
    const reported = await classify(nasa, input('According to NASA, the Moon is shrinking.', true));
    expect(requestOf(nasa).questions.span_0_source).toMatchObject({ criteria: { 1: 'NASA', 2: 'Moon' } });
    expect(reported.claims).toMatchObject([{ checkedText: 'According to NASA, the Moon is shrinking.', attribution: { source: 'NASA', mode: 'reported' } }]);
    const said = (route: ClaimRoute) => classify(jev(() => ({ attribution: 'named_speaker', source: 'Kushner', route })), input('Kushner said the talks failed.', true));
    expect((await said('recent_event')).claims[0]).toMatchObject({ attribution: { source: 'Kushner', mode: 'said' }, route: 'recent_event' });
    expect((await said('general')).claims[0]).toMatchObject({ attribution: null, route: 'general' });
  });

  it('A9: a named outlet Jev cannot match to a listed name is checked for its content', async () => {
    const result = await classify(jev(() => ({ attribution: 'named_outlet' })), input('According to NASA, the Moon is shrinking.', true));
    expect(result.claims).toMatchObject([{ checkedText: 'the Moon is shrinking.', attribution: null }]);
  });

  it('A10: hearsay checks the content without its framing and keeps the rumour flag', async () => {
    const text = 'I heard that goldfish only remember three seconds.';
    const client = jev((_candidate, id) => id === 'span_0' ? { attribution: 'hearsay', rumour: 0.8 } : {});
    const result = await classify(client, input(text, true));
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({ checkedText: 'goldfish only remember three seconds.', attribution: null, rumour: true });
    expect(sliceSpan(text, result.claims[0].sourceSpan)).toBe('goldfish only remember three seconds.');
    expect(requestOf(client).questions.span_1_preserves_scope).toBeUndefined();
    const plain = await classify(jev(), input(text, true));
    expect(plain.claims.map(claim => claim.checkedText)).toEqual([text]);
  });

  // Live transcripts from 14 Nov. Jev called each whole sentence a question attributed to nobody, so nothing was checked.
  it.each([
    ['Have you heard that Anthropic added to your company?', 'Anthropic added to your company'],
    ['You heard that Anthropic has a two year evaluation?', 'Anthropic has a two year evaluation'],
    ['Is it true that bats are blind?', 'bats are blind'],
  ])('A10: checks an overheard claim passed on as a question as its statement: %s', async (text, content) => {
    for (const attribution of ['none', 'hearsay'] as const) {
      const client = jev((_candidate, id) => id === 'span_0' ? { kind: 'question', attribution, rumour: 0.7 } : {});
      const result = await classify(client, heard(text));
      expect(result).toMatchObject({ action: 'check', reasonCode: 'eligible_public_claim' });
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0]).toMatchObject({ checkedText: content, attribution: null, rumour: true });
      expect(sliceSpan(text, result.claims[0].sourceSpan)).toBe(content);
    }
  });

  it('A10: prefers the statement when Jev also calls the whole question a claim', async () => {
    const result = await classify(jev(), heard('Did you know that goldfish only remember three seconds?'));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['goldfish only remember three seconds']);
  });

  it('A10: a question-framed claim with a missing referent is skipped as subject_missing when overheard', async () => {
    const client = jev((_candidate, id) => id === 'span_0' ? { kind: 'question' } : { self: 0.2 });
    expect(await classify(client, heard('Have you heard that Anthropic added to your company?'))).toEqual({ action: 'skip', reasonCode: 'subject_missing', claims: [] });
  });

  // Live 15 Nov: overheard statistics about a group of people were skipped as subject_missing. Jev answered completeness 0.24-0.31
  // because the question said a statistic often lacks a location; with the group guidance it answered 0.88-0.94, and still 0.07 for
  // "Unemployment is 7%." These reach the checker like any statistic; the evidence decides what they misstate.
  it.each([
    ['Black people commit 70% of crime.', 'Black people commit 70% of crime.', 0.94],
    ['Is it true that African American people commit 70% of the crime despite being 13% of the population?', 'African American people commit 70% of the crime despite being 13% of the population', 0.91],
  ])('A16: an overheard statistic about a group of people reaches the checker: %s', async (text, checked, self) => {
    const client = jev(() => ({ self }));
    const result = await classify(client, heard(text));
    expect(result).toMatchObject({ action: 'check', reasonCode: 'eligible_public_claim' });
    expect(result.claims.map(claim => claim.checkedText)).toEqual([checked]);
    expect(result.claims[0]).toMatchObject({ subjectMissing: false, subject: null });
    const completeness = requestOf(client).questions.span_0_self_contained;
    expect(completeness.instructions).toContain('“Unemployment is 7%” lacks a location');
    expect(completeness.instructions).toContain('A statistic or share about a named group of people, such as “Immigrants commit 60% of crimes” or “Women earn 80% of what men earn”, names what it measures and is complete without a place or period');
    expect(completeness.instructions).toContain('A sensitive or offensive claim about a group is still complete when it names the group and the figure.');
    // What the old wording got from Jev: still skipped when Jev answers incomplete, so the fix is the question, not a rule.
    expect(await classify(jev(() => ({ self: 0.24 })), heard(text))).toEqual({ action: 'skip', reasonCode: 'subject_missing', claims: [] });
  });

  it('A17: skips overheard chatter in another language before Jev, and checks it when asked or photographed', async () => {
    for (const text of ['Hey, no estoy acá de nuevo.', 'Trebuie să dăm fix la o CR coaie…']) {
      const client = jev();
      expect(await classify(client, heard(text))).toEqual({ action: 'skip', reasonCode: 'not_english', claims: [] });
      expect(client.ask).not.toHaveBeenCalled();
      const asked = jev();
      expect(await classify(asked, heard(text, true))).toMatchObject({ action: 'check' });
      expect(asked.ask).toHaveBeenCalledTimes(1);
      expect(await classify(jev(), input(text, false, { mode: 'ocr', capture: { source: 'glasses_camera', segmentId: 'segment-1', confidence: 0.9, final: true } }))).toMatchObject({ action: 'check' });
    }
  });

  it('A10: a named source Jev matched keeps its frame even when the sentence ends with "?"', async () => {
    const text = 'According to NASA, the Moon is shrinking?';
    const result = await classify(jev(() => ({ attribution: 'named_outlet', source: 'NASA' })), input(text, true));
    expect(result.claims).toMatchObject([{ checkedText: text, attribution: { source: 'NASA', mode: 'reported' } }]);
  });

  it.each([['Why?', 'question'], ['You know?', 'question'], ['Yeah.', 'other'], ['Thank you.', 'other'], ['Okay.', 'other']] as const)(
    'A10: still skips an overheard plain question or filler as not a claim: %s', async (text, kind) => {
      const client = jev(() => ({ kind }));
      expect(await classify(client, heard(text))).toEqual({ action: 'skip', reasonCode: 'not_a_claim', claims: [], kind });
      expect((requestOf(client).state as { candidates: unknown[] }).candidates).toHaveLength(1);
    });

  it.each(['I don\'t heard the Anthropic.', 'Eight pack chicken.', 'A Facto.'])('A8: still holds an overheard garbled fragment Jev calls misheard: %s', async text => {
    expect(await classify(jev(() => ({ kind: 'other' }), 0.8), heard(text))).toEqual({ action: 'skip', reasonCode: 'possibly_misheard', claims: [] });
  });

  it('A11: routes by the top answer at 0.4 and demotes a recent event that names an earlier year', async () => {
    const route = async (text: string, script: Script['route']) => (await classify(jev(() => ({ route: script })), input(text, true))).claims[0].route;
    expect(await route('The minister resigned in 2019.', 'recent_event')).toBe('general');
    expect(await route('The minister resigned yesterday.', { recent_event: 0.35, general: 0.3 })).toBe('general');
    expect(await route('The minister resigned yesterday.', 'recent_event')).toBe('recent_event');
    expect(await route('The minister resigned in November 2026.', 'recent_event')).toBe('recent_event');
    expect(await route('Helsinki has 680,000 people.', { named_fact: 0.4 })).toBe('named_fact');
  });

  it('A13: a low capture confidence alone never holds a check', async () => {
    const result = await classify(jev(() => ({}), 0.1), heard('Helsinki is the capital of Finland.', false, { capture: { source: 'glasses_stream_audio', segmentId: 's', confidence: 0.3, final: true } }));
    expect(result.action).toBe('check');
  });

  it('A15: makes one Jev call per input and fails closed on a missing or null required answer', async () => {
    const client = jev(() => ({}));
    await classify(client, input('The Eiffel Tower opened in 1889. Helsinki is in Finland.', true));
    expect(client.ask).toHaveBeenCalledTimes(1);
    const missing = (name: string, value?: JevAnswer): JevClient => ({ ask: async (request, ctx) => {
      const answers = await jev().ask(request, ctx) as Record<string, JevAnswer>;
      if (value) answers[name] = value; else delete answers[name];
      return answers;
    } });
    await expect(classify(missing('span_0_kind'), input('Helsinki is the capital of Finland.'))).rejects.toMatchObject({ code: 'malformed_provider' });
    await expect(classify(missing('span_0_private_data', { noul: null }), input('Helsinki is the capital of Finland.'))).rejects.toMatchObject({ code: 'malformed_provider' });
    await expect(classify(missing('span_0_private_life', { noul: null }), input('Helsinki is the capital of Finland.'))).rejects.toMatchObject({ code: 'malformed_provider' });
    await expect(classify(missing('span_0_self_contained', { noul: null }), input('Helsinki is the capital of Finland.'))).rejects.toMatchObject({ code: 'malformed_provider' });
    // An unanswered mishearing question fails closed too, rather than reading as heard correctly.
    await expect(classify(jev(() => ({}), null), fixture)).rejects.toMatchObject({ code: 'malformed_provider' });
  });

  it('does not call Jev for an interim capture', async () => {
    const client = jev();
    const partial = heard('Water boils at 100 degrees.', false, { capture: { source: 'glasses_stream_audio', segmentId: 's', confidence: 0.9, final: false } });
    expect(await classify(client, partial)).toEqual({ action: 'wait', reasonCode: 'interim_capture', claims: [] });
    expect(await classify(client, { ...partial, userInitiated: true })).toMatchObject({ action: 'needs_confirmation', reasonCode: 'interim_capture' });
    expect(client.ask).not.toHaveBeenCalled();
  });

  it('sets the frame fields and admission metadata on an admitted claim', async () => {
    const result = await classify(jev(() => ({ future: 0.8, rumour: 0.6, practical: 0.7, route: 'named_fact' })), input('Anthropic will IPO at a 2.5 trillion dollar valuation.', true));
    expect(result).toMatchObject({ action: 'check', reasonCode: 'eligible_public_claim' });
    expect(result.claims[0]).toMatchObject({
      id: 'request-1-r1-span_0', sourceSpan: { start: 0, end: codePoints('Anthropic will IPO at a 2.5 trillion dollar valuation.').length },
      route: 'named_fact', subject: null, attribution: null, future: true, rumour: true, privateLife: false, subjectMissing: false,
      admission: { assertionStatus: 'asserted', hasPracticalConsequence: 0.7, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' }
    });
    const below = await classify(jev(() => ({ future: 0.49, rumour: 0.49 })), input('Anthropic will IPO next year.', true));
    expect(below.claims[0]).toMatchObject({ future: false, rumour: false, admission: { hasPracticalConsequence: null } });
  });

  it('no longer turns away pronoun-led, attributed or hypothetical sentences by regex', async () => {
    for (const text of ['She said it was safe.', 'They have three children.', 'Imagine that the Moon is made of cheese.']) {
      expect((await classify(jev(), input(text, true))).action).toBe('check');
    }
  });
});

describe('privacy vetoes', () => {
  it.each([[.099, 'check'], [.10, 'skip']] as const)('keeps strict privacy admission at %s for a named public-work proposition', async (privacy, action) => {
    const text = 'SYNTHETIC artist Asha Vale published Blue Sky in 1984.';
    const result = await classify(jev(() => ({ private: privacy })), input(text));
    expect(result.action).toBe(action);
    expect(result.claims.map(claim => claim.checkedText)).toEqual(action === 'check' ? [text] : []);
  });

  it('asks the reviewed public-record/privacy distinction on the exact candidate', async () => {
    const client = jev();
    await classify(client, input('SYNTHETIC artist Asha Vale published Blue Sky in 1984.'));
    const question = requestOf(client).questions.span_0_private_data;
    expect(question.type).toBe('noul');
    expect(question.instructions).toMatch(/^Assess ONLY candidates\[0\]\.text \(span_0\)\./);
    expect(question.instructions.endsWith("When privacy status is uncertain, do not infer safety from fame or apparent searchability.")).toBe(true);
  });

  it.each([
    'SYNTHETIC famous actor Asha Vale lives at home address 17 Imaginary Lane.',
    'SYNTHETIC famous actor Asha Vale has a personal account balance of 1200 units.',
  ])('keeps sensitive public-figure information out of search: %s', async text => {
    expect(await classify(jev(() => ({ private: .99 })), input(text, true))).toEqual({ action: 'skip', reasonCode: 'private_or_personal', claims: [], kind: 'other' });
  });

  it('does not admit private text even if Jev calls it public', async () => {
    expect(await classify(jev(), input('My salary is €4,000.'))).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', claims: [] });
  });

  it('exports only the exact independent public span from private mixed input', async () => {
    const text = 'My salary is €4,000 and Helsinki is the capital of Finland.';
    const client = jev((candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions', private: 0.99 } : candidate.includes('salary') ? { private: 0.99 } : {});
    const result = await classify(client, input(text));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['Helsinki is the capital of Finland.']);
    expect(client.ask).toHaveBeenCalledTimes(1);
  });

  it('a contained private clause vetoes a whole that Jev calls one proposition', async () => {
    const text = 'I earn €4,000 and the Eiffel Tower opened in 1889.';
    const result = await classify(jev(candidate => candidate === 'I earn €4,000' ? { private: 0.99 } : {}), input(text));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['the Eiffel Tower opened in 1889.']);
  });

  it('requires a split subspan to preserve the scope of what surrounds it', async () => {
    const text = 'My salary is €4,000 and Helsinki is the capital of Finland.';
    const result = await classify(jev(candidate => candidate.includes('Helsinki') && !candidate.includes('salary') ? { scope: 0.84 } : { private: 0.99, structure: 'multiple_propositions' }), input(text));
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', claims: [] });
  });

  it('a personal experience Jev calls a claim is private, not a claim to search', async () => {
    expect(await classify(jev(() => ({ private: 0.9 })), input('I felt sick yesterday.', true))).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', kind: 'other' });
  });
});

describe('splitting', () => {
  it('checks a one-proposition whole as said, without splitting it', async () => {
    const text = 'The Eiffel Tower opened in 1889 and it is in Paris.';
    const result = await classify(jev(), input(text, true));
    expect(result.claims.map(claim => claim.checkedText)).toEqual([text]);
  });

  it('uses complete exact sentence claims when Jev sees several propositions', async () => {
    const text = 'The Eiffel Tower opened in 1889. The Moon is made of cheese.';
    const result = await classify(jev((_candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions' } : {}), input(text));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['The Eiffel Tower opened in 1889.', 'The Moon is made of cheese.']);
  });

  it('checks only the claim beside an opinion', async () => {
    const text = 'I prefer coffee to tea. The Eiffel Tower opened in 1889.';
    const result = await classify(jev((candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions' } : candidate.includes('coffee') ? { kind: 'opinion' } : {}), input(text, true));
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['The Eiffel Tower opened in 1889.']);
  });

  it('checks several propositions as said when no part can stand alone', async () => {
    const text = 'The novel “Dune” was written by Frank Herbert and the film “Titanic” was directed by James Cameron.';
    const result = await classify(jev(() => ({ structure: 'multiple_propositions' })), input(text, true));
    expect(result.claims.map(claim => claim.checkedText)).toEqual([text]);
  });

  it('limits selected claims to two non-overlapping spans', async () => {
    const text = 'I felt tired. Helsinki is in Finland. Oslo is in Norway. Paris is in France.';
    const result = await classify(jev((candidate, id) => id === 'span_0' ? { structure: 'multiple_propositions' } : candidate.includes('tired') ? { private: 0.99 } : {}), input(text));
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].sourceSpan.end).toBeLessThanOrEqual(result.claims[1].sourceSpan.start);
  });

  it('binds per-candidate questions to exact spans and asks scope only of split subspans', async () => {
    const client = jev();
    await classify(client, input('The Eiffel Tower opened in 1889. Helsinki is in Finland.'));
    const request = requestOf(client);
    const state = request.state as { candidates: { text: string; span: { start: number; end: number } }[] };
    expect(state.candidates[1]).toEqual({ id: 'span_1', text: 'The Eiffel Tower opened in 1889.', span: { start: 0, end: 32 } });
    expect(request.questions.span_0_preserves_scope).toBeUndefined();
    expect(request.questions.span_1_preserves_scope?.type).toBe('noul');
    expect(Object.keys(request.questions).filter(name => name.startsWith('span_0_')).sort()).toEqual(['span_0_attribution', 'span_0_claim_structure', 'span_0_future', 'span_0_kind',
      'span_0_practical', 'span_0_private_data', 'span_0_private_life', 'span_0_route', 'span_0_rumour', 'span_0_self_contained', 'span_0_source'].sort());
    expect(Object.keys(request.questions).some(name => /assertion_status|quote_use/.test(name))).toBe(false);
  });
});

describe('ported question wording', () => {
  it('asks the reference app kind and route questions with the future riders', async () => {
    const client = jev();
    await classify(client, input('Anthropic will IPO next year.'));
    const { span_0_kind: kind, span_0_route: route } = requestOf(client).questions;
    if (kind.type !== 'choice' || route.type !== 'choice') throw new Error('expected choice questions');
    expect(Object.keys(kind.criteria)).toEqual(['claim', 'opinion', 'prediction', 'question', 'instruction', 'other']);
    expect(kind.criteria.claim).toContain('either true or false, whether or not it is actually true, even if it also gives a view or urges something. Myths, rumours and wrong numbers are statements of fact too');
    expect(kind.criteria.claim).toContain('A statement about the future counts when official plans, announcements, published estimates or forecasts could confirm or contradict it');
    expect(kind.criteria.prediction).toBe('Only a guess about the future that no plan, announcement, estimate or forecast could confirm or contradict, such as a guess about how the speaker\'s own team, plans or life will turn out');
    expect(kind.criteria.opinion).toContain('Value judgements phrased as predictions are opinions');
    expect(Object.keys(route.criteria)).toEqual(['recent_event', 'named_fact', 'weather', 'calculation', 'general']);
    expect(route.criteria.recent_event).toBe('Breaking news: something said, done or decided, or something that happened, within the last few weeks or happening now, such as an incident, statement, vote, result, death, deal or announcement. Not events of past months or years');
  });

  it('tells Jev that a question passing a fact on states it and a plain question does not', async () => {
    const client = jev();
    await classify(client, input('Did you know that bats are blind?'));
    const kind = requestOf(client).questions.span_0_kind;
    if (kind.type !== 'choice') throw new Error('expected a choice question');
    expect(kind.criteria.claim).toContain('A question that passes a fact on, such as "Have you heard that…", "Did you know…" or "Is it true that…", states that fact');
    expect(kind.criteria.question).toContain('passes no fact on, such as "Why?", "You know?"');
  });

  it('decides kind and route in code from Jev probabilities', () => {
    expect(decideKind({ choice: 'opinion', probabilities: { claim: 0.2, opinion: 0.8 } })).toBe('claim');
    expect(decideKind({ choice: 'question', probabilities: { claim: 0.1, question: 0.6, opinion: 0.3 } })).toBe('question');
    expect(decideRoute({ choice: 'weather', probabilities: { weather: 0.39, general: 0.31, recent_event: 0.3 } }, 'Snow tomorrow.', NOW)).toBe('general');
    expect(decideRoute({ choice: 'recent_event', probabilities: { recent_event: 0.9, general: 0.1 } }, 'The 1999 deal collapsed.', NOW)).toBe('general');
  });
});

describe('Jev wire validation', () => {
  const request: JevRequest = { state: { captured: 'untrusted text' }, questions: { eligible: { type: 'choice', instructions: 'Classify.', criteria: { yes: 'Eligible.', no: 'Not eligible.' } } } };
  const valid = { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9, no: 0.1 } } } };
  it.each([
    {}, { answers: {} }, { answers: { eligible: { choice: 'invented', probabilities: { yes: 0.9, no: 0.1 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: Number.NaN, no: 0.1 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9, no: 0.9 } } } }
  ])('rejects malformed answers %#', malformed => {
    expect(() => validateAnswers(malformed, request.questions)).toThrow('malformed_provider');
  });

  it('uses the fixed endpoint, injected fetch, abort signal and a single metered call', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(valid), { status: 200 }));
    const ctx = context();
    const client = createJevClient({ apiKey: 'test-only-key', fetch: fetcher });
    expect(await client.ask(request, ctx)).toEqual(valid.answers);
    expect(ctx.consume).toHaveBeenCalledExactlyOnceWith('jev');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.typesafe.ai/v1/systemone', expect.objectContaining({ method: 'POST', signal: ctx.signal }));
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ model: 'jev-latest', ...request });
  });

  it.each([[401, 'jev_authentication', 1], [403, 'jev_authentication', 1], [429, 'jev_rate_limited', 2], [503, 'jev_unavailable', 2]] as const)('keeps HTTP %i operational with the bounded retry policy', async (status, code, attempts) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('provider body with secrets must never escape', { status }));
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, context())).rejects.toMatchObject({ code, message: code });
    expect(fetcher).toHaveBeenCalledTimes(attempts);
  });

  it.each([0, 125])('reports only validated input-token usage (%i) through the optional meter', async inputTokens => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...valid, usage: { input_tokens: inputTokens, raw_transcript: 'must not reach telemetry' } }), { status: 200 }));
    const recordUsage = vi.fn();
    const ctx: ProviderContext = { ...context(), recordUsage };
    expect(await createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, ctx)).toEqual(valid.answers);
    expect(recordUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens });
  });

  it.each([-1, 1.5, '125', null, Number.MAX_SAFE_INTEGER + 1])('ignores malformed usage %j without changing valid answers', async inputTokens => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...valid, usage: { input_tokens: inputTokens } }), { status: 200 }));
    const recordUsage = vi.fn();
    const ctx: ProviderContext = { ...context(), recordUsage };
    expect(await createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, ctx)).toEqual(valid.answers);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('meters valid provider usage even when its factual answers are malformed', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ answers: {}, usage: { input_tokens: 42 } }), { status: 200 }));
    const recordUsage = vi.fn();
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, { ...context(), recordUsage })).rejects.toMatchObject({ code: 'malformed_provider' });
    expect(recordUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens: 42 });
  });

  it('does not call or consume budget when already cancelled or missing a key', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const ctx = context();
    await expect(createJevClient({ apiKey: '', fetch: fetcher }).ask(request, ctx)).rejects.toMatchObject({ code: 'missing_jev_key' });
    expect(ctx.consume).not.toHaveBeenCalled();
    const cancelled = { ...ctx, signal: AbortSignal.abort() };
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, cancelled)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
