# Ideas from the "hands-busy work" angle: Meta AI Glasses challenge

**Summary**
- These are seven concepts for people whose hands and eyes are already busy: repair, lab work, technician rounds, professional kitchens, inspection, culinary training and care work. They are ranked by our estimate of their chance of winning. Most share one mechanism. A **printed fiducial mat (ArUco markers) fixes the workspace**, so the phone can register each low-resolution glasses frame to it and **diff the workspace before and after the hand enters**. The phone detects what changed locally, at low latency. The cloud LLM only *names* what changed, outside the critical path. The mat also acts as the **privacy boundary**: everything outside it is cropped away before anything leaves the phone.
- **The two bets:** (1) **Teardown Memory**, a disassembly recorder that guides reassembly in reverse order. It is the most legible "wow" at a peer-review table, it is an everyday consumer case, and it has a clean measurable before/after. (2) **Step Witness**, the same engine pointed at a written protocol. It catches a skipped or wrong step as it happens, so it is a proactive, measurable error detector for gloved lab work. One engine serves both, so the team builds one core and keeps a fallback demo.
- **Safest hedge:** **Glance Log**. A technician looks at a meter and it is logged, with no speech or touch. It has the lowest technical risk but the smallest "wow".
- **Every concept is designed to the documented SDK limits.** They use the DAT camera stream at 504x896 or 360x640 and 7 fps, plus on-phone CV, TTS and optional Display cards. No concept depends on IMU or head-motion data, face identification, "Hey Meta" commands or Web App camera access. All can be demoed through Mock Device Kit with a recorded h265 clip or the phone camera if the glasses fail.

---

## 0. Ground rules these concepts respect (with sources)

| Constraint | Consequence for concepts | Source |
|---|---|---|
| Value must come from the first-person view, "beyond simply mirroring a phone screen"; "hands-free, in-the-moment value" | Each concept uses what the wearer looks at while their hands work | CHALLENGES.md:L886, L890, L894, L906 |
| Prototype must handle "permissions, errors, performance trade-offs, connectivity, and device state changes"; consent and safe data are "part of the demo" | Each MVP includes a visible state machine and a data boundary | CHALLENGES.md:L900, L902, L906 |
| Judging is 25% each: creativity/use case, technical execution, real-world value/feasibility, UX (input, accessibility, trust) | Scored per concept below as C / T / V / U | CHALLENGES.md:L934-937 |
| Audio-first and Display count equally | Every concept is audio-first on RBM Gen 2. Display cards are a stretch | CHALLENGES.md:L898 |
| Camera and mic only via DAT (native app). Web Apps have no camera or mic | All concepts are DAT phone apps | feasibility.md §2, citing https://wearables.developer.meta.com/llms.txt |
| Stream: 720x1280, 504x896 or 360x640 at 2-30 fps, Bluetooth-limited, auto-degrades. Design point is 360x640 at 2-7 fps in a crowded hall | CV must work at low resolution and low fps, so we use large fiducials and coarse objects | feasibility.md §3, §5 (streaming docs) |
| End-to-end cloud "ask, then answer" latency is about 2-5 s (estimate) | Real-time alerts must be decided **on the phone**. The LLM only labels, asynchronously | feasibility.md §5 |
| Display + photo capture is buggy ("Don't combine capture with display capabilities") | Key frames come from the **stream**, not photo capture | feasibility.md §5 (known issues) |
| Speech (beta) silently stops after about 1 minute. Inputs are lost after re-donning | Use HFP mic and phone ASR with a watchdog, plus a phone-button fallback | feasibility.md §3, §5 |
| Motion/IMU: the Connect recap claims "motion tracking", and a trade site lists motion as experimental. The DAT 1.0 integration overview I opened lists no motion or IMU capability | **Do not depend on IMU.** Head stillness and motion are estimated from video (optical flow and frame-to-mat registration) | opportunity.md table; https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/build-overview (opened: lists camera, photo, HFP mic, speakers, tap/doff/hinge inputs, display, registration; no motion) |
| AUP: no face or voice identification; no obscuring the LED; no use in sensitive locations; "narrow purpose, short retention, obvious to bystanders" | Concepts crop to the workspace and never identify people | feasibility.md §6 |
| Meta's acceptable-use guide encourages hands-free capture and logging, motion and coaching, and enterprise workflows | Fits this angle directly | feasibility.md §6 |
| Battery: continuous camera use reportedly cuts Gen 2 runtime to about 1 hour (secondary reporting, not a Meta spec) | Design for **10-30 minute task sessions**, not full shifts | web search summary citing Android Central via https://www.emarketer.com/content/ray-ban-meta-smart-glasses-on-device-assistant--with-battery-life-limitations (not opened; treat as estimate) |
| Meta's own Live AI (continuous camera assistant) exists. A reviewer found it "more of a novelty" with few daily uses | The built-in baseline is generic, conversational and stateless about the task. Our concepts are task-stateful | https://www.engadget.com/wearables/ray-ban-meta-2nd-gen-review-smart-glasses-are-finally-getting-useful-124720393.html (opened) |
| Grant-funded verticals already exist: field-service notes (Onsite), construction trade coaching, roadside mechanic copilot, accessibility-barrier documentation | Avoid "generic field-service copilot". Pick a narrow mechanism | competitive.md, citing https://about.fb.com/ai-glasses/ |

