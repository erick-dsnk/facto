# Meta AI Glasses: aggregated evaluation and top five for feasibility spikes

**Summary**
- **Meta challenge award: `panel-reader`, extended with a "Find" mode** (name a button and get guided to it), taken from `beacon`'s guided-reach idea. Meta's own-rubric judge ranks it first (82). It has the best demo (84) and needs no beta capability. One weakness pulls it down in the weighted numbers: fingertip and homography tracking from the glasses' viewpoint is unproven. A spike can settle that.
- **Overall win (peer review, then jury): `did-i`.** It is first in every weighted view (73.6 for overall) and has the smallest spread between judges (4 points). It also has the strongest daily trigger, which is what Kia and Otto look for. Its weakness is a quiet demo, so a bystander has to take part in it (see §5).
- **Best combined chance: `panel-reader` + Find**, with `did-i` 2 points behind as the fallback. Both are GA-only, so we can take whichever passes its spike.
- **The five spikes:** `panel-reader`+Find, `did-i`, `beacon`, `teardown-memory` (with `step-check`'s seeded-error scoreboard), and `nod`. `beacon` and `nod` share one hour-0 gate: does beta Motion run on the loaner glasses together with the camera stream? We have confirmed two hard rejections: `heads-up-sounds` and `which-way-now`.

---

## 1. Inputs and method

- Candidates: `04-ideas/_candidates.md` (17 concepts). Evaluator reports: `05-evaluation/{meta-judge, competitive-researcher, demo-evaluator, senior-engineer, skeptical-investor}.md`.
- Official rubric: creativity and use case, technical execution, real-world value and feasibility, and UX (input, accessibility and trust), each worth 25% (CHALLENGES.md:L934-937). The brief also asks for a "focused, plausible path to adoption or a pilot" and a prototype that "handles permissions, errors, performance trade-offs, connectivity, and device state changes" (CHALLENGES.md:L900).
- Overall route: peer review picks the top 5, then a seven-person jury decides. Our overall-appeal rubric is in 00-rules-and-jury.md §7: problem 20%, insight 20%, demo 15%, evidence 15%, peer legibility 15%, path 15%. If the demo or peer legibility is weak, the chance is close to zero.
- **How each criterion maps to a judge.** Alignment with official criteria uses the meta-judge. Novelty uses the competitive-researcher. Demo impact uses the demo-evaluator. Technical feasibility uses the senior-engineer. Real-world usefulness uses the skeptical-investor. **Sponsor-technology integration has no judge**, so the "Spons." column is **my estimate**, built from `_tech-challenges.md`. It measures how centrally Gemini API, Gemma, ElevenLabs or Modal fit honestly. Codex fits every candidate equally, so it does not separate them.
- These numbers come from language models. They organise the comparison, but they do not decide it. §4 lists every placement where I overrode the arithmetic, and why.

## 2. Weightings: the starting point, and what I changed

| Criterion (judge) | Given starting point | **Meta award** | **Overall** | **Combined** |
|---|---|---|---|---|
| Official-criteria alignment (meta-judge) | 25 | 35 | 5 | 25 |
| Novelty and differentiation (competitive) | 20 | 15 | 20 | 20 |
| Demo impact (demo-evaluator) | 20 | 10 | 30 | 20 |
| Technical feasibility (senior-engineer) | 15 | 20 | 15 | 15 |
| Real-world usefulness (investor) | 10 | 20 | 25 | 15 |
| Sponsor tech integration (my estimate) | 10 | 0 | 5 | 5 |

What I changed, and why:
- **Meta view.** Meta weights real-world value at 25% (L936), so usefulness goes from 10 to 20. Meta does not score sponsor technology, so that goes to 0. The meta-judge rises to 35 because it is the only lens that scores criterion C4 (accessibility and trust, L937) directly. Technical execution is a full quarter of Meta's score (L935), and a "functional prototype" is required (L896, L900), so feasibility rises to 20. The demo drops to 10 because Meta's judges assess the prototype, not a pairwise table vote.
- **Overall view.** Peer review is a gate, and the jury rubric weights problem and path at 35% combined (00-rules §7). So demo rises to 30 (it covers peer legibility, the demo itself and the in-demo baseline) and usefulness to 25 (problem plus path). The meta-judge drops to 5 because the jury does not use Meta's rubric.
- **Combined view.** This is the starting weighting with two changes. Usefulness goes from 10 to 15 because Meta weights real-world value at 25% (L936) and the jury at 35%. Sponsor goes from 10 to 5 because tech-challenge prizes are not one of our three objectives. They are a side bonus that any of the top five can stack (§6).

## 3. Full score table (every candidate, every judge, all views)

Spread is max minus min across the five judges (sponsor excluded). HR marks a hard reject by at least one judge.

| Candidate | Meta | Novelty | Demo | Feas. | Useful | Spons. (est.) | Spread | Start wts | **Meta view** | **Overall view** | **Combined** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| did-i | 76 | 76 | 75 | 74 | 72 | 60 | 4 | 73.5 | **74.7** | **73.6** | **74.1** |
| panel-reader | 82 | 66 | 84 | 58 | 68 | 50 | 26 | 71.0 | 72.2 | 70.7 | 71.9 |
| teardown-memory | 73 | 64 | 77 | 55 | 50 | 45 | 27 | 64.2 | 63.9 | 62.5 | 64.5 |
| beacon | 74 | 78 | 73 | 30 | 54 | 55 | **48** | 64.1 | 61.7 | 62.0 | 64.0 |
| step-check | 64 | 45 | 79 | 66 | 56 | 45 | 34 | 60.8 | 61.5 | 62.0 | 61.4 |
| nod | 72 | 72 | 64 | 34 | 52 | 55 | 38 | 61.0 | 59.6 | 58.0 | 60.9 |
| private-hand | 65 | 62 | 72 | 45 | 38 | 60 | 34 | 59.6 | 55.9 | 56.5 | 58.5 |
| basket | 56 | 48 | 65 | 60 | 60 | 60 | 17 | 57.6 | 57.3 | 58.9 | 57.6 |
| glance-log | 54 | 35 | 62 | 82 | 60 | 35 | **47** | 54.7 | 58.8 | 57.4 | 56.0 |
| coverage-inspector | 50 | 52 | 54 | 76 | 46 | 40 | 30 | 53.7 | 55.1 | 54.0 | 54.0 |
| cross-contact | 48 | 62 | 70 | 44 | 34 | 20 | 36 | 50.4 | 48.7 | 51.9 | 51.1 |
| show-me-once | 62 | 50 | 51 | 40 | 35 | 65 | 27 | 51.7 | 49.3 | 46.4 | 50.2 |
| which-way-now **(HR)** | 42 | 28 (HR) | 57 | 80 | 28 | 55 | **52** | 47.8 | 46.2 | 46.5 | 46.5 |
| sana | 46 | 36 | 41 | 57 | 45 | 60 | 21 | 46.0 | 46.0 | 44.6 | 45.2 |
| table-talk | 52 | 42 | 53 | 24 | 42 | 50 | 29 | 44.8 | 43.0 | 43.5 | 44.4 |
| still-head | 34 | 38 | 58 | 44 | 40 | 15 | 24 | 39.8 | 40.2 | 44.0 | 41.0 |
| heads-up-sounds **(HR)** | 49 (HR) | 40 | 32 (HR) | 12 (HR) | 30 | 25 | 37 | 34.0 | 34.8 | 30.6 | 34.2 |

Notes on the sponsor estimate: `show-me-once` (Gemini video understanding is central), `private-hand` (fine-tuning on Modal or Verda is real but small), and `did-i`, `sana` and `basket` (a Gemini call is the core) score highest. `cross-contact` and `still-head` are Codex-only. No placement in §5 depends on this column.

## 4. Hard rejections

| Candidate | Rejected by | Verdict | Evidence |
|---|---|---|---|
| `heads-up-sounds` | meta-judge, senior-engineer, demo-evaluator | **Upheld. Removed.** | The core input is camera-stream audio, which is beta-only (feasibility.md §3). HFP is beamformed to the wearer, so it cannot substitute (feasibility.md §3). Deaf output needs a Display, which is 10 of the 20 units (CHALLENGES.md:L914-915). Mock support for stream audio is unknown (_candidates.md). The investor adds that the premise is weak, because iPhone Sound Recognition already names doorbell and baby-cry sounds (skeptical-investor.md, citing How-To Geek and AppleInsider) |
| `which-way-now` | competitive-researcher | **Upheld. Removed.** | Meta says its glasses translate "menus and street signs" ([Meta](https://www.meta.com/ai-glasses/learn/live-translation-captions/), cited by the competitive-researcher), and navigation is built in (competitive.md). The meta-judge reached the same conclusion without rejecting (C1 6/25, "does not meet 'original' in L900"), and the investor found no recurring trigger (28). I found nothing in the sources showing the rejecting judge was wrong |
| `beacon`, `nod`, `still-head` (conditional) | senior-engineer: "if the booth says no [to Motion plus camera], treat as hard rejects" | **Conditional. Kept until hour 0.** | The motion guide, which I opened for this report, confirms the following. Motion "is a beta capability … available in the development and beta release channels only". Orientation "can be `null`". Rates of 5-60 Hz are "a target, not a guarantee". **The guide does not say whether Motion runs at the same time as the camera stream** ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). The question is still open, so the booth answer decides. `still-head` is dropped on fit anyway (§5) |

## 5. Disagreements and how I resolved them

**`beacon`: spread 48 (novelty 78, Meta 74, demo 73, engineer 30).** Every judge agrees on the facts. The engineer's 30 prices four unknowns stacked in the real-time loop: beta Motion, a nullable quaternion, Motion and camera concurrency (undocumented), and a self-calibrated focal length. All four are confirmed by the motion guide quoted above and by _candidates.md's platform table. The others score the ceiling. *Resolution:* this is a binary unknown, not a matter of taste, so it goes to a spike instead of being averaged. Meanwhile its best GA-only part, guided reach to a chosen target, is grafted onto `panel-reader` as Find mode. That fallback keeps the creativity even if Motion is denied.

**`nod`: spread 38 (Meta and novelty 72, engineer 34).** It has the same Motion gate as `beacon`, plus a classifier that is prone to false accepts. *Resolution:* it goes to a spike because it fills the motor-impairment gap Meta's own showcase skips (opportunity.md §1), which no other candidate does. It also costs almost nothing extra to test, because the `beacon` Motion check answers its first question.

**`panel-reader`: Meta 82 and demo 84 against engineer 58. This is the placement that turns on one score.** In every weighted view it trails `did-i` by about 2 points only because of the engineer's 58. I read that report. Its objection is that "the finger covers the button being read" and that "a jittering dot is visible to every observer". The first part is weaker than stated. The spoken label comes from the **registered control map**, not from live OCR (_candidates.md, panel-reader §3), so a covered label does not matter. What matters is (a) whether the fingertip landmark is detected from a dorsal, eye-height view and (b) whether the homography holds with the hand covering part of the panel. Both are unverified, and a 2-4 h spike can measure them on recorded footage. Two more objections are real and must go into the spike and the deck. The investor's: sliding a finger on a **capacitive** panel may press buttons, so the reader must also work with the finger **hovering**. The competitive-researcher's: Apple's Point and Speak does fingertip reading on Pro iPhones, so we must show hands-free operation and a semantic control map as the difference. *Resolution:* if the spike passes, I rank it first for the Meta award against the arithmetic. It is the Meta lens's clear first choice (82 vs 76), the strongest demo, and its accessibility story is exactly the one L890/L902 ask for. If the spike fails, `did-i` takes the slot.

**`did-i` vs `panel-reader` for the Meta award.** `did-i` leads the Meta view numerically (74.7 vs 72.2), because its feasibility and usefulness are higher. Two things in the meta-judge's report weigh against it, and both are on Meta's own terms. A false "stove off" is "a home-safety failure attributed to Meta glasses". And three generators converged on it, which reduces C1. The investor adds the OCD reassurance risk. *Resolution:* `did-i` is the strongest **overall** candidate and the Meta fallback. Its pitch must target autopilot and ADHD forgetfulness, not checking OCD (skeptical-investor.md), and must lead with the "not sure" rule.

**`did-i` for the overall win, despite the "low drama" objection.** The demo-evaluator scores it 75 but warns that it "may not be *remembered*" in pairwise votes. Peer legibility is a gate (00-rules §3), so this objection matters. Its relatability (A1) is the highest in the set, though, and its jury evidence (held-out bursts against a naive prompt, a stated false-"off" rate, the 2-against-60 upload counter) answers Daksh, Beer and Otto directly. *Resolution:* `did-i` stays first for the overall objective, with one demo change taken from `step-check`. **A bystander secretly sets the knob or bolt while the wearer looks away.** The wearer asks, and the screen reveals the verdict next to the bystander's choice. This turns a passive demo into a test the visitor runs themselves.

**`glance-log`: spread 47 (engineer 82, novelty 35).** It is easy to build, but the novelty finding is verified: an FHNW student project already reads gauges on Ray-Ban Meta via DAT plus Gemini (competitive-researcher.md). The demo-evaluator also expects it to lose pairwise votes. *Resolution:* not shortlisted. Its dwell-to-capture gate is a reusable component for `did-i`.

**`step-check` (demo 79, novelty 45) vs `teardown-memory` (Meta 73, novelty 64).** They share the same fiducial-mat diff engine (_candidates.md, "Shared engines"). `step-check` is more feasible and has the better evidence mechanism: a bystander plants errors and a scoreboard counts them. Its novelty is verifiably low, though, because Circus Group on Ray-Ban Meta and Meta's own guided-procedure category already exist (competitive-researcher.md; meta-judge.md). `teardown-memory` is more original. A shallow search I ran for glasses-based teardown or reassembly tracking returned only iFixit guides, so its novelty is unrefuted but **low-confidence**. *Resolution:* I merged them into **one spike slot**. `teardown-memory` is the concept, and `step-check`'s seeded-error scoreboard is its verify step: the observer misplaces parts and the scoreboard counts what was caught. One engine spike answers both.

**`private-hand` (demo 72, investor 38), `cross-contact` (demo 70, investor 34).** Both are good table moments with weak real-world value or safety stories. Meta can't endorse a cross-contact safety claim (meta-judge), and UNO alone is "a charming toy" for C3. *Resolution:* not shortlisted. `private-hand` is the first reserve if the Motion gate kills both `beacon` and `nod`.

## 6. The five concepts sent to feasibility spikes

| # | Concept | Serves | Meta view | Overall view | Combined |
|---|---|---|---|---|---|
| 1 | **Panel Reader + Find** | Meta award; best combined | 72.2 (my rank 1) | 70.7 | 71.9 (my rank 1) |
| 2 | **Did I?** | Overall win; fallback for Meta and combined | 74.7 | 73.6 (rank 1) | 74.1 |
| 3 | **Point and Find (beacon)** | Meta award, high ceiling (creativity) if Motion works | 61.7 | 62.0 | 64.0 |
| 4 | **Teardown Memory + Step Check scoreboard** | Overall, as the peer-demo alternative | 63.9 | 62.5 | 64.5 |
| 5 | **Nod** | Meta award via accessibility (motor gap) if Motion works | 59.6 | 58.0 | 60.9 |

### 1. Panel Reader + Find (`panel-reader`, with a guided-reach mode from `beacon`)
- **Concept.** A blind adult registers an appliance panel once. One photo goes to a vision LLM, which returns a JSON control map, and the user or a helper confirms it. After that, an on-phone loop runs a homography from the live glasses frame to the reference plus a fingertip landmark at 7-15 fps, and speaks the control under the finger with edge earcons. **Find mode (new, small):** the user says "Delicate". The same loop computes the vector from the fingertip to that control's box and speaks "right… up… on it", which turns `beacon`'s guided reach into a GA-only feature. There are no uploads during use, and it works offline. MVP: registration, two printed panels, read and Find modes, the state machine (permission, paused/stopped, degraded "move closer", tracking lost), and button accuracy plus time-to-press against the Meta AI baseline on recorded clips.
- **Why it serves its objectives.** It is the meta-judge's first choice (C1 20, C2 20, C3 19, C4 23) and the demo-evaluator's first choice (a staged baseline against Meta AI, the fingertip dot on the mirror). It is GA-only, so it survives a "no" on Motion. Find mode answers the "Point and Speak on glasses" objection with something a phone held in one hand cannot do.
- **Hardest assumption (spike).** From glasses-height footage at 504x896 and 360x640, can the on-phone hand-landmark plus homography pipeline place the fingertip on the correct control of a printed panel? The target is at least 90% of frames, with the finger touching or hovering about 1 cm above and partly covering the panel, and a stable label (no flicker between neighbours) at 7 fps or more on our phone. Test it on Mock Device Kit h265 or head-strapped phone footage first, then on one real-glasses clip.

### 2. Did I? (`did-i`)
- **Concept.** Checkpoint verification, not recording. Safe and unsafe reference frames are captured for each checkpoint (stove knob, deadbolt). A gate (hand-on-object plus reference similarity, with a phone button as fallback because Inputs is beta) keeps a 1-2 s burst. A VLM verifier returns `{object, state, confidence, time}` and answers "not sure" below a threshold. Only the verdict and a thumbnail are kept, and they are deleted after 24 h. MVP as in _candidates.md, plus the bystander-sets-the-knob demo from §5 and about 100 held-out bursts against a naive prompt, with the false-"off" rate stated.
- **Why it serves its objectives.** It leads every weighted view and has the lowest judge spread. It has the strongest recurring trigger (investor 72) and the best trust design (meta-judge C4 22), and it works fully on mock (engineer 74).
- **Hardest assumption (spike).** On bursts gated at 360-504p with natural motion blur, does the two-reference VLM verifier hold false "off" or "unlocked = locked" verdicts at or below about 2% while keeping "not sure" at or below about 20% across lighting, angles and both props? Measure it on about 50 phone-camera bursts (estimate) before investing in the gate.

### 3. Point and Find (`beacon`)
- **Concept.** The target is self-named or tapped by a helper. A pixel from about 1 Hz grounding is converted to a world bearing using the Motion quaternion. A mono pitch and rate cue updates from the IMU at 30-60 Hz and re-anchors on still-head frames. A lock chime fires at reach distance. MVP and evaluation are as in _candidates.md (about 20 trials against a voice-only baseline).
- **Why it serves its objectives.** It has the highest novelty (78) and Meta creativity (C1 22). Motion is a DAT 1.0 headline capability that public projects don't use (opportunity.md, "underused capabilities"). It is the most theatrical peer demo if it works.
- **Hardest assumption (spike, at the hour-0 booth).** On the loaner glasses, does the beta Motion capability (a) return `CAPABILITY_DENIED` or not, (b) deliver a **non-null orientation quaternion** at 30 Hz or more, and (c) keep doing so **while the camera stream runs** in the same session? The docs do not answer (c) ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)). A 30-minute device test logging both streams settles it. If any answer is no, drop it. Find mode in #1 keeps the reach idea.

