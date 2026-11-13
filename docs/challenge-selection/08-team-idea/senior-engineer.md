# Senior-engineer evaluation: `live-fact-check` (team idea)

**Summary**
- **Score: 38/100, not a hard reject.** That puts it **14th of 18**, between `still-head` (44) and `show-me-once` (40), on the same scale as [05-evaluation/senior-engineer.md](../05-evaluation/senior-engineer.md). The score is P(the MVP as described works reliably at the table, on real glasses, through repeated peer-review runs). It is an estimate.
- What drags it down: (1) **hearing other people's speech** has no reliable GA input. The HFP mic is beamformed toward the *wearer's* voice, and the non-beamformed camera-stream audio is beta, the same input that made `heads-up-sounds` a hard reject. (2) The **pop-up plus finger gestures** need a Ray-Ban Display unit (10 of 20) and the **beta** Inputs capability (dev/beta channels only). (3) Open-domain fact-checking with a 6-step cloud chain can be **wrong in public**, and peer reviewers will test it with any claim they like.
- The idea is not a hard reject because a narrow variant demos well. The wearer triggers a check on **visible text** (a headline, poster or post on a screen), and the app gives a spoken verdict with its source on Gen 2. That variant scores about **66**, which would place 6th, just above `basket` (60).
- Jev fits as the **verifier, not the fact source**. TypeSafe's docs show it judging a claim *against evidence you supply* (supports / contradicts / says nothing). They give no latency, rate-limit or context-size figures, and they do not say it has world knowledge or web access. Retrieval (web search, a fact-check database) is a separate dependency we would have to build.

---

## 1. What has to work, end to end

As the team describes it, one "checkable" moment needs all of these in sequence:

1. **Capture**: ambient speech (mic) and/or visible text (camera stream) from the glasses to the phone over Bluetooth Classic.
2. **Transcribe / read**: streaming ASR for speech, or OCR/VLM for text.
3. **Claim detection** ("is this checkable?"): Jev Noul/Choice over transcript windows, or an LLM.
4. **Retrieval**: our own "database" plus a real-time web search API. A fact-check database such as Google's Fact Check Tools Claim Search API exists and needs an API key ([developers.google.com/fact-check/tools/api](https://developers.google.com/fact-check/tools/api), opened). Quotas are unknown.
5. **Verdict**: Jev Choice `supports / contradicts / says_nothing` per evidence snippet, as in TypeSafe's citation-check cookbook ([citation_check](https://docs.typesafe.ai/cookbooks/citation_check.md), opened).
6. **Output**: a pop-up on the Display, or TTS on Gen 2.
7. **Source browsing**: Neural Band / touchpad gestures (beta Inputs), or a voice model reading the sources aloud.

That is **seven separately fragile stages**. Steps 2-5 make three or four cloud calls in series. By the senior-engineer criterion 6 (integration count), this sits with `table-talk` and `show-me-once`, not with the GA single-call builds.

## 2. Criterion-by-criterion

### 2.1 Capability status (weight: highest)

