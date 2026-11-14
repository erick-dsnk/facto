# Correction to the auxiliary broader acquisition comparison

The archived candidate08 comparator used 0.8 for substance and common-origin assessment confidence as well as stance. The frozen policy uses **0.85 for substance/common-origin and 0.8 for stance**. The archived outputs called this a proxy, but their source-qualified-yield terminology could imply the actual threshold. This separate correction supersedes that auxiliary counter; the original hashed baseline and candidate08 packages and documents remain byte-exact.

The corrected [comparison](../fixtures/evaluation/live/broader-comparison-correction-85/candidate08-paired/comparison.md), [full stage data](../fixtures/evaluation/live/broader-comparison-correction-85/candidate08-paired/comparison.json) and [22 changed stage rows](../fixtures/evaluation/live/broader-comparison-correction-85/impact.json) were recomputed offline from saved public reports. No provider call, source-answer change, new factual evaluation or selected-reference substitution occurred.

| Last observed judgment | Old 0.8 proxy | Corrected substance/origin 0.85; stance 0.8 |
| --- | ---: | ---: |
| Baseline BD04 | 1 | 0 |
| Baseline BD07 | 3 | 2 |
| Baseline BDC04, repeat of BD07 | 3 | 2 |
| Candidate08 BD06, before operational error | 1 | 0 |
| Candidate08 BD12 | 4 | 3 |

All other last-judgment counts stay unchanged. BD06 remains an operational error; its pre-error assessment is not a completed factual result. BD11 changed admitted spans and stays excluded from numeric acquisition deltas. BDC04 supplies no additional unique-fact credit.

The primary results are unchanged: **candidate08 raw 6/12 correct definitive unique facts and 4/12 with every selected reference independently verified**, versus baseline 3/12 and 2/12. The 13 eligible public occurrences include the BD07 repeat and remain a separate denominator. These repeated OPEN observations establish neither blind accuracy nor a causal effect.

The corrected yield still counts recorded model assessments linked to identical retained content, with directness/scope and the split confidence thresholds. It is not full verdict-policy eligibility, independently verified truth, retrieval recall or proof that recorded source groups are independent. Missing judgments remain unassessed. Existing inaccessible selected citations, abstentions, costs/latency limitations and operational failures remain unchanged.

The [separate correction note](../fixtures/evaluation/live/broader-comparison-correction-85/CORRECTION.md), [frozen threshold evidence](../fixtures/evaluation/live/broader-comparison-correction-85/policy-threshold-evidence.json), [preserved-original hashes](../fixtures/evaluation/live/broader-comparison-correction-85/prior-preserved-hashes.json) and [packaging checks](../fixtures/evaluation/live/broader-comparison-correction-85/packaging-checks.json) retain the correction's provenance. The new package [manifest](../fixtures/evaluation/live/broader-comparison-correction-85/MANIFEST.json) and [SHA256SUMS](../fixtures/evaluation/live/broader-comparison-correction-85/SHA256SUMS) bind the corrected script and outputs.