### 4. Teardown Memory + Step Check scoreboard (`teardown-memory`, absorbing `step-check`)
- **Concept.** An ArUco work mat and a numbered parts tray. Hand-in and hand-out before/after diffs log each removal as "from (x,y) to tray cell k" with crops, building an ordered disassembly graph on the phone. Reassembly plays the graph in reverse, with a verify diff per step. A visitor misplaces parts and a **scoreboard of caught and missed errors and false alarms** (from `step-check`) is the in-demo evidence. The LLM labels parts asynchronously, and only crops are uploaded. MVP as in _candidates.md plus the scoreboard.
- **Why it serves its objectives.** It is the peer-table alternative to `did-i`: a live timeline, and the bystander takes part without wearing the glasses (demo 77, `step-check` 79). Meta lists repair and "capture and logging" among the uses it encourages (meta-judge.md). Its weak spot is repeat use (investor 50). The pitch must name repair cafés and people with working-memory difficulty, and must not overclaim habit.
- **Hardest assumption (spike).** With a head-mounted camera at 504x896 and 7 fps and natural head motion, can ArUco registration plus hand-out diffs assign at least 90% of removals of parts 1 cm or larger to the correct device location and tray cell, at a working distance of 40-60 cm? That is the ArUco detection distance that _candidates.md says must be tested in hour 1.

