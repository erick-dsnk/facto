# Public broader-development baseline — 14 November 2026

The frozen backend produced **3 correct definitive results out of 12 unique factual claims**, abstained on 8, and incorrectly skipped 1 public claim as private. **Two of the 12** have fully verified selected-source sets. All **16 inputs received a terminal event**; that completion rate does not establish factual accuracy.

The [artifact bundle](../fixtures/evaluation/live/broader-development-01/README.md) preserves the original corpus, manifests, source ground truth, reviews, four reports and journals, execution wrapper, limits, hashes and offline calculations. Packaging made no provider calls or live reruns and changes no implementation or earlier overview report.

## Cohort and provenance

This is **OPEN development data**, visible to implementers for inspection and tuning. It is neither blind nor held out and cannot establish broad accuracy. It contains 12 ordinary low-stakes facts, balanced 6 true / 6 false, plus four controls: personal anecdote, opinion, incomplete fragment and synthetic private/public mixture. The mixed input repeats BD07, so there are **13 eligible public occurrences but only 12 unique facts**. Unknown coincidental overlap with sealed sets was not investigated; sealed sets were not read or changed.

The author selected factual topics before any pipeline run and used public source material, with explicit documentary, normative-definition and copy-origin caveats. A separate reviewer accepted the truth labels, exact scopes and spans using saved bounded source text. That review was not a fresh origin audit. Corpus authoring documents retain their original “latency not measured” status; measured baseline latency is reported below.

Original v1 files and hashes remain unchanged. V2 changes only BDC03's expected terminal manual admission from `wait` to `needs_confirmation`; a bounded wait may be an intermediate state. This was recorded before its execution and without using engine output to choose the expectation. Both versions, the amendment and separate review are retained under `corpus/`.

The orchestrator records that the reviewer communicated acceptance before the first batch was dispatched, saying the concise review artifact was being frozen. The written review's `createdAt` is `04:14:33.708471Z`, 6.216471 seconds after the first report's `startedAt` of `04:14:27.492Z`. This is recorded as delayed serialization; the bundle does **not** claim the written review hash was frozen before dispatch or that the protocol had independent external registration.

| Recorded identity | Value |
| --- | --- |
| Backend commit | `3cfdfb13d8e6d37ab956e781206d892786ba441f` |
| Source freeze SHA-256 | `e6f36587593f39415f161a64a02f0946f4758b9a90b5c2c0ac40399adfb8de85` |
| Reported source dirty flag | `false` in all four reports |
| Model / policy strings | `jev-latest` / `glasses-p0.1` |
| Executed wrapper SHA-256 | `57d1c86425ba493fd400f3a03fcf4efcb2f31ad3021ac04fcdde6f15040ccbb8` |
| Executed v2 full manifest SHA-256 | `d10e403f76240b40e5c124644ff38643e7212339e8d6c64fb94ce73e73e81512` |
| Offline metrics source SHA-256 | `db4affadf2b9868024f5148c1fb6877a3af211ac784dabae0143b69641b6ee21` |

These model/policy strings are reported identifiers, not proof that a vendor's moving model alias is permanently pinned.

## Results and separate denominators

The current `apps/console/src/live/metrics.ts` pure function was run offline on saved inputs and reports, then reproduced from the byte-identical archived snapshot. Its outputs are [occurrence metrics](../fixtures/evaluation/live/broader-development-01/computed/metrics-occurrences.json) and [unique-fact metrics](../fixtures/evaluation/live/broader-development-01/computed/metrics-unique-facts.json). Unique-fact calculation filters **both reports and citation reviews** to BD01–BD12, excluding the mixed repeat entirely.

| Outcome | 12 unique facts | 13 eligible occurrences |
| --- | ---: | ---: |
| Correct definitive | 3/12 (25.0%) | 4/13 (30.8%) |
| Wrong definitive | 0/12 | 0/13 |
| Abstained with `insufficient_evidence` | 8/12 | 8/13 |
| No factual result: public fact skipped as private | 1/12 | 1/13 |
| Correct definitive with every selected reference verified | 2/12 (16.7%) | 3/13 (23.1%) |
| Eligible exact propositions admitted | 11/12 | 12/13 |
| Admission false positives | 0 | 0 |

Admission precision was 11/11 on unique facts and 12/12 on occurrences; recall was 11/12 and 12/13 respectively. These are final exact-proposition counts, not accuracy over overlapping internal candidates. The absence of wrong definitive labels among three unique definitive results does not turn the nine remaining unique facts into correct verdicts.

| Cases | Observed outcome |
| --- | --- |
| BD01–BD06, BD08, BD12 | Eight abstentions |
| BD07: commercial opening year | Correct `supported`; full selected set verified |
| BD09: Constitution adoption date/place | Correct `supported`; selected UNTC reference does not explicitly establish the adoption event |
| BD10: establishment mechanism | Correct `contradicted`; full selected set verified |
| BD11: historical award recipient/year | Incorrectly skipped as `private_or_personal`; no factual result |
| BDC01: synthetic personal anecdote | Correct skip; no retrieval |
| BDC02: pure opinion | Correct skip; no retrieval |
| BDC03: incomplete manual fragment | Correct `needs_confirmation`; no retrieval |
| BDC04: synthetic private/public mixture | Only public BD07 sentence searched; correct `supported`, counted solely as a repeated occurrence/control |

Terminal events were 12 `claim.result`, 3 `claim.skipped` and 1 `claim.needs_confirmation`. All 16 declared inputs were observed; there were no recorded provider errors, transport failures or local budget stops. Expected admission actions matched in 15/16 cases. Presentation expectations were not declared, so presentation correctness was not scored. Each batch's three unauthorized join/check/WebSocket probes returned 401; these are transport/authentication checks, not factual checks.

