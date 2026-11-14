import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { textInputSchema } from '../../../../packages/contracts/src/index.js';
import { checkInput } from './driver.js';
import { DEVICE_PHRASES_PATH, devicePhrases, everydayClaims, fitContext, hardClaims, loadSets } from './sets.js';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function factcheckCheckout(claims: unknown, heldout: unknown) {
  const dir = await mkdtemp(join(tmpdir(), 'factcheck-'));
  dirs.push(dir);
  await mkdir(join(dir, 'test'), { recursive: true });
  await mkdir(join(dir, '.build', 'averitec'), { recursive: true });
  await writeFile(join(dir, 'test', 'claims.json'), JSON.stringify(claims));
  await writeFile(join(dir, '.build', 'averitec', 'heldout.json'), JSON.stringify(heldout));
  return dir;
}

describe('device phrases', () => {
  it('holds the planned phrases with their expected labels, each a valid explicit input', async () => {
    const phrases = devicePhrases(JSON.parse(await readFile(DEVICE_PHRASES_PATH, 'utf8')));
    expect(phrases.length).toBeGreaterThanOrEqual(15);
    const expected = Object.fromEntries(phrases.map(phrase => [phrase.text, phrase.expected]));
    expect(expected["Jensen Huang's fourth affair."]).toBe('speculation');
    expect(expected['Anthropic will IPO at a 2.5 trillion dollar valuation.']).toBe('false');
    expect(expected['Goldfish only remember three seconds.']).toBe('false');
    expect(expected['The Great Wall of China is visible from space.']).toBe('false');
    expect(expected['Helsinki is the capital of Finland.']).toBe('true');
    expect(expected['According to NASA, the Moon is shrinking.']).toBe('true');
    expect(expected['You heard that on Tropical IPO for $2,500,000,000,000?']).toBe('needs_confirmation');
    expect(phrases.filter(phrase => phrase.expected === 'not_a_claim')).toHaveLength(3);
    const eiffel = phrases.find(phrase => phrase.text === 'It opened in 1889.')!;
    expect(eiffel).toMatchObject({ expected: 'true', context: ['The Eiffel Tower is in Paris.'] });
    const misheard = phrases.find(phrase => phrase.id === 'dev-misheard')!;
    expect(misheard).toMatchObject({ mode: 'audio', confidence: 0.71, lowConfidenceWords: [{ text: 'on', confidence: 0.42 }, { text: 'Tropical', confidence: 0.38 }] });
    for (const phrase of phrases) {
      const input = checkInput(phrase, { id: 'session-1', epoch: 1 }, `eval-${phrase.id}`, '2026-11-14T10:00:00Z');
      expect(textInputSchema.safeParse(input).success, phrase.id).toBe(true);
    }
  });

  it('rejects an audio phrase without a confidence', () => {
    expect(() => devicePhrases([{ id: 'x', text: 'A.', mode: 'audio', expected: 'true', why: 'w' }])).toThrow();
  });
});

describe('dataset loading', () => {
  it('builds context from the page title and preceding text, within the contract limits', () => {
    expect(fitContext([' Title ', null, '', 'Before.'])).toEqual(['Title', 'Before.']);
    expect(fitContext(['one', 'two', 'three'])).toEqual(['two', 'three']);
    expect(fitContext(['t'.repeat(300), 'b'.repeat(1_000)])).toEqual(['b'.repeat(1_000)]);
    expect(fitContext(['b'.repeat(1_300)])[0]).toHaveLength(1_200);
    const [claim] = everydayClaims([{ id: 'context-01', text: 'He was born in Ulm in 1879.', context: { title: 'Albert Einstein', before: 'Albert Einstein is best known for relativity.' }, expected: 'true', why: 'w', source: 's' }]);
    expect(claim).toEqual({ set: 'everyday', id: 'context-01', text: 'He was born in Ulm in 1879.', context: ['Albert Einstein', 'Albert Einstein is best known for relativity.'], mode: 'typed', confidence: null, expected: 'true' });
  });

  it('maps HARD labels and keeps only context.before', () => {
    const cases = hardClaims([
      { id: 'unve-1', text: 'A claim.', context: { title: 'Ignored title', before: 'Speaker, 2020' }, expected: 'unverifiable' },
      { id: 'misl-2', text: 'B claim.', context: null, expected: 'Conflicting Evidence/Cherrypicking' },
    ]);
    expect(cases.map(sample => [sample.expected, sample.context])).toEqual([['cant_verify', ['Speaker, 2020']], ['misleading', []]]);
  });

  it('loads both sets from FACTCHECK_REPO with a per-set limit and rejects duplicate ids', async () => {
    const claims = [1, 2, 3].map(index => ({ id: `plain-0${index}`, text: `Fact ${index}.`, context: null, expected: 'true' }));
    const heldout = [1, 2, 3].map(index => ({ id: `true-${index}`, text: `Hard ${index}.`, context: { before: '' }, expected: 'true' }));
    const env = { FACTCHECK_REPO: await factcheckCheckout(claims, heldout) };
    const everyday = await loadSets(['everyday'], { env });
    expect(everyday.length).toBeGreaterThanOrEqual(18);
    expect(everyday.slice(0, 3).map(sample => sample.id)).toEqual(['plain-01', 'plain-02', 'plain-03']);
    const limited = await loadSets(['everyday', 'hard'], { env, limit: 2 });
    expect(limited.map(sample => `${sample.set}:${sample.id}`)).toEqual(['everyday:plain-01', 'everyday:plain-02', 'hard:true-1', 'hard:true-2']);
    const duplicate = { FACTCHECK_REPO: await factcheckCheckout([claims[0], claims[0]], heldout) };
    await expect(loadSets(['everyday'], { env: duplicate })).rejects.toThrow('Duplicate everyday case id plain-01');
    await expect(loadSets(['hard'], { env: { FACTCHECK_REPO: join(tmpdir(), 'no-such-factcheck-checkout') } })).rejects.toThrow('HARD heldout.json not found');
  });
});
