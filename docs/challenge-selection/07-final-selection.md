# 07: Final selection: what we build for Meta "AI Glasses for Everyone, Everyday"

**Summary**
- **Build `panel-reader` + Find, starting now.** A blind adult registers an appliance panel once (one photo goes to a VLM, which returns a control map). After that, the phone runs an offline loop that names the control under their finger and guides the finger to a named button ("right… up… on it"). It is our pick for all three objectives. It needs only GA capabilities, it is the Meta lens's first choice (82), it has the strongest demo (84), and its failures are silence rather than wrong answers (0.0-0.8% wrong labels while touching, measured in the spike).
- **Backup: `did-i`** (tag-anchored checkpoint verifier: "Did I turn the stove off?"). It is also GA-only and shares the app shell, state machine, mirror view, VLM proxy and evaluation harness.
- **Switch trigger:** head-strapped-phone footage at 504x896 of the matte printed panels, finger touching, scored on about 200 hand-labelled dwell frames, gives **under 85% correct or over 3% wrong labels**. Run that at hour 2. Re-run the same test on the first real-glasses clip. **Latest sensible switch: hour 8 of our build, about Sat 10:00 by the wall clock.** After that, narrow the scope instead of switching.
- **Clock check:** hacking started Fri 19:30, and this file was written Sat 01:37 (system clock). Final submission is Sun 10:00 (00-rules-and-jury.md §2), so **about 32 hours remain, not 40**. All plans below are compressed to fit that.

---

## 1. Recommendation and reasoning (read this if nothing else)

**Start `panel-reader` + Find. Keep `did-i` as the backup.**

Why this one:
1. **It fits Meta's brief better than any other candidate.** The brief asks for first-person value "beyond simply mirroring a phone screen" (CHALLENGES.md:L890) and for accessibility "for people with all abilities" (L890, L896, L902), with 25% on input, accessibility and trust (L937). Reading flat touch panels with your own finger, hands-free and offline, is a task a phone held in one hand does poorly. Meta's built-in assistant answers one question per photo and does not track the finger (competitive.md lists Meta AI label reading; the finger loop is the difference). The meta-judge ranked it first: 82, against 76 for `did-i` (`05-evaluation/_top5.md` §3).
2. **Its failure mode is safe, and we measured that.** In the semi-synthetic benchmark the pipeline spoke a wrong label in 0.0-0.8% of dwell frames while the finger touched the panel at 504x896. Every other miss was silence (06-feasibility/panel-reader.md §2.1). Silence plus "move closer" or "tilt down" reads as careful in a demo. `did-i`'s worst failure is a false "stove off", and the meta-judge called that "a home-safety failure attributed to Meta glasses" (`_top5.md` §5).
3. **Under the conditions we control at the table, it already clears the bar.** With a matte panel, the finger touching, 504x896 and a viewing angle under 35°, 7 of 8 sequences scored 90% or more of dwell frames correct (panel-reader.md §2.2). Compute fits easily: hand landmarker 9.9 ms on a 384 crop and ORB 12.7 ms on this Mac. Google lists the landmarker at 17 ms CPU on a Pixel 6 (panel-reader.md §2.5).
4. **Its remaining kill test needs no glasses.** A phone strapped at the temple produces the footage. We can settle the biggest unknown at about 04:00 tonight, before the Meta booth is likely open (booth hours are unknown).
5. **It has the peer-floor moment.** A blindfolded visitor finds "Delicate" on a flat panel by ear. The peer-review gate rewards a stranger getting it in 60-90 seconds (00-rules-and-jury.md §3, §7), and the demo-evaluator scored it highest of all candidates (84).

