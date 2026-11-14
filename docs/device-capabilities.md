# Device capabilities (A1)

What the iOS DAT route actually does on our hardware. Every row says how it was proven. "Pending" means not yet tested on the device; nothing here is inferred from documentation alone.

Last updated: 14 November 2026, 03:30 EET.

## Test setup

| Item | Value |
|---|---|
| iOS project | `apps/ios/` (XcodeGen: `project.yml` → `GlassesLab.xcodeproj`, app "Glasses Lab") |
| Bundle ID / signing | `com.davidvasilescu.junction.glasseslab`, team `97JCVP9322`, automatic signing, Apple Development certificate |
| DAT SDK | `https://github.com/facebook/meta-wearables-dat-ios`, exact `1.0.1` (MWDATCore, MWDATCamera, MWDATDisplay, MWDATMockDevice). Legacy `facebook` URL kept because it resolves; canonical repo is `meta/meta-wearables-dat-ios`. |
| Xcode / deployment target | Xcode 26.5 (17F42) / iOS 17.2 |
| Phone | iPhone 17 Pro, iOS 26.6 (23G71) |
| Glasses | Ray-Ban Meta Gen 2 (SDK `deviceType` = `rayBanMeta`), firmware 129 (exact build: TODO from Meta AI → Device settings → About) |
| Meta AI app | Version: TODO. Release channel: Developer Mode, `MetaAppID` 0 |
| Display glasses (MRBD) | Not tested yet: needs a Meta loaner |

## Capability matrix

| Capability | Status | Evidence / how to reproduce | Notes |
|---|---|---|---|
| Registration with Meta AI | **Proven** | Section 1 shows "Registered" after Connect → approve in Meta AI | Developer Mode, no app ID |
| Device state | **Proven** | Section 1: `Connected · rayBanMeta · compatible · worn donned · hinge open · battery 98% · thermal none` | Needs link/compat/device-state listeners; without them the row went stale |
| Device session | **Proven** | Section 3: session reaches `started` | Fails with "No eligible device available" unless the `AutoDeviceSelector` is created once and has reported an active device (matches CameraAccess) |
| Camera stream | **Proven** (Bluetooth build) | Section 3: live frames at 720×1280 requested | Heavy compression on Bluetooth Classic |
| Camera stream over Wi-Fi | Pending | Rebuild without External Accessory keys; phone should join the glasses' network on stream start | Meta: Info.plist keys choose the transport (issue #376). Expected 720×1280 @ 30 fps; no Wi-Fi internet while streaming |
| Stream quality ceiling | Documented | `.high` = 720×1280, max 30 fps; measured ~0.5 Mbit/s by others | Higher resolution needs photo capture |
| Photo capture (full res) | Pending | Section 3 "Take photo" while streaming → size, KB, seconds | Experimental API, not publishable yet; photos reportedly travel over Bluetooth (issue #363) |
| Activation: glasses capture button | Pending | Press the glasses' shutter while streaming; the photo should arrive on the same publisher | Candidate activation control for Look and check |
| Ambient PCM (DAT stream audio) | Pending | Section 3: enable "Glasses mic audio (beta)", start stream, read the delivered format and level; a consenting non-wearer talks at ~1 m, then a video/room speaker | Needs DAT `.microphone` permission; keeps the camera (and LED) active; beta/development channel |
| HFP microphone (wearer dictation) | Pending | Audio routes: "Start HFP mic test" with no stream; check input route shows the glasses (BluetoothHFP), compare wearer vs non-wearer level | Meta advises not to set up HFP while a session starts/stops (issue #292) |
| Spoken output (TTS) | Pending | Audio routes: "Speak a sample result"; output route should name the glasses | iPhone 17 / iOS 26 HFP silent-audio known issue: check route while HFP is active |
| Native display card | Simulated only | MockDeviceKit Ray-Ban Display preview shows the card; Tap me increments | Real MRBD needed for A4 |
| Background behaviour | Pending | Background the app mid-stream; expect the raw stream to stop; explicit Start session/stream restores it | Foreground-only P0, as in CameraAccess |
| Simulated glasses | **Proven** | Section 2: MockDeviceKit Ray-Ban Meta and Ray-Ban Display, phone camera as feed | Always labelled simulated |

## Route decision (A1, 90 minutes)

- **Look and check:** glasses camera frame → on-phone Vision OCR. Proven route: DAT camera stream. For reading text, prefer a full-resolution photo over a stream frame once photo capture is confirmed.
- **Listen and check:** try DAT stream audio first (`glasses_stream_audio`). If no buffers arrive or other speakers are inaudible, fall back to HFP wearer dictation (`glasses_hfp`) plus OCR, and say so in the demo. Phone microphone (`phone_mic`) stays a labelled fallback only.
- Decision owner: A (Davidtzuke). Fill the Pending rows, then update this section with the locked route.

## Known issues observed

- Glasses link showed "Connecting"/"Disconnected" after restarts; a power-switch cycle plus re-registration restored it. Matches Meta's firmware-129 workaround in issue #292.
- The constantly animating latency clock made list buttons hard to tap; it now runs only while streaming at 30 Hz.