### 5. Nod (`nod`)
- **Concept.** The world is the symbol board. Head dwell selects the centred object, an on-phone embedding names it ("juice?"), and a per-user calibrated nod or shake from the IMU confirms or rejects. Output is a spoken request (with ElevenLabs voice) or a mocked or real smart plug. MVP and the false-accept evaluation (5+ users) are as in _candidates.md.
- **Why it serves its objectives.** It has the strongest accessibility story (meta-judge C4 22) and fills the motor gap in Meta's showcase (opportunity.md §1). It shares its Motion gate with #3, so it adds almost no spike cost.
- **Hardest assumption (spike).** Only if #3's Motion check passes: on glasses IMU data, can a rule-based nod and shake classifier, after 10 s of calibration, catch at least 90% of intended nods while producing at most 1 false accept per 5 minutes of conversational head motion, across 5 people? Record 5-minute sessions of chatting with the glasses on, then replay them through the classifier.

**Reserve:** `private-hand`, if the Motion gate removes #3 and #5. **Not shortlisted:** everything else in §3.

## 7. Answers per objective, and how the spikes decide them

| Objective | Pick | If its spike fails |
|---|---|---|
| (1) Meta challenge award | `panel-reader` + Find | `did-i`. If Motion passes and the panel spike fails, consider `beacon` |
| (2) Overall win | `did-i` (with the bystander demo) | `teardown-memory` + scoreboard |
| (3) Combined | `panel-reader` + Find | `did-i` (only 2.2 points behind in the combined view) |

