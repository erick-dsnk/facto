# Fact-checking pipeline evaluation

Status on 14 November 2026: deterministic backend evaluation and a bounded live Jev/Exa adapter smoke test have run. The live sample covers three synthetic typed inputs, two public-claim retrievals and two deliberate authentication failures. Agent source inspection verified the one definitive result’s selected citation; human demo review, authenticated live transport, device capture and the joint failure rehearsal remain pending. Nothing in this report establishes general fact-checking accuracy or wearable reliability.

## Reproducible development result

Run `npm run evaluate` from the repository root. The machine-readable development report is `fixtures/evaluation/development-results.json`; dataset loading and held-out isolation are explained in `fixtures/evaluation/README.md`. The runner reads the metadata-only manifest, selects the development split, and only then opens the development case bodies. The 12 held-out bodies are in a separate file and are not read during the default run.

`npm run check` passed lint, typecheck and 171 tests across 12 files on Node 22.22.1 (baseline: 148 tests). The runtime evaluation added two composed transport scenarios with deterministic injected providers. They do not add live-provider or hardware evidence.

| Measurement | Recorded outcome | What was tested |
|---|---:|---|
| Development scenarios | 36 passed / 36 selected; 0 failed, 0 not run | 34 scripted policy fixtures plus 2 injected-runtime transport cases |
| Admission stage | 33 executed | Public/personal gates, waiting, exact mixed spans, Unicode and capture confidence |
| Evidence/verdict stage | 17 executed | Synthetic evidence, conflict abstention and copied-source suppression |
| Presentation stage | 17 executed | Manual completion and automatic restraint with injected session state |
| Malformed-provider fixture | 1 executed | Invalid Jev answers fail as an operational error |
| Shared presentation fixtures | 21 passed / 21 | Same action/reason fixtures as B7's policy tests |
| Correction sequencing (E33) | Pass; 264 ms | Authenticated HTTP submissions, WebSocket events; revision 1 retrieval was aborted and emitted no stale result; corrected revision 2 requested confirmation |
| Provider deadline (E43) | Pass; 10,033 ms | Authenticated HTTP submission and WebSocket operational error; the runtime aborted a hung injected admission provider at its 10 s deadline, with no factual result |
| Reserved held-outs | 12 / 48 cases | Body file was not read by the default run |
| Successful live admission / judgment / Exa calls | 3 / 2 / 2 | Direct adapters; separate from this fixture harness |
| Selected live citations inspected by agent / human | 1 / 0 | Historical Sydney Opera House claim; see smoke record |
| Real glasses capture / output runs | 0 / 0 | Not measured |

E33 and E43 exercise the real local Fastify server, authenticated HTTP routes, and authenticated WebSocket event delivery, with synthetic providers and a fixed application clock. E43's measured duration includes the runtime's configured 10-second wall-clock deadline. These results establish transport and orchestration behavior for deterministic injected providers; they do not measure Jev/Exa semantics, network reliability, or user-visible app behavior. The held-out hardware disconnect and TTS feedback cases still need native device execution.

The 17 executed presentation decisions have this confusion matrix. Rows are expected actions; columns are actual actions. These are policy fixtures with known input state, not notification quality in a listening session.

| Expected / actual | silent | notify | respond |
|---|---:|---:|---:|
| silent | 9 | 0 | 0 |
| notify | 0 | 1 | 0 |
| respond | 0 | 0 | 7 |

The 48 scenarios use the plan's distribution: 12 personal/opinion/nonclaims, 12 public facts, 8 mixed/ambiguous, 8 capture/corrections and 8 service/lifecycle cases. The held-out set is marked in the metadata-only manifest before policy tuning. Scripted model decisions cannot measure Jev's semantic accuracy, so admission precision/recall are deliberately absent. Synthetic source stances cannot establish factual correctness or source relevance. The code preserves null/unmeasured metrics instead of reporting zeros as successes.

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

## Evidence required before live claims

Use separate fixture, live typed-text, hardware capture and integrated-rehearsal records. For every run retain only consenting, sanitized inputs; record model/policy version, public claim, case ID, route, cold/cached status, attempted searches/model calls, cost if known, error class, elapsed time, result and presentation action. Do not store audio, images, private rejected context or credentials in this report.

Before putting a definitive result in the demo, a person must open its cited page, verify that the retained passage supports the exact checked proposition, and record the source URL, inspection date and any time/place/population limits. A URL or synthetic passage in a fixture is not completed source inspection.

| Metric | Numerator / denominator or measurement required | Current state |
|---|---|---|
| Admission precision and recall | Correct public admissions / admissions; recovered eligible spans / eligible spans | Pending live, independently labeled spans |
| Private-query leakage | Queries containing rejected private details / inspected outbound queries | Two inspected live smoke queries excluded rejected private context; broader integrated evaluation pending |
| Wrong definitive labels and abstentions | Wrong definitive / definitive; abstentions / factual cases | Pending live evidence review |
| Source relevance | Direct, scope-matched passages / inspected passages | One selected citation inspected by agent; human review pending |
| Median/P95 latency | Accepted text → result and separate client capture → output, with sample size | Three direct-adapter times above; end-to-end live and hardware runs pending |
| Cost | Actual model tokens, search/content attempts and ASR duration | Partial smoke usage above; total live cost and ASR duration unmeasured |
| False alerts | Incorrect unsolicited alerts / listening minutes | No listening time measured |
| Duplicate/stale speech | Incidents / eligible deliveries and cancelled requests | Pending integrated audio output |
| Deliberate source opens | User-requested source openings / offered results | Pending UI instrumentation; a glance is not a source check |

## Remaining acceptance work

- Keep provider keys in the ignored server environment; they were available for the adapter smoke test. Configure demo access/mode before authenticated live text runs. Fixture mode needs no provider keys. Streaming ASR configuration belongs to the capture owner.
- Freeze thresholds before running held-out labels; disclose any subsequent tuning and replace the held-out set if used for development.
- Expand the bounded live privacy sample and run ambiguous scope, source conflict, empty retrieval, malformed answer and additional service-failure cases. A human must inspect every definitive demo citation.
- Add A6's baseline hardware route, OCR/audio accuracy, capture-to-output timings and delivery results before J2. Mark previews and recordings explicitly.
- Rehearse stop/disconnect, permissions, corrections, duplicate events, TTS feedback and output preferences in J2. Record fixes with request IDs and rerun affected tests before finalizing results.
- Keep feature and performance claims in the deck aligned with these measured rows. A missing alert means no assertion of truth or verification.

## Related work

Credit MIT/NUS [FactNudger](https://www.media.mit.edu/projects/feeling-the-facts/overview/) for the published context-sensitive wait/ignore/notify idea; see the [CHI paper](https://arxiv.org/html/2603.27289v1). Its reported automated 77% on 125 claims and 40/50 action results are different from the N=34 Wizard-of-Oz study with simulated 87.5% accuracy. None are measurements of this stack. The public `factnudger-viewer` is a demo viewer; no reusable checking-engine license was established. This implementation's contribution to demonstrate is first-person OCR and the iOS/Meta path, with independent admission, verdict and presentation policies.