### The shared core engine (used by concepts 1, 2, 5, 6 and 7)
1. **Fiducial workspace.** An A3 mat (or tape on a board or tray) with 4-8 large printed ArUco markers. OpenCV's ArUco detector gives the mat's homography in each frame, so every glasses frame is warped to a fixed top-down "mat coordinate" image, whatever the head pose. Large markers should be detectable at 360x640 (estimate; **test in hour 1**).
2. **Hand-in / hand-out events.** A hand detector runs on the phone (MediaPipe Hands, or skin and motion mask fallback). A "touch event" is the hand entering a region of the mat and then leaving it.
3. **Before/after diff.** Compare the rectified mat image just before the hand entered with the one just after it left. The diff mask shows **what changed and where**: a part removed, a token added, an item moved. This is cheap, local and explainable, and needs no model training.
4. **Async naming.** The diff crop (not the frame) goes to a vision LLM: "what object was removed / added?". Results arrive 2-5 s later (estimate) and annotate the log. The alert path never waits for the cloud.
5. **Privacy boundary.** Only rectified mat crops can leave the phone. Faces, screens and the room outside the mat are never uploaded. This is measurable: bytes and pixels uploaded compared with a naive frame-upload baseline.
6. **Robustness layer** (required by L900): stream degradation lowers fps without breaking diffs; marker loss triggers "look at the mat"; PAUSED/STOPPED, doffed, hinge-closed, permission denied, offline (naming is queued, detection continues) and thermal warnings are all handled. A Mock Device Kit h265 replay drives the same pipeline (feasibility.md §3).

**Why this is the defensible insight (for Beer, Timo and Daksh):** the obvious approach streams video to a multimodal LLM and asks "what happened?". That is slow (seconds), forgetful (no task state), costly, and it uploads everything. Ours turns the first-person view into a **registered, diffable workspace**. The phone knows *that* and *where* something changed within a fraction of a second (estimate), and the model only answers *what*. That is the 10x: event latency, upload volume and determinism, each measurable against the naive baseline.

---

## 1. Teardown Memory: "undo history" for anything you take apart

**1. User and moment.** A person repairing something at home or at a repair café: a laptop with 11 screws of 3 lengths, a bicycle brake, a coffee grinder. The moment: 40 minutes later, a part is replaced, the bench is covered in screws, and they cannot remember which screw went where or what order the bracket and the cable came off in. Leftover screws and stripped threads follow. Secondary users: people with working-memory difficulties (ADHD, older adults) who avoid repairs for exactly this reason. That fits the brief's "people with all abilities" (CHALLENGES.md:L890, L902).

