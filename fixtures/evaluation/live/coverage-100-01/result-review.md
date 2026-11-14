# Independent first-run accounting and metric analysis — 100 inputs

The newly prepared campaign completed **100/100 attempted inputs and terminal receipts** on unchanged frozen source. Independent recomputation from exact report SHA-256 `e6cefc9877f271a231b4fd1834df0a9d6609a6dc7b03bed7846667b555a1111d` agrees with capture: **69/80 correct definitive labels (86.25%)**, zero observed wrong definitive labels, ten abstentions and one factual clarification without a verdict. No input was unexecuted. This is OPEN, authored synthetic development evidence, not blind accuracy, a causal comparison or readiness.

`analysis/statistics-initial.json` preserves all calculations and denominators; `audit-result.json` records 18 passing independent freeze/accounting checks. The analysis implementation passed five pure regression checks for Wilson bounds, error directions/abstention/missing denominators, first-person accepted variants versus duplicate results, failure-inclusive latency, and actual dispatch/unknown usage/cost accounting. No provider/public request or old campaign replay occurred in analysis, and the original report was not edited.

## Truth confusion and error rates

| Gold truth | Supported | Contradicted | Misleading | Abstained | No factual verdict |
|---|---:|---:|---:|---:|---:|
| True, 40 declared | 36 | 0 | 0 | 3 | 1 |
| False, 40 declared | 0 | 33 | 0 | 7 | 0 |

The true no-verdict case is AD12, which requested clarification before retrieval. It remains a miss in all-80 coverage and admission recall. True completed valid checks therefore number 39, not 40; false completed valid checks number 40. Abstentions are explicit completed checks but never correct definitive decisions or observed true negatives. No-result/invalid/unexecuted observations are excluded from observed-error denominators and remain visible in declared coverage.

| Metric | Count / denominator | Descriptive Wilson 95% interval |
|---|---:|---:|
| Correct definitive / declared facts | 69/80 | 77.03%–92.15% |
| False alarm: true → contradicted/misleading | 0/39 completed true | 0%–8.97% |
| False support: false → supported | 0/40 completed false | 0%–8.76% |
| False alarm among definitive true checks | 0/36 | 0%–9.64% |
| False support among definitive false checks | 0/33 | 0%–10.43% |
| False public admission on controls | 0/20 | 0%–16.11% |

These intervals are mathematical Wilson score intervals under an IID Bernoulli model. Independent representative sampling is not established for this purposive, correlated synthetic cohort; the intervals are descriptive, not guaranteed population error bounds. Zero observed errors must not be described as a zero population false-positive rate.

## Admission, controls and conversational styles

Exact public-span admission: **79/80 recall (98.75%), 79/79 precision, F1 0.99371**. Full admission-action matching was **97/100**. All **100/100 manual terminal presentations responded**.

Controls matched **18/20 exact expected actions**, with **zero public factual admissions, retrieval attempts or factual verdicts**. Four expected clarification controls correctly clarified. Of sixteen expected skips, fourteen skipped and CTRL19/CTRL20 clarified. Those two action mismatches remain failures against the frozen expectations; they are not privacy leaks or silently relabeled successful skips.

| Factual style | Correct definitive / declared | Abstained | No verdict |
|---|---:|---:|---:|
| Standalone | 50/56 | 5 | 1 |
| Mixed private/public | 9/12 | 3 | 0 |
| First-person public assertion | 10/12 | 2 | 0 |
| Combined conversational facts | 19/24 | 5 | 0 |

These are independent synthetic turns in fresh sessions, not real participant conversations or a cross-turn context test. Styles contain different facts; their raw coverage differences do not isolate a causal effect of wording.

Coverage-aware one-versus-rest detection is also provided with explicit definitions: false-claim alert precision 33/33, recall 33/40 and F1 0.90411; true-support precision 36/36, recall 36/40 and F1 0.94737. Here abstentions/no-verdict are missed positives for their relevant gold class, never correct true negatives. F1 is `2TP/(2TP+FP+FN)`; no invalid binomial interval is attached to F1.

## Domains

| Domain | Correct / declared | Abstained | No verdict |
|---|---:|---:|---:|
| History | 9/10 | 1 | 0 |
| Civics | 8/10 | 2 | 0 |
| Geography | 9/10 | 1 | 0 |
| Earth science | 9/10 | 1 | 0 |
| Natural science | 9/10 | 1 | 0 |
| Computing/technology | 9/10 | 1 | 0 |
| Culture/arts | 8/10 | 2 | 0 |
| Sport | 8/10 | 1 | 1 |

