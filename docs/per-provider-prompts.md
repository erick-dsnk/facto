# Per-provider prompt tuning (issue #69)

Question: can a provider-specific prompt pack (`docs/prompt-pack.md`) close the Jev/Laya gap or improve Jev, without code changes?

**Outcome.**
- **Laya: shipped.** `services/api/src/providers/packs/laya.json` (`laya-structure-r2a2`) is now Laya's default in `PROMPT_PACKS`. It passed the dev gate and beat the built-in pack on the holdout (79 against 69, ClaimBuster false positives 3 against 13).
- **Jev: not shipped, opt-in.** `packs/jev.json` (`jev-stack-1`) lifts dev from 140 to 174, but the Jev holdout runs both failed (227 errors each, no metrics), so the ship rule had no holdout to check. Jev keeps the built-in pack. The file is kept for `--prompt-pack` use and for a re-run of the holdout.
- Production default provider stays Jev, on the built-in pack. The Laya numbers are not production-realistic (see Latency).

## Method

- **Data.** Dev: 59 admission cases + 24 cohort cases (original data) + 120 ClaimBuster dev sentences. Holdout: 59 admission + 24 cohort cases (generated, verified) + 120 ClaimBuster holdout sentences from different debates. ClaimBuster (`fixtures/evaluation/provider-comparison/claimbuster/README.md`): 50 CFS (must be admitted), 40 NFS (must be skipped), 30 UFS (reported only as `ufsAdmitted`). Cohort evidence is frozen, so runs replay the same excerpts. `DATASET.md` and `dataset-complete.json` list the ClaimBuster sets.
- **Metric.** `primary = adm59Correct + cbCorrect (CFS+NFS, 90) + pipelineCorrect + judgeCorrect`, out of 59 + 90 + 24 + 24 = 197. Also tracked: `cbFP` (NFS admitted), `cbRecalled`, `cbCorrectExFlagged` (without 6 auditor-flagged NFS ids), `ufsAdmitted`, `wrongDefinitive`, `errors`, `truncatedAsks`, latency p95.
- **Noise (eps = 2).** Repeated identical-pack baseline runs on dev differed by up to about 2 points of primary, so eps = 2.
- **Gate.** A candidate passes only if a separate confirmation run on dev beats the dev baseline by at least `minGain = 3` primary points (more than eps) with `adm59FP <= 1`, `wrongDefinitive = 0` and `errors = 0`, and no more ClaimBuster false positives than the reference where that applies. The reason strings in the tables below are the gate's own output.
- **Families.** wording (shorter, plainer instructions and criteria), evidence (item count, excerpt clipping, order, fields), thresholds (admission and judge probabilities, `judge.policy`), structure (fewer, merged or added options through `criteria` and `optionMap`).
- **Rounds and confirmation.** Two rounds of up to 3 attempts per family per provider on dev; the best attempt of each family was re-run as a confirmation.
- **Greedy stacking.** The best confirmed single variant starts the stack; each further confirmed candidate is merged in (conflicts reconciled by hand), evaluated on dev and kept only if it gains at least 3 over the running stack.
- **Refine round.** One refine pass per provider and family starts from the stack and tries up to 3 more single-change attempts against the stack's dev score, with the same gate.
- **Paired holdout.** Baseline and final pack are each run once on the holdout, per provider. Ship rule: holdout primary of the final pack at least the baseline, and holdout cbFP not higher.
- **First run and recovery.** The first tuning run (`tune/r1`, `tune/r2`) produced candidate packs, but its confirmation step was invoked with an undefined pack path (a workflow script bug: the node agents had no output schema), so no gate ran and the first version of this report described a failed run. This recovery run re-measured every candidate with confirmation runs, redid stacking, refine and the holdout. Jev's holdout runs failed in the recovery run (below), which is why Jev is not shipped.

## Results

### Baseline against final, dev

| Provider | Pack | primary | adm59 (FP) | cbCorrect / cbFP / cbRecalled | ufsAdmitted | pipeline | judge | wrongDef | errors | truncated asks | pipeline p95 ms | judge p95 ms |
|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jev | built-in | 140 | 55 (1) | 61 / 26 / 47 | 23 | 12 | 12 | 0 | 0 | 0 | 846 | 313 |
| Jev | jev-stack-1 | 174 | 58 (1) | 86 / 3 / 49 | 25 | 16 | 14 | 0 | 0 | 0 | 1004 | 355 |
| Laya | built-in | 63 | 21 (0) | 38 / 11 / 9 | 22 | 0 | 4 | 0 | 0 | 27 | 8509 | 27789 |
| Laya | laya-structure-r2a2 | 69 | 21 (0) | 44 / 5 / 9 | 13 | 0 | 4 | 0 | 0 | 27 | 1340 | 8674 |

