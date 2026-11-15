# Per-provider prompt tuning (issue #69)

Question: can a provider-specific prompt pack (`docs/prompt-pack.md`) close the Jev/Laya gap or improve Jev, without code changes?

**Outcome (supersedes the earlier versions of this report).**
- **Laya: shipped.** `services/api/src/providers/packs/laya.json` (`laya-wording-r2a2`) is Laya's default in `PROMPT_PACKS`. Holdout primary 94 against 69 for the built-in pack, ClaimBuster false positives 10 against 13, adm59 false positives 4 against 5, no errors. This replaces the previous ship (`laya-structure-r2a2`, holdout 79 against 69), which was measured while a plumbing bug capped Laya at the default deadline.
- **Jev: shipped.** `packs/jev.json` (`jev-stack-1`) is Jev's default in `PROMPT_PACKS`. Paired holdout (v4): primary 178 against 165 for the built-in pack, adm59 false positives 1 against 4, ClaimBuster false positives 2 against 15, no wrong definitive verdicts, no errors, pipeline p95 0.87 s. Dev: 174 against 140. The two earlier paired holdouts (v2, v3) failed on a Jev outage (`jev_unavailable` in all 227 cases); v4 re-ran the pair once Jev was reachable again.
- **This changes production Jev requests** (admission kind criteria, admission thresholds, judge claim_risk criteria). Production default provider stays Jev. The Laya numbers are not production-realistic (see Latency).
- **Jev's packs on Laya (transfer test):** only Jev's threshold change carries over (Laya holdout 81 against 69); Jev's wording makes Laya worse. Laya's own wording pack (94) remains Laya's best. See "Jev packs applied to Laya".

## Laya pipeline timeout: root cause and fix (commit 3faf727)

Earlier Laya confirmation runs showed 19 `jev_unavailable` errors at about 1005 ms and 4 `runtime_not_settled` errors at about 10506 ms in pipeline mode. Cause: the eval plumbing did not honour the raised Laya deadline (`--laya-deadline-ms`) in two places.
1. The settlement wait stayed at its 10_500 ms default, which produced `runtime_not_settled`.
2. The continuation-wait cap was hard-coded to 8_000 ms in `services/api/src/runtime/pipeline.ts`.

Fix: the cap is now an injectable constructor parameter `waitCapMs` (default 8_000). The eval sets it to `deadline - 2000` and the settlement wait to `deadline + 500`. At the 10_000 ms default these stay 8_000 and 10_500, so production is unchanged. The change is in `apps/console/src/provider-eval/benchmark.ts` (with its test) and `pipeline.ts` (with `services/api/tests/runtime/deadline.test.ts`).

