# Demo evaluator: demonstration impact of the 17 Meta glasses candidates

**Summary**
- **Top demos: `panel-reader` (84), `step-check` (79), `teardown-memory` (77), `did-i` (75), `beacon` (73).** Each has a visible before/after on a table that a stranger understands in under 30 s, and each produces its own baseline number during the demo.
- **The deciding factor at the peer table is who does the trying.** The wearer hears the glasses through an open-ear speaker that bystanders cannot hear in a noisy hall, and whether strangers may wear the shared glasses is unknown (feasibility.md §9). Candidates where the bystander acts on props (plants an error, misplaces a part, plays a card, taps a target) while a teammate wears the glasses, and where the result shows on a mirror screen, beat candidates whose payoff is a spoken sentence only the wearer hears.
- **Weakest demos:** `heads-up-sounds` (hard reject on demo grounds: its core input is beta camera-stream audio with no GA fallback, it is "weak on mock", and it needs to classify sounds in the hall), `sana` (speech grading in noise, and its value, retention, cannot be shown) and `coverage-inspector`, `show-me-once` and `table-talk` (slow, two-phase or high-friction).
- Highest-variance demo: `beacon`. If beta Motion works on the loaner glasses, it is the most visceral demo in the set (a blindfolded stranger reaches the right can). If it does not, the visual-only fallback is slower and the demo loses much of its effect.

---

## 1. Lens and criteria

I scored only **demo impact**, under two settings. All weights are my estimates.

**A. Peer-review table (55%).** Face to face, noisy, with a stranger who has a few minutes and compares pairwise (00-rules-and-jury.md §3, 2024 Gavel precedent; 2026 mechanics unknown). They must get it in about 60-90 s (00-rules-and-jury.md §3, estimate).

| # | Criterion | Weight |
|---|---|---|
| A1 | **Obvious value without explanation.** Everyday object or situation, one sentence of setup | 15 |
| A2 | **Visible before/after inside the demo.** The failure without us and the success with us, both on the table | 12 |
| A3 | **A bystander can take part**, ideally *without wearing the glasses* (hygiene and sharing rules unknown, feasibility.md §9) | 12 |
| A4 | **Readable in a noisy hall.** The payoff is visible on a mirror screen or a physical action, not just audio in the wearer's ear | 8 |
| A5 | **Survives repeated runs.** No beta capability on the critical path, so it can fall back to Mock Device Kit or a recording (feasibility.md §3, §9) | 8 |

**B. Seven-person jury, 3-minute pitch (45%).** In 2024 finalists had exactly 3 minutes and demos had to be inside the submitted deck (00-rules-and-jury.md §2, 2024 precedent; the 2026 format is unknown). So assume a **recorded clip** plus at most a short live moment.

| # | Criterion | Weight |
|---|---|---|
| B1 | **A measured result against a baseline is part of the demo itself** (a scoreboard, stopwatch or counter on screen), not a slide added afterwards (Daksh, Beer, Arturs lenses, 00-rules-and-jury.md §5) | 20 |
| B2 | **The insight is visible.** You can *see* why it beats the obvious approach, such as latency, uploads, or the IMU against the cloud | 15 |
| B3 | **It fits a 60 s clip.** One complete loop from real input to useful result, with a failure case shown | 10 |

The candidate file's timings, accuracies and baselines are its own estimates (_candidates.md:L16). I did not re-estimate model accuracy. Where a demo depends on an uncertain capability, I discounted the score for the probability that the demo looks worse. The capability facts used are in _candidates.md:L18-37 and feasibility.md §3 and §5.

**Hard reject (demo lens):** only when the demo, as written, cannot plausibly be shown working at the table or in a clip.

## 2. Ranked table