### Baseline against final, holdout

| Provider | Pack | primary | adm59 (FP) | cbCorrect / cbFP / cbRecalled | ufsAdmitted | pipeline | judge | wrongDef | errors | truncated asks | pipeline p95 ms | judge p95 ms |
|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jev | built-in | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 227 | n/a | n/a | n/a |
| Jev | jev-stack-1 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 227 | n/a | n/a | n/a |
| Laya | built-in | 69 | 26 (5) | 40 / 13 / 13 | 16 | 0 | 3 | 0 | 0 | 25 | 1116 | 4856 |
| Laya | laya-structure-r2a2 | 79 | 28 (2) | 48 / 3 / 11 | 9 | 0 | 3 | 0 | 0 | 25 | 614 | 5251 |

The Jev holdout rows are failures, not zeros: every case errored (227 errors), `metrics.json` carries `primary = -1`, so nothing can be said about Jev on the holdout. The cause was not diagnosed in this step. The cohort/holdout fixtures and the Laya runs were unaffected.

Ship decision: **laya ship = true** (holdout 79 >= 69, cbFP 3 <= 13, no wrong-definitive answers or errors); **jev ship = false** (reason: missing holdout metrics).

### Confirmed candidates (dev confirmation runs)

Gain is against the dev baseline of the same provider (Jev 140, Laya 63). Laya confirmation runs with `errors > 0` fail the gate: they hit the 60 s deadline or per-call cap.

| Candidate | Family | Gate | primary | gain | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | errors | Fail reasons |
|---|---|---|---:|---:|---|---|---:|---:|---:|---|
| r1/jev-wording-a2 | wording | PASS | 160 | +20 | 55 (1) | 74 / 13 | 16 | 15 | 0 | |
| r1/jev-thresholds-a1 | thresholds | PASS | 160 | +20 | 58 (1) | 78 / 11 | 12 | 12 | 0 | |
| r1/jev-structure-a3 | structure | FAIL | 140 | 0 | 55 (1) | 62 / 25 | 12 | 11 | 0 | gain 0 < 3 |
| r1/jev-evidence-a3 | evidence | PASS | 144 | +4 | 56 (1) | 64 / 24 | 12 | 12 | 0 | |
| r2/jev-evidence-a2 | evidence | PASS | 145 | +5 | 55 (1) | 62 / 25 | 14 | 14 | 0 | |
| r2/jev-wording-a1 | wording | PASS | 157 | +17 | 55 (1) | 79 / 7 | 12 | 11 | 0 | |
| r2/jev-thresholds-a1 | thresholds | PASS | 156 | +16 | 55 (1) | 77 / 8 | 12 | 12 | 0 | |
| r1/laya-thresholds-a2 | thresholds | FAIL | 103 | +40 | 43 (0) | 56 / 9 | 0 | 4 | 23 | errors 23 > 0 |
| r1/laya-wording-a1 | wording | FAIL | 102 | +39 | 43 (3) | 55 / 4 | 0 | 4 | 23 | adm59 FP 3 > 1; errors 23 > 0 |
| r2/laya-structure-a2 | structure | PASS | 69 | +6 | 21 (0) | 44 / 5 | 0 | 4 | 0 | |
| r2/laya-thresholds-a3 | thresholds | FAIL | 88 | +25 | 38 (1) | 46 / 3 | 0 | 4 | 22 | errors 22 > 0 |
| r2/laya-wording-a2 | wording | FAIL | 96 | +33 | 44 (1) | 48 / 10 | 0 | 4 | 25 | errors 25 > 0 |

The large Laya "gains" of the failed candidates are not real: those runs lost 22 to 25 cases to errors and their primary comes from admission cases that finished. They are not usable.

### Stack logs

Jev, starting from `r1/jev-wording-a2` (best confirmed single, 160):

