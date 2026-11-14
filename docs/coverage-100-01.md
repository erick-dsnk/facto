# Researched 100-input typed-text evaluation — 14 November 2026

One fresh prospective OPEN campaign completed **100/100 inputs**: **69/80 correct definitive factual labels (86.25%)**, ten abstentions, one factual clarification without a verdict, and zero observed wrong definitive labels. All twenty controls avoided public retrieval and factual verdicts; **18/20 matched their exact expected actions**. Independent agent inspection verified **198/246 selected references**; **31/80 facts (38.75%) have every selected citation content-verified**. The raw 64/80 development target passed, while the fully content-verified 64/80 target failed. Raw correctness must not be conflated with inspectable source coverage.

Download the reusable **[100-input CSV](../fixtures/evaluation/live/coverage-100-01/dataset.csv)** or **[structured JSON](../fixtures/evaluation/live/coverage-100-01/dataset.json)**. Every input is authored synthetic material, including all personal-style context. These are independent typed inputs and isolated conversational turns, not real participant data, ASR output or a multi-turn conversation benchmark.

## Dataset and execution

The cohort has eighty unique ordinary propositions, balanced forty true/forty false across eight domains of ten facts each (five true/five false per domain), plus twenty controls. Factual styles are fifty-six standalone, twelve mixed private/public and twelve first-person assertions. The twenty controls cover invented private statements, personal experiences, opinions, unresolved referents and questions/instructions. All labels, source scope, exact public allowlists and accepted span variants were independently reviewed before provider output. Every fact has an inspected public reference with URL, time, response-body hash, material scope and a curated quote of at most seventy-five words.

A fixed seeded hash permutation determined input order before execution. One executor ran each input in a fresh authenticated HTTP/WebSocket session with its own cold runtime; the outer ledger retained the full campaign budget across all hundred inputs. The unchanged backend was frozen at commit `b21809493aa7a6e3b337391f996a74b2e2f220a0`, scoped source SHA-256 `511cf85cbd599c3b424766c77bbd7f33322afaafd98212dec75e6aefadac3f20`. The independent twenty-three-case executor/fault suite and maximum-request preflight passed offline. Production source, thresholds, contracts, iOS and ASR were unchanged.

This is a new authored OPEN dataset, without a baseline arm or a blind claim. Targeted known-OPEN dedup found two draft repeats; authors replaced them and grounded the replacements before freeze. Historical sealed/private and held-out bodies were not searched. The earlier stopped and completed cohorts remain separate, unchanged and unpooled.

## Results and confusion

| Gold truth | Supported | Contradicted | Misleading | Abstained | No factual verdict |
|---|---:|---:|---:|---:|---:|
| True, forty declared | 36 | 0 | 0 | 3 | 1 |
| False, forty declared | 0 | 33 | 0 | 7 | 0 |

The factual no-verdict case, AD12, clarified before retrieval and remains a miss in the eighty-fact denominator. No case was unexecuted. Conditional correctness among definitive outputs was 69/69; it excludes eleven claims without definitive answers and is not an overall accuracy score or a population precision guarantee.

| Domain | Correct definitive / declared | Abstained | No verdict | All selected verified / declared |
|---|---:|---:|---:|---:|
| History | 9/10 | 1 | 0 | 1/10 |
| Civics | 8/10 | 2 | 0 | 5/10 |
| Geography | 9/10 | 1 | 0 | 3/10 |
| Earth science | 9/10 | 1 | 0 | 5/10 |
| Natural science | 9/10 | 1 | 0 | 6/10 |
| Computing/technology | 9/10 | 1 | 0 | 4/10 |
| Culture/arts | 8/10 | 2 | 0 | 3/10 |
| Sport | 8/10 | 1 | 1 | 4/10 |

| Factual style | Correct definitive / declared | Abstained | No verdict | All selected verified / declared |
|---|---:|---:|---:|---:|
| Standalone | 50/56 | 5 | 1 | 25/56 |
| Mixed private/public | 9/12 | 3 | 0 | 3/12 |
| First-person public | 10/12 | 2 | 0 | 3/12 |
| Combined conversational facts | 19/24 | 5 | 0 | 6/24 |

These style groups contain different facts, so their results do not isolate a causal effect of conversational wording. Mixed inputs sent only their exact public span to retrieval; “I think” inputs accepted the exact complete or bare asserted proposition, matched once to one expected fact.

## False alarms, false support and admission

False alarm means a known-true claim labeled contradicted or misleading; false support means a known-false claim labeled supported. Abstentions remain explicit completed checks but are never correct definitive decisions or correct true negatives. The true clarification is excluded from completed-error denominators and retained as a declared coverage/admission miss.

| Metric | Count / denominator | Descriptive Wilson 95% interval |
|---|---:|---:|
| Correct definitive / all facts | 69/80 | 77.03%–92.15% |
| Every selected citation verified / all facts | 31/80 | 28.82%–49.71% |
| False alarms / completed true checks | 0/39 | 0%–8.97% |
| False support / completed false checks | 0/40 | 0%–8.76% |
| False alarms / definitively answered true | 0/36 | 0%–9.64% |
| False support / definitively answered false | 0/33 | 0%–10.43% |
| False public admission / controls | 0/20 | 0%–16.11% |

Wilson intervals use the named binomial score formula and denominators in the published analysis. IID representative sampling is not established in this purposive synthetic cohort; these intervals are descriptive mathematical summaries, not guaranteed population error bounds. Zero observed errors is not a zero population false-positive rate.

