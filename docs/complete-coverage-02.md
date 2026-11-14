# Complete typed-text live evaluation — 14 November 2026

The fresh OPEN campaign completed **32/32 inputs: 24 factual claims and eight controls**. It produced **20/24 correct definitive answers (83.3%)**, four abstentions, zero observed wrong definitive labels and zero operational errors. **13/24 facts (54.2%) have every selected citation independently content-verified**. The raw 20/24 target was met; the 20/24 fully content-verified target failed. This is a small purposive development observation, without a baseline arm or a readiness claim.

This was one newly prepared prospective campaign on clean commit `4f507f84d9f7f8881af62d9a9ae5a82aa0099ceb`, scoped source SHA-256 `d81de5984903f607d4e6b8342f1777b3dc105f893f27e2739c98308d86f57147`. Two fixed, disjoint 16-input batches used reviewed halves of one global budget. The previous eight-fact campaign remains a stopped first run with 4/8 raw and 3/8 fully verified; it was not resumed, rescored or pooled. No historical sealed/private or held-out body was opened or rerun.

## Factual and control results

| Factual group | Correct definitive / declared | Abstentions |
|---|---:|---:|
| Known true | 11/12 | 1 |
| Known false | 9/12 | 3 |
| History | 6/6 | 0 |
| Geography | 5/6 | 1 |
| Science | 4/4 | 0 |
| Technology | 2/4 | 2 |
| Arts | 2/2 | 0 |
| Sport | 1/2 | 1 |

All 24 eligible exact public spans were admitted. The eight privacy/personal/opinion/ambiguity controls matched their expected outcomes: six skipped and two requested clarification, all with manual `respond` feedback and zero retrieval attempts or factual verdicts. All 32 inputs received one correlated terminal. These are observed backend outcomes, not evidence of a population privacy rate or automatic-notification behavior.

The four completed abstentions were the Suez Canal direct-endpoint claim and modern-byte claim (`below_threshold`), Python-creator and inaugural World Cup host claims (`insufficient_independent_evidence`). They remain in the 24-fact denominator. No fact was missing or unexecuted.

## False alarms and false support

The user requested these explicit post-run definitions; they were not predeclared campaign endpoints and do not change the frozen plan. The evaluator now tracks both directions for future labeled cohorts, with completed, definitive-only and unexecuted denominators kept distinct.

| Frozen truth label | Supported | Contradicted | Misleading | Abstained | No verdict |
|---|---:|---:|---:|---:|---:|
| Known true, n=12 | 11 | 0 | 0 | 1 | 0 |
| Known false, n=12 | 0 | 9 | 0 | 3 | 0 |

- **False-alarm rate: 0/12** known-true claims were labeled contradicted or misleading; among definitively answered true claims, 0/11.
- **False-support rate: 0/12** known-false claims were labeled supported; among definitively answered false claims, 0/9.
- **False-positive control admission: 0/8** controls were admitted as public factual claims.

Abstentions are separate: one true and three false. They are not counted as correct true negatives or correct definitive decisions. Zero observed errors in this small OPEN sample does not imply a zero population false-positive rate. The exact confusion counts and definitions are in [metrics.json](../fixtures/evaluation/live/complete-coverage-02/metrics.json); [evaluated-metrics.json](../fixtures/evaluation/live/complete-coverage-02/evaluated-metrics.json) preserves an offline recomputation using the new ongoing evaluator fields. This additive post-run analysis does not rewrite the original capture.

## Latency, usage and cost

| Measurement | Result |
|---|---:|
| Factual median / P95, all 24 including abstentions | **1.8775 / 3.472 seconds** |
| Factual min / max | 0.718 / 5.423 seconds |
| Control median / P95, separate eight inputs | 0.1625 / 0.188 seconds |
| Campaign wall time | **53.611 seconds** |
| Actual Jev / search / contents attempts | **61 / 29 / 24** |
| Measured input tokens / unknown token reservations | **421,456 / 0** |
| Request bytes, cumulative / largest request | 1,802,485 / 67,824 |
| Known partial cost | **$0.251**, with all 61 Jev attempt costs unknown |

Latency uses every case in its stated stratum; controls were interleaved in the two batches. P95 is nearest rank `ceil(.95 × n)` and median averages the middle pair. All factual service durations stayed below the unchanged ten-second deadline; none timed out. Campaign wall time includes setup and batch transitions and is separate from per-input latency.

All 114 actual provider attempts completed with HTTP 200. The frozen 512-KiB per-request allowance had been checked offline against a 362,773-byte valid production-shaped URL-expansion payload, preserving source text and qualifiers. The previous 64-KiB failure is preserved separately. Each input stayed inside the original three-Jev/two-search/three-contents limits, and all batch/global limits held. Actual token usage is provider-reported; unknown dollar charges are not zero. Aggregate response bytes remain unmeasured.

## Independent selected-citation inspection

Agents inspected all **70 originally selected references**, binding each selected ID, exact URL and retained-excerpt hash to its own page/scope review. **61/70** had accessible substantive content matching the retained scope. Thirteen factual cases have all selected references verified, and all 20 definitive outcomes have at least one inspected matching selected reference. The latter cannot substitute for all-selected verification or establish independently authenticated corroboration.

Eight selected references were inaccessible: three transport failures before any response, two HTTP 403 responses, a DOI redirect ending at a 403 challenge, and two Olympics HTTP 503 pages. One accessible Élysée Bastille selection had a retained-excerpt scope gap: the full page dates the storming, but the needed heading was absent from the retained excerpt. Other selected Bastille references directly date the event; the incomplete extra citation still prevents full-selected-set credit. No unselected source or substitute URL repaired any failure.

Public source inspection made 73 bounded application GET attempts for 70 exact URLs, including three followed redirects, with zero retries or paid-provider calls. It retained/observed 19,064,636 body bytes without truncation; fetch invocation does not prove origin receipt for transport failures. Whole fetched bodies remain outside Git. These are agent inspections, not human review. Shared records, copying and unknown origins remain explicit: publisher diversity and content agreement do not authenticate independent provenance.

## Evidence and remaining limits

The [durable package](../fixtures/evaluation/live/complete-coverage-02/README.md) preserves the original report unchanged, its independent accounting/citation audits, prospective redacted plan, source freeze, offline transport/executor preflight and reviews. The original report's source-verification fields remain unreviewed as captured; the later citation audit supplies the verification counts above. Frozen implementation validation remains **684 tests, 36/36 development scenarios and 21/21 presentation fixtures**; the later ongoing error-reporting change passed lint/typecheck and **689 tests across 34 files**, plus **36/36 development and 21/21 presentation checks**. Its independent review and exact tested hashes are in the package. This reporting-only validation adds no provider accuracy credit.

The successful raw-label target does not erase the failed full-content target. Remaining work includes the four abstentions, access failures, retained citation scope and source independence. This OPEN cohort does not calibrate deceptive reference prose, medical claims or a population error rate. A fresh independent blind evaluation remains outstanding; neither this campaign nor later reporting-only changes establishes readiness. All authorizations for completed studies are consumed. Keep draft PRs open; no merge, deployment, reviewer notification or issue closure was performed.