| Rank | id | Peer (/55) | Jury (/45) | **Score** | Hard reject | One-line reason |
|---|---|---|---|---|---|---|
| 1 | `panel-reader` | 46 | 38 | **84** | no | A blindfolded stranger gets a useless Meta AI answer, then taps "Delicate" correctly. The fingertip dot on the mirror makes it visible, and button accuracy against Meta AI is the result |
| 2 | `step-check` | 44 | 35 | **79** | no | The bystander plants the error without wearing anything, and the scoreboard of caught errors and false alarms *is* the evidence |
| 3 | `teardown-memory` | 44 | 33 | **77** | no | The live timeline fills as parts come off, and an observer's misplacement gets flagged. The loop is long for 2 minutes |
| 4 | `did-i` | 43 | 32 | **75** | no | Instantly relatable, with a negative run and an upload counter of 2 against 60. The wow is quiet, and the answer comes after a 2-5 s cloud wait |
| 5 | `beacon` | 42 | 31 | **73** | no | Most visceral if Motion works (blindfold, reach, time-to-touch against voice-only). Beta Motion and undocumented camera concurrency make it the riskiest top demo |
| 6 | `private-hand` | 42 | 30 | **72** | no | The reviewer *plays* against the wearer, which is very memorable. Card detection on fanned cards is a live-failure risk, and a round takes time |
| 7 | `cross-contact` | 41 | 29 | **70** | no | A 10 s demo with an instant red banner. A missed contact live is a safety-themed failure in front of judges |
| 8 | `basket` | 37 | 28 | **65** | no | Easy to follow, and the allergen warning lands. No live "without" baseline, and allergen text at stream resolution is uncertain |
| 9 | `nod` | 35 | 29 | **64** | no | Silent input that works in noise, and it moves people emotionally. It needs a stranger to wear and calibrate, and it rests on beta Motion |
| 10 | `glance-log` | 35 | 27 | **62** | no | A stopwatch against typing is a clean before/after, but meter reading has the lowest wow of the set |
| 11 | `still-head` | 38 | 20 | **58** | no | Fun putting game at the table, but the jury sees a niche golf toy with no inclusive value or insight |
| 12 | `which-way-now` | 33 | 24 | **57** | no | Quick and legible, but strangers read it as Google Lens or Meta translation |
| 13 | `coverage-inspector` | 30 | 24 | **54** | no | Clear "6/6 green", but stickers look staged and the stakes are invisible at a table |
| 14 | `table-talk` | 28 | 25 | **53** | no | The hall's noise is its real setting and a live WER panel is strong, but it needs a QR join, Display and beta Motion |
| 15 | `show-me-once` | 27 | 24 | **51** | no | A two-phase demo (record, wait about 10 s, then follow) that is hard to read in 2 minutes |
| 16 | `sana` | 26 | 15 | **41** | no | "Muki" and "Oikein!" are cute, but speech grading in the hall is fragile and retention cannot be shown |
| 17 | `heads-up-sounds` | 17 | 15 | **32** | **yes** | Core input is beta camera-stream audio with no GA fallback, weak on mock, and a sound classifier in the hall noise |

## 3. Evidence per candidate

### 1. `panel-reader` (84)
The demo stages its own baseline. A blindfolded peer first asks Meta AI about the printed washer panel and gets a description they cannot act on, then slides a finger and hears "Cotton... Synthetics... Delicate" and taps correctly (_candidates.md:L146). A mirror screen shows the fingertip dot on the control map, and a table speaker repeats the speech for observers, so the noise problem is already designed out. The insight ("cloud once, phone forever": one registration upload, then an offline on-phone loop at 7-15 fps) is visible as a lack of lag, set against the 2-5 s cloud round trip (_candidates.md:L144; feasibility.md §5, estimate). No beta capability is needed, and it reproduces on Mock Device Kit with a phone on a head strap (_candidates.md:L147), so it survives 40 table runs. For the jury, button accuracy against the Meta AI baseline is part of the demo (_candidates.md:L148). The bystander does have to wear something, either the glasses or a head-strapped phone, and be blindfolded, which adds friction at a crowded table. **Strongest objection:** if fingertip tracking or the homography jitters when the finger covers the label (the stated hardest risk, _candidates.md:L147), the spoken label flickers between buttons and the demo turns into a visible failure. Also, a sighted, blindfolded peer is not a blind user, so the team must not present it as user evidence (_candidates.md:L149).

