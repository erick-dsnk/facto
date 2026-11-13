# Feasibility spike: Nod (`nod`)

**Summary**
- **The classifier passes the recall bar but fails the false-accept bar as written.** On 30 people's head-IMU recordings (public EarSet dataset), a rule-based nod/shake detector with 10 s per-user calibration caught **95.4% of nods and 96.3% of shakes on 20 held-out people**, with **0 shakes read as "yes"**. While those people were talking, though, it produced **6.2 false "yes" per 5 minutes**, against a target of ≤ 1. The strictest setting that kept recall near 90% still gave 1.75 per 5 minutes.
- **The fix is a design change, not more tuning.** We arm the detector only for a 4 s window after the glasses ask "juice?", the way AirPods head gestures work. With the head at rest the false-"yes" rate is then 0%. While the user is talking it is 2-7% per prompt, depending on the setting. Nod must therefore be **prompt-gated, never always-on**, and every "yes" is read back before anything happens.
- **The platform risk is narrower than we assumed.** Meta's own BirdSpotter sample (DAT 1.0.1, Android and iOS) runs Motion in the same session as a live camera stream. But it runs Motion at **5 Hz**, "on a link that is also carrying a video stream". In our tests recall drops to 73% at 5 Hz, against 92% at 10 Hz and 95% at 30 Hz. **The hour-0 question becomes: does Motion run at 15 Hz or more alongside a LOW/7 fps camera stream on the loaner glasses?**
- **Verdict: go-with-changes**, conditional on that hour-0 Motion check. If the check fails, Nod is a no-go and the team takes the reserve.

---

## 1. What I ran

