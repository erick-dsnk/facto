# Prompt packs

A prompt pack holds every decision-model prompt the classifier (admission) and the judge send, plus the probability thresholds that read the answers. The **built-in pack reproduces the pre-pack requests byte for byte** (`services/api/src/providers/prompt-pack.test.ts` compares SHA-256 digests of 11 serialized requests with digests taken from the code before packs existed). A pack file overrides only the parts it names, so a provider can get shorter prompts or fewer options without code edits.

## Where things live

| What | Where |
|---|---|
| Pack types | `services/api/src/providers/pack-core.ts` |
| Built-in admission pack | `DEFAULT_ADMISSION_PACK` in `services/api/src/providers/jev/classification.ts` |
| Built-in judge pack | `DEFAULT_JUDGE_PACK` in `services/api/src/providers/jev/judgment.ts` |
| JSON schema (zod), `resolvePromptPack`, `loadPromptPack`, provider registry | `services/api/src/providers/prompt-pack.ts` |
| Production selection | `PROMPT_PACKS` in `prompt-pack.ts`: `{ jev, laya }`: Jev uses `packs/jev.json` (`jev-stack-1`), Laya uses `packs/laya.json` (`laya-wording-r2a2`); see `docs/per-provider-prompts.md`. `selectDecisionProvider` returns `pack`; `services/api/src/index.ts` passes it to `createClassifier`, `createJudge` and the runtime's `verdictRules`. |

Out of scope: the source-query prompts in `services/api/src/sources` (they use the same client but are not classifier or judge prompts).

## File format

A pack file is JSON. Every key is optional and unknown keys are rejected. Objects merge into the built-in pack key by key. **`criteria`, `optionMap` and `fields` replace the built-in value whole**, which is how an option is removed. Text may use `{placeholders}` (listed below); other braces are left alone.

```jsonc
{
  "name": "laya-compact",
  "admission": {
    "thresholds": { "claim": 0.2, "route": 0.4, "privateData": 0.1, "privateLife": 0.4, "rumour": 0.5, "future": 0.5,
                    "misheard": 0.5, "selfContained": 0.5, "preservesScope": 0.85, "subjectPrivate": 0.5 },
    "prefix": "Candidate {index} ({id}). ",                 // starts every per-candidate question; {index} {id}
    "selfContainedWithSubject": "...{id}_subject... ",      // prepended to the completeness question
    "selfContainedWithoutSubject": "... ",
    "choice": {                                              // kind, route, attribution, claim_structure
      "kind": { "instructions": "What is this?", "criteria": { "claim": "...", "other": "..." }, "optionMap": { "claim": "claim" } }
    },
    "named": { "source": { "instructions": "...", "none": "..." }, "subject": { "instructions": "...", "none": "..." } },
    "text": {                                                // yes/no questions: subject_private private_data private_life rumour
      "future": { "instructions": "..." }                    // future self_contained practical preserves_scope misheard_audio misheard_ocr
    }
  },
  "judge": {
    "thresholds": { "relevant": 0.85, "scope": 0.85 },       // directlyAddressesClaim / matchesTimePlaceAndPopulation
    "policy": { "minProbabilityTrue": 0.6, "minProbabilityFalse": 0.7, "minProbabilityMisleading": 0.7, "minProbabilityMixed": 0.55 },
    "evidence": {
      "maxItems": 6,                 // 1-6; extra passages are dropped after the production "more than six" check
      "excerptChars": null,          // null sends whole excerpts, a number clips them in the request only
      "titleChars": 300,
      "order": "given",              // or "reversed"
      "fields": ["id", "url", "title", "publisher", "origin", "publishedAt", "contentBasis", "excerpt", "rating"],
      "labels": { "excerpt": "text" },                                              // wire names of passage fields
      "stateLabels": { "checked_proposition": "checked_proposition", "subject": "the claim is about", "as_of": "as_of", "evidence": "evidence" }
    },
    "verdict": { "criteria": {}, "optionMap": {}, "base": "...", "attribution": "...{who}...{verb}...", "suffix": "...", "subject": "...", "future": "...", "rumour": "..." },
    "selected_evidence": { "instructions": "...", "none": "...", "evidenceOption": "Retained evidence {id}" },
    "misleading_reason": { "instructions": "...", "criteria": {}, "optionMap": {} },
    "claim_risk": { "instructions": "...", "criteria": {}, "optionMap": {} },
    "basis": { "instructions": "...", "criteria": {}, "optionMap": {} },
    "stance": { "instructions": "...{id}...{about}{future}", "criteria": {}, "optionMap": {}, "about": "...{who}...", "future": "..." },
    "relevant": { "instructions": "...{id}..." },
    "scope": { "instructions": "...{id}..." },
    "content_basis": { "instructions": "...{id}...", "criteria": {}, "optionMap": {} },
    "origin": { "instructions": "...{id}...{other}...", "criteria": {}, "optionMap": {} }
  }
}
```

Placeholders: admission `prefix` `{index}` `{id}`; `selfContained*` `{id}`; judge `verdict.attribution` `{who}` `{verb}`; `selected_evidence.evidenceOption`, `relevant`, `scope`, `content_basis` `{id}`; `stance` `{id}` `{about}` `{future}`, `stance.about` `{who}`; `origin` `{id}` `{other}`.

Thresholds and policy probabilities are in `[0, 1]`. `judge.policy` is the deterministic verdict policy (`RULES` in `policy/verdict-rules.ts`); the runtime reads it through `RuntimeAdapters.verdictRules`, and the harness passes it to `assessVerdict`.

## Changing structure: option maps

