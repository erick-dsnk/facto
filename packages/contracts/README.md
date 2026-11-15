# App / pipeline boundary, version 1

The app owns glasses connection, permissions, capture, ASR assembly, playback and display. The pipeline owns authenticated sessions, checking text, evidence and notification permission. The app can build against the golden JSON files below while the provider integrations are tested separately. No Swift or Meta SDK dependency enters the pipeline.

## Contract artifacts

- `src/index.ts`: shared TypeScript inputs and domain interfaces, including runtime input validation.
- `src/wire.ts`: runtime result/event validation, including exact spans and retained citation references.
- `schemas/`: generated JSON Schema artifacts for native tooling. Regenerate with `npx tsx packages/contracts/export-schemas.ts` from the repo root. JSON Schema validates shapes; semantic constraints described in each schema are also enforced by TypeScript validation.
- `fixtures/text-unicode.json`: exact captured input with a non-BMP emoji, private clause and public clause.
- `fixtures/result-manual-supported.json`, `result-manual-insufficient.json`, `result-automatic-silent.json`: presenter fixtures.
- `fixtures/result-manual-speculation-private.json`, `result-automatic-future-estimates.json`, `result-manual-attribution.json`, `result-manual-calculation.json`: presenter fixtures for the additions below.
- `fixtures/events.json`, `event-waiting.json`, `event-capture-request.json`, `events-admission-outcomes.json`: stream fixtures.
- `fixtures/text-audio-low-confidence.json`: audio input with low-confidence words.

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

Handle `session.ready`, `claim.detected`, `claim.checking`, `claim.waiting`, `claim.skipped`, `claim.needs_confirmation`, `claim.result`, `claim.superseded`, `check.cancelled`, `pipeline.error`, and `session.ended`. ASR integration adds `audio.ready`, `audio.stopped`, `transcript.partial`, `transcript.final`, and `capture.request`. Unknown future event types should be ignored safely. `claim.waiting` supplies `admissionAction: wait`, `reasonCode` and `waitExpiresAt`; it is not a factual verdict.

`capture.request` (payload `{ "reasonCode": "voice_trigger" }`) means the wearer said a "check this" phrase. The app takes one photo from the running stream and sends its OCR text as a normal `POST /checks` with `userInitiated: true`. The trigger sentence itself is never fact-checked. The server sends at most one `capture.request` per spoken segment and at most one every 2 seconds; a repeated "check this" inside that window asks for no further photo. A correction that turns a trigger back into an ordinary sentence is checked as a newer revision of that segment. Transcript event payloads carry `speaker`: the 0-based diarization index, or `null` when unknown.

`claim.result` includes the checked text and source span, retained evidence, selected IDs, verdict, reason, summary, check/expiry times, monotonic duration, cache marker and policy/model versions. Evidence `publishedAt` preserves source precision: an ISO date (`YYYY-MM-DD`), a timestamp with explicit offset, or `null` when unknown. Do not invent a midnight timestamp for a date-only publication. Retrieval/check/expiry fields remain timestamps. Never present a provider error as false or insufficient evidence. A completed `insufficient_evidence` is a distinct factual abstention.

Render `presentation.action` independently of the verdict:

- `respond`: explicit user request; display or speak according to user/device preferences.
- `notify`: the server permits an automatic cue; the app may suppress it for mute, interruption or device state.
- `silent`: inspectable result only. The app must not promote this to a warning.

Ignore old epochs, old revisions and repeated event IDs. Mark a prior result superseded on correction. Stop/disconnect stops capture and playback; close the session, discard pending audio and suppress delayed delivery. Reconnection requires explicit resume; do not replay audio captured during the gap. No alert means **not verified**, not true.

### Reconnecting after a short blip

A session allows one stream. A newer authenticated connection replaces an older one, which the server closes with code `4000`, so a half-open socket left by a network drop never blocks reconnection. Every disconnect or replacement pauses the session and increments `sessionEpoch`. To resume automatically within the same session:

1. Stop sending audio and drop any unsent frames from the gap. Never replay them.
2. Reconnect `WS /v1/sessions/{id}/stream` with the same session token.
3. Read `session.ready`: it carries the new `sessionEpoch` and `active: false`.
4. Send `{"type":"session.resume","sessionEpoch":<new epoch>}` and wait for the second `session.ready` with `active: true`.
5. Send `audio.start` with the new epoch and a stream generation strictly higher than the last one used, wait for `audio.ready`, then send frames with sequence and capture offset starting at `0`.

Checks and results from the previous epoch are gone; resubmit an explicit check if the user still wants it. If the session token has expired or been deleted, create a new session instead.

Close code `4000` arrives on the socket that was replaced. It is terminal for that socket: do not reconnect from it. A client that already abandoned the socket after a blip ignores it; otherwise another connection now holds the session, so tell the user listening moved instead of reconnecting, which would kick that connection off in turn.

