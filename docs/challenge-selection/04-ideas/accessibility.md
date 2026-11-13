# Meta AI Glasses: project concepts from the accessibility angle

**Summary**
- These are seven concepts for "AI Glasses for Everyone, Everyday" (CHALLENGES.md:L878-946), each for a named disability group and each built on a DAT capability that the commodity "look and ask" assistants do not use: hand tracking in the camera stream, the beta **Motion** IMU, ambient **camera-stream audio**, and Neural Band and touchpad **Inputs**. Every capability is cited to Meta's docs below.
- **The two I would bet on:** (1) **Panel Reader**, which reads the touch panel or appliance button under the user's fingertip for blind users ("register once, then read live on the phone"). (2) **Homing**, which guides a blind user to a named item using an audio beacon that tracks head turns through the IMU between slow cloud detections. Both give a blindfolded observer a 30-second before/after at the table, and both produce a number we can measure honestly (task success and time to target, against Meta AI's spoken answer). They share most of their pipeline, so they can ship as one app with two modes.
- Ideas I rejected from this angle: plain scene description, live captions (Meta already ships captions on Ray-Ban Display), face-recognition memory aids (barred by the AUP without prior Meta approval) and sign-language translation (not feasible in 40 h).
- The main risk for every concept is still device access and capability gating (feasibility.md sections 4 and 9). Every concept below keeps a Mock Device Kit path.

---

## 0. Platform facts these concepts rely on (verified)

