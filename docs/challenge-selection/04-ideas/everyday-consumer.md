# Ideas from the "everyday-consumer" angle: Meta, AI Glasses for Everyone, Everyday

**Summary**
- Seven concepts for ordinary daily life, ranked. Each has a trigger that recurs every day or every week, a mechanism beyond "frame to LLM to TTS", and a tabletop demo that works with props.
- **Bet 1: "Did I?"** It verifies checkpoints such as "Did I lock the door / turn off the stove / take my pill?" from the wearer's own hands-in-view moment. It has the strongest daily trigger, the clearest before/after, a measurable verifier and a built-in trust story (narrow purpose, short retention).
- **Bet 2: "Basket"**, a shopping list that ticks itself off and checks allergens on the items you actually pick up. A stranger at the table understands it within 10 seconds, and it has a natural Finnish retail pilot.
- High ceiling, high risk: **"Show Me Once"** (record a household task by doing it, and someone else is guided through it). It has the biggest wow, but step segmentation quality is unproven.
- Every concept is a native DAT app (camera, mic, TTS, optional Display cards). None needs face identification, Web App camera access, IMU or head-pose data (status unverified, see Constraints), or "Hey Meta" commands.

---

## Constraints every concept respects (from our research)

| Constraint | Source |
|---|---|
| Camera and mic are available only through DAT (native iOS or Android). Web Apps have no camera or mic. | feasibility.md §2; [llms.txt](https://wearables.developer.meta.com/llms.txt) |
| Stream is 720x1280, 504x896 or 360x640, Bluetooth-limited, and degrades automatically. Design for 360x640 at 2-7 fps. | feasibility.md §3, §5 |
| Inputs (touchpad, button, Neural Band) and Speech are **beta**. Speech silently stops after about 1 minute. Inputs are lost on re-don. A phone-button fallback is mandatory. | feasibility.md §3, §5 |
| Display: 600x600 component cards, each send replaces the view. "Don't combine capture with display capabilities", so use the stream rather than photo capture on Display. | feasibility.md §3, §5 |
| AUP: no identification of people by face or voice, no surreptitious capture, and the design principle is "narrow purpose, short retention, obvious to bystanders". | feasibility.md §6; [AUP](https://wearables.developer.meta.com/acceptable-use-policy) |
| Mock Device Kit can replay an h265 clip as the glasses camera, so every demo has a no-device fallback. | feasibility.md §3 |
| Head motion / IMU: the Connect recap mentions "motion tracking", but the DAT 1.0 guide index I opened lists no motion guide ([guides index](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides)). Other research calls it experimental. **Treat it as unknown. No concept depends on it.** | opportunity.md table; guides index (opened) |
| Meta already ships live captions and translation on Ray-Ban Display, plus walking navigation in select cities. | [pulse2.com, May 2026](https://pulse2.com/meta-neural-handwriting-display-recording-live-captions-expanded-navigation-and-developer-tools-roll-out-on-ray-ban-display/) (search snippet); competitive.md |

Common architecture for all seven: glasses stream → phone app with a **cheap on-phone gate** (change detection, hand-in-frame detection, sharpness check) → cloud VLM called only on gated events → speech or a single Display card back. The gate is the shared engineering story for L900 ("performance trade-offs, connectivity"): it gives fewer uploads, lower cost and graceful offline behaviour. The phone mirrors state and consent for judges.

Juror lenses below use the names in 00-rules-and-jury.md §5. Meta criteria are C1 creativity, C2 technical execution, C3 real-world value, C4 UX/accessibility/trust (CHALLENGES.md:L934-937).

---

## 1. "Did I?": verified checkpoints for the things you always doubt (BET)

**User and moment.** Anyone who leaves home on autopilot. At 07:52 Aino is on the tram and can't remember whether she switched off the stove or locked the door. She either goes back (20 minutes) or worries all day. Variant: an older adult, or someone with ADHD, who can't remember whether they took this morning's pill.

**Why existing options fall short.**
- A phone photo needs a free hand and a decision made at the moment of doing it, which is exactly when you are on autopilot.
- Smart locks and smart plugs cover one device each and need installing.
- A built-in assistant "remember this" note records what you *said*, not what you *did*. Whether Meta AI has a photo-memory feature that covers this is **unknown**; check at the booth.
- Generic lifelogging records everything, which breaks the AUP principle of "narrow purpose, short retention" (feasibility.md §6).

**Mechanism (the insight).** *Checkpoint verification, not recording.*
1. Setup takes 20 seconds per checkpoint: the wearer looks at the stove, lock or pill organiser in its "safe" state and in its "unsafe" state. Those become reference frames.
2. When the wearer's hand is on the object (on-phone hand detector plus similarity to the reference), the app keeps a 1-2 s burst. A deliberate tap does the same.
3. A verifier compares the burst against the references and outputs `{object, state, confidence, time}`. It runs as a few-shot VLM call, with a small on-phone model as a stretch goal.
4. Only the verdict and one downscaled thumbnail are stored, and they auto-delete after 24 h.
5. The question "Did I lock the door?" (voice, tap or phone) gets the answer "Locked, 07:48, 92% sure" plus the thumbnail as proof.

The non-obvious part is the **two-reference few-shot state check**. It turns an open "describe this" question into a binary decision we can measure, and its low-confidence cases are visible ("couldn't see the knob, check again").

**Why glasses are essential.** The evidence is the wearer's *own hands doing the action, from their eyes*, captured at the moment it happens with no free hand needed. A phone cannot see this without the deliberate photo that people on autopilot don't take.

**30-second demo.**
- Props: a cheap deadbolt on a wooden board and a stove-knob mockup. No electronics.
- The peer turns the knob to OFF and slides the bolt while wearing the glasses. The phone screen shows "✓ Stove OFF 14:02" appear.
- The peer then asks (or taps) "Did I turn off the stove?" and hears "Yes, off at 14:02." The screen shows the thumbnail.
- Second run: the peer leaves the knob ON. The answer is "No, it was ON when you last touched it."
- The screen keeps a live counter: verified, unsure, and uploads avoided by the gate.
- On noise: the answer is a short phrase from the glasses' open-ear speaker, mirrored as large text on the phone.

**Hardest risk.** Telling knob or bolt state apart reliably at 360x640 with motion blur. Mitigations: the burst picks the sharpest frame, references are captured on the same device, and "unsure" is a first-class output. The demo **survives without a device**: Mock Device Kit plus a recorded h265 POV clip, or the phone camera as the mock glasses (feasibility.md §3).

**Smallest complete MVP.** Two checkpoints (stove, lock), a tap trigger with a phone-button fallback, a reference-capture flow, the verifier, a voice or tap query, a 24 h auto-delete, and visible handling of permission denied, session STOPPED, Bluetooth degradation and an offline "unsure" result. Plus a held-out test set of about 100 labelled bursts, with accuracy reported against a naive "describe the image" prompt baseline.

**Fit.**
- Meta: C1 (a reframing of "memory" that judges have not seen), C3 (daily, a pilot with a senior-living or home-care provider), C4 (consent and retention are the product, the cognitive accessibility angle is real).
- Jurors: Otto (a recurring daily trigger), Daksh (binary verifier, baseline, failure cases), Kia (a problem everyone recognises), Beer (one insight).
- Tech challenges: Gemini API (the verifier VLM), Gemma (only if an on-phone or hosted Gemma verifier is actually used), ElevenLabs (voice replies, only a light fit), Codex.

---

## 2. "Basket": the shopping list that ticks itself off and checks what you pick up (BET)

**User and moment.** A parent doing the weekly shop at a K-Market with a child who has a peanut allergy. One hand holds the basket, the other picks items. The list is on a phone they can't hold, and allergen print is tiny and in Finnish and Swedish.

**Why existing options fall short.**
- Phone list apps need a free hand to tick items off. Scanner apps (nutrition or allergen) need you to decide to scan, then point the phone at the barcode, for every item.
- Meta AI can answer "does this contain peanuts?" if asked (competitive.md: label recognition), but it does not know your list or your family's constraints, and it never speaks unless asked.

**Mechanism.** *Pick-up-gated perception against a personal context.*
1. An on-phone gate watches for one event: "a new object enters the hand region and moves toward the bottom of the frame" (into the basket). The stream stays at 360x640 at low fps.
2. Only on that event do the 2-3 sharpest frames go to the VLM. It matches them against the list (fuzzy and multilingual: "kaurajuoma" means oat drink) and against the household constraint profile (allergens, "no pork", budget).
3. The output is silent when an item is fine and on the list, a soft chime when it is ticked off, and speech only for a conflict ("contains peanut oil") or an extra ("not on list, 4.20 €, continue?").
4. At the exit, the wearer hears "You still need: eggs, oat drink."

The insight is **silence by default**: the app speaks only on exceptions. That is what makes it usable for 25 minutes in a shop, and the measurable result is the speech-events-to-items ratio.

**Why glasses are essential.** The trigger is the wearer's own hand taking an item, seen from their eyes while both hands are busy. A phone in a pocket cannot see it.

**30-second demo.**
- Props: six real grocery items on the table and a basket. The list on the phone has four.
- The peer picks oat drink and hears a chime; the phone list ticks it off.
- The peer picks a chocolate bar with nuts and hears "Contains hazelnut. Leo's profile says avoid."
- The peer is told "You still need eggs."
- The phone shows the count of uploads versus frames streamed (for example "6 uploads / 900 frames").

**Hardest risk.** Reading allergen text at stream resolution. Small print may need a "hold it closer" prompt, or the 720x1280 tier when bandwidth allows. Product recognition without a barcode database is also risky. Mitigation: match against the list's item *categories*, not SKUs. The demo **survives without a device** (Mock Device Kit plus recorded clip).

**Smallest complete MVP.** A list (typed or spoken) and one allergen profile, the pick-up gate, match/conflict/extra outputs, an exit summary, and visible error states. Evaluation: tick-off precision and recall and allergen recall on a recorded 30-item shop, against a "VLM on every 2 s frame" baseline (cost, false alarms).

**Fit.**
- Meta: C1, C3 (pilot with S-Group or K-Group or the Finnish Allergy, Skin and Asthma Federation; the pilot partner is a suggestion and has not been contacted), C4 (low-vision label reading, silent-by-default UX, frames not stored).
- Jurors: Kia, Otto (weekly ritual), Umar (clear first audience), Daksh (recall on allergens, false-alarm rate).
- Tech challenges: Gemini API, Codex, ElevenLabs (light). Context.dev or Oxylabs could fetch product allergen data live, but only honestly if we actually use it for the lookup.

---

## 3. "Show Me Once": record a household task by doing it, then guide someone else

**User and moment.** Families and shared homes. Grandma's karjalanpiirakka technique, how the sauna stove or the building's laundry machine works, how Dad resets the router. On a Sunday the expert does it once while wearing the glasses and narrating. On Wednesday the teenager or new flatmate does it, guided.

**Why existing options fall short.**
- Phone video tutorials are passive, so you scrub with floury hands.
- Recipe or step viewers do no sensing and are already flagged as obvious (competitive.md).
- Meta's grant-funded trade coaching is professional and vertical (opportunity.md §4).

**Mechanism.** *Author-side POV becomes a learner-side checker.*
1. A multimodal model segments the expert's POV video and narration into steps, each with a key frame and a "done-state" description.
2. On the learner side, the same gated stream compares the learner's view with the expert's done-state key frame for the current step. It advances on a match and flags "the expert's dough was thinner" on a mismatch.
3. The author view is the reference, so no task-specific training is needed.

**Why glasses are essential.** The first-person view is used twice. Only glasses capture the expert's hands-eye view without a camera operator, and only glasses let the learner compare without putting the task down.

**30-second demo.** Pre-recorded expert clip (for example, folding a paper fortune-teller or setting up a pour-over). The observer sees the auto-generated 5-step guide on the phone and Display. The peer follows: the step advances itself when their fold matches; a deliberately wrong fold gets "Not yet: the expert's corner was folded to the centre."

**Hardest risk.** Segmentation and done-state matching quality on unconstrained tasks. Within 40 h it has to be scoped to one or two rehearsed tasks. The demo survives on mock (recorded clips).

**Smallest complete MVP.** Record → segment → edit the steps on the phone → guided replay with match/advance for one task, plus error states. Metric: step-advance accuracy and time-to-complete versus a phone video baseline with 3-5 peers.

**Fit.**
- Meta: strongest on C1 and C2, and on "equal footing" because it works audio-only and on Display (L898).
- Jurors: Timo (insight that scales), Beer (one idea), peer-floor wow.
- Tech challenges: Gemini API (video understanding), Modal or Verda only if segmentation is self-hosted, Codex.

---

## 4. "Step Guard": a cooking companion that notices missed steps

**User and moment.** A weeknight cook following a new recipe with oily hands. At 18:40 they forget the baking powder, or add salt twice.

**Why existing options fall short.** Recipe apps and Display step viewers are passive (competitive.md lists this as an obvious idea). Built-in assistants answer "what's next?" but do not know what you have already done.

**Mechanism.** The recipe is compiled into a state machine of observable events ("baking powder container tipped over the bowl"). A gated event detector (container-over-bowl via hand plus object proximity) makes a VLM confirmation call. The app tracks done and skipped steps and speaks **only** on a skip, a duplicate, or when you ask "where am I?". The insight is that state tracking, not step display, is the value.

**Why glasses are essential.** The bowl, from above, at the moment of pouring, is the wearer's view. A phone propped on the counter sees the wrong angle and is splattered.

**30-second demo.** A three-ingredient "overnight oats" recipe with jars on the table. The peer adds oats, then milk, skipping chia, and closes the lid. The glasses say "Chia seeds not added yet." The phone shows a timeline of detected events.

**Hardest risk.** Event detection reliability: "pouring" versus "moving the jar". Limited stove access at the venue, so the demo uses cold recipes. The demo survives on mock.

**Smallest complete MVP.** Three hand-authored recipes, the event detector, skip/duplicate alerts, error states, and a labelled clip set for precision and recall of skip detection.

**Fit.**
- Meta: C1 (medium, since cooking is crowded), C3, C4 (cognitive load, low vision).
- Jurors: Daksh (measurable), Otto (daily).
- Tech challenges: Gemini API, Gemma (if the on-phone event classifier is Gemma), Codex.

**Note.** This overlaps with concept 3's checker. They could share the engine, but pick one story.

---

## 5. "Which Way Now": the departure board read against *your* trip

**User and moment.** A visitor or a new resident at Helsinki Central at 08:10, facing a Finnish-only board, with a ticket in the phone and luggage in both hands.

**Why existing options fall short.** Meta ships translation (competitive.md), but translation tells you what the board *says*, not which line is *yours*. Journey apps need the phone out and do not know which sign you are looking at.

**Mechanism.** The itinerary (from a ticket screenshot or a typed destination) becomes a query. Sign OCR runs only when the gaze stays on dense text (a sharpness and text-density gate). The VLM extracts the single row that matches and returns one directive: "Platform 7, 08:32, 4 minutes late. Your coach is at the front." Large board text is legible at stream resolution (estimate).

**Why glasses are essential.** "The sign I am looking at right now", with both hands on luggage.

**30-second demo.** A printed departure-board poster (Finnish, 12 rows) on the table. The peer has "Tampere" set, glances at it and hears "Platform 7, 08:32." The observer sees the matched row highlighted on the phone mirror. Baseline: a peer finds the row by hand with a stopwatch running.

**Hardest risk.** Strong overlap with built-in translation and navigation in the judges' eyes. The differentiator has to be very visible. Live transit data via an HSL/Digitransit API is **unknown** (not checked) and would sit behind a mock. The demo survives on mock.

**Smallest complete MVP.** Itinerary entry, gated board OCR, row matching, a one-line directive, and error states. Metric: time-to-answer against phone lookup and manual reading, with 5 peers.

**Fit.**
- Meta: C3 (a pilot with VR or HSL), C4 (dyslexia, low vision, non-Finnish speakers).
- Jurors: Kia, Umar.
- Tech challenges: Gemini API, Context.dev or Oxylabs (only if live timetable data is fetched from the web), Codex.

---

## 6. "Sana": learn Finnish from the objects in your own day

**User and moment.** An immigrant or student in Helsinki (a large, local audience) who abandons flashcard apps by week two. At breakfast they pick up the same mug every day.

**Why existing options fall short.** Flashcard decks are generic and disconnected from context. Translation (shipped by Meta) gives answers, not retention. The grant-funded language tutor Immerse exists (competitive.md), and its exact features are **unknown**.

**Mechanism.** *Context-cued spaced repetition.*
1. Objects the wearer handles repeatedly (handling events from a hand-in-frame gate) become cards.
2. Reviews are triggered **when the same object is next in the wearer's hands**, not at a time of day. The glasses ask "Mikä tämä on?" and the wearer answers by voice.
3. Phone ASR or the beta Speech capability grades the answer, and the SRS schedule updates.

The insight is that the review cue is the real-world object itself, so practice happens inside daily routines.

**Why glasses are essential.** The object in your hands is the flashcard. A phone cannot know what you are holding.

**30-second demo.** Three objects on the table. The peer picks up a mug and hears "muki". On the second pick-up the glasses ask, the peer says "muki", and hears "Oikein!" The phone shows the card's next review being pushed out.

**Hardest risk.** No measurable learning outcome within 40 h (retention takes days), so the evidence is weak for Daksh. Speech grading in a noisy hall is a second risk: HFP is beamformed toward the wearer, which helps (feasibility.md §3). The demo survives on mock.

**Smallest complete MVP.** About 20 object categories, the handling gate, SRS scheduling, voice answer grading, and error states.

**Fit.**
- Meta: C1, C3 (pilot with an integration-training provider), C4.
- Jurors: Otto (a strong recurring trigger), Kia.
- Tech challenges: Gemini API, ElevenLabs (natural Finnish pronunciation is genuinely central here), Codex.

---

## 7. "Fridge Glance": passive pantry inventory from incidental looks

**User and moment.** A household where nobody knows whether there are eggs at home. At 17:30, in the shop after work, the wearer has to decide whether to buy milk.

**Why existing options fall short.** Smart fridges are expensive and rare. Manual inventory apps are abandoned. A phone photo of the fridge needs remembering to take it.

**Mechanism.** While the fridge or cupboard door is open (gate: the scene matches a reference "open fridge" embedding), a few frames are kept. A VLM keeps a running inventory with a confidence and a last-seen time per item. "Do I have eggs?" is answered with "Yes, about 4, seen this morning." The frames are discarded and only the item list is kept.

**Why glasses are essential.** The capture is a by-product of a glance you were already making. No other device is looking into your fridge.

**30-second demo.** A cardboard "fridge" with items. The peer opens it, then from across the table asks "Do I need milk?" and hears "No milk seen at 14:05." Remove the milk and open again: "Milk gone."

**Hardest risk.** Occlusion and counting accuracy. This is also the weakest of the seven on privacy in a home with other people and on novelty. The demo survives on mock.

**Smallest complete MVP.** Fridge gate, inventory extraction, voice query, retention rules. It pairs naturally with "Basket" (concept 2) as its stretch goal.

**Fit.**
- Meta: C3 (medium).
- Jurors: Otto.
- Tech challenges: Gemini API, MongoDB or Aiven (inventory store, light), Codex.

---

## Ranking and bets

| # | Concept | Daily trigger | Before/after legibility | Measurable vs baseline | Novelty vs what judges have seen | Device-free fallback |
|---|---|---|---|---|---|---|
| 1 | Did I? | daily | very high | yes (verifier accuracy, naive-prompt baseline) | high | yes |
| 2 | Basket | weekly+ | very high | yes (tick-off and allergen recall, uploads saved) | medium-high | yes |
| 3 | Show Me Once | weekly | high (wow) | yes (completion time vs video) | high | yes |
| 4 | Step Guard | daily | medium | yes | medium (cooking is crowded) | yes |
| 5 | Which Way Now | travel days | high | yes (time-to-answer) | medium (overlaps with translation) | yes |
| 6 | Sana | daily | medium | weak within 40 h | medium | yes |
| 7 | Fridge Glance | daily | medium | partial | low-medium | yes |

All scores are estimates.

**Bet 1: "Did I?"**, for the Meta challenge, for overall, and for the combined chance.
- It answers all four Meta criteria at once. The trust story *is* the design (narrow purpose, 24 h retention, which matches Meta's own AUP principle). It has a cognitive-accessibility angle and a daily trigger.
- For the jury, it is a problem everyone at the peer table has had, which matters most for reaching the top 5. It has a binary, measurable verifier against a naive baseline (Daksh, Beer) and an obvious return trigger (Otto).
- The table demo uses inert props and works with no talking.

**Bet 2: "Basket"**, mainly for the Meta challenge and peer-floor legibility.
- Shopping with your hands full is the archetypal "everyone, everyday" glasses moment.
- "Silent unless it matters" is a visible UX insight.
- The allergen check gives real stakes and a credible local pilot.
- It is slightly weaker on novelty than "Did I?", because judges have seen scanners. It wins if the pick-up gate and silence-by-default are shown clearly.

**If we want maximum upside instead:** "Show Me Once" has the highest jury wow. Its risk is that unconstrained segmentation fails, so it is better kept as a stretch layer on top of the same gated-stream engine.

**Shared engine.** Concepts 1, 2, 4 and 6 all use the same "hand-in-frame event gate → few frames → VLM verdict → speak only on exception" core. Building that core first keeps the choice of story open until about hour 8.

**Open questions for the Meta booth that change this ranking.**
- Whether Meta AI already offers a photo-memory or "did I" feature (affects concept 1).
- Whether head-motion data is available in DAT 1.0 (would improve the gates).
- How many devices we can keep through the review (affects every concept; see feasibility.md §10).

<!-- complete -->
