# Read-only corrected08 candidate-only analysis

This helper evaluates one declared42-call candidate08 report. It reads the exact
plan, captured requests, contexts and report, verifies their identities, and
prints JSON. It makes no provider requests, imports no engine/provider modules,
and writes no inputs. Baseline is explicitly `not_run`, with zero declared or
missing baseline calls and null metrics. It creates no pairs or comparison with07.

Run after the separately authorized study, writing output to a new analysis folder:

```sh
/workspace/junction-2026/node_modules/.bin/tsx run.ts \
  /workspace/task-evidence/typed-applicability-calibration-02/corrected08-42-plan.json \
  /path/to/new/run/report.json
```

The full semantic inventory is42: original34 plus identity8. The stored original
cohort identifier remains `original36`, with its two binding controls reported
separately. All18 covered,18 not-covered,6 uncertain labels and5 predeclared
unavailable items remain declared. Missing result, no item, missing answer,
invalid answer and an observed raw uncertain answer are distinct. A durable
observed answer from a failed completion is retained as unscored and does not
remove the missing result. Final failure reports work; a crash-only partial
report without a plan hash needs an explicit provenance reconstruction and is
not silently treated as a valid final report.

Outputs separate the exact3x3 enum confusion, non-grant not-covered/uncertain
disagreements, selected-covered probability>=.85, actual target eligibility,
ordinary risk, all retained source gates/raw scores, policy and selected-source
audit inputs. The helper does not assign truth/authority, combine those gates
into a new rule or claim factual coverage. Original34 and identity8 summaries
remain separate; the all42 total is declared inventory, not pooled accuracy.

Validation before live outputs:10 synthetic tests, strict TypeScript, and the
author's actual-adapter42-request **in-memory** mock report. The mock has37 asked
items/5 unavailable,34+8 and6 uncertain, with0 real provider calls. Separately,
unknown-usage and rate-limit mock failures each preserve42 missing labels and
the original failure kind; an observed-but-uncommitted answer remains unscored.
These mock answers are not model accuracy evidence.

The author of this helper also authored prior public calibrations, companions,
prototype core and budget guard, and reviewed08's new binding. They did not edit
the corrected runner/scorer. This is an independent scoring recomputation with
that overlap disclosed, not blinded validation of those earlier components.
The frozen07 first84 outputs, their correction and all prior analyses remain
unchanged. This helper grants no execution or production authorization.