**2. Why existing options fail.**
- *Phone:* you stop, wipe your hands, unlock, take a photo and pick the screwdriver back up, at every step. People skip it after step three (estimate, to be checked with testers). Photos carry no order, no "where it went on the tray", and no link between part and hole.
- *Magnetic project mats with a pen grid* (e.g. iFixit-style mats): these depend on discipline and capture no images. Whether iFixit's mats use this exact design is unknown (not checked).
- *Built-in Meta AI / Live AI:* conversational and with no persistent model of the task. It cannot answer "what came off before the bracket?" 30 minutes later, and Engadget's reviewer found Live AI a novelty (URL above).
- *Video recording:* a 40-minute video cannot be searched while your hands are greasy.

**3. Novel mechanism.** The shared engine with two mats: a **work mat** (where the device sits) and a **parts tray** with numbered fiducial cells. Each removal is a pair of diffs: *removed from position (x,y) on the device* and *placed in tray cell k*, timestamped, with before/after crops. The result is an automatic, ordered **disassembly graph**. Reassembly plays it **in reverse**. For each step, the glasses say "Step 7 of 11: the short silver screw from tray cell 4 goes top-left". The phone or Display shows the before-crop with the hole circled. A **verify step** diffs the current state against the recorded "before removal" crop and confirms "matches" or says "that hole is still empty". The LLM labels parts ("M2 x 4 mm screw", "ribbon cable") asynchronously. Labels are nice to have; the order and position data come from geometry.

**4. Why the glasses are essential.** The camera points where the hands work, at eye height, for the whole session, with no rig. An overhead phone on a tripod is the strongest alternative baseline. It can see the bench, but it needs a stand and setup, it does not see inside the device when you tilt it toward yourself, and it cannot speak the next step into your ear while you hold the part. Audio-first output keeps eyes on the screw. Input is a touchpad tap ("next") or voice ("repeat", "undo"), with no hand on the phone.

**5. 30-second table demo.** Props: a small object with 4-6 distinct parts (a LEGO Technic assembly or a 3D-printed box with 3 screw types), the two mats and a phone cast to a laptop screen with large text. The wearer removes 3 parts in front of the observer and drops them in tray cells. The screen fills a timeline live: "1: long black screw → cell 2", with the crop. Then the observer jumbles nothing; the wearer taps "reassemble". The screen and an audible chime show "Step 1 of 3: grey bracket from cell 3 goes here", with the location circled on the before-image. The observer can put the bracket in the wrong place, and the verify step says "doesn't match: rotate 180°". The noisy room does not matter, because everything key is on screen and the chimes are loud.

**6. Hardest risk.** Diff reliability at 360x640 when hands, shadows and head motion are present. Small screws (2-3 mm) may be below the resolution limit (estimate). Mitigation: the tray cells give coarse localisation even when the screw itself is too small to see; demo parts are at least 1 cm; the diff threshold is tuned on our own recordings. Second risk: getting a device in time (feasibility.md §4). **Does the demo survive without glasses?** Yes. Mock Device Kit with the phone camera (phone held at head height or on a head strap) runs the identical pipeline, and a pre-recorded h265 glasses clip proves the real-device run (feasibility.md §3, §8).

**7. Smallest complete MVP.** An iOS or Android DAT app: stream at 504x896 and 7 fps → ArUco registration → hand in/out → diff → ordered log with crops → reverse playback via TTS and phone card → verify diff → state machine (permission, pause/stop, doffed, marker lost, offline with queued labels) → "session data deleted at end" toggle with an upload counter. LLM labelling is optional.

