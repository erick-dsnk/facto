# Independent transport and campaign-harness review

Scope: active `/workspace/junction-2026-current`, published starting source `e7ca003`, its general exported live harness, and the fresh `ordinary-reference-coverage-01/execute.mts`. No provider calls, historical campaign reruns, sealed/private evaluation bodies or credentials were used. NEW24 analysis and its ledger audit were read as consumed historical evidence: its advancement failed and all old authorizations remain consumed.

## Fresh campaign reuse

`runLiveCampaign` is exported from `apps/console/src/live/run.ts` and accepts custom validated `cases`, explicit `limits`, provider fetch injection, source metadata, receipt timeout, and awaited progress/per-case persistence callbacks. Dynamic cases are supported through exports without invoking the CLI. The CLI also supports a development manifest, but its limits are fixed to `DEVELOPMENT_LIMITS`; use the export for the new bounded plan.

The smallest reusable executor needs one fresh strict plan, exact source/plan/executor hashes, a clean committed tree, one exclusive output directory, and one call to this export with the frozen cases/limits. Its progress callback must atomically persist and fsync both dispatch reservations and completed attempts. It must retain the first run even on errors and refuse an existing run directory. The current fresh executor does these things and refuses dirty/mismatched source, plan, or executor before execution. It never selects a historical campaign. Its source freeze check happens at start: finish all edits before freezing and do not mutate active source during execution.

The fresh executor's minimum design is suitable for review. It still requires root's exact source/plan/budget freeze review and one designated executor; this report does not authorize provider requests. Keep its report even if a later criterion fails. Inspect every selected citation independently before full source-verification credit. The runner's `completed` measures operational completion, not correctness.

## Accounting, privacy and failure boundaries

The existing HTTP seam counts every dispatched Jev, search and contents attempt, including central retries. Runtime-consumed allowances and dispatched provider attempts are intentionally separate. A reservation is durably checkpointed before fetch; a failed pre-dispatch checkpoint withdraws it. Completed unknown Jev usage retains its reservation and blocks every later provider dispatch. Returned real usage replaces the reservation; a token overrun remains charged and stops further calls. Reservations cannot retroactively cap an already paid call. Dollar cost stays partial when any attempt's price is unknown.

Request bytes have independent per-request and aggregate limits and are never treated as token counts. Response bytes are bounded at 262,144 per observer response, but the runner does not currently expose an aggregate response-byte counter; do not claim one in the campaign report. New limits must be valid positive safe integers, including all three call limits. A zero-provider-role budget is not supported by the current constructor; use a separately reviewed guard if a future campaign truly forbids one role.

The observer validates every outbound search objective, exact admitted public proposition, highlight query, contents options and URL shape before dispatch. Rejected public spans halt before retrieval. Prompts, raw private inputs, keys, arbitrary provider messages and unknown error tags are not copied into retained diagnostics. HTTP 401/403 remain authentication failures; empty successful evidence remains a completed abstention; explicit failed Exa envelopes now reject at the integrated parser. Failure responses do not establish a factual verdict.

Manual input terminals are correlated over the authenticated WebSocket; waiting is intermediate and two-claim requests need both result receipts. Local authentication probes must all fail with 401 before any provider dispatch. Per-request deadlines/signals, provider-attempt limits, cancellation and the campaign wall guard remain active. Local HTTP control requests have a separate 2.5-second timeout. Clean up and terminal receipt time can extend elapsed reporting beyond the dispatch window; do not present the campaign wall budget as a guarantee that cleanup returns by that instant.

## Proven and fixed observer cleanup stall

Independent injected-response reproduction found `observe.ts` awaited `reader.cancel()` while handling response overflow or signal cancellation. A pending cancellation prevented request finalization, left the paid attempt pending and blocked `providers.drain()` even though the request's substantive failure was established. Before the change, the standalone reproduction recorded `settledBeforeCleanup:false` and `pendingAttempt:true` until explicit release.

With root's scoped authorization, changed only `apps/console/src/live/observe.ts` and added `observe.cleanup.test.ts`: cleanup is now best effort and nonblocking, preserving the established byte-limit or cancellation error. Attempt finalization still records unknown usage and all actual calls. Pending/rejected cleanup cannot replace errors or block drain; cancellation retains its original reason. No eligibility, evidence, thresholds, retry policy or budgets were changed.

The standalone reproduction now returns `settledBeforeCleanup:true` and `pendingAttempt:false` before releasing its injected cleanup promise. Three new deterministic tests cover pending/rejected overflow cleanup and signal cancellation during a pending read. The canceled-read test uses zero stream high-water mark so abort occurs during the read, avoiding a pre-read race.

## Local Jev commit recovery

Exact commit `48f990124daae56f13f9c0781476c615bd15b6b2` exists in the older `/workspace/junction-2026` object store. Its change is limited to Jev `client.ts` plus 15 new cleanup tests. `git show --format= --binary 48f9901 | git apply --check` succeeded against the active initial checkout without mutating it. It can therefore be imported and cherry-picked by root if absent. This worker did not cherry-pick or otherwise mutate Git. That client fix alone does not repair the observer's separate buffering seam; both were independently reviewed.

## Offline validation

- Observer cleanup, observer accounting review, general run and authenticated-run review: **43/43 tests across four files**, final rerun passed in 18.01 seconds. The initial run exposed a test synchronization race; that test was corrected and all four suites rerun. No live failure is erased by this correction.
- `transport-review/exports-and-accounting.mts` imports the real exports and checks fresh case validation, byte/token separation, dispatched-versus-reserved counts, exact call limits, wall stop and unknown-usage blocking, with a global network-forbidden guard. Passed with zero network calls.
- `transport-review/reproduce-stall.mts` uses an injected synthetic HTTP body only and releases its deliberately pending cleanup after recording settlement. It demonstrates before/after behavior without a real provider request.
- Repository diff whitespace check passed. No protected contracts, iOS, ASR or held-out files were touched by this worker.

These checks demonstrate local control-flow reliability only. They establish no new live factual coverage or citation accuracy.
