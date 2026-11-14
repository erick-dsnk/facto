# Second independent blind campaign

The second fresh set resolved **4 of 8 eligible factual claims correctly and definitively (50%)**. It produced no wrong definitive verdicts and abstained on four eligible claims. Conditional definitive precision was **4/4**; four unresolved eligible claims are excluded from that precision denominator and are not correctness passes. This small sample does not establish reliable production accuracy.

This set was independently authored, source-reviewed and sealed before its sole execution on a new frozen commit. It is separate from the first campaign, whose **2/8 correct definitive results, five abstentions and one no-verdict remain preserved unchanged**. The sets and freezes differ; neither pooling them nor interpreting their difference as a causal improvement is justified.

## Outcomes and action behavior

| Measure | Second-campaign result |
| --- | --- |
| Eligible facts | 8: 4 true, 4 false |
| Correct definitive / all eligible | 4/8 (50%) |
| Wrong definitive / all eligible | 0/8 |
| Abstentions / all eligible | 4/8 |
| No factual verdict / all eligible | 0/8 |
| Correct / definitive outputs | 4/4; conditional precision only |
| True facts resolved correctly and definitively | 2/4 |
| False facts resolved correctly and definitively | 2/4 |
| Pure public inputs resolved correctly and definitively | 4/7 |
| Mixed synthetic private/public input | 0/1 definitive; admitted safely, then abstained |
| Correct semantic admission | 9/10 |
| Exact admitted public spans | 10/10 |
| Completed factual results / eligible inputs | 8/8 |
| Respond / available result presentations | 8/8 |
| Clarification terminals, with retained respond presentation | 2/2 |
| Requests with terminal feedback | 10/10 |
| Local stops / transport failures / provider errors | 0/0/0 |

Abstention reasons were two `insufficient_independent_evidence`, one `below_threshold`, and one `no_agreeing_citation`. All four represent unresolved eligible facts.

| Expected semantic action | Denominator | Observed |
| --- | --- | --- |
| Check | 8 | 8 check |
| Skip personal preference | 1 | 1 needs_confirmation |
| Clarify incomplete input | 1 | 1 needs_confirmation |

The personal control's clarification is the one admission failure. Semantic classifier action and terminal event type determine action scoring. Frozen wire metadata uses only `wait`, `skip` and `check`; metadata `skip` on a `claim.needs_confirmation` terminal means stopping verification while asking for clarification, and is not an extra failure. This frozen harness retained presentation on both non-result clarification events. The earlier campaign's missing non-result presentation fields remain unmodified.

## Search isolation and independent citation review

Thirteen actual searches produced zero forbidden-private query violations, zero control-case retrievals and zero harness privacy boundary stops. The mixed input admitted and searched only its exact complete public substring; its private clause was synthetic. Personal and incomplete controls produced no search or factual verdict.

These observations are conditional on a harness that blocks unapproved spans or queries before dispatch. Authorized classification receives the submitted input; this is not evidence of unrestricted privacy behavior.

Four definitive results selected nine references. All selected IDs resolved to retained records, and no definitive output lacked a citation. Independent review reopened **9/9** selected URLs and found **9 relevant, 0 irrelevant, 0 inaccessible, 0 wrong selected stances**. All four definitive outcomes matched the exact presealed ground truth. Authority counts were six first-party-authored technical/institutional sources, including a republished official document, and three secondary sources.

Nine relevant references are not nine independent confirmations. Shared standards, rules and institutional origins are recorded in the sealed review. Opening means a new connected Exa retrieval returning substantive page text; it may use indexed or cached content and does not guarantee direct-origin freshness. Reviewer opening is independent validation, separate from **deliberate user source opens, which were not measured**. Detailed URLs, excerpts and labels remain sealed.

## Limits and usage

| Resource | Separate predeclared limit | Observed |
| --- | --- | --- |
| Jev attempts | 30 | 23 |
| Search attempts | 16 | 13 |
| Contents attempts | 24 | 17 |
| Input-token stopping threshold | 240,000 | 170,682 measured |
| Unknown allowance per pending Jev attempt | 24,000 | 0 remaining unknown reservations |
| Single request bytes | 65,536 | 58,535 maximum |
| Total request bytes | 1,000,000 | 697,709 |
| Wall time | 180,000 ms | 31,840 ms |
| Known cost | No invented prices | $0.108, partial; 23 attempts lacked cost |

All completed Jev token usage was measured. The 24,000-token allowance is a stopping reservation, not a guaranteed upper bound; a request can exceed it before subsequent dispatch is stopped. Known costs remain incomplete independently of token measurement.