**8. Fit.**
- *Meta criteria:* **C** high (task memory from the first-person view; not seen in competitive.md); **T** high (on-device registration and diffing, async LLM, degradation ladder); **V** medium-high (pilot: Helsinki-area repair cafés or a city library maker space; whether one is available is **unknown**, so ask); **U** high (audio-first, tap or voice, memory-support framing, crop-only uploads).
- *Juror lenses:* Kia (a real recurring frustration), Beer and Timo (register-and-diff insight versus video-to-LLM), Daksh (baseline: reassembly errors and leftover parts, with and without, on 3-5 testers; metric: wrong-position steps per teardown, hard to game), Otto (every repair session is a return trigger), Arturs (latency, upload bytes and failure modes measured).
- *Tech challenges, honestly:* **Gemini API** (part labelling and the step narration in the core flow; team must be 18+, _tech-challenges.md row 9), **ElevenLabs** (spoken steps: audio-first is the product), **Codex** (dev workflow). **Gemma** only if on-device labelling works (unknown speed).

---

## 2. Step Witness: catches the skipped step while you are wearing gloves

**1. User and moment.** A lab technician or biology student running a manual plate protocol: "add 50 µl buffer A to wells 1-8, then reagent B to wells 1-4". They are gloved, sterile, often interrupted. The moment: a colleague asks a question mid-protocol, and they come back unsure whether well 3 got reagent B. They either repeat the whole run (hours and consumables lost) or guess. The same pattern applies at home: baking with scaled quantities ("did I already add the salt?"), or mixing a two-part epoxy or fertiliser dose.

**2. Why existing options fail.** Paper checklists rely on self-report: you tick what you *think* you did. Touching a phone or tablet with gloves breaks sterility. Electronic lab notebooks are filled in after the fact. Built-in Meta AI answers questions but holds no protocol state and does not interrupt on its own (competitive.md: the commodity pattern is user-initiated ask and answer; opportunity.md §3). Pipetting robots cost far more than this (estimate) and do not cover manual work.

**3. Novel mechanism.** The protocol is compiled into a **state machine of expected workspace changes**, each with a target region and expected change type (a token, a liquid level or colour in a well, an item moved). The shared engine yields observed change events, and a matcher assigns each to the expected step. A **deviation** (wrong region, out of order, a step skipped when the next one starts) raises a spoken alert locally, without waiting for the cloud. Each confirmed step stores a before/after crop as **evidence**, so the run produces an audit trail ("well 3, reagent B, 14:02:11"), which is the start of an ELN entry. The LLM is used only offline, to compile the plain-text protocol into the state machine (with human confirmation) and to label ambiguous events.

**4. Why the glasses are essential.** Gloved and sterile hands rule out touch. The camera sees the plate from the operator's eye line, which is where the work happens. Speech output keeps eyes on the pipette tip. An overhead camera is again the baseline. Labs do have fixed cameras in some setups (unknown how common); glasses need no installation and travel between benches.

**5. 30-second table demo.** Props: a 6-well tray (an egg box works) on a fiducial mat and coloured tokens or beads, with a printed 5-step "protocol" card visible to the observer. The wearer follows the steps, and the screen ticks them off with crops. The observer is invited to call out a step to skip or to say "put blue in well 4 instead of well 3". Within about a second (estimate) the chime sounds and the screen shows red: "Step 3: blue expected in well 3, seen in well 4." Then show the counter: "detected 1/1 injected errors, 0 false alarms this run".

**6. Hardest risk.** Liquids are hard to see at 360p (small volumes, transparent). The real-lab version needs coloured reagents or relies on the hand/pipette tip entering a well region as the event (estimate). The demo uses tokens or coloured water in large wells. A second risk: does a lab audience at Meta see this as "everyday"? Mitigation: present it as "any procedure you do with your hands", with lab as the pilot and baking at home as the everyday story. **Survives without glasses:** yes (Mock Device Kit, phone camera, or recorded clip).

