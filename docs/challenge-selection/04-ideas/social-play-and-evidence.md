# Meta AI Glasses: concepts from the "social, play and evidence" angle

**Summary**
- These are seven concepts for "AI Glasses for Everyone, Everyday" (CHALLENGES.md:L878-946). Each involves **two or more people**, and each **can be measured against a baseline during the weekend**. Every one of them runs with **one pair of glasses**. Non-wearers join through a phone or web link, because device supply is scarce (20 shared units, CHALLENGES.md:L914-915) and we found no evidence that one app can stream from two glasses at once (unknown).
- **Bet 1: #1 Point Here.** A remote helper taps a spot in the wearer's live view. The glasses then steer the wearer's head and hand to it using the DAT Motion IMU at up to 60 Hz, independent of the slow video link. It has the clearest "materially better than the obvious approach" mechanism and a clean timed baseline: voice guidance over shared video, as Be My Eyes offers. It is our best combined bet for both the Meta challenge and the overall jury.
- **Bet 2: #2 Private Hand.** A blind or low-vision player joins an ordinary card game with sighted friends. Their own hand is read to them privately, along with the table state and the moves they can legally make. It is the strongest peer-floor "wow" because a reviewer plays a round. Its baseline is the braille UNO deck.
- The other five, ordered: #3 Build Buddy (step checks while assembling together), #4 Table Talk (per-speaker captions for hard-of-hearing users in noise), #5 Read-Along (read-aloud fluency coaching), #6 Badge Whisper (name recall without faces), #7 Mölkky Ref (a playful Finnish scorekeeper).
- Two SDK facts shape everything here. **Motion (IMU) and Inputs are beta**, available on dev and beta release channels only. **The SDK reports no camera intrinsics.** Both are cited below. Any concept that leans on them must confirm on site that they are enabled for the booth's glasses.

---

## Ground rules used for every concept

SDK facts the concepts depend on (all opened or cited in our research):

