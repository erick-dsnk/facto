# Feasibility spike: Panel Reader + Find (`panel-reader`)

**Summary**
- **The assumption fails as written.** The test asked whether the on-phone fingertip plus homography pipeline names the right control in at least 90% of frames, touching or hovering, at both 504x896 and 360x640, at 7 fps or more. In a semi-synthetic benchmark (real egocentric hands composited onto printed panels, with H.265 at a guessed Bluetooth bitrate), no pooled condition reached 90%. The best result was a finger touching the panel at 504x896: 78% of dwell frames correct on the washer panel and 86% on the microwave keypad (90% at 15 fps). Hovering 1 cm above the panel scored 52-66%, and 360x640 scored 64-67%.
- **The failures are mostly silence, not wrong answers.** With the finger touching at 504x896, the pipeline spoke a wrong label in 0.0-0.8% of dwell frames. The rest of the misses were frames where it said nothing. Two things cause the silence. First, a strong reflection on the panel combined with a steep viewing angle (more than about 35°) breaks hand detection or the homography. Second, hovering creates parallax: a fingertip 1 cm above the panel projects onto the wrong control in 28-41% of frames even with perfect detection. **With no reflection, touching, at 504x896, 7 of 8 sequences reached 90% or more** (washer 100/100/100/97%, microwave 100/100/79/97%).
- **Speed is not a risk.** On this Mac (one thread) the hand landmarker on a 384x384 crop took 9.9 ms and ORB homography took 12.7 ms at 504x896. Google lists the landmarker at 17 ms CPU on a Pixel 6. 7 fps is easy and 15 fps is likely (estimate). On real egocentric pointing video, detection at glasses-stream resolution kept 93-94% of the detections made at native resolution.
- **Verdict: go-with-changes.** Build a version where the finger rests on the panel, the stream is 504x896 or higher, the app stays silent when unsure, and the user is told to "move closer" or "tilt down" when tracking drops. Demo on matte printed panels with large buttons. Treat hover as a stretch goal. In hour 1, re-run this harness on real head-mounted footage; that is the remaining kill test.

---

## 1. What I ran