Why not the others as the starting project:
- **`did-i` is the closest second.** Its spike estimate of working live is 60%, against 55% for `panel-reader`. The spike, though, changed what it is. A VLM comparing two references failed: the local model was position-biased, and a naive prompt said "locked" on 22 of 22 unsafe or not-visible bursts. It now works only with an 8 cm ArUco tag next to each knob, a deterministic comparator and a "glance again" loop (did-i.md §2, §6). It is still a good product, but the demo is quieter and the tag sticker is an unasked UX question for Meta. Its probability lead is 5 points between two estimates, and the panel kill test is cheap. So the better ceiling wins, with `did-i` held ready.
- **`beacon`** depends on beta Motion running at 25 Hz or more alongside the camera. Meta's own BirdSpotter sample runs Motion at 5 Hz under video (beacon.md §1.2). Its GA fallback works only if the user turns slowly (simulation, estimate). Its best idea, guided reach, is already inside our Find mode.
- **`nod`** needs Motion at 10-15 Hz or more with the camera on. It fails always-on (6.2 false "yes" per 5 minutes of conversation) and is viable only prompt-gated (nod.md §2). It has two unverified platform gates.
- **`teardown-memory`** only just reaches 90% in simulation and only with a flat device (90.6%, 95% CI about 83-95%). It also produces 17-25% false alarms in verify, which a peer would see as wrong chimes (teardown-memory.md §3).

**Honest odds (estimates).** About 55% that the live MVP works on real glasses (panel-reader.md §9). If the hour-2 kill test passes, I estimate about 65%. Device access, not computer vision, is the dominant risk, and it is shared by all five concepts (feasibility.md §9). The chance that *something* demonstrable works (real-glasses recordings replayed through Mock Device Kit, plus a head-strapped phone stand-in) is about 90% (estimate, following feasibility.md §9). No candidate reaches the 95% the brief hopes for: all five carry the same device-access risk.

## 2. Picks per objective

| Objective | Pick | Backup | Why |
|---|---|---|---|
| **(1) Meta challenge award** | `panel-reader` + Find | `did-i` | Meta lens 82 vs 76. GA-only. Accessibility exactly as L890/L902 ask. The state machine shows L900's list (permissions, errors, degraded stream, device state). `did-i`'s false-"off" risk is a trust liability on Meta's own C4 criterion |
| **(2) Overall win** (peer top 5, then jury) | `panel-reader` + Find (close call) | `did-i` | Pre-spike, `did-i` led the overall view 73.6 to 70.7 (`_top5.md` §3), and the gap came almost entirely from the engineer's 58 for `panel-reader`. The spikes moved both. `panel-reader`'s compute and wrong-label rate were verified. `did-i`'s VLM core failed and had to be rebuilt around tags. The peer gate weighs the demo most (00-rules §7 tie-break), and the blindfold moment beats the quiet knob reveal. **If you weigh the jury's "AI must earn its place" evidence lens above the peer gate, `did-i`'s 22-of-22 naive-prompt failure is the stronger slide; this pick is within the noise** |
| **(3) Combined** | `panel-reader` + Find | `did-i` | One build serves both: Meta's four 25% criteria overlap with the jury's problem, insight, demo and evidence (00-rules §7) |

## 3. Comparison of the five after the spikes

Pre-spike scores are from `_top5.md` §3. The probability of working live is the spike author's estimate.

