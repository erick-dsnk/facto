# Demo evaluator: team idea `live-fact-check`

**Summary**
- **Score as described: 55/100 (peer 30/55, jury 25/45). Not a hard reject.** It would place **13th of 18** in the demo table, between `which-way-now` (57) and `coverage-inspector` (54).
- **"Fact-checker" needs no explaining at the table.** The trouble is everything after that sentence. Nothing in the demo shows what goes wrong without the app, so there is no "before". A stranger who tries it will say a claim the system cannot settle in a few seconds. And one false "misinformation" pop-up in front of a judge, about a true claim, sinks the pitch.
- **Which input you pick decides the demo.** If the input is what the wearer *hears*, the score is about 47. The HFP mic is beamformed to the wearer's voice, ambient audio is beta, and the hall is loud: the same failure that hard-rejected `heads-up-sounds`. If the input is what the wearer *sees* (printed headlines, a phone screen, posters), the score is about 62.
- **Best variant on this lens: "Scam or real?", about 70 (would rank 7th).** It keeps the team's pipeline but narrows it to one user and one input: older adults glancing at SMS messages, letters and posters. A bystander first guesses "scam or real?" for a deck of cards, then the glasses judge the same cards, and a live scoreboard puts human, Meta AI and our app side by side.

---

## 1. Method

I used the criteria, weights and standard from `05-evaluation/demo-evaluator.md` §1 unchanged, so this score can go straight into that table:
- **Peer table (55):** A1 obvious value 15, A2 visible before/after 12, A3 bystander can take part 12, A4 readable in noise 8, A5 survives repeated runs 8.
- **Jury (45):** B1 measured result against a baseline, inside the demo 20, B2 visible insight 15, B3 fits a 60 s clip 10.

Hard reject applies only when the demo as written cannot plausibly be shown working. All sub-scores, latencies and accuracies are my estimates unless cited.