| Step | Candidate | Accepted | Dev primary | Reason or note |
|---|---|---|---:|---|
| 1 | r1/jev-wording-a2 | yes | 160 | best confirmed single variant |
| 2 | r1/jev-thresholds-a1 | yes | 174 | no key conflicts (wording sets `admission.choice.kind.criteria` and `judge.claim_risk.criteria`; thresholds sets only `admission.thresholds`); pack `jev-stack-1` |
| 3 | r2/jev-wording-a1 | no | 174 | gain 0 < 3 (merged pack, kind criteria reconciled by hand) |
| 4 | r2/jev-thresholds-a1 | no | 173 | gain -1 < 3 (kept claim 0.6 over the candidate's 0.8) |
| 5 | r2/jev-evidence-a2 | no | 176 | gain 2 < 3 |
| 6 | r1/jev-evidence-a3 | no | 170 | gain -4 < 3 |

Laya: only `r2/laya-structure-a2` was confirmed, so the stack is that single pack (69). Second stacking pass: empty for both providers.

### Refine round

All nine refine nodes returned the start pack unchanged (gain 0, "no change proposed"), so the finals are the stacks.

| Node | Attempts and outcome |
|---|---|
| jev wording | Reworded `judge.origin` to count distinct publishers (170; P07 origin probabilities rose from about 0.07 to 0.6-0.77 but P07, P08, P11 still abstain, so origin wording is not the limit); loosened `judge.content_basis` wording (173). Most of the 10 judge and 8 pipeline misses are `insufficient_independent_evidence`. |
| jev evidence | maxItems 3, excerptChars 700, titleChars 160: 174 (tie); maxItems 3, excerptChars 500, label `passage_text`: 171; maxItems 2, excerptChars 900: 168. |
| jev thresholds | judge relevant/scope 0.7 plus lower policy: 173; admission claim 0.5: 171 (cbFP 5); judge relevant/scope 0.7 only: 175 (+1, inside noise). Pipeline and judge counts stayed 16 and 14. |
| jev structure | Split `claim` into two options: 172; added a `filler` option mapped to `other`: 173. |
| laya wording | `kind.claim` listing statistics, numbers, dates, comparisons, rankings, cause and effect: identical metrics (69). |
| laya evidence | maxItems 4, excerptChars 350, titleChars 100, fewer fields: identical primary (69); judge p95 fell from 8674 to 2392 ms and pipeline p95 from 1340 to 490 ms (latency only). |
| laya thresholds | judge relevant/scope 0.85 to 0.7 and lower policy: identical metrics. Judge thresholds are not the limit; admission threshold variants earlier produced 22+ errors. |
| laya structure | Dropped the `misleading` verdict option: 65, judgeCorrect 4 to 0, errors 0 to 30 (fails the gate). |

## What each final pack changes and why

Both files override only the parts shown; everything else is the built-in value.

### Laya: `laya-structure-r2a2` (shipped)

Changes `admission.choice.kind` only. The diff against the built-in pack:

- `claim`: replaced with this text: "It states at least one checkable fact about the world or about what someone said, did or decided, either true or false, whether or not it is actually true, even if it also gives a view or urges something. Myths, rumours and wrong numbers are statements of fact too. A statement about the future counts when official plans, announcements, published estimates or forecasts could confirm or contradict it; a guess about how the speaker's own team, plans or life will turn out does not".
- Two options are **added** to the question the model sees: `rhetoric` ("Rhetoric, a slogan, exaggeration, vague generality or loaded wording that names no specific checkable fact") and `personal` ("Something about the speaker's own feelings, experiences, plans or situation, not a public fact"). `optionMap` collapses both to the canonical `opinion`, so the policy is unchanged.
- Why: Laya's small model admitted many ClaimBuster non-factual sentences (cbFP 13 holdout, 11 dev). Giving it specific "not a fact" buckets for rhetoric and personal statements moved those sentences out of `claim`: cbFP 11 to 5 on dev and 13 to 3 on holdout, adm59 FP 5 to 2 on holdout. Cost: ufsAdmitted fell (22 to 13 dev, 16 to 9 holdout) and holdout cbRecalled fell from 13 to 11, so it is more conservative. Judge and pipeline are unchanged (pipeline 0, judge 4 / 3), so this pack does not fix Laya's judge.

### Jev: `jev-stack-1` (opt-in, not shipped)

Wording stack of two confirmed candidates:

- `admission.choice.kind.criteria`: `claim` requires "at least one specific, checkable fact ... (a number, record, vote, event, quotation or comparison that a source could confirm or refute)" and states what is not a claim (hedged first-person views, vague praise, filler, promises, guesses about the speaker's own team); `opinion` and `prediction` get explicit "with no specific fact" and "Only a guess, promise, pledge or intention ... that no plan, announcement, estimate or forecast could confirm" wording; `instruction` starts "Only an instruction ... with no fact in it".
- `admission.thresholds`: `claim` 0.6 (built-in default is lower) and `privateData` 0.25. Together these cut ClaimBuster false positives from 26 to 3 on dev.
- `judge.claim_risk.criteria`: sharper `ordinary`, `health_safety`, `disputed`, `unknown` definitions (settled science and geography are ordinary, not health_safety or disputed). Pipeline went 12 to 16 and judge 12 to 14.

Why not shipped: no holdout was obtained. The exact pack diffs are in the files; run `git diff` of the JSON against the built-in values via `resolvePromptPack`.

## Laya at 1024 state tokens and 512 head tokens (separate track)

Why: `docs/jev-laya-evaluation.md` and `head-truncation-audit.json` show 512-token state truncation and clipped 192-token question heads. This track reruns the judge with `--laya-max-len 1024 --laya-head-max-len 512 --laya-deadline-ms 60000`. The harness only accepts those flags with `--modes judge` (`apps/console/src/provider-eval/cli.ts`, line 48), so `eval.sh` (admission, pipeline and judge) cannot be used and judge-only runs went through a custom script. Admission, ClaimBuster and pipeline fields are therefore 0 and `metrics.json` shows `complete=false`; that is expected. A first attempt that reported all zeros was this flag restriction, not a bug.

| Run | judgeCorrect / 24 | truncated asks | wrongDef | errors | judge p95 s |
|---|---:|---:|---:|---:|---:|
| built-in pack, dev | 4 | 24 | 0 | 0 | 11.5 |
| laya-structure-r2a2, dev | 4 | 24 | 0 | 0 | 15.5 |
| laya-structure-r2a2, holdout | 3 | 24 | 0 | 0 | 12.8 |

Even 1024/512 truncates every ask (24 of 24), and judge accuracy did not move from the 512 runs (4 and 3). The pack only changes admission, so equal judge scores are expected. Server health before and after each run: status ok, device mps, no CPU fallback, no out-of-memory. The earlier attempt measured 30 to 44 s judge p95; these runs are faster, probably from lower machine load.

## Latency notes

- Jev (hosted API) latency is low and stable: pipeline p95 about 0.8 to 1.0 s, judge p95 about 0.3 s, on both packs.
- **Laya eval runs use a 60 s pipeline deadline and a raised per-call cap.** Production does not. Laya's production-realistic latency is **not measured**, and its eval numbers must not be read as production latency.
- Laya judge p95 in these runs: dev baseline 27.8 s (shared machine), final pack on dev 8.7 s, on holdout 5.3 s (baseline 4.9 s); 1024/512 judge-only runs 11.5 to 15.5 s. Pipeline p95 1.3 s (dev) and 0.6 s (holdout) for the final pack. The spread comes from other eval processes sharing one serialized GPU server, so the pack's effect on latency is not separable from load.
- The failed Laya confirmations (22 to 25 errors per run) show a pipeline p95 pinned at about 10.5 s, which is the per-call cap being hit.
- Laya truncates the judge ask in 25 to 27 of 48 cases at the default length (`truncatedAsks`), and pipelineCorrect is 0 for every Laya pack, so Laya cannot yet issue verdicts in the pipeline regardless of prompts.

## Caveats

- **Dev overfitting.** Tuning on dev with up to 3 attempts per family, two rounds and stacking selects on noise as well as signal. The Jev dev gain (140 to 174) is unverified on holdout. The Laya holdout gain (+10) is real in direction but small in absolute terms, with 5 to 6 points from ClaimBuster false positives.
- **Holdout is generated, not blind.** Its admission and cohort cases were written and verified by the same team that designed the packs; only the ClaimBuster sets are external.
- **ClaimBuster label noise and no debate context.** Labels are crowd-sourced and sentences are scored without the previous turn. Six NFS cases were flagged as probably checkable (`cbCorrectExFlagged` drops them). UFS is not scored.
- **Run-to-run noise.** Jev repeats differ by about 2 points (eps = 2); a +3 gate is only just above that. Laya is more variable under load. 24 pipeline and 24 judge cases move in steps of 1/24.
- **Jev holdout failed** (227 errors in both runs). Jev's ship decision is "missing holdout metrics", not a negative result.
- **Laya is conservative, not better at judging.** Judge and pipeline scores did not change; the gain is admission precision.

## Shared-code changes

`PROMPT_PACKS.laya` now loads `packs/laya.json` (a synchronous read at module load in `prompt-pack.ts`); `PROMPT_PACKS.jev` is unchanged. The pack test asserts that the Jev default stays the built-in pack (byte-identical digests), that the Jev pack loads and differs from it, and that the Laya default equals the loaded Laya pack. Earlier in this PR: data (`fixtures/evaluation/provider-comparison/claimbuster/`), the injectable `PipelineRuntime` deadline, harness flags `--prompt-pack`, `--laya-deadline-ms`, `--lock`, and tuning scripts in `apps/console/scripts/`.
