# Meta AI glasses: capability-first project concepts

**Summary**
- I started from what the Device Access Toolkit (DAT) actually exposes. The resource most teams will not use is the **beta Motion capability**: head IMU at 5-60 Hz, with orientation available on some devices, no permission prompt, and CSV replay in Mock Device Kit ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). Combined with an eye-level camera, it lets the phone know *when* the wearer is attending to something and *what* it is, without a cloud call on every frame.
- Seven concepts follow, strongest first. My two bets are **#1 Nod (look-and-nod communication for people who cannot use their hands or voice reliably)** and **#2 Did I? (automatic proof that you checked the stove or door)**. Nod is the stronger Meta-challenge entry: it covers accessibility, a novel input and a new capability. Did I? is the stronger overall entry: anyone at the peer-review table gets it within 10 seconds, and it has a clean before/after metric.
- I rejected "captions that show only the person you face". Meta already ships it on Ray-Ban Display (see the end of this file). Every concept below survives without glasses via Mock Device Kit (h265 video plus IMU CSV), but each one scores far better on real glasses.
- The main shared risk is that Motion, Inputs and camera-stream audio are **beta, dev/beta release channel only**. Whether the booth's devices and accounts have them is **unknown**, so ask at hour 0. Each concept has a fallback that uses only GA capabilities.

---

## 0. Capability inventory (what we build on)

| Capability | What it gives us | Status | Source |
|---|---|---|---|
| Camera stream | 720x1280 / 504x896 / 360x640 at 2-30 fps; auto-degrades over Bluetooth Classic | GA (DAT 1.0) | [streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/); feasibility.md section 3 |
| **Motion (IMU)** | Accelerometer, gyroscope, and on some devices magnetometer and orientation quaternion; 5/10/15/24/30/60 Hz target; device-monotonic `timestampNs`; 256-sample buffer; **no user permission prompt**; Mock Device Kit replays CSV or in-memory samples | **Beta**, dev/beta channels only | [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion) (opened) |
| Motion + camera at once | The guide says Motion can be used "to align sensor data with a camera stream". Running both in one session is not stated explicitly, and **how IMU timestamps map to frame timestamps is not documented** | unknown | same |
| HFP mic | 8/16 kHz mono, **beamformed to the wearer's voice**; must settle before the camera stream starts | GA | [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) (opened) |
| Camera-stream audio | 16-bit PCM at 16/44.1/48 kHz, **not beamformed** (ambient sound and other speakers at natural levels), output stays on A2DP | Beta | same |
| Speakers | A2DP 44.1/48 kHz stereo; HFP mono when HFP is active | GA | same |
| Speech | On-glasses ASR to text; "silently stops" after about 1 min | Beta | feasibility.md section 3, section 5 |
| Inputs | Touchpad double-tap gives `Select`, swipes give `Nav`; single tap and tap-and-hold are **reserved** for pause/stop; capture button `SHORT_PRESS`/`HOLD`/`DOUBLE_PRESS`; Neural Band select/nav/drag; `Back` not delivered on real glasses | Beta | [inputs guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs) (opened) |
| Display (Ray-Ban Display only) | 600x600 component UI, full redraw per send; do not combine with photo capture | GA | feasibility.md section 3, section 5 |
| Device state | Battery, worn/doffed, hinge, thermal (CRITICAL can end sessions) | GA | feasibility.md section 3 |
| Phone compute | Any on-device model we ship; cloud LLM via our proxy | ours | n/a |

**What it cannot do (do not design around these):**
- Third-party apps cannot use "Hey Meta" commands or Meta AI (competitive.md, via vr.org).
- Web Apps have no camera or mic (feasibility.md section 2).
- No eye tracking is documented anywhere in DAT (unknown, treat as absent).
- Single tap and tap-and-hold are not available to apps ([inputs](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs)).
- No face or voice identification under the AUP (feasibility.md section 6).
- No reliable continuous high-fps cloud vision. Meta's Gen 2 disclosure lists "up to 30 minutes" of live streaming at 720p30 ([Meta legal disclosures](https://www.meta.com/legal/ray-ban-meta/disclosures/), search snippet only, not opened).