| Capability | What the docs say | Status | Source |
|---|---|---|---|
| Camera stream | 720x1280 / 504x896 / 360x640 at 2-30 fps. Bluetooth-limited, degrades automatically. Frames are cropped to 9:16, **corrected for lens distortion and stabilised**. The SDK gives no intrinsics, so we calibrate ourselves | GA | [streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/), [camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing) |
| Motion (IMU) | "accelerometer, gyroscope, and orientation samples": accel in m/s², gyro in rad/s, magnetometer (nullable), **fused orientation quaternion**, ns timestamps, at 5/10/15/24/30/60 Hz (a target, not a guarantee). No permission prompt. Mock Device Kit can replay a recording. **Beta**: dev and beta release channels only. Stabilisation means image and IMU do not exactly align during head movement | Beta | [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion), [camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing) |
| HFP mic | Mono 8/16 kHz, beamformed "to isolate the wearer's voice". Switches output off A2DP | GA | [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) |
| Camera-stream audio | "not beamformed ... ambient sounds and noise are present at their natural levels". 16-bit PCM at 16/44.1/48 kHz, timestamped. Output stays on A2DP. Dev and beta channels only. Whether more than one physical mic channel is exposed (and so sound direction) is **unknown** | Beta | [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) |
| Inputs | Navigation, selection, button and drag events from the touchpad, physical buttons and Meta Neural Band. `Back` is not delivered on real glasses yet, and re-donning the glasses drops the capability | Beta | [session/device guides index](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/groups/session-and-device-management), feasibility.md section 3 and 5 |
| On-glasses speech ASR | Text only. "Silently stops" after about 1 minute | Beta | feasibility.md section 3 and 5 |
| Display (Ray-Ban Display only) | 600x600 components, full redraw on every send. Combining it with photo capture is buggy | GA | [display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/), feasibility.md section 5 |
| Audio out | A2DP to the open-ear speakers. Whether A2DP output is true stereo (left and right speakers separately addressable) is **unknown**, so no concept depends on stereo panning | GA | [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) |
| AUP | No "unique identification of people based on physical characteristics, such as voices and faces" without prior Meta approval. No surreptitious capture. No sensitive locations. Principle: "narrow purpose, short retention, obvious to bystanders" | Policy | feasibility.md section 6, [AUP](https://wearables.developer.meta.com/acceptable-use-policy) |
| Web Apps | No camera or mic, so they are no use for any concept here | n/a | feasibility.md section 2 |

**Beta-gating caveat.** Motion, camera-stream audio, Inputs and Speech are all dev/beta-channel capabilities. Whether they are enabled on Meta's loaner glasses and accounts in Finland is **unknown** (feasibility.md section 4, `CAPABILITY_DENIED`). Ask the booth in hour 0. Each concept below says what survives without them.

**Already shipped by others (so not novel on their own):**
- Meta AI scene and label reading and Be My Eyes on the glasses (competitive.md).
- Live captions on Ray-Ban Display, which "works best when looking directly at" the speaker ([Engadget review](https://engadget.com/wearables/meta-ray-ban-display-review-chunky-frames-with-impressive-abilities-193127070.html), [pulse2](https://pulse2.com/meta-neural-handwriting-display-recording-live-captions-expanded-navigation-and-developer-tools-roll-out-on-ray-ban-display/), both search snippets only).
- Conversation Focus voice amplification ([Android Authority](https://www.androidauthority.com/ray-ban-meta-conversation-focus-3631424), snippet).
- Seeing AI "Find My Things": phone-based, teachable, with audio cues ([Microsoft Research](https://www.microsoft.com/en-us/research/story/find-my-things/), snippet).
- Android Sound Notifications: on-device phone alerts for doorbell, alarms and so on ([Google support](https://support.google.com/accessibility/answer/10092548), snippet).
- VizLens, a research phone app that reads appliance panels with fingertip tracking ([UIST'16 paper](https://cdn.hackaday.io/files/15531664478304/uist16-VizLens.pdf), [AFB](https://afb.org/aw/18/1/15282), snippets).

Each concept says how it differs from these.

---

## Ranking at a glance (all scores are estimates, 1-5)

| # | Concept | User | Meta prize | Overall | Combined | Survives without glasses |
|---|---|---|---|---|---|---|
| 1 | **Panel Reader**: fingertip-to-button reader for touch panels and appliances | Blind | 5 | 4 | **5** | Yes (Mock Device Kit with phone camera) |
| 2 | **Homing**: head-steered audio beacon to a named object | Blind / low vision | 4 | 5 | **4.5** | Partly (visual-only tracking without IMU) |
| 3 | **Nod**: voice-free, hands-free control of real things by looking and nodding | Motor + speech impairment (ALS, CP, SCI) | 4 | 4 | 4 | Partly (IMU replay is deterministic only) |
| 4 | **Heads-Up Sounds**: non-speech sound alerts, confirmed visually when the user turns | Deaf / hard of hearing | 4 | 3 | 3.5 | Weak (audio is beta; Display needed for Deaf output) |
| 5 | **Checkpoint**: self-verifying leave-home routine | ADHD, acquired brain injury, executive dysfunction | 3 | 3 | 3 | Yes |
| 6 | **Who Said That**: group captions with speaker bearing | Deaf / HoH in group conversation | 3 | 3 | 3 | Weak |
| 7 | **Breadcrumb**: "take me back" route return | Blind / low vision, also cognitive | 3 | 3 | 2.5 | Partly |

The Meta prize score uses the four 25% criteria (CHALLENGES.md:L934-937). The overall score uses the rubric in 00-rules-and-jury.md section 7. Juror lenses come from 00-rules-and-jury.md section 5.

---

## 1. Panel Reader: "a screen reader for the physical world, at your fingertip"

**1. User and moment.** A blind adult at home at 07:30 needs the washing machine on "Delicate 30°", or the induction hob on level 6. The panel is flat and touch-sensitive and has no tactile marks. Today they rely on adhesive bump dots placed by a sighted helper, or they ask someone. The AFB reports that dots or braille overlays are the usual workaround ([AFB](https://afb.org/aw/18/1/15282), snippet). The same moment happens away from home: a hotel coffee machine, an office printer, a lift panel, a ticket machine.

**2. Why existing solutions fall short.**
- *Meta AI or any "describe" assistant* answers one photo at a time ("the panel has buttons labelled..."). It cannot say "your finger is on Eco, move right two" in real time, because each answer is a 2-5 s cloud round trip (feasibility.md section 5, estimate).
- *Be My Eyes* needs a volunteer to be available and is slow for repeated daily use.
- *Phone apps (including VizLens-style research)* need one hand to hold the phone and aim it at the panel while the other hand explores it. The VizLens paper is phone-based ([UIST'16](https://cdn.hackaday.io/files/15531664478304/uist16-VizLens.pdf)), and whether it is still available as an app is unknown. Holding the phone is the real barrier: the user loses a hand, and the aim drifts.

**3. Novel mechanism (what we figured out).** Split the work into a **one-time cloud registration** and **live on-phone tracking**, so the live loop never waits on the network.
- *Register once:* one sharp frame of the panel, or a burst we pick by a blur score, goes to a vision LLM, which returns a structured map with a bounding box and label for each control. The user or a remote helper confirms the map once. It is stored per appliance and keyed by visual features.
- *Read live:* at 7-15 fps on the phone, (a) feature-match the live frame to the stored reference to get a homography, (b) run on-device hand landmark detection to find the index fingertip, and (c) project the fingertip into map coordinates and speak the label it is on ("Delicate"), with an earcon when it crosses a button edge. No frame leaves the phone after registration.
- *State changes:* for touchscreens that change screens, re-classify the screen against the registered states. This is a stretch goal; VizLens v2 did the same.
- *Why it matters:* the live latency is bounded by the on-phone frame rate, not by the cloud. It works offline after registration, which answers the connectivity point in L900, and it uploads one image per appliance, ever, which answers the privacy point.
- *Note:* the stream is already corrected for lens distortion ([camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing)), which keeps the homography simple.

**4. Why the glasses are essential.** Head-mounted, the camera looks where the hands are working, and both hands stay on the panel. The camera points at the panel without the user aiming anything, because people face what they touch. On a phone, the "hold, aim, touch" coordination is exactly what blind users cannot do reliably. This is the brief's "first-person view enables new interactions" (L886) in its purest form.

**5. 30-second table demo.** A printed A4 photo of a real washing-machine panel (plus a real kettle or coffee machine if one is at hand) lies on the table. A peer puts on the glasses and a sleep mask. The screen next to them mirrors the phone: the live frame, the projected panel map, a dot on the fingertip and the label being spoken. The same speech also plays from a small table speaker, because the hall is noisy and the observer needs to hear it.
- *Before (10 s):* ask Meta AI "how do I set delicate 30?" and get a description they cannot act on blind.
- *After (20 s):* the peer slides a finger, hears "Cotton... Synthetics... Delicate", taps, and hears "Delicate selected, 30 degrees".
- *Observer sees:* a blindfolded stranger operating a flat panel correctly on the first try.

**6. Hardest risk and device independence.**
- *Hardest risk:* robust fingertip detection plus homography under the stream's 504x896 / 360x640 resolution and motion blur. The fingertip occludes the button it is on. The fixes are to read the label just above the fingertip and to require a hold of about 300 ms before speaking.
- *Second risk:* camera-to-panel distance. At arm's length, the stream resolution may make small labels unreliable for the LLM at registration. Use **photo capture** for registration only (do not combine it with Display, per known issues), or register from the phone camera.
- *Device independence: survives well.* Mock Device Kit streams from the phone camera ([Mock Device Kit](https://wearables.developer.meta.com/docs/develop/dat/mock-device-kit/), via feasibility.md section 3), so a phone on a head strap reproduces the whole loop. It needs no beta capability (Inputs is optional, with a phone-button fallback).

**7. Smallest complete MVP.**
- An iOS **or** Android DAT app with registration (one photo, LLM to JSON map, confirmation) and a live loop (MediaPipe hands plus ORB/AKAZE homography) with spoken labels over A2DP.
- Two registered panels: the printed washer and one real appliance at the venue.
- A state machine for permission denied, session paused or stopped, a stream degraded below 360p ("move closer"), and lost tracking ("panel lost, look at it again").
- An evaluation script on a recorded clip: a labelled-button accuracy table for both arms.

**8. Fit.**
- *Meta criteria:*
  - Creativity: high. The first-person, two-handed interaction is novel on glasses.
  - Technical: high. It has a real CV pipeline, a latency budget and offline operation.
  - Real-world value: high. Pilot candidates are the Finnish Federation of the Visually Impaired (Näkövammaisten liitto; whether they would partner is unknown) and appliance makers' accessibility teams.
  - UX/trust: high. One upload per appliance, nothing uploaded during use, and the LED stays on.
- *Juror lenses:*
  - Beer ("what did you figure out vs the obvious?"): cloud once, phone forever.
  - Daksh: a baseline (Meta AI) and a held-out set of panels.
  - Arturs: offline, with a bounded latency.
  - Kia and Otto: a daily, recurring need.
  - Umar: onboarding is one photo.
- *Measurement:* button-reach success rate and time per task, blindfolded team members and volunteers, against the Meta AI baseline. **Do not claim blind-user results unless we test with blind users.**
- *Tech challenges, honestly:*
  - Gemini API or Gemma for the registration step (Gemma only if it reads panels well enough, unknown).
  - Codex (dev process).
  - Not ElevenLabs. Plain short TTS is better here than expressive voice.

---

## 2. Homing: head-steered audio beacon to a named object

**1. User and moment.** A blind commuter in a station has just been told by Meta AI that "the ticket machine is to your left". Which left, how far, and is it still left after they turn? The same thing happens at home with a dropped earbud case, a specific spice jar, the exit door in a café, or their own bag in a cloakroom.

**2. Why existing solutions fall short.**
- *Meta AI and describe-assistants* give one-shot directions in words, which go stale the moment the head moves.
- *Seeing AI Find My Things* is phone-based and must be **taught each object in advance by recording videos** ([Microsoft Research](https://www.microsoft.com/en-us/research/story/find-my-things/), snippet). The user must hold the phone and sweep it.
- *Be My Eyes* needs a human on the line.

**3. Novel mechanism.**
- **Slow open-vocabulary grounding, fast IMU tracking.** The user names the target by voice or picks it from a list. An open-vocabulary detector (a cloud vision LLM, or an on-phone open-vocabulary model if fast enough, unknown) finds it in a frame at about 1 Hz. We convert pixel position into a **world bearing** (yaw and pitch) using our own calibrated focal length plus the fused **orientation quaternion** at that moment ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)).
- Between detections, the beacon updates at 30-60 Hz from the IMU alone. As the head turns toward the stored bearing, the beacon's pitch and pulse rate rise (a "Geiger" style mono cue, so we do not need stereo, whose availability is unknown). Each new detection re-anchors the bearing, and an on-phone tracker keeps the box between cloud calls.
- *Why it matters:* the cue reacts to head motion with IMU latency instead of cloud latency. That is the difference between "follow a sound" and "keep asking". The doc warns that stabilisation decouples image and IMU during movement ([camera stream processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing)), so we re-anchor only on frames taken when the head is near-still (low gyro magnitude). That is itself a nice engineering beat.
- *Finish:* "within reach" is triggered when the object is centred and its box exceeds a size threshold. Then the hand-tracking from concept 1 can guide the final reach (shared code).

**4. Why the glasses are essential.** The head becomes the pointing device and the IMU measures it directly. Both hands stay free for the cane, the guide dog or the object. A phone would need to be held out and swept, and its pose is not the user's gaze.

**5. 30-second table demo.** Five similar cans or bottles are spread around the table edge. A blindfolded peer says "find the Fanta".
- *Before (10 s):* Meta AI says "it's on the right side of the table" and the peer gropes.
- *After (20 s):* the beacon ticks faster as they turn, they hear a "lock" chime, reach, and get "Fanta, in your hand".
- *Observer sees:* a large screen with a top-down radar of the head yaw, the target bearing and the beacon rate, plus the timer.
- Run the scoreboard live: time-to-touch for each arm.

**6. Hardest risk and device independence.**
- *Hardest risk:* the **Motion capability is beta** and may be `CAPABILITY_DENIED` on loaner glasses. The second risk is bearing error from our own calibration and the stabilisation offset.
- *Without IMU:* fall back to visual-only tracking (an on-phone tracker at 7-15 fps). This is slower to react but still works.
- *Without glasses:* Mock Device Kit gives the phone camera stream, but IMU replay is deterministic only ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). A mock demo would use the phone's own IMU, which is honest only if labelled as such.
- *Hall noise:* the open-ear beacon may be hard to hear, so also mirror it to a table speaker.

**7. Smallest complete MVP.** Voice or list target selection, a 1 Hz grounding call, the IMU bearing beacon, a lock chime, and a reach confirmation. Visible states for IMU unavailable (visual-only mode), lost target ("look around slowly"), offline ("I can only find objects I have seen in the last minute"), and thermal. An evaluation that logs time-to-target and success for each arm.

**8. Fit.**
- *Meta criteria:* creativity high, technical high (sensor fusion), value high, UX high (non-verbal cue, low cognitive load).
- *Overall:* the strongest **peer-floor wow** of the seven. A blindfolded stranger finds an item in seconds, and it is understood in under 10 s.
- *Juror lenses:*
  - Beer: IMU latency against cloud latency, the 10x insight.
  - Daksh: a time-to-target distribution, including failures.
  - Arturs: the hard constraint (Bluetooth bandwidth and cloud latency) solved by sensor fusion.
- *Tech challenges:* Gemini API for grounding (it returns boxes; check that on site), Gemma if run on-device (unknown speed), Codex.

---

## 3. Nod: voice-free, hands-free control of real things

**1. User and moment.** Someone with ALS, cerebral palsy or a high spinal cord injury lies in bed and wants the light on, the blinds down, or the carer called. Their hands cannot reach switches, and their speech is dysarthric, so "Hey Meta" and smart-speaker assistants often fail them. The brief's "people with all abilities" (L890) covers them, but Meta's own accessibility showcase does not (opportunity.md, Opportunity 1).

**2. Why existing solutions fall short.**
- Voice assistants depend on intelligible speech.
- Phone switch-access and head-tracking apps need the phone mounted in front of the user and work only on the phone's own UI, not on the lamp across the room.
- Eye-gaze systems are expensive and stationary (estimate; no product cited).

**3. Novel mechanism.** **Look to select, nod to confirm.**
- The user registers devices by looking at each one once (the lamp, the blinds, the door intercom, the TV). The phone stores visual embeddings.
- In use, the camera stream at low fps matches what is centred in view against those embeddings, all on the phone.
- The **IMU** detects deliberate nods and shakes (a gyroscope pitch or yaw signature with a dwell threshold, tuned per user for limited range of motion). A nod toggles the selected device and a shake cancels.
- Speech is never required. Neural Band selection and touchpad Inputs are equivalent alternatives for users who have those movements.
- The action goes through a home-automation module behind one interface: a mock, Home Assistant, or a consumer Wi-Fi smart plug with an HTTP API. That is a bought device, not embedded work.

**4. Why the glasses are essential.** The head is often the last reliable controllable movement, and the glasses are both the pointer (camera) and the switch (IMU) at once. Nothing must be mounted or aimed.

**5. 30-second table demo.** A desk lamp on a smart plug, and a laptop "TV" showing a mock app. A peer looks at the lamp and the screen shows "Lamp selected". They nod and the lamp turns on. They look at the TV, shake, and it is cancelled. They do all of it without speaking or using their hands. Before/after: the same request spoken in a deliberately slurred way to a voice assistant fails (a demonstration, not a claim about dysarthric users).

**6. Hardest risk and device independence.**
- *Hardest risk:* telling an intentional nod from normal head motion (false triggers), and **Motion being beta**, possibly gated.
- *Fallback:* Inputs (also beta) or a phone-mounted switch.
- *Without glasses:* Mock Device Kit covers the camera, but nod detection would need the phone's IMU on a head strap. That is possible, but it weakens the "on glasses" claim.
- *Physical risk:* smart-plug Wi-Fi at the venue, so keep the mock appliance on the laptop as a backup.

**7. Smallest complete MVP.** Register three devices by gaze, run on-phone recognition, use IMU nod and shake with per-user calibration, drive one real smart plug and two mocked devices, and require confirmation before acting. Measure false triggers per 5 minutes of normal conversation-style head motion, and selection accuracy.

**8. Fit.**
- *Meta criteria:* creativity high (a gap Meta has not marketed), UX and accessibility very high, technical medium-high.
- *Juror lenses:* Kia and Otto (a real, recurring, daily need), Daksh (false-trigger rate as an ungameable metric).
- *Pilot story:* Finnish ALS association or assistive-tech centres (would they partner? unknown).
- *Weakness:* the target users are a niche, and peers may read it as a "smart home demo".
- *Tech challenges:* Codex, Gemma (only if used for device recognition), and possibly Tiger Data for event logs, though that is thin.

---

## 4. Heads-Up Sounds: non-speech alerts you can see, confirmed by looking

**1. User and moment.** A Deaf parent is cooking with the extractor fan on. The doorbell rings, the kettle clicks off, the child calls from behind. They miss all three.

**2. Why existing solutions fall short.**
- Android Sound Notifications already does on-phone sound alerts ([Google support](https://support.google.com/accessibility/answer/10092548), snippet), but it alerts by vibration or flash on a phone that is in a pocket or on a counter, and it cannot say *which* thing.
- Meta's captions handle speech from the person in front of you, not sounds behind you (Engadget, snippet).

**3. Novel mechanism.** **Audio detects, vision confirms.**
- An on-phone audio event classifier (a YAMNet-class model) runs on the ambient **camera-stream audio** ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)).
- It raises a glanceable icon on the Ray-Ban Display ("Doorbell").
- When the user turns their head, the camera checks the likely source (a steaming kettle, a door, the child waving) and upgrades the alert to "Kettle done, confirmed" or downgrades it to dismissed. That cuts false alarms, which is the classic complaint about sound-alert apps (estimate, not sourced).
- The IMU logs which way the user was facing when the sound came (direction from audio alone needs multi-channel audio, which is **unknown**).

**4. Why the glasses are essential.** The alert lands in the line of sight with no device to check, and the confirmation uses where the user is already looking.

**5. 30-second table demo.** Play a doorbell or kettle-click clip from a speaker behind the wearer. The Display icon appears, mirrored on screen for the observer. The wearer turns to a kettle photo and the alert shows "confirmed". *Problem:* the noisy hall is a real test of the classifier, which is good evidence if it works and a failed demo if it does not.

**6. Hardest risk and device independence.**
- Camera-stream audio is **beta**.
- For Deaf users the output must be the **Display** (or a paired-phone flash), so Gen 2 units are of little use and the device pool halves.
- Mock Device Kit simulates the camera, and it is unknown whether it simulates stream audio. A phone-mic fallback is honest for development only.

**7. Smallest complete MVP.** Five sound classes, a Display icon card, visual confirmation for two of them, a false-alarm counter, and a quiet-hours or consent setting. No audio is stored.

**8. Fit.**
- *Meta criteria:* fills the Deaf/HoH gap in Meta's story (opportunity.md Opportunity 1). Uses Display, which counts equally (L898).
- *Weakness:* the obvious baseline exists, so we must show a measured false-alarm reduction from visual confirmation.
- *Tech challenges:* Gemma (on-device confirmation, if feasible), Codex.

---

## 5. Checkpoint: a leave-home routine that checks itself

**1. User and moment.** Someone with ADHD or an acquired brain injury reaches the bus stop and cannot remember whether the stove is off or the door is locked. They go back, and are late again. (This is everyday executive function, not clinical monitoring.)

**2. Why existing solutions fall short.**
- Checklists and phone reminders rely on the same memory that fails.
- Life-logging records everything and is invasive. Memory recorders are on the "avoid" list (competitive.md).
- The dementia memory assistant space is grant-funded (OurLife, competitive.md).

**3. Novel mechanism.** **State verification, not recording.**
- The user teaches 3-5 checkpoints by looking at each in its good state (stove knobs at 0, keys in hand, door latch turned).
- During the user's leave window (time plus motion, e.g. walking detected from the IMU), a low-fps on-phone matcher sees each checkpoint and **keeps only a boolean and a timestamp**. Frames are discarded at once.
- At the door it says either "all three done" or "stove not seen". On request it gives the proof: "seen at 08:02".
- Data retention is literally 5 bits per day, which is a strong trust story.

**4. Why the glasses are essential.** It is passive: the glasses see what the user already looks at, with no extra action. A phone would require a deliberate photo, which the user forgets.

**5. 30-second table demo.** A printed stove-knob card and a key ring. The peer "leaves" (stands up and walks two steps) without picking up the keys, and the glasses say "keys not seen". They pick the keys up and hear "all done". The screen shows the boolean log and an empty frame store.

**6. Hardest risk and device independence.** Few-shot recognition of the *state* (knob at 0 against knob at 3), not just the object, at low resolution. Survives on Mock Device Kit. Walking detection could use the phone IMU instead.

**7. Smallest complete MVP.** Teach three checkpoints, verify passively, run the door-exit trigger (a phone geofence or manual trigger as fallback), keep only the boolean log, and give a spoken summary.

**8. Fit.**
- Very strong UX and trust criterion (Meta's "short retention" principle, feasibility.md section 6), and a clear recurring trigger (Otto).
- Medium creativity, because it looks like a "reminder app" at first glance. The table demo is less striking than 1 and 2.
- *Tech challenges:* Codex. Gemma only if used for state checking.

---

## 6. Who Said That: group captions with speaker bearing

**1. User and moment.** A hard-of-hearing student at a group dinner. Captions follow the person they face, but the joke came from the left.

**2. Why existing solutions fall short.** Meta's Display captions work best facing one speaker (Engadget, snippet). Phone caption apps show unattributed text.

**3. Mechanism.**
- Ambient **camera-stream audio** goes to ASR.
- Visual active-speaker detection (lip motion in view, no identification) is combined with the IMU yaw history to tag each caption line with a bearing arrow ("←") and a seat label the user assigns ("Anna, left"). Labels are user-assigned seats, not voice or face identification, to stay inside the AUP (feasibility.md section 6).
- Speakers out of view get a "← off-screen" tag, inferred from audio energy alone (weak).

**4. Why the glasses are essential.** The head pose and the camera define "who is where" relative to the wearer.

**5. Demo.** Three teammates talk at the table. The Display mirror shows captions with arrows. In a noisy hall this is a fair test, but also a fair failure.

**6. Risk.** ASR quality from non-beamformed glasses audio in a loud hall, and voice-based diarisation brushing against the AUP's voice-identification ban. Display only, with two beta capabilities. Weak without glasses.

**7. MVP.** Two-speaker arrows, Display captions, and no audio stored.

**8. Fit.** It hits the Deaf/HoH gap, but it sits closest to a feature Meta already ships, so the creativity score is at risk. *Tech challenges:* ElevenLabs Scribe (if used for ASR, unknown fit), Codex.

---

## 7. Breadcrumb: "take me back"

**1. User and moment.** A blind visitor at a conference walks from their table to the toilets, guided by staff. Coming back, there is no staff member.

**2. Why existing solutions fall short.** GPS does not work indoors. Meta AI navigation is outdoor (competitive.md lists navigation as first-party). Phone pedestrian dead reckoning (PDR) needs the phone held steadily.

**3. Mechanism.**
- Head-mounted step detection and heading from the glasses' IMU (accelerometer plus fused orientation), plus visual keyframes stored at each turn.
- On "take me back", the app reverses the path, giving turn cues by heading and correcting drift by re-matching keyframes.

**4. Why the glasses are essential.** Head-mounted IMU and camera, with both hands free for the cane.

**5. Demo.** It does not fit 30 s at a table well. The best we could do is a pre-walked 15 m loop and a live 10 m return, which is hard during peer review.

**6. Risk.** IMU drift, beta Motion, and a messy demo. A mock-only demo is weak.

**7. MVP.** Record and return along one route with three turns.

**8. Fit.** Arturs and Daksh would like the drift measurements. Peer legibility is low. *Tech challenges:* Codex.

---

## Rejected from this angle (and why)
- **Describe or read what I see:** commodity. Meta AI, Be My Eyes and Envision ship it (competitive.md).
- **Live captions or translation for Deaf users:** Meta ships captions on Display (search snippets above).
- **"Who is this?" face memory aid:** the AUP bans unique identification without prior approval (feasibility.md section 6), and the space is grant-funded (OurLife).
- **Sign-language interpretation for hearing wearers:** the camera faces the signer, which is the right geometry, but Finnish Sign Language recognition data and a 40 h build are not credible. An estimate, not tested.
- **Low-vision magnifier on Display:** the stream resolution is too low for distant text, and photo capture combined with Display is a known bug (feasibility.md section 5).

---

## The two I would bet on

**1. Panel Reader (best combined chance).**
- It is the cleanest answer to the brief's first line, that the first-person view enables a *new interaction* (L886). Two hands on a panel and a camera that looks where you touch is impossible with a phone and impossible for Meta AI's one-shot answers.
- Its mechanism (cloud once, phone live) is a crisp "what did you figure out" answer for Beer and Timo.
- It works offline and stores almost nothing, which covers the robustness and trust lists (L900, L902).
- It **needs no beta capability**, so it survives capability gating and Mock Device Kit, the biggest risk in feasibility.md.
- It has a measurable before/after against Meta AI on held-out panels.

**2. Homing (best overall-winner upside).**
- A blindfolded stranger finding the right can in seconds is the most legible "wow" for face-to-face peer review, which is the gate to the jury (00-rules-and-jury.md section 3).
- The IMU-against-cloud latency split is a real technical insight.
- Its risk is the beta Motion capability, so confirm it at the booth in hour 0.

**Recommended packaging (estimate).** Build one app, "hands-on, eyes-free", with Homing to *get to* the thing and Panel Reader to *operate* it. They share the DAT scaffold, the on-phone hand and object tracking, the audio cue engine, the state machine and the evaluation harness. The demo is "find the coffee machine, then set it to espresso", blindfolded, in about 30 s. If Motion turns out to be gated, ship Panel Reader alone, with Homing as visual-only tracking.

**Do not claim** user-study results from blind participants unless we actually test with blind participants. Blindfolded sighted testers are a proxy, and the deck must say so (00-rules-and-jury.md section 6 warns against invented evidence).

<!-- complete -->