### 2. `step-check` (79)
This is the best "bystander participates without wearing" design. The reviewer is invited to plant a wrong Duplo brick or token, the glasses name the expected one, and a scoreboard counts injected errors caught and false alarms (_candidates.md:L194). The bystander is the adversary, which is exactly Daksh's "can your metric be gamed?" test (00-rules-and-jury.md §5). For the jury, the scoreboard is a held-out result shown inside the clip. The alert path is local and under a second (estimate), with the VLM off the critical path (_candidates.md:L192), so the "speaks only on mistakes" insight is visible as speed. There is no beta dependency, and it works on mock (_candidates.md:L195). It loses points on A1, because a LEGO checker is understood instantly but does not feel like an everyday need to a stranger, and on novelty: four of five generators found it (_candidates.md:L188), so neighbouring tables may show something similar. **Strongest objection:** the bystander *will* try orientation and look-alike errors that the mat diff cannot see at 360-504p (_candidates.md:L195). An adversarial peer finds the miss in 30 seconds, and the scoreboard then counts against us.

### 3. `teardown-memory` (77)
There is a live visible artefact: a timeline fills on the cast screen as parts go into tray cells, reassembly shows the hole circled, and an observer's deliberate misplacement is caught with a chime (_candidates.md:L230). The observer takes part without wearing the glasses. The before/after is intuitive to anyone who has had leftover screws. For the jury, wrong-position steps per teardown is a natural metric (_candidates.md:L233), but the "without" baseline (a tripod phone or memory) is not on the table, which costs B1. A full remove-three-then-reassemble loop is long for 2 minutes and needs a reset between visitors. **Strongest objection:** ArUco detection distance and diff reliability with head motion are untested until hour 1 (_candidates.md:L231). If the diff misfires during removal, the timeline shows wrong steps, a failure every passer-by can see.

### 4. `did-i` (75)
This has the highest A1 of the set. Everyone has doubted the stove, and the scripted negative run ("No, it was ON") plus a thumbnail makes it credible (_candidates.md:L98). The upload counter (2 against about 60) puts the privacy insight on screen, and the held-out burst evaluation against a naive-prompt baseline with a stated false-"off" rate is ready-made jury evidence (_candidates.md:L100). It works fully on mock (_candidates.md:L99). Demo weaknesses: the payoff is a delayed spoken answer, with a cloud round trip of about 2-5 s (feasibility.md §5, estimate), in a noisy hall, so it needs mirrored text. The visible action (turning a prop knob) is mundane, and strangers may think "I'd just take a photo". **Strongest objection:** this is a low-drama demo. In a pairwise comparison it is understood instantly but may not be *remembered* against a blindfolded-reach or plant-an-error demo at the next table.

### 5. `beacon` (73)
If it works, this is the most theatrical demo here. A blindfolded peer follows a speeding tick to the right one of five similar cans, with time-to-touch on screen next to a voice-only round (_candidates.md:L62). That gives a before/after, a game and a number. Variant (b), where a reviewer taps the target, lets a bystander take part without wearing the glasses. The "IMU latency, not cloud latency" insight is visible as instant cue response (_candidates.md:L60). The discount: Motion is beta and dev/beta channel only, the orientation quaternion is nullable ("Not every device produces it"), and running Motion with the camera stream is undocumented (_candidates.md:L25-26, motion guide). Mock IMU replay is deterministic, so a live head-turn demo needs real glasses (_candidates.md:L63), which fails A5. The GA fallback (visual-only tracking at 7-15 fps) works but is slower. Mono audio also has to be heard by a blindfolded wearer in a loud hall. **Strongest objection:** the whole wow rests on an undocumented beta combination that may return `CAPABILITY_DENIED` on loaner glasses (feasibility.md §4). If it does, the most impressive demo becomes a mediocre one, and we learn that only once devices are in hand.