**The insight behind all seven concepts:** a phone has a camera and an IMU too, but in a pocket it sees nothing, and in a hand its orientation tells you about the hand, not about attention. On the face, **head stillness plus a camera frame is a cheap, private proxy for "the wearer is attending to this object now"**. A small on-phone model can act on that signal and escalate to a cloud model only on an event. Every concept below uses some form of this "attention gate". It is also the measurable engineering story: frames uploaded, latency and battery against a naive 1 fps stream, which is the design point of Google's VisionClaw-style sample (feasibility.md section 3).

The **attention gate** (a shared module, about 4-6 h estimate):
1. IMU at 15-30 Hz. Compute angular speed from the gyroscope.
2. "Dwell" means angular speed stays below a threshold for N ms; "nod" and "shake" are pitch or yaw oscillation patterns.
3. On dwell, take the latest camera frame (stream at 360x640 or 504x896, 2-7 fps), check sharpness on the phone, and run a small local embedding or detector.
4. Escalate to a cloud vision LLM only when local confidence is low.

Fallback if Motion is unavailable: estimate head stillness from optical flow between consecutive frames. It costs more phone CPU and is less precise (estimate), but it uses GA capabilities only.

---

## Concept 1: Nod (look-and-nod communication with real-world objects)

**1. User and moment.** An adult with limited hand function and unreliable speech, for example ALS/MND, cerebral palsy or post-stroke. *Moment:* at the breakfast table they want the juice, not the water, and the carer is offering the wrong one. Today they wait for the carer to guess through yes/no questions, or use an AAC board.

**2. Why existing options fall short.**
- Phone or tablet AAC needs hand pointing or a mounted eye tracker.
- Eye-gaze AAC devices are expensive: an Ontario funding manual lists approved prices of about $11k-$20k for Tobii Dynavox I-series eye-gaze configurations ([Ontario MoH manual 2025](https://www.ontario.ca/files/2025-03/moh-communication-aids-manual-clinics-en-2025-03-27.pdf), search snippet only, not opened; treat as indicative). They are also fixed to a screen, not to the world.
- The glasses' own inputs are touch, voice and the Neural Band. One reviewer with limited hand function reported that the Neural Band gestures did not work for them and fell back to voice (search snippet, source not opened). Voice is exactly what this user lacks.
- Meta AI can describe what you look at, but it cannot turn "looking plus a nod" into a selection.

**3. Novel mechanism.** **The world is the symbol board.**
- Head dwell (IMU) selects the object in the camera centre; the phone names it through the open-ear speaker ("juice?").
- A nod or a shake, recognised from the IMU pitch/yaw pattern on the phone, confirms or rejects. A confirmed choice is spoken aloud from the phone speaker to the carer ("I'd like the juice, please"), or shown on the phone screen.
- The object label comes from a local detector or embedding, with a small cloud fallback. A per-user "vocabulary" of household objects can be enrolled by the carer in 30 s by looking at each one.
- What makes it better than the obvious approach (voice or touch): it needs **no hands and no voice**, the selection is spatial, and there is no screen to look down at.
- What we would measure:
  - nod/shake recognition accuracy and false-accept rate on held-out recordings from several people;
  - time-to-request against a yes/no 20-questions baseline with a carer.

**4. Why the glasses are essential.** Only a face-worn camera points where the head points, and only a head IMU can read a nod. A phone mounted on a wheelchair sees a fixed scene and cannot tell which object the user means.

**5. 30-second table demo.**
- Three objects on the table (juice, water, apple).
- The observer puts on the glasses, looks at the apple and hears "apple?" in the speaker.
- They shake their head, look at the juice, hear "juice?" and nod.
- The laptop speaker says "I'd like the juice, please", and the projector shows the camera frame with the selection box and the live IMU trace.
- Measurable on screen: recognition latency in ms and a counter of attempts.
- It works in noise because the input is silent; the output uses the phone or laptop speaker at volume.

**6. Hardest risk.**
- Nod and shake recognition across different people and natural head motion (false accepts while chatting).
- The Motion capability is beta and must be available on the booth devices (unknown).
- Without a device: replay a recorded IMU CSV plus an h265 clip through Mock Device Kit ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion); feasibility.md section 3). This shows the pipeline, but it loses the "put it on and try it" moment, which is the demo's main draw.
- GA-only fallback: optical-flow nod detection from the camera stream (weaker, estimate).

