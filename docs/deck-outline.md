# Demo deck working outline

This is draft content, not a final results claim. Authenticated HTTP/WebSocket campaigns supplement the fixture results below. Useful factual coverage remains below the proposed readiness bar. Agent citation audits are complete to their stated access/scope limits, while real-device measurements remain deferred; no extra human sign-off gate is imposed. Keep the deck to eight slides.

## 1. Public information while hands and attention are occupied

Adults encounter claims on posters, slides and in conversations. Looking up a source usually requires switching to a phone. Start with consenting adults and stable, low-stakes public material; do not frame the product as a lie detector.

Visual: one real public poster and a wearer reaching for a phone. No accuracy statistic is needed to explain the problem.

## 2. Look or listen, request a check, inspect the evidence

Explicitly start a session. Select a public claim through glasses OCR or a confirmed audio route. Receive an outcome with an inspectable passage, or an understandable clarification/error. Automatic checks can remain silent. Say: “No alert does not mean a claim was verified.”

Show the actual start/stop and source-opening controls after integration; use labelled fixtures until then.

## 3. Why the wearer's view matters

Use the same “check this” action on two different printed statements. Changing the poster changes the selected text. This demonstrates first-person selection rather than an answer typed by a developer. Identify actual hardware; do not imply camera framing is eye tracking.

Pending evidence: A6 recording of successful OCR capture and the exact route/device/SDK used.

## 4. What is working

The backend provides authenticated HTTP/WebSocket transport, versioned text/event interfaces, bounded Jev/Exa adapters, deterministic admission/verdict/presentation policy, and a durable live evaluation harness. A separate iOS workstream owns camera, audio, display, permissions and the ASR adapter.

Before submission, fill in a small table of actual OCR, audio, spoken output and display routes with `live`, `recorded` or `preview` status. Device integration is not established by the backend fixture tests.

## 5. How a checked result is produced

Exact captured span → privacy/admission decision → bounded Exa evidence → typed Jev reading → deterministic verdict → independent presentation decision. Operational failures remain separate from insufficient evidence. Enabled selected topics can prioritize a qualifying contradiction through literal matching on the admitted public span; no semantic topic inference is claimed. Retained source excerpts are inspectable; confidence values are not displayed as truth percentages.

Credit MIT/NUS FactNudger's published wait/ignore/notify interaction. The public viewer is not a licensed checker being reused here. Explain the first-person OCR/iOS-Meta contribution without claiming the invention of wearable fact checking.

## 6. Trust, consent and ways to interact

Personal experiences are excluded from public search. Some speech may already reach cloud ASR/Jev, so do not claim all personal data stays on-device. Users explicitly start/stop; app output respects mute and available routes. Include text and speech alternatives, non-color labels and accessible controls after they are verified on-device.

State the current scope: English, bounded public propositions, a foreground prototype, and clear abstention. Actual accessibility and background behavior remain things to test.

## 7. What we measured

Current integration passes lint/typecheck and **547 tests across 26 files**. The latest completed [candidate09](broader-development-candidate09.md) freeze, `9a5e80d`, passed 525 tests; later evidence-retention and absolute-deadline fixes are outside that freeze and have no live credit here.

On the repeated OPEN broader corpus, candidate09 produced **4/12 correct definitive unique facts**, **3/12 with every selected reference verified**, eight abstentions and no operational error. It admitted 13/13 eligible occurrences and delivered 16/16 terminals. The mixed BD07 repeat abstained and adds zero unique facts. An initial guard halt and reviewed artifact-only continuation preserved batch 1 and continued only unstarted batches 2–4.

The separate [baseline](broader-development-2026-11-14.md) remains 3/12 raw and 2/12 fully verified. [Candidate08](broader-development-candidate08.md), frozen at `aefb9e7`, remains 6/12 raw and 4/12 fully verified, five abstentions and one operational error. These are OPEN development observations, not blind accuracy or an isolated causal improvement. Agent source review retains original proof timestamps and the inaccessible selected Olympics reference; transport completion does not establish source coverage.

[Actual-provider automatic controls](automatic-development-2026-11-14.md) produced **five passes and one inconclusive** in the original six-scenario cohort. A separate AD07 followup exercised supported + silent; it does not replace AD03 or change the original score, and adds zero new facts. This is typed backend action evidence, not hardware notification delivery.

### Earlier measurement context (retain distinct denominators)

At the earlier 14 November 2026 executable freeze `3cfdfb1`, lint/typecheck and 429 tests passed. The development evaluator passed 36/36 scenarios: 34 scripted cases and two authenticated HTTP/WebSocket scenarios with injected providers. Shared presentation fixtures passed 21/21. The original 12 held-outs remain unchanged and unrun; their blindness cannot be certified because earlier text exposure may have occurred. These checks establish control-flow behavior, not live model accuracy or hardware reliability.

Public live development run 07 completed nine authenticated requests, including cache, personal/opinion and wait-expiry controls. Among five unique factual propositions, two received correct definitive results and three abstained; none received a wrong definitive result. All 38 provider calls returned HTTP 200. One selected citation was inaccessible to the independent agent review, so the definitive count is not a count of fully verified source sets. Separate deliberately invalid Jev and Exa keys each produced a non-retryable HTTP 401 operational error. See [evaluation](evaluation.md) and the [live campaign](live-campaign-2026-11-14.md).

Three independent sealed campaigns ran once each on different frozen implementations and different inputs. Their correct definitive counts were 2/8, 4/8 and 2/8; do not pool them or treat the differences as causal improvements. The third sealed campaign completed all ten input receipts, with five factual abstentions and one factual timeout in addition to its two correct definitive results. It made 56 actual provider attempts; five of six selected references were verified by an independent AI agent, while one displayed an application error. There were zero observed private-query violations or wrong definitive outputs in that campaign. Cold input median/P95 were 3,817/10,038 ms, including controls and the timeout. The known $0.116 cost subtotal excludes 24 attempts with unknown cost. See the [third independent report](blind-evaluation-2026-11-14-03.md).

Real-device sample size remains zero. Agent citation inspection must retain its disclosed method and inaccessible-source limits. Complete provider costs and false alerts per listening minute remain unmeasured; no additional human sign-off gate is imposed. Broader development and release evaluation are ongoing; current factual coverage does not establish backend readiness. Do not use PRD/vendor/FactNudger scores as this prototype’s results.

## 8. Opt-in pilot and next milestone

Propose a one-week media-literacy workshop with 8–12 consenting adults, 10–15 minute sessions and public material. Compare source-finding with glasses and a phone. Measure time to source, interruptions, uncertainty understanding, capture success and accessibility barriers.

Continue only if inspected queries exclude private details, users understand silence/uncertainty and capture works with acceptable interruption levels. Ask for a venue and consenting pilot participants; no existing partnership is implied. Include the working prototype/repository link and a clearly labelled backup recording only after verifying them.