## Latency and cache observations

| Population | Request denominator | Median | P95 | Cold result events | Cached result events |
| --- | --- | --- | --- | --- | --- |
| All typed requests | 10 | 3,637.5 ms | 6,710 ms | 8 | 0 |
| Eligible factual requests | 8 | 3,942.5 ms | 6,710 ms | 8 | 0 |

Duration is the harness typed-request duration through terminal receipt and provider drain, recorded in integer milliseconds. Median averages the middle pair. P95 uses nearest rank `ceil(0.95*n)` and is therefore the maximum for both small denominators. Cache flags describe the eight result events; the two clarification requests had no factual result. These sequential manual observations support no hardware benchmark or listening false-alert claim. Automatic notifications, native/iOS and ASR paths were not evaluated.

## Independent preparation and preservation

Ten inputs contained eight ordinary public factual propositions, including one mixed synthetic private/public input, plus one personal preference and one incomplete fragment. Preseal independent review confirmed **8/8 authoritative sources and exact excerpts, four true/four false labels and 10/10 admission expectations, with zero defects**. First-party standards, rules, institutional histories, service publications and an original manufacturer educational reference supplied the ground truth; no primary experimental-research claim is made.

The author knew first-campaign outcomes and public development examples previously exposed during first-runner integration after its seal. The second set used distinct specific subjects/propositions without inspecting new implementation, diffs or development diagnostics, and without targeting the announced extraction refinement. Distinctness was independently checked against the first sealed set and supplied known development exclusions; unseen development cases cannot be certified. This remains a purposive nonrepresentative sample.

Frozen commit: `7e278906bd20e4460c431eeef4b6dd93f76a0acb`. The clean freeze's full harness source scope SHA256 was verified before dispatch: `631ec1c3f1a9330cdbd6a714cbc98059cff14d16af088169db196ec895bd823a`. The scope covers tracked `apps/console`, `services/api`, `packages/contracts`, package manifest and lockfile. The worktree remained clean after execution.

One execution and zero reruns generated **118 durable journal records**: one initial reservation, 53 pre-dispatch records, 53 attempt completions, ten case completions and one completion marker. The immutable final report records `completed: true` and ten terminal receipts. Generic progress snapshots retain `completed: false` even at the final phase; completion is determined from the final report and terminal receipts. Neither campaign's original report was retrospectively enriched.

Only this aggregate/methodology markdown and its aggregate JSON are intended for the PR. Case bodies, labels, source URLs, detailed reports, journals and ground truth remain sealed outside the repository.

| Artifact | SHA256 |
| --- | --- |
| Second sealed bundle | `84bbd95e5227b231c46ab630c361b746c61812d01c2984c797d7ffb2d45f1a96` |
| Second sealed inputs | `affc6505b38c41da113d6c40db36723cf487cab71111784ae3779cba3986b198` |
| Second preseal review | `94f4b79679e176782f4f8096095ec15dc6f65dd91388e230f419e231b59fc5dd` |
| Second sanitized first-execution report | `f917d6d03816da2101f9f37f0e6984896a710fccac129d3caf6bd4c3136bad73` |
| Second original journal | `d8419d75e4e2a8a2ad9bffb3a5fdf2f7d766e128bfec338efa7ac602d7a4431a` |
| Second independent citation review | `3c79ea7cca7bd6f25f337a97a43f653c9ef2296d7451f577eba2fa98692a1271` |
| Second citation retrieval evidence | `400cf5d5048e68c1dfa285243d4af09e36fbda167fd8bc491c88280308ab14d2` |
| Second runner | `a8e73e371fd996669d559cd59b48232637a2b288ef75ea0f7b6fbe8f3e339925` |
| Second retention manifest | `65aa83bd2bd7596b33c7c5711a2a1a07e86ad738cf8ae1296a931426dafca5db` |
| Second aggregate JSON | `276f41cbe58d38d221fadc382570b9da16fbb9955efa45d487c09246504b0b8d` |
| Second private archive | `01cc97e1ab28113e427ffa97a38f09d48f1e59dce1491b833fc1adb93e68bff8` |

The private second-campaign retention archive is `/workspace/independent-evaluation-retention-02/sealed-second-first-run.tar.gz` (3,779,257 bytes). It contains unpublished cases and must remain outside the PR. The first archive remains unchanged at SHA256 `df1a87d8679823e214b705ae84fb594cc8b9461400d3ec5e0ccde8391db1128c`.
