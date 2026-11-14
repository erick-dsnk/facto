# Live pipeline decisions

Agreed in A's design review on 14 November 2026, 04:15–05:00 EET. A (Davidtzuke) owns the iOS app, audio capture and the Deepgram adapter; B (erick-dsnk) owns the fact-checking service. Items marked **B to confirm** touch B's files or contract.

## Target device

Meta Ray-Ban Display glasses for the demo and the product. Ray-Ban Meta Gen 2 is the development device until the Display loaners arrive. Display tests: the checklist in `docs/device-capabilities.md`.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Where things run | **Everything on the backend**, Deepgram included. The phone captures, frames and sends audio, runs OCR, and renders results. |
| 2 | Sentences to the checker | The Deepgram adapter (`services/api/src/input/asr/`, A) emits **one sentence at a time**. A sentence goes out when it is punctuated, followed by more speech and unchanged in two interim results (stable interim). Locked chunks and a ~1 s pause (`UtteranceEnd`) flush leftovers. Corrections are sent as a new `revision` of the same `segmentId`. Cap ~300 characters, cut at a comma. Goal: a sentence reaches the checker **~0.3–0.6 s** after it is spoken. |
| 2a | Deepgram settings | `model=nova-3`, `interim_results=true`, `smart_format=true`, `diarize=true`, `endpointing≈300`, `utterance_end_ms=1000`, 16 kHz mono PCM16, 20–40 ms frames from the phone. |
| 3 | Conversation context | Each sentence carries the **2 previous sentences** from the last 60 s, ≤1,200 characters, with speaker labels, e.g. `"Speaker 1: …"`. No contract change: `context` is already `string[]`, max 2. **B to confirm:** add optional `speaker` to the transcript schema in `audio-bridge.ts` (it is `.strict()` today) and fill `context` from a per-session ring in `server.ts`, which sends `context: []` today. |
| 4 | "Check this" trigger | **Voice:** the backend spots trigger phrases ("check this", "can you check this", "is this true", "fact check this") in the transcript and sends the phone a `capture.request` event. The trigger sentence is not fact-checked. **Button:** the glasses capture button, Neural Band or an app button triggers the same capture. **B to confirm:** the `capture.request` event type. |
| 5 | OCR | **On the phone, Apple Vision**, accurate mode, language correction, English (plus Finnish if supported). Low-confidence lines dropped; "Move closer and try again" if the photo is unreadable. The photo stays in memory and is discarded after OCR; only text goes to `POST /checks` with `capture.source: glasses_camera`, `userInitiated: true`. |
| 5a | Photo | Taken **during the live stream** with `stream.capturePhoto(format: .jpeg)`: 1080×1440 in 0.2 s on Gen 2. **The stream is never paused for a photo.** |
| 6 | OCR text sent | **All recognised text** in reading order. Over 800 code points: split at sentence boundaries into requests of ≤800, at most 3 per photo. Never silently truncated. |
| 7 | Output | `respond` (user asked): short spoken answer of 10–20 words using the plan's wording, plus a card. `notify` (automatic flag): quiet chime plus a card in the lens and on the phone; "what was that?" or a button speaks the details. `silent`: nothing. URLs are never read aloud. A chime doesn't trigger `playback.started`, so listening continues. |
| 8 | Hosting | **Production on Railway**, EU West, one instance (sessions are in memory), auto-deploy from `main`. Variables: `HOST=0.0.0.0`, `PIPELINE_MODE=live`, `JEV_API_KEY`, `EXA_API_KEY`, `DEEPGRAM_API_KEY`, `DEMO_JOIN_CODE`, `DEMO_JOIN_EXPIRES_AT`, `ALLOWED_ORIGINS`. Railway terminates TLS, so no `TLS_*` paths. Account and keys are set up by the team. The Deepgram adapter is passed in via `buildServer({ asr })` in `index.ts`. |
| 8a | Network | While streaming, the iPhone is on the glasses' Wi-Fi (no internet), so all backend traffic uses **mobile data**. To test: a request mid-stream reaches Railway. Backup: a second phone's hotspot. |
| 9 | Failures | Connection blips **under ~5 s**: reconnect and resume automatically with a new stream generation and a quiet chime. Longer outages and glasses disconnects stop listening with a distinct spoken reason. Audio from the gap is always discarded, never replayed. A broken connection never looks like "no alerts". **B to confirm:** auto-resume within 5 s is acceptable under the explicit-resume rule. |
| 10 | Stream quality | High 720×1280 @ 30 fps when the live view is visible (filming, the "check this" moment, a **Demo quality** switch); low resolution / low fps during long listening sessions, where only audio matters. Pending test: photo size at low stream resolution, thermal after 5 minutes at High. |
| 11 | Display | Results render **in the lens** (600×600 card: verdict, claim excerpt, source name). The app also shows a **lens mirror**, the same card drawn on the phone or a big screen, so audiences see what the wearer sees. The SDK has no real lens-mirroring API. |

## Open items

- Railway account, keys and first deploy (team).
- B confirmations: `speaker` field and context ring (3), `capture.request` event (4), auto-resume (9).
- Mid-stream mobile-data test (8a) and the quality/thermal test (10).
- Display checklist once the loaners arrive (morning of 14 November).