| | `panel-reader` + Find | `did-i` | `beacon` | `teardown-memory` | `nod` |
|---|---|---|---|---|---|
| Spike verdict | go-with-changes | go-with-changes | go-with-changes | go-with-changes (reserve) | go-with-changes, conditional |
| Works live (est.) | 55% | 60% | 55% | 50% | 50% |
| GA-only? | Yes | Yes | No (Motion is beta; visual fallback is GA) | Yes | No (Motion is required) |
| Hard assumption as written | Failed pooled (78-86% touching at 504); 7/8 sequences ≥90% under controlled conditions | Failed (0-1.2% false safe but 60-96% "not sure"); fixed with tags | Untestable without a device; simulation favourable | At the edge (90.6% flat device only); 17-25% false alarms | Recall passes (95%); false accepts fail always-on |
| Remaining kill gate | Real head-mounted footage ≥85% correct and ≤3% wrong | Tag + crop on phone bursts: 0 false safe, ≤30-40% not sure | Motion ≥25 Hz with camera, gyro present | Real footage ≥90% (or ≥80% + "not sure") | Motion ≥15 Hz with camera |
| Gate testable without glasses? | **Yes** (head-strapped phone) | **Yes** (phone bursts) | No | Partly | No |
| Wrong-answer cost in a demo | Low (silence dominates) | High (false "off") | Low (wrong can) | Medium (false chimes) | Medium (false "yes") |
| Peer moment | Blindfolded visitor finds a button | Visitor secretly sets the knob | Blindfolded visitor finds the Fanta | Visitor plants an error | Visitor nods to order juice |
| Meta / overall / combined (pre-spike) | 72.2 / 70.7 / 71.9 | 74.7 / 73.6 / 74.1 | 61.7 / 62.0 / 64.0 | 63.9 / 62.5 / 64.5 | 59.6 / 58.0 / 60.9 |
| **My rank after the spikes** | **1** | **2** | 3 | 4 | 5 |

## 4. The recommended project: Panel Reader + Find

### 4.1 User and problem
A blind or low-vision adult with a flat-panel appliance (washer, microwave, induction hob) whose buttons cannot be told apart by touch. Today they rely on a sighted helper, tactile stickers, or a phone app that needs one hand to hold the phone. The glasses keep both hands free and the camera points where the person is looking. The first audience for a pilot (an idea, not a contact) is a national visual-impairment association or rehabilitation instructors. Ask the booth whether Meta has a local accessibility partner (§4.9).

### 4.2 MVP scope (in)
From panel-reader.md §6, cut further for 32 hours:
1. **One platform: iOS**, DAT SDK 1.0.1, camera stream only, no beta capabilities. iOS because the iOS mentor is an engineer (CHALLENGES.md:L925), the spike read the iOS repo and samples (panel-reader.md §2.7), and MediaPipe Hand Landmarker ships for iOS through Swift Package Manager (`MediaPipeTasksVision`) with a VIDEO running mode ([MediaPipe iOS guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/ios), opened). If the team has only Android phones, switch to Android; the DAT SDK is on Maven Central (nod.md §3).
2. **Registration** (needs network): a sharp stream frame (GA) or the phone camera → backend proxy → VLM → JSON `[{label, box}]`. A helper confirms it by reading back on the mirror screen, and the app stores the reference image, ORB features and map on the phone. **Not experimental `Camera.photo`** (photo capture is Experimental in 1.0.0; panel-reader.md §2.7).
3. **Read mode, finger resting on the panel.** Stream at 720x1280 if it holds at 7 fps, otherwise 504x896. ORB homography plus KLT tracking between re-detections. A crop from the homography goes to the hand landmarker, then landmark 8 goes into panel coordinates. 2.5 mm hysteresis and 2-frame confirmation. **The app speaks only stable labels.** Otherwise it says "move closer", "tilt down" or "finger not seen".
4. **Find mode.** The target comes from a phone list (VoiceOver-friendly) or push-to-talk on the **phone's own mic**. The app gives directional guidance every ~0.7 s and says "on it" after 2 stable frames inside the box.
5. **State machine, spoken and on the mirror screen:** unregistered, permission denied, session paused/stopped (hinge fold stops the session; feasibility.md §3), no panel, no hand, degraded stream (resolution dropped), offline (registration unavailable, reading still works), thermal/battery. This covers L900 item by item.
6. **Two matte printed panels:** a washer (buttons 3 cm or larger) and a large-key panel (keys 2.5 cm or larger), on a stand that keeps viewing angles under 35°.
7. **Mirror view** for judges: rectified panel, fingertip dot, current label, state and mode. Cast to a screen.
8. **Consent and data:** no frames leave the phone after registration (one upload, shown on screen), the LED stays on, and the app never stores stream frames. Hand landmarks are not identification (feasibility.md §6), but confirm this at the booth.

