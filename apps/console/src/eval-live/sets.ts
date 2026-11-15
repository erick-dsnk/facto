import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MAX_LOW_CONFIDENCE_WORDS, codePoints, lowConfidenceWordSchema, type LowConfidenceWord } from '../../../../packages/contracts/src/index.js';
import { expectedLabel, type EvalLabel } from './labels.js';

export const EVAL_SETS = ['everyday', 'hard'] as const;
export type EvalSet = typeof EVAL_SETS[number];
/** One input to send. HARD text is CC BY-NC data read in place: it lives in memory only and never reaches a report or stdout. */
export type EvalCase = {
  set: EvalSet; id: string; text: string; context: string[]; mode: 'typed' | 'audio'; confidence: number | null;
  lowConfidenceWords?: LowConfidenceWord[]; expected: EvalLabel;
};

const MAX_CONTEXT = 1200;
export const DEVICE_PHRASES_PATH = fileURLToPath(new URL('../../../../fixtures/evaluation/device-phrases.json', import.meta.url));
/** The reference app's checkout. FACTCHECK_REPO overrides the default location. */
export const factcheckRepo = (env: NodeJS.ProcessEnv = process.env) => env.FACTCHECK_REPO || join(homedir(), 'Desktop', 'Random_Projects', 'factcheck');
export const everydayClaimsPath = (env: NodeJS.ProcessEnv = process.env) => join(factcheckRepo(env), 'test', 'claims.json');
export const hardSetPath = (env: NodeJS.ProcessEnv = process.env) => join(factcheckRepo(env), '.build', 'averitec', 'heldout.json');

/**
 * At most two non-empty lines and 1,200 code points in all, as the contract allows. Earlier lines go first when
 * the total is too long; a single line still too long keeps its last 1,200 code points.
 */
export function fitContext(lines: (string | null | undefined)[]): string[] {
  const kept = lines.map(line => line?.trim() ?? '').filter(line => line.length > 0).slice(-2);
  const total = () => codePoints(kept.join('')).length;
  while (kept.length > 1 && total() > MAX_CONTEXT) kept.shift();
  if (kept.length === 1 && total() > MAX_CONTEXT) kept[0] = codePoints(kept[0]).slice(-MAX_CONTEXT).join('').trim();
  return kept;
}

const pageContext = z.object({ title: z.string().nullish(), before: z.string().nullish() }).passthrough().nullish();
const everydaySchema = z.array(z.object({ id: z.string().min(1), text: z.string().min(1), context: pageContext, expected: z.string() }).passthrough());
const hardSchema = z.array(z.object({ id: z.string().min(1), text: z.string().min(1), context: pageContext, expected: z.string() }).passthrough());
export const devicePhraseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/), text: z.string().min(1), context: z.array(z.string()).max(2).default([]),
  mode: z.enum(['typed', 'audio']), confidence: z.number().min(0).max(1).nullable().optional(),
  lowConfidenceWords: z.array(lowConfidenceWordSchema).max(MAX_LOW_CONFIDENCE_WORDS).optional(),
  expected: z.string(), why: z.string().min(1)
}).strict().refine(phrase => phrase.mode !== 'audio' || typeof phrase.confidence === 'number', 'Audio phrases need a confidence');
export const devicePhrasesSchema = z.array(devicePhraseSchema);

const readJson = async (path: string, what: string): Promise<unknown> => {
  let text: string;
  try { text = await readFile(path, 'utf8'); } catch { throw new Error(`${what} not found at ${path}. Set FACTCHECK_REPO to the reference app checkout.`); }
  return JSON.parse(text);
};

/** The reference app's 44 labelled claims; context is the page title and the text before the selection. */
export function everydayClaims(data: unknown): EvalCase[] {
  return everydaySchema.parse(data).map(item => ({
    set: 'everyday', id: item.id, text: item.text, context: fitContext([item.context?.title, item.context?.before]),
    mode: 'typed', confidence: null, expected: expectedLabel(item.expected),
  }));
}

export function devicePhrases(data: unknown): EvalCase[] {
  return devicePhrasesSchema.parse(data).map(phrase => ({
    set: 'everyday', id: phrase.id, text: phrase.text, context: fitContext(phrase.context), mode: phrase.mode,
    confidence: phrase.confidence ?? null, ...(phrase.lowConfidenceWords?.length ? { lowConfidenceWords: phrase.lowConfidenceWords } : {}),
    expected: expectedLabel(phrase.expected),
  }));
}

/** AVeriTeC held-out claims. Only `context.before` (speaker and date) goes along as context. */
export function hardClaims(data: unknown): EvalCase[] {
  return hardSchema.parse(data).map(item => ({
    set: 'hard', id: item.id, text: item.text, context: fitContext([item.context?.before]), mode: 'typed', confidence: null,
    expected: expectedLabel(item.expected),
  }));
}

/** Loads the chosen sets, first `limit` cases of each. */
export async function loadSets(sets: readonly EvalSet[], options: { limit?: number; env?: NodeJS.ProcessEnv } = {}): Promise<EvalCase[]> {
  const env = options.env ?? process.env;
  const cases: EvalCase[] = [];
  for (const set of sets) {
    const loaded = set === 'everyday'
      ? [...everydayClaims(await readJson(everydayClaimsPath(env), 'EVERYDAY claims.json')), ...devicePhrases(await readJson(DEVICE_PHRASES_PATH, 'device-phrases.json'))]
      : hardClaims(await readJson(hardSetPath(env), 'HARD heldout.json'));
    const ids = new Set<string>();
    for (const sample of loaded) {
      if (ids.has(sample.id)) throw new Error(`Duplicate ${set} case id ${sample.id}`);
      ids.add(sample.id);
    }
    cases.push(...(options.limit === undefined ? loaded : loaded.slice(0, options.limit)));
  }
  return cases;
}
