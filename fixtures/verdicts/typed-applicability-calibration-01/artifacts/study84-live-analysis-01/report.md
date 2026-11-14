# Applicability84 first-run analysis

The adapter provides no qualifying positive coverage at the frozen .85 threshold:
0/15 original positives and 0/3 identity positives pass. No target typed-eligibility
token is issued. Both arms return insufficient evidence on all42 cases. Keep the
candidate unwired; these results establish no authority or factual-coverage gain.

| Predeclared measure | Original34 | Identity8 |
| --- | ---: | ---: |
| Declared covered / not-covered / uncertain | 15 /13 /6 | 3 /5 /0 |
| Completed baseline / candidate calls | 34 /34 | 8 /8 |
| Candidate applicability items asked | 30 | 7 |
| Deterministic no-item outcomes, retained in denominator | 4 | 1 |
| Raw ternary exact among asked | 21 /30 | 6 /7 |
| Covered positives passing .85 | 0 /15 | 0 /3 |
| Not-covered labels passing .85 | 0 /13 | 0 /5 |
| Uncertain labels passing .85 | 0 /6 | 0 /0 |
| Actual typed-eligibility tokens | 0 | 0 |
| Final policy changes between arms | 0 | 0 |

Baseline has no added applicability question, so its applicability metrics are
not measured, not zero recall. The cohorts remain separate. Raw correctness among
asked items does not replace the full declared denominator. There are no missing
results, malformed answer records or unscored post-answer outcomes in this run.

The frozen three-class labels are unchanged. In the original cohort, the exact
confusion matrix among asked items is:

| Expected → observed | Covered | Not covered | Uncertain | No item |
| --- | ---: | ---: | ---: | ---: |
| Covered | 10 | 3 | 2 | 0 |
| Not covered | 0 | 10 | 0 | 3 |
| Uncertain | 3 | 1 | 1 | 1 |

For the identity cohort:

| Expected → observed | Covered | Not covered | Uncertain | No item |
| --- | ---: | ---: | ---: | ---: |
| Covered | 2 | 1 | 0 | 0 |
| Not covered | 0 | 4 | 0 | 1 |
| Uncertain | 0 | 0 | 0 | 0 |

The one uncertain→not-covered result is a non-grant class disagreement. Three
original uncertain labels receive raw covered choices at .41, .73 and .56;
these remain class disagreements, but none passes .85 or receives a typed grant.
This distinction does not relabel the cases or lower a threshold. The largest
covered probability on an original positive is .81; for identity positives it
is .79.

AC-D03, AC-D04, AC-D05 and DI06 have negative labels and no applicability item
because the current-version proof guard rejects them. AC-D06 is the uncertain
no-item case. These are five explicit deterministic availability outcomes, not
five inferred model answers or discarded examples.

The extra question also changes ordinary full-judge outputs:

| Paired spillover | Original34 | Identity8 |
| --- | ---: | ---: |
| Retained source occurrences compared | 176 | 44 |
| Relevance gates gained / lost | 0 /1 | 0 /0 |
| Scope gates gained / lost | 2 /1 | 0 /0 |
| Substantive quality gates gained / lost | 0 /2 | 0 /0 |
| Source stance choices changed | 1 | 1 |
| Shared question answers numerically changed | 1,064 | 274 |

All risk categories remain ordinary; numerical risk and origin assessments shift.
The model's joint label changes from insufficient evidence to supported on
AC-X06 and AC-D02, while the final policy still abstains. Model-selected evidence
IDs remain unchanged across pairs. There are no definitive policy selections,
so the selected-citation audit packet is empty. No source fetch or alternate
citation was substituted.

`analysis.json` preserves all42 pairs,220 source comparisons, exact numerical
values, every changed shared answer, risk/origin state, model/policy selections,
availability reasons and target outcomes. Numerical change flags ignore only
representation differences<=1e-12; raw values and actual gate changes remain.
These one-pass movements are not separately established causal effects.

The sole authorized run completed84 actual Jev and0 Exa calls in16,938ms, with
846,340 measured input tokens,3,758,808 request bytes and512,132 response bytes.
All84 usage records are known; no failures, retries, missing rows or additional
calls occurred. Runtime and transport ledgers agree. All four22/22/20/20 blocks
remain within their frozen budgets. Dollar/output-token costs are unknown.

The helper was tested on12 synthetic cases and the full84-call mock pipeline.
Its author also authored the guard and companion packet; this analysis is not
independent outcome validation. Helper code/tests predate the live summary; its
manifest was finalized after that summary without outcome-based code changes.
All source families are reused OPEN development material, not independent facts
or a blinded population estimate. No promotion or replay is authorized here.
