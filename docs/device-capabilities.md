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
| Native display card | Fixture verified by teammate in simulator; production wiring pending Mac/device validation | The native True/False/Searching fixture was reported visually verified on Mac; production now shares that component hierarchy and real backend source updates | No physical MRBD validation is established by the fixture report |
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


## Native association and connection recovery (#64)

The native display is the default lens path. The React Web App display remains available
as an optional companion-selected output. Its cards and animations are preserved.

Meta owns DAT registration and paired-device persistence. The app reads the SDK's current
registration state/device stream and never stores a second Meta credential or automatically
opens a new registration flow. A registered, eligible display device can reconnect output
without an extra web display link. Physical force-quit/relaunch, revocation, unpairing and
link-recovery behavior still need the supported-device checklist below; SDK state observation
alone is not proof of persistent association on hardware.

The backend URL is in UserDefaults; the join code stays in the device-only Keychain. A
persisted connection-intent flag enables foreground restoration after a successful explicit
Connect (and migrates an existing saved configuration). Explicit Disconnect disables it
across relaunch. Session IDs and short-lived bearer tokens stay in memory. The transport
recreates five-minute sessions with the existing authorized join code; it does not extend
server TTLs. If that join code has expired or is revoked, automatic attempts stop and the
companion asks for a valid code. Temporary failures use bounded attempt bursts and cooldown,
cancelled on suspension/disconnect, with foreground/network recovery opportunities.

Foreground restoration, backend renewal and native display reconnection do not call camera
or microphone start. Live mode requires explicit Start listening after a connection loss or
session expiry, including a short loss; its AudioStreamer opts out of the lower-level legacy
five-second automatic sender-resume behavior. Backgrounding stops the active capture stream and
suspends the transport. A previously opted-in wake detector retains its setting and may re-arm
after an eligible foreground/session restoration; it remains gated by foreground,
registration/device availability and backend eligibility. Unpair/revocation blocks it and
active capture until eligibility returns. Reconnecting output never supplies new capture or wake
consent.

Only a current in-memory live result with the same backend session/epoch and an unexpired
result deadline may be replayed after a DAT-only link loss. Relaunch, session renewal,
backgrounding, cancellation, supersession, explicit disconnect and authorization loss clear
that eligibility. History is not a native replay queue. Manual checking/source updates are
scoped to the current request; older results or failures cannot replace a newer manual search.
The native lens is clear while idle and has no conventional action buttons.

### Native validation still required on Mac and physical glasses

The Linux workspace checks Swift syntax but cannot compile the iOS app or execute XCTest.
Run the new BackendClient, LiveModel, NativeConnectionRecovery and LookAndCheckCoordinator
regressions in Xcode, then record the Xcode/iOS/DAT/Meta AI/glasses firmware versions for:

1. Pair once, force-quit and relaunch; confirm whether SDK registration/device association is
   restored without registration prompts. If Meta requires reauthorization, record it plainly.
2. Start with a configured backend, relaunch/foreground and verify transport/native output
   restoration with no camera LED, ambient stream or microphone start from recovery alone.
3. Disconnect/reconnect network and glasses independently; verify deterministic status,
   recovery, current-card deadline handling and explicit Start listening after transport loss.
4. Let the five-minute session expire; confirm one new authorized session, no stale card and
   no resumed recording. Revoke/expire the join code; confirm attempts stop until manual repair.
5. Suspend during camera permission/startup and photo/OCR. Resume and verify delayed work
   cannot submit old input or stop a later user-started stream. Repeat explicit Disconnect
   across foreground/relaunch and confirm the connection stays disconnected.
6. Revoke/unpair in Meta AI, then reauthorize; verify output eligibility, wake gating and
   voice/button check readiness without automatically starting the main capture stream.

Background transport or DAT execution is not guaranteed: this implementation restores when
foreground execution and SDK/device availability permit it.
