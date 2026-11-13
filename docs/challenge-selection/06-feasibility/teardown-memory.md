# Feasibility spike: Teardown Memory + Step Check scoreboard (`teardown-memory`)

**Summary**
- **The hard part only just passes, and only in simulation. It passes only if we constrain the props.** I built a synthetic head-mounted renderer and ran our perception pipeline on its HEVC-compressed output: 504x896 at 7 fps, head random walk, glances, motion blur, a hand with a shadow, lighting drift, 300 kbps and 1000 kbps. The naive before/after diff assigned **36%** of removals correctly. The improved pipeline reached **80-88%**. With a fingertip-guided local threshold it reached **90.6% (87/96)**, but only on a flat device 15 mm tall. On a 40 mm-tall device it reached **75%**. Tray-cell assignment is solved: **97-100%** once tray cells are coloured.
- **ArUco is not the bottleneck.** Markers decode at 40-60 cm with a median homography error of **0.7-0.9 mm**. When the diff finds the right blob, the median location error is **1.2 mm** (p90 2.7 mm). Failures come from three things: part-versus-background contrast (black screw on a dark board), parallax from device height, and the hand gate.
- **The seeded-error scoreboard is credible on "caught" but weak on false alarms.** It caught 36/36 seeded errors (168/168 in the larger sweep). But **17-25% of correct reassembly steps were falsely flagged**, mostly because an earlier mis-recorded removal propagates (the senior engineer's objection, confirmed).
- **Unverified:** everything that needs glasses or keys. That covers real DAT stream quality and bitrate, the real stabilisation crop and FOV, the real hand detector, the async LLM labels, and building the DAT sample app (the build was blocked in this environment).
- **Verdict: go-with-changes (estimate 50% that the live demo works).** It is buildable only as a constrained demo: a flat, light-coloured device with markers on the device itself, a coloured tray, parts that contrast with the device, and a "not sure, confirm?" state. It stays a reserve behind `did-i` and `panel-reader` unless a 2-hour real-footage test on day 1 reproduces at least 90%.

---

## 1. Question tested

From `05-evaluation/_top5.md` §6.4: *With a head-mounted camera at 504x896 and 7 fps and natural head motion, do ArUco registration and hand-out diffs assign at least 90% of removals of parts 1 cm or larger to the correct device location and tray cell at 40-60 cm?*

Platform facts the test was built on:
- The stream sizes are 720x1280, 504x896 and 360x640. `.medium` = 504x896. Frame rates are 2, 7, 15, 24 and 30. "Lower resolution and frame rate yield higher visual quality due to less Bluetooth compression." Codecs are `.raw` or `.hvc1`. Source: `plugins/mwdat-ios/skills/camera-streaming/SKILL.md` in the public [facebook/meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios) repo (v1.0.1 badge), which I cloned.
- The glasses "crop the sensor image to a 9:16 frame". "Stabilization moves each frame to counter small head movements". "The SDK does not report intrinsic camera parameters". Frames arrive undistorted. The stream is HEVC ([camera-stream-processing guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing), opened).
- The photo camera is listed as 12 MP with a **100° field of view** (Ray-Ban product page, via web search). The **stream's** FOV after the 9:16 crop and stabilisation is **unknown**. I estimated a 56-71° horizontal FOV for the portrait stream from the 100° figure, assuming that is the diagonal of a 4:3 sensor (estimate), and tested both ends.
- The real stream bitrate over Bluetooth Classic is **unknown**. I tested 300 kbps and 1000 kbps HEVC. The 1000 kbps files measured 9.5 MB for 77 s, which is about 990 kbps, so the encoder held its target.
- Mock Device Kit takes an h.265 file as the camera feed: `camera.setCameraFeed(fileURL:)`, video "h.265 (HEVC)" (`plugins/mwdat-ios/skills/mockdevice-testing/SKILL.md`). The `.mp4` files this spike produced are h.265, so they can be fed straight into the mock.

## 2. What I ran

All code and outputs are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/teardown-memory/`: `code/sim.py` is the renderer, `code/run.py` the pipeline and scorer, `code/sweep.py` and `code/pair.py` the experiments, and `out/*.json` and `out/*.mp4` the results. I used Python 3.12 with OpenCV-contrib 4.x and ffmpeg/libx265.

**Scene (synthetic, metric).** A 340x420 mm portrait mat carries ten 30 mm `DICT_4X4_50` markers on its border. A 240x185 mm "device" (a PCB texture with clutter, including red components that fall in the skin-colour range) has its top surface at 15 mm, and at 40 mm in the stress test. Parallax is rendered properly as a second plane. There are 8 parts per trial, all at least 10 mm: silver screw, black screw (over a dark hole), bracket, beige clip, black rubber foot and white connector. The tray is 2x4 cells of 60 mm printed on the near half of the mat.

**Camera and motion.** A pinhole camera renders at 504x896. Working distance is 40, 50 or 60 cm, elevation 45-60°, and horizontal FOV 56° or 71°. The head moves in a random walk (±35 mm position, ±30 mm gaze), with ±2° roll, gaze that follows the hand, and 4% of frames as random glances away. Motion blur is computed from inter-frame image motion with a 1/30 s exposure at 7 fps, which is pessimistic. I added ±10% lighting drift, vignetting and σ=3 sensor noise, and I did **not** model stabilisation, which is also pessimistic. A rendered arm and hand with a cast shadow occludes the scene during each removal: the hand reaches the part, dwells for 5 frames (the part vanishes under it), moves to a tray cell (the part appears), and exits. All frames are then **HEVC-encoded and decoded** before the pipeline sees them.

**Pipeline (what we would ship).** For each frame:
1. ArUco detection, then a RANSAC homography to mat millimetres, then rectification at 0.5 mm/px.
2. A hand gate.
3. While idle, commit clean frames into a rectified "mosaic". On hand-in, freeze it as *before*. After 5 hand-free frames, build *after* from the last 3.
4. A shift-tolerant colour diff (±2 mm, with blobs regrown afterwards).
5. The largest blob in the device zone gives the removal location, and the largest blob in the tray zone gives the cell.
6. Reassembly replays the recorded graph in reverse. A step is flagged if the placed blob is more than 10 mm from the **recorded** location (the system's own record, not ground truth), or if the source cell differs.

The seeded errors are wrong hole (part placed 22-32 mm away) and wrong part (taken from another cell), about 30-45% of reassembly steps.

**Ground truth.** A removal counts as correct if the detected location is within 10 mm of the true part (parallax-corrected for that event's camera pose) **and** nearest to it, **and** the tray cell is correct.

### Variants
| Variant | Change |
|---|---|
| v1 naive | Gate = large change versus the mosaic. Plain grey tray. ±1 px diff tolerance at 1 mm/px |
| v2 | **Skin-colour hand gate** (YCrCb, a stand-in for a real hand detector). Commit only frames with ≥3 markers. ±2 mm tolerance at 0.5 mm/px. **Blue tray cells** |
| v3 | v2 plus the fingertip dwell point (topmost skin pixel mapped to the mat) used to lower the diff threshold within 40 mm **and** to choose the blob nearest the dwell point |
| v3b | v2 plus the dwell point used **only** to lower the threshold locally (30 to 15). Blob choice stays "largest" |

## 3. Results (measured, synthetic)

**Sweep 1: v1 naive vs v2.** 3-4 seeds × {40, 50, 60 cm} × {56°, 71°} × {300, 1000 kbps}, 8 removals and 8 reassembly steps per trial.

| | Removals | Location + cell correct | Location | Cell | Seeded errors caught | False alarms on correct steps |
|---|---|---|---|---|---|---|
| v1 naive (36 trials) | 288 | **36.1%** | 55.9% | 50.7% | 96/96 | 100/192 (52%) |
| v2 (48 trials) | 384 | **79.9%** | 80.5% | 97.4% | 168/168 | 53/216 (24.5%) |

Breakdown of v2 by condition, showing the share of removals with both location and cell correct:

| 40 cm | 50 cm | 60 cm | FOV 56° | FOV 71° | 300 kbps | 1000 kbps |
|---|---|---|---|---|---|---|
| 78.1% | 78.1% | 83.6% | 78.6% | 81.2% | 80.7% | 79.2% |

**Distance, FOV and bitrate barely matter.** Failures are scene-driven: per-seed results were nearly identical across all 12 camera conditions.

**v1 failure:** the change-based hand gate latched on permanently. That happened in 9 of 12 trials of one seed, where 0/8 events were recorded. The device's 15 mm height produces parallax changes (side wall and top shift) of about 2,000 mm² as the head moves, which looks like a hand. **A diff-based hand gate does not work with 3D objects on the mat. A real hand detector is required.**

**v2 location-error distribution** (333 removals where a device blob was found): median **1.2 mm**, p80 1.9 mm, p90 2.7 mm. 309/333 were within 5 mm and 21 were more than 30 mm off (the wrong blob was chosen). The remaining 51/384 had no blob at all.

**Per-part failure analysis** (v2, 8 trials at 50 cm, 71°, 300 kbps):

| Part | Correct |
|---|---|
| bracket | 12/12 |
| connector | 11/11 |
| rubber foot | 11/11 |
| clip | 8/8 |
| silver screw | 8/9 |
| **black screw on dark board** | **4/13** |

Contrast is the killer.

**Sweep 2: paired comparison** (same decoded frames; 12 seeds, 40/50/60 cm, 71°, **300 kbps**):

| Device height | Variant | Location + cell correct | Cell | Seeded errors caught | False alarms |
|---|---|---|---|---|---|
| 15 mm | v2 | 84/96 = 87.5% | 99% | 36/36 | 12/60 (20%) |
| 15 mm | v3 (prior picks blob) | 77/96 = 80.2% | 99% | 36/36 | 15/60 (25%) |
| 15 mm | **v3b (prior lowers threshold only)** | **87/96 = 90.6%** | 99% | 36/36 | **10/60 (16.7%)** |
| 40 mm | v2 | 23/32 = 71.9% | 100% | 17/18 | 5/14 |
| 40 mm | v3b | 24/32 = 75.0% | 100% | 18/18 | 4/14 |

- v3b fixes black screws (14/18 to 17/18). v3 also fixed them but broke the others: the fingertip is about 25 mm above the surface, so its mat projection is 20-30 mm off and it pulls blob choice to the wrong blob.
- 90.6% on 96 removals has a binomial 95% interval of roughly 83-95% (estimate). **It is at the bar, not clearly over it.**
- **A taller device (40 mm) drops to 72-75%.** Silver screws on the raised top fall to 2/6, because parallax between the before and after poses exceeds the ±2 mm tolerance.

**Registration statistics** (all trials): mean markers decoded per frame were 4.2 at 40 cm and 5.4 at 50-60 cm. **74-78% of frames registered** (2 or more markers). The rest were hand-occluded, blurred glance frames or out-of-view frames, and the state machine tolerates them. The median homography reprojection error was **0.65-0.93 mm**.

**Latency.** On this Mac with the machine idle, per-frame registration, rectification and gating took about **10 ms median** in Python at 1 mm/px (v1 run). Under heavy shared load (load average over 100 from other agents) the v2/v3 runs measured 70-110 ms median at 0.5 mm/px, so treat those as an upper bound. Both are inside the 143 ms frame budget at 7 fps. On-phone latency is **unverified**.

### What worked
- ArUco plus homography at 504x896 with HEVC at 300 kbps, at 40-60 cm. This is no longer a risk in simulation.
- Tray-cell assignment once cells are coloured: 97-100%.
- A mosaic and before/after diff with a shift tolerance. Localisation is millimetre-accurate when the blob is found.
- Catching seeded errors: 100% in every variant. Wrong-hole errors at 22 mm or more and wrong-cell errors are both caught.

### What failed
- The naive change-based hand gate (latches on parallax).
- Low-contrast parts without a fingertip-guided threshold.
- Devices taller than about 2 cm (parallax).
- **False alarms in verify: 17-25%.** A stranger at the table would see about one false chime per 4-6 correct steps. That hurts the scoreboard story in front of Daksh-type jurors, because the false-alarm rate is the number they will ask for (00-rules-and-jury.md §5).

### What remains unverified (and how to verify on site)
| Item | Why unverified | What to do on site |
|---|---|---|
| Real stream FOV, stabilisation crop, actual bitrate and HEVC quality at `.medium`/7 fps | No glasses here | Hour 0-2 at the booth: record 2 minutes of the printed mat at 40/50/60 cm with `.hvc1` passthrough (CameraAccess writes files). Run `code/run.py`'s pipeline on it and check ≥4 markers per frame at 60 cm |
| Real hand detection from an egocentric top-down view | Sim used a skin-colour gate, which is optimistic (the sim's skin was uniform) | Use an on-phone hand detector (for example MediaPipe Hands; its performance on these frames is unknown). Measure the gate's miss and false rate on the recorded footage |
| Real parts: specular screws, shadows, 3D brackets, the device being nudged or rotated mid-teardown | Not modelled | Put 2-4 small ArUco stickers on the device itself so the device plane is registered directly (removes parallax and survives moving the device). **Marker detection at 20 mm size has not been tested** |
| DAT build and Mock Device Kit run | `xcodebuild` of the public CameraAccess sample was **denied by this environment's permission policy** (external code). The repo, samples (CameraAccess, DisplayAccess, BirdSpotter) and the `.medium` = 504x896 config were confirmed by reading the source | On a team laptop: open `samples/CameraAccess`, build to an iPhone, enable MockDeviceKit and feed `out/pair_10_15.0.mp4` via `setCameraFeed(fileURL:)` |
| Async LLM part labels from crops | No API keys | Send 20 crops to the chosen vision model behind our proxy. Check that labels are useful ("short silver screw") and the latency is off the critical path |
| On-phone or laptop CV latency | No device | Time the pipeline on the actual demo machine |
| Repeated demo handoffs, device allocation, registration collisions | Platform risk shared by all concepts | See feasibility.md §4, §10 |

## 4. Architecture I would build

```
[Glasses] --DAT .medium 504x896 @7fps, .hvc1--> [iPhone app (Swift, DAT 1.0.1)]
   - session/permission/device-state machine (paused, doffed, folded, thermal, CAPABILITY_DENIED)
   - forwards frames (HEVC passthrough or JPEG) over USB/LAN to ->
[Laptop "brain" (Python, OpenCV) - reuses this spike's code]
   - ArUco mat + device-sticker homographies -> rectified mosaic
   - hand detector gate (MediaPipe-class) -> hand-in / hand-out events
   - fingertip dwell -> local low threshold -> before/after diff -> {location, tray cell, crop}
   - disassembly graph (JSON), reverse replay, verify diff per step, "not sure" state
   - scoreboard: seeded errors caught / missed / false alarms / not-sure
   - async: crop -> proxy -> vision LLM label ("short silver screw") -> graph node (never blocks)
[Cast screen (web UI)] live timeline, circled hole, scoreboard, crop-only upload counter
[Glasses audio] TTS step prompts + error chime via phone A2DP
```

Why use a laptop brain? This spike's Python is the engine as it stands, and porting it to Swift is avoidable risk in 40 h (estimate). The cost is one extra hop and a USB or hotspot dependency. Only crops leave the laptop, and the upload counter on screen makes that visible (trust, CHALLENGES.md:L902).

## 5. Fallback demo if device access is limited to short slots
1. **Record first.** In the first device slot, record 3-4 full teardown and reassembly runs at `.medium`/7 fps as h.265, including a seeded-error run and one run with a stranger.
2. **Replay through Mock Device Kit** (`setCameraFeed(fileURL:)`) on the phone app, so the whole app, state machine included, runs at the table without glasses. Clips can also go straight into the laptop brain.
3. **Phone-on-head backup.** If footage is poor or slots are rare, record with an iPhone on a head strap at 504x896 equivalent. Label it honestly as a stand-in.
4. **Live at the table:** if glasses are available, do the 3-removal and reassembly loop live. Otherwise replay the recorded clip and do only the live **verify** step with the visitor using the phone camera, keeping the scoreboard live.

## 6. Revised MVP (what changes because of the spike)
- **Prop constraints (mandatory):** a flat, light-coloured demo device about 2 cm tall or less, for example a light plywood or white plastic assembly kit. Use 6-8 parts of at least 1 cm that **contrast with the device**. Avoid black-on-dark. Use **coloured tray cells**. Put **ArUco stickers on the device** as well as on the mat.
- **Engine:** a real hand detector gate, the fingertip-dwell local threshold (v3b), a ±2 mm shift-tolerant diff, and quality-gated commits (≥3 markers).
- **Trust and UX:** when no blob or more than one candidate is found, say "I didn't catch that, which cell?" and accept a phone tap. This turns silent mis-records (the cause of most false alarms) into "not sure" events. **Show "not sure" separately on the scoreboard**, plus the cumulative false-alarm rate. Speak only on errors.
- **Scoreboard:** seeded errors caught / missed, false alarms per correct step, and not-sure count, compared with a paper-checklist baseline.
- **Drop:** live part identity from the LLM (keep labels async and cosmetic), taller real devices, and any claim beyond "parts of 1 cm or larger with contrast".
- **Keep:** the state machine (permission, pause/stop, doffed, marker lost, offline label queue) and the crop-only upload counter, as in _candidates.md.

## 7. Hour-by-hour outline (3 people, 40 h)
People: **M** = mobile/DAT, **V** = vision engine, **W** = web UI, LLM, deck and evaluation.

| Hours | M | V | W |
|---|---|---|---|
| 0-2 | Booth: allocation, pairing, Developer Mode, versions (feasibility.md §10). Build CameraAccess with MockDeviceKit | Print the mat and coloured tray. Buy or choose a flat, light demo device and contrasting parts. Add stickers | Repo, proxy with a mock LLM, cast-screen skeleton |
| 2-4 | **Go/no-go:** record 2 min of real glasses footage (40/60 cm) | Run the spike pipeline on that footage: markers per frame, location accuracy on 10 hand-labelled removals | Event and graph schema, timeline UI |
| 4 | **Decision gate:** at least 90% on real footage, or at least 80% with "not sure" catching the rest. Otherwise switch to `did-i` | | |
| 4-12 | Stream to laptop (USB/LAN), session state machine, TTS/A2DP | Hand detector gate, dwell prior, device-sticker homography, graph builder | Timeline, circled-hole reassembly view, scoreboard |
| 12-20 | Device-state UX (doffed, folded, thermal, denied), Mock replay path | Reverse replay and verify, "not sure" flow, tuning on recorded runs | Async crop labels via proxy, upload counter, consent screen |
| 20-26 | Sleep in shifts (one person always on) | | |
| 26-32 | Record 6+ evaluation runs on real glasses, including strangers seeding errors | Held-out evaluation: removal accuracy, caught/missed/false-alarm rates, against the paper baseline | Deck: problem (repair cafés, working-memory difficulty), evidence slide, pilot path |
| 32-36 | Freeze. Demo-reset routine under 30 s. Backup video | Fix the top failure only | Pitch rehearsal ×3, peer-table script |
| 36-40 | Buffer, submission, judging | | |

## 8. Verdict
**Go-with-changes, as the reserve concept. Estimate: 50% that the MVP demo works live.**
- The assumption holds in simulation only at the edge: 90.6% (95% interval about 83-95%), and only with the v3b engine, a flat device and contrasting parts. It fails for taller devices (75%), and the naive design fails outright (36%).
- The simulation is optimistic about the hand gate and part geometry, and pessimistic about stabilisation, exposure and bitrate. Net direction is **unknown**, so the decision must rest on the hour-2 real-footage test.
- The killer for the peer demo is not accuracy on removals but **false chimes in verify (17-25%)**. With "not sure" prompting and constrained props this may drop, but that is unverified.
- Compared with `did-i` and `panel-reader`, this concept carries more pipeline stages and more prop dependence (senior-engineer.md: "one mis-registered removal corrupts the ordered graph", confirmed here). Pick it only if the hour-4 gate passes.

## Sources
- CHALLENGES.md:L896, L900, L902 (functional prototype; permissions, errors and device state; consent).
- `02-research/ai-glasses/feasibility.md` §3-§5, §10. `04-ideas/_candidates.md` (`teardown-memory`, `step-check`). `05-evaluation/_top5.md` §5-§6. `05-evaluation/senior-engineer.md`. `05-evaluation/demo-evaluator.md`. `00-rules-and-jury.md` §5.
- [facebook/meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios) (cloned): CameraAccess sample (`StreamConfiguration(videoCodec: .hvc1, resolution: .low, frameRate: 24)`), `plugins/mwdat-ios/skills/camera-streaming/SKILL.md` (resolutions, frame rates, codecs), `plugins/mwdat-ios/skills/mockdevice-testing/SKILL.md` (`setCameraFeed(fileURL:)`, h.265).
- [DAT camera-stream-processing guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing) (9:16 crop, stabilisation, no intrinsics, HEVC).
- Ray-Ban Meta Gen 2 camera: 12 MP, 100° FOV (Ray-Ban product page via web search, [ray-ban.com](https://www.ray-ban.com/australia/discover-ray-ban-meta-ai-glasses/clp)). Stream FOV unknown.
- All results above are from synthetic rendering; every figure not measured here is labelled as an estimate.

<!-- complete -->