The ~1 s errors were not a Laya client or abort bug. Temporary logging (removed before commit) showed that every one was an HTTP 503 from the Laya server, which runs with `LAYA_MAX_CONCURRENT=1` and rejects a request that arrives while another is still running; the client retries once after 100 ms, which gives the ~1005 ms. The colliding requests were left running on the server: a pipeline case that hit `runtime_not_settled` at 10.5 s kept its runtime sending Laya requests, so the next case got 503s and one timeout cascaded into a run of errors; a run killed mid-judge did the same (15 503s at the next run's start). This was not reproduced inside a clean run. Repro with the old code (admission, pipeline, judge, dev, `--laya-deadline-ms 60000`): 21 pipeline error rows; after the fix (admission and pipeline on dev, 59 admission and 24 pipeline cases): 0 errors, cases settle in about 0.3 to 10 s. `npm run check` passes.

Limit that remains: a concurrency-1 Laya server returns 503 whenever overlapping requests reach it, which eval plumbing cannot remove. Keep evals serialised: one eval at a time per server, with `--lock`.

## Method

- **Data.** Dev: 59 admission cases + 24 cohort cases (original data) + 120 ClaimBuster dev sentences. Holdout: 59 admission + 24 cohort cases (generated, verified) + 120 ClaimBuster holdout sentences from different debates. ClaimBuster (`fixtures/evaluation/provider-comparison/claimbuster/README.md`): 50 CFS (must be admitted), 40 NFS (must be skipped), 30 UFS (reported only as `ufsAdmitted`). Cohort evidence is frozen, so runs replay the same excerpts. `DATASET.md` and `dataset-complete.json` list the ClaimBuster sets.
- **Metric.** `primary = adm59Correct + cbCorrect (CFS+NFS, 90) + pipelineCorrect + judgeCorrect`, out of 59 + 90 + 24 + 24 = 197. Also tracked: `cbFP` (NFS admitted), `cbRecalled`, `cbCorrectExFlagged` (without 6 auditor-flagged NFS ids), `ufsAdmitted`, `wrongDefinitive`, `errors`, `truncatedAsks`, latency p95.
- **Noise (eps = 2).** Repeated identical-pack baseline runs on dev differed by up to about 2 points of primary, so eps = 2.
- **Gate.** A candidate passes only if a separate confirmation run on dev beats the dev baseline by at least `minGain = 3` primary points (more than eps) with `adm59FP <= 1`, `wrongDefinitive = 0` and `errors = 0`, and no more ClaimBuster false positives than the reference where that applies. The reason strings in the tables below are the gate's own output.
- **Families.** wording (shorter, plainer instructions and criteria), evidence (item count, excerpt clipping, order, fields), thresholds (admission and judge probabilities, `judge.policy`), structure (fewer, merged or added options through `criteria` and `optionMap`).
- **Rounds and confirmation.** Two rounds of up to 3 attempts per family per provider on dev; the best attempt of each family was re-run as a confirmation.
- **Greedy stacking.** The best confirmed single variant starts the stack; each further confirmed candidate is merged in (conflicts reconciled by hand), evaluated on dev and kept only if it gains at least 3 over the running stack.
- **Refine round.** One refine pass per provider and family starts from the stack and tries up to 3 more single-change attempts against the stack's dev score, with the same gate.
- **Paired holdout.** Baseline and final pack are each run once on the holdout, per provider, back to back so both see the same server state. Ship rule: holdout primary gain of at least 3 (eps = 2), total false positives (adm59 + ClaimBuster) at most the baseline's + 2, wrong definitive verdicts and errors not above the baseline; a failed run never ships. Dev gate for candidates: gain of at least 3, adm59 FP at most max(baseline, 1), cbFP and wrongDef and errors not above the baseline, Jev pipeline p95 under 10 s.
- **First run and recovery.** The first tuning run (`tune/r1`, `tune/r2`) produced candidate packs, but its confirmation step was invoked with an undefined pack path (a workflow script bug: the node agents had no output schema), so no gate ran and the first version of this report described a failed run. This recovery run re-measured every candidate with confirmation runs, redid stacking, refine and the holdout. The Laya pipeline timeout and the Jev outage found afterwards are described above and below.

## Results

All Laya numbers below are from the re-run after the deadline fix (v3) unless stated. The Jev dev numbers are from the earlier recovery run (v2): Jev was not affected by the Laya plumbing and was not re-measured on dev.

### Laya dev: baseline

| Pack | primary | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | wrongDef | errors | pipeline p95 ms | judge p95 ms |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|
| built-in | 63 | 21 (0) | 38 / 11 | 0 | 4 | 0 | 0 | 824 | 6338 |

### Laya re-confirm (dev confirmation runs, v3)

Gain is against the Laya dev baseline (63). Gate: gain >= 3, adm59 FP <= 1, wrongDef = 0, errors = 0.

| Candidate | Family | Gate | primary | gain | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | errors | pipeline p95 ms | judge p95 ms | Pass or fail reason |
|---|---|---|---:|---:|---|---|---:|---:|---:|---:|---:|---|
| r1/laya-thresholds-a2 | thresholds | not gated | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | run did not finish (no metrics.json); superseded by the r2 thresholds candidate |
| r1/laya-wording-a1 | wording | not gated | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | run did not finish (no metrics.json); superseded by the r2 wording candidate |
| r2/laya-wording-a2 | wording | PASS | 100 | +37 | 44 (1) | 48 / 10 | 4 | 4 | 0 | 16206 | 5746 | gain 37 >= 3, adm59 FP 1 <= 1, errors 0, wrongDef 0 |
| r2/laya-thresholds-a3 | thresholds | PASS | 88 | +25 | 38 (1) | 46 / 3 | 0 | 4 | 0 | 12912 | 6747 | gain 25 >= 3, adm59 FP 1 <= 1, errors 0, wrongDef 0 |
| r2/laya-structure-a2 | structure | PASS | 69 | +6 | 21 (0) | 44 / 5 | 0 | 4 | 0 | 1233 | 5898 | gain 6 >= 3, adm59 FP 0, errors 0, wrongDef 0 |

In the earlier (v2) run the wording and thresholds candidates failed with 22 to 25 errors per run: those were the timeouts and 503 cascade above, not the packs. With the plumbing fixed they run clean and are the strongest candidates. The two r1 runs are not counted either way; their r2 siblings cover the same families.

### Laya stack

Start: `r2/laya-wording-a2` (best confirmed single, 100).

| Step | Candidate | Accepted | Stack primary | Reason |
|---|---|---|---:|---|
| 1 | r2/laya-wording-a2 | yes | 100 | best confirmed single variant |
| 2 | r2/laya-thresholds-a3 | no | 71 | gain -29 < 3. Keys disjoint (thresholds sets only `admission.thresholds`); merged pack `laya-v3-stack-1` |
| 3 | r2/laya-structure-a2 | no | 93 | gain -7 < 3 and adm59 FP 3 > 1. Conflicts: `name`, and `admission.choice.kind.criteria` set by both; the structure criteria (plus `optionMap`) were taken, the stack's `kind.instructions` kept |

The final Laya pack is the single wording pack.

### Laya holdout (paired, v3)

| Pack | primary | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | wrongDef | errors | pipeline p95 ms | judge p95 ms |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|
| built-in | 69 | 26 (5) | 40 / 13 | 0 | 3 | 0 | 0 | 1466 | 6823 |
| laya-wording-r2a2 | 94 | 40 (4) | 49 / 10 | 2 | 3 | 0 | 0 | 14855 | 10933 |

Ship rule: primary 94 >= 69, cbFP 10 <= 13, wrongDef 0, errors 0, so **laya ship = true**. The gain comes mostly from admission: adm59 correct 26 to 40 and ClaimBuster correct 40 to 49, with false positives not higher.

### Jev holdout (paired, v4)

| Pack | primary | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | wrongDef | errors | pipeline p95 ms |
|---|---:|---|---|---:|---:|---:|---:|---:|
| built-in | 165 | 55 (4) | 74 / 15 | 18 | 18 | 0 | 0 | 892 |
| jev-stack-1 | 178 | 56 (1) | 86 / 2 | 19 | 17 | 0 | 0 | 865 |

Ship rule: gain 13 >= 3; false positives 3 <= 19 + 2; wrongDef 0 and errors 0, equal to the baseline; p95 under 10 s. So **jev ship = true**. As on dev, the gain is admission precision (ClaimBuster false positives 15 to 2); pipeline and judge move by one case each, within noise.

Earlier attempts: the v2 and v3 paired holdouts both finished with `jev_unavailable` in all 227 cases (`complete = true`, `primary = 0`, not -1 as an earlier version of this report said). That was a Jev outage: a probe right after returned normal answers on dev and holdout cases. An earlier, unpaired built-in holdout (`tune/baseline/jev-holdout`, primary 168) agrees with the v4 baseline (165) within noise; the gate uses only the back-to-back pair.

### Jev dev (v2, unchanged)

| Pack | primary | adm59 (FP) | cbCorrect / cbFP / cbRecalled | ufsAdmitted | pipeline | judge | wrongDef | errors | pipeline p95 ms | judge p95 ms |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| built-in | 140 | 55 (1) | 61 / 26 / 47 | 23 | 12 | 12 | 0 | 0 | 846 | 313 |
| jev-stack-1 | 174 | 58 (1) | 86 / 3 / 49 | 25 | 16 | 14 | 0 | 0 | 1004 | 355 |

### Jev confirmed candidates (dev, v2)

Gain is against the Jev dev baseline (140). Gate as above.

| Candidate | Family | Gate | primary | gain | adm59 (FP) | cbCorrect / cbFP | pipeline | judge | errors | Pass or fail reason |
|---|---|---|---:|---:|---|---|---:|---:|---:|---|
| r1/jev-wording-a2 | wording | PASS | 160 | +20 | 55 (1) | 74 / 13 | 16 | 15 | 0 | gain 20 >= 3, adm59 FP 1, errors 0 |
| r1/jev-thresholds-a1 | thresholds | PASS | 160 | +20 | 58 (1) | 78 / 11 | 12 | 12 | 0 | gain 20 >= 3, adm59 FP 1, errors 0 |
| r1/jev-structure-a3 | structure | FAIL | 140 | 0 | 55 (1) | 62 / 25 | 12 | 11 | 0 | gain 0 < 3 |
| r1/jev-evidence-a3 | evidence | PASS | 144 | +4 | 56 (1) | 64 / 24 | 12 | 12 | 0 | gain 4 >= 3, adm59 FP 1, errors 0 |
| r2/jev-evidence-a2 | evidence | PASS | 145 | +5 | 55 (1) | 62 / 25 | 14 | 14 | 0 | gain 5 >= 3, adm59 FP 1, errors 0 |
| r2/jev-wording-a1 | wording | PASS | 157 | +17 | 55 (1) | 79 / 7 | 12 | 11 | 0 | gain 17 >= 3, adm59 FP 1, errors 0 |
| r2/jev-thresholds-a1 | thresholds | PASS | 156 | +16 | 55 (1) | 77 / 8 | 12 | 12 | 0 | gain 16 >= 3, adm59 FP 1, errors 0 |

### Jev stack log (v2)

Starting from `r1/jev-wording-a2` (160):

| Step | Candidate | Accepted | Dev primary | Reason |
|---|---|---|---:|---|
| 1 | r1/jev-wording-a2 | yes | 160 | best confirmed single variant |
| 2 | r1/jev-thresholds-a1 | yes | 174 | gain 14 >= 3; no key conflicts (wording sets `admission.choice.kind.criteria` and `judge.claim_risk.criteria`; thresholds sets only `admission.thresholds`); pack `jev-stack-1` |
| 3 | r2/jev-wording-a1 | no | 174 | gain 0 < 3 (kind criteria reconciled by hand) |
| 4 | r2/jev-thresholds-a1 | no | 173 | gain -1 < 3 (kept claim 0.6 over the candidate's 0.8) |
| 5 | r2/jev-evidence-a2 | no | 176 | gain 2 < 3 |
| 6 | r1/jev-evidence-a3 | no | 170 | gain -4 < 3 |

### Refine round (v2)

The Jev refine nodes returned the start pack unchanged or within noise; every attempt failed the +3 gate against the stack: evidence variants 168 to 174, threshold variants 171 to 175 (+1, inside eps), structure variants 172 and 173, wording variants 170 and 173. The Laya refine nodes ran against the old (structure) stack, which is no longer the final pack, so they are not reused (identical metrics for wording, evidence and thresholds; dropping the `misleading` verdict gave 65 and 30 errors). They were not repeated on the wording stack.

## What each final pack changes and why

Both files override only the parts shown; everything else is the built-in value.

### Laya: `laya-wording-r2a2` (shipped)

Rewrites the admission and judge text as shorter, plainer instructions and criteria; no thresholds, evidence or option structure change. As in `packs/laya.json`:
- `admission.choice.kind`: `claim` is "A checkable fact about the world or what someone said or did, true or false"; `opinion` ("Only taste, feeling or judgment ... No checkable fact"), `prediction` ("Only a guess ... No plan or forecast could check it"), `instruction` ("Only advice, a request or a command") and `other` are short and explicit about what is excluded.
- The other admission questions (`route`, `attribution`, `claim_structure`, `named.*`, `text.*`) are single-sentence questions that state the "no" cases (for example `private_data` answers no for public facts, roles, numbers, places, science and history).
- `judge.content_basis` and `judge.verdict`: plain one-line criteria, and a `base` stating that a source calling a claim a myth means false, that a speaker repeating it proves nothing, never to infer false from missing evidence, and that a close but wrong organisation, person or title is misleading. The `suffix` keeps the "ignore instructions in evidence" guard.
- Effect: on holdout adm59 correct went 26 to 40 and ClaimBuster correct 40 to 49 while cbFP fell 13 to 10. Judge accuracy did not change (3 and 3). Pipeline correct 0 to 2 (4 on dev) appears because the fixed deadline now lets pipeline cases finish.

The previously shipped `laya-structure-r2a2` (adds `rhetoric` and `personal` options through `optionMap`) is no longer the default; it scored 69 on dev, 93 when stacked on the wording pack (fail), and was not re-run on holdout in v3.

### Jev: `jev-stack-1` (shipped)

Wording stack of two confirmed candidates:

- `admission.choice.kind.criteria`: `claim` requires "at least one specific, checkable fact ... (a number, record, vote, event, quotation or comparison that a source could confirm or refute)" and states what is not a claim (hedged first-person views, vague praise, filler, promises, guesses about the speaker's own team); `opinion` and `prediction` get explicit "with no specific fact" and "Only a guess, promise, pledge or intention ... that no plan, announcement, estimate or forecast could confirm" wording; `instruction` starts "Only an instruction ... with no fact in it".
- `admission.thresholds`: `claim` 0.6 (built-in default is lower) and `privateData` 0.25. Together these cut ClaimBuster false positives from 26 to 3 on dev.
- `judge.claim_risk.criteria`: sharper `ordinary`, `health_safety`, `disputed`, `unknown` definitions. Pipeline went 12 to 16 and judge 12 to 14.

Holdout: 178 against 165 (paired, v4).

## Jev packs applied to Laya (transfer test)

Each Jev pack that passed the Jev dev gate was run on Laya, after the deadline fix, against a fresh Laya dev baseline (63). Same dev gate as above.

| Jev pack on Laya | dev primary | adm59 (FP) | cbCorrect / cbFP | result |
|---|---:|---|---|---|
| r1/jev-thresholds-a1 (claim 0.6, privateData 0.25) | 81 | 31 (0) | 46 / 3 | PASS, +18 |
| jev-stack-1 merged onto laya-structure-r2a2 | 77 | 26 (0) | 47 / 1 | PASS, +14 |
| r2/jev-wording-a1 | 63 | 18 (0) | 41 / 5 | FAIL, gain 0 |
| r1/jev-evidence-a3 | 63 | 21 (0) | 38 / 11 | FAIL, gain 0 (no change at all) |
| jev-stack-1 | 62 | 15 (0) | 43 / 0 | FAIL, gain -1 |
| r1/jev-wording-a2 | 59 | 21 (0) | 34 / 15 | FAIL, gain -4, cbFP 15 > 11 |
| r2/jev-thresholds-a1 (claim 0.8) | 55 | 11 (0) | 40 / 0 | FAIL, gain -8 |
| r2/jev-evidence-a2 | n/a | | | not measured (the run did not finish) |

Paired Laya holdout for the best transfer, `r1/jev-thresholds-a1`: 81 against 69 (adm59 FP 1 against 5, cbFP 3 against 13, pipeline 2 against 0, no errors). That is below Laya's own wording pack (94 on holdout), so it is not shipped.

Stacking the transfer onto the wording pack (`laya-wording-r2a2` plus claim 0.6 and privateData 0.25) scored 69 on dev against 100 for the wording pack alone (repeat run, same window; baseline 63): it became too strict (adm59 correct 20 against 44). Laya stays on `laya-wording-r2a2`.

Reading: Laya's main weakness is admission recall and precision. A higher claim threshold fixes precision on the built-in prompts, but Jev's wording is tuned to how Jev reads questions and does not help Laya, and evidence layout has no effect because Laya's judge is limited by truncation.

## Laya at 1024 state tokens and 512 head tokens (separate track)

Why: `docs/jev-laya-evaluation.md` and `head-truncation-audit.json` show 512-token state truncation and clipped 192-token question heads. This track reruns the judge with `--laya-max-len 1024 --laya-head-max-len 512 --laya-deadline-ms 60000`. The harness only accepts those flags with `--modes judge` (`apps/console/src/provider-eval/cli.ts`, line 48), so `eval.sh` (admission, pipeline and judge) cannot be used and judge-only runs went through a custom script. Admission, ClaimBuster and pipeline fields are therefore 0 and `metrics.json` shows `complete=false`; that is expected. A first attempt that reported all zeros was this flag restriction, not a bug.

| Run | judgeCorrect / 24 | truncated asks | wrongDef | errors | judge p95 s |
|---|---:|---:|---:|---:|---:|
| built-in pack, dev | 4 | 24 | 0 | 0 | 11.5 |
| laya-structure-r2a2, dev | 4 | 24 | 0 | 0 | 15.5 |
| laya-structure-r2a2, holdout | 3 | 24 | 0 | 0 | 12.8 |

Even 1024/512 truncates every ask (24 of 24), and judge accuracy did not move from the 512 runs (4 and 3). The pack only changes admission, so equal judge scores are expected. Server health before and after each run: status ok, device mps, no CPU fallback, no out-of-memory. The earlier attempt measured 30 to 44 s judge p95; these runs are faster, probably from lower machine load.

## Latency notes

- Jev (hosted API) latency is low and stable: pipeline p95 about 0.8 to 1.0 s, judge p95 about 0.3 s, on dev and on the unpaired built-in holdout.
- **Laya eval runs use a raised deadline (60 s) and per-call cap; production uses 10 s.** Production-realistic Laya latency is **not measured**, and these numbers must not be read as production latency.
- The shipped wording pack on Laya has pipeline p95 of 16.2 s (dev confirmation) and 14.9 s (holdout), and judge p95 of 5.7 s and 10.9 s. The pipeline p95s are over the 10 s production deadline, so in production the pipeline cases that give `pipelineCorrect` 4 (dev) and 2 (holdout) would likely time out. The built-in pack's pipeline p95 is only 0.8 to 1.5 s because its pipeline cases mostly abstain early (pipelineCorrect 0), not because it is faster per request.
- Run-to-run spread also comes from other eval processes sharing one serialised GPU server, so a pack's latency effect is not cleanly separable from load.
- Laya truncated the judge ask in 25 to 27 of 48 cases at the default length (`truncatedAsks`, measured in the earlier run, not re-reported in v3), so Laya's judge stays limited regardless of prompts.

## Caveats

- **Dev overfitting.** Tuning on dev with up to 3 attempts per family, two rounds and stacking selects on noise as well as signal. The Jev dev gain (140 to 174) held on holdout (165 to 178). The Laya dev gain (63 to 100) held on holdout (69 to 94).
- **Holdout is generated, not blind.** Its admission and cohort cases were written and verified by the same team that designed the packs; only the ClaimBuster sets are external.
- **ClaimBuster label noise and no debate context.** Labels are crowd-sourced and sentences are scored without the previous turn. Six NFS cases were flagged as probably checkable. UFS is not scored.
- **Run-to-run noise.** Jev repeats differ by about 2 points (eps = 2); a +3 gate is only just above that. Laya is more variable under load, and the stacked packs that lost to the single wording pack (71 and 93 against 100) show that merging Laya packs is not additive. 24 pipeline and 24 judge cases move in steps of 1/24.
- **Laya is serial-only.** A concurrency-1 server returns 503 on overlap; run one eval at a time with `--lock`.
- **Jev holdout needed three attempts.** The first two failed on a Jev outage; the decision uses the third, paired run.
- **Laya is better at admission, not at judging.** Judge scores are unchanged.

## Shared-code changes

`PROMPT_PACKS.jev` and `PROMPT_PACKS.laya` load `packs/jev.json` and `packs/laya.json` (a synchronous read at module load in `prompt-pack.ts`). **This changes production requests for both providers**; the built-in pack (byte-identical to the pre-pack code, golden test) stays available as `DEFAULT_PROMPT_PACK`. The pack test asserts that each default equals its loaded file (`jev-stack-1`, `laya-wording-r2a2`) and differs from the built-in pack. Earlier in this PR: data (`fixtures/evaluation/provider-comparison/claimbuster/`), the injectable `PipelineRuntime` deadline and `waitCapMs` (default unchanged), harness flags `--prompt-pack`, `--laya-deadline-ms`, `--lock`, and tuning scripts in `apps/console/scripts/`.
