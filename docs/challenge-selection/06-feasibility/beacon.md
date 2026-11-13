# Feasibility spike: Point and Find (`beacon`)

**Summary**
- **The hour-0 gate is still open, but it is much less risky than it looked.** Meta's own sample app (BirdSpotter, in the public iOS DAT repo, SDK 1.0.1) attaches beta Motion to the **same `DeviceSession` while a camera stream is running**. Its comments describe behaviour observed on worn glasses: the accelerometer axes, a gyroscope and fused quaternion "the pair also report", and Motion being stopped by a photo capture. Nobody has published whether Motion still delivers **30 Hz or more** with the video running, or whether `orientation` is non-null. Only a device can settle that (unverified).
- **The orientation quaternion is not load-bearing.** In a closed-loop simulation (an estimate, not a measurement), "1 Hz grounding + IMU-rate cue + re-anchor only on still-head frames" put the head on the right one of five cans 8 cm apart in **99% of trials** when the target starts in view, with a median of 2.0 s. It tolerated clock offsets between frames and the IMU of up to 500 ms, yaw drift up to 1 deg/s (so integrating the gyro works if `orientation` is null), and focal error up to 10%. Re-anchoring on every frame instead fails badly with 150 ms or more of clock error (53% correct).
- **The IMU buys speed and naturalness, not feasibility.** A GA-only visual tracker at 7 fps fails when the user turns at natural speed (27% correct). If the cue makes the user turn slowly, it matches the IMU version (97-99%). So `beacon` has a working fallback whatever the booth says, and the beta part becomes an upgrade we can measure.
- **Verdict: go-with-changes.** Build the GA visual Find loop first. It shares its code with `panel-reader` Find mode. Add Motion behind a capability check once a 30-minute device test passes. Estimated chance the MVP demo works live: about 55%.

---

## 1. What I ran, and what came out