All code and downloads are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/panel-reader/`. Nothing was written to the repository apart from this file.

| Script | What it does |
|---|---|
| `cutouts.py` | Extracts 24 real egocentric pointing-hand cutouts (RGBA plus 21 landmarks) from [EgoGestAR](https://github.com/varunj/EgoGestAR) test videos (640x480, head-mounted, several users, skin tones and lighting conditions). It uses GrabCut seeded by MediaPipe landmarks. I excluded 4 with bad masks or two raised fingers, leaving 20 |
| `panels.py` | Two printable panels. **Washer:** 33x6.2 cm, 6 program buttons of 3.2x1.8 cm and 5 option buttons of 3.6x1.6 cm, with a display. **Microwave keypad:** 8.4x14.4 cm, 12 keys of 2.0x1.2 cm with 0.4 cm gaps (the hard case), 4 function keys and a display |
| `sim.py` | Renders a head-mounted camera view. The FOV is a 100° diagonal (estimate, see §4), the distance is 35-55 cm and the downward viewing angle is 15-50°. The script adds head jitter and roll, a real hand cutout whose **touch point** (from the mask silhouette, independent of MediaPipe) sits on a scripted finger path (moves of 0.5-1 s, then dwells of 0.8-1.8 s), touching (h = 0) or hovering (h = 1 cm, with true 3D parallax), gain and tint changes, a specular reflection on the panel in half of the sequences, motion blur and noise. It then round-trips the whole clip through **x265 at 1.2 Mbps (504x896) or 0.7 Mbps (360x640)**. These bitrates are an estimate, because DAT does not document its bitrate |
| `run_eval.py` | The on-phone pipeline. (1) An ORB (or SIFT) homography to a clean 720x1280 registration frame, with hand features masked. (2) A crop centred on the panel from that homography, upscaled to 384x384. (3) The MediaPipe Hand Landmarker (`hand_landmarker.task` float16, VIDEO mode) on the crop. (4) Landmark 8 mapped into panel cm and looked up in the control map. (5) A stable label using 2.5 mm hysteresis plus 2-frame (7.5 fps) or 3-frame (15 fps) confirmation. It runs at 15 fps and 7.5 fps |
| `summarize.py`, `outcomes.py`, `decompose.py`, `posthoc.py`, `calib.py` | Scoring, splitting dwell frames into correct, wrong and silent, splitting error by source, hover-parallax correction and calibration fitting |
| `real_ego.py` | MediaPipe on 20 **real** EgoGestAR egocentric videos, downscaled to glasses-stream pixel density |
| `timing.py` | Single-thread per-stage latency |

The benchmark covers 2 panels x 2 resolutions x touch/hover x 8 sequences of 20 s, which is 64 sequences and 19,200 frames per frame rate. The final numbers below come from run 3 (`work/results3_orb.json`). Run 1 had noisy ground truth from MediaPipe landmarks. Run 2 applied the reflection on top of the hand, which is unrealistic. Both are superseded.

### Sample of what the pipeline saw
Rendered frames: `work/render_check.jpg`. Ground truth against detection crops: `work/bias_check.jpg`. Ground-truth touch points: `work/touch_gt.jpg`. All are in the scratchpad.

## 2. Measurements

### 2.1 Headline: dwell frames correct / wrong label / silent (run 3, ORB, 7.5 fps)
A dwell frame is one where the finger rests on a control for more than 0.4 s, i.e. when the user expects to hear its name.

| Panel | Res | Touching | Hovering 1 cm |
|---|---|---|---|
| Washer (3.2-3.6 cm buttons) | 504x896 | **78.0 / 0.0 / 22.0** | 56.1 / 0.9 / 42.9 |
| Washer | 360x640 | 64.0 / 0.2 / 35.8 | 52.0 / 1.1 / 46.9 |
| Microwave (2.0x1.2 cm keys) | 504x896 | **85.5 / 0.8 / 13.6** (15 fps: 89.9 / 0.3 / 9.8) | 66.0 / 7.9 / 26.1 |
| Microwave | 360x640 | 66.6 / 1.0 / 32.4 | 55.4 / 1.4 / 43.2 |

Median position error, touching at 504x896: **0.27 cm** (p90 0.82) on the washer and **0.25 cm** (p90 0.61) on the microwave. The frame rate barely matters: 7.5 fps and 15 fps are within about 4 points of each other.

### 2.2 What drives the failures (per sequence, touching, % of dwell frames correct)

| Seq | Distance, angle, reflection | Washer 504 | Washer 360 | Microwave seq: distance, angle, reflection | Mic 504 | Mic 360 |
|---|---|---|---|---|---|---|
| 0 | 38 cm, 30°, no | 100 | 100 | 48 cm, 21°, **yes** | 98 | 77 |
| 1 | 54 cm, 22°, no | 100 | 100 | 42 cm, 15°, no | 100 | 100 |
| 2 | 54 cm, 30°, no | 100 | 100 | 46 cm, 32°, **yes** | 100 | 69 |
| 3 | 40 cm, 29°, no | 97 | 92 | 51 cm, 17°, no | 100 | 100 |
| 4 | 45 cm, 36°, **yes** | 64 | 43 | 43 cm, **48°**, **yes** | 27 | 0 |
| 5 | 39 cm, 34°, **yes** | 33 | 17 | 49 cm, 17°, no | 79 | 90 |
| 6 | 45 cm, **47°**, **yes** | 40 | 11 | **55 cm**, 39°, no | 97 | 0 |
| 7 | 36 cm, 22°, **yes** | 81 | 33 | 45 cm, 26°, **yes** | 91 | 92 |

- **No reflection, touching, 504x896: 7 of 8 sequences at 90% or more.** This is the condition we can control in a demo.
- A reflection on a glossy panel plus a viewing angle of more than about 35° is the main failure mode. 360x640 loses the small microwave panel entirely at 55 cm and 39°, because there are too few ORB inliers.

### 2.3 Error by source (dwell and transit frames on a control, 7.5 fps)

| Condition | Hand and homography both available | Accuracy when both available | Fingertip only (true H) | Homography only (true tip) | Parallax-only ceiling |
|---|---|---|---|---|---|
| Washer 504 touch | 90.3% | 90.0% | 92.6% | 95.9% | 100% |
| Microwave 504 touch | 89.6% | 89.6% | 95.9% | 93.9% | 100% |
| Washer 360 touch | 77.7% | 83.4% | 88.3% | 90.4% | 100% |
| Microwave 360 touch | 72.3% | 79.1% | 91.9% | 84.6% | 100% |
| Washer 504 hover | 88.6% | 59.8% | 60.0% | 70.0% | **72.5%** |
| Microwave 504 hover | 87.4% | 59.6% | 60.4% | 62.2% | **59.2%** |

Reading this table:
- **Touching:** availability (about 10% of frames with no hand or no panel lock) and the accuracy of what remains (about 10% wrong at control boundaries during moves) contribute roughly equally. The dwell-only figures in 2.1 are cleaner because the hysteresis absorbs the boundary errors.
- **Hovering:** parallax is a geometric limit. At a 15-50° viewing angle, a fingertip 1 cm above the panel projects 0.3-1.2 cm away from the point beneath it. I tried a correction that recovers the camera centre from the estimated homography and assumes a hover height. With one global height fitted on 4 sequences and tested on the other 4, microwave hover at 504 improved from 45% to 62% on the test sequences. That is real but not enough (`calib.py`). Hover is therefore not viable for small keys without depth.

### 2.4 Detecting real egocentric hands at stream resolution (`real_ego.py`)
These are 20 real head-mounted pointing videos (1,278 frames with a hand found at native 640x480), downscaled, full frame, with no crop.

| Width | Native detections kept | Tip disagreement with native (px at that res) | Frame-to-frame jitter (2nd difference / 2) |
|---|---|---|---|
| 360 | 92.9% | median 0.43, p90 1.45 | median 0.72, p90 1.85 |
| 504 | 94.1% | median 0.39, p90 1.62 | median 1.03, p90 2.67 |

The landmark itself is stable at low resolution. At 504x896 and 45 cm, 1 cm is about 9.6 px with the assumed FOV, so 1 px of jitter is about 1 mm. **The weak link is the palm detector finding a small hand, not landmark precision.** On the full frame, the composited hands were found in only 57% of washer frames in run 1 (`results_orb_full.json`, 3 sequences per condition). The crop around the panel raised that to 85-90%. So the crop from the homography is a required design element, not an optimisation.

### 2.5 Latency (`timing.py`; this Mac, M3 Max, OpenCV one thread)

| Stage | 504x896 | 360x640 |
|---|---|---|
| ORB homography (detect, match against 4,000 reference features, RANSAC) | 12.7 ms (p90 13.4) | 9.8 ms |
| SIFT homography | 29.6 ms | 13.8 ms |
| Hand Landmarker, VIDEO mode, 384x384 crop | 9.9 ms | 10.0 ms |

Google's published figure for the Hand Landmarker is 17.12 ms CPU and 12.27 ms GPU on a Pixel 6 ([MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)). ORB on a phone is unknown; my estimate is 20-40 ms. The budget at 7 fps is 143 ms per frame, so compute is not a constraint (estimate). Glasses-to-phone stream latency is **unknown**, and feasibility.md §5 says it is undocumented.

### 2.6 SIFT instead of ORB (touching only, `results3_sift.json`)
SIFT was better on the washer at 504 (83.6% of dwell frames correct, against 78.0% for ORB) and worse on the microwave and at 360 (30-39%), because of the scale gap to the 720x1280 reference. Neither is a fix. ORB stays the default; the improvement to make is optical-flow tracking between re-detections (§5).

### 2.7 Meta Wearables DAT SDK
- The SDK is public. The iOS repo has moved to [github.com/meta/meta-wearables-dat-ios](https://github.com/meta/meta-wearables-dat-ios) (as has Android). I cloned it. It contains the `CameraAccess`, `DisplayAccess` and `BirdSpotter` samples, `.claude-plugin` and `install-skills.sh`. The sample pins SDK **1.0.1** (`CameraAccess.xcodeproj`, `kind = exactVersion; version = 1.0.1`).
- The CameraAccess sample streams with `VideoCodec.hvc1`, `StreamingResolution.low` and `frameRate: 24`, and decodes HEVC sample buffers in `Media/VideoFrameDecoder.swift` (`samples/CameraAccess/CameraAccess/ViewModels/CameraViewModel.swift` L280-287). Our app needs the same decode step before MediaPipe.
- **Photo capture (`Camera.photo`) is marked [Experimental] in 1.0.0** (repo `CHANGELOG.md`), and "apps using them cannot be published yet". Registration should therefore use a sharp **stream frame** (GA) or the **phone camera**, with photo capture as an option.
- **Simulator build: not run.** The environment's permission policy blocked `xcodebuild` on downloaded code. This is **unverified**.

## 3. What worked, what failed, what is unverified

**Worked (measured):**
- Panel lock with ORB homography on printed, labelled panels: median error 0.65 mm (washer) and 0.85 mm (microwave) at 504x896 when locked.
- Fingertip position after mapping: median 2.5-2.7 mm while touching.
- A wrong spoken label is rare (≤1%) while touching, on both panels. Most misses are silence.
- 7 fps is enough, and 7.5 against 15 fps changes little.
- Real egocentric hands are detected at stream resolution (93-94% kept).

**Failed (measured, semi-synthetic):**
- The ≥90% bar, pooled, in every condition.
- Hovering at 1 cm, because of parallax (ceiling 59-72% even with perfect detection).
- 360x640 on a small panel or at a steep angle.
- Strong specular reflection plus a viewing angle above 35°.
- Hand detection on the full frame. The crop around the panel is required.

**Unverified. What the team must do on site:**
1. **Real footage (the remaining kill test, hour 0-2).** Strap a phone at the temple, look down at a printed panel at 35-50 cm, record 2 minutes at 504x896 while touching, run `run_eval.py`-style scoring with about 200 hand-labelled frames, and check for 90% or more of dwell frames at under 2% wrong. Composites have no real shadows, no real arm and no rolling shutter. Those effects could make the result better or worse.
2. **Real glasses camera:** the actual FOV and crop of the 504x896 stream. The 100° diagonal is the Ray-Ban product figure as reported in search results; I did not open the page, so treat it as an estimate. Also the actual delivered resolution and frame rate in the hall, given automatic Bluetooth degradation (feasibility.md §3), and the HEVC bitrate. Measure with the CameraAccess sample in the first device slot.
3. **The SDK builds and runs with Mock Device Kit and an h265 file.** Run `xcodebuild` on CameraAccess with Xcode 26.4+ (feasibility.md §2) on a team laptop.
4. **VLM registration quality:** whether Gemini or Claude returns correct boxes and labels for a 504x896 or 720x1280 panel frame. This needs an API key. Test on 5 panel photos and require every box to contain its label.
5. **The Meta AI baseline** ("which button is Delicate?") and **time-to-press**, measured against us. These need glasses and a person.
6. **Find-mode guidance quality.** It reuses the same tracked point, so its accuracy is bounded by §2.1, but the spoken-direction UX is untested.
7. **Real capacitive panels:** whether a resting or sliding finger triggers buttons (the investor's concern in `_top5.md` §5). This is unknown. The demo uses printed panels.
8. Whether `StreamingResolution.high` (720x1280) holds at 7 fps in the hall. If it does, it should push the 504 results further toward the "no reflection" numbers (estimate).

## 4. Architecture I would build

```
[Glasses camera] --DAT stream (request 720x1280 or 504x896 @ 7-15 fps, hvc1)--> [Phone app, one platform]
   VideoToolbox / MediaCodec HEVC decode -> RGB
   1. Panel lock: ORB vs the stored reference on lock and every ~1 s; KLT optical flow on panel corners in between
      (removes most of the "no panel" dropouts; untested here, so treat it as an estimate)
   2. Crop from the homography: panel box widened to >= 0.7 x frame width and shifted down to include the palm, -> 384x384
   3. MediaPipe Hand Landmarker (VIDEO mode) on the crop -> landmark 8 (touch point) and landmark 5 (finger direction)
   4. Touch point -> panel cm through H; optional parallax correction (camera centre from H) for hover
   5. Control lookup + 2.5 mm hysteresis + 2-frame confirmation; SPEAK ONLY WHEN STABLE, otherwise stay silent
   6. TTS to the glasses speakers (A2DP); edge earcon when crossing out of a control
   Find mode: target from speech ("Delicate") -> vector touch point -> target centre in panel axes ->
              "right... up... on it" every ~0.7 s, "on it" after 2 stable frames inside the box
   State machine (spoken plus on the mirror screen): unregistered / permission denied / session paused or stopped /
              no panel -> "move closer" or "tilt down" (inliers < 15 or angle > 35 deg estimated from H) /
              no hand -> "finger not seen" / tracking / degraded stream (resolution dropped) / thermal or battery