### 4.3 Out of scope (explicitly)
- Hover reading. Parallax caps it at 59-72% even with perfect detection (panel-reader.md §2.3).
- Real capacitive appliances in the live demo. Whether a resting finger triggers them is unknown.
- 360x640 as a supported mode. It measured 64-67%; at 360 the app only prompts.
- Ray-Ban Display UI, "Hey Meta, start" voice invocation, Inputs, Speech and Motion (all beta or config-dependent; feasibility.md §3).
- The glasses HFP mic for Find. Turning HFP on moves output off A2DP, and the camera must start after the route settles, or audio "can fail silently" (feasibility.md §3). This is a stretch goal only.
- More than two panels, Android and iOS both, and any claim about efficacy for blind users (we test with blindfolded sighted volunteers).

### 4.4 Architecture

```
[Glasses RBM Gen 2] --DAT 1.0.1 stream (hvc1, 720x1280 or 504x896 @ 7-15 fps)--> [iPhone app, Swift]
  VideoToolbox HEVC decode -> RGB
  PanelLock: ORB vs stored reference (on lock and ~1 s) + KLT corner tracking in between
  Crop from homography (>= 0.7 x frame width, shifted down for the palm) -> 384x384
  MediaPipe Hand Landmarker (VIDEO mode) -> landmark 8 -> panel cm via H
  ControlLookup + 2.5 mm hysteresis + 2-frame confirm -> SPEAK ONLY WHEN STABLE
  FindGuide: target from phone list / phone-mic ASR -> vector -> "right / up / on it"
  Audio: AVSpeech TTS (or cached clips) to glasses over A2DP; edge earcons
  StateMachine: DAT session + permission + device state + stream resolution + tracking quality
  MirrorView -> AirPlay/cast to a screen;  EvalLogger -> per-frame CSV (label, state, timing)
[Backend proxy, TypeScript] key from env -> VLM (Gemini) -> control map JSON; mock provider for offline work
[Eval harness, Python] the spike's scoring code on recorded real-glasses clips with hand labels
```
New dependencies, each to be justified in its PR: DAT SDK (required), MediaPipeTasksVision (hand landmarks), OpenCV iOS framework (ORB, homography, KLT). Apple's Vision hand-pose API could replace MediaPipe, but it has not been tested on this footage (unknown).

### 4.5 The measured baseline comparison we will show
1. **Accuracy on held-out real-glasses clips** (about 300 hand-labelled dwell frames, both panels): correct, wrong and silent rates, plus the same split at 360x640 and on one glossy, steep panel shown as a failure case. The target from the spike is ≥90% correct and ≤1% wrong under the table conditions. We report whatever we measure, including if it is lower.
2. **Find-mode time-to-press, three arms**, with 3-5 blindfolded sighted volunteers, 2 panels and 3 targets each (about 60-90 trials, about 1.5 h, estimate):
   - (a) our Find mode;
   - (b) **Meta AI built-in**: the wearer asks it where the button is, then tries to press. This is run by hand, because DAT does not expose Meta AI to third-party apps (competitive.md, citing vr.org). Whether Meta AI works on glasses in Developer Mode during our session is unknown; ask at the booth;
   - (c) no assistance.
   We measure correct-press rate and time-to-press. **Meta AI's performance is unmeasured today. Do not predict it in the deck.**
3. **Upload counter:** 1 image at registration, then 0 frames during use, compared with a 1 fps cloud-assistant pattern (VisionClaw feeds about 1 fps; competitive.md).