**7. Smallest complete MVP.**
- An iOS or Android DAT app with camera at 360x640 and 5 fps, plus Motion at 30 Hz.
- Dwell and nod/shake classifier, rule-based first and calibrated in 10 s per user.
- Labels from a 3-10 object enrolled vocabulary (on-phone embeddings), with a cloud vision fallback for unknown objects.
- TTS of the candidate in the glasses and of the confirmed request on the phone.
- State handling (session paused or stopped, doffed, permission denied).
- An evaluation script on 5+ recorded sessions.

**8. Fit.**
- Meta criteria (CHALLENGES.md:L934-937):
  - Creativity: a high fit, because head-gesture selection with world objects is absent from the public examples (competitive.md).
  - Technical: IMU signal processing plus vision, both measurable.
  - Real-world value: AAC users exist, with a carer-led pilot path (estimate; a Finnish disability organisation as pilot partner is a suggestion, not a contact).
  - UX/accessibility/trust: this is its strongest criterion. It serves "people with all abilities" (L890, L902) and an ability group Meta's showcase skips (opportunity.md, Opportunity 1).
- Juror lenses (00-rules-and-jury.md section 5):
  - Kia: a worthwhile problem.
  - Beer: one insight, "the world is the board".
  - Daksh: nod-classifier false-accept rate on held-out people.
  - Otto: used many times a day.
