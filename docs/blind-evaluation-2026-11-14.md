# Independent blind first-run evaluation

The frozen implementation resolved **2 of 8 eligible factual claims correctly and definitively (25%)**. It produced no wrong definitive verdicts, but abstained on five eligible claims and requested clarification instead of checking one complete factual claim. Conditional definitive precision was **2/2**; this tiny denominator and low coverage do not establish reliable factual performance.

The ten requests all received terminal feedback. There was one authorized execution, no rerun, no case changes after sealing, and no implementation tuning during the run.

## Outcomes and denominators

| Measure | Result |
| --- | --- |
| Eligible public factual claims | 8: 4 true, 4 false |
| Correct definitive / all eligible | 2/8 (25%) |
| Wrong definitive / all eligible | 0/8 |
| Abstentions / all eligible | 5/8 |
| No factual verdict / all eligible | 1/8; explicit clarification |
| Correct / definitive outputs | 2/2; conditional precision only |
| Ordinary public claims resolved correctly and definitively | 1/7 |
| Mixed synthetic private/public claim resolved correctly and definitively | 1/1 |
| Correct semantic admission actions | 8/10 |
| Exact admitted public spans | 9/10; one complete public input was not admitted |
| Completed factual results / eligible factual inputs | 7/8 |
| Respond presentations / retained result presentations | 7/7 |
| Clarification terminal events | 3 |
| Requests with terminal feedback | 10/10 |
| Local stops / transport failures / provider errors | 0/0/0 |

Five factual results were `insufficient_evidence`: four cited insufficient independent evidence and one no agreeing citation. These are unresolved factual cases, not correctness passes.

| Expected semantic action | Denominator | Observed |
| --- | --- | --- |
| Check | 8 | 7 check; 1 needs_confirmation |
| Skip personal preference | 1 | 1 needs_confirmation |
| Clarify incomplete fragment | 1 | 1 needs_confirmation |

Semantic action and terminal event type determine this scoring. The frozen wire metadata action enum has only `wait`, `skip`, and `check`; a `claim.needs_confirmation` event with metadata action `skip` means clarification is needed and verification stops. Those payload values create no extra scored failures.

The original harness retained presentation only on `claim.result`. It did not retain non-result presentation fields, so missing presentation on the three clarification terminals cannot be interpreted as silence. The first-run report was not retrospectively enriched. All ten requests had terminal feedback.

## Search isolation and citations

There were 12 actual search calls, zero forbidden-private query violations, zero control-case retrievals, and zero harness privacy boundary stops. The mixed input admitted and searched only its exact public substring. The personal and incomplete controls generated no search and no factual verdict. The private clause was synthetic; no real private data was used.

The harness blocks unapproved public spans or search queries before dispatch. Zero observed search leakage is conditional on that boundary; it does not demonstrate unrestricted privacy behavior. Submitted inputs are sent to the authorized classification provider.

The two definitive outputs selected five references, all with retained records. An independent reviewer reopened **5/5** selected URLs through connected Exa retrieval: **5 relevant, 0 irrelevant, 0 inaccessible**, and all five matched their selected stance. Both definitive outcomes matched the exact presealed ground truth. Source authority counts were two first-party institutional pages, one official government treaty record, one secondary journalism page, and one tertiary encyclopedia page.

Five relevant citations are not five independent confirmations; source overlaps are recorded in the sealed review. Exa may return indexed or cached content, so opening a page this way does not guarantee direct-origin freshness. Detailed source URLs, excerpts, labels and case bodies remain sealed.

## Limits and measured usage

| Resource | Predeclared limit | Observed |
| --- | --- | --- |
| Jev attempts | 30 | 22 |
| Search attempts | 16 | 12 |
| Contents attempts | 24 | 18 |
| Input-token stopping threshold | 240,000 | 141,603 measured |
| Unknown input allowance per pending Jev attempt | 24,000 | 0 remaining unknown reservations |
| Single request bytes | 65,536 | 58,986 maximum |
| Total request bytes | 1,000,000 | 583,108 |
| Wall time | 180,000 ms | 30,080 ms |
| Known cost | No invented prices | $0.102, partial; 22 attempts lacked cost |

The 24,000-token allowance is a stopping reservation, not a guaranteed upper bound on a request. A provider can exceed a reservation before the harness can stop later dispatches. All completed Jev token usage was measured in this run; cost completeness is separate.

