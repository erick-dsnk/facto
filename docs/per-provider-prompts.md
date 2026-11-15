# Per-provider prompt tuning (issue #69)

Question: can a provider-specific prompt pack (`docs/prompt-pack.md`) close the Jev/Laya gap or improve Jev, without code changes?

**Outcome: nothing shipped.** No candidate was confirmed on dev, so both providers keep the built-in pack. The committed `services/api/src/providers/packs/{jev,laya}.json` are the final packs of the run (which equal the baseline, so they only carry a name) and are opt-in via `--prompt-pack`. `PROMPT_PACKS` is unchanged and production stays on Jev with the built-in pack.

## Method

- **Data.** Dev: 59 admission cases + 24 cohort cases (original data) + 120 ClaimBuster dev sentences. Holdout: 59 admission + 24 cohort cases (generated, verified) + 120 ClaimBuster holdout sentences from different debates. ClaimBuster (`fixtures/evaluation/provider-comparison/claimbuster/README.md`): 50 CFS (must be admitted), 40 NFS (must be skipped), 30 UFS (reported only as `ufsAdmitted`). Cohort evidence is frozen, so runs replay the same excerpts.
- **Splits.** Candidates are tuned and gated on dev. The holdout is run once per provider, on the final pack only.
- **Metric.** `primary = adm59Correct + cbCorrect (CFS+NFS, 90) + pipelineCorrect + judgeCorrect`, out of 59 + 90 + 24 + 24 = 197. Also tracked: `cbFP` (NFS admitted), `cbRecalled`, `cbCorrectExFlagged` (without 6 auditor-flagged NFS ids), `ufsAdmitted`, `wrongDefinitive`, `errors`, `truncatedAsks`, latency p95. Scripts: `apps/console/scripts/tune-eval.sh` (3 harness runs per pack) and `tune-combine.py`.
- **Noise (eps).** Baselines were repeated on dev. Jev scored 140, 142 and 139 (two runs while other jobs shared the machine), so the noise floor is about 2 to 3 points of primary; Laya scored 63, 63, 62. The holdout confirms this: the final Jev pack is the baseline pack, yet scored 166 against 168 (cb FP 15 against 14), and Laya 69 against 71. A candidate therefore has to beat the baseline by more than that noise.
- **Gate (ship rule as applied).** A candidate passes on dev only if a separate confirmation run beats the baseline primary by more than eps without raising ClaimBuster false positives, wrong-definitive answers or errors. A final pack ships only if the holdout primary is at least the baseline and holdout cbFP is not higher. The numeric eps used by the workflow script is not stored in the repo; the figures above are the measurements it was based on.
- **Families.** wording (shorter, plainer instructions and criteria), evidence (item count, excerpt clipping, order, fields), thresholds (admission and judge probabilities, `judge.policy`), structure (fewer or merged options through `criteria` and `optionMap`).
- **Greedy stacking, 2 rounds.** Each round tries up to 3 attempts per family per provider, confirms the best attempt of each family, and stacks passing families on the running pack in order of gain. Round 2 starts from the round 1 stack.

## Results

### Baseline against final (final = baseline pack, empty)

| Provider | Split | primary | adm59 | cbCorrect / cbFP / cbRecalled | ufsAdmitted | pipeline | judge | wrongDef | errors | truncated asks | pipeline p95 ms | judge p95 ms |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jev baseline | dev | 140 | 55 | 61 / 26 / 47 | 23 | 12 | 12 | 0 | 0 | 0 | 846 | 313 |
| Jev final | dev | 140 | 55 | 61 / 26 / 47 | 23 | 12 | 12 | 0 | 0 | 0 | 846 | 313 |
| Jev baseline | holdout | 168 | 55 | 76 / 14 / 50 | 18 | 19 | 18 | 0 | 0 | 0 | 799 | 280 |
| Jev final | holdout | 166 | 55 | 74 / 15 / 49 | 19 | 19 | 18 | 0 | 0 | 0 | 856 | 373 |
| Laya baseline | dev | 63 | 22 | 37 / 12 / 9 | 22 | 0 | 4 | 0 | 0 | 27 | 396 | 2760 |
| Laya final | dev | 63 | 22 | 37 / 12 / 9 | 22 | 0 | 4 | 0 | 0 | 27 | 396 | 2760 |
| Laya baseline | holdout | 71 | 26 | 42 / 12 / 14 | 17 | 0 | 3 | 0 | 0 | 25 | 322 | 2564 |
| Laya final | holdout | 69 | 26 | 40 / 13 / 13 | 16 | 0 | 3 | 0 | 0 | 25 | 1133 | 6711 |

The dev "final" rows are the baseline run itself (no variant passed). The holdout differences are run-to-run noise on identical packs: Jev flipped 3 ClaimBuster cases (cb-holdout-cfs-7349 and cb-holdout-nfs-10998 worse, cb-holdout-ufs-27814 changed), Laya 3 (cb-holdout-nfs-10587 new false positive, cb-holdout-cfs-9017 and cb-holdout-ufs-2888 lost); all 59 admission cases and all pipeline/judge cases were identical, except Laya H14 moving from speculation to not_a_claim, which is not a correctness change. Laya's holdout latency rose only because other eval processes shared the server.

### Per-node gate results

Every node of both rounds failed: the confirmation run of each family's best attempt produced no metrics (`complete=false`, empty `metrics.json`), so the gate had nothing to compare and reported "no metrics". This is a failure of the confirmation step, not evidence that these families do not work (see the unconfirmed attempts below).