All code and data are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/nod/` (outside the repo):
- `code/nodspike.py`: classifier, calibration, simulated DAT delivery and evaluation harness
- `code/sweep.py`: parameter sweeps
- `code/to_mdk_csv.py`: Mock Device Kit fixture builder
- Raw outputs: `code/sweep_dev30_v3.txt` and `code/sweep_dev30_v4.txt` (dev users), `code/test_results.txt` and `code/test2.txt` (held-out users)
- Fixture: `nod_mdk_fixture_P12.csv`

### 1.1 Data: why EarSet is a fair stand-in for glasses IMU
- **EarSet** ([Zenodo 8142332](https://zenodo.org/record/8142332), CC BY 4.0, MD5 verified): 30 participants, a 6-axis IMU (accelerometer and gyroscope) in each ear-tip at about 104 Hz, and 2 minutes each of **nod, shake, tilt, speaking, chewing, swallowing, still**, eye and brow movements, winks, walking and running. "The speaking condition consisted of a conversation with the investigator, where the participant described a recent event" (dataset README). That is exactly the "conversational head motion" in our assumption. Gyroscope scale: raw × 17.5 = milli-degrees per second (README).
- **Why it transfers.** The head is a rigid body, so angular velocity is the same anywhere on the skull. An ear-tip gyroscope and a glasses gyroscope differ only by a fixed rotation, and per-user calibration learns that rotation (PCA on calibration motion). The DAT axis frame is not documented ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)), so we need this calibration anyway.
- **Caveats.** The ear canal moves with the jaw, so speaking and chewing probably leak *more* into an ear-tip than into a glasses frame. That makes the false-accept numbers conservative (estimate). The participants were healthy adults aged 20-49 performing instructed gestures, **not people with motor impairments**. Each gesture recording is a burst of 1-3 nods (or shakes) roughly every 5 s; I verified this in the traces (`code/dbg2.py`), and each burst is a natural "yes" (or "no").

### 1.2 Simulating what DAT Motion will deliver
- The gyroscope signal is box-averaged down to the DAT rates (5, 10, 15 and 30 Hz; the documented options are 5/10/15/24/30/60 Hz, and "the rate you request is a target, not a guarantee", per the [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)).
- Robustness run: 10% random sample drop plus 5 ms timestamp jitter.
- Only the gyroscope is used. The orientation quaternion "can be null" (motion guide), so the design does not depend on it.

### 1.3 Classifier (rule-based, about 60 lines, easy to port to Kotlin or Swift)
1. **Calibration (10 s):** after a "nod now" prompt, wait for motion onset, then keep 5 s of nodding and 5 s of shaking. PCA gives the user's nod axis and shake axis (orthogonalised), and the 90th-percentile angular speed gives each gesture's amplitude.
2. **Bias removal:** an online EMA high-pass filter (τ = 1.5 s).
3. **Detection:** project the gyroscope onto both axes and apply hysteresis at `k_thr × amplitude`. A "yes" fires on ≥ 2 alternating excursions (one down-up nod), each starting within 1.0 s of the previous one, with nod-axis energy ≥ `dom` × shake-axis energy over the gesture. "No" works the same way on the shake axis. Refractory period: 1.5 s.
4. **Cost:** 5 µs per sample in pure Python (`code/nodspike.py`, measured). It is negligible on a phone.

### 1.4 Protocol
- **Dev/test split by person:** parameters were chosen on P0-P9 and are reported on **P10-P29 (20 unseen people)**.
- **Recall:** every held-out gesture burst after the calibration window (n ≈ 430 nods and 400 shakes on the test set) was spliced into 6 s slots of that same person's **still** recording ("user answers a prompt at rest"). A harder variant spliced them into their **speaking** recording ("user nods while talking"). Angular velocities superpose, so splicing is a reasonable approximation (estimate).
- **False accepts:** the detector ran over every unmodified non-gesture recording (speaking, chewing, swallowing, tilt, still, eye, brow, mouth, wink, walking). Two measures: always-on false "yes" per 5 minutes, and **armed-window** false "yes", meaning the share of 4 s windows of speaking that contain a "yes".
- **Evaluation artefact:** P15 (nod) and P10 (shake) performed the gesture continuously for 5 s on and 5 s off, so no discrete bursts were extracted. They contribute no recall samples. Their false-accept data is still counted.

## 2. Results (held-out P10-P29)

### 2.1 Chosen setting: `k_thr = 0.5`, `dom = 4`, 30 Hz

| Metric | Result | Target |
|---|---|---|
| Nod recall, user at rest | **95.4%** | ≥ 90% ✅ |
| Shake recall, user at rest | **96.3%** | n/a |
| Shake read as "yes" | **0.0%** | ✅ |
| Nod read as "no" | 0.0% | |
| Nod recall, nodding while talking | 82.1% | ❌ |
| Time to "yes" from gesture start (median) | **0.43 s** | |
| **False "yes" per 5 min of conversation (always on)** | **6.24** | ≤ 1 ❌ |
| False "yes" per 5 min: chewing / swallowing / tilt / still | 0.39 / 0.75 / 0.87 / **0.00** | ≤ 1 ✅ |
| False "yes" per 5 min: eye, brow, mouth and wink (mean) | 0.83 | ✅ |
| False "yes" per 5 min: walking | 6.37 | (a seated use case) |
| **False "yes" per armed 4 s prompt while talking** | **7.4%** | |
| False "yes" per armed prompt with the head still | **0%** | |

**Per person (still background, 18 people with bursts):** 16 of 18 reach ≥ 90% nod recall. The exceptions are P26 at 85.7% and P27 at 61.8%. False "yes" during 2 minutes of speaking ranges from 0 to 14 per person, and 8 of 20 have zero. The assumption says "across 5 people", so any 5 drawn from this set would include about one person who needs re-calibration or a looser threshold (estimate).

### 2.2 Trade-off curve (held-out, 30 Hz, still background)

| Setting | Nod recall | Shake recall | FA/5 min, talking | FA per armed 4 s prompt, talking | FA/5 min, other non-gesture motion |
|---|---|---|---|---|---|
| k 0.35, dom 2 (loose) | 96.1% | 96.9% | 13.9 | 16.6% | chew 1.2, tilt 2.5 |
| **k 0.5, dom 4 (chosen)** | **95.4%** | **96.3%** | **6.2** | **7.4%** | chew 0.4, tilt 0.9 |
| k 0.7, dom 6 | 89.9% | 92.4% | 3.4 | 4.2% | chew 0, tilt 0.25 |
| k 0.7, dom 10 (strict) | 89.9% | 92.4% | **1.75** | **2.2%** | chew 0, tilt 0 |
| k 0.9, dom 10 | 78.9% | 78.1% | 1.1 | 1.2% | 0 |

No setting meets both "≥ 90% recall" and "≤ 1 false accept per 5 min of conversation" at once. Requiring a double nod (3-4 excursions) on the dev set cut false accepts during talk only to 3-8 per 5 min and dropped recall to 54-72% (`sweep_dev30_v4.txt`). Most participants' natural "yes" is a single nod, so a double-nod rule has to be taught, and this data cannot test a taught double nod.

### 2.3 Sampling rate and link quality (held-out, k 0.5, dom 4, still background)

| Motion rate | Nod recall | Shake recall | FA/5 min talking |
|---|---|---|---|
| 30 Hz | 95.4% | 96.3% | 6.2 |
| 30 Hz with 10% drop and 5 ms jitter | 95.2% | 96.3% | 5.6 |
| 15 Hz | 93.0% | 93.4% | 5.1 |
| 10 Hz (DAT default) | 91.6% | 89.7% | 4.1 |
| **5 Hz (the BirdSpotter sample's rate)** | **63.5%** (73.0% at k 0.35) | 67.3% | 2.4 |

**Nod needs ≥ 10 Hz, and 15-30 Hz is preferred.** At 5 Hz a 2 Hz nod is at the Nyquist limit.

### 2.4 Users with small movements (both calibration and gesture scaled, background not scaled)

| Amplitude | Nod recall | FA/5 min talking | FA/5 min swallow / other |
|---|---|---|---|
| 1.0 | 95.4% | 6.2 | 0.75 / 0.83 |
| 0.5 | 93.5% | 13.2 | 1.5 / 2.7 |
| 0.3 | 94.2% | 18.0 | 3.5 / 5.2 |

Per-user calibration keeps recall up for people with a small range of movement, but false accepts rise as the gesture approaches the noise floor. For the target users (limited motor range) the prompt-gated design is **required**, not optional. Involuntary movement (for example athetoid cerebral palsy) is **not represented** in this data. Its effect is unknown.

## 3. What worked, what failed, what is unverified

**Worked (verified here)**
- Per-user 10 s calibration finds the nod and shake axes without knowing the sensor frame (|cos| between nod and shake axes 0.01-0.18 on dev users; `code/dbg.py`). This matters because the DAT frame is undocumented.
- Nod and shake are almost never confused: shake read as "yes" was 0% on held-out people at rest and ≤ 2.6% while talking.
- Latency is not a problem: the median time to "yes" is 0.43 s from gesture onset.
- **Meta's own sample runs Motion and camera in one session.** In BirdSpotter (Android `DatGlassesSessionRepository.kt`), Motion is attached "off the back of the frames" once the camera stream is STREAMING, because Motion added earlier fails with `DEVICE_DISCONNECTED`. The camera is configured `VideoQuality.LOW, frameRate = 7`, and Motion at `HZ_5`, with the comment "a link that is also carrying a video stream and owes it the bandwidth". The iOS sample also uses `.hz5`. Source: [github.com/facebook/meta-wearables-dat-android](https://github.com/facebook/meta-wearables-dat-android), cloned (commit f4371bc, 2026-10-09).
- **Photo capture stops Motion.** BirdSpotter documents that "a photograph is what puts it down… the sensor goes STOPPING → STOPPED in the middle of a capture and stays there, because nothing in the SDK brings it back". The sample restarts Motion itself. **Nod must use stream frames, never `Camera.photo`**, or it must copy that revive loop.
- The SDK is public. Android artifacts `com.meta.wearable:mwdat-core`, `mwdat-motion` and `mwdat-mockdevice` 1.0.1 return HTTP 200 on Maven Central, and no token is needed (README; checked with curl). iOS is a Swift Package. MockDeviceKit has `MockMotionKit` with `setMotionFeed(samples, loop)` or a CSV URI (both CHANGELOGs; `plugins/mwdat-android/skills/motion/SKILL.md`). The CSV format is 14 columns with no header (motion guide). I generated `nod_mdk_fixture_P12.csv` (3 s still, nod, still, shake, 20 s of talking at 30 Hz) as a ready replay fixture.
- Motion needs no runtime permission prompt (motion guide).

**Failed**
- The assumption **as stated fails on false accepts**: 6.2 per 5 min of conversation at the chosen setting, and 1.75 at the strictest setting that keeps recall at about 90%. An always-listening nod detector would fire every 1-2 minutes while the user talks.
- Recall when nodding *while talking* is 82%. If the user is talking, they should probably use their voice anyway.
- 5 Hz Motion, the rate Meta's sample chose under video load, gives 64-73% recall, which is unusable.

**Unverified (needs the device, or was not attempted)**

| Item | Why unverified | How the team verifies it on site |
|---|---|---|
| Motion is enabled on loaner accounts (beta, dev/beta channel only; may be `CAPABILITY_DENIED`) | No device and no Developer Center access | Hour 0: install BirdSpotter or our probe build with Developer Mode on a loaner pair, `addMotion` after STREAMING, and log `MotionState` and errors |
| **Delivered Motion rate at 15/30 Hz while the camera streams LOW at 7 fps** | Docs are silent; the sample uses 5 Hz | Same probe: request `HZ_30`, log the `timestampNs` deltas for 2 minutes with the camera on, then off. **Pass = median ≥ 15 Hz and gaps < 200 ms** |
| Gyroscope present and non-null on Gen 2 and on Display | Fields are nullable (motion guide) | Same log: count of null gyroscope samples |
| Glasses IMU noise during real talk, compared with EarSet | Different sensor and mounting | Record 5 people × 5 min of chat plus 20 prompted nods and 20 shakes each with real glasses, and replay through `nodspike.py` (CSV export). This is the original assumption, measured properly |
| On-phone embedding names the centred object (3-10 enrolled items) | Not attempted. I spent the time on the IMU risk, and a local Xcode build of the iOS sample was blocked in this environment | Hour 2-6: run a small on-device image-embedding model on stream frames against enrolment photos. Measure top-1 accuracy on the 3 demo props and the per-frame latency. A cloud vision LLM is the fallback (needs a key) |
| ElevenLabs voice output | Needs a key | Pre-generate the request clips. Phone TTS is the fallback |
| Smart plug | Needs hardware | Mock module plus one real plug if someone brings one |
| iOS/Android sample build | Simulator build was blocked by the sandbox here; there is no Android SDK on this machine | First hour: `./gradlew installDebug` on BirdSpotter, which runs fully on MockDeviceKit (sample README) |
| Movement data from motor-impaired users | Not in any dataset I opened | Not verifiable at the event. State it in the deck, and propose a pilot with an AAC or rehab partner as the next step |

## 4. Architecture I would build

```
Glasses (DAT 1.0.1)                     Phone app (Android/Kotlin preferred: BirdSpotter has motion code to copy)
 camera stream LOW, 7 fps  ───────────► frame ring buffer ──► centre crop on dwell ──► on-device embedding ──► k-NN vs enrolled items
 Motion HZ_30 (fallback 15/10) ───────► gyro ─► bias HPF ─► dwell detector (|ω| < τ for 0.8 s)
                                               └─► nod/shake detector (ARMED only 4 s after a prompt)
 speakers (BT audio) ◄──────────────── prompt TTS "Juice?" ◄── state machine ──► YES: read back + speak request (phone speaker, ElevenLabs clip)
                                                                         │                 or smart-plug module (mock | real)
                                                                         └─► NO: next-best candidate / "look again"
 laptop dashboard (WebSocket) ◄── frame thumbnail, IMU trace, armed window, events, latency, FA counter