- Tech challenges (_tech-challenges.md): Gemma (on-device or hosted object labelling as a fallback), ElevenLabs (the user's spoken voice is central; honest), Codex (dev process).

---

## Concept 2: Did I? (automatic proof that you checked)

**1. User and moment.** Anyone who leaves home and five minutes later asks "did I turn off the stove? did I lock the door?", and especially people with ADHD, memory difficulties or checking anxiety (framed as everyday support, not treatment). *Moment:* on the tram, the user double-taps and asks "stove?", and hears "Yes, front-left knob at off, checked 08:14", with the frame on the phone.

**2. Why existing options fall short.**
- The phone workaround is taking a deliberate photo of the stove. It needs a free hand while you hold keys and bags, you have to remember to do it, and the camera roll fills with clutter.
- Smart locks and plugs cover only the devices you replace.
- Meta's built-in capture is a manual photo with no notion of "checkpoint" (estimate; I found no such feature).
- A generic memory recorder stores everything, which is a privacy problem and a search problem.

**3. Novel mechanism.**
- **Enrolled checkpoints plus an attention gate.** The user enrols 3-5 checkpoints once (stove knobs, door lock, window, iron) by looking at each one.
- From then on, the phone keeps a low-rate stream (2 fps, 360x640). When the head dwells (IMU) and the frame matches a checkpoint embedding on the phone, it runs a local or cloud state classifier ("knob at off?") and stores **only that one cropped frame plus its state and time**.
- Every other frame is dropped on the phone and never uploaded.
- Measured:
  - recall and precision of checkpoint events on recorded "leaving home" runs;
  - frames uploaded against a naive 1 fps stream;
  - query latency.
- What beats the obvious approach: it needs no deliberate action, it is private by construction, and it answers a question rather than returning a search.

**4. Why the glasses are essential.** The check happens with your eyes, and you are usually looking at the knob anyway. The glasses record evidence of the glance you already made, with hands busy. A phone cannot do this without an extra deliberate act, which is the very thing people forget.

**5. 30-second table demo.**
- A printed stove-knob panel and a toy door lock on the table, enrolled beforehand.
- The observer wears the glasses, turns the knob to off, glances at it, and glances at the lock. The phone UI on the projector ticks "stove ✓ 14:02:11" and "lock ✓".
- Then they double-tap and ask (or press a phone button in noise) "stove?", and the speaker says the answer and the frame appears.
- Visible before/after: an "uploaded frames" counter shows 2 for us against roughly 60 for a naive 1 fps stream over a minute.
- Live negative case: leave the knob on, and the system reports "front-left knob ON at 14:02".

**6. Hardest risk.**
- Robust knob-state classification under lighting and angle at 360-504p.
- False "checked" claims are the dangerous failure. Design rule: never say "off" below a confidence threshold, say "not sure, here's the frame".
- Without a device: an h265 walkthrough clip plus IMU CSV through Mock Device Kit reproduces the pipeline end to end. A phone camera on Mock Device Kit also works for live table tries (feasibility.md section 3).

**7. Smallest complete MVP.**
- An enrol flow (look plus double-tap).
- The attention gate, a checkpoint matcher and a state classifier (cloud vision LLM with a strict JSON schema; on-device later).
- A local log with auto-expiry after 24 h.
- Query by touchpad `Select` or a phone button; an answer by TTS plus the phone frame.
- Consent UI: home-only mode, plus a pause when a person is detected in frame (face *detection* only, no ID).
- An evaluation on 10 recorded runs.

**8. Fit.**
- Meta criteria:
  - Real-world value: a universal, daily need.
  - Trust: very strong. "narrow purpose, short retention, obvious to bystanders" is literally the design, quoted from Meta's own [acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use); it also matches the "hands-free capture and logging" recommended experience there.
  - Technical: the attention gate and the upload metric.
  - Creativity: medium-high. It risks being read as a "memory recorder" unless the checkpoint framing is sharp.
- Juror lenses:
  - Otto: daily recurring trigger.
  - Kia: a problem everyone recognises.
  - Daksh and Arturs: precision/recall and a stated false-"off" rate.
  - Beer: 30x fewer uploads.
  - Peer legibility: highest of the seven (estimate).
- Tech challenges: Gemma (on-device state classifier), Gemini API (escalation classifier), Codex.

---

## Concept 3: Spot the Slip (a hands-on assembly checker that speaks only when you go wrong)

**1. User and moment.** Someone assembling flat-pack furniture or a kit, or a volunteer at a repair café, holding parts in both hands. *Moment:* step 7, picking up the wrong screw. Today they find out at step 12.

**2. Why existing options fall short.**
- Paper or phone instructions need hands and eyes off the task.
- "Ask what you see" assistants (VisionClaw, Meta AI) answer only when asked, and the user does not know to ask (competitive.md).
- Tutorial viewers on Display have no sensing (competitive.md, "obvious ideas to avoid").

**3. Novel mechanism.**
- **Proactive, event-triggered checking.**
- The IMU distinguishes "head down on the workspace and still" (working) from looking around.
- Only working-dwell frames go to a step-specific check: a local detector for parts on the table, and a cloud vision LLM with the current step's expected state.
- It speaks only on a deviation above a confidence threshold, and advances steps automatically on a match.
- Measured on recorded builds:
  - errors caught;
  - false alarms per minute;
  - frames sent against a naive stream.
- Better than the obvious approach: silence by default, with timing chosen by attention rather than by a clock.

**4. Why the glasses are essential.** Both hands are full and the eyes are on the work, so the camera sees exactly the parts in hand from the right angle. A phone propped on the table sees the wrong angle and gets occluded by the hands.

**5. 30-second table demo.** A 5-step DUPLO or LEGO build with large, colour-distinct bricks.
- The observer builds wearing the glasses.
- On step 3 they deliberately pick the wrong brick, and the speaker says "that's the red 2x4; this step needs the blue 2x2".
- The projector shows the step tracker and a false-alarm counter.

**6. Hardest risk.**
- Vision accuracy on fine-grained parts at 504x896, plus 2-5 s cloud latency (feasibility.md section 5): a warning that arrives after the brick is placed is less useful.
- Mitigation: large distinct parts, and a local detector for the parts set.
- Without a device: works on Mock Device Kit with a recorded build clip, or on the phone camera worn on a head strap (estimate).

**7. Smallest complete MVP.**
- One hand-authored 5-step plan with a reference image per step.
- Attention gate, step-state check and spoken deviation alerts.
- Touchpad swipe to go back a step (since `Back` is not delivered).
- An evaluation on 10 recorded builds with injected errors.

**8. Fit.**
- Meta criteria:
  - Creativity: medium, since grant-funded trade coaching exists (competitive.md, about.fb.com/ai-glasses).
  - Technical: high.
  - Real-world value: medium.
  - Accessibility: medium (cognitive load; it is audio-first, so it works without Display).
- Jurors: Beer (proactive beats ask-and-answer), Daksh (false alarms per minute). Peer legibility is high.
- Tech challenges: Gemini API, Gemma, Codex.

---

## Concept 4: Show Me Once (record a household task by doing it; someone else follows it hands-free)

**1. User and moment.** A grandparent who knows how to bleed the radiators, a building caretaker, or a parent handing over a routine, and the person who has to repeat it later alone. *Moment:* the new tenant at the boiler panel in November.

**2. Why existing options fall short.**
- Phone video recordings are long, unsegmented and need hands to scrub.
- Written instructions take effort to author.
- Grant-funded tools target professional trades, not household knowledge (opportunity.md, Opportunity 4).

**3. Novel mechanism.**
- **IMU-plus-voice segmentation.** While the author works and talks, the head IMU marks "dwell on workspace" against "transition" (look away, stand up). The beamformed HFP mic carries clean narration of the wearer's voice only.
- Step boundaries are where a transition coincides with a narration pause.
- A multimodal model gets only the keyframes and transcript per segment, which is far cheaper than whole-video understanding.
- The learner later steps through the guide by audio on Gen 2 or by cards on Display, with touchpad swipes; a stretch goal adds a camera check of each step's end state.
- Measured: step-boundary agreement with a human labeller against fixed-interval and LLM-only segmentation baselines.

**4. Why the glasses are essential.** The first-person viewpoint captures exactly what the author saw and did, with hands in frame, and narration is natural because the hands are busy. A phone on a tripod gets the wrong angle and no head signal.

**5. 30-second table demo.**
- A teammate wearing the glasses records a 20-second, 3-step task (folding a napkin in a specific way, or setting a combination lock) while narrating.
- About 10 s later, the projector shows 3 auto-cut steps with keyframes.
- The observer, wearing the glasses, swipes through and hears step 2.
- Noisy hall: the HFP beamforming favours the wearer's voice ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)).

**6. Hardest risk.**
- The HFP-then-camera ordering rule. A silent audio-route failure is documented ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)).
- Segmentation quality on short demos.
- Motion running together with the camera is not explicitly documented (see section 0).
- Without a device: replay a prerecorded clip with its IMU CSV. Live authoring needs real glasses.

