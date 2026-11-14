# Fact-checking pipeline evaluation

Status on 14 November 2026: deterministic backend evaluation is started. Live Jev/Exa evaluation, source inspection, device capture and the joint failure rehearsal remain pending. Nothing in this report establishes general fact-checking accuracy or wearable reliability.

## Reproducible development result

Run `npm run evaluate` from the repository root. The machine-readable record is `fixtures/evaluation/development-results.json`; the dataset and test scope are explained in `fixtures/evaluation/README.md`.

| Measurement | Recorded outcome | What was tested |
|---|---:|---|
| Development scenarios | 34 passed / 36 selected; 2 not run | Scripted Jev responses, real admission and deterministic policies |
| Admission stage | 33 executed | Public/personal gates, waiting, exact mixed spans, Unicode and capture confidence |
| Evidence/verdict stage | 17 executed | Synthetic evidence, conflict abstention and copied-source suppression |
| Presentation stage | 17 executed | Manual completion and automatic restraint with injected session state |
| Malformed-provider fixture | 1 executed | Invalid Jev answers fail as an operational error |
| Shared presentation fixtures | 21 passed / 21 | Same action/reason fixtures as B7's policy tests |
| Reserved held-outs | 12 / 48 cases | Excluded from initial execution and tuning |
| Live provider calls / inspected live citations | 0 / 0 | Not measured |
| Real glasses capture / output runs | 0 / 0 | Not measured |

The two unexecuted development scenarios are revision correction orchestration (E33) and a provider deadline (E43). Dedicated runtime tests can establish those behaviors, but this harness does not pretend that a pure presentation decision exercises a queue, cancellation or a real timeout. The held-out hardware disconnect and TTS feedback cases also need native device execution.

The 17 executed presentation decisions have this confusion matrix. Rows are expected actions; columns are actual actions. These are policy fixtures with known input state, not notification quality in a listening session.

| Expected / actual | silent | notify | respond |
|---|---:|---:|---:|
| silent | 9 | 0 | 0 |
| notify | 0 | 1 | 0 |
| respond | 0 | 0 | 7 |

The 48 scenarios use the plan's distribution: 12 personal/opinion/nonclaims, 12 public facts, 8 mixed/ambiguous, 8 capture/corrections and 8 service/lifecycle cases. The held-out set is marked in the manifest before policy tuning. Scripted model decisions cannot measure Jev's semantic accuracy, so admission precision/recall are deliberately absent. Synthetic source stances cannot establish factual correctness or source relevance. The code preserves null/unmeasured metrics instead of reporting zeros as successes.

## Evidence required before live claims

Use separate fixture, live typed-text, hardware capture and integrated-rehearsal records. For every run retain only consenting, sanitized inputs; record model/policy version, public claim, case ID, route, cold/cached status, attempted searches/model calls, cost if known, error class, elapsed time, result and presentation action. Do not store audio, images, private rejected context or credentials in this report.

Before putting a definitive result in the demo, a person must open its cited page, verify that the retained passage supports the exact checked proposition, and record the source URL, inspection date and any time/place/population limits. A URL or synthetic passage in a fixture is not completed source inspection.

| Metric | Numerator / denominator or measurement required | Current state |
|---|---|---|
| Admission precision and recall | Correct public admissions / admissions; recovered eligible spans / eligible spans | Pending live, independently labeled spans |
| Private-query leakage | Queries containing rejected private details / inspected outbound queries | Pending integrated query inspection |
| Wrong definitive labels and abstentions | Wrong definitive / definitive; abstentions / factual cases | Pending live evidence review |
| Source relevance | Direct, scope-matched passages / inspected passages | Pending human inspection |
| Median/P95 latency | Accepted text → result and separate client capture → output, with sample size | Pending live and hardware runs |
| Cost | Actual model tokens, search/content attempts and ASR duration | Pending provider usage |
| False alerts | Incorrect unsolicited alerts / listening minutes | No listening time measured |
| Duplicate/stale speech | Incidents / eligible deliveries and cancelled requests | Pending integrated audio output |
| Deliberate source opens | User-requested source openings / offered results | Pending UI instrumentation; a glance is not a source check |

## Remaining acceptance work

- Supply `JEV_API_KEY` and `EXA_API_KEY` to server environment for separate live text runs; fixture mode needs neither. Streaming ASR configuration belongs to the capture owner.
- Freeze thresholds before running held-out labels; disclose any subsequent tuning and replace the held-out set if used for development.
- Run live privacy, ambiguous scope, source conflict, empty retrieval, malformed answer and service-failure cases. Inspect every definitive demo citation.
- Add A6's baseline hardware route, OCR/audio accuracy, capture-to-output timings and delivery results before J2. Mark previews and recordings explicitly.
- Rehearse stop/disconnect, permissions, corrections, duplicate events, TTS feedback and output preferences in J2. Record fixes with request IDs and rerun affected tests before finalizing results.
- Keep feature and performance claims in the deck aligned with these measured rows. A missing alert means no assertion of truth or verification.

## Related work

Credit MIT/NUS [FactNudger](https://www.media.mit.edu/projects/feeling-the-facts/overview/) for the published context-sensitive wait/ignore/notify idea; see the [CHI paper](https://arxiv.org/html/2603.27289v1). Its reported automated 77% on 125 claims and 40/50 action results are different from the N=34 Wizard-of-Oz study with simulated 87.5% accuracy. None are measurements of this stack. The public `factnudger-viewer` is a demo viewer; no reusable checking-engine license was established. This implementation's contribution to demonstrate is first-person OCR and the iOS/Meta path, with independent admission, verdict and presentation policies.
