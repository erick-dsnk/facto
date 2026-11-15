# Fact-checking pipeline evaluation

## Live HTTP eval (fact-check port)

`npm run evaluate:live` drives any running server through its public contract: `POST /v1/sessions`, the authenticated WebSocket stream, then `POST /v1/sessions/:id/checks` with `userInitiated: true` for each case. The same script therefore measures any branch, including ones from before the port. The old in-process campaign runner is now `npm run evaluate:live:inprocess`.

```sh
# Server under test, e.g. a branch checked out locally (keys come from .env):
PORT=3311 PIPELINE_MODE=live npm start
# Eval, with DEMO_JOIN_CODE in the environment or .env:
npm run evaluate:live -- --server http://127.0.0.1:3311 --label fc-port
npm run evaluate:live -- --baseline fixtures/evaluation/live-runs/<baseline>.json --candidate fixtures/evaluation/live-runs/<candidate>.json
```

Options: `--sets everyday,hard`, `--limit N` (first N per set), `--label`, `--out-dir`, `--timeout-ms` (default 15 s) and `--baseline` (prints the ship rule after a run). Checks run one at a time, 250 ms apart. The script joins a new session every 40 checks, when fewer than 20 s of a session remain, or after a 401, and keeps joins under 10 a minute. A server that rejects `capture.lowConfidenceWords` with `400 invalid_request` gets the case once more without the field, and the row is flagged `fieldUnsupported`. A check ends on the first `claim.result` (the first claim's when there are two), `claim.skipped`, `claim.needs_confirmation`, `pipeline.error` or a 15 s timeout, which also cancels the request. Latency is measured on the client.

**Sets.** EVERYDAY is the reference app's `test/claims.json` (44 labelled claims; context is the page title and preceding text) plus [`fixtures/evaluation/device-phrases.json`](../fixtures/evaluation/device-phrases.json) (15 phrases as heard through the glasses, each with its expected label and why). HARD is the AVeriTeC held-out sample, `factcheck/.build/averitec/heldout.json` (100 claims, CC BY-NC 4.0). The script reads it in place (`FACTCHECK_REPO` points at the checkout) and writes only ids, labels and metrics: no claim text reaches the repo, a report or stdout.

**Labels.** supported → true, contradicted → false, misleading, insufficient_evidence → cant_verify, speculation. A skip with a `kind`, `not_a_claim` or `private_or_personal` (or `not_eligible_public_fact`, the older servers' confident-opinion skip) → not_a_claim; any other skip → skip; `claim.needs_confirmation` → needs_confirmation; errors and timeouts → error. AVeriTeC maps Supported → true, Refuted → false, Conflicting → misleading, Not Enough Evidence → cant_verify.

**Metrics per set.** Accuracy over the four verdict labels; outcome accuracy over every label; wrong True/False (true called false plus false called true); Can't-verify share and skip share (skip, needs_confirmation, not_a_claim or error), both over rows where a claim was expected; latency median and nearest-rank P95; Exa searches and Jev calls per check from the result's `usage` (n/a when a server sends none); a confusion matrix.

**Ship rule** (`--baseline`): wrong True/False not higher on either set, Can't verify + skips lower on EVERYDAY, and the candidate's median under 4 s and P95 under 10 s on each set.

Each run writes `fixtures/evaluation/live-runs/<UTC>-<label>.json` (set, id, expected, predicted, reason code, latency, Jev calls, Exa searches) and a matching `.md` table.

### Results

Run on 14 November 2026 with this script on two loopback servers in live mode, both sets in full. Baseline: `claude/debug-transcripts` at `d9c4f9d` on port 3301. Candidate: `claude/fc-port` at `e09879d` on port 3302, started with an empty 24 h cache. Both servers ran with `DEBUG_TRANSCRIPTS=0`. Every run finished with 0 errors and 0 timeouts; EVERYDAY used 2 sessions and HARD 3. On dev-misheard the baseline rejected `capture.lowConfidenceWords` with a 400, so the script resent the case without the field (the row is flagged `fieldUnsupported`). Reports: baseline [EVERYDAY](../fixtures/evaluation/live-runs/2026-11-14T173947Z-baseline-everyday.md) and [HARD](../fixtures/evaluation/live-runs/2026-11-14T174153Z-baseline-hard.md), candidate [EVERYDAY](../fixtures/evaluation/live-runs/2026-11-14T180853Z-candidate-everyday.md) and [HARD](../fixtures/evaluation/live-runs/2026-11-14T181040Z-candidate-hard.md).

| Metric | EVERYDAY baseline | EVERYDAY candidate | HARD baseline | HARD candidate |
|---|---|---|---|---|
| Cases | 59 | 59 | 100 | 100 |
| Accuracy, 4 labels | 26/50 (52.0%) | 44/50 (88.0%) | 8/100 (8.0%) | 38/100 (38.0%) |
| Outcome accuracy, all labels | 29/59 (49.2%) | 52/59 (88.1%) | 8/100 (8.0%) | 38/100 (38.0%) |
| Wrong True/False | 0 | 0 | 0 | 0 |
| Can't verify share (claim rows) | 7/51 (13.7%) | 2/51 (3.9%) | 24/100 (24.0%) | 55/100 (55.0%) |
| Silent/skip share (claim rows) | 18/51 (35.3%) | 3/51 (5.9%) | 72/100 (72.0%) | 9/100 (9.0%) |
| Can't verify + skips | 49.0% | 9.8% | 96.0% | 64.0% |
| Errors and timeouts | 0 | 0 | 0 | 0 |
| Latency median / P95 | 0.92 s / 5.95 s | 1.19 s / 3.60 s | 0.27 s / 6.77 s | 2.35 s / 5.14 s |
| Exa searches per check | 0.68* | 0.64 | 0.52* | 1.25 |
| Exa /contents requests per check | 0.63* | 0 | 0.72* | 0 |
| Jev calls per check | 1.66* | 2.02 | 1.52* | 2.45 |

\* The baseline sends no `usage` field, so a preload on its server process counted its calls from outbound HTTP (host, path and status only). The same count on the candidate matched its reported usage exactly: Jev 364/364, Exa 163/163.

**Ship rule: PASS.**

- EVERYDAY wrong True/False not higher: 0/59 to 0/59.
- HARD wrong True/False not higher: 0/100 to 0/100.
- EVERYDAY Can't verify + skips lower: 49.0% to 9.8%.
- EVERYDAY median 1.19 s < 4 s and P95 3.60 s < 10 s.
- HARD median 2.35 s < 4 s and P95 5.14 s < 10 s.

The candidate answered True or False on 44 EVERYDAY cases (27 True, 17 False) and 23 HARD cases (11 True, 12 False), and none of them crossed the true/false line. One HARD False is gold Misleading (misl-404). No case the baseline got right got worse on the candidate. 23 EVERYDAY cases and 30 HARD cases went from wrong to right, among them the seven `context-*` pronoun cases, dev-eiffel-context, dev-nasa-moon, dev-attributed-recent, dev-prediction and dev-hearsay-bulls.

An earlier candidate run at `3f716b9` failed the ship rule on one case: hard true-066 (gold Supported) came back False because the evidence named the US affiliate of the organisation in the claim. The judge now treats a claim that names a closely related body (an affiliate, a national branch, a parent body) in place of the exact one as misleading, and true-066 ends Can't verify (`below_threshold`).

Still open:

- The kept privacy questions hold some public facts: `private_or_personal` on 8 HARD rows and on EVERYDAY myth-07, data-02 and context-01; `private_life_not_checked` on 8 HARD rows.
- everyday nonclaim-02 is labelled not_a_claim in the reference set, but it is a forecast, which Q2b treats as a claim. The candidate answered Can't verify.
- False myths ending Can't verify after two searches: everyday myth-04 and dev-ipo. dev-great-wall came back Misleading.
- Google Fact Check Tools was skipped on both runs (no `GOOGLE_FACTCHECK_API_KEY`), and neither set has a weather case, so Open-Meteo never ran. Wikimedia returned 11 rate-limit responses during the candidate run.

Smoke run on branch `claude/fc-port-asr-eval` (base pipeline, before the admission, sources and verdict ports merge), live mode on a loopback server, first three EVERYDAY claims, 14 November 2026 ([report](../fixtures/evaluation/live-runs/2026-11-14T171438Z-smoke-fc-port-asr-eval.md)). It shows the script runs end to end against live providers; three cases measure nothing about accuracy.

| Metric | EVERYDAY: smoke-fc-port-asr-eval |
|---|---|
| Cases | 3 |
| Accuracy, 4 labels | 0/3 (0.0%) |
| Wrong True/False | 0 |
| Can't verify share | 2/3 (66.7%) |
| Skip share | 1/3 (33.3%) |
| Latency median / P95 | 3.80 s / 3.84 s |
| Exa searches, Jev calls per check | n/a (this pipeline sends no `usage`) |

## Latest researched 100-input OPEN cohort

A fresh independently reviewed synthetic dataset completed **100/100 inputs** on unchanged backend `b218094`: **69/80 correct definitive facts (86.25%)**, ten abstentions, one factual clarification and zero observed wrong labels or operational errors. Exact public-span admission was **79/80**, precision **79/79**, recall **98.75%**, F1 **0.99371**. Controls matched **18/20 exact actions**, while all twenty avoided public retrieval and factual verdicts; all hundred manual presentations responded. Factual median/P95 over all eighty observations were **2.2555/6.407 seconds**. Actual usage was **194 Jev, 94 searches, 80 contents, 1,376,217 input tokens**, with **$0.818 known partial cost and Jev charges unknown**.

False alarms were **0/39 completed true checks** (forty declared, three abstentions/one clarification); false support **0/40 completed false checks** (seven abstentions). Descriptive Wilson 95% upper bounds are **8.97%/8.76%**, not population safety guarantees. Conversational factual coverage was **19/24**, standalone **50/56**. Agent inspection verified **198/246 selected references**, with **31/80 facts (38.75%) fully selected-set content-verified**, **68/80 with at least one verified selection** and **62/80 with two verified publisher/domain groups** (not authenticated independent origins). Forty-one access/content failures and seven scope gaps remain; the fully content-verified 64/80 development target failed. Download the authored reusable [100-input CSV/JSON and full report](coverage-100-01.md). These are isolated synthetic turns, not real participant conversations, ASR or a blind evaluation. Prior cohorts remain separate and unpooled; no causal improvement or readiness claim follows. All completed-run provider authorizations are consumed.

## Latest complete OPEN live evaluation

A fresh prospective campaign on clean source `4f507f8` completed **32/32 inputs**: **20/24 correct definitive facts (83.3%)**, **13/24 with every selected citation independently content-verified**, four abstentions and zero observed wrong labels or operational errors. All eight controls passed (six skips/two clarifications, manual feedback, zero retrieval). Factual median/P95 including abstentions were **1.8775/3.472 seconds**; campaign wall time was **53.611 seconds**. Actual usage was **61 Jev, 29 searches, 24 contents, 421,456 input tokens**; **$0.251 known partial cost**, with Jev charges unknown. Agent inspection verified **61/70** selected references; eight were inaccessible and one retained excerpt had incomplete scope. All 20 definitive results have at least one verified selected citation, which does not replace full-selected-set credit or prove independent origins.

Post-run user-requested false-alarm rate was **0/12 known-true claims labeled contradicted/misleading**; false-support rate was **0/12 known-false claims labeled supported**. True/false abstentions remain separate (1/3), and control false-positive admission was **0/8**. These small OPEN counts do not establish a zero population rate. The raw 20/24 target passed; the fully content-verified 20/24 target failed. The earlier stopped 4/8 cohort remains separate and was not resumed or pooled; no causal improvement or readiness claim follows. See [the complete report](complete-coverage-02.md) and [immutable evidence](../fixtures/evaluation/live/complete-coverage-02/README.md). All completed-run authorizations are consumed. The ongoing evaluator now records both factual error directions with completed and definitive-only denominators; its reporting-only change passes **689 tests, 36 development scenarios and 21 presentation fixtures**.

## Ordinary-reference continuation

The `codex/46-ordinary-reference-coverage` continuation adds a deliberately less restrictive ordinary-reference evidence path, self-contained citation selection and nonblocking cleanup. Frozen source `7f029154970d62f9f8024fb9849bbd8a56daf8ec` passes **684 tests, 36 development scenarios and 21 presentation fixtures**. A fresh first-run OPEN cohort stopped at its fixed request-byte cap: **4/8 declared facts correct definitive, 3/8 with all selected references content-verified**, one local stop, three facts and all four controls unexecuted. The declared usefulness target failed; no readiness or causal improvement claim follows. The prior complete 4/12 factual cohort remains a separate historical result. See [the implementation and live report](ordinary-reference-coverage.md) and its [durable evidence](../fixtures/evaluation/live/ordinary-reference-coverage-01/README.md). This run and all bundled historical authorizations are consumed; never resume or rerun them.


## Preceding evidence and scope

The preceding published integration at `7333f57c2da7c757014472194e8a5efcb4f707b4` passed lint/typecheck and **621 tests across 30 files**. The reviewed Exa envelope guard now rejects explicit failed response metadata before normalization can discard it; its independent regression and saved-success parity evidence is in `fixtures/retrieval/exa-envelope-guard-01/`. It includes later evidence-retention, absolute-deadline, exact-claim cache/notification and selector-metadata changes outside the completed candidate09 freeze; those changes have no new live success credit here. The latest completed broader public cohort is clean freeze `9a5e80d88bd1d93e4a1c194d23bc1a59662af135`, source SHA-256 `9de0531baa85af7bac2d1940b28c91136dce6c455bcafe24e3cf7b1d8739f9ad`. That freeze passed 525 tests, 36/36 development scenarios and 21/21 presentation fixtures.

The [Exa cleanup integration](../fixtures/evaluation/live/exa-cleanup-integration-01/validation.json), tested clean at `d5dcde2`, also passed a fresh 36/36 development evaluation and 21/21 presentation fixtures. It preserves known provider/status/size errors when response cleanup rejects or remains pending. A native local HTTP peer-reset reproduction and separate injected-stream regressions support the fix; retries, actual charges and deadlines remain unchanged. The runtime branch passed 533 tests, and the source-quality branch 341; these are historical checks, separate from the preceding 621-test root gate.

The [first experimental applicability study](../fixtures/verdicts/typed-applicability-calibration-01/README.md) completed 84 Jev calls over 42 paired cases but issued no eligibility grants: 0/18 positives passed .85, and both arms abstained on every case. Exact ternary matches were 27/42 declared cases (27/37 asked); five current-status exclusions remain in the denominator. Later vendor documentation established that the added question lacked its own explicit evidence/descriptor reference: question IDs are hidden and sibling questions cannot supply that binding. The archive preserves the failed run and corrected review inference. That failed first run remains unchanged.

The separate [corrected-binding observation](../fixtures/verdicts/typed-applicability-calibration-02/README.md) completed 42/42 candidate-only Jev calls. Only **1/18 positives** passed .85 (0/15 original cases, 1/3 identity cases); no negative (0/18) or uncertain control (0/6) passed. One internal semantic eligibility token was issued, but all 42 final policies abstained. Raw matches were 28/42 declared (28/37 asked), retaining five planned current-status exclusions. Usage was 438,832 known input tokens, 1,944,573 request bytes and 258,724 response bytes over 8,776 ms, with no Exa call, retry, failure or missing result. Baseline was not run (N/A); this is a distinct OPEN observation with no paired causal comparison, pooling, authority activation or factual-coverage credit. A later three-facet diagnostic completed once and failed: 2/12 compatible cases passed, 0/6 incompatible and 1/6 uncertain cases were accepted; all 24 ordinary policies abstained. It adds no factual-coverage credit and does not justify promotion. The separate one-call canonical-target acquisition probe also completed with a negative exact-whole-unit result. Their complete OPEN evidence and unwired prototype sources are in the [fresh-cloud continuation](fresh-cloud-continuation.md); all historical live authorizations are consumed.

The separate [record-acquisition probe](../fixtures/retrieval/record-acquisition-feasibility-01/README.md) recovered 0/4 exact canonical-URL/complete-unit targets using neutral document-identity queries: four search and five contents calls, 0 Jev and $0.038 reported Exa cost. These are acquisition diagnostics, not an actual factual-query coverage estimate. Cached content, different document versions and retained-window limits remain explicit; no current-origin proof or factual credit follows.

[Candidate09](broader-development-candidate09.md) produced **4/12 correct definitive unique facts**, **3/12 with every selected reference verified**, eight abstentions and no operational error. All **13/13 eligible public occurrences were admitted** and **16/16 inputs received terminals**. The mixed BD07 repeat abstained and adds no unique-fact credit. Its original guard halted between batches 1 and 2; a reviewed artifact-only correction allowed only unstarted batches 2–4, preserving batch 1 without a rerun. The selected Olympics reference remained inaccessible on a separate bounded fresh request.

The separate [candidate08](broader-development-candidate08.md) record remains **6/12 correct definitive and 4/12 fully source-verified**, five abstentions and one operational `exa_content_failed` result. The [broader baseline](broader-development-2026-11-14.md) remains 3/12 correct definitive and 2/12 fully verified. These are repeated **OPEN development** runs on the same inputs, neither blind nor causal comparisons; old failures and source-access limits remain unchanged.

The [actual-provider automatic campaign](automatic-development-2026-11-14.md) retained **five action passes and one inconclusive result**. Its separate AD07 followup exercised supported-fact silence; it does not replace the original inconclusive AD03 or alter that six-scenario score. These probes repeat existing facts and add zero unique factual claims. Agent citation inspection is disclosed as agent inspection; inaccessible references remain unverified. There is no additional human sign-off gate. Useful coverage, source access/independence and operational reliability remain insufficient for a readiness claim; native/device/ASR/deployment measurements remain deferred. See the [proposed backend readiness contract](backend-readiness.md).

The auxiliary candidate08 acquisition comparator has a [separate threshold correction](broader-acquisition-comparison-correction.md): substance/common-origin confidence 0.85, stance 0.8. Its recorded-assessment yield is not independently verified coverage; primary 6/12 raw and 4/12 fully verified results are unchanged. The original hashed packages remain immutable.

Frozen09 included per-target recovery/status diagnostics, richer contained-highlight retention and stream-lifecycle fixes. Its joint repeated-corpus result does not isolate any fix effect. The later evidence-retention and absolute-deadline fixes are outside that live freeze. For exact-head attribution, `e88b41e` passed 483 tests on the runtime branch; the combined evaluation branch including that commit passed 530 tests. The frozen candidate09 report's phrase “Later integration `e88b41e`” refers to this combined integration, not a 530-test gate on the runtime branch itself.

The earlier integration at `ec754c6` passed a fresh 36/36 development evaluation and 21/21 presentation fixtures. [Recorded validation](../fixtures/evaluation/live/deadline-integration-01/validation.json) separates the 500-test runtime branch from the 547-test combined branch. The deadline fix checks the existing absolute deadline before provider dispatch, after completion and before result/cache commit, even if the timer callback is delayed. Three previously failing reproductions now pass; 17 new regression tests cover late success, retries, cancellation, queued requests, cache delivery and corrections under the original deadline. This is deterministic runtime evidence, not a new live-provider campaign.

The cache/selector integration at `e0f6370` passes a fresh **36/36** development evaluation and **21/21** presentation fixtures. Its [validation](../fixtures/evaluation/live/cache-selector-integration-01/validation.json) records the clean **564-test/28-file** root gate separately from the **517-test/24-file** runtime working-tree gate based at `8117b4f`; the latter had uncommitted selector files whose four tested source hashes match the clean integration. The four recorded file hashes identify that tested working-tree state.

Factual cache and notification identities now preserve exact admitted case and whitespace. Injected runtime reproductions exposed wrong cached supported labels for `MW` versus `mW`, `MUST` versus `must`, and quoted `"A B"` versus `"A  B"`, plus erroneous duplicate suppression. Exact repeated claims still reuse factual cache entries under the same context/language/mode/policy/model, and exact repeat notifications remain suppressed across context/mode changes. The internal selector exports normalized input versions and dependence context; retained outputs match the prior selector in **151 compared pools** (11 saved public pools and 140 synthetic/permutation pools). This exports material metadata only and activates no provenance capability.

Earlier OPEN judgment studies remain [archived without promotion](../fixtures/verdicts/full-context-basis-comparison-01/README.md). The [18-call context diagnostic](../fixtures/verdicts/judgment-context-diagnostic-01/README.md) found context-sensitive quality scores without an ID-binding defect. The 24-call wording comparison improved target quality recall from 2/4 to 3/4 in each order, but its three newly definitive outputs included selected passages missing a continent relation or first-award ordinal. All 11 selected passages were present; eight completely covered their propositions and three were partial. No fully source-verified factual gain is established, and the production quality prompt and thresholds remain unchanged.

The separate [48-call scope study](../fixtures/verdicts/full-context-scope-study-01/README.md) is archived **without promotion**. Both arms already passed the 12 prospective target controls (7/7 matching scopes, 0/5 mismatch false accepts, 12/12 stance choices): no gain. Existing outcome-informed diagnostics produced **two adverse BD10 cells**, changing contradictory Smithsonian results to abstention in both orders, with 21 scope-gate losses overall. The reversed Baikal pair still lacks retained continent mapping. Prospective synthetic controls and existing diagnostics are separate strata, not new factual coverage; production scope wording and thresholds remain unchanged.

## Earlier combined freeze and sealed results

Earlier combined implementation: clean freeze `3cfdfb13d8e6d37ab956e781206d892786ba441f`, source SHA-256 `e6f36587593f39415f161a64a02f0946f4758b9a90b5c2c0ac40399adfb8de85`. Lint, typecheck and **429 tests** pass. The default evaluator remains **36/36** scenarios (34 scripted plus two authenticated injected-runtime cases) and **21/21** presentation fixtures; E33/E43 measured 258/10,033 ms. Exact branch gates and this separate development artifact are in `fixtures/evaluation/live/final-backend-validation.json` and `final-backend-development-results.json`.

The earlier bounded public replay (run 07) completed **9/9** authenticated requests with no operational failures, **2/5 correct definitive factual results**, three abstentions, and correct skip/wait/cache/private-span controls. Its ninth request is a pure-opinion control, separate from the unchanged five unique factual claims and the 36-case fixture evaluator. The report preserves the earlier run 06 regression and all failures. Seven unique selected citation URLs were attempted; six were accessible/relevant and the memorial returned 403. Opera consequently has only one independently inspected accessible selected source family; an unselected retained source does not fill that selected-source gap. See [the campaign and citation record](live-campaign-2026-11-14.md).

Three different independently authored and reviewed sets each ran **once** on their own clean freeze. Their outcomes remain separate:

| Sealed campaign | Frozen commit | Correct definitive / eligible | Abstentions | No factual verdict | Admission |
| --- | --- | --- | --- | --- | --- |
| [First](blind-evaluation-2026-11-14.md) | `b66fa5d` | 2/8 | 5 | 1 clarification | 8/10 |
| [Second](blind-evaluation-2026-11-14-02.md) | `7e27890` | 4/8 | 4 | 0 | 9/10 |
| [Third](blind-evaluation-2026-11-14-03.md) | `3cfdfb1` | 2/8 | 5 | 1 timeout | 10/10 |

No wrong definitive label was observed within each small purposive campaign, but conditional precision excludes abstentions/no-verdict outcomes and does not estimate population accuracy. The cases and freezes differ: do not pool the outcomes or interpret differences as causal improvement. The third sealed campaign’s **2/8 correct definitive coverage remains a substantial usefulness gap**, not a readiness pass. Third-run source review verified five of six selected references; one HTTP 200 application-error page remains unverified. Both definitive outcomes retain at least one independently verified supporting reference, but only one has all references verified.

The third harness preserved all ten terminal receipts, including a sanitized timeout after an aborted content fetch. Its wrapper then failed to create an already-existing public report directory; the full report, assessment and journal had already been saved. Separate artifact-only recovery published the aggregate without importing the implementation, calling providers, rerunning cases or changing original receipts. Both failures and their distinct meanings are recorded.

During those earlier sealed campaigns, implementers did not open fresh sealed case bodies or open/run the original 12 reserved records; the earlier exposure caveat still applies. Later fixes were developed against public source diagnostics and synthetic development fixtures; each of those evaluated historical freezes received a separate fresh set. The original held-out exposure caveat remains. Each historical execution remains bound to its original freeze. Later implementation changes and reporting commits do not retroactively change or revalidate those observations. Historical frozen evidence below remains available and must not be substituted for the latest results.

Historical first evaluated snapshot, 14 November 2026: the backend and durable live harness were frozen at `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f` (source SHA-256 `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`). Lint, typecheck and **341 tests** passed; the refreshed development artifact records **36/36 scenarios** and **21/21 presentation fixtures**. Later commits propagate the same fact-checking implementation through the issue stack. A subsequent harness-only reporting fix preserves validated presentation fields on future non-result terminals; its gate passed **350 tests**. It changes no runtime policy and was not retroactively applied to the frozen reports or evaluated live.

The actual authenticated HTTP/WebSocket development campaign now has durable attempt checkpoints, separate byte/token/call budgets, named Jev answers, exact public queries, retained evidence and correlated terminal receipts. Its final replay completed 8/8 requests with **2/5 correct definitive outcomes on unique eligible public claims** and three abstentions. The initial network failure and two zero-coverage campaigns remain recorded. Real invalid-key probes returned one sanitized nonretryable HTTP 401 per provider. Independent citation inspection opened 7/8 selected development URLs; one remains inaccessible. These are agent inspections; they do not imply human review or remove inaccessible-source limits.

A newly authored and independently reviewed 10-case sealed set was run **once** against the frozen source. All 10 requests reached terminal events, but only **2/8 eligible factual claims received correct definitive labels**; five abstained and one received no verdict. Conditional definitive precision was 2/2; this small purposive sample does not estimate population accuracy. Admission matched 8/10 expectations, and no forbidden-private query was observed in 12 searches. This is a substantial coverage/admission failure, not a completion or readiness claim. No implementation changes were made during that frozen execution, and implementers did not inspect its case bodies. Later public-development fixes and separate fresh evaluations are reported above.

See [the authenticated campaign record](live-campaign-2026-11-14.md), [the independent first-run report](blind-evaluation-2026-11-14.md), and `fixtures/evaluation/live/`. The original 12 reserved records remain unchanged and unrun, with their earlier exposure caveat retained. Glasses, native decoding, ASR, deployment and listening-time measurements remain outside this backend continuation.

The sections below preserve earlier evidence and limitations. The previous handoff had 291 passing tests and an interrupted, unavailable live runner; those historical records must not be substituted for the current durable results.
## Reproducible development result

Run `npm run evaluate` from the repository root. The machine-readable development report is `fixtures/evaluation/development-results.json`; dataset loading and held-out isolation are explained in `fixtures/evaluation/README.md`. The runner reads the metadata-only manifest, selects the development split, and only then opens the development case bodies. The 12 held-out bodies are in a separate file and are not read during the default run.

At integration commit `ecda5dafe6254d80d2c173adea4fe9435ce46e68`, `npm run check` passed lint, typecheck and 291 tests. The runtime evaluation exercises two composed transport scenarios with deterministic injected providers. This is backend control-flow evidence, not live-provider semantic evidence.

| Measurement | Recorded outcome | What was tested |
|---|---:|---|
| Development scenarios | 36 passed / 36 selected; 0 failed, 0 not run | 34 scripted policy fixtures plus 2 injected-runtime transport cases |
| Admission stage | 33 executed | Public/personal gates, waiting, exact mixed spans, Unicode and capture confidence |
| Evidence/verdict stage | 17 executed | Synthetic evidence, conflict abstention and copied-source suppression |
| Presentation stage | 17 executed | Manual completion and automatic restraint with injected session state |
| Malformed-provider fixture | 1 executed | Invalid Jev answers fail as an operational error |
| Shared presentation fixtures | 21 passed / 21 | Same action/reason fixtures as B7's policy tests |
| Correction sequencing (E33) | Pass; frozen continuation artifact 202 ms | Authenticated HTTP submissions, WebSocket events; revision 1 retrieval was aborted and emitted no stale result; corrected revision 2 requested confirmation |
| Provider deadline (E43) | Pass; frozen continuation artifact 10,036 ms | Authenticated HTTP submission and WebSocket operational error; the runtime aborted a hung injected admission provider at its 10 s deadline, with no factual result |
| Reserved held-outs | 12 / 48 cases | Default run selects development before opening case bodies; held-out blind status is qualified below |
| Successful live admission / judgment / Exa calls | 3 / 2 / 2 | Direct adapters; separate from this fixture harness |
| Selected live citations inspected by agent / human | 1 / 0 | Historical Sydney Opera House claim; see smoke record |
| Real glasses capture / output runs | 0 / 0 | Not measured |

E33 and E43 exercise the real local Fastify server, authenticated HTTP routes, and authenticated WebSocket event delivery, with synthetic providers and a fixed application clock. E43's measured duration includes the runtime's configured 10-second wall-clock deadline. These results establish transport and orchestration behavior for deterministic injected providers; they do not measure Jev/Exa semantics, network reliability, or user-visible app behavior. Native disconnect and TTS-feedback validation belong to future glasses integration.

The 17 executed presentation decisions have this confusion matrix. Rows are expected actions; columns are actual actions. These are policy fixtures with known input state, not notification quality in a listening session.

| Expected / actual | silent | notify | respond |
|---|---:|---:|---:|
| silent | 9 | 0 | 0 |
| notify | 0 | 1 | 0 |
| respond | 0 | 0 | 7 |

The 48 scenarios use the plan's distribution: 12 personal/opinion/nonclaims, 12 public facts, 8 mixed/ambiguous, 8 capture/corrections and 8 service/lifecycle cases. Scripted model decisions cannot measure Jev's semantic accuracy, so admission precision/recall are deliberately absent. Synthetic source stances cannot establish factual correctness or source relevance. The code preserves null/unmeasured metrics instead of reporting zeros as successes.

The original 12 split records remain unchanged and unrun; their canonical JSON SHA-256 is `16f927c84ed3703356280f02241b4354d35ef6337288d3495ef08b7969aa37bb`. A prior accidental search over the legacy combined corpus may have exposed held-out text in a tool result. It was not an intentional held-out run and was not used to tune the pipeline, but exposure cannot be ruled out. We therefore make no blind-held-out accuracy claim. The replacement set from the earlier session was unavailable. This continuation created a different independent 10-case set, reviewed and sealed it, and preserved its first frozen-code execution in the independent report linked above. Its bodies remain outside the repository, development report and default runner.

In these fixture judgments, only the predeclared Helsinki/Finland, Helsinki/Norway and lightning propositions receive explicit substantive synthetic records, ordinary-risk assessments and distinct synthetic-origin assessments. The conflicting laboratory fixture has an unknown-risk assessment, while the echoed battery promotion is assessed as promotional with a common origin. Unrecognized propositions remain unclear and do not inherit a positive source-quality assessment. These labels test the policy gates only; they are not claims of real source quality.

## Selected-topic integration coverage

The continuation adds a deterministic literal matcher over the exact admitted `checkedText` and the session’s currently enabled `selectedTopics`, recomputed immediately before presentation (including cache hits and in-flight preference changes). It normalizes Unicode with NFKC, case and whitespace, requires whole phrase boundaries and ignores empty or punctuation/symbol-only topics. It never examines rejected private clauses or context and adds no provider calls. It does not infer semantic categories: `weather` does not match a lightning sentence without the literal enabled phrase. Topic priority still passes through ordinary contradiction, opt-in, session, evidence, cooldown and duplicate gates.

Targeted notification/runtime tests use real admission and runtime logic with synthetic Jev answers and synthetic evidence; E33/E43 additionally drive the composed authenticated service. These are distinct from the direct live adapter smoke below. The development denominator remains 36 and the 12 held-outs remain reserved.

## Bounded live adapter smoke test

On 14 November 2026, the production adapters at commit `394ae9c44b000f8e98da353a53d4cebfe1405d7c` ran on Node 22.22.1 with Jev `jev-latest` and policy `glasses-p0.1`. See the [sanitized smoke record](live-smoke-2026-11-14.md) for cases, queries, source inspection and failure details. These fresh, isolated calls bypassed session transport, runtime orchestration and presentation; they do not prove authenticated HTTP/WS or wearable behavior. No held-out cases were used.

| Input scope | Observed outcome | Isolated adapter elapsed time |
|---|---|---:|
| Mixed synthetic anecdote and “Mount Fuji is located in Japan.” | Only exact public span `[26,57)` searched; `insufficient_evidence` / `insufficient_independent_evidence` | 2,086 ms |
| Standalone synthetic personal anecdote | `skip` / `private_or_personal`; no Exa call and no truth verdict | 288 ms |
| “The Sydney Opera House opened in 1973.” | `supported` / `qualifying_evidence`; retained National Museum of Australia citation | 1,894 ms |

Actual Jev HTTP 200 responses passed strict choice/probability/noul parsing. Actual Exa SDK search responses yielded five retained highlight passages per public claim. Both inspected outbound queries contained only the admitted public proposition. This establishes behavior for these smoke cases, not an eligibility score or population leakage rate. Relevant Fuji passages were retained, but only one passed both model relevance and scope gates; the conservative policy abstained. No thresholds or source rubric were tuned from this sample.

One deliberately invalid key per provider produced HTTP 401 and a sanitized, nonretryable operational error (`jev_authentication` and `exa_authentication_failed`), with one attempt each. No retries or content-fetch calls occurred. Live 429, timeout, malformed-answer, empty-retrieval, cancellation and source-conflict paths were not induced; existing automated fixture/runtime checks remain separate evidence for those paths.

The agent opened the selected [National Museum of Australia page](https://www.nma.gov.au/defining-moments/resources/sydney-opera-house) and confirmed its historical opening-year passage. This was agent inspection, not human review; no extra human sign-off gate is imposed. A second operator page was inspectable; a Museums of History NSW page returned 403, so its Exa highlight remains independently unverified. The result did not use an official-site shortcut.

The three case durations above are direct-adapter wall times, with no application cache, and are not end-to-end latency statistics. Recorded Jev input-token usage was 14,933. Only the second Exa search cost ($0.007) was retained numerically; first-search and Jev costs are unknown, so total cost is unmeasured. There was no listening time, source-opening user study, native decoding, deployment, ASR or glasses run.

## Live classification and source-assessment probes

Live classification-only probes were reported to make 40 Jev admission requests and consume 87,883 input tokens across four separate runs: baseline (16 requests), diagnostic (4), a 16-request polarity experiment that failed its declared checks, and a 4-request follow-up that confirmed all four targeted checks. The failed experiment remains a failure; the follow-up does not erase it. These probes checked admission wire behavior on synthetic text, not truth accuracy, Exa retrieval, or end-to-end latency. The underlying temporary result files are unavailable, so these counts are historical transcript evidence and are not independently rechecked here. No held-out cases were used.

A separate maximum-size judgment wire probe was reported to send 55 questions for six synthetic retained sources in one Jev request. It used 8,482 input tokens; reported Jev wire time was 344 ms and total probe time was 355 ms. The synthetic instruction-like passage was quarantined from citation selection. These are historical transcript figures only: the `/tmp` result is no longer available for independent rechecking. At most, the result indicates a reported request/response compatibility and narrow injection-handling probe; synthetic sources do not establish source reliability or factual accuracy.

The alternate-search and retry implementation passed offline validation: the alternate search is limited to the first policy-approved insufficient/empty retrieval, within a shared 10-second deadline, three Jev calls, two searches and three content fetches. Later uncached claims do not wait for another attempt. Cancellation, supersession and stale revisions suppress old results; a retry clears earlier source assessments and runs a fresh judgment; only the final successful result is cached. Real provider failures remain operational errors, never factual verdicts. The integrated gate passed 291/291 tests and an independent review passed 35 targeted checks.

### Interrupted authenticated HTTP/WebSocket provider campaign

A later campaign was attempted against the frozen `ecda5dafe6254d80d2c173adea4fe9435ce46e68` backend. Its temporary runner and report are gone, so the following figures are transcript-only historical evidence and cannot be independently rechecked from this checkout. They do not count as a completed live end-to-end campaign.

The interrupted cases included: L1, a public Sydney Opera House opening-year claim, which ended `insufficient_evidence` / `insufficient_independent_evidence` with six retained sources and one passing direct-and-scope source assessment; L2, a lightning maxim, which returned `needs_confirmation` / `incomplete_or_unclear` before retrieval (the exact gate answer was not retained); L3, a personal anecdote, which skipped as `private_or_personal` without Exa; and L4, mixed private rent plus public Oslo context, which returned HTTP 202 and issued only the exact public Oslo query, but the runner stopped before a terminal WebSocket result. L5 and L6 and the repeat-cache case were not sent. No selected citation path was inspected in this campaign, so citation-path coverage is zero. The NMA citation inspection in the preceding direct-adapter smoke is separate evidence.

The transcript records seven Jev attempts, including one earlier aborted request whose provider usage is unknown; 27,025 measured Jev input tokens plus a conservative 5,293-token reservation for that unknown request; three Exa searches; and zero content fetches. All recorded completed provider responses were HTTP 200. No per-case usage, cost, end-to-end latency, Exa query log, or terminal event sequence is available. The run stopped because the harness compared cumulative request bytes with its token ceiling and misclassified the result as a budget stop; a polling defect also stopped observation after an internal completion signal without waiting for the correlated WebSocket terminal event. It did not establish actual provider failure behavior, citation delivery, or a completed end-to-end result.

Do not resume from the old counters or describe this as a pass. Rebuild a portable harness with token accounting from actual usage, byte limits accounted separately, correlated WebSocket terminal receipts, per-case usage, and safe local stops distinguished from provider errors. Re-run from an explicit fresh budget and save a sanitized, durable report. The older 40-request classification result and 55-question judgment result are also historical transcript results; their raw `/tmp` artifacts are unavailable, so their documented counts are not independently revalidated here.

## Evidence required before live claims

Keep fixture, provider-probe and live end-to-end records separate. Current cohort reports above supersede the pending measurement status in the historical smoke table below. For each backend run retain only non-sensitive aggregate telemetry: model/policy version, case label, route, cold/cached status, search/model-call counts, usage, cost if known, sanitized error class and elapsed time. Do not store original input text, rejected private context, prompts, audio, images or credentials in this report.

Before using a definitive demo result, independently inspect every selected citation for the exact proposition, scope, substance and provenance. Record the URL, excerpt hash, inspection time, access limits and whether an agent or human performed the review; do not relabel agent inspection as human review. An inaccessible selected reference prevents full-selected-set verification. This is content verification, not an additional human approval or sign-off gate. A URL or synthetic fixture passage alone is not completed inspection.

### Historical smoke measurement table (superseded)

| Metric | Numerator / denominator or measurement required | Historical smoke state |
|---|---|---|
| Admission precision and recall | Correct public admissions / admissions; recovered eligible spans / eligible spans | Pending live, independently labeled spans |
| Private-query leakage | Queries containing rejected private details / inspected outbound queries | Two inspected live smoke queries excluded rejected private context; broader integrated evaluation pending |
| Wrong definitive labels and abstentions | Wrong definitive / definitive; abstentions / factual cases | Pending live evidence review |
| Source relevance | Direct, scope-matched passages / inspected passages | One selected citation inspected by agent; later cohort audits are linked above |
| Median/P95 latency | Accepted text → result, with sample size | Three direct-adapter times above; authenticated live end-to-end measurement pending |
| Cost | Actual model tokens, search/content attempts and ASR duration | Partial smoke usage above; total live cost and ASR duration unmeasured |
| False alerts | Incorrect unsolicited alerts / listening minutes | No listening time measured |
| Duplicate/stale speech | Incidents / eligible deliveries and cancelled requests | Future native audio integration measurement |
| Deliberate source opens | User-requested source openings / offered results | Future app UI measurement; a glance is not a source check |

## Remaining backend acceptance work

- Improve useful coverage and admission quality on newly authored development cases without inspecting or tuning against the sealed evaluation bodies. The first blind result stays 2/8 correct definitive and 8/10 admission; abstentions and clarification mistakes are failures against those expectations.
- Investigate how to retrieve inspectable, attributable underlying records for ordinary reference facts while preserving exact public spans, independent corroboration, risk-sensitive gates and the prohibition on official-site shortcuts. Do not lower thresholds to force the existing examples through.
- Independently inspect every selected definitive demo reference and disclose agent versus human method, exact source scope and access limits. Existing agent audits do not verify inaccessible references or prove independent origins merely from separate publishers; no extra human sign-off gate is imposed.
- Freeze any future changed implementation and use a newly independent set for another blind evaluation; do not rerun this set and relabel the result as fresh blind evidence.
- Preserve all first-run artifacts, actual attempts, unknown usage/costs and failures. The Node 24 cloud runtime needs `NODE_USE_ENV_PROXY=1` where its configured network proxy is required.

The six PRs remain drafts and no issues were closed. Native glasses capture, ASR, deployment and on-device measurements are deferred and are outside the current backend acceptance work.

## Related work

Credit MIT/NUS [FactNudger](https://www.media.mit.edu/projects/feeling-the-facts/overview/) for the published context-sensitive wait/ignore/notify idea; see the [CHI paper](https://arxiv.org/html/2603.27289v1). Its reported automated 77% on 125 claims and 40/50 action results are different from the N=34 Wizard-of-Oz study with simulated 87.5% accuracy. None are measurements of this stack. The public `factnudger-viewer` is a demo viewer; no reusable checking-engine license was established. This implementation's contribution to demonstrate is first-person OCR and the iOS/Meta path, with independent admission, verdict and presentation policies.
