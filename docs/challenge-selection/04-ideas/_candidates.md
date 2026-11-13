# Meta AI Glasses: consolidated candidate list

**Summary**
- Five generators (accessibility, everyday-consumer, hands-busy-work, capability-first, social-play-and-evidence) produced 35 concepts. After merging duplicates and dropping weak ones, **17 candidates** remain for the five judges to score. They are listed **alphabetically by id, not ranked**. The order carries no preference.
- Strong convergence, which is a novelty warning: **step verification during a task** came from 4 angles (merged into `step-check`), and **"Did I?" checkpoint verification** from 3 (`did-i`). **Look-and-nod**, **show-me-once**, **head-steered beacon to a target** and **group captions** each came from 2. The other 11 came from a single angle.
- Candidates that depend on **beta** capabilities say so: Motion IMU, camera-stream audio, Inputs and Speech are dev/beta-channel only and may return `CAPABILITY_DENIED` on loaner glasses. Each one names a GA-only fallback. No candidate relies on a capability the feasibility report calls unavailable (Web App camera or mic, "Hey Meta" commands, face or voice identification).
- Dropped: Breadcrumb (both versions), Read-Along, Badge Whisper, Mölkky Ref, Cut Check and Dose-Box. Merged in as features: Pot Watch, Fridge Glance and Checkpoint. Reasons are at the end.

---

## How to read this file

- Each candidate uses the generators' eight-point structure: (1) user and moment, (2) why existing options fall short, (3) mechanism, (4) why the glasses are essential, (5) 30-second table demo, (6) hardest risk and whether it works without glasses, (7) smallest complete MVP, (8) fit (Meta criteria, juror lenses, honest tech challenges). A header line gives the id, the source angles and the beta capabilities used.
- Full write-ups and more citations are in the generator files: `accessibility.md`, `everyday-consumer.md`, `hands-busy-work.md`, `capability-first.md` and `social-play-and-evidence.md` (all in this folder). A merged candidate keeps the strongest mechanism and demo from each version and names where each part came from.
- Meta criteria: C1 creativity, C2 technical execution, C3 real-world value, C4 UX/accessibility/trust, each worth 25% (CHALLENGES.md:L934-937). Juror names and the overall rubric come from 00-rules-and-jury.md sections 5 and 7.
- All scores, timings and accuracy figures in this file are **estimates** unless a source is given.

## Platform facts every candidate is checked against

