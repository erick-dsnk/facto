import type { JevAnswer } from './jev/client.js';

/** Prompt pack types shared by the classifier, the judge and the pack loader. No imports from the classifier or judge, so there is no cycle. */
export type OptionMap = Record<string, string>;
/** Options the model is shown (`criteria` keys) and, when they differ from the canonical answers code consumes, how each collapses back. */
export type ChoiceQuestion = { instructions: string; criteria: Record<string, string>; optionMap?: OptionMap };
export type TextQuestion = { instructions: string };
/** A choice among `none` plus the names code offers, numbered "1", "2", ... */
export type NamedChoice = { instructions: string; none: string };

export const THRESHOLD_KEYS = ['claim', 'route', 'privateData', 'privateLife', 'rumour', 'future', 'misheard', 'selfContained', 'preservesScope', 'subjectPrivate'] as const;
export type AdmissionThresholds = Record<typeof THRESHOLD_KEYS[number], number>;
export type AdmissionPack = {
  thresholds: AdmissionThresholds;
  /** Starts every per-candidate instruction. `{index}` and `{id}` are filled in. */
  prefix: string;
  /** Prepended to the completeness question; `{id}` is the subject question's id prefix. */
  selfContainedWithSubject: string;
  selfContainedWithoutSubject: string;
  choice: { kind: ChoiceQuestion; route: ChoiceQuestion; attribution: ChoiceQuestion; claim_structure: ChoiceQuestion };
  named: { source: NamedChoice; subject: NamedChoice };
  text: Record<'subject_private' | 'private_data' | 'private_life' | 'rumour' | 'future' | 'self_contained' | 'practical' | 'preserves_scope' | 'misheard_audio' | 'misheard_ocr', TextQuestion>;
};

export const EVIDENCE_FIELDS = ['id', 'url', 'title', 'publisher', 'origin', 'publishedAt', 'contentBasis', 'excerpt', 'rating'] as const;
export type EvidenceField = typeof EVIDENCE_FIELDS[number];
export const POLICY_KEYS = ['minProbabilityTrue', 'minProbabilityFalse', 'minProbabilityMisleading', 'minProbabilityMixed'] as const;
export type PolicyThresholds = Record<typeof POLICY_KEYS[number], number>;
export type JudgePack = {
  thresholds: { relevant: number; scope: number };
  /** Deterministic verdict policy probabilities (policy/verdict-rules.ts RULES). */
  policy: PolicyThresholds;
  evidence: {
    /** Evidence beyond this is dropped (after the production check that rejects more than six). */
    maxItems: number;
    /** Characters of each excerpt sent; null sends it whole. */
    excerptChars: number | null;
    titleChars: number;
    order: 'given' | 'reversed';
    /** Fields sent for each passage, in order. `rating` is only sent when the passage has one. */
    fields: EvidenceField[];
    /** Wire name for a field; unlisted fields keep their own name. */
    labels: Partial<Record<EvidenceField, string>>;
    /** Wire names of the state's own keys. */
    stateLabels: { checked_proposition: string; subject: string; as_of: string; evidence: string };
  };
  verdict: { criteria: Record<string, string>; optionMap?: OptionMap; base: string; attribution: string; suffix: string; subject: string; future: string; rumour: string };
  selected_evidence: { instructions: string; none: string; evidenceOption: string };
  misleading_reason: ChoiceQuestion;
  claim_risk: ChoiceQuestion;
  basis: ChoiceQuestion;
  stance: ChoiceQuestion & { about: string; future: string };
  relevant: TextQuestion;
  scope: TextQuestion;
  content_basis: ChoiceQuestion;
  origin: ChoiceQuestion;
};
export type PromptPack = { name: string; admission: AdmissionPack; judge: JudgePack };

/** Fills `{name}` placeholders for the given variables only; other braces are left alone. */
export const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => Object.hasOwn(vars, key) ? vars[key] : whole);

export type OptionMapping = { map?: OptionMap; canonical: readonly string[] };
/** Collapses what the model chose among the shown options back to the canonical answers. Probabilities of options sharing a canonical answer add up. */
export function applyOptionMaps(answers: Record<string, JevAnswer>, mappings: Record<string, OptionMapping | undefined>): Record<string, JevAnswer> {
  const out = { ...answers };
  for (const [name, mapping] of Object.entries(mappings)) {
    const answer = answers[name];
    if (!mapping?.map || !answer?.choice) continue;
    const to = (option: string) => mapping.map![option] ?? option;
    const probabilities: Record<string, number> = Object.fromEntries(mapping.canonical.map(key => [key, 0]));
    for (const [option, p] of Object.entries(answer.probabilities ?? {})) probabilities[to(option)] = Math.min(1, (probabilities[to(option)] ?? 0) + p);
    out[name] = { choice: to(answer.choice), probabilities };
  }
  return out;
}