All code and downloads are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/beacon/`. Nothing was written to the repo except this file.

### 1.1 Read the shipped SDK, not just the docs

- Cloned `github.com/facebook/meta-wearables-dat-ios` (main @ `bbae597`, 2026-10-09) and fetched tag `1.0.1`. The xcframeworks are committed in the tag, so the SDK is **publicly obtainable with no token** on iOS. I extracted the public `.swiftinterface` files for `MWDATMotion`, `MWDATCamera` and `MWDATCore`.
- **Motion API as shipped (verified from `MWDATMotion.swiftinterface`, 1.0.1):**
  - `DeviceSession.addMotion(configuration:) throws(DeviceSessionError) -> Motion?`
  - `MotionSamplingRate` takes `.hz5/.hz10/.hz15/.hz24/.hz30/.hz60`, and the default is 10.
  - `MotionSample { timestampNs: Int64; accelerometer, gyroscope, magnetometer: Vector3?; orientation: Quaternion?; source: .glasses/.neuralBand/.unknown }`
  - `MotionError` has exactly three cases: `sensorUnavailable`, `capabilityClosed` and `deviceDisconnected`.
- **No `capabilityDenied` exists on iOS.** `DeviceSessionError` (1.0.1) has `noEligibleDevice, sessionAlreadyStopped, sessionAlreadyExists, sessionIdle, capabilityAlreadyActive, capabilityNotFound, unexpectedError(description:), thermal*/battery*, datAppOnTheGlassesUpdateRequired, dwaUnavailable, insufficientSDKVersion, dwaOutOfStuRange`. A server-side denial on iOS could therefore surface as `unexpectedError`, as `addMotion` returning `nil`, or as the documented 10-second no-sample timeout that ends in `sensorUnavailable` ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). Which one actually happens is **unknown**. The app must treat all three as "Motion unavailable".
- **`VideoFrame` exposes only a `CMSampleBuffer`** (`MWDATCamera.swiftinterface`). Its presentation timestamp is on a clock that **no source documents relative to Motion's `timestampNs`**, which is the "device monotonic clock". The stream-processing guide also does not cover timestamps ([camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing)). That guide does confirm that the SDK reports **no intrinsics** and that EIS means "the image does not exactly track the head rotation".
- **The Motion skill in Meta's iOS plugin says: "Enable it for the app in Wearables Developer Center."** (`plugins/mwdat-ios/skills/motion/SKILL.md:8`). The web guide lists only registration and a started session as requirements. Whether Motion works in Developer Mode with no Developer Center app (`APPLICATION_ID` 0) is **unknown**, and this is a new item for the booth.

### 1.2 Meta's BirdSpotter sample: the closest public evidence on concurrency

The files are `samples/BirdSpotter/BirdSpotter/Data/Dat/DatGlassesSessionRepository.swift` (cited below as `DGSR`), `.../Data/Location/GlassesAim.swift` and `.../Domain/GlassesMotionRepository.swift`.

| Finding | Where | What it means for beacon |
|---|---|---|
| Motion, Inputs, Speech and Display are attached **when the camera stream reports `.streaming`**, in the same session (`attachSensorsIfNeeded`) | DGSR:L726-765 | Running Motion and the camera in one session is the **intended pattern** in Meta's own code. It is not proof of the sample rate under load |
| Motion runs at 5 Hz, chosen because "a link that is also carrying a video stream and owes it the bandwidth" | DGSR:L1160-1166 | Meta's authors expect Motion and video to share the BT link. Whether 30 Hz survives that is **unknown** |
| Motion and Inputs attached before the device is "there" "fail with `deviceDisconnected` — once, quietly, with no retry" | DGSR:L750-755 | Attach Motion only after the first frame arrives (copy this pattern) |
| "A photograph is what puts it down": a photo capture stops Motion (`stopping → stopped`), and it does not come back unless `start()` is called again | DGSR:L1234-1240 | **Never use `Camera.photo` in beacon.** Ground from stream frames only, and keep a revive-on-stop handler |
| The sample tears the video stream down after the shutter is up **unless the stream carries mic audio** | DGSR:L636-650 | So BirdSpotter's long concurrent Motion-and-video run happens only in its audio mode. That is one more reason to test it ourselves |
| The accelerometer frame was "measured, not assumed" on a worn pair: +X is sky, Y is lateral, +Z is forward | GlassesAim.swift:L20-31 | The axes were observed on hardware. One pair was measured, and other models are **unknown** |
| "The pair also report a gyroscope and a fused orientation quaternion", but the quaternion "is expressed against a reference frame the sensor does not document" | GlassesMotionRepository.swift:L26-31 | `orientation` is probably present on at least one model. Its reference frame (does yaw have a magnetic reference or drift?) is **unknown** |
| A log line exists to tell whether orientation is present, "because nothing else says whether this pair sends one" | DGSR:L1813-1823 | Even Meta's sample authors don't rely on it. **Design for `orientation == nil`** |

### 1.3 Building the SDK sample: blocked here

I tried `xcodebuild build` of BirdSpotter for the generic iOS Simulator (Xcode 26.6 is installed). The sandbox's auto-mode classifier **refused** it as running external code, so **no build was attempted**. The team should run it on a laptop on day 0:
`xcodebuild build -project samples/BirdSpotter/BirdSpotter.xcodeproj -scheme birdspotter -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO`
(the command comes from the sample README). The expected time is a few minutes (estimate).

### 1.4 Closed-loop simulation of the guidance loop (the experiment that could kill it)

The question was whether the bearing pipeline survives the unknowns we cannot measure without glasses, and whether the IMU is actually necessary. The script is `sim_beacon.py` and `sim_beacon_v2.py`, with output in `sim_output.txt` and `sim_output_v2.txt` in the spike folder. It uses pure Python, 400 trials per row, and a fixed seed.

**Model (all assumptions, so every result is an estimate):** five cans 8 cm apart at 50 cm, so the targets are 9.1° apart. HFOV is 70° at 504 px wide (the real HFOV is unknown). The simulated human turns toward the cue with a 0.18-0.30 s reaction time, a gain of 2-3.5/s, a 90°/s cap and tremor. Lock means 2.5° held for 0.4 s, and success means the head ends on the correct can. Defaults are video latency 0.25 s, grounding latency 0.4 s, EIS noise 1° on moving frames, and detector noise 4 px. Still-head means gyro below 15°/s.

| Condition | Correct can | Median time | p90 |
|---|---|---|---|
| **beacon** (IMU 30 Hz, 1 Hz grounding, still-head re-anchor), target starts in view (±15°) | **99.2%** | 1.95 s | 2.57 s |
| same, start anywhere within ±35° (target sometimes out of view) | 83.5% | 2.03 s | 3.02 s |
| beacon, IMU at 10 Hz (SDK default) / 5 Hz (BirdSpotter's rate), ±35° start | 83.5% / 80.0% | 2.33 / 2.69 s | 3.20 / 4.95 s |
| beacon with frame-to-IMU clock error 150 / 300 / 500 ms, **still-head re-anchor** | 84.0 / 83.8 / 78.8% | about 2.1 s | about 3.0 s |
| beacon with frame-to-IMU clock error 150 / 300 / 500 ms, **re-anchor on every frame** | **53.2 / 34.0 / 27.8%** | 2.6-3.3 s | 5.5-7.1 s |
| beacon with yaw drift 0.5 / 1.0 / 2.0 deg/s (gyro-only integration) | 85.2 / 82.2 / **52.8%** | about 2.1 s | about 3 s |
| beacon with focal-length error 10 / 20 / 30% | 84.5 / 75.2 / **59.5%** | about 1.9 s | about 2.8 s |
| beacon with stacked bad case (150 ms clock, 0.5°/s drift, 20% focal, EIS 2°, 1.5 s VLM), ±15° start | 81.8% | 3.02 s | 3.77 s |
| **GA fallback**: on-phone tracker at 7 fps, no IMU, natural-speed user, ±15° start | **27.5%** | 5.48 s | 11.6 s |
| GA fallback with a **cautious user** (gain ×0.5 / ×0.3), ±15° start | **97.2 / 99.8%** | 2.19 / 2.49 s | 3.84 / 3.24 s |
| GA fallback with video latency 0.5 s, natural-speed user | 2.0% | n/a | n/a |
| Cloud-only 1 Hz cue (a "turn left" style baseline), cautious ×0.3 | 45.8% | 3.08 s | 9.10 s |

**What this says (estimates):**
1. **Still-head re-anchoring is mandatory, and it neutralises the scariest unknown,** the undocumented clock offset between frames and the IMU. Without it, 150 ms of misalignment halves accuracy.
2. **A null `orientation` does not kill the idea.** Integrating the gyro with drift up to about 1°/s plus re-anchoring at 1 Hz keeps accuracy flat. It breaks at 2°/s. A gyro that has had its bias removed while still drifts much less than that (typical MEMS behaviour, estimate; the glasses' gyro is unmeasured).
3. **Focal calibration matters more than latency.** Keep the error under 10%. The IMU allows calibration directly: turn the head slowly past a fixed feature, then compute `f = Δpx / tan(Δyaw_gyro)`. This needs about 2 minutes on the device (estimate).
4. **15-20% of trials fail because the target starts outside the FOV.** The MVP needs an explicit search mode ("not in view, sweep slowly") before guidance starts.
5. **The IMU's real value** is that users can move at natural speed and the loop stays stable at any video latency (beacon held 84-87% from 0.15 s to 0.8 s of video latency, while 7-fps visual fell from 52% to 2%). That is a strong, measurable claim for Beer and Daksh. It is not a prerequisite for the demo working.

**Limits of the simulation:** it models yaw and pitch only. The human controller is invented. Detection is assumed correct, because grounding errors were not modelled. It says nothing about whether Motion actually streams on the loaner glasses.

### 1.5 Not run

- The grounding model (a VLM or open-vocabulary detector returning a box for "the Fanta") needs an API key or a large local model download, so its accuracy and latency are **unverified**. Gemini or Claude box output on 504×896 frames of five similar cans must be measured on site (about 30 min with phone photos).
- The Android repo clone did not finish in the sandbox, so I did not check whether Android differs.

## 2. Worked, failed, unverified

**Worked / verified**
- The SDK is public, and the iOS 1.0.1 binaries are in the tag. The Motion API surface is as described in §1.1.
- Meta's own sample attaches Motion while a camera stream runs, and documents two hardware gotchas: attaching too early fails silently, and photo capture stops Motion.
- The guidance algorithm is robust to the clock-offset, drift and EIS unknowns when re-anchoring uses still-head frames only (simulation).

**Failed / blocked**
- Building the sample: refused by the sandbox (§1.3).

**Unverified: what the team must do at the booth in hour 0-1** (a 30-minute test with one device, the BirdSpotter sample or our skeleton app)
1. Pair the glasses, enable Developer Mode, register the app. Ask whether Motion needs enabling in Wearables Developer Center for a Developer Mode app.
2. Start a session, start a camera stream at `.low` resolution and 7 fps, wait for the first frame, then `addMotion(.hz30)` and `start()`.
3. Log for 120 s: the sample rate measured from `timestampNs` deltas, the fraction of samples with non-null `orientation` and with non-null `gyroscope`, frame fps, and any `MotionError` or `DeviceSessionError`. Repeat at `.hz60` and with the stream stopped.
4. **Pass:** at least 25 Hz effective rate with the stream running, and a gyroscope present. Orientation is a bonus. **Fail:** no samples in 10 s, an error on attach, or under 15 Hz.
5. While still on the device: hold still, then turn quickly, and record the gyro and the frames. That gives the clock offset between frames and the IMU (cross-correlate optical-flow yaw rate with gyro z), the focal length, and the yaw drift. All three feed straight into the simulation's parameters.

## 3. Architecture

```
Glasses (RBM Gen 2 or Display) ──BT──► iPhone app (SwiftUI, DAT 1.0.1)
  camera stream .low @ 7 fps ──► FrameBus ─┬─► StillGate (gyro |ω| < 15°/s over the frame)
                                           ├─► Grounder (1 Hz, still frames only)
                                           │     ├─ cloud VLM box for "the Fanta"   (variant a)
                                           │     └─ helper tap from a web page       (variant b, stretch)
                                           └─► OnPhoneTracker (Vision VNTrackObjectRequest, 7 fps)
  Motion .hz30 (beta, optional) ──► HeadPose: quaternion → yaw/pitch, else gyro integration
                                           │
  BearingEstimator: world target bearing = head pose at frame time + atan(px / f_cal)
     source priority: IMU-anchored ► visual-only (cautious cue profile) ► "not in view: sweep"
                                           │
  CueEngine (AVAudioEngine, 60 Hz): mono pitch and pulse rate ~ angular error; lock chime at < 2.5° for 0.4 s
  StateMachine: unregistered · permission · paused/stopped · Motion unavailable → visual mode · target lost · offline
  Judge view (phone, mirrored): frame + box + yaw radar + trial timer + log CSV
  Backend: tiny proxy holding the VLM key (env only)
