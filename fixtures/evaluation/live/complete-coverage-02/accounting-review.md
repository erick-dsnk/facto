# Independent completed-campaign accounting review

**PASS for execution completion and accounting.** The new prospective campaign completed **32/32 inputs** across its two fixed 16-input batches. All 26 independent accounting, freeze, order, query, control and deadline checks passed. This review made no provider request and did not rerun, resume or mutate any campaign.

The immutable first report SHA-256 is `a227f9a968e32031e39d2a14eb570045435152753a7e122199879bb3777331d6`. Exact source commit `4f507f84d9f7f8881af62d9a9ae5a82aa0099ceb` remained clean, source SHA-256 `d81de5984903f607d4e6b8342f1777b3dc105f893f27e2739c98308d86f57147` matched the freeze, and plan/executor hashes matched. Detailed calculations are preserved in `audit-result.json` without modifying the first report.

| Measurement | Independently reconciled observation |
|---|---:|
| Correct definitive factual labels / all eligible facts | **20/24 (83.3%)** |
| Wrong definitive labels observed | **0** |
| Completed factual abstentions | **4/24 (16.7%)** |
| Factual operational errors, missing or unexecuted inputs | **0** |
| Correct definitive on expected true claims | **11/12** |
| Correct definitive on expected false claims | **9/12** |
| Eligible exact public admission | **24/24** |
| Privacy/personal/opinion/ambiguity controls | **8/8 matched** |
| Control outcomes | **6 skipped, 2 clarified** |
| Control retrieval attempts | **0** |
| Manual terminal feedback / all inputs | **32/32**, all `respond` |
| Factual median / P95, all 24 including abstentions | **1,877.5 / 3,472 ms** |
| Factual minimum / maximum | **718 / 5,423 ms** |
| Control median / P95, separate eight inputs | **162.5 / 188 ms** |
| Campaign wall time | **53,611 ms** |
| Actual provider calls | **61 Jev, 29 search, 24 contents** |
| Measured input tokens / unknown reservations | **421,456 / 0** |
| Known cost / attempts with unknown cost | **$0.251 partial / 61** |
| Actual cumulative request bytes | **1,802,485** |
| Largest actual single request | **67,824 bytes** |

Latency uses each observed case's `durationMs`, with controls identified from frozen expected claims rather than array position: the four controls in each batch are interleaved with the facts. P95 uses nearest rank `ceil(0.95 × n)`, and the median averages the middle pair. Independently calculated terminal-receipt median/P95 values match those case-duration values. No timeout occurred in this cohort; all factual service durations were below the unchanged ten-second deadline, with a maximum service duration of 5,419.673137 ms. Campaign wall time includes both batches and setup overhead; it is separate from per-input latency.

The four abstentions are CA08 and CB01 (`below_threshold`), CB06 and CC08 (`insufficient_independent_evidence`). They remain in the 24-fact denominator. Domain raw correct-definitive counts are history 6/6, geography 5/6, science 4/4, technology 2/4, arts 2/2 and sport 1/2. These small purposive strata are descriptive, not population performance estimates.

Every planned label occurred exactly once, in its exact frozen batch/order, with no missing case or duplicate terminal. All 114 recorded attempts actually dispatched, completed and returned HTTP 200; per-case, per-batch and aggregate usage/call/byte/cost accounting reconciles. Every Jev response had recorded valid usage. Each input stayed inside three Jev/two search/three contents attempts; both batch quotas and the global frozen caps held. The larger prospective wire cap accommodated the largest 67,824-byte request; the earlier stopped campaign's 64-KiB cap and first failure remain unchanged.

All **29 recorded searches** matched either their exact admitted public span (24 initial searches) or its frozen balanced alternate helper (five alternate searches). Recorded objective/highlight hashes matched the exact frozen helper outputs; all 24 contents requests retained the matching highlight hash and public-normalized requested URLs. The raw request bodies are intentionally not retained, so this is a replay of recorded query/hash diagnostics combined with the pinned observer's strict outbound schema guard, not an independent packet capture. Controls had no admitted public span, factual result or retrieval attempt.

All three unauthorized authentication probes returned HTTP 401 in each batch. No pipeline error, local stop, transport failure, stale revision or duplicate terminal was recorded. The eight controls demonstrate their declared behavior in this cohort; they do not prove a population leakage rate or automatic-notification performance.

All 61 Jev attempts have unknown dollar cost. Reported $0.251 is the known Exa cost only; unknown is not zero. Costs and token usage derive from provider-reported fields rather than independently verified billing/tokenization. Response-byte aggregate remains unmeasured, despite per-response size protection.

Full selected-citation verification is a separate independent audit. This accounting review confirms that selected IDs refer to retained evidence but assigns no substantive source-verification credit. The raw 20/24 target is met; the 20/24 fully content-verified target remains pending that separate review. Zero observed wrong labels is distinct from proof that every selected source grounds the whole proposition or has an independent origin.

Read-only portable-bundle verification confirmed all **1,120 historical originals** unchanged with network disabled and no archived code executed. The old stopped OR report still has SHA-256 `20171d2763a9a9e93873352845b28f4f36543ddc35e63f768f36558b91e82241`. No old campaign was resumed. This fresh OPEN cohort has no baseline arm; these observations establish neither causal improvement, blind accuracy nor readiness.
