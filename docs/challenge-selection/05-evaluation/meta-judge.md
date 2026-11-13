# Meta partner judge: scores for all 17 candidates

**Summary**
- Lens: a Meta judge applying the official rubric exactly as written. Four criteria at 25% each: creativity and use case, technical execution, real-world value and feasibility, and UX (input, accessibility and trust) (CHALLENGES.md:L934-937). Each criterion is scored 0-25 and the total is out of 100.
- Top four: **panel-reader 82**, **did-i 76**, **beacon 74** and **teardown-memory 73**, with **nod 72** close behind. Panel Reader leads because it is the only one strong on all four criteria with no beta capability in its core: two-handed first-person use, offline on-phone loop, a blind audience and no uploads during use.
- Beacon and Nod have the highest creativity and accessibility ceilings, but their core depends on **beta Motion**, which is limited to dev and beta channels. Running Motion with the camera stream is not documented ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion), opened). Ask about both at the booth in hour 0.
- One hard reject: **heads-up-sounds**. Its core relies on beta camera-stream audio, it has no GA fallback that keeps the glasses essential, it needs a Display unit, and Mock support is unknown. Meta would be uncomfortable awarding **basket** and **cross-contact** (safety-critical allergen false negatives) and **which-way-now** (Meta AI already does most of it).

---

## 1. How I scored

The criteria are from CHALLENGES.md:L934-937, and each one is read against the brief text it echoes.

| Criterion (25%) | What I looked for | Brief text it maps to |
|---|---|---|
| **C1 Creativity and use case** | An original, focused everyday problem where the *first-person view* enables a new or better interaction. It must go beyond mirroring a phone, and it must not be something Meta AI, Be My Eyes or a grant-funded app already does | L886, L890, L894, L900 ("original, relevant use case with a clear wearable benefit"), L906 |
| **C2 Technical execution** | A functional prototype that "handles permissions, errors, performance trade-offs, connectivity, and device state changes". The core has to be buildable on GA DAT capabilities within the 360-504p, 2-15 fps Bluetooth limits, and a live real-glasses demo has to be reliable. Beta-dependent cores lose points. | L896, L900; feasibility.md §3, §5 |
| **C3 Real-world value and feasibility** | A named audience, a frequent need, a "focused, plausible path to adoption or a pilot", and whether it would actually work in real conditions (battery, lighting, safety) | L896, L900, L906 |
| **C4 UX: input, accessibility and trust** | Intuitive input that works across abilities; inclusion "for people with all abilities"; consent and safe data practices shown in the demo; fit with Meta's "narrow purpose, short retention, obvious to bystanders" principle | L890, L902, L906; [acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use) (opened) |

**What Meta wants to showcase (inference from the sources).** The guide lists the use categories Meta encourages: "hands-free capture and logging" (inspection, repair, inventory), "assistive and accessibility", "context on demand ... deliberate, not ambient", "motion and input: gesture control, activity and form tracking, and coaching", and "enterprise workflows: guided procedures ... compliance checks". The principle is "narrow purpose, short retention, obvious to bystanders" ([acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use), opened). Meta's June 2026 accessibility showcase covers blind and low-vision users almost entirely and leaves out Deaf/HoH, motor and cognitive users (opportunity.md §1). DAT 1.0 headlines "camera capture, voice streaming and motion tracking" (ai-glasses.md §1, Connect recap).

**What Meta would be embarrassed to award.** Anything close to face or voice identification, surreptitious or ambient capture, or bystander profiling (feasibility.md §6). It would also avoid apps that make a safety-critical promise the device cannot keep (allergens, stoves, food safety), because a failure would appear in press as "Meta glasses told my child it was safe". The same goes for a near-clone of a first-party Meta AI feature, and for a demo that only runs on Mock Device Kit.

**Hard reject rule.** I applied it when the core mechanism depends on a capability that is beta or gated with no GA fallback that keeps the glasses essential, or when no working demo is plausible, or when the entry is essentially an existing product.

