# Exa cleanup correction validation

The production change is limited to `services/api/src/providers/exa/client.ts` on the lower #16 branch, based on `9359da3ef0edda849f3e7eea255e8ed535fb4f61`. A private helper initiates `cancel()` and suppresses cleanup rejection without awaiting it. Three existing error paths use it: oversized Content-Length, body-read failure/overflow, and non-OK HTTP status. Their primary error codes and retry flags remain unchanged. Reader locks are still released in `finally`.

No Jev, retrieval policy, target-status parser, request shape, allowance, deadline, or trust rule changes are included. Cancellation is initiated best-effort; a settled client error does not certify that an arbitrary custom transport's remote resource has closed. Native HTTP controls from the preceding immutable investigation did observe prompt closure.

## Lower-branch validation

`client-cleanup.test.snapshot.ts` is the new source test file. Its native localhost test returns the real Fetch Response after a deterministic peer-reset barrier; the oversized-header primary error must survive the body cancellation rejection. Injected pending/rejected cancellation cases are explicitly labeled as custom stream behavior, and cover HTTP 401/403/400/429/503, declared/streamed overflow, and explicit cancellation precedence. A direct client without runtime context still makes exactly one HTTP call.

Before the fix: 13 failed and 3 passed, recorded in `before.log`. After the fix: all 16 new tests plus the 26 existing retrieval tests passed, recorded in `focused.log`. Separate lint and typecheck logs are included. The raw failure log and source snapshots are preserved.

The complete lower-branch `npm run check` passes lint, typecheck, and 242 tests across 13 files (`full-check.log`). This number belongs to #16; it is not the larger integrated-root suite count.

## Current integrated-client projection

The lower #16 branch predates the integrated actual-HTTP retry/context implementation. To avoid overwriting that newer source, `combined-client.ts` is an outside-Git projection of the exact current combined client at stack-20 commit `601a804e60cf311798dc27226616d10789ef5d78`. It adds the identical helper and replaces the same three cleanup calls. Only import locations are adjusted so the projection runs against the actual current AttemptBudget, provider retry helper, and contracts. `verify-projection.py` reconstructs both patches and confirms this exact transformation from the saved original sources.

`combined-runtime.test.mts` passes 20 tests against that projection: authentication and oversize each consume one actual attempt; 429/503 consume at most two; a remaining shared allowance suppresses the retry without another HTTP call; retry success consumes exactly two; cancellation and the original absolute deadline still take precedence; an already-expired call dispatches and charges zero; and the native oversized-header/reset case retains malformed classification with one actual request and charge. This is projection validation, not a claim that the final integrated repository has already passed its gate.

The first projection execution (`combined-runtime.log`) failed before running any test because the outside-Git folder lacked ES module mode. Adding local `package.json` with `type: module` fixed that harness setup; the unchanged test and projection sources then passed all 20 cases in `combined-runtime-after-module-mode.log`. No provider calls occurred in either execution.

The original read-only investigation remains separate and immutable at `../production-response-cleanup-review/`, manifest SHA256 `2be36c9d2c26aeec95910c5bddf6423831ef48fab5e8901a4d1f1388bb87d2a0`. Its findings distinguish a native-response normalization defect from injected-only hanging cleanup and signal-ignoring transport behaviors.
