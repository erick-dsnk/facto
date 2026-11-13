# Meta partner judge: team idea "Live fact-checker" (live-fact-check)

**Summary**
- **Score: 43/100 as described** (C1 12, C2 12, C3 10, C4 9). Not a hard reject, because a GA-only visual variant can be built and demonstrated. It would place **16th of 18**, between sana (46) and which-way-now (42).
- The idea is weakest on the two criteria Meta weights for trust and value. An ambient "truth detector" contradicts Meta's own "deliberate, not ambient" guidance. It passes judgement on what other people say, it targets "everyone, worldwide" rather than a named audience, and Meta itself ended third-party fact-checking in the US in 2025 because, in its words, it "too often became a tool to censor".
- The audio input (fact-checking what people around you say) would fall under the same hard-reject logic as heads-up-sounds. The HFP mic is beamformed toward the wearer, and the non-beamformed stream audio is beta only. The visual input (text the wearer looks at) is buildable on GA.
- **Best variant on this lens: "Scam Check", about 64/100.** The wearer looks at a letter, SMS, invoice or flyer, taps, and gets a spoken verdict with its sources. Jev handles the typed checks. The audience is older adults and low-vision users, and the use is deliberate. That would place it 7th, roughly level with step-check.

---

## 1. Lens and scale

I adopt the criteria, weights and standard of `05-evaluation/meta-judge.md` unchanged. There are four criteria at 25% each (CHALLENGES.md:L934-937), each scored 0-25:
- **C1 Creativity and use case:** an original, focused everyday problem where the first-person view is essential (L886, L890, L894, L900).
- **C2 Technical execution:** a functional prototype that handles permissions, errors, performance trade-offs, connectivity and device state (L896, L900), built on GA DAT capabilities.
- **C3 Real-world value and feasibility:** a named audience, a frequent need and a "focused, plausible path to adoption or a pilot" (L900, L906).
- **C4 UX: input, accessibility and trust:** "intuitive and inclusive for people with all abilities", with consent and safe data practices (L890, L902, L906).

The hard-reject conditions are also the same as before.

## 2. What the idea actually requires (facts checked)

