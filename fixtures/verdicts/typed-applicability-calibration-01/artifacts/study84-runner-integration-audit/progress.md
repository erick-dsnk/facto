# Applicability84 runner integration audit in progress

This is a read-only integration audit with disclosed authorship overlap: the
reviewer authored the study guard and the saved companion packet. It is not an
independent review of that guard. Independent guard approval is recorded in
`../study84-guard-v2-independent-review.json`. No provider or origin calls are
performed by this audit, and no frozen runner/input/source file is changed.

The initial draft preserved as `runner-draft-before-review.ts.txt` had two
integration issues. It created one runtime request outside the paired-arm loop,
so the second arm inherited the first arm's elapsed ten-second deadline and
charged budget. Its reports contained cohort/arm call counts without semantic
positive/negative/uncertain declared and missing denominators. The implementer
agreed and moved fresh Session/request/budget/material ownership inside each arm;
full-label scoring is being added to both partial and final reports.

The initial label-freeze check also compared the identity adjudication's
`authorFreezeUnchanged` SHA string to boolean true. That would always reject
preparation. The current draft compares the actual manifest hash and verifies
both first/second label hashes and the neutral identity-input hash. Exact one-label
inventory validation is added when assembling the semantic denominator rows.

Checkpoint wiring inspected in the draft uses synchronous `appendFileSync` with
`flush: true`. It attaches the actual request controller to the guard lease and
passes only lease.fetch to the adapter. Actual request, response, usage and
completed-proof bindings remain checked. Final/partial results use flushed JSON
serialization. A prepared-only record after process loss is explicitly treated
as dispatch/usage indeterminate and cannot authorize replay.

The no-network preparation probe ran while the implementer was switching the
draft to adapter07. It passed label checks and stopped at the then-unwritten
`contexts.07.json`, with zero network attempts. That is an incomplete preparation
state, not a model or provider failure. The final84 plan, complete offline
execution, scoring tests, exact hashes and durable final report still require
review once the implementer finishes preparation.

Scoring must keep candidate applicability questions, deterministic availability,
risk-gated typed eligibility and unchanged final policy separate. Baseline has
no applicability question/token: absent tokens must not be presented as zero
baseline recall followed by a candidate improvement. All42 semantic units,
including current-guard unavailability and six uncertain sentinels, remain in
declared denominators. Two binding controls stay separate offline controls.