### 6. `private-hand` (72)
This is the strongest social moment: a reviewer *plays UNO* against a blindfolded wearer, the mirror tablet shows the whispered playable cards, and a table card states "Asking aloud: hand revealed. Private Hand: 0 cards revealed" (_candidates.md:L158). The bystander takes part without wearing anything, and the "0 revealed" line is an instant before/after. For the jury, held-out per-card accuracy against ask-aloud and braille baselines is defined (_candidates.md:L160), but the insight (a fine-tuned on-phone detector with temporal voting) is known CV and not visible (_candidates.md:L161). Even a short round takes over a minute. **Strongest objection:** detection on fanned, occluded cards at 360-504p in venue light is the hardest risk (_candidates.md:L159). A misread card during a game is a public, legible failure, and the whisper is inaudible to everyone except the wearer.

### 7. `cross-contact` (70)
This is the fastest demo here: scoop from PEANUT, touch SAFE, and a chime and red banner fire immediately. A dip in the wash cup clears it (_candidates.md:L86). It is clear, physical and repeatable, the banner shows on screen in noise, and the bystander can scoop if the wearer keeps the bowls in view. For the jury, recall on scripted contaminations is defined (_candidates.md:L89), but there is no baseline in the demo itself. The value (a commercial kitchen) is one step removed from "everyone, everyday". **Strongest objection:** utensil-tip tracking at 7 fps (_candidates.md:L87) means a fast bystander scoop can be missed, and a missed allergen contact live is the worst kind of failure for a safety pitch.

