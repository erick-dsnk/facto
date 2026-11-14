# Fact-checking pipeline evaluation

Current continuation, 14 November 2026: the backend and durable live harness are frozen at `b66fa5dcbc1e4a58665bc110cb0ab1b6dccf950f` (source SHA-256 `71f6fb9504e9045763f081b885fdf63fbcccfc8b138f845953b1575b5b2072e3`). Lint, typecheck and **341 tests** passed; the refreshed development artifact records **36/36 scenarios** and **21/21 presentation fixtures**. Later commits propagate the same fact-checking implementation through the issue stack. A subsequent harness-only reporting fix preserves validated presentation fields on future non-result terminals; its gate passed **350 tests**. It changes no runtime policy and was not retroactively applied to the frozen reports or evaluated live.

The actual authenticated HTTP/WebSocket development campaign now has durable attempt checkpoints, separate byte/token/call budgets, named Jev answers, exact public queries, retained evidence and correlated terminal receipts. Its final replay completed 8/8 requests with **2/5 correct definitive outcomes on unique eligible public claims** and three abstentions. The initial network failure and two zero-coverage campaigns remain recorded. Real invalid-key probes returned one sanitized nonretryable HTTP 401 per provider. Independent citation inspection opened 7/8 selected development URLs; one remains inaccessible. These are agent inspections, not human demo sign-off.

A newly authored and independently reviewed 10-case sealed set was run **once** against the frozen source. All 10 requests reached terminal events, but only **2/8 eligible factual claims received correct definitive labels**; five abstained and one received no verdict. Conditional definitive precision was 2/2; this small purposive sample does not estimate population accuracy. Admission matched 8/10 expectations, and no forbidden-private query was observed in 12 searches. This is a substantial coverage/admission failure, not a completion or readiness claim. No implementation changes were made in response to the sealed cases, and implementers did not inspect their bodies.

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

The agent opened the selected [National Museum of Australia page](https://www.nma.gov.au/defining-moments/resources/sydney-opera-house) and confirmed its historical opening-year passage. Human demo citation review is still required. A second operator page was inspectable; a Museums of History NSW page returned 403, so its Exa highlight remains independently unverified. The result did not use an official-site shortcut.

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

Keep fixture, provider-probe and live end-to-end records separate. The current campaign and independent report above supersede the pending measurement status in the historical table below. For each backend run retain only non-sensitive aggregate telemetry: model/policy version, case label, route, cold/cached status, search/model-call counts, usage, cost if known, sanitized error class and elapsed time. Do not store original input text, rejected private context, prompts, audio, images or credentials in this report.

Before putting a definitive result in the demo, a person must open its cited page, verify that the retained passage supports the exact checked proposition, and record the source URL, inspection date and any time/place/population limits. A URL or synthetic passage in a fixture is not completed source inspection.

| Metric | Numerator / denominator or measurement required | Current state |
|---|---|---|
| Admission precision and recall | Correct public admissions / admissions; recovered eligible spans / eligible spans | Pending live, independently labeled spans |
| Private-query leakage | Queries containing rejected private details / inspected outbound queries | Two inspected live smoke queries excluded rejected private context; broader integrated evaluation pending |
| Wrong definitive labels and abstentions | Wrong definitive / definitive; abstentions / factual cases | Pending live evidence review |
| Source relevance | Direct, scope-matched passages / inspected passages | One selected citation inspected by agent; human review pending |
| Median/P95 latency | Accepted text → result, with sample size | Three direct-adapter times above; authenticated live end-to-end measurement pending |
| Cost | Actual model tokens, search/content attempts and ASR duration | Partial smoke usage above; total live cost and ASR duration unmeasured |
| False alerts | Incorrect unsolicited alerts / listening minutes | No listening time measured |
| Duplicate/stale speech | Incidents / eligible deliveries and cancelled requests | Future native audio integration measurement |
| Deliberate source opens | User-requested source openings / offered results | Future app UI measurement; a glance is not a source check |

## Remaining backend acceptance work

- Improve useful coverage and admission quality on newly authored development cases without inspecting or tuning against the sealed evaluation bodies. The first blind result stays 2/8 correct definitive and 8/10 admission; abstentions and clarification mistakes are failures against those expectations.
- Investigate how to retrieve inspectable, attributable underlying records for ordinary reference facts while preserving exact public spans, independent corroboration, risk-sensitive gates and the prohibition on official-site shortcuts. Do not lower thresholds to force the existing examples through.
- Have a human inspect each definitive demo citation. The agent inspection record includes an inaccessible URL and distinguishes independently published accounts from proven independent primary records.
- Freeze any future changed implementation and use a newly independent set for another blind evaluation; do not rerun this set and relabel the result as fresh blind evidence.
- Preserve all first-run artifacts, actual attempts, unknown usage/costs and failures. The Node 24 cloud runtime needs `NODE_USE_ENV_PROXY=1` where its configured network proxy is required.

The six PRs remain drafts and no issues were closed. Native glasses capture, ASR, deployment and on-device measurements are deferred and are outside the current backend acceptance work.

## Related work

Credit MIT/NUS [FactNudger](https://www.media.mit.edu/projects/feeling-the-facts/overview/) for the published context-sensitive wait/ignore/notify idea; see the [CHI paper](https://arxiv.org/html/2603.27289v1). Its reported automated 77% on 125 claims and 40/50 action results are different from the N=34 Wizard-of-Oz study with simulated 87.5% accuracy. None are measurements of this stack. The public `factnudger-viewer` is a demo viewer; no reusable checking-engine license was established. This implementation's contribution to demonstrate is first-person OCR and the iOS/Meta path, with independent admission, verdict and presentation policies.