| Component in the team's flow | What the sources say | Consequence |
|---|---|---|
| **Jev** decides what is "checkable" | Jev 1.13 takes **text-only** state plus typed questions and returns Choice, Score or "Noul", a 0-1 estimate that a statement is true. Image, audio and video input are not supported. The page does not mention world knowledge or retrieval: Jev "evaluates only the state supplied". TypeSafe reports a latency of about 70-500 ms (vendor figure). The page advises that "high-risk or low-confidence decisions should go to additional review" ([ZenMux Jev 1.13 page](https://zenmux.ai/typesafe/jev-1.13), opened) | Jev suits two jobs: claim detection (is this sentence a checkable factual claim?) and evidence judgement (do these retrieved snippets support the claim?). It cannot know facts on its own, so the verdict depends on the web and database retrieval. Speech-to-text or OCR has to come first. |
| **Input: what the wearer hears** | HFP mic audio is "beamformed toward the wearer's voice". Camera-stream audio (non-beamformed PCM) is **beta only** (feasibility.md §3) | Picking up other people's speech needs a beta capability, or the phone's mic, which takes the glasses out of the loop. This is the same reason heads-up-sounds was hard-rejected (meta-judge.md §13). |
| **Input: what the wearer sees** | GA camera stream at 360-504p and 2-15 fps (feasibility.md §3, §5) | OCR of headlines, posters and printed text is feasible on GA. Small text on a phone screen at 360p is unproven (estimate). |
| **Pop-up on the display** | Display UI exists only on Ray-Ban Display (10 units). Each send replaces the whole view, and "Don't combine capture with display capabilities" is a known issue (feasibility.md §2, §5) | Needs a scarce Display unit. Gen 2 (10 units) has no display, so the pop-up becomes a spoken or audio cue there. |
| **Finger movements** to open sources | Inputs (touchpad, button, Neural Band) are **beta**: "every error ends the stream", and inputs stop after re-donning (feasibility.md §3, §5). Neural Band swipe is available to Display apps (competitive.md) | This is gesture input through the Neural Band, not free-air finger tracking. It is beta and Display-only. A phone-button fallback is needed. |
| **Voice model reads the sources** | TTS over A2DP on Gen 2 is low complexity (feasibility.md §7) | This works on GA, and it is the most robust part of the output. |
| **"Real time"** | No official latency figures (feasibility.md §5). Web search plus a judgement step adds seconds (estimate: 3-8 s end to end, given the 2-5 s look-and-ask estimate in feasibility.md §5 plus retrieval) | A claim is verdicted after the speaker has moved on. Jev's speed does not remove the search latency. |

**Prior art.** I found no commercial fact-checker for glasses (searched; none found). There are close academic prototypes:
- **Factually** (NUS, 2025) runs on watches and rings and listens for false claims ([arXiv 2504.17204](https://arxiv.org/abs/2504.17204), search snippet).
- **"Feeling the Facts"** (Maes lab co-authors, ACM CHI 2026) does ambient listening, then rapid web verification, then a haptic nudge with a glanceable summary. In an N=34 study it improved truth discernment, but it "introduced over-reliance when the system erred" ([arXiv 2603.27289](https://arxiv.org/abs/2603.27289), opened).

The concept is therefore published and evaluated. Glasses are a new form factor for it, not a new idea.

**Meta's own position.** Meta wrote: "We will end the current third party fact checking program in the United States." It also wrote: "A program intended to inform too often became a tool to censor." It moved to Community Notes ([Meta newsroom, Jan 2025](https://about.fb.com/news/2025/01/meta-more-speech-fewer-mistakes/), opened).

**Policy.** Meta's acceptable-use guide says "Context on demand ... Deliberate, not ambient" and gives the principle "narrow purpose, short retention, obvious to bystanders". The AUP prohibits "Surreptitiously collect recognizable audio or video content of the user or others". It does not mention misinformation or political content ([acceptable-use guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/acceptable-use), [AUP](https://wearables.developer.meta.com/acceptable-use-policy), both opened).

## 3. Criterion-by-criterion score (as the team described it)

The scores are estimates on the same scale as meta-judge.md §2.

| Criterion | Score /25 | Reasoning |
|---|---|---|
| **C1 Creativity and use case** | **12** | **For:** a misinformation check that comes to you in the moment is a striking pitch, and glasses are a new surface for it. **Against:** (a) the idea is published and evaluated (Factually, Feeling the Facts at CHI 2026). (b) The first-person view is not essential. The audio variant barely uses the camera, which is the same objection that cost table-talk on L886. Most misinformation reaches people on their phones, and fact-checking a phone screen through glasses is close to the "mirroring a phone screen" the brief rules out (L890). (c) Meta AI "look and ask" can already answer "is this true?" on request (competitive.md). (d) "Everyone, worldwide" is the opposite of the "focused everyday problem" in L906. I scored it slightly above glance-log (9) and which-way-now (6) because no first-party Meta feature does proactive claim flagging. |
| **C2 Technical execution** | **12** | **For:** the team is strong in LLM and agent pipelines. Jev is a good fit for fast claim detection and evidence judgement, and the error and state handling (L900) is standard work. **Against:** each signature element of the described flow rests on scarce or beta capabilities. Hearing others needs beta stream audio. The pop-up needs a Display unit (half of the 20-unit pool). Gestures use beta Inputs and Neural Band, where "every error ends the stream". Display combined with capture is a known bug. Continuous listening or streaming raises thermal and battery problems (feasibility.md §5). Verdict accuracy on open-domain claims is the real technical risk, and it cannot be shown to be good within 40 h. A live demo needs staged claims, which judges will discount. This is the same level as nod and beacon minus their originality (15), and above heads-up-sounds (7) because a GA visual path exists. |
| **C3 Real-world value and feasibility** | **10** | **For:** misinformation is a real and salient problem. **Against:** no named audience, no frequency argument, and no pilot path; "cut misinformation worldwide" is a mission, not a pilot (L900). Real-world accuracy is the weakness. The CHI study found over-reliance when the system errs ([arXiv 2603.27289](https://arxiv.org/abs/2603.27289)), and an always-on glasses verdict increases that risk. A plausible pilot partner would be a fact-checking or media-literacy organisation, for example a Finnish media-literacy NGO (uncontacted, and fit unverified). This is level with private-hand and sana. |
| **C4 UX: input, accessibility and trust** | **9** | **Against:** (a) an ambient listener that judges what nearby people say is the "creepy glasses" image Meta works to avoid. It conflicts with "deliberate, not ambient" and "obvious to bystanders", and borders on the AUP's surreptitious-audio clause if the people around the wearer are unaware. (b) A pop-up that says your companion is wrong mid-conversation is a social trust failure. A false positive is worse, because it accuses someone of lying on Meta's hardware. (c) Meta abandoned the role of truth arbiter on its own platforms, so a Meta judge would hesitate to put "Meta glasses decide what is true" on stage; any political example in the demo makes this worse. (d) Accessibility is thin. No ability group is named, and gesture input on beta Inputs is not an inclusive input story. **For:** the voice readout of sources is good, and showing sources is the right trust instinct. The score is close to cross-contact (10) and basket (14) for the same kind of reason: a claim the device cannot reliably back. |
| **Total** | **43** | |

**Hard reject: no.** The idea as described includes a buildable GA path: camera, then OCR, then claim detection with Jev, then retrieval, then a verdict spoken through TTS. That is enough for a working demo, so none of the hard-reject conditions applies to the idea as a whole. **The audio-only variant on its own would be a hard reject**, for the same reason as heads-up-sounds: its core needs beta stream audio, and the phone-mic fallback makes the glasses unnecessary.

### Variants by input

These scores are estimates.

| Variant | C1 | C2 | C3 | C4 | Total | Note |
|---|---|---|---|---|---|---|
| Hears speech around the wearer (ambient) | 11 | 7 | 10 | 6 | **34** | Hard reject: beta stream audio, bystander audio, conversation-judging |
| Sees text, ambient (scans everything in view) | 12 | 13 | 10 | 9 | **44** | GA, but ambient; constant uploads, battery and thermal |
| Sees text, deliberate (look plus tap to check), audio verdict on Gen 2 | 13 | 16 | 11 | 13 | **53** | Essentially Meta AI "look and ask" plus sources; differentiation is small |

## 4. Placement in the existing table

| Rank | id | Total |
|---|---|---|
| 14 | cross-contact | 48 |
| 15 | sana | 46 |
| **16** | **live-fact-check (as described)** | **43** |
| 17 | which-way-now | 42 |
| 18 | still-head | 34 |

The idea overlaps most with the following candidates:
- **table-talk** (live speech pipeline on Display, little use of the camera, a conversation-privacy story).
- **heads-up-sounds** (ambient audio dependent on beta stream audio, with a Display pop-up).
- **which-way-now** and **glance-log** (OCR plus a lookup; Meta AI "look and ask" covers most of it).
- **basket** and **cross-contact** (a verdict the device cannot reliably guarantee).

## 5. Strongest objection

The product's promise is "the glasses tell you what is false". On this hardware it cannot be kept reliably. It is pushed ambiently into conversations with people who did not consent, and it is offered to a company that publicly stepped back from being a truth arbiter because fact-checking "too often became a tool to censor". A single wrong pop-up on stage ("Meta glasses say your friend is lying") is the failure a Meta judge least wants to be associated with.

## 6. Highest-scoring variant on this lens: "Scam Check"

This variant keeps the team's pipeline and its use of Jev, but narrows the user, the input and the output:
- **User:** older adults, plus low-vision users who cannot easily read the small print, the sender address or the URL. Both are named groups, and fraud aimed at them is a frequent everyday problem.
- **Input (deliberate and visual):** the wearer looks at a paper letter, an invoice, an SMS on their phone or a flyer, then taps or says "check this". Only one frame is uploaded, and only on that request (GA camera).
- **Pipeline:** OCR, then a parallel set of typed Jev questions, which is Jev's strength: does this demand urgent payment, does it ask for credentials, does the sender domain match the claimed organisation, does it match a known scam pattern in the database. Web or database lookup for the sender and the bank account, then a Noul-style probability that it is a scam, with a "not sure, ask someone" band.
- **Output:** a short spoken verdict on Gen 2. The voice model reads the reasons and sources on request. An optional one-card summary on Display, with Neural Band to open the sources (stretch goal). There is an optional "send to a trusted contact" step, with consent.
- **Trust:** deliberate rather than ambient, and no bystanders. Frames are discarded and only the verdict is kept. It never says "safe", only "warning signs found" or "no warning signs found, verify by phone". That keeps the promise within what the system can actually deliver.

**Estimated score: C1 15, C2 17, C3 16, C4 16 = 64.** That ranks 7th, level with step-check. It is held back on C1 because Meta AI "look and ask" can attempt "is this a scam?" and the scam scanner is a known category, although not on glasses and not with typed, sourced checks. C3 needs a named pilot partner (a senior-services or consumer-protection organisation, uncontacted). Unlike the original, it is a story Meta would be comfortable to showcase: assistive, deliberate, and with no bystanders involved.

If the team wants to keep "misinformation" in the framing, the deliberate, visual, tap-to-check version of section 3 (53) is the ceiling I see on this lens. Keep it away from political examples in the demo.

## 7. Questions for the Meta booth that would move this score

- Is camera-stream audio (beta) enabled on the loaner glasses? If it is not, the audio variant is dead.
- Are Inputs, Neural Band and Display available to third-party DAT apps on the loaner units?
- Would Meta be comfortable with a demo that flags claims as false? Ask the mentor directly.

<!-- complete -->