### 4.6 Device-access plan and fallback demo
- **Hour 0-2 (tonight, no device needed):** build CameraAccess against Mock Device Kit with an h265 file (MDK plays h265; feasibility.md §3). Record head-strapped iPhone footage for the kill test.
- **At booth opening (time unknown):** ask the §4.9 questions. Ask for one RBM Gen 2 for long slots, paired to our account and phone. Gen 2 is enough because the product is audio-first and the brief treats audio-first and Display equally (L898).
- **Every device slot: record before developing.** Take 1-2 minute clips of both panels while touching. They become the evaluation set and the MDK replay input (panel-reader.md §5).
- **Pair early, re-check registration before each demo.** Only one third-party app stays registered in Developer Mode, so another team can silently unregister ours (feasibility.md §4).
- **Fallback demo, in order:** (1) live on real glasses; (2) the same app on Mock Device Kit replaying our real-glasses clips; (3) a head-strapped iPhone feeding the same pipeline, **labelled on screen as a stand-in**; (4) a screen recording of the best real-glasses run in the deck.
- **Table set-up:** matte paper panels, a fixed-angle stand, no spotlight glare, a speaker so visitors hear the labels, two charged units if Meta allows.

### 4.7 Tech challenges to stack, with costs (estimates)
| Challenge | Honest use | Extra cost | Notes |
|---|---|---|---|
| **Best Use of Gemini API** | Gemini turns one panel photo into the semantic control map (labels plus boxes). This is the step that makes the reader semantic rather than OCR | About 2 h beyond the proxy we need anyway: prompt, schema, box-quality check on 5 panels, plus the four-point explanation in the submission (CHALLENGES.md:L2490-2498) | **Every member must be 18 or older** (L2518). Credits by form (L2512-2514). Whether Gemini boxes are good enough is unverified (panel-reader.md §3 item 4) |
| **Best Use of Codex** | Codex as part of the development process (L2434) | About 1 h: real use on some issues plus a write-up | Prize is API credits (L2458). Judging criteria are only prose (_tech-challenges.md) |
| ElevenLabs (optional) | Pre-render each control's label once at registration, so read mode plays cached clips offline with no TTS delay | About 1.5 h; phone TTS stays as the fallback | Fit is marginal. Skip it if we are behind at hour 16 |
| Skip | Gemma (on-phone speed unknown), Modal and Verda (no compute need), Nemotron (conflicts with Gemini as the core VLM), database challenges (state lives on the phone) | n/a | |

### 4.8 Three-minute pitch, mapped to the juror lenses
Timing follows the PDF template (00-rules-and-jury.md §6). No invented user interviews or results.
| Time | Beat | Lens served |
|---|---|---|
| 0:00-0:20 | **User and problem:** flat touch panels are unreadable by touch. Today's options are a helper or a phone held in one hand | Kia, Otto, Umar (worthwhile problem) |
| 0:20-0:35 | **Insight:** register once with a VLM, then read offline with geometry. The label comes from the map, not from OCR of the covered key, so the finger can sit on the button | Beer, Timo (one non-obvious insight) |
| 0:35-1:35 | **One complete demo:** register a panel, read by touch, then Find "Delicate" with a blindfolded volunteer. Show one state change live (fold the hinge, the app says so and recovers) | All jurors; Meta L900 |
| 1:35-2:00 | **Baseline and a limit:** correct/wrong/silent table on held-out real clips; time-to-press against Meta AI and no assistance; one failure case (glossy, steep panel → silence plus "tilt down") | Daksh, Arturs (baseline, failure rates) |
| 2:00-2:25 | **Hardest decision:** silence over guessing, touching over hovering (parallax measured), crop from the homography (hand detection rose from 57% to 85-90%) | Beer, Arturs |
| 2:25-2:45 | **Next user:** a pilot with a visual-impairment association; why they return (every appliance, every day) | Otto, Umar, Kia |
| 2:45-3:00 | **Next step:** a shared control-map library per appliance model, so registration happens once per model, not once per home. This is an idea, not a measured result | Timo, Arturs |

