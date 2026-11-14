# App / pipeline boundary, version 1

The app owns glasses connection, permissions, capture, ASR assembly, playback and display. The pipeline owns authenticated sessions, checking text, evidence and notification permission. The app can build against the golden JSON files below while the provider integrations are tested separately. No Swift or Meta SDK dependency enters the pipeline.

## Contract artifacts

- `src/index.ts`: shared TypeScript inputs and domain interfaces, including runtime input validation.
- `src/wire.ts`: runtime result/event validation, including exact spans and retained citation references.
- `schemas/`: generated JSON Schema artifacts for native tooling. Regenerate with `npx tsx packages/contracts/export-schemas.ts` from the repo root. JSON Schema validates shapes; semantic constraints described in each schema are also enforced by TypeScript validation.
- `fixtures/text-unicode.json`: exact captured input with a non-BMP emoji, private clause and public clause.
- `fixtures/result-manual-supported.json`, `result-manual-insufficient.json`, `result-automatic-silent.json`: presenter fixtures.
- `fixtures/events.json`, `event-waiting.json`: stream fixtures.

Fixture evidence excerpts are authored test data, not a recorded provider response or a measured live result. Their URLs are illustrative retained-citation fields; inspect fresh source content before using a claim in a demo. `modelVersion: fixture` labels these artifacts explicitly.

## Sessions and HTTP

| Request | Contract |
| --- | --- |
| `POST /v1/sessions` | JSON `{ "joinCode": "..." }`; response contains `sessionId`, `token`, `sessionEpoch`, `expiresAt`. |
| `POST /v1/sessions/{id}/checks` | Full `text-input.schema.json`; returns `202`. Results arrive on the stream. |
| `POST /v1/sessions/{id}/checks/{requestId}/cancel` | Idempotent cancellation; no late result delivery. |
| `DELETE /v1/sessions/{id}` | Cancel, clear app-owned session data and invalidate token. |
| `GET /health` | Provider readiness/mode without credentials. |

Every session operation requires `Authorization: Bearer <session token>`. A session ID is not authorization. Use HTTPS/WSS outside local development. The demo join code is expiring, rate-limited access control, not production identity. Server keys never enter the app.

Connect the stream **before submitting text**. There is no event replay across a disconnected epoch. A request key is `(sessionId, sessionEpoch, requestId, revision)`: identical retries do not run the checker twice, and different content under the same key is rejected. A correction increments `revision` while preserving `requestId`; this supersedes old output and shares provider-attempt limits. A deliberately new check gets a new request ID.

## WebSocket events

Connect `WS /v1/sessions/{id}/stream`. Native `URLSessionWebSocketTask` can send the bearer header. Browser WebSocket APIs cannot set that header, so the console sends subprotocols `actually-v1` and `bearer.<session token>`; the server selects `actually-v1`. Never place tokens in URL query strings. Browser Origin must be allowed by the server.

Envelope fields are `schemaVersion`, `eventId`, increasing `eventSeq`, `sessionId`, `sessionEpoch`, `type`, `serverAt`, `payload`; claim events also identify `requestId`, `claimId`, `revision`. A request may produce up to two separate claim IDs. Do not overwrite one clause's result with another clause's result.

Handle `session.ready`, `claim.detected`, `claim.checking`, `claim.waiting`, `claim.skipped`, `claim.needs_confirmation`, `claim.result`, `claim.superseded`, `check.cancelled`, `pipeline.error`, and `session.ended`. ASR integration adds `audio.ready`, `audio.stopped`, `transcript.partial`, `transcript.final`. Unknown future event types should be ignored safely. `claim.waiting` supplies `admissionAction: wait`, `reasonCode` and `waitExpiresAt`; it is not a factual verdict.

`claim.result` includes the checked text and source span, retained evidence, selected IDs, verdict, reason, summary, check/expiry times, monotonic duration, cache marker and policy/model versions. Evidence `publishedAt` preserves source precision: an ISO date (`YYYY-MM-DD`), a timestamp with explicit offset, or `null` when unknown. Do not invent a midnight timestamp for a date-only publication. Retrieval/check/expiry fields remain timestamps. Never present a provider error as false or insufficient evidence. A completed `insufficient_evidence` is a distinct factual abstention.

Render `presentation.action` independently of the verdict:

- `respond`: explicit user request; display or speak according to user/device preferences.
- `notify`: the server permits an automatic cue; the app may suppress it for mute, interruption or device state.
- `silent`: inspectable result only. The app must not promote this to a warning.

Ignore old epochs, old revisions and repeated event IDs. Mark a prior result superseded on correction. Stop/disconnect stops capture and playback; close the session, discard pending audio and suppress delayed delivery. Reconnection requires explicit resume; do not replay audio captured during the gap. No alert means **not verified**, not true.

## Unicode spans

Offsets are half-open Unicode **code-point** indices into unnormalized `originalText`. JavaScript UTF-16 offsets and Swift `Character` offsets are both wrong. For the Unicode fixture, `{ "start": 23, "end": 55 }` selects `The Eiffel Tower opened in 1889.`.

```swift
let scalars = Array(originalText.unicodeScalars)
let selected = String(String.UnicodeScalarView(scalars[start..<end]))
assert(selected == checkedText)
```

Check bounds before slicing. Input text is at most 800 code points; the combined context is at most 1,200 code points in at most two utterances. Oversize input is rejected, never silently truncated. Text capture provenance stays in `capture.source`; identify phone/fixture input honestly.

## Audio / ASR seam

The friend implementing ASR provides `AsrAdapter` from `services/api/src/transport/audio.ts`; implementation belongs in their `input/asr/` module. `start(config, onTranscript, signal)` returns a stream with asynchronous `write(frame)` and `stop()`. Honor abort, discard incomplete segments on discontinuity, and never log raw PCM or transcripts. Backend transport must bound pending PCM to two seconds and await writes. No ASR provider is bundled with this seam; an unconfigured server reports `asr_unavailable` rather than acknowledging capture.

Inject the implementation with `buildServer({ ..., asr: adapter })`. `AudioBridge` enforces the two-second backlog, validates frames, forwards only final transcripts to the checker, and closes the adapter on pause, disconnect, deletion or playback. Identical final retransmissions are idempotent; a correction to the same segment increments its revision without resetting its attempt budget. `playback.started` discards the active audio generation; after `playback.ended`, explicitly negotiate a higher generation. No ASR credentials or provider implementation are included in the default entry point.

Control messages always include the current `sessionEpoch`. Use `session.pause` and then explicit `session.resume`, `claim.cancel` with `requestId`, or `claim.repeat` with `requestId` and `claimId`. `session.preferences` sets `preferences: { muted, automaticNotifications, selectedTopics }`. Automatic notifications default off. The classifier does not infer semantic topic categories. Immediately before presentation, the runtime matches currently enabled topic strings as normalized whole literal phrases in the admitted `checkedText`, including cached and in-flight results. Rejected private clauses/context do not enter matching; a topic match still requires the ordinary contradiction, opt-in, session and budget gates before notification. Repeat uses an unexpired retained result without another provider call. A new check uses a new request ID.

First send:

```json
{"type":"audio.start","sessionEpoch":1,"streamGeneration":1,"encoding":"pcm_s16le","sampleRateHz":16000,"channels":1,"source":"glasses_stream_audio"}
```

Wait for `audio.ready` before binary frames. P0 accepts 16kHz mono PCM16 little-endian; the app must perform real sample conversion if capture differs. Each binary WebSocket message contains:

| Byte offset | Format | Value |
| --- | --- | --- |
| 0 | uint8 | Protocol version `1` |
| 1 | big-endian uint32 | Stream generation |
| 5 | big-endian uint32 | Sequence, starting at `0` |
| 9 | big-endian uint32 | Capture offset in milliseconds, starting at `0` |
| 13 | PCM16 little-endian bytes | 20–200ms, integral millisecond duration |

At 16kHz mono, 100ms is 3,200 payload bytes and a total 3,213-byte frame. Sequence increments by one; capture offset advances by the exact previous frame duration. A gap, duplicate, version/format mismatch or old generation invalidates partial transcription. Stop and negotiate a strictly higher generation before continuing. No buffering or concatenation across gaps. `AudioFrameValidator` validates framing only; it does not record, transcribe or select devices.

## Validation boundary

The contracts and fixture tests validate shape, Unicode behavior, citations and bounded framing locally. They do not prove Swift decoding, HTTPS deployment, provider quality or hardware capture. Run the same golden files in the native target and review version 1 with the app owner before changing an incompatible field. Keep `schemaVersion` stable for compatible additions; bump it for incompatible changes.
