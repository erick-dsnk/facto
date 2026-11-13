# Feasibility spike: "Did I?" (`did-i`)

**Summary**
- **The assumption we tested failed with every keyless verifier we could run.** On about 110 gated 360p bursts per condition from public handheld clips (a Kwikset deadbolt and an induction-hob knob), no configuration reached both targets (false "locked"/"off" at or below about 2%, and "not sure" at or below about 20%). The safe configurations kept false "safe" verdicts at 0-1.2%, but answered "not sure" on 60-96% of clear bursts.
- **The naive single-image prompt is dangerous, and that result is real.** A local VLM (Qwen2.5-VL-7B) asked "Is the deadbolt locked?" said "yes, locked/off" on **22 of 22** bursts where the truth was unlocked, ambiguous or not visible, including **5 of 5 clearly unlocked** frames. The two-reference prompt on the same model was no better than chance: it chose "image 2" 86% of the time whatever the order, and always reported `visible: true` and confidence 90.
- **What does work: geometry first.** When registration to a reference succeeds, a keyless SIFT+homography+ROI comparator was right on 42 of 43 answered clear bursts. Its failures are almost all "could not register", which is a capture problem we can engineer away with a printed **checkpoint tag** (ArUco) next to each knob or lock. In synthetic tests, a tag of 48 px or more is detected in 38-40 of 40 frames with up to 9 px of motion blur.
- **Verdict: go-with-changes (estimate).** Rebuild the verifier around a tag-anchored crop and a deterministic two-reference comparison, use a cloud VLM only as a cross-checked second opinion on the crop, and turn "not sure" into "glance again". The cloud-VLM accuracy, glasses image quality and DAT build are **unverified**, and the first three hours on site must check them (see §6).

---

## 1. What I ran