## Version 1 additions (fact-check port)

Every addition is optional or a new enum value, so `schemaVersion` stays `1`. An older app decodes an unknown verdict as unknown and ignores fields it does not know. The constants named below live in `src/index.ts`; use them instead of copying strings.

**Speculation verdict.** `claim.result` may carry `verdict: "speculation"`, decided by policy and never by a Jev label. Its `reasonCode` is one of `SPECULATION_REASONS`, and no other verdict uses those codes:

| reasonCode | Meaning | `summary` (spoken and card) |
| --- | --- | --- |
| `unconfirmed_rumour` | A rumour, allegation or speculation that no credible source confirms or denies. It may retain evidence that does not settle it. | `Speculation. No credible source confirms this.` |
| `private_life_not_checked` | An allegation about an identifiable person's private life (affairs, health, finances), public figures included. Never searched, so `evidence` and `selectedEvidenceIds` are empty. | `Speculation. Claims about someone's private life aren't checked.` |

`supported`, `contradicted` and `misleading` still need at least one selected citation. `speculation` and `insufficient_evidence` need none.

**Not a claim.** When the wearer asks (`userInitiated: true`) about an opinion, prediction, question, instruction or anything else that states no fact, the server sends `claim.skipped` with `reasonCode: not_a_claim`, `kind` (`opinion`, `prediction`, `question`, `instruction`, `other`), `summary` from `NON_CLAIM_SUMMARIES` ("That's a prediction.", "Not a checkable fact.") and `presentation.action: respond`. Nothing is searched. Overheard non-claims arrive with `presentation.action: silent`. Private or personal statements (`reasonCode: private_or_personal`) carry `kind: other`.

**Misheard.** When Jev judges an audio transcript likely misheard in a way that changes the claim, an explicit request gets `claim.needs_confirmation` with `reasonCode: possibly_misheard` and `summary` from `NEEDS_CONFIRMATION_SUMMARIES` ("I'm not sure what was said."). An overheard one is skipped silently with the same reason code.

**Missing subject.** An explicit request whose subject cannot be found ("It opened in 1889." with no context) gets a `claim.result` with `verdict: insufficient_evidence`, `reasonCode: subject_missing` and no evidence. An overheard one is skipped silently.

**Basis label.** A definitive verdict on a claim about the future carries `basis`: `estimates` ("Based on current estimates") or `announcement` ("Officially announced"), from `BASIS_LABELS`.

**Attribution label.** When the check was whether a named speaker or outlet said or reported something, the result carries `attribution: { label, source, mode }`. `label: reported` goes with `supported` and `not_said` with `contradicted`. `attributionLabel()` words it: "Politico reported this", "Kushner said this", "Not what Politico reported", "Not what Kushner said". `source` is the name as captured, at most 120 code points.

**Route, subject and usage.** `claim.checking` and `claim.result` may carry `route` (`recent_event`, `named_fact`, `weather`, `calculation`, `general`) and `subject` (who or what the claim is about, or `null`). Results and admission events may carry `usage: { jevCalls, exaSearches }`: Jev calls for the whole request so far and Exa searches for this claim. These are for display and measurement, never for a decision in the app.

**Evidence origin.** Evidence may carry `origin`: `web` or `news` (Exa), `fact_check`, `wikipedia`, `wikidata`, `weather` (Open-Meteo) or `calculation`. A missing `origin` means an Exa web result from an older server. Fact-check evidence also carries `rating` (`supported`, `contradicted`, `misleading`), which fixes its stance. Calculation evidence has no page: its `url` is the reserved placeholder `https://facto.invalid/calculation` (`CALCULATION_URL`), and the app must not open it. Weather evidence links the exact Open-Meteo request.

**Low-confidence words.** Audio input may carry `capture.lowConfidenceWords`: at most 12 `{ text, confidence }` entries in sentence order, each text at most 64 code points. The server shows them to Jev; there is no fixed confidence gate any more.

**Server seam types.** `src/index.ts` also holds the server-side seams that the backend builders share: `claimFrame()` defaults for admitted claims, `SourceQuery` and `sourceQuery()` (all a source may see: the checked text and subject, never context), `EvidenceSources`, `PROVIDER_LIMITS` and the extended `ProviderKind`. They are not wire fields.

## Unicode spans

Offsets are half-open Unicode **code-point** indices into unnormalized `originalText`. JavaScript UTF-16 offsets and Swift `Character` offsets are both wrong. For the Unicode fixture, `{ "start": 23, "end": 55 }` selects `The Eiffel Tower opened in 1889.`.

```swift
let scalars = Array(originalText.unicodeScalars)
let selected = String(String.UnicodeScalarView(scalars[start..<end]))
assert(selected == checkedText)
```