### 4.9 Questions for the Meta booth (Amanda Le, Dennis Punjabi) before writing more than the shell
1. How are the 20 units allocated? Can we keep one RBM Gen 2 overnight and through Sunday judging (feasibility.md §10 Q1)?
2. Can we pair a unit to our own Meta account and iPhone, or must we use Meta's phone (Q2)?
3. Firmware and Meta AI app versions: are they at V128 and V292 or later, as SDK 1.0.1 needs (feasibility.md §4)? Is Developer Mode on?
4. Will other teams' registrations overwrite ours on shared glasses (one third-party app in Developer Mode)?
5. Is camera streaming enabled for these accounts in Finland, or should we expect `CAPABILITY_DENIED`?
6. **What resolution and fps do teams actually get in the hall?** Does 720x1280 or 504x896 at 7 fps hold, or does it drop to 360x640?
7. **Does the built-in Meta AI still answer on glasses running our Developer Mode app?** We need it as the baseline arm.
8. Are printed mock panels acceptable for judging, or do judges expect a real appliance?
9. Is a hand-landmark model on the phone fine under the AUP (detection, not identification)?
10. How do Meta's judges see the demo: wearing the glasses, our mirror screen, or a video? Is Gen 2 only acceptable, or do they expect Display?
11. Does Meta have an accessibility partner or a blind tester we could ask for 15 minutes of feedback?

### 4.10 Plan for 32 hours (A = mobile/DAT, B = CV pipeline, C = registration, evaluation, pitch)
Hour 0 is about Sat 02:00.
| Hours (wall clock) | A | B | C |
|---|---|---|---|
| 0-2 (02-04) | Build CameraAccess on MDK with h265; app shell | Print matte panels; **record head-strapped footage; kill test** | Label ~200 dwell frames; VLM proxy with a mock |
| **Gate at hour 2** | **≥85% correct and ≤3% wrong → continue. Otherwise → `did-i` (§5)** | | |
| 2-8 (04-10) | Session, permissions, state machine; booth questions when it opens; first device slot: log resolution, fps, FOV, record clips | Port to iPhone: decode, ORB, crop, landmarker, stable label | Gemini registration prompt and schema, tested on 5 panel photos; confirm flow |
| **Gate at hour 8 (~Sat 10:00)** | **Same thresholds on the first real-glasses clip. Last point to switch** | | |
| 8-14 | Mirror/cast view; TTS route; degraded-stream and hinge handling | KLT tracking; prompts from inliers and angle; Find mode | Evaluation harness on real clips; baseline protocol; recruit volunteers |
| 14-20 | Sleep in shifts (one person awake, devices charging) | | |
| 20-25 | Second device slot: end-to-end on glasses; record held-out clips | Tune on real clips; freeze the pipeline at hour 24 | Run the three-arm time-to-press trials |
| 25-29 | Demo hardening on the MDK replay path; backup video | Bug fixes only | Deck; Gemini and Codex write-ups |
| 29-32 (07-10 Sun) | Rehearse the 60-90 s peer script and the 3-minute pitch; **submit by 10:00** | | |

## 5. The backup: Did I? (in brief)

- **MVP** (did-i.md §6): two props (a large high-contrast knob and a deadbolt thumb-turn on a board), each with an 8 cm ArUco tag. Setup records OFF and ON references per tag. A phone gate keeps the sharpest frame only while a tag is visible. The backend warps the frame using the tag, crops the region and runs a deterministic two-reference comparator (ZNCC plus pointer angle). A cloud VLM on the crops, run in both reference orders, must agree; otherwise the answer is "not sure, glance again". The verdict and a thumbnail are kept for 24 h. Query by phone button or voice. A visible state machine. **If the cloud VLM check fails, ship the comparator alone.**
- **Out of scope:** automatic hand-on-object detection, Pot Watch, Display cards, the beta Inputs tap as the only trigger.
- **Architecture:** the same iPhone DAT shell, state machine, mirror view and backend proxy as §4.4. New parts are on-phone ArUco detection and a Python verifier service.
- **Baseline:** 100 or more held-out prop bursts, ours against the naive single-image prompt, reporting false safe and not sure. The spike's naive result was 22 of 22 false "safe", including 5 of 5 clearly unlocked (did-i.md §2).
- **Device plan:** record props through real glasses in one slot, then replay through MDK `setCameraFeed(fileURL:)`. The bystander-sets-the-knob demo works in every path (did-i.md §5).
- **Tech challenges:** Gemini API as the cross-checked second opinion on crops (about 2 h, 18+ rule applies); Codex (about 1 h).
- **Pitch:** autopilot and ADHD forgetfulness, not checking OCD. "Not sure" is the first feature shown. Tag-scoped capture, 24 h retention and an upload counter as the consent story (`_top5.md` §5; CHALLENGES.md:L902).
- **Extra booth questions:** is a tag sticker acceptable UX for Meta's judges? Does `Camera.photo` work on the loaner firmware, and how long does a transfer take (did-i.md §3)?
- **Its own kill gate** (did-i.md §8): if tag plus crop on phone bursts of our own props still gives any false "off" or "locked", or not-sure above about 40%, reduce to the knob prop only with a pointer-angle comparator.
- **If we switch at hour 2-8:** reuse A's shell and C's proxy and harness. B moves to the comparator. With about 24-30 hours left, follow did-i.md §7 compressed by about a quarter (estimate).