**7. Smallest complete MVP.**
- Record mode (camera 504x896 at 7 fps, HFP narration, IMU), a segmenter, and an LLM step-writer.
- Playback mode with audio steps and swipe navigation.
- The author's consent and a delete-all control; recordings stay on the phone.

**8. Fit.**
- Meta criteria: creativity medium-high, real-world value medium, technical medium-high. It uses the first-person view on both sides and runs on Gen 2 and Display alike (L898).
- Jurors: Timo (path to scale) and Umar (onboarding). Peer legibility is medium, because the demo has two phases.
- Tech challenges: Gemini API (video and keyframe understanding), ElevenLabs, Codex.

---

## Concept 5: Pot Watch (timers and notes attached to physical things, retrieved by looking)

**1. User and moment.** A home cook with three pots going, often with attention difficulties, or an older adult. *Moment:* "which pot was the 8-minute one, and how long is left?" while their hands are wet.

**2. Why existing options fall short.**
- Phone and voice timers are anonymous ("timer 2"), and you must say which is which.
- Meta AI timers have no binding to objects (estimate; no such feature found).

**3. Novel mechanism.** The Did I? engine run in reverse.
- To set: look at the pot, double-tap, and say or tap a duration. That binds a timer to that pot's visual embedding plus its rough head bearing (IMU yaw).
- To query: a glance (dwell) at the pot plays "4 minutes left" for that pot only.
- On expiry, the bearing gives a spatial cue ("left pot").
- Measured: correct pot-binding retrieval rate among visually similar pots against a voice-label baseline.

