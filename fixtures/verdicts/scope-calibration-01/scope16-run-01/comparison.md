# Scope question: first paired full-judge experiment

**The candidate produces no fixed-threshold coverage gain in this cohort.** Both
the current question and candidate accept all eight independently labelled scope
matches and reject all eight mismatches at the unchanged .85 threshold. Preserve
the experiment without promotion or threshold tuning on these results.

| Scope-only measure | Baseline | Candidate |
|---|---:|---:|
| Match recall | 8/8 | 8/8 |
| Mismatch false accepts | 0/8 | 0/8 |
| Correct mismatch rejections | 8/8 | 8/8 |
| Missing/failed units | 0 | 0 |

The 16 units represent eight related source-family pairs, all in the predeclared
`open_development` partition. Two AI agents agreed on all 16 labels before model
output. The curator had previously read the production scope prompt during a
different public-failure analysis; candidate wording was not viewed during corpus
authoring. This is open development, not a blind evaluation or population scope
calibration. A single passage is supplied per unit, rather than a whole live
retrieval set. No original held-out or private evaluation bodies were read.

Raw paired source-scope values:

| Unit / stratum | Expected match | Baseline | Candidate |
|---|---|---:|---:|
| SC01 first event versus edition | yes | .88 | .90 |
| SC02 different edition | no | .16 | .04 |
| SC03 same census, different value | yes | .96 | .96 |
| SC04 different census period | no | .10 | .03 |
| SC05 country/continent relation | yes | .91 | .91 |
| SC06 different geographic entity | no | .21 | .08 |
| SC07 formal definition, different value | yes | .85 | .89 |
| SC08 different historical standard | no | .18 | .06 |
| SC09 universal counterexample | yes | .93 | .95 |
| SC10 different taxonomic population | no | .06 | .09 |
| SC11 same age population, different count | yes | .90 | .93 |
| SC12 different age population | no | .08 | .04 |
| SC13 same pressure, different value | yes | .90 | .95 |
| SC14 different pressure condition | no | .14 | .05 |
| SC15 same dimension, different value | yes | .91 | .96 |
| SC16 different relation, same entity | no | .12 | .04 |

Some numerical margins widen, but none changes a pass/fail decision. Probability
movement from one paired pass cannot establish improved calibration, reliability
or useful factual coverage. The candidate did not demonstrate correction of a
baseline error in this cohort.

The full actual `createJudge` request was captured for both arms. State,
retained bytes, question names and every non-scope question were identical; only
`e0_scope` instructions changed. The existing .85 scope decision and all stance,
quality, risk, conflict, corroboration and final-verdict gates remained intact.
No world-knowledge completion, title-derived missing fact or case exception was
added. There were no production edits.

Unintended full-judge spillovers are reported separately: stance probabilities
changed on 8 units, risk confidence on 10, and substantive-quality confidence on
13 (ignoring floating-point representation noise). Stance choices, risk levels,
quality classes, relevance flags, model labels and policy decisions changed on
zero units. None of those confidence changes crossed an existing gate. Raw
probabilities and each paired spillover are preserved in `comparison.json` and
`report.json`. This does not validate the correctness of those unlabelled
diagnostic judgments.

All 32 policy decisions abstain. These single-passage policy results are not
scope errors, factual-accuracy results or evidence of changed end-to-end coverage.
The primary score above concerns only scope compatibility.

One authorized pass completed with 32 consumed Jev attempts / 32 actual started
fetches, 0 Exa, 71,992 measured input tokens, all 32 calls reporting usage,
281,362 request bytes, 44,535 response bytes and 3,560 ms campaign duration.
There were no retries, failures, missing usage or budget stops. Jev USD and
output-token cost remain unknown; Exa cost is zero. Frozen source/request guards
passed before every call, and source hashes remained unchanged after execution.
Named outputs and accounting are durable in `events.jsonl`; no keys or request
headers were recorded.

Plan hash:
`7673eba2cca0b6d2014c195074e9ecdd5055ce5d29a71f646cf061a72391d2c2`.
Any new prompt design, repeat, harder cohort or production promotion requires a
separate declared decision; this report authorizes none.