## 2. Ranked table

Each criterion is scored 0-25 and the total is out of 100. The scores are my estimates.

| Rank | id | C1 Creativity | C2 Tech exec | C3 Value | C4 UX/access/trust | **Total** | Hard reject | Strongest objection (short) |
|---|---|---|---|---|---|---|---|---|
| 1 | panel-reader | 20 | 20 | 19 | 23 | **82** | no | Fingertip and homography under occlusion at 360-504p is unproven, and blind-user claims need blind testers |
| 2 | did-i | 16 | 18 | 20 | 22 | **76** | no | A false "off" on a stove is the failure Meta would not want attributed to its glasses; 3-angle convergence reduces originality |
| 3 | beacon | 22 | 15 | 16 | 21 | **74** | no | Core cue relies on beta Motion, nullable orientation and an undocumented Motion+camera combination |
| 4 | teardown-memory | 21 | 20 | 16 | 16 | **73** | no | The accessibility story is secondary; small-part diffs under head motion are fragile |
| 5 | nod | 22 | 15 | 13 | 22 | **72** | no | Beta Motion core; false accepts from ordinary head motion; niche pilot |
| 6 | private-hand | 18 | 17 | 10 | 20 | **65** | no | A UNO-only card game is a narrow real-world value story |
| 7 | step-check | 12 | 20 | 17 | 15 | **64** | no | The most obvious idea; Meta already funds guided procedures and trade coaching |
| 8 | show-me-once | 18 | 16 | 14 | 14 | **62** | no | Segmentation and done-state matching on open tasks; the two-phase demo is hard to follow |
| 9 | basket | 10 | 15 | 17 | 14 | **56** | no | Shopping scanners are commodity, missing an allergen is safety-critical, and in-store capture involves bystanders |
| 10 | glance-log | 9 | 16 | 16 | 13 | **54** | no | Meta AI already reads displays; the interaction is small and the wow factor is low |
| 11 | table-talk | 11 | 11 | 12 | 18 | **52** | no | The camera is barely used (L886); possible overlap with first-party captions; needs Display and beta Motion |
| 12 | coverage-inspector | 11 | 13 | 14 | 12 | **50** | no | Stickers look artificial, and grant-funded inspection documentation already exists |
| 13 | heads-up-sounds | 15 | 7 | 13 | 14 | **49** | **yes** | Core relies on beta camera-stream audio with no glasses-essential fallback, plus Display and weak mock |
| 14 | cross-contact | 17 | 12 | 9 | 10 | **48** | no | A safety-critical alert at 7 fps with about 1 h of streaming battery; Meta cannot endorse the claim |
| 15 | sana | 11 | 12 | 10 | 13 | **46** | no | Overlaps the grant-funded Immerse tutor; retention cannot be shown in 40 h |
| 16 | which-way-now | 6 | 11 | 13 | 12 | **42** | no | Meta AI "look and ask" plus translation already covers most of it |
| 17 | still-head | 14 | 11 | 5 | 4 | **34** | no | Off-brief: not everyday, no accessibility angle, beta Motion core |

## 3. Evidence per candidate

### 1. panel-reader (82)
**C1 20.** "Your finger is on Eco, move right two" is an interaction that a single Meta AI answer cannot give (2-5 s round trip, feasibility.md §5). A phone app cannot do it either, because a blind user cannot aim a phone while both hands explore the panel (_candidates.md §panel-reader). It is a precise first-person use (L894). It loses points because VizLens-style prior research exists and the blind and low-vision audience is the one Meta already markets (opportunity.md §1).
**C2 20.** It needs no beta capability. A cloud-once registration is followed by an on-phone homography and fingertip loop at 7-15 fps that works offline, which is a clear performance trade-off (L900). The demo works on Mock with a head strap.
**C3 19.** Flat touch panels are a widespread everyday barrier. The Finnish Federation of the Visually Impaired is a plausible pilot partner but has not been contacted.
**C4 23.** Hands-free, eyes-free, earcon plus speech output, one upload per appliance and none during use. This fits "narrow purpose, short retention" exactly.
**Strongest objection:** the finger hides the label it is pointing at, and tracking at 360-504p in venue light is unvalidated. If it misreads live, the demo becomes a blind user pressing the wrong button on stage. Also, claiming blind-user value without blind testers will be noticed.

