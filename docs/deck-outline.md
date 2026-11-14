# Demo deck working outline

This is draft content, not a final results claim. Live providers, source inspection and real-device measurements must replace the pending items before submission. Keep the deck to eight slides.

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

Current backend branch provides versioned text/event interfaces, mockable provider seams and deterministic admission/verdict/presentation evaluation. A separate iOS workstream owns camera, audio, display, permissions and the ASR adapter.

Before submission, fill in a small table of actual OCR, audio, spoken output and display routes with `live`, `recorded` or `preview` status. Device integration is not established by the backend fixture tests.

## 5. How a checked result is produced

Exact captured span → privacy/admission decision → bounded Exa evidence → typed Jev reading → deterministic verdict → independent presentation decision. Operational failures remain separate from insufficient evidence. Retained source excerpts are inspectable; confidence values are not displayed as truth percentages.

Credit MIT/NUS FactNudger's published wait/ignore/notify interaction. The public viewer is not a licensed checker being reused here. Explain the first-person OCR/iOS-Meta contribution without claiming the invention of wearable fact checking.

## 6. Trust, consent and ways to interact

Personal experiences are excluded from public search. Some speech may already reach cloud ASR/Jev, so do not claim all personal data stays on-device. Users explicitly start/stop; app output respects mute and available routes. Include text and speech alternatives, non-color labels and accessible controls after they are verified on-device.

State the current scope: English, bounded public propositions, a foreground prototype, and clear abstention. Actual accessibility and background behavior remain things to test.

## 7. What we measured

Initial deterministic run: 34 of 36 development scenarios passed, with 2 explicitly not executed by this harness; 12 held-outs remain reserved. Stage coverage is 33 admission, 17 verdict, 17 presentation and 1 malformed-provider check. The shared action suite passes 21/21. These are scripted control-flow tests, not model accuracy or hardware reliability.

Replace/add live sample sizes, inspected citations, cold/cached latency, abstentions, operational errors and false alerts per listening minute after measurement. Current live provider and real-device sample sizes are both zero. Do not use PRD/vendor/FactNudger scores as this prototype's results.

## 8. Opt-in pilot and next milestone

Propose a one-week media-literacy workshop with 8–12 consenting adults, 10–15 minute sessions and public material. Compare source-finding with glasses and a phone. Measure time to source, interruptions, uncertainty understanding, capture success and accessibility barriers.

Continue only if inspected queries exclude private details, users understand silence/uncertainty and capture works with acceptable interruption levels. Ask for a venue and consenting pilot participants; no existing partnership is implied. Include the working prototype/repository link and a clearly labelled backup recording only after verifying them.
