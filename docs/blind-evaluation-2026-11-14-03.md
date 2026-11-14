# Third independent blind campaign — sole execution

The third fresh set produced **2 correct definitive answers among 8 eligible factual claims (25%)**, with 0 wrong definitive answers, 5 abstentions and 1 timeout with no factual verdict. Conditional definitive precision is **2/2**, with only **2/8 definitive coverage**. Abstentions and the timeout are not factual passes. This small purposive sample does not estimate production accuracy.

All 10 manual inputs received terminal feedback through the actual authenticated HTTP/WebSocket harness. Expected admission actions and exact public spans matched 10/10: eight checks, one skip and one needs-confirmation. All seven returned factual results presented a response; the timeout returned a service-status response, and both controls returned response feedback. The timeout supplies no factual result. Observed search calls had zero forbidden private-text matches, zero control retrievals and zero privacy-boundary stops; these observations apply to this set and harness boundary.

The freeze was clean `/workspace/live-frozen-07`, commit `3cfdfb13d8e6d37ab956e781206d892786ba441f`, scoped source SHA256 `e6f36587593f39415f161a64a02f0946f4758b9a90b5c2c0ac40399adfb8de85`. Scope: tracked console, API, contracts and package manifest/lockfile. The sealed set and input hashes were reverified before dispatch. Model was `jev-latest`, policy `glasses-p0.1`. One exclusive run lock and 125 continuous journal records preserve 56 predispatch reservations, 56 attempt finishes, 10 case checkpoints, execution completion and the later wrapper failure. There were no reruns or implementation changes during execution.

| Observation | Result |
| --- | --- |
| Terminal receipts | 10/10 |
| Local / transport / pipeline operational errors | 0 / 0 / 1 |
| Actual dispatched calls | 23 Jev, 14 search, 19 contents |
| Request bytes / measured input tokens | 701,025 / 171,172 |
| Pending / unknown input-token reservations at completion | 0 / 0 |
| Known reported cost | $0.116, partial; 24 attempts have unknown cost |
| Total elapsed time | 42.794 seconds |
| All-input p50 / p95 (n=10) | 3.817 / 10.038 seconds |
| Factual-input p50 / p95 (n=8, timeout included) | 5.098 / 10.038 seconds |
| Cached factual results | 0/7; no warm replay |
| Unauthorized join / check / WebSocket checks | 401 / 401 / 401 |

The operational error was sanitized code `timeout`, with HTTP 202 accepted and a terminal `pipeline.error` receipt after 10.038 seconds. Its six actual calls comprised two Jev, two searches and two contents requests: five response receipts and one aborted contents request. Measured input was 9,698 tokens; known cost was $0.015 with three unknown-cost attempts. No whole-case or aborted-contents retry was observed; receipts do not separately label planned refinements versus retries. The input remains in the denominator as one no-verdict among eight eligible facts.

A fresh isolated reviewer independently opened all six selected citation URLs across the two definitive results. Five yielded substantive, relevant, verdict-supporting content; one returned HTTP 200 with an application error, leaving its content and quality unverified. Both definitive results retain at least one verified supporting source; only one has every selected reference verified. Verified quality comprises four secondary explanations and one authoritative original record. No material opposing evidence appeared within accessible selected sources; there was one unrelated page-freshness caveat. This was manual assessment of retrieved source content, without model-as-judge, broad opposing-source search, replacement citations or pipeline reruns. Reviewer opening does not establish deliberate user source opening.

The executed wrapper exited nonzero **after** the full harness report and assessment were saved, because its nonrecursive public-directory creation encountered `EEXIST`. This separate publication failure and its final checkpoint remain intact. A separate artifact-only postprocessor generated the public aggregate from saved reports, with no implementation import, provider call or replay. Original executed runner SHA256: `8aa7016dc00bf5fdaa6577332754cb3152d0032a5ec060e2c2e45995533fc465`.

Approved caps were 30 Jev calls, 16 searches, 24 contents calls, 240,000 input-token stopping threshold, 24,000 unknown input-token allowance per pending Jev attempt, 65,536 bytes per request, 1,000,000 total request bytes and 180 seconds. Unknown-token reservations are stopping allowances, not guaranteed usage ceilings. Known cost excludes unknown charges.

The set was authored and independently source/admission-reviewed before execution: eight factual propositions balanced four true/four false, including one synthetic private/public mixture, plus a personal opinion and incomplete fragment. Topics differ from both earlier sealed campaigns and supplied development exclusions. The evaluator knows earlier public outcomes and high-level planned fixes; it read no new implementation diffs/docs. Unseen development examples cannot be certified. All bodies, labels, queries, identifying URLs and full source reviews remain private. First and second campaigns stay immutable and separate; these different sets/freezes must not be pooled or causally compared.

The [repository aggregate](../fixtures/evaluation/live/blind-third-run-summary.json), originally named `first-run.aggregate.json`, contains exact source/artifact hashes, separate scoring and presentation denominators, independent citation aggregates and the recovery record. A separate private retention archive and manifest preserve the third campaign's full artifacts.