**7. Smallest complete MVP.** The shared engine plus a hand-authored JSON protocol (no LLM compile step) → step matcher → local alert TTS → evidence log with crops, exportable as CSV/PDF → the same state machine and privacy boundary. Stretch: LLM protocol compilation from pasted text.

**8. Fit.**
- *Meta criteria:* **C** high (proactive, not ask-and-answer; opportunity.md §3 says few public projects do this); **T** high (local real-time matcher); **V** medium-high (pilot: a university teaching lab at Aalto or the University of Helsinki, which is plausible but **unconfirmed**); **U** high (no touch needed, gloves OK, crop-only uploads, every alert explainable with a picture).
- *Juror lenses:* **Daksh** is the strongest fit (injected-error recall and false alarms per run on held-out scripted runs; "can the metric be gamed?" is answered with blind error injection by an observer), Arturs (hard constraint: sub-second alert over a Bluetooth stream), Kia (wasted runs are a real cost), Beer.
- *Tech challenges:* Gemini API (protocol compilation and labels), Codex, ElevenLabs (weak; only if voice quality matters). **Modal or Verda** only if we fine-tune a well/token detector, which is not needed for the MVP.

---

## 3. Glance Log: look at the meter for one second, and it is logged

**1. User and moment.** A building maintenance technician (in Finland, typically a housing-company service technician) doing monthly rounds: heat distribution room, water meters, pressure gauges, a filter differential gauge. The moment: in a cramped basement with a torch in one hand and a key ring in the other, they write 30 readings on paper and retype them in the van, or type each into a phone with cold fingers. Transcription errors and skipped meters follow (estimate; not measured).

**2. Why existing options fail.** The phone means pull it out, open the app, find the asset, type, at every meter. Smart meters cover only part of the installed base (estimate). Built-in Meta AI can read a display if asked ("Hey Meta, what does this say?"), but that costs a spoken query per meter and returns no structured record, no asset ID and no range check, and "Hey Meta" commands are not exposed to third-party apps (competitive.md, citing vr.org). Field-service note apps are grant-funded verticals (Onsite, competitive.md), but they record notes, not dwell-captured readings.

**3. Novel mechanism.** **Dwell-to-capture without IMU.** Head stillness is estimated from inter-frame optical flow on the stream (because IMU access is not documented, §0). When the view is stable for about 0.8 s **and** a meter-like region or an asset QR/fiducial tag is in the centre, the app grabs the best of the last few frames (sharpness score), crops and reads it. Seven-segment and LCD readings go through on-device OCR first, with the LLM as fallback. Analog dials go to the LLM with a "needle angle to value" prompt plus a scale-calibration crop. The reading is checked against the **asset register** (expected unit, plausible range, delta from last month). It is spoken back as "Substation 2 supply temp, 68 degrees, logged" or "that's 40% above last month, confirm?". Confirm or reject by touchpad tap. The output is a structured round log.

**4. Why the glasses are essential.** The meter is where the eyes already go, and dwell is the natural "I'm reading this" signal. Hands stay on the torch and keys. No other device turns looking into data entry.

**5. 30-second table demo.** Props: 5 printed meters (2 digital, 2 analog dials, 1 with an out-of-range value), each with a small QR asset tag, taped to the table edge. The observer is told the round order. The wearer glances at each for a second, and the screen table fills: asset, value, unit, status. The out-of-range one turns amber and the glasses chime. Then the baseline: the observer types the same 5 values into a phone form with a stopwatch running. The comparison is time and errors.

**6. Hardest risk.** Analog gauge reading accuracy by vision LLMs from 360-504p crops. It may be poor; that is **unknown** until tested on our own prints. Mitigation: start with digital displays plus QR, treat analog as stretch, and **report accuracy honestly** per meter type. Also the dwell trigger's false captures. Glare in basements is untestable at the venue. **Survives without glasses:** yes (mock and phone camera; recorded clip).