### Capability facts this assessment depends on
| Fact | Source |
|---|---|
| Camera and mic are available only through DAT (native app). Web Apps have neither | feasibility.md §2 |
| HFP mic is beamformed toward the **wearer's** voice. Ambient, non-beamformed camera-stream audio is **beta** | feasibility.md §3; _candidates.md:L28 |
| A display exists only on Ray-Ban Display (10 of the 20 loaner units), 600x600, full redraw per send | CHALLENGES.md:L914-915; _candidates.md:L31 |
| Gestures (touchpad, Neural Band) come through the **beta** Inputs capability. Double-tap gives `Select`, swipe gives `Nav`, `Back` is not delivered on real glasses, and the capability is lost when the glasses are re-donned | feasibility.md §3, §5; _candidates.md:L29 |
| Whether the loaner Display units come with Neural Bands | unknown |
| A cloud "ask, then answer" round trip takes about 2-5 s (estimate). Continuous real-time understanding is on the "do not attempt" list | feasibility.md §5, §8 |
| The stream degrades over Bluetooth to about 360x640 at 2-7 fps in the hall (estimate) | feasibility.md §5 |
| Jev returns "typed decisions and probabilities rather than generated text". The concept page gives no latency figure and does not say Jev has world knowledge or web access: it evaluates the state you supply | [docs.typesafe.ai/concepts/system-one](https://docs.typesafe.ai/concepts/system-one) (opened) |
| Jev latency of 70-500 ms is **vendor-reported**, repeated by secondary sources | [zenmux.ai/typesafe/jev-1.13](https://zenmux.ai/typesafe/jev-1.13), [eesel.ai](https://www.eesel.ai/blog/jev-ultrafast) (search snippets) |

What this means for the demo: Jev can quickly tag "is this a checkable factual claim?" (a Choice with a probability). The verdict still depends on retrieval and web search, and a reasoning step over the evidence, which Jev's output format cannot produce on its own (it gives no explanations). So the visible wait is the web-search leg, not Jev. My estimate is 3-8 s from glance to pop-up on venue Wi-Fi.

## 2. Criterion-by-criterion

| # | Criterion (weight) | As described | Hearing variant | Seeing variant | Evidence and reasoning |
|---|---|---|---|---|---|
| A1 | Obvious value (15) | 12 | 12 | 12 | "It flags misinformation" is understood instantly. I deducted 3 points because the "everyday" moment is vague: misinformation mostly reaches people on their phones, so strangers will ask why they need glasses for it (the brief wants value "beyond simply mirroring a phone screen", CHALLENGES.md:L890) |
| A2 | Before/after (12) | 5 | 5 | 6 | Without the app, nothing visibly goes wrong: the "before" is someone quietly believing a false claim. No baseline condition is designed into the flow. Compare `panel-reader`'s Meta AI round and `step-check`'s planted error (demo-evaluator.md §3) |
| A3 | Bystander can take part (12) | 6 | 4 | 8 | Hearing: the bystander says a claim, but the HFP mic is tuned to the wearer and the hall is loud (feasibility.md §3). Seeing: the bystander holds up a headline card or their phone without wearing the glasses, which works. But a free-choice bystander will pick opinions, current events or local trivia, where verdicts are slow or wrong, and adversarial peers find the miss in 30 s (the same risk as `step-check`) |
| A4 | Readable in noise (8) | 5 | 4 | 6 | A pop-up mirrored to a screen is readable. On Gen 2 (no display) the result is TTS that only the wearer hears, so it needs a mirror and a table speaker. Reading sources aloud ("ask a voice model to dictate them") is inaudible at the table |
| A5 | Survives repeated runs (8) | 2 | 1 | 4 | Hearing depends on beta stream audio or a mic not designed for ambient capture. On my lens that is the `heads-up-sounds` failure, and the hall is the worst place for it. Gestures rely on beta Inputs, which drops on re-donning (feasibility.md §5), so it fails after every handoff unless restarted. Every check needs live web search on venue Wi-Fi (feasibility.md §9 #4). The seeing variant can fall back to a cached claim deck and Mock Device Kit |
| | **Peer subtotal (55)** | **30** | **26** | **36** | |
| B1 | Measured result against a baseline in the demo (20) | 9 | 8 | 11 | A held-out labelled claim set (for example, published ClaimReview verdicts) scored against Meta AI or a plain LLM is possible, but only as a slide after the fact, not inside the demo. A false-positive rate on true claims is the number this jury will ask for (Daksh, 00-rules-and-jury.md §5) |
| B2 | Insight visible (15) | 6 | 5 | 6 | The candidate insight is "a cheap Jev gate decides what is checkable, and only those claims go to search". A counter (claims seen against claims checked) could show this on screen, but it is a cost optimisation, not a visible "10x better" (Beer's lens). Meanwhile the slow part, search, is what the viewer actually sees |
| B3 | Fits a 60 s clip (10) | 5 | 4 | 6 | One glance, a 3-8 s wait (estimate), a pop-up, a swipe to sources: this fits a clip. But a failure case shown honestly (a wrong verdict) undercuts the pitch more than it does for most candidates |
| | **Jury subtotal (45)** | **20** | **17** | **23** | I discount the "as described" jury score to 20 for the ambiguity, then add 5 for the drama of a red "FALSE" banner on a recognisable claim. **Final as described: 30 + 25 = 55** |
| | **Total** | **55** | **~47** (43 + 4 for drama) | **~62** (59 + 3 for drama) | |

The headline 55 sits between the two variants because the description implies both inputs and a continuous "turn it on and it watches" mode. That mode is what feasibility.md §8 says not to attempt, and it forces the hearing path into the demo.

## 3. Hard reject?

**No, but only because the seeing variant exists.** If the team insists on the hearing input (fact-checking what people say around the wearer), I would mark that variant a hard reject on my lens, for the same reasons as `heads-up-sounds` (demo-evaluator.md §3, #17): the core input is beta or mis-tuned audio, and the hall noise defeats it. The pop-up and gesture steps are not blockers. They need a Ray-Ban Display and beta Inputs, but Gen 2 with TTS plus a phone-screen source list is a GA fallback.

## 4. Placement and overlap

- **Rank: 13th of 18** (55), above `coverage-inspector` (54) and below `which-way-now` (57). The seeing variant (62) would tie `glance-log` at about 10th. The best variant (70) would tie `cross-contact` at 7th.
- **Closest existing candidates:**
  - `which-way-now`: reads text in view and answers, and strangers will say "my phone does that".
  - `basket`: reads printed text and fires a warning pop-up. Its risk is small text at stream resolution.
  - `did-i`: a verdict plus evidence, with a negative run needed to be credible.
  - `step-check`: a bystander-adversarial scoreboard, which is the best structure to borrow.

## 5. Strongest objection

**On stage, the demo's single most likely failure is also its most damaging one.** A fact-checker that wrongly calls a true statement "misinformation" in front of a judge, or calls a contested claim settled, destroys trust in one moment, and trust is a scored Meta criterion (CHALLENGES.md:L937). The team cannot prevent that failure, because a free-choosing bystander picks the claim. Behind that sits a second problem: nothing on the table shows a "without us" failure, and the claim to "cut misinformation worldwide" cannot be measured in 3 minutes. This jury penalises unmeasured impact claims (00-rules-and-jury.md §6, "Do not fill the placeholders with invented ... results").

## 6. Highest-scoring variant on this lens: "Scam or real?" (about 70)

- **Narrower user:** older adults and people with low vision who receive scam SMS messages, letters, parcel-fee notices and fake bank messages. The harm is concrete, the domain is checkable, and it is not political.
- **Input:** only what the wearer *sees* (a phone screen or a paper letter held up), with a deliberate double-tap or phone-button trigger. Not ambient listening. GA camera stream, with Inputs as an optional extra.
- **Pipeline:** the team's own pipeline, narrowed. Jev classifies "contains a checkable claim or request (payment, link, sender identity)" and the red-flag types as typed choices with probabilities, in well under a second (vendor figure). A lookup against a scam-pattern database and the sender or URL, plus web search only when needed, produces the verdict.
- **Output:** a one-line Display card or spoken verdict ("Likely scam: this bank never asks by SMS"). A swipe, or a phone tap, shows the source. Everything is mirrored to a screen.
- **Demo:** a deck of about 20 real-format cards (half genuine, half documented scams). The bystander does **not** wear the glasses. They draw a card, guess "scam or real?" themselves, then a teammate in the glasses glances at it. The live scoreboard shows **human guess against Meta AI against our app**, with false alarms counted. That covers the before/after (A2), bystander participation (A3), and a baseline inside the demo (B1).
- **Scores (estimate):** A1 13, A2 9, A3 10, A4 6, A5 6 (peer 44). B1 15, B2 7, B3 7 (jury 29). Total **73, discounted to 70** for live web search on venue Wi-Fi and for the risk of OCR on small print at 360x640.
- If the team wants to stay with misinformation proper, a second-best variant is a "claim card" game on numeric public statistics checked against a curated dataset, with the same scoreboard structure. I estimate about 64: less everyday stake, and more arguable verdicts.

<!-- complete -->