### 2. did-i (76)
**C1 16.** The idea of verifying a checkpoint instead of recording everything is a thoughtful angle. But three of five generators reached it independently, so other teams will too, and it can be read as "a memory recorder" (_candidates.md §did-i).
**C2 18.** No beta capability is needed. It uses an attention gate, a few-frame verifier with a strict schema and a "not sure" threshold, and an explicit state machine for permission, STOPPED, degraded and offline. The upload counter (2 against about 60) makes the performance trade-off visible.
**C3 20.** It is a daily, very common doubt with a strong accessibility subgroup (ADHD, acquired brain injury), framed as everyday support rather than treatment.
**C4 22.** The trust design is the product: verdict plus thumbnail only, 24 h deletion and voice, tap or phone query. This matches Meta's "short retention" and "deliberate, not ambient" guidance (acceptable-use guide).
**Strongest objection:** a false "Yes, the stove is off" is a home-safety failure attributed to Meta glasses. Knob state at 360-504p with blur is unproven, and the 'not sure' fallback has to fire reliably.

### 3. beacon (74)
**C1 22.** Using the head as a pointer, with an audio cue at IMU rate, is new for this platform. It fixes the staleness of one-shot Meta AI and Be My Eyes voice directions (_candidates.md §beacon). It also uses Motion, which DAT 1.0 headlines (Connect recap via ai-glasses.md).
**C2 15.** The engineering is excellent if it runs. But Motion "is a beta capability" on development and beta channels only, and orientation is nullable ("not every device produces it"). The motion guide does not cover running Motion together with camera streaming ([motion guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/motion), opened). The fallback is slower visual-only tracking, and a live demo needs real glasses.
**C3 16.** Finding a specific item is a real need for blind and low-vision users. Meta AI and Be My Eyes partly cover it, and it only needs to be better rather than first.
**C4 21.** The cue is non-verbal, both hands stay free, and the helper-tap variant is consented remote help.
**Strongest objection:** if loaner glasses return `CAPABILITY_DENIED` for Motion, or orientation is null, the defining feature degrades to "the camera finds the can". That is close to the commodity assistant.

### 4. teardown-memory (73)
**C1 21.** An ordered spatial undo history for physical work is original; it does not appear in competitive.md or the grant list. Meta's guide encourages "hands-free capture and logging ... repair".
**C2 20.** It uses no beta capability, a local fiducial diff, crop-only uploads and asynchronous LLM labels, which is a clean latency and bandwidth trade-off. It has a full state machine.
**C3 16.** Repair cafés and maker spaces are plausible pilot partners, but availability is unknown and it is a hobbyist, less-than-daily audience.
**C4 16.** Hands-free input and a good privacy profile. Accessibility (working-memory difficulty) is a secondary line, while the brief stresses "people with all abilities" three times.
**Strongest objection:** "everyone, everyday" is weak (home repair is occasional), and diff reliability with small parts and head motion at 504p is fragile.

### 5. nod (72)
**C1 22.** "The world is the symbol board" is a new input vocabulary built on Motion. It fills Meta's motor-impairment gap (opportunity.md §1).
**C2 15.** It is beta-Motion core with an undocumented Motion+camera combination. The optical-flow fallback is weaker (estimate), and false accepts across users are the main technical risk.
**C3 13.** A niche, carer-led audience (ALS, CP, high SCI). The pilot partner is uncontacted, and peers may read it as a smart-home demo.
**C4 22.** The strongest accessibility story of the set: no hands and no voice, a per-user calibration, and silent input that works in noise.
**Strongest objection:** an unexpected nod that orders or switches something is a trust failure for exactly the users who cannot easily undo it. If Motion is gated, the core is gone.