| Fact | Source |
|---|---|
| Camera, mic and display access need DAT (native iOS or Android). Web Apps have no camera or mic | [llms.txt](https://wearables.developer.meta.com/llms.txt); feasibility.md §2 |
| Stream at 720x1280, 504x896 or 360x640 at 2-30 fps. It degrades over Bluetooth Classic. Design for 360x640 at 2-7 fps (estimate) | feasibility.md §3, §5 |
| **Motion capability**: accelerometer, gyroscope, magnetometer (may be null) and a fused orientation quaternion, at 5/10/15/24/30/60 Hz ("a target, not a guarantee"). **Beta, dev/beta channels only.** No user permission needed. It keeps a 256-sample buffer. Mock Device Kit can replay motion from CSV. The sample `source` can be the glasses or the Neural Band | [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion) |
| **No intrinsics**: "The SDK does not report intrinsic camera parameters". Frames are already undistorted, so a pinhole model is the place to start. Stream frames are cropped to 9:16. Stabilization means "the image does not exactly track the head rotation" | [camera-stream-processing](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/camera-stream-processing) |
| **Inputs (beta)**: a touchpad double tap gives `Select` and a swipe gives `Nav`. A single tap and tap-and-hold are reserved by the system. The capture button gives short, hold or double press. The Neural Band gives `Nav`/`Select`/`Drag`. `Back` is not delivered by real glasses | [inputs guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs) |
| HFP mic is mono at 8/16 kHz, **beamformed toward the wearer's voice**. Camera-stream audio (not beamformed) is beta | feasibility.md §3 |
| Display (Ray-Ban Display only): FlexBox/Text/Image components at 600x600, and each send replaces the whole view. Combining photo capture with Display is buggy, so use the stream | feasibility.md §3, §5 |
| Mock Device Kit simulates the camera (phone camera or an h265 file), permissions, power, don and fold states. It supports up to three mock devices | feasibility.md §3 |
| "Users can link multiple glasses to Meta AI." Only **one third-party app stays registered at a time in Developer Mode**. Whether one app can stream from two glasses at once is **unknown** | [permissions](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/permissions-requests) |
| AUP: no identifying people by face or voice, no surreptitious capture, no "analyzing people in a user's surroundings to facilitate unwanted approaches". Design principle: "narrow purpose, short retention, obvious to bystanders" | feasibility.md §6 |

The design consequence is **one wearer plus N phone or web participants**. This keeps the social angle realistic with one device. It also gives the jury a second screen to watch.

Judging lenses below refer to the Meta criteria (C1 Creativity, C2 Technical execution, C3 Real-world value, C4 UX/accessibility/trust; CHALLENGES.md:L934-937) and the overall rubric in 00-rules-and-jury.md §7 (R1 problem/user, R2 insight, R3 demo, R4 evidence, R5 peer-floor, R6 path forward), with juror names from §5.

---

## 1. Point Here: remote "tap to point" guidance in the wearer's own space

**1. User and moment.** A low-vision person (later also any older parent) is at home with a family member or volunteer on a call. It is 18:40. They have dropped a pill or want "the oat milk, not the regular one" from a crowded fridge shelf. The helper can see it on the shared video. Saying "left... no, your other left... lower" takes a minute and is frustrating for both.

**2. Why existing options fall short.** Be My Eyes on Ray-Ban Meta already gives volunteers and trusted contacts the wearer's POV with **voice** guidance ([Be My Eyes](https://www.bemyeyes.com/news/be-my-eyes-and-meta-launch-new-accessibility-functions/)). VisionClaw shares POV over WebRTC (competitive.md). In both, the helper has to translate a location into words, and the video reaching the helper lags. A phone video call is worse because the person must hold and aim the phone with one hand. Meta AI answers "what is this", not "where is the thing *my daughter* means".

**3. Mechanism.** The helper **taps the target** on their phone's live view. We convert the tap into a head-relative direction: a pinhole model with focal length calibrated once on stream frames (needed because the SDK gives no intrinsics), combined with the IMU orientation quaternion stamped at that frame. From then on, guidance runs **entirely on the IMU** at 30-60 Hz. As the wearer turns their head, a spatial "warmer/colder" audio cue (stereo pan plus pitch) closes the angle with no video round trip. A spoken "got it" comes when the target is within about 5° (estimate). Video is used only to **re-anchor**: every second or so a light tracker (template match on the tapped patch, run on the phone) corrects IMU drift and stabilization offset. Then a final "reach" phase: the helper sees the hand in the frame and taps again, or a hand-keypoint model gives "a little left". The obvious approach (talking over video) is bounded by video latency and by language. Ours is bounded by IMU latency, which is likely far smaller (estimate, not measured).

**4. Why the glasses are essential.** The head *is* the pointer and the camera *is* the view, so both of the wearer's hands stay free to reach. A phone can't be both the thing you aim and the thing you hold while you reach into a fridge.

**5. 30-second demo.** Five similar paper cups sit on the table, one with a sticker underneath. A peer reviewer holds our phone, sees the wearer's view, and taps a cup. The wearer, eyes closed or wearing low-vision simulation goggles, follows the audio cue and touches the cup. A phone timer shows **"tap-guided: 6 s"** next to the round we ran first with verbal guidance only: **"voice-only: 21 s"** (illustrative; the real numbers come from our trials). Observers hear the rising tone and see the cup being picked up. Noise: the cues are on the open-ear speakers, and the observers watch the timer, so noise only affects the wearer.

**6. Hardest risk.** (a) Motion is beta, dev/beta channels only. If it is not enabled on the booth's glasses (CAPABILITY_DENIED, feasibility.md §4), we lose the core. The fallback is video-only tracking at 7-15 fps, which still works but is slower. (b) The IMU and image are not rigidly aligned under stabilization (camera-stream-processing guide), so we need re-anchoring. (c) WebRTC from the phone to the helper: we write this part ourselves (estimate 3-4 h). **Without a device**, Mock Device Kit plays the camera, and motion can be replayed from CSV, but live head turning needs a real device. For a fallback demo, the phone itself is the "glasses" (phone camera plus phone IMU) behind the same interface. That shows the mechanism honestly but not the wearable benefit.

**7. Smallest complete MVP.** A DAT app on one platform, with a helper web page (WebRTC view, tap) and IMU audio guidance. Calibration once. Re-anchoring by template match. It handles permission denied, session PAUSED/STOPPED, IMU unavailable (degrades to video-only), and the stream dropping to 360p. Consent: the helper only sees the stream while the wearer holds a session open. There is no recording, and both screens show a "live to: Anna" banner. Evidence: 20 trials each, voice-only versus tap-guided, with time-to-touch, success rate and failure cases (lost target, drift).

**8. Criteria and stacking.** C1 (pointing in someone else's FOV is new), C2 (sensor fusion plus the robustness ladder), C3 (Be My Eyes shows demand, and the pilot is a Finnish visual-impairment organisation; whether we contact one is still to decide), C4 (audio-first, consent banner). Jury: Beer (a 10x mechanism versus the obvious approach), Daksh (baseline plus failure rate), Arturs (the hard constraint is latency), Kia/Otto (a recurring family moment). Stack: Codex (honest, dev process). Gemini API only if we add an optional "describe what's at the target" fallback, which is weak. ElevenLabs is not honest here, since the cues are tones.

---

## 2. Private Hand: join any card night as a blind or low-vision player

**1. User and moment.** A blind teenager at a friend's Friday UNO night. The deck is ordinary. To play, they have to ask someone to read their hand, which reveals it, and they can't follow the discard pile.

**2. Why existing options fall short.** UNO Braille exists, developed with the National Federation of the Blind, with braille on each card's corner ([CBS News](https://www.cbsnews.com/amp/news/uno-card-mattel-debuts-first-official-braille-deck-of-uno-cards)). It needs that specific deck and braille literacy. It also doesn't tell you what is on the discard pile or what you may legally play. Using a phone means holding cards and a phone at once. Meta AI or Be My Eyes can describe a card, but the answer is spoken in a general-purpose flow that doesn't track game state (estimate).

**3. Mechanism.** We train a small **on-phone card detector** for one deck, fine-tuned on frames from the glasses' angle (fanned and partly occluded cards; estimate 1-2 h to collect and label with VLM pre-labels). It is fused **over time** into a hand-state model: a card seen in three frames counts as confirmed, and when one disappears from the fan it is marked "played". A small **rules engine** then answers "you can play: red 7, blue skip, wild" instead of listing cards. The discard pile is read when the wearer glances at the centre. A whisper goes only to the open-ear speaker at low volume (privacy from the other players). Frames never leave the phone, and a cloud VLM is used only as a labelled fallback. The obvious approach (send each frame to a VLM and read out everything) is slow, leaks the hand to the cloud, and floods the user with speech. Ours speaks the decision, not the inventory.

**4. Why the glasses are essential.** Both hands hold and play cards. The camera sees the hand from the player's own angle, and the output must be private and eyes-free.

**5. 30-second demo.** A reviewer sits down and is dealt five cards, and the wearer (blindfolded) is dealt five. The wearer glances at their hand, and the glasses whisper "Three playable: green 4, green skip, wild". A tablet behind the table mirrors the whispers as text, so observers can read them in the noise. The wearer plays the right card. Then the reviewer plays a card, and the wearer hears "Blue 2 on the pile, you have one blue". The visible before/after is a table card: "Asking aloud: hand revealed. Private Hand: 0 cards revealed, X s per turn".

**6. Hardest risk.** Detection accuracy on fanned, overlapping cards at 504x896 or 360x640 in venue lighting (estimate: workable for UNO's big colour fields, harder for a standard 52-card deck). Bluetooth congestion may drop the frame rate, so we keep 2-7 fps and voting. **Without a device:** Mock Device Kit with the phone camera on a head strap, or a pre-recorded h265 clip, shows the full pipeline. Most of the build is device-free.

**7. Smallest complete MVP.** UNO only. The detector plus temporal hand state, the legal-move engine, private TTS, and a mirror screen. It handles the hand going out of view ("hold your cards up"), a stale state after a pause, and permission and session states. Evidence: per-card accuracy on a held-out set of glasses frames we record on site, end-to-end turn time versus a sighted player, and the "cards revealed" count versus the ask-aloud baseline. We also report the miss cases.

**8. Criteria and stacking.** C1 (social inclusion and play, a gap in Meta's accessibility story, opportunity.md §1), C3 (works with any deck, so adoption needs no new hardware), C4 (private output, no frames leave the phone). Jury: R5 peer-floor is very strong because reviewers *play*; Otto (games, return use every game night); Daksh (held-out accuracy). Stack: Codex; Modal or Verda if we fine-tune the detector on GPU (honest but small); Gemini API as the labelling and fallback VLM (honest only if it stays in the product path).

---

## 3. Build Buddy: a second pair of eyes for building together

**1. User and moment.** A parent and an 8-year-old on Saturday morning with a LEGO or flat-pack set. The parent wears the glasses. The child finds pieces. Errors come from a wrong piece or a flipped orientation in step 4, which is found in step 11.

**2. Why existing options fall short.** Paper or app instructions show the target but never check your work. Tutorial viewers without sensing are on the "obvious" list (competitive.md). Grant-funded trade coaching is professional, not household (competitive.md, opportunity.md §4). A phone app would need to be held over the build after every step.

**3. Mechanism.** We parse the instruction PDF or images into a step graph once. On each "done" (a double tap, or the phrase "next"), a single frame plus the expected step image go to a VLM with a **structured diff prompt** (expected parts, positions and colours, then a verdict with a reason). The answer is accepted only if two crops agree. The measurable mechanism is the **seeded-error benchmark**: we deliberately plant common mistakes and report the catch rate and false alarms against the "paper instructions" baseline, where the catch rate is 0% until a later step fails.

**4. Why the glasses are essential.** Both hands are building, and the camera sees the build from the builder's angle at every step without anyone picking up a device.

**5. 30-second demo.** A six-step Duplo build. The reviewer is invited to place a wrong brick. The glasses say "Step 3: that 2x4 should be red, and it's one stud to the left". The scoreboard on the phone shows "Seeded errors caught: 17/20; false alarms: 2/40" (the targets we would measure).

**6. Hardest risk.** VLM reliability on fine spatial differences, such as studs and orientation (estimate: colour and piece-type errors are caught well, offset errors less so). Latency of 2-5 s per check (feasibility.md §5) is fine because checks happen per step. **Survives without a device:** yes, through Mock Device Kit with the phone camera.

**7. Smallest complete MVP.** One set with a hand-made step list, a per-step check, and an audio verdict. A Display card with the next step image is a stretch goal. Evidence: the seeded-error table.

**8. Criteria and stacking.** C3, C4 (hands-free), and R4 evidence. The weak spot is C1: "assembly assistant" is closer to the obvious ideas. Stack: Gemini API (core VLM, honest), Codex.

---

## 4. Table Talk: per-speaker captions in a noisy group, consented by joining

**1. User and moment.** A hard-of-hearing person at a loud dinner table or a hackathon table with four people talking over each other. Caption apps on a phone mix everyone's speech, and the person has to look down.

**2. Why existing options fall short.** A single phone mic in the middle of the table in a noisy hall gives a high error rate with no attribution (estimate). The glasses mic is beamformed **toward the wearer's own voice** (feasibility.md §3), so it is the wrong mic for other people. Voice identification for attribution is forbidden by the AUP (feasibility.md §6). Whether Meta ships live captions on Ray-Ban Display is **unknown** (competitive.md). Check this at the booth first.

**3. Mechanism.** Each person at the table scans a QR code and their **own phone becomes a close-talk mic** in a web page. Joining is the consent, and attribution comes from identity rather than biometrics. Per-speaker ASR streams are merged on the server. The wearer's **head yaw from the IMU** selects whose captions are in focus. You look at Anna, and her line is shown large while the others stay small. The Display shows one glanceable card. The measurable claim: per-speaker close-talk word error rate versus a single centre mic in the same noise, with attribution accuracy of 100% by construction.

**4. Why the glasses are essential.** Captions sit in the line of sight while the wearer keeps eye contact and lip-reads. Head direction expresses attention with no input at all.

**5. 30-second demo.** Two reviewers scan the QR code and talk at the same time. Captions appear on the Display, mirrored to a laptop for observers, and the focus swaps when the wearer turns their head. A side panel shows live word error rate: "centre mic 38% vs Table Talk 9%" (illustrative targets, not results). The noisy peer-review floor *is* the test condition.

**6. Hardest risk.** It needs a **Ray-Ban Display** (half of the pool) and the beta Motion capability. Multi-stream ASR cost and latency matter. Peers must join with their own phones, which is friction at the table. **Survives without a device:** partly. Display content can be simulated in-app or in Chrome (feasibility.md §3), but the eye-contact benefit is not visible.

**7. Smallest complete MVP.** A web join page plus per-phone ASR plus a Display caption card plus head-yaw focus. Evidence: the WER comparison on a recorded noisy-table clip plus a live run.

**8. Criteria and stacking.** C4 is very strong (Deaf and hard-of-hearing users are absent from Meta's showcase, opportunity.md §1), and so is C1. R1, R4. The risks are a possible first-party feature and the camera not being used, which the brief's "first-person field of view" framing may punish (CHALLENGES.md:L886). Stack: ElevenLabs Scribe or Gemini API for ASR (honest if it is the ASR in use), Codex.

---

## 5. Read-Along: read-aloud fluency coaching from the reader's own view

**1. User and moment.** A child practising reading aloud at bedtime with a parent nearby. Or an adult learning Finnish who reads a real Kela letter aloud. Errors go unnoticed unless someone listens closely.

**2. Why existing options fall short.** Reading apps need app-bundled books. A phone can't see a paper book unless it is propped up over it. A parent can't stay attentive every night.

**3. Mechanism.** The page is captured with OCR from the wearer's view. Streaming ASR comes from the beamformed wearer mic, which suits this case because the speaker *is* the wearer (feasibility.md §3). **Forced alignment** of the ASR against the OCR text gives word-level miscues (skips, substitutions, repeats) and **words correct per minute**, a standard fluency metric. A summary goes to the parent's phone. The measurable mechanism is miscue detection precision and recall against our hand-labelled readings.

**4. Why the glasses are essential.** Any paper text in the reader's own view and hands, hands-free, with no app library.

**5. 30-second demo.** A reviewer wears the glasses and reads three lines with two deliberate mistakes. The phone shows the passage with the miscues highlighted in red and "WCPM 92".

**6. Hardest risk.** ASR on children's or non-native speech, and alignment robustness. Glasses fit on children is unknown, so the pitch focuses on adult language learners. **Survives without a device:** yes, with Mock Device Kit and a phone mic.

**7. Smallest complete MVP.** OCR plus ASR plus alignment plus a miscue view on the phone. Evidence: precision and recall on 10 labelled readings.

**8. Criteria and stacking.** C3, R4. C1 is moderate, and the first-person benefit is arguable because a propped phone does most of this. Stack: Gemini API, ElevenLabs (ASR), Codex.

---

## 6. Badge Whisper: remember who you met, without face recognition

**1. User and moment.** Someone with prosopagnosia (face blindness) or memory difficulties at a networking event. A person walks up and says "great to see you again", and they can't place them.

**2. Why existing options fall short.** Face-ID memory aids are what most teams will reach for and are banned by the AUP without Meta approval (feasibility.md §6, competitive.md). A phone contact list needs a search mid-conversation.

**3. Mechanism.** Recognition by **consented token, never by biometrics**. The other person opts in once by scanning our QR code, which links to their name, a note and where you met. Later, the glasses read the **printed name or QR code on their badge** (text OCR, not the face) when it is within reach, and whisper "Anna, Meta booth Friday, building a cooking app". Anyone who has not opted in is never stored. Measurable: name-recall accuracy after 10 introductions, with and without.

**4. Why the glasses are essential.** The prompt has to arrive in the first second of the encounter, privately and eyes-up.

**5. 30-second demo.** The reviewer scans the opt-in QR code. The wearer turns away, the reviewer re-approaches, and the wearer greets them by name. Peers find this delightful. It depends on whether Junction badges carry readable names (unknown).

**6. Hardest risk.** **Trust and the AUP**: "analyzing people in a user's surroundings to facilitate unwanted approaches" (feasibility.md §6) means Meta must agree. Reading badge text at conversational distance at 504x896 is also uncertain (estimate). **Survives without a device:** yes, with Mock Device Kit.

**7. Smallest complete MVP.** Opt-in page, badge OCR plus QR, private TTS, and a delete-me link.

**8. Criteria and stacking.** C1, R5 (memorable). C4 is a risk until the consent design is approved at the booth. Stack: a database tech challenge (Aiven or MongoDB) for the opt-in store (honest but marginal), Codex.

---

## 7. Mölkky Ref: a hands-free scorekeeper for Finnish lawn games

**1. User and moment.** A summer evening Mölkky game among friends. Counting fallen pins, applying the "exactly 50, over 50 resets to 25" rule, and tracking misses causes arguments and slows play.

**2. Why existing options fall short.** Scoring apps need manual entry after every throw. Fixed-camera scoring systems exist for darts (not verified here), but none work from a moving player's view (unknown).

**3. Mechanism.** After each throw the wearer glances at the pins. Pin detection plus number OCR on the knocked-over pins feeds a rules engine. Shared scores update on everyone's phones through a link, and an announcement plays on the open-ear speaker. Measurable: scoring accuracy versus a manual tally over N throws.

**4. Why the glasses are essential.** The player is already looking at the pins, holding the throwing pin, and nobody has to fetch a phone.

**5. 30-second demo.** A tabletop mini Mölkky set. The reviewer throws, and the scoreboard updates.

**6. Hardest risk.** Reading the numbers on fallen pins from a distance at low resolution, and indoor table-scale demo realism. Weak C3 and weak accessibility story. **Survives without a device:** yes, with Mock Device Kit.

**7. Smallest complete MVP.** Pin count only (singles: the number on the pin; multiples: the count), a rules engine and a shared scoreboard.

**8. Criteria and stacking.** C1 (playful, local), R5. Weak on C3, C4 and R1. Stack: Modal or Verda for detector fine-tuning, Codex.

---

## The two I would bet on, and why

**#1 Point Here: best for the Meta challenge and best combined.**
- It answers the brief literally: a first-person field of view enables a **new interaction**, which is pointing inside someone else's view (CHALLENGES.md:L886, L894).
- It uses an SDK capability that public projects do not use: Motion (opportunity.md, "underused capabilities"; [motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion)).
- It has a timed baseline any reviewer can repeat at the table. For the overall jury it is the cleanest "what did you figure out" story (Beer), with a failure rate (Daksh) and a hard latency constraint (Arturs).
- The main risk is that the beta Motion capability is not enabled. **Ask the booth in hour 1.** The fallback is video-only tracking: weaker but still demoable.

**#2 Private Hand: best for peer review and overall.**
- A reviewer playing a card round against a blindfolded wearer is the most memorable 60 seconds in this set. It is social, inclusive and fun, and the real comparison is the braille UNO deck.
- It is mostly device-independent (built on Mock Device Kit plus a held-out frame set), so execution risk is lower than #1.
- It is weaker than #1 on "materially better mechanism", because card detection is a known CV problem. That is why #1 ranks first for the Meta challenge.

If device access turns out poor (feasibility.md §11), switch the ranking: #2 survives Mock Device Kit far better than #1.

**Open questions for the Meta booth:**
1. Are Motion and Inputs (beta, dev/beta channels) enabled on the shared glasses?
2. Can our phone hold one unit through judging?
3. Does Display ship live captions (affects #4)?
4. Is badge-based recall acceptable under the AUP (affects #6)?

<!-- complete -->