| Round | Provider | Family | Gate | Reason |
|---|---|---|---|---|
| 1 | jev | wording | FAIL | no metrics |
| 1 | laya | wording | FAIL | no metrics |
| 1 | jev | evidence | FAIL | no metrics |
| 1 | laya | evidence | FAIL | no metrics |
| 1 | jev | thresholds | FAIL | no metrics |
| 1 | laya | thresholds | FAIL | no metrics |
| 1 | jev | structure | FAIL | no metrics |
| 1 | laya | structure | FAIL | no metrics |
| 2 | (the same 8 nodes) | | FAIL | no metrics |

Overall ship decision: jev `ship=false` (holdout primary 166 < 168; holdout cbFP 15 > 14; no variant passed on dev), laya `ship=false` (holdout 69 < 71; cbFP 13 > 12; no variant passed on dev).

### Stack log

Round 1 stack: jev [], laya []. Round 2 stack: jev [], laya []. The final packs are therefore the baseline.

### Unconfirmed attempts (dev, single run, not gated)

Best attempt per family on dev, from the attempt runs (`primary`; Jev baseline 140, Laya baseline 63). These were not confirmed, so none is evidence of an improvement.

| Provider | Family | Round 1 best | Round 2 best | Notes |
|---|---|---:|---:|---|
| jev | thresholds | 161 (cb 80, cbFP 9) | 156 | Largest signal: ClaimBuster false positives fell from 26 to 9 with adm59 58/59. Worth confirming first. |
| jev | wording | 160 (one run had 3 errors) | 158 | cbFP 13 to 7; pipeline and judge also moved in round 1. |
| jev | evidence | 143 | 147 | Within about 5 of baseline. |
| jev | structure | 144 | 141 | Within noise. |
| laya | thresholds | 106 (7 errors) | 110 (20 errors) | Higher primary comes with 7 to 27 errors per run (deadline), so it is not usable as is. |
| laya | wording | 102 (23 errors) | 102 (22 errors) | Same: errors. |
| laya | evidence | 63 | 63 | No effect; truncated asks fell from 27 to 3 but no case changed. |
| laya | structure | 53 | 69 | Round 2 reduced cbFP to 5 but cbRecalled dropped. |

## What changed in each final pack and why

- **jev.json** and **laya.json**: the name only (`jev-tuned-r2`, `laya-tuned-r2`). No prompt, threshold, structure or evidence change survived the gate, so they resolve to the built-in pack exactly (a test asserts this). They exist so the run's outcome is reproducible with `--prompt-pack jev=services/api/src/providers/packs/jev.json` and so a confirmed pack can replace them without touching the registry shape.
- Not changed in `PROMPT_PACKS`: both providers keep `DEFAULT_PROMPT_PACK`.

## Laya at 1024 state tokens and 512 head tokens (separate track)

Why: `docs/jev-laya-evaluation.md` and `head-truncation-audit.json` show 512-token state truncation and clipped 192-token question heads. This track reruns the judge with `--laya-max-len` and `--laya-head-max-len` at 1024/512. The harness only accepts those flags with `--modes judge` (`apps/console/src/provider-eval/cli.ts`, line 48), so only judge mode was run (24 cases per split) and the observations are `judge_context_diagnostic`. Admission, pipeline and ClaimBuster fields are 0 and `complete=false` in those metrics because those modes were not run.

| Run | judgeCorrect / 24 | truncated asks | wrongDef | errors | judge p95 s |
|---|---:|---:|---:|---:|---:|
| baseline pack, dev | 4 | 24 | 0 | 0 | 43.6 |
| final pack, dev | 4 | 24 | 0 | 0 | 30.0 |
| final pack, holdout | 3 | 24 | 0 | 0 | 37.6 |

The larger context did not remove truncation (24 truncated asks everywhere) and judge accuracy did not move; latency is 10 to 15 times higher. The "baseline" and "final" packs were the same empty pack, so these are effectively repeat runs. Server health after each run: device mps, no CPU fallback, no MPS out-of-memory.

## Caveats

- **Dev overfitting risk.** Tuning on dev (59 + 90 + 24 cases) with 3 attempts per family and 2 rounds invites picking noise. The gate and holdout exist for that reason; the unconfirmed dev gains above must be confirmed on the holdout.
- **Holdout is generated, not blind.** Its admission and cohort cases were written and verified by the same team that designed the packs, and only the ClaimBuster sets are external.
- **ClaimBuster label noise and no debate context.** Labels are crowd-sourced; sentences are scored without the previous turn. Six NFS cases were flagged as probably checkable (`cbCorrectExFlagged` drops them); Jev's cbFP of 14 to 26 partly reflects this, and the UFS set is not scored.
- **Small samples.** 24 pipeline and 24 judge cases move in steps of 1/24; the noise floor is 2 to 3 primary points.
- **Confirmation runs did not complete**, so the 16 gate nodes carry no information about the families. The study therefore shows that the pipeline works end to end, not that prompt packs cannot help.
- **Laya shared a single GPU server with serialized access**; its latency is inflated by other runs and its high-primary attempts are mostly deadline errors.

## Shared-code changes

None in this change set. It adds data (`fixtures/evaluation/provider-comparison/claimbuster/`), two opt-in pack files, a test that loads them, two scripts in `apps/console/scripts/` and docs. Runtime code changed earlier in this PR (injectable `PipelineRuntime` deadline for Laya evaluation, harness flags `--prompt-pack`, `--laya-deadline-ms`, `--lock`; see `docs/prompt-pack.md`). Not changed: types, DB schema, API contracts, `PROMPT_PACKS`. Harness gap found: `--laya-max-len` and `--laya-head-max-len` are refused outside judge-only runs, which limits the 1024/512 track.