**7. Smallest complete MVP.** Stream → optical-flow dwell detector → QR asset ID → crop → OCR or LLM → register range check → TTS confirm → CSV round log → state machine and privacy (crop-only uploads).

**8. Fit.**
- *Meta criteria:* **C** medium (reading is commodity; dwell-triggered structured logging is not); **T** medium-high; **V** **high** (clear B2B pilot: a property-maintenance company; a specific Finnish partner is **unknown**); **U** high (zero-touch input; also helps users with limited hand dexterity log readings).
- *Juror lenses:* Umar and Kia (obvious first user and adoption path), Daksh (reading accuracy and time per reading versus manual baseline), Arturs. Weaker on the peer-floor "wow".
- *Tech challenges:* Gemini API (analog reading), Codex. **Tiger Data or Aiven** (time-series of readings) is plausible but adds little to the demo.

---

## 4. Cross-Contact Sentinel: allergen contamination tracking on a prep line

**1. User and moment.** A line cook preparing an allergen-free order during service. The moment: they scoop peanut sauce with a spoon, get distracted by a ticket, and use the same spoon on the "no nuts" bowl. Nobody notices.

**2. Why existing options fail.** Colour-coded utensils and boards rely on attention under stress. That this convention is widespread is our assumption, not verified. A phone cannot watch the line. Built-in Meta AI does not track which utensil touched what over time.

**3. Novel mechanism.** **Contamination propagation graph.** Utensils carry coloured tape or a small fiducial sticker. Containers sit in mat zones marked "allergen" or "safe". Contact events (utensil tip entering a zone, detected locally) propagate an "allergen-tainted" state from container to utensil to the next container, as a small taint-tracking system. An alert fires locally when a tainted utensil enters a safe zone. A wash station zone clears the taint. Every alert has before/after evidence crops for the HACCP log.

**4. Why the glasses are essential.** The cook's own view follows their hands along the line. A fixed camera would need a rig over every station.

**5. 30-second table demo.** Two bowls on a mat: one under a purple "PEANUT" label, one "SAFE". There is a spoon with tape and a "wash" cup. The observer is invited to do anything. Scoop peanut, then touch safe: immediate chime and a red banner "spoon tainted, SAFE bowl now suspect". Dip in wash, and it clears. This is very legible and visibly real-time.

**6. Hardest risk.** Utensil-tip tracking at 7 fps through steam and fast hand motion; false negatives in a safety-critical framing. It must be pitched as a **second pair of eyes plus a log, never a guarantee**, or the trust criterion backfires. Pilot realism: continuous streaming reportedly lasts about an hour on battery (§0), which is far short of an 8-hour service. That makes it a training or high-risk-order tool, not all-shift. **Survives without glasses:** yes.

**7. Smallest complete MVP.** The engine with 3 zones (allergen, safe, wash) and 1-2 tagged utensils → taint graph → alerts → log.

**8. Fit.**
- *Meta criteria:* C high, T high, V medium (battery limits the shift-long pilot), U medium (safety claims are delicate).
- *Juror lenses:* peer-floor wow (strong), Daksh (recall on scripted contaminations), Kia.
- *Tech challenges:* Codex. Gemini only marginal (the core is local CV).

---

## 5. Coverage Inspector: an inspection you can prove was complete

**1. User and moment.** A rental or car-sharing return inspector, a tool-rental counter, or a property manager doing a move-out check. The moment: they walk around the item, miss the underside or a corner, and the damage is disputed later.

**2. Why existing options fail.** Phone photo walk-arounds exist and are standard practice (estimate), but they occupy both hands and do not prove coverage. Accessibility-barrier and field-service documentation on glasses is already grant-funded (United Spinal, Onsite; competitive.md), so "voice notes plus photos" alone is not new.