| Part | Status | Evidence |
|---|---|---|
| Camera stream | GA | feasibility.md §3; [streaming](https://wearables.developer.meta.com/docs/develop/dat/streaming/) |
| HFP mic | GA, but "beamformed toward the wearer's voice" | feasibility.md §3 ([mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)) |
| Camera-stream audio (non-beamformed, would hear others) | **Beta only** | feasibility.md §3; this was the core of the `heads-up-sounds` hard reject (05-evaluation/senior-engineer.md §3) |
| On-glasses Speech ASR | Beta, dev/beta channels, "silently stops" after about 1 min | feasibility.md §3, §5 |
| Display (pop-up) | Ray-Ban Display only. GA/beta status is **not stated** on the overview page | [display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/), opened |
| Finger gestures (Neural Band `Nav`/`Select`/`Drag`, touchpad swipes) | **Beta**: "Inputs is a beta capability", dev and beta release channels only. Pinch is not mentioned. `Back` "not currently delivered by real glasses" | [inputs guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs), opened |
| Neural Band hardware on the loaner units | **Unknown**. CHALLENGES.md:L914-915 lists glasses, chargers and hygiene kits only | CHALLENGES.md:L912-917 |
| Jev (TypeSafe) | Public HTTP API `POST https://api.typesafe.ai/v1/systemone`, bearer key, models such as `jev-latest`. **No published latency or rate limits**. Images and long context sit behind "Danger-Zone" headers | [api.md](https://docs.typesafe.ai/api.md), opened |

**Reading.** The "what the wearer hears" variant has no GA path to other people's speech. HFP will capture the wearer clearly and people across the table only faintly (estimate: how strongly the beamforming suppresses a speaker 1 m away is unknown). The gesture half of the UX depends on a beta capability plus Neural Band hardware we may not get. Every reserved touchpad gesture (single tap pauses, tap-and-hold stops) is swallowed by the system while no interactive display content is shown (inputs guide), so a "tap to see sources" design on Gen 2 collides with the session controls.

### 2.2 Perception difficulty at stream resolution

- **Audio variant**: ASR of strangers in a loud hall through a mic aimed at someone else. This is the hardest input in the whole candidate set, worse than `sana`'s (57) wearer-speech grading.
- **Visual variant**: reading a headline or poster we print ourselves is the same problem as `which-way-now` (80). Large type survives 360x640. Reading a peer's phone screen (social post) is harder: small text, glare, moiré, and the screen held at varying angles (estimate).
- **The verdict itself is a judgment problem, not perception, and it is the bigger risk.** TypeSafe says calibration "does not guarantee that an individual answer is correct" and recommends escalating low-confidence answers ([system-one](https://docs.typesafe.ai/concepts/system-one.md), opened). The citation-check cookbook's only result is one 8-citation run, with no aggregate accuracy (citation_check, opened). Retrieval quality is unknown: if the web search returns a weak snippet, Jev correctly says `says_nothing` and the demo shows nothing.

### 2.3 Latency placement

Estimate: ASR finalisation 0.5-1.5 s, then claim detection (Jev, latency unknown), web search 0.5-2 s, verdict over N snippets (Jev, parallel questions in one request), then render or TTS. That is roughly **4-10 s per claim** on venue Wi-Fi (estimate). For "real time" during a conversation, the pop-up arrives after the speaker has moved on, and the claim in the pop-up must be quoted for context to make sense. For a deliberate "check this" query, 4-10 s is acceptable, like `which-way-now`.

The sentence "it determines what is checkable" also implies **continuous** claim detection over everything heard or seen. That is a cloud call every few seconds, which feasibility.md §8 lists under "Do not attempt: continuous real-time … understanding". Gating it on the phone (only sentences with numbers, named entities or comparatives) is buildable but adds another tuning surface.

### 2.4 Short device slots and mock coverage

- Visual variant: Mock Device Kit replays an h265 clip of the headline (feasibility.md §3), so 80%+ of the build and the evaluation set work without glasses. **Good.**
- Audio variant: the mock simulates the camera, not real HFP behaviour or beamforming. The single most important unknown (can we hear the other person?) can only be measured on real glasses, in the hall. **Poor.**
- Display variant: Display content "can be simulated in-app or in Chrome" (feasibility.md §3), but gesture recognition is not: "Mock Device Kit doesn't reproduce device-side recognition, reserved interactions, or per-model mappings" (inputs guide). The gesture UX therefore needs long device time on one of only 10 Display units. **Poor.**

### 2.5 Venue conditions

- Hall noise works directly against the audio variant, as it did for `heads-up-sounds`.
- **Wi-Fi**: three or four sequential cloud calls (ASR or OCR, search, Jev, possibly an LLM) to three vendors. Any one stalling stalls the verdict. A phone hotspot mitigates this (05-evaluation/senior-engineer.md §4).
- **Thermal and battery**: an always-on version streams continuously. Thermal CRITICAL can deny sessions (feasibility.md §3), and real drain figures are unknown. A deliberate-trigger version streams for a few seconds per run.

### 2.6 Integration count

Ten parts: DAT camera and/or HFP, ASR, OCR/VLM, a claim gate, a search API, a fact-check DB, Jev, Display, Inputs, and TTS or a voice model. Even with three people and parallel agents writing the code quickly, **demo reliability is the product of the per-stage success rates**, and agent speed does not change that.

### 2.7 Display dependence

The described UX ("pop-up on the user's display POV", "finger movements") is Display-first. Only 10 of 20 units have a display (CHALLENGES.md:L914-915). Each send replaces the whole view and large layouts lag over Bluetooth (display overview). Combining capture with Display is buggy, so we would have to use the stream (feasibility.md §5). Whether camera streaming and Display output run reliably at the same time is **unknown**. The known issue documents capture transfers holding back display updates, not the stream (feasibility.md §5).

**Audio-only fallback (Gen 2).** This works with GA capabilities: a TTS verdict ("Disputed. Finnish Broadcasting Company, March 2026, says the figure is 12%") and "say 'sources' or press the phone button" to hear more. It is more reliable, and it loses the silent glanceable pop-up that is the idea's interaction claim. For other people's speech, a voice announcement into the wearer's ear mid-conversation is also a UX problem, but that is outside this lens.

## 3. Demo survival in peer review

This is the decisive issue. A fact-checker invites every reviewer to say a claim and wait for the result, exactly like `step-check`'s "plant an error" (05-evaluation/senior-engineer.md §3), only open-domain:

- A **false positive** (flagging a true statement as misinformation) is the worst public failure, and the hardest to prevent with web snippets of mixed quality.
- A **false negative or a `says_nothing`** on an obvious myth reads as "it doesn't work".
- Nuanced claims ("Finland has the cleanest air in Europe") have no binary truth value, and the system's verdict will vary with whichever snippets come back.

A **curated demo set** (10-20 known myths with ClaimReview entries plus our own mock DB, CLAUDE.md "put external APIs behind one module with a mock") makes the scripted run reliable. Reviewers will still go off-script within the first few visits. Estimate: the scripted run on the visual variant succeeds about 85% of the time, and off-script claims produce a correct, sourced verdict perhaps 50-65% of the time.

## 4. Hard-reject check

| Condition | Verdict |
|---|---|
| Cannot meet a mandatory requirement | No. It can use glasses and a first-person view (CHALLENGES.md:L886-894) and handle permissions and state (L900) |
| Needs an unavailable SDK capability | **Partly**. Ambient-speech capture needs beta stream audio, and gestures need beta Inputs. The visual-text and wearer-triggered variants avoid both |
| Inaccessible data | No. A web search API, Google Fact Check Tools and Jev are all accessible with keys |
| Unreliable integration | Jev's latency and rate limits are unpublished (api.md). This is a risk, not a blocker. Measure it in hour 1 |
| Cannot produce a working demo | No. The narrow variant demos |
| Existing product without differentiation | Outside this lens. See the competitive evaluator |

**Not a hard reject.** If the team insists on the **ambient-speech, Display-plus-gesture** version as its core, I would treat it as a hard reject for the same reason as `heads-up-sounds`: beta input, hall noise and Display dependence.

## 5. Overlap with existing candidates (engineering shape)

- **`which-way-now` (80)**: gated frame, OCR/VLM, cloud answer, deliberate trigger, printed prop. This is the template for the best variant.
- **`did-i` (74)**: a cloud verifier with a strict schema and a "not sure" state, with the same "honest but deflating" failure mode.
- **`heads-up-sounds` (12, reject)**: same ambient-audio input and Display dependence for the audio variant.
- **`table-talk` (24)**: other people's speech, Display cards and many integrations.
- **`step-check` (66)**: adversarial reviewer input exposes gaps.

## 6. Strongest objection

The two things that make the idea distinctive are passive **real-time** detection and checking **what others say**. They rest on an input the SDK does not give us in GA (beamformed HFP faces the wearer, and ambient stream audio is beta) and on an open-domain verdict chain of three or four cloud calls that reviewers will test with arbitrary claims. A single confident false "misinformation" pop-up on a true statement discredits the product on the spot.

## 7. Highest-scoring variant on this lens (about 66, estimate)

**"Check this": wearer-triggered verification of visible text.**
- **Input**: the wearer presses the phone button, or the capture button (GA in the inputs list, though Inputs as a whole is beta, so the phone button is the fallback). The app grabs a sharpness-gated frame at 720p of a headline, poster, ad or a post on a screen.
- **Pipeline**: a VLM extracts one to three atomic claims, then the Fact Check Tools claim search plus a web search API, behind one mockable module with a curated demo DB. Then **one Jev request** asks one parallel Choice per (claim, snippet) pair, `supports/contradicts/says_nothing`. The 0.8 confidence threshold from the cookbook means abstaining rather than guessing, and code composes the verdict.
- **Output**: audio-first on Gen 2. A TTS verdict names the source, and "sources" (wearer voice over HFP, which is beamformed toward the wearer and so works here) reads the next one. The Display card is a stretch goal, sent as plain text once per result.
- **Narrow user**: older adults or anyone reading health and financial claims in ads and printed media, or students checking a viral post. The demo uses printed props we control.
- **Why it scores higher**: GA camera only, a deliberate 4-8 s query (a latency like `which-way-now`'s), fully mockable, short device slots suffice, and the honest "no verdict" state is designed in.
- **Why it is not 75+**: retrieval plus verdict is still open-domain against reviewer claims, there are 3-4 cloud vendors in series, and Jev latency and limits are unpublished.

A second option, **wearer-spoken claims** ("check: …" said by the wearer, through HFP and phone ASR), scores about 55 (estimate). Beamforming is now on our side, but `sana`'s hall-noise ASR risk and the HFP-before-camera ordering rule apply.

## 8. Hour 0-2 checks if the team picks this

1. Jev round-trip latency and rate limits for a 6-10-question request (not documented in api.md).
2. At the booth: is a Neural Band supplied, and is Inputs enabled on the loaner accounts (dev/beta channel)?
3. On a real Gen 2 unit: record HFP audio of a person speaking 1 m away in the hall. This settles whether the audio variant is viable at all.
4. Fact Check Tools API key and hit rate on a 20-claim demo set. Web search API choice and its latency.

<!-- complete -->
