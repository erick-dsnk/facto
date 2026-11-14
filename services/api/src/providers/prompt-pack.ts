import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { DEFAULT_ADMISSION_PACK, ADMISSION_CANONICAL } from './jev/classification.js';
import { DEFAULT_JUDGE_PACK, JUDGE_CANONICAL } from './jev/judgment.js';
import { EVIDENCE_FIELDS, POLICY_KEYS, THRESHOLD_KEYS, type ChoiceQuestion, type PromptPack } from './pack-core.js';

export type { PromptPack } from './pack-core.js';
export type DecisionProviderName = 'jev' | 'laya';

/** What the classifier and judge sent before prompt packs existed. */
export const DEFAULT_PROMPT_PACK: PromptPack = { name: 'built-in', admission: DEFAULT_ADMISSION_PACK, judge: DEFAULT_JUDGE_PACK };
/** The pack each provider uses in production. Both default to the built-in pack; point a provider at another PromptPack here. */
export const PROMPT_PACKS: Record<DecisionProviderName, PromptPack> = { jev: DEFAULT_PROMPT_PACK, laya: DEFAULT_PROMPT_PACK };
export const packForProvider = (provider: DecisionProviderName, packs: Partial<Record<DecisionProviderName, PromptPack>> = PROMPT_PACKS): PromptPack => packs[provider] ?? PROMPT_PACKS[provider];

const text = z.string().min(1);
const probability = z.number().min(0).max(1);
const strings = z.record(z.string(), text);
const choice = z.object({ instructions: text.optional(), criteria: strings.optional(), optionMap: strings.optional() }).strict();
const textQuestion = z.object({ instructions: text }).strict();
const named = z.object({ instructions: text.optional(), none: text.optional() }).strict();
const thresholds = z.object(Object.fromEntries(THRESHOLD_KEYS.map(key => [key, probability.optional()]))).strict();
const policy = z.object(Object.fromEntries(POLICY_KEYS.map(key => [key, probability.optional()]))).strict();
const evidenceField = z.enum(EVIDENCE_FIELDS);
export const promptPackFileSchema = z.object({
  name: text.optional(),
  admission: z.object({
    thresholds: thresholds.optional(), prefix: text.optional(), selfContainedWithSubject: text.optional(), selfContainedWithoutSubject: text.optional(),
    choice: z.object({ kind: choice.optional(), route: choice.optional(), attribution: choice.optional(), claim_structure: choice.optional() }).strict().optional(),
    named: z.object({ source: named.optional(), subject: named.optional() }).strict().optional(),
    text: z.object(Object.fromEntries(Object.keys(DEFAULT_ADMISSION_PACK.text).map(key => [key, textQuestion.optional()]))).strict().optional(),
  }).strict().optional(),
  judge: z.object({
    thresholds: z.object({ relevant: probability.optional(), scope: probability.optional() }).strict().optional(),
    policy: policy.optional(),
    evidence: z.object({
      maxItems: z.number().int().min(1).max(6).optional(), excerptChars: z.number().int().min(1).nullable().optional(), titleChars: z.number().int().min(0).optional(),
      order: z.enum(['given', 'reversed']).optional(), fields: z.array(evidenceField).min(1).optional(),
      labels: z.object(Object.fromEntries(EVIDENCE_FIELDS.map(field => [field, text.optional()]))).strict().optional(),
      stateLabels: z.object({ checked_proposition: text.optional(), subject: text.optional(), as_of: text.optional(), evidence: text.optional() }).strict().optional(),
    }).strict().optional(),
    verdict: z.object({ criteria: strings.optional(), optionMap: strings.optional(), base: text.optional(), attribution: text.optional(), suffix: text.optional(), subject: text.optional(), future: text.optional(), rumour: text.optional() }).strict().optional(),
    selected_evidence: z.object({ instructions: text.optional(), none: text.optional(), evidenceOption: text.optional() }).strict().optional(),
    misleading_reason: choice.optional(), claim_risk: choice.optional(), basis: choice.optional(),
    stance: choice.extend({ about: text.optional(), future: text.optional() }).strict().optional(),
    relevant: textQuestion.optional(), scope: textQuestion.optional(), content_basis: choice.optional(), origin: choice.optional(),
  }).strict().optional(),
}).strict();
export type PromptPackFile = z.infer<typeof promptPackFileSchema>;

const REPLACED = new Set(['criteria', 'optionMap', 'fields']);
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Objects merge key by key; option lists (`criteria`, `optionMap`) and `fields` replace the default whole, so options can be removed. */
function merge(base: unknown, override: unknown, key = ''): unknown {
  if (override === undefined) return base;
  if (!plain(base) || !plain(override) || REPLACED.has(key)) return structuredClone(override);
  const out: Record<string, unknown> = { ...base };
  for (const [name, value] of Object.entries(override)) out[name] = merge(base[name], value, name);
  return out;
}

function checkChoice(path: string, question: ChoiceQuestion & { instructions?: string }, canonical: readonly string[]) {
  const shown = Object.keys(question.criteria), map = question.optionMap ?? {};
  const fail = (why: string) => { throw new Error(`prompt_pack_invalid: ${path}: ${why}`); };
  if (shown.length < 2) fail('needs at least two options');
  for (const [option, target] of Object.entries(map)) {
    if (!shown.includes(option)) fail(`optionMap key "${option}" is not an option shown`);
    if (!canonical.includes(target)) fail(`optionMap value "${target}" is not one of ${canonical.join(', ')}`);
  }
  for (const option of shown) if (!(option in map) && !canonical.includes(option)) fail(`option "${option}" needs an optionMap entry to one of ${canonical.join(', ')}`);
}

/** Applies a pack file's overrides to the built-in pack and checks that every option still collapses to an answer the policy reads. */
export function resolvePromptPack(file: unknown, base: PromptPack = DEFAULT_PROMPT_PACK): PromptPack {
  const parsed = promptPackFileSchema.safeParse(file);
  if (!parsed.success) throw new Error(`prompt_pack_invalid: ${parsed.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')}`);
  const { name, ...parts } = parsed.data;
  const pack = merge(base, parts) as PromptPack;
  pack.name = name ?? base.name;
  for (const [role, question] of Object.entries(pack.admission.choice)) checkChoice(`admission.choice.${role}`, question, ADMISSION_CANONICAL[role as keyof typeof ADMISSION_CANONICAL]);
  const { judge } = pack;
  checkChoice('judge.verdict', { ...judge.verdict, instructions: '' }, JUDGE_CANONICAL.verdict);
  for (const role of ['misleading_reason', 'claim_risk', 'basis', 'stance', 'content_basis', 'origin'] as const) checkChoice(`judge.${role}`, judge[role], JUDGE_CANONICAL[role]);
  const wire = [...Object.values(judge.evidence.stateLabels), ...judge.evidence.fields.map(field => judge.evidence.labels[field] ?? field)];
  if (new Set(judge.evidence.fields).size !== judge.evidence.fields.length) throw new Error('prompt_pack_invalid: judge.evidence.fields: duplicate field');
  if (new Set(Object.values(judge.evidence.stateLabels)).size !== 4 || new Set(wire.slice(4)).size !== wire.length - 4) throw new Error('prompt_pack_invalid: judge.evidence labels collide');
  return pack;
}

export async function loadPromptPack(path: string, base: PromptPack = DEFAULT_PROMPT_PACK): Promise<PromptPack> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, 'utf8')); } catch (error) { throw new Error(`prompt_pack_unreadable: ${path}: ${error instanceof Error ? error.message : 'unknown'}`); }
  return resolvePromptPack(raw, { ...base, name: base.name });
}