All code, data and outputs are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/did-i/` (`code/`, `data/`, `results/`). Nothing was written to the repository except this file.

### 1.1 Test data (public clips, labelled by hand)
We had no glasses and no phone camera, so I used public YouTube clips that look like first-person, handheld footage. A hand reaches in and the camera shakes.
- **Kwikset deadbolt** (`c_bjg-qX_-I`, 42.5 s, 1280x720). The thumb-turn is vertical (unlocked) at 0-6.7 s and 40-42.5 s, and horizontal (locked) at 8-10.8 s. A hand grasps and turns it at 30-39.5 s, which I labelled *ambiguous*. The exterior keyed side at 13-25 s I labelled *not visible*: the inside checkpoint cannot be seen, even though the bolt is in fact locked.
- **Induction-hob upper knob** (`kcbP6YtTfsg`, 22 s). The bar is horizontal (off) at 2.4-4.4 s and 12.3-21.6 s, and vertical with a red mark (on) at 7-10.4 s, with turning in between (*ambiguous*). From 14 to 16.5 s the *other* knob is turned on, which is a useful distractor.
- I tried and dropped a Schlage clip (`pzo1MUPfAg0`) because I could not label its states reliably. The gas and electric stove clips were instructional animations or pointing without clear transitions (`Y9Zqla9CexY`, `0V3vf_ukA8k`, `922pv_uKMSo`).

### 1.2 Simulated glasses capture (`code/build_dataset.py`)
- The DAT stream offers 360x640 (low), 504x896 (medium) or 720x1280 (high) at 2/7/15/24/30 fps. It degrades automatically, and frames "may look lower quality than the reported resolution" because of per-frame compression over Bluetooth Classic ([DAT streaming docs](https://wearables.developer.meta.com/docs/develop/dat/streaming/), opened today). Meta's own CameraAccess sample uses `StreamingResolution.low` at 24 fps (`samples/CameraAccess/CameraAccess/ViewModels/CameraViewModel.swift:283-286` in [meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios), cloned today).
- Conditions:
  - `p360`: 15 fps, short side 360, HEVC at 600 kbps.
  - `p504`: short side 504, 1 Mbps.
  - `p360_blur`: like p360, plus 4-frame temporal blur to imitate longer exposure.
  - The bitrates are **estimates**, because the real per-frame bitrate is unknown.
- **Gate:** 1.5 s bursts with a 0.33 s stride. The sharpest frame in each burst is chosen by Laplacian variance. References are one sharp 504p frame per state, and any burst within 0.3 s of a reference frame is excluded.
- **Result:** 110 bursts per condition, or 330 in all. By label: off 23, locked 3, unlocked 18, on 4, ambiguous 29, not visible 33. **Caveats:** the bursts overlap, so they are strongly correlated (the effective sample size is much smaller); there are very few "locked" and "on" positives; and the references come from the same clip and often the same viewpoint as the tests, which flatters any verifier.

### 1.3 Verifiers
| Verifier | What it does | Code |
|---|---|---|
| **Naive baseline** | One image to the VLM: "Is the deadbolt locked?" / "Is the upper knob off?", returning `{"answer":"yes"|"no"}` | `code/verify.py` (`naive`) |
| **Two-reference VLM** | Three images go to the VLM: safe reference, unsafe reference and query. It returns `{visible, match: 1/2/unclear, confidence}`. The prompt is run in **both reference orders**, and an answer counts only if the two orders agree ("swap_agree") | `code/verify.py` |
| **Geometric two-reference (keyless, no ML)** | SIFT + ratio test + RANSAC homography from each reference to the query, followed by a warp and ZNCC on edge maps inside a hand-drawn checkpoint ROI. It says "not sure" unless at least 15 inliers, the ROI falls inside the frame, ZNCC is 0.3 or more and the margin is 0.1 or more | `code/cv_verify.py`, `code/analyze.py` |
| **Tag detectability** | A synthetic ArUco 4x4 marker pasted into a real 640x360 burst, with random perspective tilt, dimming, motion blur and JPEG q50 | `code/aruco_test.py` |

The VLM is **Qwen2.5-VL-7B through local Ollama** (already installed, no key). It is a weak proxy for Gemini or Claude, which I could not call because we have no keys here. The machine was shared and slow, so the VLM run was stopped at **32 randomly sampled p360 bursts**. The CV verifier covered all 330.

## 2. Results (actual output, `results/summary.txt`)

"False safe" counts verdicts of locked or off when the truth was unlocked, on, ambiguous or not visible. "Not sure (clear)" is the rate on bursts with a clear ground-truth state.

| Verifier / policy | Condition | False safe | False safe on truly unsafe | Not sure (clear) | Accuracy when answering |
|---|---|---|---|---|---|
| Naive prompt (Qwen 7B) | p360, n=32 | **22/22 (100%)** | **5/5** | 0/15 | 10/15 |
| Two-ref VLM, single order | p360, n=32 | 0/22 | 0/5 | 0/15 | 9/15 (bias, see below) |
| Two-ref VLM, both orders agree | p360, n=32 | 0/22 | 0/5 | 7/15 (47%) | 4/8 (chance) |
| Geometric, both refs must register | all, n=330 | 0/252 | 0/66 | 137/144 (95%) | 7/7 |
| **Geometric, best registered ref** | p360 | 1/84 (1.2%) | 0/22 | 29/48 (60%) | 18/19 |
| | p504 | 1/84 (1.2%) | 0/22 | 29/48 (60%) | 19/19 |
| | p360_blur | 0/84 | 0/22 | 43/48 (90%) | 5/5 |

What the numbers say:
- **Qwen2.5-VL-7B cannot do the task.** Over 64 two-reference calls it answered "2" 55 times and "1" 9 times, said `visible: true` 64 out of 64 times and confidence 90 64 out of 64 times. Its 0% false safe comes from position bias, not from skill. The order-swap check correctly rejected half the answers, and the rest were at chance. **Self-reported confidence is useless as a threshold** for this model, and it is unknown for cloud models.
- **The naive prompt says "safe" when the checkpoint cannot even be seen.** It answered "locked" on all 11 exterior-side frames and on all 5 clearly unlocked frames. That is the jury-facing evaluation story: we can measure it, and it is dramatic.
- **The geometric verifier is safe but mute.** Its 2 strict false-safe cases (p360 and p504 at t=34.0 s) are a frame where fingers rest on a thumb-turn that is visibly horizontal, so the truth is probably "locked" and my "ambiguous" label was conservative. On the knob, "ambiguous" mid-turn frames came out as "on", which is the safe direction. Almost every "not sure" comes from failed registration: on Kwikset the median inliers against the other-state reference were only 2-6, against 10-16 for the knob, because of the glossy plate, large viewpoint changes and a hand in the frame.
- **Blur hurts a lot.** Not-sure on clear bursts went from 60% to 90% under temporal blur.
- **Latency.** Geometric verifier: median 296 ms per burst on a laptop CPU, for SIFT against two references. Local VLM: median 12.4 s per three-image call and 7.8 s per one-image call (p90 24.8 s) on a shared Apple-silicon machine. Cloud VLM latency is **unverified**; feasibility.md §5 estimates 1-3 s.

### Tag detectability (synthetic, 40 trials per cell, 640x360, JPEG q50)
| Marker size (px) | Sharp | 5 px blur | 9 px blur | 15 px blur |
|---|---|---|---|---|
| 18 | 39/40 | 2/40 | 0/40 | 0/40 |
| 24 | 40/40 | 30/40 | 0/40 | 0/40 |
| 32 | 40/40 | 37/40 | 7/40 | 0/40 |
| 48 | 40/40 | 40/40 | 38/40 | 2/40 |

The gate chooses the sharpest frame of a 1.5 s burst, so 5 px of blur or less is the expected case (estimate). **A tag about 48 px wide at 360p is enough.** Converting that to a physical size needs the glasses' horizontal field of view, which I have not verified (unknown). As an estimate, at 70-100° FOV and 0.5 m, 48 px is roughly 5-9 cm, so a 8x8 cm sticker is the safe choice.

## 3. What worked, what failed, what is unverified

**Worked (verified here)**
- A sharpest-frame gate plus a geometric two-reference check gives near-zero false "safe" verdicts on real, shaky, low-resolution footage, with sub-second CPU latency.
- The order-swap self-consistency check catches a biased VLM. Keep it whatever model we use.
- The naive baseline's failure is reproducible and easy to measure, which makes it a strong slide for the jury.
- The public DAT iOS and Android repos clone without credentials and include `CameraAccess`, `DisplayAccess` and `BirdSpotter` samples pinned to SDK 1.0.1. Their Mock Device Kit view model can feed a **video file** (`setCameraFeed(fileURL:)`) or an image (`setCapturedImage(fileURL:)`) as the camera (`MockDeviceCardViewModel.swift:114-121`). The 1.0.0 changelog lists **photo capture** (`Camera.photo` with `PhotoResolution` and `PhotoQuality`), **Motion** and **Inputs** as *Experimental* (`CHANGELOG.md` in the iOS repo).

**Failed**
- The assumption as stated. No verifier reached ≤2% false safe together with ≤20% not sure.
- A small local VLM as the verifier, or even as a tie-breaker.
- Registration without help from the scene. On a glossy door plate it fails most of the time.

**Unverified (what the team must do on site)**
| Item | How to verify (hour 0-3) |
|---|---|
| Whether a cloud VLM (Gemini or Claude) does the two-reference comparison well on **tight crops** | Run `code/verify.py` with the provider swapped in, on 100 or more prop bursts recorded with a phone at 360p, comparing full frame and tag-anchored crop. Pass: swap-agree false-safe 0 and not-sure ≤30% on crops |
| Real DAT stream quality at `low` and `medium` in the hall (compression and blur) | On borrowed glasses, record 2 minutes of the props through CameraAccess, then rerun `build_dataset.py` with the real frames (skipping the degradation step) |
| Whether `Camera.photo` (experimental) works on the loaner firmware and how long a transfer takes | Run CameraAccess photo capture and time the transfer. If it is under about 2 s, use a photo instead of a stream frame for the verdict |
| Building the iOS sample | **The sandbox here refused to run `xcodebuild` on external code**, so the build is unverified. Xcode 26.6 is installed on this machine, and the sample requires Xcode 26.4+ (README). Build CameraAccess on our own Mac with our signing team at hour 0 |
| The glasses' field of view, which sets the tag size | Measure on site: photograph a ruler at 0.5 m |
| Whether a tag sticker is acceptable UX for Meta judges | Ask Amanda Le at the booth. The pitch frames it as "you choose which three things it may check" |

## 4. Architecture I would build

```
Glasses (DAT camera stream, low 360x640 @ 15 fps; Motion optional)
   │ BT Classic