### 6. private-hand (65)
**C1 18.** Social inclusion and play is a gap in Meta's story, and the private eyes-free output is a real glasses benefit.
**C2 17.** On-phone fine-tuned detector, temporal voting, rules engine, no frames leaving the phone. Card detection itself is known CV.
**C3 10.** UNO-only for blind players is a very narrow audience with no clear adoption path beyond a demo.
**C4 20.** Excellent privacy (zero uploads), and the whispered output protects the hand.
**Strongest objection:** Meta judges weigh "real-world value and feasibility" at 25%, and a single card game will read as a charming toy.

### 7. step-check (64)
**C1 12.** Four of five generators converged on it. Meta's guide already lists "guided procedures ... compliance checks", and Meta funds construction trade coaching (competitive.md), so judges will have seen it.
**C2 20.** A sub-second local fiducial diff, the VLM kept off the alert path, and a seeded-error benchmark make it technically very sound.
**C3 17.** Lab and assembly pilots are plausible.
**C4 15.** Silent by default and hands-free. Little specific accessibility content.
**Strongest objection:** the most obvious idea in the set. It wins only on execution against teams with the same pitch.

### 8. show-me-once (62)
**C1 18.** It uses the first-person view twice, for the author and the learner, and suits Meta's audio and Display "equal footing" (L898, opportunity.md §4).
**C2 16.** Segmentation and done-state matching on unconstrained tasks, the HFP-before-camera ordering rule (silent route failure, feasibility.md §3) and live authoring need real glasses.
**C3 14.** Family know-how is real but occasional, and it overlaps grant-funded coaching.
**C4 14.** A delete-all control is good. Recording a household for later replay sits less comfortably with "short retention".
**Strongest objection:** the two-phase demo is hard to follow in 60 seconds, and matching quality on a live napkin fold is a coin flip.

### 9. basket (56)
**C1 10.** Shopping and nutrition scanners are on the "teams reach for this first" list (competitive.md), and Meta AI already answers "does this contain peanuts?"
**C2 15.** The pick-up gate is good. Allergen print at stream resolution and product recognition without SKUs are unproven.
**C3 17.** A weekly ritual with a clear retailer or allergy-federation pilot story.
**C4 14.** Silent by default is nice. But continuous capture in a supermarket films other shoppers, and a missed allergen is a child-safety failure.
**Strongest objection:** Meta would not want to be the judge that awarded "the glasses that check your child's allergens" given unproven recall on Finnish and Swedish small print.

### 10. glance-log (54)
**C1 9.** Meta AI can already read a display on request, so the novelty is the structured log, which is a modest addition.
**C2 16.** Low risk and no beta capability. Analog accuracy is unknown.
**C3 16.** A clear B2B pilot type (housing maintenance) that matches Meta's "inspection" and "enterprise" categories. The partner is unknown.
**C4 13.** Zero-touch input helps limited dexterity. Accessibility is otherwise thin.
**Strongest objection:** it looks like OCR plus a CSV. It is safe, but a judge will not remember it.

### 11. table-talk (52)
**C1 11.** Captions are already associated with Meta's own products, and the camera is only lightly used. That goes against L886's emphasis on the first-person field of view.
**C2 11.** It needs Display (half the pool) and beta Motion, plus a multi-phone join flow. Per-speaker ASR is ordinary web engineering.
**C3 12.** HoH users are real, but the friction of making everyone join with a phone limits adoption.
**C4 18.** Consent through QR join with no voice biometrics is a model trust design, and it fills the Deaf/HoH gap.
**Strongest objection:** if Meta ships captions on Display (unknown, ask at the booth), this is a near-clone, and it barely uses the camera.

### 12. coverage-inspector (50)
**C1 11.** Inspection documentation is grant-funded (United Spinal, Onsite; competitive.md). Proving coverage is the only new angle.
**C2 13.** Sticker zones are easy and look artificial. Without stickers it is unproven.
**C3 14.** A credible B2B rental story.
**C4 12.** Little accessibility content.
**Strongest objection:** a sticker toolbox demo will not convince Meta that this works on real cars or apartments.

