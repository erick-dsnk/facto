# Correction to auxiliary candidate08 source-yield comparison

The original offline comparator used **0.8 for all three confidence checks**.
Its prose explicitly called that a measurement rather than a verdict-policy
decision, but naming the result “source-qualified record yield” could imply the
actual policy threshold. That definition was wrong for the requested policy
comparison. Both frozen commits use **0.85 for substantive and common-origin
assessments**, while the direct-evidence stance threshold is **0.8**.

This new folder corrects those split thresholds. It does not modify the old
comparison, its packaged hashes, any frozen provider report, source answer,
selected reference, or engine decision. `prior-preserved-hashes.json` records
the old files byte-for-byte; they were checked unchanged after recomputation.
`policy-threshold-evidence.json` records the relevant source lines and hashes
from both frozen commits.

Candidate08's primary **raw 6/12** and **independently verified 4/12** metrics
remain unchanged. Those primary metrics do not come from this auxiliary
source-yield counter, and no new provider execution or factual evaluation was
performed.

Changes to last-observed-judgment record counts are:

| Public case / run | Old 0.8 proxy | Corrected 0.85 substance/origin, 0.8 stance |
| --- | --- | --- |
| BD04 baseline | 1 | 0 |
| BD06 candidate08, before its operational failure | 1 | 0 |
| BD07 baseline | 3 | 2 |
| BD12 candidate08 | 4 | 3 |
| BDC04 baseline repeat of BD07 | 3 | 2 |

All other last-observed-judgment counts remain unchanged. The complete
per-stage changes, including fractions and recorded-family metrics, are in
`impact.json`. Acquisition records missing a matching judgment remain
unassessed. BD11's changed admitted span remains excluded from numeric
acquisition deltas. BD06 remains an operational error; its last judgment is not
a completed factual result, and its historical missing Exa status/tag remains
unclassified.

The corrected counter still measures **recorded model assessments**, not
independently verified truth or complete verdict eligibility. It does not
replicate every claim-risk, source-capability, conflict, dependence and
presentation rule. Distinct source groups and absent origin links do not prove
independence. Repeated OPEN development remains subject to provider, model,
index, cache and timing variation; this correction establishes no causal or
held-out accuracy claim.

Use the new `compare.py` and `candidate08-paired/comparison.json` in this folder
for future auxiliary counts. The old archived comparison is retained as an
explicitly superseded 0.8 proxy, not silently repaired.
