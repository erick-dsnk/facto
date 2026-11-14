# Device capabilities (A1)

What the iOS DAT route actually does on our hardware. Every row says how it was proven. "Pending" means not yet tested on the device; nothing here is inferred from documentation alone.

Last updated: 14 November 2026, 03:45 EET. Tests run by A on the hardware below.

## Test setup

| Item | Value |
|---|---|
| iOS project | `apps/ios/` (XcodeGen: `project.yml` → `GlassesLab.xcodeproj`, app "Glasses Lab") |
| Bundle ID / signing | `com.davidvasilescu.junction.glasseslab`, team `97JCVP9322`, automatic signing, Apple Development certificate |
| DAT SDK | `https://github.com/facebook/meta-wearables-dat-ios`, exact `1.0.1` (MWDATCore, MWDATCamera, MWDATDisplay, MWDATMockDevice). Legacy `facebook` URL kept because it resolves; canonical repo is `meta/meta-wearables-dat-ios`. |
| Xcode / deployment target | Xcode 26.5 (17F42) / iOS 17.2 |
| Phone | iPhone 17 Pro, iOS 26.6 (23G71) |
| Glasses | Ray-Ban Meta Gen 2 (SDK `deviceType` = `rayBanMeta`), firmware 129 (minor build not recorded) |
| Meta AI app | Version not recorded. Release channel: Developer Mode, `MetaAppID` 0 |
| Display glasses (MRBD) | Not tested yet: needs a Meta loaner |

## Capability matrix

| Capability | Status | Evidence / how to reproduce | Notes |
|---|---|---|---|
| Registration with Meta AI | **Proven** | Section 1 shows "Registered" after Connect → approve in Meta AI | Developer Mode, no app ID |
| Device state | **Proven** | Section 1: `Connected · rayBanMeta · compatible · worn donned · hinge open · battery 98% · thermal none` | Needs link/compat/device-state listeners; without them the row went stale |
| Device session | **Proven** | Section 3: session reaches `started` | Fails with "No eligible device available" unless the `AutoDeviceSelector` is created once and has reported an active device (matches CameraAccess) |
| Camera stream (Bluetooth Classic) | Proven, superseded | First build with External Accessory keys: frames arrived, heavily compressed | Not used any more |
| Camera stream over Wi-Fi | **Proven** | iPhone joined the glasses' Wi-Fi on stream start. Section 3 measured **720×1280, 29.5 fps, max frame gap 153 ms, 792 frames** with mic audio on | Info.plist keys choose the transport (Meta, issue #376). No Wi-Fi internet while streaming; checks use mobile data |
| Stream quality ceiling | Documented | `.high` = 720×1280, max 30 fps; measured ~0.5 Mbit/s by others | Higher resolution needs photo capture |
| Photo during the live stream | **Proven** | Section 3 "Take photo" with the stream running: `stream.capturePhoto(format: .jpeg)` returned a **1080×1440, 211 KB JPEG in 0.2 s**, stream kept running | The stream is never paused for a photo (team rule). Standalone `camera.photo` stays as the fallback path; it returned captureFailure in earlier tries. Medium/medium is the default |
| Activation control | **Proven (app)** | Session, stream and audio are started and stopped from on-screen buttons | Glasses capture button and voice trigger move to A2/A5; not proven yet |
| Ambient PCM (DAT stream audio) | **Proven** | Delivered **16000 Hz · 1 ch · Float32**, buffers flowing (418 at −32 dBFS while speaking). The level rose for the wearer and for a consenting non-wearer at ~1 m (values not logged) | Needs DAT `.microphone` permission (granted in Meta AI). Rides on the camera stream, so the camera and its LED stay on. Beta/development channel |
| HFP microphone (wearer dictation) | **Proven** | With the glasses as the only Bluetooth headset, the HFP level responded to speech, format 16000 Hz · 1 ch · Float32 | First attempt routed to connected AirPods Max and stayed at −160 dBFS: other headsets must be disconnected, or the app must pick the glasses port by name |
| Spoken output (TTS) | **Proven** | "Speak a sample result" played the sample verdict line | Plays on whatever Bluetooth output is active; the glasses must be the active output for the demo |
| Native display card | Simulated only | MockDeviceKit Ray-Ban Display preview shows the card; Tap me increments | Meta Ray-Ban Display loaners arrive later today: run the Display checklist below |
| Background behaviour | Not tested in A1 | Moved to A5 (#22): background the app mid-stream, expect the raw stream to stop, explicit Start session/stream restores it | Foreground-only P0, as in CameraAccess |
| Simulated glasses | **Proven** | Section 2: MockDeviceKit Ray-Ban Meta and Ray-Ban Display, phone camera as feed | Always labelled simulated |

## Route decision (A1, 90 minutes)

- **Look and check:** photo taken during the live stream → on-phone Vision OCR → text to the backend.
- **Listen and check:** try DAT stream audio first (`glasses_stream_audio`). If no buffers arrive or other speakers are inaudible, fall back to HFP wearer dictation (`glasses_hfp`) plus OCR, and say so in the demo. Phone microphone (`phone_mic`) stays a labelled fallback only.
- **Locked (14 Nov, 03:45):** Listen and check uses **DAT stream audio** (`glasses_stream_audio`, 16 kHz mono Float32, converted to PCM16 for the backend). HFP (`glasses_hfp`) is the proven fallback. Look and check takes a **photo during the stream** (`stream.capturePhoto`, 1080×1440 in 0.2 s) and runs Vision OCR on the phone.
- Decision owner: A (Davidtzuke).

## Display checklist (when the Meta Ray-Ban Display loaner arrives)

Meta Ray-Ban Display is the target device for the demo and the product. Not tested on real hardware yet.

1. Pair the loaner with the team iPhone in Meta AI, turn on Developer Mode, tap **install** to put Meta's DAT component on the glasses, then Connect in Glasses Lab.
2. Confirm the glasses row shows `display` and section 4 reaches Display `started`; the card appears in the lens and **Tap me** taps arrive (Neural Band pinch and touchpad).
3. **Camera + mic audio + display in one session:** stream with mic audio on, then send cards. Measure how long a card takes to appear; Meta lists "combining capture with display batches updates" as a known issue.
4. Take a photo during the stream on the Display glasses; check size and time against the Gen 2 result (1080×1440, 0.2 s).
5. Check thermal and battery after 5 minutes of streaming with the display active.
6. Note which Neural Band and touchpad inputs reach the app (pinch, swipe, double tap) for "check this", "sources" and "dismiss".
7. Ask Amanda Le / Dennis Punjabi to reserve the same pair for filming and the Sunday demo slot.

## Known issues observed

- Glasses link showed "Connecting"/"Disconnected" after restarts; a power-switch cycle plus re-registration restored it. Matches Meta's firmware-129 workaround in issue #292.
- The constantly animating latency clock made list buttons hard to tap; it now runs only while streaming at 30 Hz.