**4. Why the glasses are essential.** Looking at the pot *is* the query, which no phone can do. Hands are wet.

**5. 30-second table demo.** Three identical mugs labelled only by position. The observer sets 30 s on the left mug and 60 s on the middle mug by glance plus double-tap, glances back to hear the remaining time, and the left timer fires with "left mug".

**6. Hardest risk.**
- Distinguishing identical pots needs bearing plus scene context.
- Yaw drift without a magnetometer: the magnetometer and orientation are "not produced by every device" ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)).
- Mock-survivable with a recorded clip and IMU CSV.

**7. Smallest complete MVP.** Bind, glance-query and expiry for up to 3 objects, with audio only.

**8. Fit.**
- It is everyday and accessible (cognitive load), with good legibility, but a modest "problem worth solving" for Kia. It shares an engine with Concept 2, so treat it as a feature of Did I? rather than a standalone entry (estimate).
- Tech challenges: Gemma, Codex.

---

## Concept 6: Still Head (a head-stability coach, e.g. putting)

**1. User and moment.** Recreational golfers, and by extension anyone practising a skill where "keep your head still" is the core cue. *Moment:* on the practice green, putts keep sliding right and nobody is there to watch.

**2. Why existing options fall short.**
- A phone on a tripod needs setup and a review afterwards, and it measures the body from outside.
- Coaches are not there for daily practice.
- Meta's own guide lists "activity and form tracking, coaching" as a recommended experience ([acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use)), but no public example uses DAT Motion for it (opportunity.md lists motion as unused).

**3. Novel mechanism.**
- A 60 Hz IMU measures head rotation and translation during the stroke. The stroke is segmented from the gyro signal.
- The camera grabs a frame at impact to see the ball start line.
- Feedback within 1 s by audio: "head moved 3° left before impact".
- Measured: within-session reduction in head movement over 10 putts against a no-feedback block.

**4. Why the glasses are essential.** The sensor is on the thing being coached, the head, and the camera sees the ball from the golfer's eye.

**5. 30-second table demo.** A putting mat on the floor next to the table. The observer putts twice, hears the head-movement number after each, and sees the IMU trace on screen. It is fun, competitive and memorable at a peer table.

**6. Hardest risk.**
- Translation estimates from a consumer IMU drift. Rotation is reliable, translation is not (estimate).
- Is golf "everyday"? It is weak on Meta's "everyone, everyday" framing and on accessibility.
- Mock-survivable with a recorded IMU CSV.

**7. Smallest complete MVP.** Stroke detection, a head-rotation metric, an audio cue and a session chart.

**8. Fit.** High peer-floor wow, medium technical, low accessibility and real-world framing. Jurors: Otto (repeat use). Tech challenges: Codex. I would rank this low for Meta.

---

## Concept 7: Breadcrumbs (find your way back the way you came)

**1. User and moment.** People with spatial-memory or wayfinding difficulty, or anyone in a parking garage, hospital or the Junction venue. *Moment:* "where did I park?" on level -3.

