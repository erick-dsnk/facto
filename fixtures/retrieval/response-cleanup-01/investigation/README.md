# Production response cleanup investigation

This is an immutable read-only investigation of stack-20 commit `601a804e60cf311798dc27226616d10789ef5d78` on Node `v24.22.1`. The production source was not edited. The probe made 12 requests to a temporary server bound to `127.0.0.1`, plus custom in-memory stream calls. It made zero provider calls. Every injected client used the literal dummy key `local-dummy-key` and the actual production clients, retry code, and AttemptBudget.

## Concrete native-response finding

Exa's `boundedJson` first recognizes Content-Length above its 256 KiB limit, but awaits `response.body.cancel()` before throwing `malformed_exa_response`. If the native body has already errored after a peer reset, that cancellation rejects. The rejection escapes the primary-error branch and becomes `exa_unavailable` at the outer request catch.

The localhost reproduction sends status 200, Content-Length 300000, and one byte, then resets the response. Its fetch wrapper preserves the real AbortSignal and introduces a post-header delivery barrier to make the body-error ordering deterministic. It returns the actual native Response, without replacing its body, cancellation methods, or other methods. The production client returns `exa_unavailable` rather than `malformed_exa_response`. Exactly one request and one allowance charge occur; this particular failure does not cause an internal retry. This is a failure-reason defect, not demonstrated false factual support or unbounded provider spending. The delivery barrier is part of the reproduction; it is not claimed to exist in the default runtime.

Minimal correction: after the status or size branch establishes its primary error, initiate best-effort cancellation without awaiting the cleanup promise; suppress its rejection, then throw the established sanitized error. Preserve the existing retry classification, actual-attempt charging, cancellation precedence and absolute deadline. A detached cleanup promise is not proof that the remote resource has closed.

## Native controls that did not fail

Both clients promptly return their existing authentication error for streaming HTTP 401/403. Both promptly report streamed oversize as malformed; Exa also handles ordinary oversized Content-Length correctly. Native fetch cancellation before headers and during body reads rejects as cancelled and closes the server response. All 11 controls observed closure within 150 ms, and each charged exactly one attempt. These controls do not establish a native authentication cleanup hang or a native late-response resource leak.

## Injected transport boundaries, separately recorded

Seven legal custom ReadableStreams expose cancellation callbacks whose promises remain pending. Jev/Exa's known 401/403 or oversize errors remain pending while awaiting that callback. Advancing the injected clock to the existing acceptedAt+10000 boundary and aborting with timeout causes the outer runtime `abortable` stage to report timeout; the raw client still remains pending until cleanup is released, and eventually also reports timeout. All charge one attempt. This proves behavior at the supported injected-fetch seam, not that native fetch currently returns a hanging cancellation promise.

Two fetch replacements deliberately ignore an aborted signal and return a Response afterward. Jev rejects cancellation without cancelling that body; Exa begins reading the body until it is manually released, then rejects cancellation. No success is returned. These are transport-contract violations in the test replacements, not native-fetch failures, and do not justify an unrelated production transport redesign.

## Artifacts and replay

`probe.mts` is the exact executed probe. `observations.json` contains all 21 observations and `probe.log` records completion. `source-pins.json` identifies the source bytes used. `verify.py` checks the original manifest and structured findings without HTTP, provider calls, or production imports. Do not run the probe over the original output: its observations file is created exclusively and the original evidence must remain immutable. To repeat locally, copy the directory and change the copied script's output path first.

No Jev change, new cleanup timeout, request-contract change, source-policy change, or blanket resource-closure claim is proposed by this record.