### 13. heads-up-sounds (49, hard reject)
**C1 15.** Deaf alerts confirmed by gaze is a good idea, and Android Sound Notifications is the baseline.
**C2 7.** The core runs on camera-stream audio, which is beta only (feasibility.md §3). It needs Ray-Ban Display for output, the hall noise threatens the classifier, and whether Mock simulates stream audio is unknown (_candidates.md). A phone-mic fallback removes the glasses benefit.
**C3 13.** A real need, but a baseline product exists.
**C4 14.** Strong accessibility intent. Ambient microphone capture of a household, including bystander speech, needs a careful consent story.
**Strongest objection (hard reject reason):** it depends on an unreliable beta integration with no glasses-essential fallback, and a working live demo in a loud hall on a scarce Display unit is not plausible enough to commit 40 hours to.

### 14. cross-contact (48)
**C1 17.** Taint propagation is clever and original.
**C2 12.** Utensil-tip tracking at 7 fps is fragile.
**C3 9.** About 1 h of streaming battery against an 8 h shift (an estimate, _candidates.md) breaks the real deployment.
**C4 10.** A safety-critical false negative is the headline risk. Kitchen staff on camera need on-site notice (acceptable-use guide, enterprise).
**Strongest objection:** Meta cannot endorse "the glasses will catch allergen cross-contact", and anything weaker undermines the pitch.

### 15. sana (46)
**C1 11.** Context-cued spaced repetition is a nice idea, but the grant-funded Immerse tutor overlaps it (competitive.md).
**C2 12.** Speech grading in a noisy hall, and a handling gate over about 20 categories.
**C3 10.** Retention cannot be shown in 40 h.
**C4 13.** Benign, with little accessibility content.
**Strongest objection:** no evidence of value can be produced at the event.

### 16. which-way-now (42)
**C1 6.** Meta already ships translation and "look and ask" (competitive.md). Asking Meta AI "which platform for Tampere?" covers most of the value. The itinerary memory is thin.
**C2 11.** Simple OCR plus row match. Live data is behind a mock.
**C3 13.** Travellers are real users, but the pilot (VR or HSL) is uncontacted and the station already has apps.
**C4 12.** It helps low-vision and dyslexic users, and capture in a public station needs care.
**Strongest objection:** close to an existing first-party feature, so it does not meet the "original" requirement in L900. It is not quite a hard reject only because the itinerary filter is a real, if small, difference.

### 17. still-head (34)
**C1 14.** Meta's guide lists "form tracking, coaching", and IMU coaching is fun.
**C2 11.** Beta Motion core with nullable orientation.
**C3 5.** Golf putting is not "everyone, everyday".
**C4 4.** No accessibility or inclusion angle.
**Strongest objection:** it is off-brief on two of the four criteria (L896 "people with all abilities", L906 "everyday").

## 4. Answers for the three objectives (from this lens only)

- **(1) Meta challenge:** panel-reader, then did-i. Both are GA-only, trust-forward and accessibility-led. Beacon and nod score higher on creativity if Motion is confirmed enabled on loaner glasses at hour 0. If it is, either could overtake did-i with Meta judges, because Motion is a DAT 1.0 headline capability that public projects do not use (opportunity.md, "underused capabilities").
- **(2) Overall:** outside this lens. Other evaluators cover peer review and the jury.
- **(3) Combined:** from Meta's side, the safest base is panel-reader. It has no beta dependency, demos with a blindfolded peer and a clear baseline, and avoids the two most common traps (a commodity assistant and a safety-critical promise).

**Hour-0 booth questions that would change these scores:** Is Motion enabled on the loaner devices, and does it run with the camera stream? Do the devices report orientation? Is camera-stream audio enabled? Does Ray-Ban Display ship live captions? Is in-store or kitchen capture acceptable under Meta's bystander-notice guidance?

<!-- complete -->