**3. Novel mechanism.** **Coverage map.** The item type has a zone model (for example a laptop: lid, base, 4 edges, screen, keyboard; a car: 8 panels). Each zone is defined by reference views. Incoming frames are matched to zones on the phone (small image-embedding model or fiducial stickers per zone; on-device speed is **unknown** until tested). A zone counts as "covered" only if it was seen sharp, close enough and long enough. Voice remarks ("scratch here") are attached to the zone in view. The inspection cannot be closed until coverage reaches 100% or a gap is explicitly waived. The report is the coverage map plus evidence crops.

**4. Why the glasses are essential.** The inspector's gaze *is* the inspection, and it is recorded as coverage. The hands are free to tilt the item.

**5. 30-second table demo.** A laptop or toolbox with 6 small zone stickers. The wearer "inspects" while skipping the bottom. The screen shows 5 of 6 zones green; the glasses say "bottom not inspected". The observer flips the item, and it turns 6/6 green with the remark pinned.

**6. Hardest risk.** Zone recognition without stickers is hard. With stickers it works but feels artificial for cars. Lower wow than concepts 1, 2 and 4. **Survives without glasses:** yes.

**7. Smallest complete MVP.** Sticker-based zones → coverage tracking → voice remarks via phone ASR → PDF report.

**8. Fit.** C medium, T medium, V medium-high (rental pilot), U medium-high. Juror lenses: Umar, Daksh (missed-zone rate versus phone walk-around). Tech challenges: Gemini (damage description), Codex, Cloudinary (media-heavy report; its criteria require more than a CDN, _tech-challenges.md row 16).

---

## 6. Cut Check: objective knife-skill feedback for culinary students

**1. User and moment.** A vocational culinary student practising brunoise (3 mm dice). The moment: an instructor glances at the board once per session, and the student gets one subjective comment for 40 minutes of practice.

**2. Why existing options fail.** A phone photo could measure pieces, but onion-wet hands and a knife make stop-and-photo impractical every batch (estimate). Built-in AI gives qualitative comments, not millimetres.

**3. Novel mechanism.** A fiducial cutting board provides **metric scale**: the homography gives mm per pixel. Each time the wearer looks down at a finished pile with their hands off the board, the phone segments the pieces and computes the size distribution and the coefficient of variation against the spec. It speaks one actionable line ("62% within ±1 mm; your largest pieces are on the left, from the root end"). Progress is tracked per session.

**4. Why the glasses are essential.** The hands are wet and holding a knife, and the camera already looks at the board.

**5. 30-second table demo.** Pre-cut foam or carrot cubes of mixed sizes (no knives at the table) poured on the board. A glance gives a histogram on screen and a score. The wearer removes the 3 oversize pieces, and the score goes up live.

**6. Hardest risk.** Segmenting touching pieces at 504p; the mm accuracy needs validating against callipers. The peer-floor appeal is niche. **Survives without glasses:** yes.

**7. Smallest complete MVP.** Board homography → segmentation (classic CV) → size histogram → TTS feedback → session chart.

**8. Fit.** C medium, T medium, V medium (pilot: a cooking school, **unknown**), U medium. Juror lenses: Daksh (calliper ground truth), Otto (daily practice loop). Tech challenges: Codex. Gemma possibly for the feedback text.

---

## 7. Dose-Box Double Check: a second pair of eyes for home-care medication filling

**1. User and moment.** A home-care worker who fills a client's weekly pill organiser alone, then rushes to the next visit. The second check that a pharmacy would require (estimate) does not exist at home.

**2. Why existing options fail.** Paper lists rely on self-checks. Pharmacy machine-dispensed pouches do not cover every client (estimate).

**3. Novel mechanism.** The engine on a fiducial organiser tray. Each pill drop is a diff event in compartment (day, time), matched against the medication list by count, colour and shape. Mismatches are flagged locally, with an evidence log for the care record.

**4. Why the glasses are essential.** Gloved hands, and work in the client's home with no rig.