| Fact | Source |
|---|---|
| Camera and mic are available only through DAT (native iOS/Android). Web Apps have neither | feasibility.md §2; [llms.txt](https://wearables.developer.meta.com/llms.txt) |
| Stream is 720x1280, 504x896 or 360x640 at 2-30 fps and degrades over Bluetooth Classic. Design for 360x640 at 2-7 fps in the hall (estimate) | feasibility.md §3, §5; [streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/) |
| End-to-end cloud "ask, then answer" takes about 2-5 s (estimate). Real-time loops must run on the phone | feasibility.md §5 |
| **Motion (beta):** accel, gyro, nullable magnetometer and **nullable** orientation quaternion ("Not every device produces it"), 5-60 Hz target (default 10 Hz). No permission prompt. Mock Device Kit replays CSV or in-memory samples. Dev/beta channels only | [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion) (opened for this report) |
| **Motion together with the camera stream in one session: not documented** (unknown). Stabilisation means the image "does not exactly track the head rotation" | motion guide (opened); camera-stream-processing guide via social-play-and-evidence.md |
| The SDK reports no camera intrinsics. Frames arrive undistorted, cropped to 9:16 | camera-stream-processing guide via accessibility.md and social-play-and-evidence.md |
| HFP mic is beamformed to the wearer's voice. Camera-stream audio is ambient, non-beamformed and **beta**. HFP must settle before the camera starts, or the route can fail silently | feasibility.md §3; [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) |
| **Inputs (beta):** double-tap gives `Select`, swipe gives `Nav`. Single tap and hold are reserved. `Back` is not delivered on real glasses, and the capability is lost when the glasses are re-donned | feasibility.md §3, §5; inputs guide via capability-first.md |
| Speech (beta) silently stops after about 1 minute | feasibility.md §5 |
| Display exists only on Ray-Ban Display (10 of the 20 units). 600x600, full redraw per send, and it should not be combined with photo capture | CHALLENGES.md:L914-915; feasibility.md §3, §5 |
| Whether A2DP output gives true left/right panning on the open-ear speakers is unverified, so no candidate depends on stereo | accessibility.md §0 (unknown); capability-first.md §0 lists A2DP as stereo |
| AUP: no identifying people by face or voice, no surreptitious capture, no "unwanted approaches", no sensitive locations. Principle: "narrow purpose, short retention, obvious to bystanders" | feasibility.md §6 |
| Mock Device Kit simulates the camera (phone camera or h265 file), permissions and device states | feasibility.md §3 |
| Already shipped or funded (novelty baseline): Meta AI label and object recognition, translation, navigation; Be My Eyes; Envision; captions on Display (search snippets only); grant-funded dementia aid, trade coaching, field-service notes and a language tutor | competitive.md; accessibility.md §0 |

Hour-0 booth questions that change several candidates at once: Is Motion enabled on the loaner devices? Can Motion and the camera stream run together? Do Gen 2 and Display report orientation? Is camera-stream audio enabled? Does Display ship live captions? (feasibility.md §10; capability-first.md closing questions.)

---

## Candidates (alphabetical by id; not ranked)

### `basket`: Basket, a shopping list that ticks itself off and checks allergens
*Sources: everyday-consumer (Bet 2), plus Fridge Glance (everyday-consumer #7) as a stretch. Convergence: 1 angle. Beta: none required.*

1. **User and moment.** A parent doing the weekly shop at a K-Market with a child who has a peanut allergy. One hand holds the basket and the other picks items. The list is on a phone they can't hold, and allergen print is tiny and in Finnish and Swedish.
2. **Why existing options fall short.** List apps need a free hand to tick items. Scanner apps need a deliberate scan for every item. Meta AI can answer "does this contain peanuts?" if asked (competitive.md: label recognition), but it does not know the list or the family's constraints and never speaks unprompted.
3. **Mechanism.** An on-phone **pick-up gate** fires only when a new object enters the hand region and moves toward the basket. The 2-3 sharpest frames from that event go to a VLM, which matches them against the list (fuzzy and multilingual, by category rather than SKU) and against the household constraint profile. The app is **silent by default**: a chime on tick-off, and speech only for a conflict ("contains hazelnut, Leo avoids"), an extra item, or the exit summary ("you still need eggs"). Stretch (from Fridge Glance): an "open fridge" gate keeps a running home inventory, so the list can pre-fill itself.
4. **Why the glasses are essential.** The trigger is the wearer's own hand taking an item, seen from their eyes, while both hands are busy. A phone in a pocket sees nothing.
5. **30-second demo.** Six grocery items on the table, four of them on the phone list. Picking the oat drink gives a chime and a tick. Picking a nut bar gives "Contains hazelnut, Leo avoids". At the end: "You still need eggs". The phone shows uploads against frames streamed (for example 6 / 900).
6. **Hardest risk.** Reading allergen text at stream resolution (it may need "hold it closer" or the 720p tier), and recognising products without a SKU database. Works without glasses via Mock Device Kit and a recorded clip.
7. **MVP.** A list and one profile, the pick-up gate, match/conflict/extra outputs, an exit summary and error states. Evaluation: tick-off precision and recall and allergen recall on a recorded 30-item shop, against a "VLM on every 2 s frame" baseline.
8. **Fit.** C3 and C4 (silent-by-default UX, low-vision label reading, frames not stored), with a pilot story via a Finnish retailer or the allergy federation (not contacted). Weaker C1, since shopping and nutrition scanners are on the "teams will reach for this first" list (competitive.md). Jurors: Kia, Otto (weekly ritual), Umar, Daksh. Tech: Gemini API, Codex, ElevenLabs (light). Context.dev or Oxylabs only if allergen data is genuinely fetched live.

### `beacon`: Point and Find, a head-steered audio beacon to a chosen object
*Sources: Homing (accessibility, Bet 2) and Point Here (social-play-and-evidence, Bet 1). Convergence: 2 angles, with the same IMU-bearing core. Beta: **Motion** (core), Inputs optional.*

1. **User and moment.** A blind or low-vision person who needs one specific item: "the oat milk, not the regular one", the ticket machine, their bag, a dropped pill. The target is chosen in one of two ways, and choosing between them is for the judges and the build plan: **(a) self-named** ("find the Fanta", from Homing), or **(b) helper-tapped**, where a family member on a call taps the item in the wearer's live view (from Point Here).
2. **Why existing options fall short.** Meta AI gives one-shot verbal directions ("on your left"), which go stale as soon as the head moves. Be My Eyes on Ray-Ban Meta gives a helper the POV but only **voice** guidance over lagging video ([Be My Eyes](https://www.bemyeyes.com/news/be-my-eyes-and-meta-launch-new-accessibility-functions/), via social-play-and-evidence.md). Seeing AI Find My Things is phone-based and has to be taught each object in advance (accessibility.md, snippet).
3. **Mechanism.** **Slow grounding, fast IMU tracking.** A target pixel, from a ~1 Hz open-vocabulary detection or from the helper's tap, is converted to a **world bearing** using a self-calibrated pinhole focal length (the SDK gives no intrinsics) and the orientation quaternion at that frame. Between detections the cue updates from the IMU alone at 30-60 Hz: pitch and pulse rate rise as the head closes the angle (a mono "Geiger" cue, because stereo is unverified). Re-anchoring happens only on near-still-head frames (low gyro magnitude), to cope with the stabilisation offset, plus an on-phone template tracker. A "within reach" lock chime fires when the target is centred and large enough. The cue's latency is the IMU's, not the cloud's or the video link's.
4. **Why the glasses are essential.** The head is the pointer and the IMU measures it directly. Both hands stay free for the cane, the dog or the reach. A phone's pose is not the user's gaze.
5. **30-second demo.** Five similar cans or cups on the table, with a blindfolded peer wearing the glasses. Variant (a): the peer says "find the Fanta". Variant (b): a reviewer taps one cup on our phone. The tick speeds up, a lock chime sounds, and the peer touches it. The screen shows a top-down yaw radar and time-to-touch, next to a voice-only or Meta AI baseline round.
6. **Hardest risk.** **Motion is beta** and may be gated. **Orientation is nullable** on some devices, and running Motion together with the camera stream is undocumented (motion guide, opened). There is also bearing error from our own calibration. GA-only fallback: visual-only tracking at 7-15 fps (slower, still works). Without glasses: the phone camera plus phone IMU behind the same interface is honest only if labelled, and Mock Device Kit IMU replay is deterministic, so live head turning needs a real device.
7. **MVP.** Target selection (voice or list, or a helper web page with WebRTC and tap; WebRTC is about 3-4 h, estimate), the bearing beacon, lock and reach confirmation, and states for IMU unavailable, lost target, offline and permission. Evaluation: about 20 trials per arm, with time-to-touch and success against the voice-only baseline.
8. **Fit.** C1 high (a new interaction: pointing inside the first-person view), C2 high (sensor fusion), C4 high (non-verbal cue). Strong peer-floor moment. Jurors: Beer (IMU latency against cloud latency), Daksh (time-to-target distribution with failures), Arturs (a hard latency constraint). Tech: Gemini API for grounding in variant (a) (box output to be checked on site), Gemma if run on-device (speed unknown), Codex.

### `coverage-inspector`: Coverage Inspector, an inspection you can prove was complete
*Source: hands-busy-work #5. Convergence: 1. Beta: none.*

1. **User and moment.** A rental-return, tool-rental or move-out inspector walks around an item, misses the underside, and the damage is disputed later.
2. **Why existing options fall short.** Phone photo walk-arounds take both hands and do not prove coverage. Voice-plus-photo documentation on glasses is already grant-funded (United Spinal, Onsite; competitive.md), so the novelty has to be coverage itself.
3. **Mechanism.** Each item type has a zone model defined by reference views or per-zone stickers. Frames are matched to zones on the phone, and a zone counts as **covered** only if it was seen sharp, close enough and long enough. Voice remarks attach to the zone in view. The inspection cannot close until coverage is 100% or a gap is explicitly waived. The report is a coverage map plus evidence crops.
4. **Why the glasses are essential.** The inspector's gaze *is* the inspection, logged as coverage, with both hands free to tilt the item.
5. **30-second demo.** A toolbox with 6 zone stickers. The wearer skips the bottom and the glasses say "bottom not inspected". The peer flips it and the map turns 6/6 green with the remark pinned.
6. **Hardest risk.** Zone recognition without stickers. With stickers it works but looks artificial, and the wow factor is lower. Works without glasses.
7. **MVP.** Sticker zones, coverage tracking, phone-ASR remarks and a PDF report.
8. **Fit.** C3 medium-high (a B2B rental pilot), C4 medium-high, C1 and C2 medium. Jurors: Umar, Daksh (missed-zone rate against a phone walk-around). Tech: Gemini (damage descriptions), Codex, Cloudinary (only if media handling is more than a CDN, _tech-challenges.md row 16).

### `cross-contact`: Cross-Contact Sentinel, allergen contamination tracking on a prep line
*Source: hands-busy-work #4. Convergence: 1. Beta: none.*

1. **User and moment.** A line cook scoops peanut sauce, gets distracted by a ticket, and uses the same spoon on the "no nuts" order.
2. **Why existing options fall short.** Colour-coded utensils depend on attention under stress (that the convention is widespread is an assumption). A phone cannot watch the line. Meta AI does not track which utensil touched what over time.
3. **Mechanism.** A **taint-propagation graph**. Utensils carry tape or a fiducial sticker, and containers sit in mat zones marked allergen, safe or wash. Contact events (a utensil tip entering a zone) are detected locally and propagate "tainted" from container to utensil to the next container. An alert fires the moment a tainted utensil enters a safe zone, and the wash zone clears it. Each alert keeps before/after crops for a HACCP log.
4. **Why the glasses are essential.** The cook's own view follows their hands along the line. A fixed camera would need a rig over every station.
5. **30-second demo.** A PEANUT bowl, a SAFE bowl, a taped spoon and a wash cup. The observer scoops peanut and touches SAFE: an immediate chime and a red banner. A dip in the wash cup clears it.
6. **Hardest risk.** Utensil-tip tracking at 7 fps. Safety-critical false negatives, so it must be pitched as "a second pair of eyes plus a log, never a guarantee". Battery: about 1 h of continuous streaming (secondary reporting via hands-busy-work.md §0, an estimate) against an 8 h shift, so it becomes a training or high-risk-order tool. Works without glasses.
7. **MVP.** The fiducial engine with 3 zones and 1-2 tagged utensils, the taint graph, alerts and a log.
8. **Fit.** C1 and C2 high, C3 medium (battery), C4 medium (delicate safety claims). Strong peer-floor wow. Jurors: Daksh (recall on scripted contaminations), Kia. Tech: Codex. Gemini is only marginal, since the core is local CV.

### `did-i`: Did I?, verified checkpoints for the things you always doubt
*Sources: Did I? (everyday-consumer Bet 1), Did I? (capability-first Bet 2), Checkpoint (accessibility #5), plus Pot Watch (capability-first #5) as an optional mode. Convergence: **3 angles**, so it is obvious to others too. Beta: none required (Motion and Inputs improve it).*

1. **User and moment.** Anyone who leaves home on autopilot and then, on the tram, doubts whether the stove is off, the door is locked or the pill was taken, and especially people with ADHD, acquired brain injury or checking anxiety (framed as everyday support, not treatment).
2. **Why existing options fall short.** A phone photo needs a free hand and a decision at the very moment you are on autopilot. Smart locks and plugs cover only the devices you replace. Lifelogging records everything, against Meta's "narrow purpose, short retention" (feasibility.md §6). Whether Meta AI has a photo-memory feature covering this is **unknown** (ask at the booth).
3. **Mechanism.** **Checkpoint verification, not recording.** Setup captures **safe and unsafe reference frames** per checkpoint (everyday-consumer). An **attention gate** decides when to look: a hand-on-object detector plus reference similarity, or IMU dwell when Motion is available (capability-first), or a tap. It keeps a 1-2 s burst, picks the sharpest frame, and a verifier returns `{object, state, confidence, time}`. Below a threshold it answers "not sure, here's the frame", because a false "off" is the dangerous failure. Only the verdict and a thumbnail are kept, and they auto-delete after 24 h. Other frames are dropped on the phone (accessibility's Checkpoint keeps only booleans). An optional exit-time summary says "keys not seen" (Checkpoint). Optional mode from Pot Watch: bind a timer to an object and glance at it to hear the time left.
4. **Why the glasses are essential.** The evidence is the wearer's own hands doing the action, seen from their eyes, with no extra act. A phone needs exactly the deliberate photo people on autopilot don't take.
5. **30-second demo.** A stove-knob prop and a deadbolt on a board. The peer turns the knob off and slides the bolt, and the phone ticks "Stove OFF 14:02". They ask "Did I turn off the stove?" and hear "Yes, off at 14:02" with the thumbnail. A negative run with the knob left on gives "No, it was ON". A counter shows 2 frames uploaded against about 60 for a naive 1 fps stream.
6. **Hardest risk.** Knob and bolt state at 360-504p with motion blur, and few-shot state rather than object recognition. Works fully without glasses (Mock Device Kit plus a recorded clip, or the phone camera).
7. **MVP.** Two checkpoints, the reference-capture flow, the gate, the verifier with a strict schema, a voice, tap or phone-button query, 24 h deletion, and visible states for permission denied, session STOPPED, stream degraded and offline-unsure. Evaluation: about 100 held-out bursts against a naive "describe the image" prompt baseline, with the false-"off" rate stated.
8. **Fit.** C4 very strong (the trust story *is* the design and matches Meta's acceptable-use guide), C3 strong (a daily trigger), C1 medium-high (risks being read as a "memory recorder"). Highest peer legibility in its source files. Jurors: Otto, Kia, Daksh, Beer. Tech: Gemini API (verifier), Gemma (only with an on-device verifier), Codex.

### `glance-log`: Glance Log, look at a meter for one second and it is logged
*Source: hands-busy-work #3 (hedge). Convergence: 1. Beta: none (dwell from optical flow; Motion optional).*

1. **User and moment.** A housing-company service technician on monthly rounds in cramped basements, with a torch in one hand and keys in the other, writing 30 meter readings on paper and retyping them later.
2. **Why existing options fall short.** A phone means pull it out, open the app, find the asset and type, at every meter. Meta AI can read a display when asked, but gives no structured record, asset ID or range check, and "Hey Meta" is not exposed to third parties (competitive.md).
3. **Mechanism.** **Dwell-to-capture.** Head stillness is estimated from optical flow (or the IMU when available), plus a QR asset tag in the centre. The best of the last few frames is cropped and read, by on-device OCR for digital displays or by the LLM for analog dials. The reading is checked against the asset register (unit, plausible range, change from last month), spoken back and confirmed by tap. The output is a structured round log.
4. **Why the glasses are essential.** The meter is where the eyes already go, and dwell is the natural "I'm reading this" signal. Looking becomes data entry.
5. **30-second demo.** Five printed meters with QR tags. The wearer glances at each for a second and the table fills. The out-of-range one turns amber and chimes. Then a stopwatch round typing the same values into a phone.
6. **Hardest risk.** Analog gauge accuracy from low-resolution crops is **unknown** (start with digital), plus false dwell captures. Works without glasses. Lowest technical risk of its source file, but the smallest wow.
7. **MVP.** Stream, dwell detector, QR ID, crop, OCR or LLM, range check, TTS confirm, CSV log, and the state machine.
8. **Fit.** C3 high (a clear B2B pilot; partner unknown), C4 high (zero-touch, which also helps limited dexterity), C1 medium. Jurors: Umar, Kia, Daksh (accuracy and time per reading). Weak peer-floor wow. Tech: Gemini API (analog), Codex. Tiger Data or Aiven are plausible but thin.

### `heads-up-sounds`: Heads-Up Sounds, non-speech alerts confirmed by looking
*Source: accessibility #4. Convergence: 1. Beta: **camera-stream audio** (core), Motion optional. Needs Ray-Ban Display for Deaf output.*

1. **User and moment.** A Deaf parent cooking with the extractor fan on misses the doorbell, the kettle clicking off and the child calling from behind.
2. **Why existing options fall short.** Android Sound Notifications alerts on a phone in a pocket and cannot say *which* thing made the sound (accessibility.md, snippet). Meta's captions cover speech in front of you, not sounds behind you.
3. **Mechanism.** **Audio detects, vision confirms.** An on-phone audio event classifier (YAMNet-class) runs on the ambient camera-stream audio and raises a Display icon. When the user turns, the camera checks the likely source and upgrades the alert to "Kettle, confirmed" or dismisses it, which cuts false alarms. The IMU logs the facing direction; direction from audio alone needs multi-channel audio, which is unknown.
4. **Why the glasses are essential.** The alert lands in the line of sight with no device to check, and confirmation uses where the user already looks.
5. **30-second demo.** A doorbell clip plays behind the wearer. The Display icon appears (mirrored on a screen). The wearer turns to a kettle photo and the alert is marked confirmed.
6. **Hardest risk.** Camera-stream audio is beta. Deaf output needs the Display (half the pool). The noisy hall can break the classifier. Whether Mock Device Kit simulates stream audio is unknown, so it is weak without glasses.
7. **MVP.** Five sound classes, Display cards, visual confirmation for two classes, a false-alarm counter, and no audio stored.
8. **Fit.** C4 high (fills the Deaf/HoH gap in Meta's accessibility story, opportunity.md §1), and uses Display (L898). A baseline product exists, so a **measured** false-alarm reduction is required. Tech: Gemma (only if used for on-device confirmation), Codex.

### `nod`: Nod, look and nod to choose real things, with no hands and no voice
*Sources: Nod control (accessibility #3) and Nod communication (capability-first Bet 1). Convergence: 2 angles. Beta: **Motion** (core), Inputs optional.*

1. **User and moment.** An adult with ALS/MND, cerebral palsy, post-stroke or high spinal cord injury, with limited hand function and unreliable speech. At breakfast they want the juice, not the water, or in bed they want the lamp on.
2. **Why existing options fall short.** Voice assistants need intelligible speech. Switch access and head-tracking apps work only on a mounted phone's own UI. Eye-gaze AAC devices cost about $11-20k (an indicative figure from a search snippet, capability-first.md) and are fixed to a screen, not the world. The glasses' own inputs (touch, voice, Neural Band) may not suit this user.
3. **Mechanism.** **The world is the symbol board.** Head dwell (IMU) selects the object at the camera centre, an on-phone embedding against a carer-enrolled vocabulary names it ("juice?"), and a **nod or shake** recognised from the IMU pitch/yaw pattern, calibrated per user, confirms or rejects. Two output modes: **speak the request aloud** from the phone ("I'd like the juice, please"; capability-first), or **act on a device** through a mockable home-automation module and a real smart plug (accessibility). Neural Band and touchpad are equivalent alternatives.
4. **Why the glasses are essential.** The head is often the last reliable movement, and the glasses are both the pointer (camera) and the switch (IMU). Nothing is mounted or aimed.
5. **30-second demo.** Juice, water and an apple on the table (plus optionally a lamp on a smart plug). The peer looks at the apple, hears "apple?" and shakes. Looks at the juice and nods. The laptop says "I'd like the juice, please" (or the lamp turns on). The projector shows the frame, the IMU trace and latency. Silent input works in noise.
6. **Hardest risk.** False accepts from normal head motion across different people. Motion is beta, and Motion with the camera is undocumented. GA fallback: optical-flow nod detection (weaker, estimate). Without glasses: IMU CSV plus h265 replay shows the pipeline but loses the try-it-on moment.
7. **MVP.** Camera at 360p/5 fps and Motion at 30 Hz, a rule-based dwell/nod/shake classifier with 10 s calibration, a 3-10 object vocabulary with cloud fallback, TTS, one real smart plug plus mocks (optional), state handling, and an evaluation of false accepts per 5 minutes of conversational head motion on 5+ recorded users.
8. **Fit.** C4 the strongest of any candidate on accessibility (an ability group Meta's showcase skips, opportunity.md §1). C1 high (a novel input on a capability few teams use). C3 has a niche audience with a carer-led pilot (partner not contacted). Jurors: Kia, Beer, Daksh (false-accept rate), Otto. Peers may read it as niche or as a "smart home demo". Tech: Gemma (labelling fallback), ElevenLabs (the user's spoken voice is central), Codex.

### `panel-reader`: Panel Reader, a fingertip-to-button reader for touch panels and appliances
*Source: accessibility (Bet 1). Convergence: 1. Beta: none.*

1. **User and moment.** A blind adult needs the washing machine on "Delicate 30°" or the hob on level 6. The panel is flat and touch-sensitive with no tactile marks. The same happens with hotel coffee machines, printers, lifts and ticket machines.
2. **Why existing options fall short.** Meta AI answers one photo at a time, which takes 2-5 s per round trip, and cannot say "your finger is on Eco, move right two". Be My Eyes needs a volunteer. Phone apps (VizLens-style research) need one hand to hold and aim the phone while the other explores (accessibility.md, UIST'16 paper).
3. **Mechanism.** **Cloud once, phone forever.** One-time registration: a sharp frame or photo goes to a vision LLM, which returns a JSON control map (box and label per control), confirmed once by the user or a helper. Live loop on the phone at 7-15 fps: a homography from the live frame to the reference, hand-landmark fingertip detection, and the fingertip projected into the map, so the label is spoken ("Delicate") with an earcon at button edges and a ~300 ms hold before speaking. No frames are uploaded during use, and it works offline after registration.
4. **Why the glasses are essential.** People face what they touch, so the head-mounted camera looks where both hands are working without anyone aiming. "Hold, aim, touch" on a phone is exactly what blind users cannot do reliably.
5. **30-second demo.** A printed washer panel. A blindfolded peer first asks Meta AI and gets a description they cannot act on. Then they slide a finger, hear "Cotton... Synthetics... Delicate", and tap correctly. A mirror screen shows the fingertip dot on the panel map, and a table speaker repeats the speech for observers.
6. **Hardest risk.** Fingertip and homography robustness at 360-504p with occlusion (the finger covers the label). Small labels at arm's length during registration (use photo capture or the phone camera, and do not combine with Display). Works well without glasses: needs no beta capability, and Mock Device Kit with the phone camera on a head strap reproduces the loop.
7. **MVP.** One-photo registration, the live fingertip reader for two panels, a state machine (permission, paused/stopped, degraded stream "move closer", lost tracking), and button-accuracy evaluation against the Meta AI baseline on a recorded clip.
8. **Fit.** C1 high (a two-handed first-person interaction), C2 high (a real CV pipeline, bounded latency, offline), C3 high (pilot candidate: the Finnish Federation of the Visually Impaired, not contacted), C4 high (one upload per appliance). Jurors: Beer, Daksh, Arturs, Kia, Otto, Umar. Do not claim blind-user results without blind testers. Tech: Gemini API (registration), Gemma (only if it reads panels well), Codex.

### `private-hand`: Private Hand, card night for a blind or low-vision player
*Source: social-play-and-evidence (Bet 2). Convergence: 1. Beta: none.*

1. **User and moment.** A blind teenager at a friend's UNO night with an ordinary deck. To play they must ask someone to read their hand, which reveals it, and they cannot follow the discard pile.
2. **Why existing options fall short.** UNO Braille exists ([CBS News](https://www.cbsnews.com/amp/news/uno-card-mattel-debuts-first-official-braille-deck-of-uno-cards), via social-play-and-evidence.md), but it needs that deck and braille literacy, and it says nothing about the pile or legal moves. A phone means holding cards and a phone at once.
3. **Mechanism.** An **on-phone card detector** fine-tuned on glasses-angle frames of fanned, occluded cards (VLM pre-labels, about 1-2 h of collection, estimate). **Temporal voting** builds a hand state: seen in 3 frames counts as confirmed, and disappearing counts as played. A **rules engine** speaks the decision, not the inventory ("you can play: green 4, wild"), quietly through the open-ear speaker. A glance at the centre reads the pile. No frames leave the phone.
4. **Why the glasses are essential.** Both hands hold and play cards, the camera sees the hand from the player's own angle, and the output must be private and eyes-free.
5. **30-second demo.** A reviewer plays a quick round against a blindfolded wearer. A mirror tablet shows the whispered playable cards, and the wearer plays the right one. A table card reads "Asking aloud: hand revealed. Private Hand: 0 cards revealed".
6. **Hardest risk.** Detection accuracy on fanned, occluded cards at 360-504p in venue light. Mostly device-independent (Mock Device Kit, head strap, recorded h265).
7. **MVP.** UNO only: the detector, hand-state tracking, the rules engine, private TTS and the mirror screen. Evaluation: held-out per-card accuracy, turn time, and cards revealed against the ask-aloud and braille-deck baselines.
8. **Fit.** C1 and C4 high (social inclusion and play, a gap in Meta's story). Very strong peer floor, because reviewers play. Weaker on "materially better mechanism", since card detection is known CV. Jurors: Otto (every game night), Daksh. Tech: Modal or Verda (detector fine-tuning, real but small), Gemini API (labelling and fallback, only if in the product path), Codex.

### `sana`: Sana, learn Finnish from the objects in your own day
*Source: everyday-consumer #6. Convergence: 1. Beta: Speech optional (phone ASR fallback).*

1. **User and moment.** An immigrant or student in Helsinki who drops generic flashcard apps by week two, but picks up the same mug every morning.
2. **Why existing options fall short.** Flashcards are disconnected from daily life. Meta's translation gives answers, not retention. The grant-funded tutor Immerse exists, and its features are **unknown** (competitive.md).
3. **Mechanism.** **Context-cued spaced repetition.** Objects the wearer handles (a hand-in-frame gate) become cards, and a review is triggered **the next time that object is in their hands**, not at a clock time. The glasses ask "Mikä tämä on?", and the voice answer is graded by phone ASR via the beamformed HFP mic, which helps in noise.
4. **Why the glasses are essential.** The object in your hands is the flashcard. A phone cannot know what you are holding.
5. **30-second demo.** The peer picks up a mug and hears "muki". On the next pick-up the glasses ask, the peer answers "muki", hears "Oikein!", and the phone shows the next review moving out.
6. **Hardest risk.** Retention cannot be measured within 40 h, so the evidence is weak for Daksh. Speech grading in the hall. Works without glasses.
7. **MVP.** About 20 object categories, the handling gate, an SRS scheduler, voice grading and error states.
8. **Fit.** C1 and C3 (pilot: an integration-training provider, not contacted), C4. Jurors: Otto (strong recurring trigger), Kia. Overlap with grant-funded tutoring lowers C1. Tech: Gemini API, ElevenLabs (natural Finnish pronunciation is genuinely central), Codex.

### `show-me-once`: Show Me Once, record a household task by doing it, then guide someone else
*Sources: everyday-consumer #3 and capability-first #4. Convergence: 2 angles. Beta: Motion optional (segmentation cue).*

1. **User and moment.** Family and shared-home know-how: grandma's karjalanpiirakka technique, the sauna stove, the building's laundry machine, resetting the boiler. The expert does it once wearing the glasses and narrating, and later the learner does it guided.
2. **Why existing options fall short.** Phone videos are long, unsegmented and need hands to scrub. Step viewers do no sensing (competitive.md lists them as obvious). Grant-funded coaching targets professional trades (opportunity.md §4).
3. **Mechanism.** **Author side:** step boundaries come from narration pauses in the beamformed HFP audio, plus IMU dwell/transition when Motion is available (capability-first). Only keyframes and the transcript per segment go to a multimodal model, which writes steps with a **done-state** key frame each. **Learner side** (everyday-consumer): the learner's gated stream is compared with the current step's done-state frame, so the step advances itself on a match or flags a mismatch ("not yet: the expert folded the corner to the centre"). No task-specific training is needed.
4. **Why the glasses are essential.** The first-person view is used twice. Only glasses capture the expert's hands-eye view without a camera operator, and only glasses let the learner check without putting the task down.
5. **30-second demo.** A teammate records a 3-step napkin fold while narrating. About 10 s later three auto-cut steps appear. The peer follows them: steps advance on a correct fold, and a wrong fold is flagged. (A pre-recorded expert clip is the fallback.)
6. **Hardest risk.** Segmentation and done-state matching quality on unconstrained tasks, so scope it to 1-2 rehearsed tasks. The HFP-before-camera ordering rule (silent route failure). Motion plus camera concurrency is undocumented. Playback works on mock, but live authoring needs glasses.
7. **MVP.** Record (camera 504x896 at 7 fps, HFP narration, optional IMU), the segmenter and LLM step-writer, step editing on the phone, guided replay with match and advance for one task, delete-all, and error states. Metric: step-boundary agreement with a human labeller, and completion time against a phone-video baseline.
8. **Fit.** C1 and C2 high, and it runs audio-only and on Display (L898). The two-phase demo is less legible at the table. Jurors: Timo, Beer, Umar. Tech: Gemini API (video and keyframe understanding), ElevenLabs, Codex.

### `step-check`: Step Check, a procedure checker that speaks only when you go wrong
*Sources: Step Witness (hands-busy-work Bet 2), Spot the Slip (capability-first #3), Build Buddy (social-play-and-evidence #3), Step Guard (everyday-consumer #4). Convergence: **4 angles**, the most obvious idea in the set. Beta: none required (Motion improves the gate).*

1. **User and moment.** Someone following a multi-step procedure with both hands busy: a parent and child on a LEGO or flat-pack build, a home cook on a new recipe, or (pilot) a gloved lab technician on a plate protocol. The wrong part at step 4 is found at step 11, or the interrupted technician cannot tell whether well 3 got reagent B.
2. **Why existing options fall short.** Paper and app instructions show the target but never check the work. Meta AI answers only when asked, and the user does not know to ask (competitive.md). Gloves rule out touchscreens in labs.
3. **Mechanism.** The procedure is compiled into a **state machine of expected workspace changes**. Strongest version, from Step Witness: a fiducial (ArUco) mat registers each frame. Hand-in/hand-out **before/after diffs** detect *that* and *where* something changed, **locally and in under a second** (estimate), and a matcher assigns the change to the expected step. Raise a spoken alert on a wrong region, out-of-order step or skip. The VLM is called only to verify ambiguous steps with a **structured diff prompt and two-crop agreement** (Build Buddy), off the critical path. The gate fires on working-dwell frames (IMU when available, from Spot the Slip, or optical flow). It is silent by default, and each confirmed step keeps an evidence crop.
4. **Why the glasses are essential.** Both hands are full and the eyes are on the work, so the camera sees the parts from the right angle. A propped phone sees the wrong angle and is occluded by the hands.
5. **30-second demo.** A 5-step Duplo build or an egg-box "plate" with coloured tokens on the mat. A reviewer is invited to plant an error. The glasses chime: "Step 3: blue expected in well 3, seen in well 4" (or "that's the red 2x4; this step needs the blue 2x2"). A scoreboard shows injected errors caught and false alarms.
6. **Hardest risk.** Fine-grained part and orientation errors at low resolution, and liquids in a real lab (the demo uses tokens or coloured water). Cloud latency is fine only because it sits off the alert path. Novelty: 4 of 5 generators found it, and Meta funds trade coaching. Works without glasses.
7. **MVP.** Fiducial engine, one hand-written JSON procedure, step matcher, local TTS alerts, VLM verify for ambiguous steps, a CSV evidence log, and the state machine. Evaluation: a seeded-error catch rate and false alarms per run on held-out scripted runs, against paper instructions.
8. **Fit.** C2 high, C3 medium-high (a lab-teaching pilot at Aalto or the University of Helsinki is plausible but unconfirmed), C4 medium-high, C1 medium (crowded idea). Daksh's strongest fit (blind error injection). Jurors: Arturs, Beer. Tech: Gemini API, Gemma (if the event classifier is on-device), Codex.

### `still-head`: Still Head, a head-stability coach (putting)
*Source: capability-first #6. Convergence: 1. Beta: **Motion** (core).*

1. **User and moment.** A recreational golfer practising putts alone, with putts sliding right and nobody watching their head.
2. **Why existing options fall short.** A tripod phone needs setup and later review, and it measures the body from outside. Coaches are not there for daily practice. Meta's acceptable-use guide lists "activity and form tracking, coaching", but no public example uses DAT Motion for it (capability-first.md).
3. **Mechanism.** A 60 Hz IMU segments the stroke from the gyro signal and measures head **rotation** (translation drifts on a consumer IMU, so it is excluded). A camera frame at impact shows the start line. Spoken feedback arrives within 1 s ("head moved 3° left before impact"). Metric: within-session reduction in head movement over 10 putts against a no-feedback block.
4. **Why the glasses are essential.** The sensor sits on the thing being coached, and the camera sees the ball from the golfer's eye.
5. **30-second demo.** A putting mat beside the table. The observer putts twice and hears the number after each, with the IMU trace on screen. Fun and competitive at a peer table.
6. **Hardest risk.** Weak "everyone, everyday" and accessibility fit. Motion is beta and the orientation field is nullable. Mock works via IMU CSV, but live needs glasses.
7. **MVP.** Stroke detection, a head-rotation metric, an audio cue and a session chart.
8. **Fit.** High peer-floor wow, C2 medium, C3 and C4 low. The source generator ranked it low for Meta. It is the only motion-coaching candidate, kept for diversity. Jurors: Otto (repeat use). Tech: Codex.

### `table-talk`: Table Talk, per-speaker captions in a noisy group
*Sources: Table Talk (social-play-and-evidence #4) and Who Said That (accessibility #6). Convergence: 2 angles. Beta: **Motion** (focus), optionally camera-stream audio. Needs Ray-Ban Display.*

1. **User and moment.** A hard-of-hearing person at a loud dinner or hackathon table with several people talking over each other. Captions follow only the person they face, or mix everyone together.
2. **Why existing options fall short.** Meta's Display captions reportedly work best facing one speaker (search snippets; whether and how Meta ships them is to be confirmed at the booth). A single centre phone mic in noise gives poor accuracy and no attribution. Voice identification for attribution is barred by the AUP.
3. **Mechanism.** From Table Talk: each participant **joins by QR**, so their own phone becomes a close-talk mic. Joining is the consent, and attribution comes from identity rather than biometrics. Per-speaker ASR streams merge on the server. The wearer's **head yaw** (IMU) picks whose line is in focus on the Display card. From Who Said That: visual active-speaker detection (lip motion, no identification) tags in-view lines with a bearing arrow, which puts the camera to use. Metric: per-speaker WER against a single centre mic in the same noise.
4. **Why the glasses are essential.** Captions sit in the line of sight while the wearer keeps eye contact, and head direction expresses attention with no input.
5. **30-second demo.** Two reviewers scan the QR and talk at once. Display captions (mirrored to a laptop) swap focus as the wearer turns. A side panel shows live WER against the centre mic.
6. **Hardest risk.** It may overlap a shipped Meta feature. It needs Display (half the pool) and beta Motion. Joining by phone adds friction. The camera is only lightly used, which L886's "first-person field of view" framing may punish. Partly works without glasses (Display can be simulated).
7. **MVP.** A web join page, per-phone ASR, a Display caption card, head-yaw focus, and a WER comparison on a recorded noisy clip.
8. **Fit.** C4 very strong (Deaf/HoH users are absent from Meta's showcase, opportunity.md §1). C1 is at risk from first-party captions. Jurors: Kia, Daksh (WER). Tech: ElevenLabs Scribe or Gemini API (honest only if it is the ASR in use), Codex.

### `teardown-memory`: Teardown Memory, an "undo history" for anything you take apart
*Source: hands-busy-work (Bet 1). Convergence: 1. Beta: none.*

1. **User and moment.** Someone repairing a laptop, bike brake or coffee grinder at home or at a repair café. Forty minutes in, they cannot remember which of 11 screws went where or the order the bracket and cable came off. Secondary users: people with working-memory difficulties who avoid repairs for this reason.
2. **Why existing options fall short.** Phone photos mean stop, wipe hands, unlock and shoot at every step, and they carry no order or part-to-hole link. Magnetic mats depend on discipline. Meta AI and Live AI keep no task model (Engadget review via hands-busy-work.md). A 40-minute video cannot be searched with greasy hands.
3. **Mechanism.** A fiducial **work mat** and a **parts tray** with numbered cells. Each frame is registered to the mats, and hand-in/hand-out **before/after diffs** record each removal as "removed from (x,y) on the device, placed in tray cell k", with crops, building an ordered **disassembly graph** on the phone. Reassembly plays it **in reverse** ("Step 7 of 11: the short silver screw from cell 4 goes top-left", with the hole circled), and a **verify diff** confirms each step. The LLM only labels parts, asynchronously. Only mat crops leave the phone.
4. **Why the glasses are essential.** The camera points where the hands work, at eye height, for the whole session, with no rig. A tripod phone (the strongest baseline) needs setup, misses the device when it is tilted toward you, and cannot speak into your ear.
5. **30-second demo.** The wearer removes 3 parts into tray cells, and the cast screen fills a live timeline. A tap on "reassemble" starts step-by-step guidance with the location circled. The observer puts a part back wrong and the verify step catches it with a chime.
6. **Hardest risk.** Diff reliability at 360-504p with head motion and small screws (demo parts are at least 1 cm). ArUco detection distance must be tested in hour 1. Works without glasses (phone camera or recorded h265).
7. **MVP.** Stream at 504x896 and 7 fps, ArUco registration, hand in/out, diff log with crops, reverse TTS playback and verify, the state machine (permission, pause/stop, doffed, marker lost, offline with queued labels), and a crop-only upload counter.
8. **Fit.** C1 high (ordered spatial task memory, not seen in competitive.md), C2 high, C3 medium-high (repair cafés or a library maker space; availability unknown), C4 high. Strong, interactive peer-floor demo. Jurors: Kia, Beer, Timo, Daksh (wrong-position steps per teardown), Otto, Arturs. Tech: Gemini API (part labels), ElevenLabs (spoken steps), Codex, Gemma (only if on-device labelling works).

### `which-way-now`: Which Way Now, the departure board read against your trip
*Source: everyday-consumer #5. Convergence: 1. Beta: none.*

1. **User and moment.** A visitor or new resident at Helsinki Central at 08:10, with luggage in both hands, facing a Finnish-only board and needing their own platform.
2. **Why existing options fall short.** Meta's translation (competitive.md) says what the board *says*, not which line is *yours*. Journey apps need the phone out and do not know which sign you are looking at.
3. **Mechanism.** The itinerary (from a ticket screenshot or typed destination) becomes a query. A sharpness and text-density **dwell gate** triggers OCR of the board being looked at. The VLM extracts the single matching row and returns one directive: "Platform 7, 08:32, 4 minutes late". Live HSL/Digitransit data is **unknown** and would sit behind a mock.
4. **Why the glasses are essential.** "The sign I am looking at right now", with both hands on luggage.
5. **30-second demo.** A printed 12-row Finnish board. With "Tampere" set, the peer glances and hears the directive while the phone highlights the matched row. A stopwatch baseline finds the row by hand.
6. **Hardest risk.** Judges may see it as overlapping with built-in translation and navigation. Works without glasses.
7. **MVP.** Itinerary entry, gated OCR, row match, a one-line directive and error states. Metric: time-to-answer against phone lookup with 5 peers.
8. **Fit.** C3 (a pilot with VR or HSL, not contacted), C4 (dyslexia, low vision, non-Finnish speakers). C1 medium. Jurors: Kia, Umar. Tech: Gemini API, Context.dev or Oxylabs (only if live timetable data is fetched), Codex.

---

## Shared engines (useful context for the judges, not a ranking)

- **Attention or event gate plus few-frame VLM:** `did-i`, `basket`, `sana`, `glance-log`, `which-way-now`, `show-me-once` (learner side).
- **Fiducial mat with before/after diff:** `teardown-memory`, `step-check`, `cross-contact`, `coverage-inspector` (sticker variant).
- **IMU head signal (beta Motion):** `beacon`, `nod`, `still-head`, `table-talk` (core); `did-i`, `step-check`, `show-me-once`, `glance-log` (optional).
- **On-phone CV with a cloud-once step:** `panel-reader`, `private-hand`.
- **Ambient audio (beta camera-stream audio) or the Display:** `heads-up-sounds`, `table-talk`.

Candidates that need **no beta capability** for their core: basket, coverage-inspector, cross-contact, did-i, glance-log, panel-reader, private-hand, sana, show-me-once, step-check, teardown-memory, which-way-now. Candidates whose core is **beta**: beacon, nod, still-head (Motion), heads-up-sounds (camera-stream audio), table-talk (Motion; needs Display).

## Merged

| Merged into | What was merged | Kept from each |
|---|---|---|
| `did-i` | Did I? (everyday-consumer), Did I? (capability-first), Checkpoint (accessibility) | Two-reference state verifier and 24 h retention (everyday); IMU attention gate, upload counter and "not sure" rule (capability-first); exit-time summary and boolean-only log (accessibility) |
| `did-i` (optional mode) | Pot Watch (capability-first #5) | Its own author called it "the Did I? engine run in reverse" and best treated as a feature. Depends on nullable orientation for identical objects |
| `beacon` | Homing (accessibility), Point Here (social-play-and-evidence) | Same core: pixel to world bearing via the quaternion, IMU-rate audio cue, still-head re-anchoring. Both target sources kept as variants (self-named or helper-tapped) |
| `nod` | Nod control (accessibility), Nod communication (capability-first) | Look-select plus nod/shake confirm. Both output modes kept (speak the request, or actuate a device) |
| `show-me-once` | Show Me Once (everyday-consumer), Show Me Once (capability-first) | IMU plus narration-pause segmentation (capability-first); learner-side done-state matching (everyday) |
| `step-check` | Step Witness, Spot the Slip, Build Buddy, Step Guard | Local fiducial diff and state-machine matcher (Step Witness); IMU working-dwell gate (Spot the Slip); structured diff with two-crop agreement and seeded-error benchmark (Build Buddy); cooking as a use-case variant (Step Guard) |
| `table-talk` | Table Talk (social-play-and-evidence), Who Said That (accessibility) | QR-join close-talk mics as consent and attribution, and head-yaw focus (Table Talk); visual active-speaker bearing so the camera is used (Who Said That) |
| `basket` (stretch) | Fridge Glance (everyday-consumer #7) | Its own author suggested it as Basket's stretch goal. Low novelty and a home-privacy concern on its own |

## Dropped

| Concept (angle) | Reason |
|---|---|
| Breadcrumb / Breadcrumbs (accessibility #7, capability-first #7) | Both authors said the demo does not fit a table (a walking route or a replay only), which hits the rubric's tie-break rule (demo or peer legibility at 1 or lower means near-zero overall chance, 00-rules-and-jury.md §7). Head-IMU pedometry drift is untested, and Motion is beta |
| Read-Along (social-play-and-evidence #5) | The first-person benefit is weak: its author notes that a propped phone does most of it. That fails L894's "first-person field of view enables new or better interactions" |
| Badge Whisper (social-play-and-evidence #6) | AUP risk ("analyzing people in a user's surroundings to facilitate unwanted approaches", feasibility.md §6) needs Meta sign-off. Badge readability at conversational distance is unknown, and the core user (face blindness) is mostly in places without badges |
| Mölkky Ref (social-play-and-evidence #7) | Weak real-world value and accessibility story (its author's assessment). Reading pin numbers at distance and low resolution is unknown. An outdoor, seasonal game demoed at a table. `private-hand` covers the play angle with a stronger inclusion story |
| Cut Check (hands-busy-work #6) | A niche audience (culinary students), and its homography engine is dominated by `teardown-memory` and `step-check`. Millimetre accuracy at 504p is unvalidated |
| Dose-Box Double Check (hands-busy-work #7) | Its own author said "do not pick": the team excluded healthcare scope (opportunity.md), it carries AUP sensitive-location risk, and medication-safety claims are high-stakes |

<!-- complete -->
