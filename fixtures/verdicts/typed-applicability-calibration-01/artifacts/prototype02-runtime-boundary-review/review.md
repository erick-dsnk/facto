# Prototype02 runtime boundary review

The full-material binding closes the reviewed same-ID material substitution problem. It does not make a capability a live request authorization. This is an **unwired prototype**, and the following are concrete integration requirements, not claims that current production calls use it incorrectly.

Ten new offline probes pass against the unchanged prototype and actual `Session`, `AttemptBudget` and `abortable` implementations. They demonstrate the missing boundaries as well as the existing primitives that a future adapter should use. They are executable outside Git with:

```sh
/workspace/junction-2026/node_modules/.bin/tsx --test --test-reporter=tap /workspace/task-evidence/prototype02-runtime-boundary-review/runtime-boundaries.test.ts
```

## Runtime ownership and cancellation

`verifyCapability` receives no session, request, claim slot, epoch, abort signal or deadline. A valid token still verifies against byte-identical supplied state after request cancellation, a pause/resume epoch change, or replacement of the request record. Tests 1–3 demonstrate this while the actual `Session.current(record)` correctly rejects the old owner. Test 4 confirms `abortable` rejects a late completion after cancellation even when the completion contains a valid capability.

A future adapter must capture the server-owned session and request-record identity, epoch, request ID/revision, admitted claim slot, material generation and installation generation **before** an asynchronous step. Check these after every await and immediately before cache insertion or result delivery. Claim text/revision strings supplied in `Context` are not substitutes for the runtime's record ownership. A completion from the prior revision must neither populate a shared capability cache nor debit a fresh revision budget.

The request timeout and the session expiry are different. `Session.current` checks session expiry and abort state; `AttemptBudget.context` exposes `deadlineAt` but `consume` checks abort/call allowances, not the clock. Test 5 advances a fake clock past the request deadline without running its timer: both `current` and `canConsume` remain true. This is an adapter boundary requirement: check the inherited absolute deadline as well as the abort signal before dispatch/commit, especially around asynchronous artifact reads or synchronous hashing. It is not a demonstrated production timeout overrun.

## Assessment freshness across phases

The input hash verifies that the supplied assessment claims the same current inputs. It does not establish that a model actually ran on them. Test 8 changes graph state, recomputes the input digest, preserves the old assessment ID/revision/output, and successfully obtains a new capability. The old token correctly fails against the changed state. The prototype documents this trusted-runtime responsibility; fresh hashing must not be presented as fresh semantic assessment.

For the proposed typed adapter, the safer phase boundary is:

1. Authenticate the installed receipt and exact aligned material, then freeze the complete server-owned raw material snapshot. This stage issues no authority or verdict.
2. Build and seal the **actual serialized judgment request** plus its fixed question-ID → evidence/version/receipt mapping and the captured request owner. Use only the admitted public claim, retained public passages and narrowly selected trusted receipt metadata; do not serialize arbitrary context/metadata objects into the prompt.
3. Consume the actual response only for that dispatch seal and owner. Validate all required answers, ordinary-risk eligibility, and exact material/install generations. Derive assessment identity/state from those validated answers, not a caller-refreshed digest. Then evaluate applicability/provenance and run every existing content, scope, stance, conflict, source-family and verdict guard.

Risk/conflict answers produced by the same judgment cannot be invented at the pre-material stage. Unknown/pending risk is not ordinary. A later assessment must invalidate earlier capabilities even if its stable evidence IDs are unchanged. Permuted evidence order, reused question IDs, late answers, missing/duplicate mappings, changed receipt generation and changed assessment prompt/model all need adapter-level negative tests before integration.

## Raw graph completeness

The current `retainAlternateEvidence` implementation builds raw-version/copy-family context internally from the original and incoming pools, then returns only the selected records. A future adapter cannot reconstruct a complete raw graph from that return value: omitted versions and bridge nodes have already disappeared. Capture the relevant raw versions and origin links before selection, and bind their generation through assessment consumption. Do not carry prior positive stance/content assessments onto changed material.

Prototype02 rejects more than twelve raw nodes rather than truncating them. That matches the retention function's maximum of six prior plus six incoming records. The future adapter must explicitly define whether additional highlight/page acquisitions or earlier revisions count as separate raw nodes; if they do and the supplied complete graph exceeds the bound, return unavailable. Silently omitting a bridge to fit the bound is not acceptable. Existing prototype graph-integrity tests already cover changed/removed bridges; they were not redundantly rerun here.

## Call allowances, bytes and cached results

Tests 6–7 use the actual shared request budget. After admission and a first judgment, a reserved later claim cannot be deprived of its judgment by an extra applicability call. Corrections retain the same budget/deadline, and cancelled requests cannot consume fresh allowance. Adding a typed item to the existing judgment request avoids an additional call, but its serialized bytes, input usage, unknown-usage reserves and response bounds still count. Retries must remain actual charged attempts under the same allowance.

Test 9 constructs a valid, bounded prototype context larger than 64 KiB. The prototype's 256 KiB local context limit is therefore not a live request allowance. Do not copy its full retained/graph/assessment JSON into the provider state. Request limits must be enforced at actual serialized dispatch; question count and token growth need a separate predeclared study budget. No larger cap is proposed here.

Test 10 retires a loaded installation. Token verification correctly fails, but an independent `Session.cache` entry remains. Current production factual cache identity includes normalized claim/context/language/mode and policy/model version, but no receipt/manifest/applicability generation. If future verdicts can depend on capabilities, retirement/revocation/policy changes must invalidate or revalidate those derived cached results before serving them. Reusing a serialized audit object cannot restore a retired private token. Existing 60-second cache expiry alone is not an authority-revocation strategy.

## Required future adapter tests

The executable probes establish the above primitive boundaries. They do **not** implement the adapter. Before integration, adversarial adapter tests should prove:

- A pending response resolves after cancel, pause, session expiry or revision replacement: no capability cache write, factual cache write, result, or notification.
- A request begins under one material/install generation and resolves under another: the stale response is discarded; a fresh digest cannot reuse it.
- Original and incoming same-ID versions plus a nonretained bridge are present in the request-bound snapshot; missing or excessive raw inventory fails closed.
- Two claims, a correction and one retry share all original allowances and the absolute deadline; missing usage preserves conservative reserves.
- Permuting records while retaining question IDs cannot swap applicability answers between receipts or sources.
- Missing, malformed, contradictory or low-confidence applicability answers return unavailable; current/unresolved time cannot use a historical snapshot route.
- A retired receipt cannot reappear through either factual or capability cache, and a valid capability cannot bypass risk, conflict, source-family, verdict or current presentation checks.

No production files, prototype files, frozen corpus or comparison24 audit artifacts changed. No network, project-provider call, key read or full backend gate was needed. These results support the next offline adapter design; they do not establish live applicability accuracy or release readiness.