Exact factual admission precision was **79/79 (100%)**, recall **79/80 (98.75%)**, and F1 **0.99371**. Across facts and controls, exact admission-action matching was **97/100**. Of sixteen expected skips, fourteen skipped and CTRL19/CTRL20 clarified; all four expected clarification controls clarified. All twenty controls had zero public admission, retrieval or factual verdict. All hundred manual inputs received `respond` feedback. The two unnecessary control clarifications remain action mismatches.

Supplemental coverage-aware detection metrics keep nonanswers as misses for their relevant gold class: false-claim alert precision 33/33, recall 33/40, F1 0.90411; true-support precision 36/36, recall 36/40, F1 0.94737. Neither treats abstentions as true negatives. F1 uses `2TP/(2TP+FP+FN)`; no binomial interval is assigned to F1 itself.

## Latency, attempts and partial costs

| Measurement | Observed value |
|---|---:|
| Factual median / P95, all eighty including abstentions and clarification | **2.2555 / 6.407 seconds** |
| Factual min / max | 0.131 / 7.906 seconds |
| Control median / P95, twenty controls separately | 0.234 / 0.359 seconds |
| Campaign wall time | **246.922 seconds** |
| Actual Jev / search / contents attempts | **194 / 94 / 80** |
| Actual attempts, total | 368 |
| Measured input tokens / unknown usage reservations | **1,376,217 / 0** |
| Request bytes, cumulative / largest request | 5,898,368 / 67,801 |
| Known partial cost | **$0.818**, all 194 Jev attempt prices unknown |

P95 is nearest rank `ceil(.95 × n)`; median averages the middle pair. All factual observations are included, rather than only successful definitive cases. Campaign wall time includes fresh-session setup and persistence and is separate from per-input latency. No timeout or operational error occurred; the maximum service result duration was 7.9037 seconds under the unchanged ten-second deadline.

Every actual attempt, reservation, byte and returned usage field reconciled. Searches were seventy-nine exact admitted public queries plus fifteen exact same-span balanced alternates; all eighty contents requests matched the frozen highlight helper and public URL guard. There were zero guarded unapproved-span/query failures and zero actual public-query exposures, including all twelve mixed facts. This is saved-diagnostic and frozen-guard evidence, not independent packet capture or a population leakage estimate.

Token usage and known costs are provider-reported, not independently tokenized or billed. Unknown Jev charges are not zero, so $0.818 is not the campaign's total price. Aggregate response bytes remain unmeasured. The realistic 512-KiB per-request preflight preserved complete source/qualifier/context fields, including a 363,583-byte expanded-URL stress case; it changed no backend evidence threshold or production limit.

## Selected-citation review and preservation

Agents inspected all **246 original selected occurrences across 69 definitive results**, covering245 unique URLs. **198/246** had matching substantive content and retained scope. **31/80** factual cases have every original selected citation content-verified; **68/80** have at least one verified selected reference. **62/80** have at least two verified retained publisher/domain groups, which do **not** authenticate independent underlying origins or replace all-selected credit. The correct-label Pompeii case HA04 had no verified selected reference because both selected scholarly URLs were inaccessible.

Forty-one selections failed access/content retrieval; seven accessible selections had incomplete material scope. These included a quartz table without an explicit Mohs-scale premise, a Titanic excerpt omitting 1912, two Alhambra passages omitting Spain, a Java release/development-role mismatch, a historical ECHR founding-location passage used for a continuing-seat claim, and a qualified Saturn-particle description that did not settle “mostly.” Missing retained premises were not supplied silently from other page sections or unselected sources.

The public audit made251 bounded application GET attempts for245 original URLs, including six followed redirects, zero retries and no paid-provider calls. It retained58,380,923 body bytes. Six no-response transport attempts have unknown origin receipt. Two PDF binaries reached the3 MB cap: an ECHR Strasbourg passage was recovered and received **relevant-content-only credit**, explicitly without full-document retrieval; a Monet passage remained unverified. HTTP 200 challenge/script/landing pages did not count as substantive sources.

This is agent inspection, not human review or a blind source audit. The original full audit remains unchanged outside Git; its published projection retains exact ID/URL/excerpt/proof/body/text hashes and all decisions, while omitting long quoted proof strings and duplicated excerpts. A short display quote does not necessarily repeat every premise reviewed in its complete passage. Full source content agreement and publisher diversity are distinct from authenticated provenance.

The [evidence package](../fixtures/evaluation/live/coverage-100-01/README.md) preserves exact reusable dataset JSON/CSV, plan/freeze/preflight, original first report in lossless gzip, independent preparation/result/citation reviews, accounting and all stratified metrics. Initial citation-pending analysis remains untouched; `analysis/statistics-final.json` adds the completed source metrics without rewriting capture. The decoded original report SHA-256 remains `e6cefc9877f271a231b4fd1834df0a9d6609a6dc7b03bed7846667b555a1111d`. Raw fetched pages, long author extraction dumps, provider prompts, secrets, active paid runner and authorization are omitted. Those omitted original materials remain hash-pinned; the corpus is reusable, but the original external execution closure is not fully portable or reauthorized.

This campaign adds measured behavior for this new synthetic corpus, without establishing causal improvement, real multi-turn performance, device/ASR behavior, population accuracy or readiness. All prior first-run results and consumed authorizations remain unchanged. PR workflow readiness after passing checks does not certify product readiness. No actual merge, deployment, reviewer request or issue closure occurred.