## Latency and cache observations

| Population | Request denominator | Median | P95 | Cold factual results | Cached factual results | Requests without factual result |
| --- | --- | --- | --- | --- | --- | --- |
| All typed requests | 10 | 2519.5 ms | 9091 ms | 7 | 0 | 3 |
| Eligible factual requests | 8 | 3957.5 ms | 9091 ms | 7 | 0 | 1 |

Duration is the harness request duration from typed dispatch through terminal receipt and provider drain, in integer milliseconds. Median averages the two middle values for an even denominator. P95 uses the nearest-rank value at `ceil(0.95*n)`; with these small denominators it equals the maximum. Cold/cached flags apply to the seven factual result events; clarification events have no retained result cache flag. These are small sequential manual observations, not hardware benchmarks or listening false-alert measurements. Independent reviewer URL openings are source validation; deliberate user source opens were not measured.

## Methodology and preservation

The set was authored independently from first-party institutional/operator publications, then independently source-checked and sealed before execution. Preseal review verified 8/8 factual labels and 10/10 admission expectations with zero issues. The scientific references are original institutional educational publications, not original experimental research.

The author read repository policy only before authoring and sealing. Later integration reads of the requested frozen harness exposed its inline development examples after sealing; no sealed inputs or labels changed. The original 12 heldout cases were not inspected or modified. No production accuracy estimate is justified by this small purposive, nonrepresentative sample. Automatic notification, native/iOS and ASR paths were not evaluated.

Frozen commit: `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f`. The worktree was clean before and after execution. Root's full source snapshot SHA256 was independently verified before dispatch: `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`.

The runner also recorded SHA256 `049cfba0da1bb9927c24261da9a45b4777908747e0196740b36d4dae827e899c` over its narrower named scope: tracked live harness, API source, contracts source, package manifest and lockfile. These hashes use different scopes and are not interchangeable.

The sealed run has 116 durable journal records: one initial reservation, 52 pre-dispatch reservations, 52 attempt completions, ten case completions and one execution-complete marker. The immutable final sanitized report records `completed: true` and ten terminal receipts. Generic progress snapshots retain `completed: false` even at the final phase; completion here is based on the final report and terminal receipts.

Only this aggregate/methodology report and its aggregate JSON are intended for the PR. Full reports, checkpoints, inputs, source reviews and ground truth remain sealed outside the repository.

| Artifact | SHA256 |
| --- | --- |
| Original sealed bundle | `28f2e3037d0d8a024cb9e2e26af58d710d6d9c637a99ab510f65bda4c74feb85` |
| Original sealed inputs | `a70fdc86739a384d18d679c7cdc3c57ad95dc24ab3d9826f2f2c465f6eef8747` |
| Preseal independent review | `0f89ac62e3eff7af436cb0f0814b31e1d40df58dde0c3a7c038e6969cc7f9593` |
| Original sanitized first-run report | `6bd336d3250f01fcc94e3d2a01923ef3742ab8b359e3d1072476086c2e04f6c0` |
| Original journal | `99140eb9db1ad4af93c95bbbae28a94e97b68a4147fce18f8148644f323d4bdb` |
| Independent citation review | `dc5a302b46d97ba5ae7393b5febb04251f4784e32d49fc072c607b17aa08c138` |
| Independent citation retrieval evidence | `479fc8fea83ee5fec608cc6973da8d73debfc2ef30674b159b1980f6d01a3957` |
| Runner used for execution | `e6e59f7dd2ef75e3a813ce6a6cf176a9515e9b920552f31d3c566ad07b980e49` |
| Retention manifest | `a18651c519197588da50c0fdcb5f81c4d3fa5741bc224d004b4a22aa28dc643d` |
| Aggregate JSON | `63da24fbb192691d039de388bfd20164c711b8eb94748aeed681d518b1081a04` |
| Private retention archive | `df1a87d8679823e214b705ae84fb594cc8b9461400d3ec5e0ccde8391db1128c` |

The private user-retention archive is `/workspace/independent-evaluation-retention/sealed-first-run.tar.gz` (3,387,836 bytes). It contains unpublished case material and must remain outside the PR. The original sealed bundle and input hashes remain unchanged.
