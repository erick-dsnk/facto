# Applicability study budget and observer contract

This standalone module has no production imports, credentials, default network
transport or execution authority. The study runner must freeze the complete
84 semantic-call inventory in four contiguous blocks of 22, 22, 20 and 20 calls,
counterbalanced arms and all independently reviewed labels. Two deterministic
binding controls remain separate offline controls. This reusable guard permits
smaller inventories solely to support offline tests; it is not the final study
plan validator or an authorization checker.

`createStudyGuard(plan, {fetch, now?, onCheckpoint?})` returns `run`, `snapshot`
and `close`. Each `run(callId, work)` grants a one-shot lease with `fetch`,
`signal`, `attachAbortController` and `assertOpen`. The runner must attach the
actual captured request controller before invoking the adapter. It must use
the lease fetch as the adapter transport, and record a semantic result only
when `run` returns `status: completed`. Failed work returns a failed terminal;
invalid order, exhausted pre-dispatch reserves or a previously stopped guard
reject without another attempt. The runner must preserve that rejection and
the guard snapshot rather than continuing in another block.

The wrapper observes the actual serialized POST body, compares its SHA256 and
UTF-8 bytes to the frozen call, disallows all other endpoints and methods, and
sets redirect:error. Actual-start counters increment at the actual fetch
invocation, separately from reserved calls. The observer never receives headers,
API keys, raw request bodies or raw response bodies. It retains request hashes,
byte counts, status codes and accounting checkpoints only.

Actual response bytes are relayed unchanged and bounded per call, block and
campaign. A received oversized chunk is counted before rejection. At EOF only
the actual response's nonnegative safe-integer usage.input_tokens is counted;
zero is known usage. No caller-set usage method exists. The frozen provider
client independently consumes the same bytes, so the runner can cross-check its
budget delta; a parse/answer failure after valid usage still retains the observed
usage. A missing/invalid usage field fails the campaign closed. An existing
local/provider/deadline failure remains primary; unknown usage is a separate flag.

The campaign owns a 120-second-or-shorter deadline and races the whole work
promise, including transports/readers that ignore abort. Failure aborts the
actual forwarded signal and attached runtime controller. The wrapper detaches
body/reader cancellation rather than awaiting potentially hanging cleanup.
Late headers are cancelled; late chunks, EOF usage and results cannot mutate a
finalized report. Runtime-owner cancellation also settles the guard immediately.

Each block has its own call, measured-input-token, pending-reserve, total-request
and total-response limits, in addition to campaign limits. No block borrows
another block's unused allowance. Final numerical caps are owned by the frozen
runner plan after actual payload capture; this module does not set or authorize
them. The 24k pending reserve is a pre-dispatch accounting constraint, not a
claim that unknown future provider billing can be measured in advance. If a
returned actual usage exceeds a cap, the full observed overrun is recorded and
the campaign stops.

Checkpoints expose declared/completed/missing call IDs and class denominators
independently of completion, plus pending reserve and the in-flight call ID.
`completeAccuracyClaimPermitted` is only a completeness condition: it does not
authorize a factual-accuracy, independence, useful-coverage or promotion claim.
The runner owns separate arm/stratum scoring, all joint-question spillovers,
policy selections and semantic labels; none is inferred by this guard.

Twenty-eight offline tests cover a complete 84-call mock inventory, body mismatch,
provider normalization, unknown/zero/invalid usage, measured overruns, separate
block caps, retries, missing denominators, hung fetch/read/cancel, late headers
and usage, external owner cancellation, immediate timer firing and checkpoint
failure. The tests use injected local transports only. Pool authorship and guard
authorship overlap are disclosed; independent plan/material/guard review remains
with other agents before any authorization to execute.