Check bounds before slicing. Input text is at most 800 code points; the combined context is at most 1,200 code points in at most two utterances. Oversize input is rejected, never silently truncated. Text capture provenance stays in `capture.source`; identify phone/fixture input honestly.

## Audio / ASR seam

The friend implementing ASR provides `AsrAdapter` from `services/api/src/transport/audio.ts`; implementation belongs in their `input/asr/` module. `start(config, onTranscript, signal, onFailure)` returns a stream with asynchronous `write(frame)` and `stop()`. Call the optional `onFailure(reasonCode)` once when the provider fails after the stream opened; the bridge then stops listening with `audio.stopped` `reasonCode: asr_failed` and a `pipeline.error`, even while no frames arrive. Honor abort, discard incomplete segments on discontinuity, and never log raw PCM or transcripts. Backend transport must bound pending PCM to two seconds and await writes. No ASR provider is bundled with this seam; an unconfigured server reports `asr_unavailable` rather than acknowledging capture.

Inject the implementation with `buildServer({ ..., asr: adapter })`. An adapter may set an optional `speaker` (0-based diarization index or `null`) on each transcript. `AudioBridge` enforces the two-second backlog, validates frames, forwards only final transcripts to the checker, and closes the adapter on pause, disconnect, deletion or playback. Identical final retransmissions are idempotent; a correction to the same segment increments its revision without resetting its attempt budget. `playback.started` discards the active audio generation; after `playback.ended`, explicitly negotiate a higher generation. No ASR credentials or provider implementation are included in the default entry point.

Each audio check carries `context`: up to two earlier final sentences from the last 60 seconds, oldest first, at most 1,200 code points combined. Older whole sentences are dropped first and a sentence is never cut. Lines read `Speaker N: text` (N is the diarization index plus one) when the speaker is known, plain text otherwise. The current sentence is never part of its own context, and a correction keeps the context of its first revision. The server clears this ring on stop, pause, disconnect and every epoch change. A final sentence that is a "check this" phrase ("check this", "can you check this", "could you check this", "is this true", "fact check this", optionally wrapped in filler such as "hey" or "please", or followed by a short word such as "one", "photo" or "for me") emits `capture.request` instead of a check. Each audio sentence uses one of the session's request slots. When they run out, the server stops listening with `audio.stopped` `reasonCode: request_capacity` and a `pipeline.error` of the same code; say that listening stopped and create a new session to continue.

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

### Read-only glasses observer

The companion owns the session and its `/stream` controller socket. It may mint an owner-authenticated `POST /v1/sessions/:sessionId/display-grant` capability. The response (`displayGrantSchema`) contains `displayToken`, `sessionId`, `sessionEpoch`, ISO `expiresAt`, and `streamPath` (`/v1/sessions/:sessionId/display-stream`). The random display token expires within 300 seconds and never after its parent session. Minting another grant rotates only display observers. Owner-authenticated `DELETE` on the grant route revokes it idempotently. Session credentials must never be placed in a glasses link.

The observer connects with WebSocket protocols `actually-display-v1` and `display.<displayToken>`; only `actually-display-v1` is selected. It accepts no text controls or binary input. A connection/disconnection never resumes, pauses, replaces, or stops owner audio. Browser origins must be in `ALLOWED_ORIGINS`; production uses the API's built `/display/` UI. No session token, audio, transcript, capture command, or arbitrary provider payload is forwarded.

Its first frame is a directly sent `display.snapshot`, validated by `displaySnapshotSchema`, with the current epoch/sequence, grant expiry, active flag, and one bounded `DisplayState` (or null). Reconnecting replaces the view with this state; it does not replay notification history. The visible projection includes manual checking and results whose presentation is `notify` or `respond`. The event stream permits only correlated visible checking/source/result/lifecycle changes. Cancellation, supersession, failure, pause, and session end clear matching content; result expiry also bounds the view. A silent completion clears a previously visible checking card using a sanitized `check.cancelled` (`not_presented`) rather than exposing that result. Gaps in sequence numbers are expected because private events are omitted.

`claim.checking` adds optional `claimText`, `mode`, and `userInitiated`. `claim.sources` requires request/claim/revision identity and carries `{sources: DisplaySource[]}` (up to four), where each entry contains stable site `id`, safe `hostname`, bounded `title`, stage `found|reading|ready`, and provider `exa`. These are actual sites returned by search, not an assertion that Exa itself is evidence. Exa's search response arrives as a batch; progress then updates around actual page enrichment. Clients must not manufacture timed source arrivals. A later retrieval pass may replace the current source set. No favicon fetch is required.

Terminal display close codes are 4001 (grant ended), 4002 (rotated), and 4003 (revoked); session deletion closes normally. The companion must request a fresh grant/link when it creates a new session (including its five-minute renewal). The Web Apps observer is a separate display client; the native Device Access Toolkit capture app is not a route for pushing arbitrary HTML onto the glasses.