**5. 30-second table demo.** A 7x2 organiser with coloured candies as "pills". The observer drops one extra into Tuesday evening, and an alert sounds.

**6. Hardest risk.** **Scope and policy.** opportunity.md records that the team excluded healthcare scope. The AUP forbids sensor use in sensitive locations (feasibility.md §6), and a client's home may count. Medication safety claims are high-stakes. Distinguishing pills by look at 360p is unreliable (estimate). **Survives without glasses:** yes, but the concept may not survive Meta's trust review. Listed for completeness from the "care work" angle; **do not pick**.

**7. Smallest complete MVP.** Same as Step Witness, with an organiser grid.

**8. Fit.** C medium, T medium, V high in principle, U **low-risk-adjusted** (privacy and safety). Tech challenges: none beyond Codex.

---

## Comparison (all scores are estimates, 0-5)

| # | Concept | Meta C | Meta T | Meta V | Meta U | Peer-floor wow | Measurable baseline | Demo risk | Shares core engine |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Teardown Memory | 5 | 4 | 4 | 4 | 5 | Reassembly errors, time | Medium | Yes |
| 2 | Step Witness | 4 | 5 | 4 | 4 | 4 | Injected-error recall and false alarms | Medium | Yes |
| 3 | Glance Log | 3 | 4 | 5 | 4 | 3 | Time and errors per reading | Low | Partly (dwell, crop) |
| 4 | Cross-Contact Sentinel | 4 | 4 | 3 | 3 | 5 | Contamination recall | Medium-high | Yes |
| 5 | Coverage Inspector | 3 | 3 | 4 | 4 | 3 | Missed-zone rate | Medium | No |
| 6 | Cut Check | 3 | 3 | 3 | 3 | 3 | Size CV versus callipers | Medium | Yes (homography) |
| 7 | Dose-Box Double Check | 3 | 3 | 4 | 1 | 3 | Fill errors | High (policy) | Yes |

## The two to bet on, and why

1. **Teardown Memory (best for the Meta award, for overall, and combined).** It is the most "everyone, everyday" concept in this set (anyone who takes something apart), so it maps onto L894 without a stretch. It shows a first-person capability Meta's assistant lacks: ordered, spatial task memory. Its table demo reads in under 30 seconds and lets the observer interact (place a part wrong and get caught), which is what the peer gate rewards (00-rules-and-jury.md §3, §7). The mechanism (register, diff, then name) gives the technical jurors a concrete "what did you figure out" answer, with latency and upload numbers against naive video-to-LLM. Biggest risk: diff reliability at low resolution. Prove it with a recorded clip in the first 4 hours.
2. **Step Witness (strongest on measured evidence; free once concept 1 exists).** It reuses about 80% of the Teardown pipeline (estimate) and adds a matcher. It shows proactive alerts and an injected-error recall metric, which is Daksh's and Arturs' language. If the pitch needs a sharper "real-world value" story than home repair, a lab pilot provides it. Practically, the team builds one engine and keeps two demo stories: Teardown for the peer floor, plus a Step Witness slide or mode for the Meta judges' "focused pilot" question. Do not ship both as separate products in the pitch; pick one headline by Saturday noon.

**Hedge:** if marker registration or diffing proves unreliable on real glasses by about hour 10, switch to **Glance Log**. It needs only dwell detection and crops, and it has a clear B2B pilot story.

## Open questions to settle on site (hour 0-2)
- Detection distance for ArUco markers on the real 360x640 and 504x896 stream (test with printed sheets at the booth).
- Whether any DAT motion or IMU data is actually exposed in SDK 1.0.1. Ask Dennis Punjabi (iOS DAT, CHALLENGES.md:L925). Our concepts do not need it, but it would improve dwell detection.
- Device allocation and the registration-collision questions from feasibility.md §10.
- Whether team members are all 18+ (Gemini API eligibility, _tech-challenges.md row 9).

<!-- complete -->