**2. Why existing options fall short.**
- GPS fails indoors (Web Apps quote phone GPS at 5-50 m even outdoors, ai-glasses.md section 1).
- Taking deliberate photos needs effort.
- Meta AI navigation is outdoor and map-based (competitive.md, Meta first-party list).

**3. Novel mechanism.**
- IMU step counting plus turn detection (gyro yaw) logs a sparse path.
- At each turn it keeps one landmark keyframe, with no continuous recording.
- On return, the route is reversed and spoken: "in about 20 steps, turn right at the red pillar".
- Measured: return success and the number of keyframes stored against a continuous recording.

**4. Why the glasses are essential.** Head heading plus an eye-level landmark at each turn, captured without the user doing anything.

**5. 30-second table demo.** This is weak, because a table demo cannot show walking. It needs a pre-recorded route replayed through the system.

**6. Hardest risk.** Pedometry and heading drift from a head-worn IMU (estimate, untested), and the demo format. Mock-survivable, but only as a replay.

**7. Smallest complete MVP.** Record and return for one route of up to 6 turns.

**8. Fit.** Real value and accessibility are medium; peer legibility is low. Tech challenges: Codex.

---

## Rejected from this angle

- **"Captions only for the person you face" (Deaf/hard-of-hearing).** I planned it as a dual-channel trick: the beamformed HFP wearer channel against the non-beamformed camera-stream audio ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)). But Ray-Ban Display already ships live captions that reviewers say caption mainly the person you face ([Meta help: live captions on Ray-Ban Display](https://www.meta.com/help/ai-glasses/23879220601763496/); [Engadget hands-on](https://www.engadget.com/wearables/meta-ray-ban-display-hands-on-discreet-and-intuitive-002334346.html); both search snippets, not opened). Running HFP and camera-stream audio at the same time is also undocumented (unknown).
- **Look-and-ask, label reader and scene describer.** These are commodities (competitive.md).
- **Anything that identifies people.** It is barred by the AUP (feasibility.md section 6).

## Which two I would bet on, and why

| | Meta challenge (L934-937) | Overall (00-rules-and-jury.md section 7 rubric) | Combined |
|---|---|---|---|
| **#1 Nod** | Strongest. It scores on all four criteria, especially the 25% on input, accessibility and trust, and fills the ability gap Meta's showcase leaves (opportunity.md) | Strong on problem, insight and demo. Risk: peers may see it as niche | **Best for the Meta prize** |
| **#2 Did I?** | Strong on trust and real value; medium on creativity | Strongest. Universal, legible in 10 s, a hard metric (uploads, false-"off" rate), a daily trigger for Otto | **Best for overall, and the safest combined bet** |

- **Bet 1, Nod**, because it is the one concept where the glasses are irreplaceable for the user (no hands, no voice, a world-anchored choice). It uses a capability few teams will touch (beta Motion), and the 30-second "put it on and nod" demo is unforgettable.
- **Bet 2, Did I?**, because everyone at a peer-review table has had the stove doubt. It shows privacy as a measured feature ("2 frames uploaded vs 60"), which the brief requires as "part of the demo" (CHALLENGES.md:L906).
- **Combined option (estimate).** Both run on the same attention-gate engine (IMU dwell, on-phone matcher, cloud escalation), so the team can build the engine once. It can then pitch Nod for Meta and keep Did I? as the everyday "same engine, everyone" slide. The jury should still see one product, not two.

**Hour-0 gate questions for the Meta booth (in addition to feasibility.md section 10):**
1. Is the Motion capability (beta) enabled on the loaned devices and accounts?
2. Can Motion and the camera stream run in the same session?
3. Do Gen 2 and Display both report orientation and magnetometer?

If Motion is unavailable, Nod and Did I? fall back to optical-flow stillness (GA only). Nod loses the most from that fallback, which would move Did I? to first place.

<!-- complete -->