Registration (once per appliance, needs network): sharpest stream frame (GA) or phone photo -> backend proxy -> VLM
   -> JSON [{label, box}] -> read back to the user and confirmed by a helper -> reference image, ORB features and map stored on the phone
Mirror view for judges: rectified panel map, fingertip dot, current label, state; cast to a screen
Evaluation harness: this spike's scoring code on recorded clips with hand-labelled ground truth, plus a Meta AI baseline log
```

The design rules come straight from the measurements:
- 504x896 is the minimum and 720x1280 is preferred.
- The finger rests on the panel; it does not hover.
- Silence is better than a guess.
- The crop from the homography is required.
- Prompt for distance and angle (35-45 cm, viewing angle under 35°).

## 5. Fallback demo path if devices only come in short slots
1. **Every slot:** record 1-2 minute clips from the real glasses (CameraAccess has a record function) of both printed panels while touching. These become (a) the evaluation set and (b) Mock Device Kit h265 input. Mock Device Kit plays h265 files (feasibility.md §3), so the full app, including the state machine toggles, runs with no glasses.
2. **Live at the table without glasses:** a head-strapped phone using its own camera feeds the same pipeline. The rest of the app (mirror, speech, Find) is unchanged. Say plainly that this is the stand-in.
3. **Deck:** a screen recording of the best real-glasses run, plus the measured table (correct, wrong and silent, against the Meta AI baseline).
4. **Lighting control at the table:** matte paper panels, no overhead spotlight reflection, and a stand that holds the panel at a fixed angle so viewing angles stay under 35°. All of these come straight from §2.2.

## 6. Revised MVP
- **Platform:** one platform (whichever phones we own), DAT camera stream only, no beta capabilities. Registration from a stream frame or the phone camera, not experimental photo capture.
- **Panels:** two **matte printed** panels. One is a washer (buttons 3 cm or larger, gaps 0.6 cm or more). The second panel's keys should be **2.5 cm or larger**, not 2.0x1.2 cm. That matches common appliance touch panels better than a tiny keypad (estimate) and keeps us in the measured success region.
- **Read mode while touching** (the finger rests on or slides along the panel). The app speaks only stable labels and gives the "move closer" and "tilt down" prompts.
- **Find mode:** spoken target, then directional guidance, then "on it".
- **State machine** as in §4, shown on the mirror screen. It covers permission, paused/stopped, degraded stream, no panel, no hand, thermal and battery (CHALLENGES.md:L900 asks for these explicitly).
- **Evidence** (CHALLENGES.md:L934-937; jury lens in 00-rules §6):
  - Correct, wrong and silent rates on held-out real-glasses clips (about 300 labelled frames).
  - Find-mode time-to-press against Meta AI's spoken answer, with 3-5 sighted, blindfolded volunteers. Do not claim results for blind users.
  - One failure case shown honestly: a glossy, steep panel, with the speak-only-when-confident rule visible.
- **Cut:** hover reading (stretch, with parallax correction), more than two panels, on-glasses Display output, and voice invocation.

## 7. Forty-hour outline for three people
A = mobile/DAT, B = CV pipeline, C = registration, evaluation and pitch. The hours are relative to the start of the build. Junction's actual window is Fri 19:30 to Sun 10:00, about 38.5 h (00-rules §2), so compress the last block if needed.

| Hours | A (mobile / DAT) | B (CV pipeline) | C (registration, evaluation, pitch) |
|---|---|---|---|
| 0-2 | Booth: allocation, pairing and versions (feasibility.md §10); build CameraAccess, Mock Device Kit with an h265 file | **Kill test:** head-strapped phone footage of the printed panels, scored with the spike harness | Print matte panels (washer plus a large-key panel); label 200 frames |
| 2-4 | First device slot: log the real stream resolution, fps and FOV; record clips | Port the pipeline to the phone: HEVC decode, ORB, crop, MediaPipe | VLM registration prompt and JSON schema behind a backend proxy; test on the recorded frames |
| 4-8 | App shell: session, permissions, state machine skeleton, TTS route | Homography plus KLT tracking; hysteresis and stable label; on-device latency logging | Control-map confirmation flow; mock VLM for offline work |
| 8-12 | Mirror/cast view: panel map and fingertip dot | Move-closer and tilt prompts from inliers and angle; finger-not-seen state | Evaluation harness on real clips: correct, wrong and silent |
| 12-16 | Sleep (stagger) | Find mode: vector, phrasing, rate limiting | Sleep (stagger) |
| 16-20 | Second device slot: end-to-end on glasses; record evaluation clips | Tune on the real clips (crop size, thresholds) | Meta AI baseline protocol; recruit 3-5 blindfolded volunteers |
| 20-24 | Robustness: paused/stopped, link loss, CAPABILITY_DENIED, thermal | Sleep (stagger) | Run the baseline and time-to-press sessions |
| 24-28 | Sleep (stagger) | Edge earcons; optional hover parallax correction (stretch) | Deck draft: problem, insight, demo, evidence, limits, pilot |
| 28-32 | Demo hardening on the Mock Device Kit replay path | Freeze the pipeline; final held-out evaluation numbers | Demo video recorded from the real-glasses run |
| 32-36 | Table setup: panel stand, lighting, speaker | Bug fixes only | Deck final; 60-90 s peer-table script |
| 36-40 | Rehearse, submit, staff the table | Rehearse | Submit (deadline Sun 10:00) |

## 8. Objectives
- **(1) Meta challenge award:** still the strongest fit for the brief if the hour-0 kill test passes. It is GA-only, offline after registration, accessibility-first and shows its state handling (CHALLENGES.md:L900, L902). The "speak only when sure" rule plus measured wrong-label rates is a good trust story for C4.
- **(2) Overall win:** the demo is strong (a blindfolded peer finds "Delicate"), and the measured correct/wrong/silent table is the baseline-and-failure evidence the jury asks for (00-rules §6-7). The risk is a live failure under hall lighting, so control the table set-up.
- **(3) Combined:** unchanged from `_top5.md` §7. If the kill test on real footage misses (under 85% of dwell frames correct or over 3% wrong with touch at 504x896, a threshold I set), switch to `did-i`.

## 9. Verdict
**Go-with-changes.** The core is buildable and fast enough. The finger lands within about 3 mm of the right point while touching, and the pipeline rarely says the wrong thing. It reaches 90% or more of dwell frames only under conditions we can arrange (touching, 504x896 or higher, matte panel, viewing angle under 35°). It does not reach it for hover or 360x640. Narrow the MVP to those conditions, design for silence over guessing, and re-run this harness on real head-mounted footage in hour 0-2 before anyone commits further.

Estimated probability that the revised demo works live: about 55%. This is an estimate. The device and booth risks from feasibility.md §9 dominate; the CV risk under controlled table conditions is secondary.

Sources: CHALLENGES.md:L878-946; `02-research/ai-glasses/feasibility.md`; `05-evaluation/_top5.md`; `04-ideas/_candidates.md`; `00-rules-and-jury.md`; [EgoGestAR](https://github.com/varunj/EgoGestAR); [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker); [meta-wearables-dat-ios](https://github.com/meta/meta-wearables-dat-ios) (CHANGELOG, CameraAccess sample, read locally).

<!-- complete -->