The saved search queries contain only allowed public claims/added public retrieval wording. The anecdote, opinion and incomplete controls made no retrieval calls; the mixed control's query was exactly its public second sentence. This establishes behavior of these saved development inputs, not a universal privacy guarantee.

## Selected-citation audit

The [eight-row review](../fixtures/evaluation/live/broader-development-01/review/broader-baseline-citation-review.json) is tied to exact evidence IDs, URLs and SHA-256 hashes of the returned excerpts. It covers six unique URLs across three unique definitive facts plus the mixed repeat: **7 references verified, 1 unsupported, 0 inaccessible**. The repeated BD07 references are not additional independent sources.

All six exact selected URLs were freshly requested and returned HTTP 200 substantive pages. Relevant bodies, headers, timestamps, extracted texts and bounded verification contexts are recorded under `review/origin-inspection/`; original public entity bodies remain in `/workspace/task-evidence/broader-baseline-origin-fetches/` with a hash manifest. Cache headers were observed for Panama Canal Authority and UNESCO. Fresh requests establish access through the current network path, not uncached origin-server state. Search-index access is not used as a fresh-origin claim.

The unsupported reference is the authentic UN treaty registration: it explicitly records **conclusion** in London on 16 November 1945 and a separate entry-into-force date, rather than explicitly identifying **adoption**. UNESCO's selected legal text does directly establish adoption. The strict source-verification metric requires **every selected reference** to meet the exact proposition's scope, so BD09 receives no full-selected-set credit. This does not reverse its truth label or silently replace the selected registry citation.

Museum/operator histories are retrospectives; the Smithsonian institution page describes its own establishment; the Federal Register agency profile is informational and its website disclaims being the official legal edition. The original 1846 act or 1914 ship log was not substituted. Selected highlight serializations contain Markdown, ellipses and formatting differences; their substantive passages were checked against fresh text. Shared legal instruments and retrospective sources do not become independent origins merely because publishers differ. The citation reviewer authored the open corpus, so this audit is not blinded or independent of dataset authorship; it is separate from the engine's construction and judgment.

## Declared limits, actual usage and cost

The executed wrapper declared the following **per-batch** caps before calling the campaign: 16 Jev / 8 search / 12 contents attempts; 140,000 charged input tokens; 650,000 total request bytes; 65,536 bytes per request; 90,000 ms wall time; and a 24,000-token allowance per pending/unknown Jev attempt. That allowance is not a tokenizer-derived upper bound. Earlier planning values of 12/6/9 calls and 100,000 tokens were revised before live dispatch, according to the orchestrator, to account for the mixed control's fourth eligible occurrence without assuming a cache hit. The exact wrapper comment and [limits provenance](../fixtures/evaluation/live/broader-development-01/execution/limits-provenance.json) preserve that distinction.

| Batch | Jev / search / contents | Measured input tokens | Request bytes | Known partial USD | Unknown-cost attempts | Reported elapsed ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 / 6 / 9 | 81,278 | 332,609 | 0.051 | 10 | 19,081 |
| 2 | 10 / 6 / 9 | 72,339 | 292,188 | 0.051 | 10 | 18,913 |
| 3 | 8 / 4 / 2 | 38,146 | 154,312 | 0.030 | 8 | 7,234 |
| 4 | 8 / 4 / 3 | 52,290 | 216,249 | 0.031 | 8 | 6,151 |
| Total | **36 / 20 / 23** | **244,053** | **995,358** | **0.163** | **36** | **51,379** |

All **79 dispatched attempts** returned HTTP 200 provider responses. Per-case attempt sums and the last journal totals reconcile with every report. All recorded per-batch caps were respected; the largest single request was 59,556 bytes. There were zero unknown-input-token reservations remaining at the ends of the batches. Journal records totaled 158 (50/50/28/30), including dispatch reservation and subsequent attempt progress.

**$0.163 is only the known partial returned cost.** All 36 Jev attempts have unknown cost; total cost and output-token counts remain unknown. No vendor prices were inferred. The 51,379 ms is a sum of four reported batch intervals, not contiguous elapsed time from the first batch to the last and not wearable latency.

## Latency and validation

| Client-observed terminal cohort | n | Median ms | P95 ms | Range ms |
| --- | ---: | ---: | ---: | --- |
| All input terminals, including fast controls | 16 | 2,662.5 | 8,746 | 107–8,746 |
| Unique expected facts, including admission miss | 12 | 4,188 | 8,746 | 108–8,746 |
| Eligible occurrences, including admission miss and mixed repeat | 13 | 3,802 | 8,746 | 108–8,746 |
| Actual `claim.result` occurrences | 12 | 4,188 | 8,746 | 455–8,746 |

Median averages the middle pair for an even sample; P95 uses nearest rank `ceil(0.95 × n)` without interpolation. The small-sample P95 is the maximum here. Every returned result records `cached:false`, but provider/index/CDN caching is not ruled out. The repeated public claim is not an independent cold sample. Inputs were typed fixtures through authenticated HTTP/WebSocket transport; glasses capture, OCR, ASR, spoken output and accessibility were not measured.

Validation consisted of offline metric recomputation using current metrics and its archived snapshot, exact manifest/wrapper/report/review hash checks, span/allowlist checks, attempt/journal reconciliation and recorded-limit checks. No live pipeline was rerun during packaging, and no implementation file was changed. These checks preserve and characterize this small public development baseline; they do not establish a release accuracy threshold or hardware performance.