### 8. `basket` (65)
It is legible (a shopping list and an allergy), the "Contains hazelnut, Leo avoids" moment works, and the uploads-against-frames counter (6 / 900) shows the gate insight (_candidates.md:L50). The demo has no live "without" condition, and the jury baseline (VLM on every 2 s frame) is offline (_candidates.md:L52). Picking items from a table is less convincing than a real shop, and most of the output is spoken. It works on mock. **Strongest objection:** reading tiny allergen print at stream resolution may need "hold it closer" (_candidates.md:L51). The headline moment is exactly the step most likely to fail live, and peers have seen nutrition scanners (competitive.md, "what most teams will reach for first" #5).

### 9. `nod` (64)
This is emotionally the strongest. Silent look-and-nod gives "I'd like the juice, please" spoken by the laptop or a lamp turning on, and silent input is an advantage in the noisy hall (_candidates.md:L134). The IMU trace on the projector shows the mechanism. But the try-it moment requires a stranger to put on the glasses and do a 10 s calibration (_candidates.md:L136), the hygiene and sharing rules are unknown (feasibility.md §9), and the core is beta Motion with undocumented camera concurrency. Mock replay "loses the try-it-on moment" (_candidates.md:L135). For the jury, a false-accept rate per 5 minutes on 5+ users is a good, gameable-resistant metric. **Strongest objection:** a stranger talking and laughing at a busy table is the worst case for false accepts from normal head motion (_candidates.md:L135), so the demo is most likely to misfire for the very audience judging it.

### 10. `glance-log` (62)
This has the cleanest built-in baseline of the hands-busy ideas: glance at five printed meters, the table fills, an out-of-range one turns amber, and then a stopwatch round typing the same values on a phone (_candidates.md:L110). It is reliable (lowest technical risk, digital displays first, no beta) and readable on screen. But printed meters on a table do not move anyone, and the source itself calls it the "smallest wow" (_candidates.md:L111). **Strongest objection:** peers will rank a meter-logging tool below almost any neighbour in a pairwise vote, however well it works.

### 11. `still-head` (58)
At the peer table it is fun: putt, hear "head moved 3 degrees left", see the trace, and compete (_candidates.md:L206). That carries A1 and A3. For the jury it collapses: the claimed metric (within-session reduction over 10 putts against a no-feedback block, _candidates.md:L204) cannot be shown in 3 minutes, the everyday and inclusive value is weak (_candidates.md:L207), and it is beta Motion with a nullable orientation field. Live use needs glasses. **Strongest objection:** it is a toy to a jury looking for a worthwhile problem (Kia's lens), and it also needs every visitor to wear the glasses.

### 12. `which-way-now` (57)
Quick and clear: a printed 12-row Finnish board, a glance, then "Platform 7, 08:32, 4 min late" with the row highlighted, against a stopwatch hand search (_candidates.md:L242). It is reliable with no beta. But the visible behaviour looks like what peers already know from Meta translation or Google Lens (_candidates.md:L243), so the "only glasses" moment is weak at a table where nobody holds luggage. **Strongest objection:** strangers will say "my phone does that", and nothing on the table proves otherwise.

### 13. `coverage-inspector` (54)
The demo is clean ("bottom not inspected", flip, 6/6 green, _candidates.md:L74), but stickers look staged, the stakes (a disputed damage claim) are invisible, and the source itself names a lower wow factor (_candidates.md:L75). There is no baseline in the demo, and the missed-zone rate against a phone walk-around is post hoc. **Strongest objection:** it looks like a checklist with a camera, and a stranger has no reason to care in 90 s.

### 14. `table-talk` (53)
On paper the hall's noise is ideal for it, and a live WER panel against a centre mic is a strong jury number (_candidates.md:L218). In practice two strangers must scan a QR and join with their phones, the captions need a Ray-Ban Display (10 of 20 units, CHALLENGES.md:L914-915), focus switching needs beta Motion (_candidates.md:L219), and mirrored captions are small. It may also overlap with a shipped Meta feature (unknown, _candidates.md:L215). **Strongest objection:** the join friction eats the 2 minutes, and the camera barely features, which undercuts the first-person story (CHALLENGES.md:L886).

### 15. `show-me-once` (51)
Two phases: a teammate records a 3-step napkin fold while narrating, steps appear about 10 s later, and then the peer follows with auto-advance (_candidates.md:L182). That is too long and too abstract for a noisy pairwise visit, and narration-pause segmentation in hall noise is fragile even with the beamformed HFP mic. Live authoring needs glasses (_candidates.md:L183). For the jury, step-boundary agreement is a dry metric. **Strongest objection:** the most impressive half (authoring) is the least reliable live, so the table demo becomes "follow a pre-recorded tutorial", which competitive.md lists as an obvious idea.

### 16. `sana` (41)
The interaction is cute ("muki", "Oikein!", _candidates.md:L170), but grading spoken Finnish answers in the hall is the hardest risk (_candidates.md:L171). The value is retention, which cannot be shown in 2 or 3 minutes, so there is no before/after and no baseline for the jury. It overlaps with grant-funded Immerse (competitive.md). **Strongest objection:** nothing in the demo shows that it works better than a flashcard app, and the one live judgement (speech grading) is the step noise breaks.

### 17. `heads-up-sounds` (32, hard reject)
The demo's core input is beta camera-stream audio (_candidates.md:L28, L123), which may be `CAPABILITY_DENIED` on loaner glasses (feasibility.md §4). HFP is beamformed toward the wearer's voice, so it is not a substitute for ambient sound (feasibility.md §3), and I found no GA fallback in the write-up. Whether Mock Device Kit simulates stream audio is unknown, and the source calls it "weak on mock" (_candidates.md:L123). Deaf output needs the Display. And the hall is the worst environment for a sound-event classifier. I reject it because the working demo as written may not be producible at the venue, not because the idea lacks value. **Strongest objection:** the one thing the table must show (the right sound detected among hall noise) depends on a beta stream we may not get and a classifier the noise will defeat.

## 4. Cross-cutting notes for the build team (estimates)
- **Design every demo for a bystander who does not wear the glasses.** Put a teammate in the glasses and let the visitor act on the props (plant, misplace, tap, play). Mirror everything to a screen, and add a table speaker for the speech.
- **Build the baseline into the demo**: a scoreboard, stopwatch, Meta AI comparison or upload counter that appears in the recorded 60 s clip. If the 2024 format holds, live demos are not shown on stage (00-rules-and-jury.md §2).
- **Keep beta capabilities off the critical demo path** unless the hour-0 booth check confirms they work (_candidates.md:L37). That alone moves `beacon` and `nod` up or down by about 10 points (estimate).

<!-- complete -->