## 6. Remaining risks, stated plainly
1. **Device access can sink any choice.** There are 20 shared units for the whole event, the allocation rules are unknown, glasses pair to one account at a time, another team can overwrite our Developer Mode registration, and `CAPABILITY_DENIED` or country gating in Finland is unknown (feasibility.md §4, §9). Mitigation: record in every slot and keep the MDK replay path working.
2. **Real head-mounted footage may score below the composites.** The composites have no real shadows, no arm and no rolling shutter (panel-reader.md §3). This is the hour-2 gate.
3. **The stream may drop to 360x640 in the hall.** That measured 64-67% correct, mostly as silence (panel-reader.md §2.1). Demo effect: more "move closer" prompts and fewer labels.
4. **The real stream FOV and bitrate are unknown.** The 100° FOV is an estimate from a product page the spike did not open.
5. **Gemini box quality for registration is unverified** (no key during the spikes). A helper confirmation and manual box fix-up on the mirror screen is the fallback.
6. **The Find-mode guidance UX is untested.** Its accuracy is bounded by read mode, but the phrasing and rate are guesses until volunteers try it.
7. **The Meta AI baseline may not be runnable** on Developer Mode glasses, and its accuracy is unknown. If it cannot be run, show the no-assistance arm only and say so.
8. **The product claim is narrow.** It works on matte panels, finger touching, keys 2.5 cm or larger, viewing angles under 35°. Glossy panels at steep angles measured 12-64%. Real capacitive panels may react to a resting finger (unknown). Say this in the deck.
9. **Apple's Point and Speak** already does fingertip reading on Pro iPhones (`_top5.md` §5). Our difference is hands-free operation, a semantic registered map, and Find mode. A juror who knows Apple's feature will ask.
10. **Time.** About 32 hours remain, not 40, and the booth may not be staffed until morning (unknown). The switch window closes at about Sat 10:00.
11. **No blind users have tested this.** All evaluation uses blindfolded sighted volunteers. Claim nothing about blind users' outcomes.

## Sources
- CHALLENGES.md:L878-946 (especially L890, L896, L898, L900, L902, L925, L934-937); tech challenges L2434, L2490-2498, L2512-2518.
- `00-rules-and-jury.md` §2-§7; `01-challenge-intelligence/_tech-challenges.md`; `02-research/ai-glasses/{feasibility,competitive,opportunity}.md`; `01-challenge-intelligence/ai-glasses.md`.
- `05-evaluation/_top5.md`; `06-feasibility/{panel-reader,did-i,beacon,teardown-memory,nod}.md`.
- [MediaPipe Hand Landmarker for iOS](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/ios), opened for this report: SPM product `MediaPipeTasksVision`, IMAGE/VIDEO/LIVE_STREAM modes.
- The time remaining comes from the system clock (Sat 14 Nov 01:37 EET) and the schedule in 00-rules-and-jury.md §2.
- All probabilities, hour budgets and costs in this file are estimates.

<!-- complete -->