A choice question shows the model the keys of `criteria`. Code only understands the *canonical* answers (`kind`: claim, opinion, prediction, question, instruction, other; `verdict`: supported, contradicted, misleading, insufficient_evidence; and so on). `optionMap` maps each shown option to a canonical one, after the answer has been validated against what was sent:

* the chosen option is replaced by its canonical answer;
* options that share a canonical answer have their probabilities added (so merging "supported" and "probably supported" yields one `supported` probability);
* canonical answers that are never shown get probability 0.

A shown option that is also a canonical key needs no entry. Loading fails (`prompt_pack_invalid`) if an option is neither canonical nor mapped, a map target is not canonical, a map key is not shown, or fewer than two options remain. Fewer options is therefore a smaller `criteria`; merged options is several keys mapping to one canonical answer; a split is a second option that maps to the same canonical answer as the first. Dynamic questions (`source`, `subject`, `selected_evidence`) are numbered by code and take only text overrides.

Example: a three-way verdict.

```json
{ "judge": { "verdict": {
  "criteria": { "true": "The evidence shows the claim is true", "false": "The evidence shows the claim is wrong", "unsure": "The evidence does not settle it" },
  "optionMap": { "true": "supported", "false": "contradicted", "unsure": "insufficient_evidence" } } } }
```

Not expressible without a code change: removing or adding whole questions, and changing which questions code asks (for example dropping the pairwise `origin` questions).

## Use

Pass a pack file per provider to the harness with `--prompt-pack jev=PATH,laya=PATH`; a provider with no entry uses the built-in pack. The result JSON records each pack's name and SHA-256. In production, register a resolved pack in `PROMPT_PACKS`, for example `laya: await loadPromptPack('packs/laya.json')` (both providers now ship a tuned pack; `DEFAULT_PROMPT_PACK` is the built-in one).

## Harness flags (`npm run evaluate:providers`)

| Flag | Meaning |
|---|---|
| `--prompt-pack jev=PATH,laya=PATH` | Pack file per provider. |
| `--admission-cases FILE` | Admission cases instead of the reference app's set: JSON array or `{cases}` of `{id, text, expected, context?, mode?, confidence?, lowConfidenceWords?}`; `expected` is a label (`supported`, `contradicted`, `misleading`, `cant_verify`, `not_a_claim`, `needs_confirmation`, ...). |
| `--cases FILE` | Pipeline/judge cases (`cohort.json` format). Its SHA-256 must match the evidence file's `cohortSHA256`. |
| `--evidence FILE` | Frozen evidence to replay (default `frozen-evidence.json`). |
| `--acquire --evidence-out FILE` | Acquire live Exa evidence for `--cases` into FILE. `--evidence-out` is required and the original `frozen-evidence.json` is refused. |
| `--laya-deadline-ms N` | Eval only: per-request deadline for Laya admission, judge and pipeline runs (default 10000). Jev always keeps 10 s. With `--lock` the clock starts after the lock is acquired. |
| `--lock PATH` | Cross-process `fs.mkdir` spin-lock held for each Laya case, so concurrent harness processes serialize Laya inference. A case's deadline clock starts after the lock is acquired. Locks of dead owners or older than 15 minutes are broken. The lock covers the whole case (all of its HTTP calls, any timeout drain). |
| `--summary PATH` | Write the per-provider metrics array below. |
| `--dataset dev\|holdout` | Label recorded in the summary (default `dev`). |

### Summary JSON

An array with one object per provider (durations are milliseconds, nearest-rank). Pipeline and judge use strict scoring: every case is in the denominator, so abstentions, skips and errors are simply not correct.

```json
{ "provider": "jev", "dataset": "dev",
  "admission": { "total": 59, "correct": 55, "eligibleTotal": 51, "eligibleRecalled": 48, "negativesTotal": 8, "falsePositives": 1, "p50": 248, "p95": 2277 },
  "pipeline": { "total": 24, "correct": 12, "definitive": 8, "wrongDefinitive": 0, "cantVerify": 16, "skipped": 0, "errors": 0, "p50": 874, "p95": 4457 },
  "judge": { "total": 24, "correct": 12, "definitive": 8, "wrongDefinitive": 0, "cantVerify": 16, "errors": 0, "p50": 1009, "p95": 4543 },
  "primary": 79 }
```

`primary` is `admission.correct + pipeline.correct + judge.correct`. A mode that was not run reports zeros and null timings. Speculation is neither skipped, definitive nor cantVerify.

## Example runs

```bash
# Jev, dev data, a Jev pack
npm run evaluate:providers -- --providers jev --modes admission,pipeline,judge --dataset dev \
  --prompt-pack jev=packs/jev-dev.json --admission-cases data/admission-dev.json --cases data/cohort-dev.json --evidence data/evidence-dev.json \
  --output results/jev-dev.json --summary results/jev-dev-summary.json

# Laya, same data, serialized across processes (start LAYA_MAX_CONCURRENT=1 server first)
npm run evaluate:providers -- --providers laya --modes admission,pipeline,judge --dataset dev \
  --prompt-pack laya=packs/laya-dev.json --admission-cases data/admission-dev.json --cases data/cohort-dev.json --evidence data/evidence-dev.json \
  --lock /tmp/laya-eval.lock --output results/laya-dev.json --summary results/laya-dev-summary.json

# Acquire new evidence without touching the frozen baseline
npm run evaluate:providers -- --acquire --cases data/cohort-dev.json --evidence-out data/evidence-dev.json
```

## Shared-code changes

- `services/api/src/runtime/pipeline.ts`: `PipelineRuntime` takes an optional last constructor argument `deadlineMs` (default 10 s, so production is unchanged); only `evaluate:providers --laya-deadline-ms` sets it, for Laya pipeline runs. Flag this in the PR.