The two leading picks are both GA-only and both work on Mock Device Kit (_candidates.md). So the general platform risks, such as device allocation, one-account pairing, the one-app Developer Mode registration and country gating (feasibility.md §4, §10), affect them equally. Those risks are a go/no-go for the challenge, not for the idea.

**Stackable tech challenges for the top five** (from `_tech-challenges.md`). Gemini API fits panel registration, the did-i verifier, beacon grounding and teardown part labels. It requires every team member to be 18 or older (CHALLENGES.md:L2518). Codex fits all five as part of the development process. ElevenLabs fits `nod` honestly, because the user's spoken voice is the output. Gemma fits only if a model runs on the phone fast enough, which is unknown.

## 8. Sources used
- CHALLENGES.md:L878-946. 00-rules-and-jury.md. _tech-challenges.md. 02-research/ai-glasses/{feasibility, opportunity, competitive}.md. 04-ideas/_candidates.md. The five evaluator reports in this folder.
- [DAT motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion), opened for this report. It covers beta channels, nullable orientation, rates as targets, no permission prompt and Mock `setMotionFeed`, and it is silent on concurrency with the camera.
- A web search for prior art on glasses-based teardown or reassembly tracking found only iFixit teardown guides such as [iFixit Oakley x Meta HSTN teardown](https://www.ifixit.com/News/112649/oakley-x-meta-hstn-smartglasses-teardown-cool-shades-tough-fix). No matching product was found. The search was shallow, so this is low confidence.
- All weighted scores, thresholds in the spike questions and the sponsor column are **my estimates**.

<!-- complete -->