Phone app (iOS or Android, DAT SDK 1.0.1)
   ├─ Gate (on phone, runs on every frame and keeps nothing):
   │     ArUco tag of a registered checkpoint detected  AND  sharpness > threshold
   │     → keep the sharpest frame in a 1.5 s window; drop every other frame immediately
   ├─ Upload counter ("2 frames sent, 0 stored" vs about 60 for a naive 1 fps stream)
   └─ HTTPS → Verifier service (our backend; keys server-side)
          1. Tag pose → homography → warp the query into the reference frame → crop the checkpoint ROI
          2. Deterministic comparator: ZNCC(edges) against the SAFE and UNSAFE reference crops
             (plus pointer-angle estimate for knobs: dominant gradient orientation inside ROI)
          3. Second opinion: cloud VLM on [safe crop, unsafe crop, query crop], run in both orders;
             counts only if both orders agree AND agree with step 2
          4. Verdict = state only if steps 2 and 3 agree; else "not sure" (+ thumbnail)
          → store {checkpoint, state, time, 160px thumbnail}; TTL 24 h; nothing else persisted
   └─ Query: phone button / Inputs tap (beta) / voice → TTS "Stove: off at 14:02" or
      "Not sure, last clear look was on, at 13:58. Glance at it again?"
Mock path: Mock Device Kit `setCameraFeed(fileURL:)` with recorded prop clips (HEVC/h265 per feasibility.md §3)
```

Design decisions that follow from the spike:
- **A geometry gate before any ML.** The tag doubles as the privacy boundary: the system only evaluates frames in which one of *your registered checkpoints* is visible.
- **Never trust self-reported confidence.** Use agreement (comparator against VLM, order A against order B) as the "not sure" rule.
- **Turn "not sure" into an action.** A spoken "glance at it again" makes a second burst, which recovers most not-sure cases if the misses are independent (an estimate, untested). In the demo this reads as careful, not broken.

## 5. Fallback demo path (short device slots)

1. **Primary, on real glasses (5-minute slot):** wearer looks at the knob prop for about 1 s; the phone screen, cast to a projector, shows the tag box, the chosen frame, the verdict and the upload counter.
2. **If we only get short slots:** record the props through the real glasses during one slot, both as raw DAT frames and as screen recordings. After that, run the whole demo through Mock Device Kit `setCameraFeed(fileURL:)` with those real-glasses clips. It is the same app and code path, and only the source differs.
3. **If the glasses are unavailable at judging:** use the phone's own camera as a stand-in for the feed (the Mock Device Kit supports phone-camera feeds per feasibility.md §3), tell the judges plainly that it is the mock, and show the pre-recorded real-glasses video.
4. **The bystander moment works in every path.** The visitor secretly sets the knob, the wearer glances and later asks, and the screen reveals the verdict next to what the visitor actually did. The live scoreboard of our evaluation (ours against the naive prompt) sits beside it.

## 6. Revised MVP

- **Two checkpoints on props:** a large knob prop (about 8 cm diameter, with a high-contrast pointer and marked OFF/ON arcs) and a deadbolt thumb-turn on a board. Each has an 8x8 cm ArUco tag mounted next to it.
- **Setup flow:** "Look at the knob while it's OFF" (2 s), then "now ON" (2 s). This stores the reference crops per tag.
- **Gate:** tag plus sharpness on the phone. Frames are kept only while a tag is visible.
- **Verifier:** the tag-anchored comparator, with the cloud VLM as a cross-checked second opinion. If the hour-3 cloud check fails, ship the deterministic comparator alone.
- **Verdict store:** state, time and thumbnail, with a 24 h TTL enforced by a sweeper. A "what's stored" screen shows exactly what is kept.
- **Query:** phone button (always works) plus a voice query. The Inputs tap is a beta stretch goal.
- **Visible states:** not registered, permission denied, session STOPPED/PAUSED, tag not seen, stream degraded, offline (gives "not sure" plus the last verdict). These match CHALLENGES.md:L900.
- **Evaluation slide:** 100 or more held-out prop bursts recorded through the real glasses where possible, otherwise the phone at 360p. It reports false-safe and not-sure for **ours against the naive prompt**, with the exact counts (this spike's naive result: 22 of 22 false safe).
- **Pitch:** autopilot and ADHD forgetfulness, not checking OCD (per _top5.md). "Not sure" is the first feature shown. Consent: tag-scoped capture, 24 h retention, and a counter on screen (CHALLENGES.md:L902).
- **Cut:** automatic hand-on-object detection, Pot Watch mode and Display cards (Display is a stretch only).

## 7. Hour-by-hour outline (3 people, 40 h)

A = mobile/DAT, B = ML/verifier, C = full-stack, demo and deck.

| Hours | A (mobile/DAT) | B (ML/verifier) | C (full-stack/demo/deck) |
|---|---|---|---|
| 0-3 | At the booth: allocation, pairing, firmware, `CAPABILITY_DENIED`, photo capture. Build CameraAccess on our Mac and run it on Mock Device Kit | Build the props and print tags. Record 150 prop bursts on a phone at 360p in varied light and angles. Port `cv_verify.py` to tag-anchored crops | Backend skeleton with a provider-agnostic VLM module and a mock. **Run the cloud VLM crop test (§3)** |
| 3-4 | **Gate decision (all three):** does tag+crop give 0 false safe and ≤30% not sure on phone bursts? If not, simplify to the knob prop only, with a pointer-angle comparator | | |
| 4-10 | DAT stream into the phone gate (tag detection on device with OpenCV for iOS/Android) and the upload counter | Comparator + VLM agreement policy, evaluation harness, threshold sweep | Verdict store with 24 h TTL, query API, TTS, the "what's stored" screen |
| 10-12 | **First real-glasses slot:** record props through DAT and check frame quality | Rerun the evaluation on real-glasses frames | Cast the phone screen; storyboard the bystander demo |
| 12-20 | State handling (pause/stop/doff/thermal/permission), setup flow | Pointer-angle refinement for the knob; "glance again" logic | End-to-end integration; demo script |
| 20-26 | Sleep in shifts. At least one person must be awake at all times to keep the devices charged | | |
| 26-32 | Voice query; Inputs tap if beta works | Final 100-burst held-out evaluation (ours against naive) with exact counts | Deck: problem, audience, trust, evaluation, pilot (occupational therapy or ADHD coaching) |
| 32-36 | Second real-glasses slot: full run and backup video | Freeze the model and thresholds | Peer-review rehearsals with a stranger as the bystander |
| 36-40 | Bug fixes only | Bug fixes only | Final deck and video. Submit |

## 8. Verdict

**Go-with-changes (estimate).**
- The idea as written (a VLM comparing two references on raw gated bursts) is not supported by this spike.
- The safety half of the claim is achievable today without any key, using a geometric two-reference check.
- The coverage half (not sure ≤20%) needs scene help, meaning a tag and a deliberate glance, plus a re-glance loop, plus a cloud VLM that is unverified.

Probability that the revised MVP demo works live: about **60%** on real glasses and about 90% on mock with real-glasses clips (estimates, following feasibility.md §9). **Kill condition:** at hour 4 on site, tag+crop on phone bursts of our own props still gives any false "off"/"locked", or not-sure above about 40%. In that case, fall back to the knob prop only with a pointer-angle comparator, or hand the slot to the next concept in _top5.md.

<!-- complete -->