The ten abstentions were AD20, GB19, GB09, SC01, AD08, HA20, SC20, HA06, AD07 and HA16. Their exact policy reasons remain in the machine-readable analysis. No wrong label was observed in any domain; source verification is separately pending and cannot be inferred from these world-truth labels.

## Latency and resource accounting

All eighty factual durations are included, including all ten abstentions and the admission clarification: **2,255.5 ms median, 6,407 ms nearest-rank P95**, min/max **131/7,906 ms**. Controls are separate: **234 ms median, 359 ms P95** over twenty inputs. All-input median/P95 are 2,042.5/6,085 ms; campaign wall time is **246,922 ms (246.922 seconds)**. Service result durations were below the unchanged ten-second deadline, maximum 7,903.723639 ms; there were no timeouts. P95 uses `ceil(.95 × n)` and median averages the middle pair; missing durations would never be imputed as zero.

Actual paid-provider attempts reconcile from individual records: **194 Jev + 94 searches + 80 contents = 368 attempts**, all captured as completed responses. Measured input usage was **1,376,217 tokens**, with zero unknown input-token reservations and no pending dispatch reservation. Actual request bytes totaled **5,898,368**, maximum single request **67,801 bytes**. Known Exa cost was **$0.818 partial**; all **194 Jev attempt costs remain unknown**. Provider usage/cost fields are not independently tokenized/billed; unknown cost is not zero. Aggregate response bytes remain unmeasured.

Independent query inspection found **79 exact initial public searches, fifteen exact same-span balanced alternate searches and eighty matching contents highlight requests**, with no query/hash/public-URL mismatch. Search/highlight text was checked against the actually admitted safe span, not merely another predeclared public variant. All twenty controls made zero retrieval attempts. The twelve mixed private/public cases produced no guarded unsafe-query failure or actual exposure. Runtime request bodies are intentionally omitted; this inspection combines saved diagnostics with the pinned strict outbound observer rather than claiming independent packet capture.

## Preservation and limits

Plan, dataset/CSV, all nine source-part/research hashes, assembler and executor closure pins still match; current source scope remains frozen SHA-256 `511cf85cbd599c3b424766c77bbd7f33322afaafd98212dec75e6aefadac3f20` at the capture's `b218094` implementation. No frozen source/data/Git mutation occurred during the paid run or this analysis.

Selected-source content/access/scope/provenance inspection is a separate pending agent audit. Initial analysis deliberately assigns no full-selected citation credit until that audit binds each original ID/URL/excerpt to inspected content. The raw label result must not be presented as fully source-verified coverage. Prior OPEN, stopped, NEW24 and sealed studies remain separate; their observations and consumed authorizations are not reused or pooled. No merge, deployment, issue closure or reviewer notification occurred in this work.

## Completed selected-citation supplement

The separate final agent audit inspected all246 original selected occurrences across69 definitive cases. Exact report binding, selected ID/URL/excerpt hashes and proof hashes reconcile. **198/246 references verified;31/80 facts have every selected citation content-verified (38.75%, descriptive Wilson95 interval28.82%–49.71%).**68/80 have at least one verified selected reference and62/80 have at least two verified retained publisher/domain groups, which are not authenticated independent origins. HA04 was the one definitive case with no verified selected reference: both selected sources were inaccessible.

Forty-one selected occurrences failed access/content retrieval and seven had incomplete material scope. Two binaries hit the3MB cap: the ECHR relevant Strasbourg paragraph was recoverable and scoped content verified, without claiming full-document retrieval; the Monet passage could not be verified. There were245 unique original URLs and251 public fetch invocations including six redirects,58,380,923 retained bytes, zero retries and no paid-provider request. Six transport failures have unknown origin receipt.

`analysis/statistics-final.json` adds independently bound all-selected/at-least-one/at-least-two-domain metrics and Wilson intervals by domain/style without changing initial raw metrics or the first report. Original full citation audit SHA7edcee32de6c28961bbad128b5093d05305b593ea295cbba1eb889d4ebb919b5 remains outside Git; publication uses a clearly labeled projection to omit long quoted proof bodies. The raw64/80 development target passed69/80; full-selected64/80 target failed31/80. Neither is readiness or authenticated provenance.