```

- **State machine:** not registered, permission denied, session paused or stopped (hinge closed means STOPPED and a new session is required; [lifecycle guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/lifecycle-events)), Motion unavailable (fall back to touchpad Inputs or a phone tap), Motion stopped unexpectedly (revive loop, as in BirdSpotter), calibration failed, low battery or thermal.
- **Safety and trust:** prompt-gated arming, an explicit read-back ("Sending: I'd like the juice"), a 2 s undo by shaking, a carer-visible log, no frames stored, and on-device embedding only.
- **Evaluation built in:** every prompt logs armed time, the event and ground truth, so a live false-accept counter is on the dashboard.

## 5. Fallback demo if device time comes in short slots

1. **Build everything against MockDeviceKit.** `MockMotionKit.setMotionFeed` replays our CSV fixtures (EarSet-derived now, real-glasses recordings later), and an h265 clip drives the camera. 70-80% of the build needs no glasses (feasibility.md §3).
2. **In each short device slot, record rather than develop.** Log raw Motion samples plus stream frames to files (5 people × 5 min of talk, plus 20 nods and 20 shakes each). Convert them to MDK CSV and h265 and replay them all night. This also produces the evaluation evidence.
3. **Live demo with glasses:** the visitor wears the glasses, calibrates (10 s), looks at the juice, hears "juice?" and nods. Show the trace and the armed window on the projector.
4. **If Motion is denied or below 10 Hz on the day:** use the same flow with confirmation by the touchpad (Inputs, beta) or a phone/switch tap, plus a recorded real-glasses video of the nod path. This is honest, but it is much weaker for the motor-impairment story, which is why it is a fallback only.

## 6. Revised MVP

- **Prompt-gated look-and-nod:** dwell (0.8 s still) selects the centred object, the on-device embedding against 3-6 carer-enrolled items says "X?", and the detector is armed for 4 s. A nod speaks the request; a shake offers the next candidate or ends the prompt.
- **Calibration:** 10 s guided calibration with a self-test ("nod once… shake once") and an adjustable sensitivity slider. Settings: `k_thr 0.5`, `dom 4` by default, and a "strict" preset (`0.7`/`10`) for users who talk a lot.
- **Outputs:** spoken request (ElevenLabs pre-generated clips, with phone TTS fallback) and one mock smart-plug action (a real plug if one is available).
- **Evidence slide:** EarSet held-out results (the tables in §2) plus our own real-glasses recordings of 5 people. Show armed-window false-accept rate against always-on, and recall at the measured Motion rate.
- **Cut:** always-on listening, quaternion use, double-nod gestures, walking use, and Display UI. The Display UI is a stretch goal: a "Juice?" card on Ray-Ban Display.

## 7. Forty-hour plan for three people

A = mobile/DAT, B = ML/signal and evaluation, C = full-stack, AI and pitch. All hour figures are estimates.

| Hours | A (mobile/DAT) | B (signal/eval) | C (web/AI/pitch) |
|---|---|---|---|
| 0-2 | Booth: allocation, pairing, Developer Mode, **Motion probe** (rate with the camera on and off) | Port the detector to Kotlin; build the replay harness for the MDK CSV | Booth questions (feasibility.md §10); choose props; start the dashboard skeleton |
| 2-4 | **Go/no-go:** Motion at ≥ 15 Hz with the camera means go; otherwise switch to the reserve | Unit tests on EarSet fixtures (same numbers as Python) | Embedding model on the phone: enrolment and k-NN on stored photos |
| 4-10 | DAT session: camera LOW/7 fps, Motion after STREAMING, revive loop, state machine | Calibration UI logic, dwell detector, armed-window logic | Prompt TTS and ElevenLabs clip cache, smart-plug module (mock and real), WebSocket dashboard |
| 10-14 | Integrate the detector and embedding; first end-to-end run on MDK | **Device slot:** record 5 people × 5 min of talk plus nods and shakes | Enrolment flow for the carer; read-back and undo |
| 14-20 | First end-to-end run on real glasses; fix rate and thermal issues | Evaluate the recordings; tune `k_thr`/`dom`; choose presets | Dashboard: IMU trace, armed window, FA counter, latency |
| 20-26 | Sleep in shifts; error states (hinge, doff, battery, CAPABILITY_DENIED) | Sleep in shifts; robustness tests (drop/jitter on real logs) | Sleep in shifts; deck draft (problem, motor gap, prompt-gated design) |
| 26-32 | Hardening, fallback input (Inputs or phone tap), demo script | Evidence slide: real-glasses FA/5 min and per-prompt FA against always-on | Video of a successful real-glasses run; pilot story (AAC or rehab partner) |
| 32-36 | Demo rehearsal × 10 with handoffs between wearers | Live FA counter check during rehearsal | Deck final, peer-table pitch (30 s) |
| 36-40 | Buffer and freeze; charge two units | Buffer | Submission, video, README |

## 8. Verdict

**Go-with-changes**, conditional on the hour-0 Motion probe. The hardest technical assumption, a calibrated IMU nod/shake detector, is sound for *recall* (≥ 90% across 18 of 20 unseen people at ≥ 10 Hz) and clean on nod/shake confusion. It is **not** sound as an always-on input during conversation (4-14 false accepts per 5 min, depending on setting and rate). Prompt-gating fixes that: 0% false "yes" at rest and 2-7% per prompt while talking. It is also the honest design, and it matches how AirPods head gestures work: nod to accept and shake to decline, used to answer calls and notifications ([Apple support](https://support.apple.com/guide/airpods/devb2c431317/web)). Because AirPods already ship nod-to-confirm, the novelty must come from **look-to-select in the real world for people who cannot point or speak**, not from the nod itself. The remaining kill risk is the platform: beta Motion must be enabled on the loaner accounts and deliver ≥ 10-15 Hz alongside the camera stream. Meta's own sample runs both together but chose 5 Hz. **If the probe shows Motion is denied or below 10 Hz under the camera, Nod is a no-go.** The other candidates outrank Nod in `_top5.md` anyway, so this spike does not change the ranking. It removes the "classifier cannot work" objection and replaces it with one 30-minute device test.

Estimated probability that the MVP demo works live: **about 50%** (estimate). That is roughly 65-70% that Motion is usable at ≥ 15 Hz with the camera on loaner glasses, times about 75% that the rest runs cleanly on the day.

## Sources
- CHALLENGES.md:L878-946 (challenge text), especially L900 (permissions, errors, device state) and L902 (consent and safe data).
- `05-evaluation/_top5.md` §6.5, `04-ideas/_candidates.md` (nod), `02-research/ai-glasses/feasibility.md` §3, §9, §10, and `02-research/ai-glasses/opportunity.md` (motor gap in Meta's showcase).
- DAT motion guide (opened): https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion
- DAT lifecycle guide (opened): https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/lifecycle-events
- Mock Device Kit guide (opened): https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/mock-device-kit
- SDK repos (cloned and read; not built): https://github.com/facebook/meta-wearables-dat-android, https://github.com/facebook/meta-wearables-dat-ios (CHANGELOG 1.0.0/1.0.1, BirdSpotter sample, motion skill)
- EarSet dataset (downloaded): https://zenodo.org/record/8142332
- AirPods head gestures (search result, Apple support): https://support.apple.com/guide/airpods/devb2c431317/web

<!-- complete -->
