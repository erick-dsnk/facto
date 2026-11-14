# Independent complete-campaign transport preflight

Active source at review start: `4f507f8`, with no production edits by this reviewer. Every case in `preflight.mts` is newly synthetic public text or nonsemantic size padding. The actual classifier/judge are invoked with a fake Jev client that captures the full request and stops before any provider action. A global fetch guard forbids network access. Existing classification/evidence validation runs before capture. No historical campaign or sealed body is executed.

## Serialized request bounds

All sizes include the exact wire wrapper `{model,state,questions}` used by `createJevClient` and UTF-8 JSON serialization, not character counts or token estimates. Six sources have production-shaped 23-character generated evidence IDs, 2,000-code-point excerpts, 300-code-point titles and 4,096-character URLs; the checked proposition is 800 code points. Every excerpt, title, URL and proposition is asserted byte-for-byte equal at capture. No truncation was added.

| Actual six-source / 55-question judgment | Bytes |
| --- | ---: |
| ASCII | 94,576 |
| Four-byte astral Unicode | 138,361 |
| JSON-escaped NUL control padding, six bytes per code point | 167,551 |

For those **normalized URLs already bounded to 4,096 characters**, a 256 KiB request cap has at least 94,593 bytes of headroom. Testing only ASCII would substantially understate the valid payload size.

The actual candidate generator is capped at **four**, not eight, candidates. With the full 800-code-point input and 1,200-code-point context, quote-bearing maximum-four-candidate requests have 31 questions and measure 35,171 ASCII / 44,441 astral / 50,621 JSON-escaped bytes. Both allowed context entries are populated to600codepoints each (1,200total); full input/context preservation is asserted. A deliberately hypothetical eight-candidate envelope with all eight candidate texts duplicated to the full input and 63 questions measures at most 109,453 bytes. It is conservative stress data, not a current production capability or eight actual validated candidates.

## A real upstream bound invalidates a universal 256 KiB claim

The retrieval schema bounds **raw** URL strings to 4,096 UTF-16 code units. `normalizeUrl` can percent-encode them into substantially longer strings. An allowed 4,096-unit raw URL containing BMP Unicode in its path normalizes to 36,632 ASCII characters. Six such normalized URLs, full JSON-escaped excerpt/title/claim padding and the actual 55-question judge produce **362,773 bytes** through real `createJudge` capture. The resulting source records pass the evidence schema and judge guard.

Therefore 256 KiB covers the requested *normalized-4096-URL* envelope but cannot be certified for every payload the current production pipeline admits. Root adopted **512 KiB per request**, retaining the independent aggregate request-byte budget. This is a transport allowance, not a source eligibility relaxation; it adds no source/context truncation. Production or shared-contract source was not changed to impose a new URL limit.

Shared contract evidence IDs are unbounded for arbitrary injected adapters; the size findings apply to the real normalized-source path with generated 23-character IDs, not arbitrary internal caller-created strings. A mathematical bound over every schema-valid custom adapter is impossible without additional bounds. The 512 KiB recommendation covers the production-shaped measured stress envelope with headroom; it is not evidence of provider accuracy.

## Global campaign budgets

The proposed overall budget of 96 Jev / 48 search / 72 contents calls, 128 MiB cumulative request bytes, 16,000,000 measured/reserved input tokens, 128,000 tokens reserved per pending/unknown Jev attempt, and 600,000 ms wall time is accepted by the existing budget constructor. These are **one global campaign's limits**, not per-batch allowances. Each of exactly two batches has48Jev/24search/36contents,64MiB,8,000,000tokens and300,000ms, with the same512KiB per-request cap and128,000token reservation. All twice-per-batch<=global relationships are asserted in preflight. Do not reset them for the second sixteen-case batch.

A token reservation is a declared uncertainty allowance, never a tokenizer upper bound. Real returned usage replaces it; overrun remains charged, and completed unknown usage stops all further dispatch. No harness can guarantee every planned case completes after an operational failure, unknown usage or budget exhaustion. Complete case coverage must be tested offline and all missing first-run outcomes must remain failures, not invitations to retry.

Existing source/request deadlines, privacy guards and cancellation remain required. Runtime limits allow at most three Jev attempts per input, two search attempts per claim and three contents attempts per claim. The campaign's 48-search/72-contents totals therefore suit 24 one-claim factual inputs plus eight controls; they do not independently guarantee 32 two-claim worst-case requests. The full predeclared plan must make its population and maximum admitted claims explicit.

## Validation status

`preflight.mts` and `preflight.json` contain the request captures, field-preservation assertions, maximum-current-four and hypothetical-eight counts, URL expansion reproduction, budget construction and zero-network result. No provider calls were made. Fresh executor's two-batch global accounting, pre-dispatch persistence and complete declared-case coverage require independent review after that file exists; at initial publication it was not yet present.

## Final root executor review

Reviewed the final two-batch executor and ready plan. Exactly two validated batches of16 have32 unique case labels,24 one-claim facts and8 no-claim controls; `preflight.mts` independently asserts these counts and exact equality of the plan/global/per-batch limits with the reviewed budget. Prior source/plan/executor/preflight hashes must match a clean source tree, and the freeze is rechecked before each batch.

The final executor uses disjoint half-budget quotas: no second batch can reset the full global allocation. It persists reservations before dispatch and all completed attempts, cases and batches with fsynced temporary files and atomic replacement. It refuses an existing exclusive `run` directory, retains first-run checkpoints on failure, aggregates both batches' actual calls, bytes, known usage, remaining unknown reservations and partial costs, and keeps all32 inputs in the final metric denominator even after early termination. Ordinary wrong answers do not stop the run. Provider authentication faults stop only after their original case is preserved. Incomplete/local-stop/unknown-usage/reservation results prevent batch2.

The initial review identified a missing absolute global-wall check across setup, persistence and batch transitions. Root corrected it: each batch wall is reduced to the remaining global time, and every dispatch-reserved progress callback checks the original shared600s clock both before and after durable persistence. An expired shared deadline throws before observer dispatch, withdrawing the unused reservation. Post-attempt checkpoints remain writable after the deadline so completed attempts are not lost. Cleanup may exceed the dispatch budget; no late provider dispatch is authorized.

Independent execution of the other reviewer's16 executor freeze/drift tests passed16/16 with network forbidden. These cover clean validation and rejected commit/source/plan/executor/preflight drift, dirty source, wrong batch count/size, duplicate labels, wrong fact count, per-request disagreement and overallocated bytes/tokens/calls/wall budgets. These are offline checks, not a substitute for measuring every live terminal or reviewing selected citations. Full two-batch synthetic execution tests were requested separately from the implementation owner before dispatch.

**Review outcome:** no remaining transport/executor blocker found in the reviewed code and exact plan. The local size preflight passes at512KiB, including the measured362,773-byte valid production-shaped URL-expansion case. Root still owns final immutable freeze, complete offline execution checks, bounded authorization and the single executor. This review itself makes no provider request and grants no factual-accuracy credit.