```

The point of the design is that the Motion path is optional at runtime. If Motion is denied, null, slow or stopped, the same loop runs in visual mode with a slower cue profile, and the screen says which mode is active. That is the "handles device state changes" requirement (CHALLENGES.md:L900) shown live.

## 4. Fallback demo path (device access limited to short slots)

- **Before any slot:** build everything against Mock Device Kit with a recorded h265 table clip, plus a Motion CSV recorded from the phone's own IMU while filming. `setMotionFeed(fileUri)` replays a CSV ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). On iOS, feeds set mid-stream are ignored, so set them before streaming. Mock replay is deterministic, so this proves the pipeline, not the head-turning experience.
- **Slot 1 (30 min):** the gate test in §2, calibration recordings, and 5 test trials.
- **Slot 2 (60 min):** 20 trials per arm with a blindfolded teammate, recorded as screen capture plus external video. These numbers go in the deck.
- **If there is no device at judging:** play the recorded trials alongside a live **phone-as-head** demo (the phone on a headband, using the phone camera and Core Motion behind the same `HeadPose` interface), **clearly labelled** as a phone stand-in.

## 5. Revised MVP

1. Variant (a) only, self-named: "find the Fanta" picked from a list of 5 on the phone or by voice. Helper-tap WebRTC (b) is a stretch.
2. Visual-only Find loop (GA) with a cautious cue profile. This is the baseline and the same engine as `panel-reader` Find.
3. Motion upgrade: IMU-rate cue, still-head re-anchoring, gyro integration when `orientation` is null, and IMU-based focal calibration.
4. Search mode for targets that are out of view. Lock chime. State machine with a visible mode indicator.
5. Evaluation: about 20 trials per arm across three arms (IMU beacon, visual-only, voice-only "left/right" from 1 Hz VLM), reporting time-to-touch distribution, wrong-can rate and failures, as a CSV and a chart on the judge view.
6. Consent: frames are not stored, the LED is on, and a spoken "camera on" cue plays.

## 6. 40-hour plan for three people (A: iOS/DAT, B: perception and audio, C: backend, evaluation and deck)

| Hours | A | B | C |
|---|---|---|---|
| 0-2 | Booth questions (feasibility.md §10, plus "is Motion enabled for Dev Mode apps?"). Build BirdSpotter. Create our app skeleton on DAT 1.0.1 | Record table clips and phone-IMU CSVs. Prototype the VLM box prompt on 30 phone photos | VLM proxy (env key), trial logger, repo setup |
| 2-4 | **Gate test on a device (§2)**. Report pass or fail to the team | Vision tracker on recorded clips | Judge view: frame, box, radar |
| 4-10 | Session, stream and Motion plumbing, revive-on-stop, mock path | CueEngine (60 Hz audio), BearingEstimator, StillGate | Grounder integration, search mode prompts |
| 10-16 | State machine, mode switching, error UI | Calibration routine (f, clock offset, drift) from recordings | Evaluation harness, baseline arm (voice-only) |
| 16-20 | Device slot: end-to-end on glasses, tuning | Tuning thresholds on the glasses data | Sleep or deck outline |
| 20-26 | Sleep (staggered) | Sleep | Sleep |
| 26-32 | Bug fixes, the phone-as-head stand-in | Cue profile A/B, lock robustness | **Device slot: 20 trials per arm**, record video |
| 32-36 | Freeze. Rehearse 30-second peer demo ×10 | Chart of results into the judge view | Deck (problem, IMU-vs-cloud latency story, results, pilot path) |
| 36-40 | Backup video, battery and thermal plan | Spare | Submission, pitch rehearsal |

**If the gate test fails at hour 2-4:** A drops Motion and moves to `panel-reader` (feasibility shared). The Find loop B is building carries over unchanged.

## 7. Verdict

**Go-with-changes.** The question we were told to test cannot be answered without glasses, but the evidence moved a lot. Motion and the camera stream in one session is Meta's own sample pattern. A null quaternion and an unknown clock alignment are survivable by design, and still-head re-anchoring is the one rule we must not break. The remaining killers are binary and cheap to check in hour 0-2: Motion denied or silent on the loaner accounts, or Motion collapsing under 15 Hz while the stream runs. Even then, the visual-only Find loop still works if the cue slows the user down, so 40 hours are not wasted. Estimated chance the live MVP demo works: **about 55%** (device access remains the dominant risk, per feasibility.md §9).

### Sources
- [DAT motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion), [camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing), [session lifecycle](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/lifecycle-events), [release channels](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/set-up-release-channels), all opened 2026-11-13.
- [facebook/meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios) main `bbae597` and tag `1.0.1`: `CHANGELOG.md`, `plugins/mwdat-ios/skills/motion/SKILL.md`, BirdSpotter sources, `MWDATMotion/MWDATCamera/MWDATCore` swiftinterfaces.
- Our research: `02-research/ai-glasses/feasibility.md`, `04-ideas/_candidates.md`, `05-evaluation/_top5.md`.

<!-- complete -->
