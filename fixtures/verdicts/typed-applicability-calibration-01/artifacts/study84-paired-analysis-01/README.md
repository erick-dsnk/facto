# Read-only applicability84 paired analysis

`run.ts frozen-plan.json report.json` reads those files plus adjacent
`observed-*.json` artifacts and prints JSON. It never writes source artifacts,
calls providers, fetches citations or changes a threshold. Redirect output into
a new analysis directory. The plan's canonical hash,42 unique labels,84 declared
arm calls, original34/identity8 cohort counts, guard completion and selected
source IDs are checked before analysis. The applicability threshold remains.85.

Original34 and identity8 stay separate. Baseline has no applicability item, so
its applicability metrics are null, not zero recall. Candidate raw ternary
answers retain the frozen labels and exact3x3 confusion. Not-covered versus
uncertain disagreement is reported separately from unsafe covered>=.85 on
negative/uncertain labels and from actual target typed-eligibility grants.
Missing result, deterministic no item, missing/invalid answer and raw uncertain
remain distinct. Missing or unasked positives remain in declared denominators.

All paired ordinary source scope/relevance/stance/basis values and gates, risk,
origin assessments, model/policy selected sets and changed shared questions are
preserved. Numerical change flags ignore only differences<=1e-12; raw values and
gate crossings remain. Exact selected citations are emitted for later independent
whole-qualifier/origin review. No factual, authority, freshness or promotion credit
is awarded. Raw post-answer observations without a completed result remain
separate unscored diagnostics.

Twelve synthetic tests pass, including complete84 and partial/missing scenarios.
Strict TypeScript checking passes. The exact frozen final runner was replayed
offline through all84 actual mock transports and all7 runner tests; its journal
proves prepared-before-started-before-terminal ordering for each call, hashes and
bytes match the plan, and observed/runtime accounting agrees. This is mock
validation, not measured model performance.

Authorship overlap is explicit: this helper's author also authored the guard and
companion excerpts. This is analysis support, not independent guard or outcome
validation. The helper code and tests were completed before the live-result
summary arrived. The final package manifest was written after that summary;
no helper code, threshold, input or test was changed in response to live results.
