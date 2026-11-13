# Feasibility spike: Live fact-checker (`live-fact-check`)

**Summary**
- **The output and input surface exists, but only on the 10 Ray-Ban Display units, and the "hears" input is the weak link.** A DAT app can send a 600x600 card with buttons to Ray-Ban Display, and Meta says users control display integrations "through the ... touchpad and Meta Neural Band". RBM Gen 2 has no display, so it is audio only. The glasses' standard (HFP) microphone is beamformed to the wearer and "significantly reduces the volume of ... other speakers". To hear other people you need **experimental** camera-stream audio, which needs a running camera stream and approval in Wearables Developer Center, and which the mock device cannot inject.
- **The pipeline runs end to end without keys, but its accuracy is the real risk.** On 40 synthetic spoken statements (14 true, 14 false, 12 uncheckable, with pink noise added), the evidence-grounded configuration flagged **4-8 of 14 false claims** and **1 of 14 true claims**. The best run reached 8 of 14 and the worst 4 of 14. Asking the same 7B model with no evidence caught 13-14 of 14 false claims but **flagged 6 of 14 true claims as misinformation** (43%). Every true-claim false alarm we traced came from a pipeline bug, not from bad evidence: an LLM rewrote "vaccines do not cause autism" without the "not", or an irrelevant fact-check rated "False" got into the evidence.
- **Latency.** On a heavily shared laptop, the median from the end of a claim to a verdict was **4.75 s** (p90 5.7 s; Whisper base 0.5 s, local 7B detect 1.9 s, Wikipedia 0.5 s, verdict 1.1 s). Jev's documented ~100 ms per call would put the budget at about 2 s (estimate, **unverified**: it needs a key).
- **Jev fits the judging steps but cannot do the whole job.** It returns typed yes/no and choice probabilities, and it does not generate text, search the web or act as a store of facts. Its own docs say not to rely on knowledge in its weights. It suits "is this checkable?" and "does this source support or refute this exact sentence?". It needs an API key from console.typesafe.ai.
- **Verdict: go-with-changes (estimate).** Change "always-on detector of misinformation" to "**Check that**": an on-demand check (button or tap) of a headline you look at, or the last sentence of media playing nearby. It pops up proactively only when a published fact-check matches. A live demo has an estimated 50% chance on real Display glasses and about 85% on the mock plus phone path.

---

## 1. What I ran

All code, data and outputs are in `/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes/live-fact-check/` (`code/`, `data/`, `results/`, `dl/`). Nothing was written to the repository except this file. The machine was shared with other spikes (load average 40-460 during the runs), so all latencies are pessimistic for a laptop and say nothing about a phone.

| Step | What I used (all keyless) | Code |
|---|---|---|
| Labelled set | 40 statements: 14 true (including surprising true facts such as "bananas are berries", "Finland has more saunas than cars" and negated true statements such as "the Great Wall is **not** visible from the Moon"), 14 false (common myths and near-miss numbers such as "Finland joined NATO in 2015") and 12 uncheckable (opinions, plans, personal facts, questions). Plus 12 harder borderline sentences for detection only | `data/claims.json`, `data/hard_detect.json` |
| Speech | macOS `say` TTS → 16 kHz mono (HFP's rate). A "noisy" copy has pink noise added (about 14 dB SNR) and a 3.8 kHz low-pass | shell, `data/wav/` |
| Transcription | faster-whisper `base.en`, int8, CPU, 4 threads, one clip per utterance (endpointing simulated as +0.5 s) | `code/asr_only.py` |
| Checkable-claim detection | Ollama `mistral:7b-instruct` (local), standing in for Jev or a cloud LLM. It returns `{checkable, claim}`. Prompt v2 asks it to keep polarity ("keep every not/never/only") | `code/pipeline.py` (`DETECT`) |
| Evidence | (a) Wikipedia search API, top 3 intros (keyless). (b) The public **ClaimReview feed** from Data Commons (`storage.googleapis.com/datacommons-feeds/claimreview/latest/data.json`, 201 MB, updated today), indexed locally with BM25: **64,825** English-ish fact-checks. The Google Fact Check Tools API returned **403 without a key**. DuckDuckGo's HTML endpoint returned 202 (a bot wall) | `code/claimreview_lookup.py` |
| Verdict | Same 7B model: SUPPORTED / REFUTED / NOT_ENOUGH_INFO from the evidence only. A "closed-book" baseline asks the same model with no evidence. "Flag" means REFUTED | `code/pipeline.py`, `code/evaluate.py` |
| Visual variant | Rendered claim headlines into 360x640 and 504x896 frames with tilt, optional blur and JPEG q40, then ran Tesseract OCR | `code/ocr_test.py` |

## 2. Assumption 1: the surface (display, gestures, microphone)

| Question | Answer | Source |
|---|---|---|
| Can a third-party app show a pop-up? | **Yes, on Meta Ray-Ban Display only.** `MWDATDisplay` sends one `FlexBox` root with `Text`, `Button`, `ButtonGroup`, `Image` and `Icon`, at 600x600. "Each send replaces the previous content". The display "dims and then enters sleep mode" after inactivity, and the system "may interrupt sessions for calls, notifications". GA or beta status is not stated | [display overview](https://wearables.developer.meta.com/docs/develop/dat/display-overview/), `plugins/mwdat-ios/skills/display-access/SKILL.md` in the DAT iOS repo (1.0.1) |
| Finger gestures? | **Yes on Display:** "Users can control display integrations through the Meta Ray-Ban Display glasses touchpad and Meta Neural Band", and Display `Button`s carry `onClick` handlers with focus via `ActionRole.primary`. Raw events (`Nav`, `Select`, `Drag`) from the **Neural Band** and touchpad come from **Inputs, which is beta** (dev and beta channels only). `Back` is "Not currently delivered by real glasses". Pinch is not named. Inputs stop after re-donning | [inputs guide](https://wearables.developer.meta.com/llms.txt?product=all&version=1.0&document=products/dat/sections/guides/inputs), [known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/) |
| Are Neural Bands available at the event? | The retail Display ships with the band ([UploadVR](https://www.uploadvr.com/meta-ray-ban-display-glasses-officially-announced/)), but the challenge lists only "10 x Meta Ray-Ban Display" (CHALLENGES.md:L914). **Unknown.** Ask at the booth | |
| RBM Gen 2 (the other 10 units) | No display. Output is speech through the speakers. Input is touchpad double tap (`Select`) and swipe (`Nav`) through beta Inputs, the capture button, or the phone | feasibility.md §2-3 |
| Can the glasses hear **other people**? | **Poorly through the standard path.** HFP is beamformed: it "significantly reduces the volume of ambient sounds and other speakers. This is expected behavior, not a bug." Ambient audio at natural levels is only available as **camera-stream audio**, which is "available in the development and beta release channels only". It is an "experimental extension of Camera Stream", needs "Camera and Audio Streaming approval in Wearables Developer Center plus both `.camera` and `.microphone`" permissions, and "MockDeviceKit ... does not provide a public deterministic audio-frame injection API" | [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/), `skills/audio-streaming/SKILL.md` |
| Display combined with the camera | Known issue (Dev/Beta): while a capture transfers from Ray-Ban Display, display updates are held back. "Do not combine capture with display capabilities." It is **unknown** whether this also applies to a running stream with audio | [known issues](https://wearables.developer.meta.com/docs/develop/dat/knownissues/) |
| On-glasses Speech ASR | Beta, and "silently stops" after about 1 minute. It transcribes the wearer's (beamformed) voice, not the room (inference from the HFP doc) | feasibility.md §3, known issues |

**What this means by input variant**
- **(A) What the wearer hears from other people, always on.** It needs the beta camera-stream audio (camera on, LED on, thermal load), or the **phone's own microphone** as the honest fallback. Recording other people's speech continuously is also the weakest consent story against CHALLENGES.md:L902 and Meta's "narrow purpose, short retention, obvious to bystanders" principle (feasibility.md §6). **Highest risk.**
- **(B) Media playing nearby (TV, radio, a podcast on a speaker).** It uses the same audio path as (A), but there is no bystander, and the room can be staged for a demo. **Medium risk.**
- **(C) What the wearer sees (a headline, poster or screen), on demand.** A capture-button press grabs a frame, OCR finds the claim, and a check runs. This uses the GA camera path. **Measured readability:** at 360x640 with mild blur, Tesseract read 5 of 5 headlines exactly with a cap height of **14 px or more**, 0 to 2 of 5 at 8-10 px, and none at 6 px. At 504x896 sharp, 8 px was enough (`results/ocr.json`). Physical size depends on the field of view, which we do not know. As an estimate, 14 px at 360 px wide corresponds to roughly 5 cm letters at 1 m: posters and TV captions qualify, but body text on a phone held at arm's length probably does not. **Lowest risk, and the most "first-person".**
- **Audio-only fallback (Gen 2).** An earcon on a flag, then the wearer taps (or uses the phone button) and TTS says: "Disputed. Two fact-checkers, Health Feedback and the National Academies, rate this false." A second tap reads the next source. It works without Display or Inputs if the phone button is the trigger.

## 3. Assumption 2: the pipeline on representative input (actual measurements)

### 3.1 Accuracy
"Flag" means the pipeline would show the misinformation pop-up. n = 14 true, 14 false, 12 uncheckable.

| Configuration | Input | False claims flagged (recall) | **True claims flagged** | Uncheckable flagged | Flag precision |
|---|---|---|---|---|---|
| v1: LLM rewrites the claim as a search query, Wikipedia evidence | text | 5/14 | **2/14** (t03, t10: negation dropped by the rewrite) | 0 | 5/7 |
| Closed-book 7B, no evidence (the "naive" baseline) | text | 10/14 (v1), 14/14 (v2) | **5-6/14 (36-43%)** | 0 | 10/15, 14/20 |
| v2: polarity-preserving rewrite, Wikipedia + top-3 ClaimReview (BM25, no relevance filter) | text | **8/14** | 2/14 (t02 "water boils at 100 °C" flagged from an unrelated "73 °C in Kuwait: FALSE" fact-check; t03) | 0 | 8/10 |
| v2 + agreement rule (flag only if evidence and closed-book verdicts both say REFUTED) | text | 8/14 | **1/14** | 0 | 8/9 |
| v2 + strict ClaimReview filter (token Jaccard ≥ 0.4) | text | 5/14 | 1/14 (t10) | 0 | 5/6 |
| same | clean TTS → Whisper | 5/14 | 1/14 (t10) | 0 | 5/6 |
| same | **noisy TTS → Whisper** | **4/14** | **1/14 (t10)** | 0 | 4/5 |

Checkable-claim detection on the main set: precision 28/28, recall 28/28 on text. On noisy audio recall was 27/28, because Whisper heard "**Bulls** are enraged by red" as "**Both** are enraged by red". On the **12 harder borderline sentences**, detection was 9/12 correct. It marked "Our startup will be worth a billion in five years", "My grandmother was born in Oulu in 1940" and "He said the meeting was moved to Thursday" as checkable. Each of those would trigger a web search of private speech, which matters for privacy.

What the numbers say:
- **The verdict step is the bottleneck, not retrieval.** Wikipedia returned a directly relevant article for most of the false claims (`Ten-percent-of-the-brain_myth`, `5G_misinformation`, `List_of_common_misconceptions_about_science...`, `Finland–NATO_relations`, `List_of_highest_mountains_on_Earth`). The 7B judge still said NOT_ENOUGH_INFO on most of them, and it said SUPPORTED for "Kilimanjaro is the tallest mountain" next to the list of highest mountains. A frontier model or Jev's evidence check (§4) should do much better here. That is **unverified** (it needs keys), and it is the first thing to measure on site.
- **Every true-claim false alarm came from the pipeline, not the world.** There are two failure modes, both reproducible: (1) **the rewrite flips polarity**. "Vaccines do not cause autism, according to large studies" became "Vaccines cause autism, according to large scientific studies", even with the "keep every not" instruction, and it was then correctly refuted. (2) **Lexical fact-check matching pulls in an unrelated fact-check rated "False"**, and a weak judge copies the rating. Fixes: never rewrite (check the verbatim sentence, which Jev's selection-only design enforces anyway), and gate every fact-check with an explicit "same claim and same polarity?" judgment.
- **The no-evidence model is the dangerous baseline.** It catches every myth but labels 43% of true statements as misinformation, including "Helsinki is the capital of Finland" (v2 run, t01) and "Finland joined NATO in 2023". FactNudger-style harm from wrong nudges is real (competitive-researcher.md). This gives the team an honest "ours against naive" slide, as the `did-i` spike found for its own problem.
- **ClaimReview coverage is narrow.** Only 4 of 28 checkable statements had an obviously relevant published fact-check (vaccines-autism twice, 5G-COVID, bleach-COVID). Fact-checks cover viral claims, not everyday trivia. A proactive pop-up that relies only on matching published fact-checks will be silent most of the time, which is the honest and safe behaviour.
- **Caveats.** The set is small (n=40), the audio is synthetic, it has one speaker and no crosstalk, the claims were written by me, and many are famous myths that any large model knows. Real conversation will be harder: hedges, partial sentences, multiple speakers, and Finnish.

### 3.2 Latency (end of spoken claim to verdict)
| Run | Median | p90 | Max | Stage medians |
|---|---|---|---|---|
| noisy audio, rerun at lower load (load about 40-130) | **4.75 s** | 5.67 s | 20.6 s | endpoint 0.5 s (assumed) + Whisper 0.52 s + detect 1.93 s + Wikipedia 0.49 s + verdict 1.13 s |
| noisy audio, heavy load (about 400) | 6.38 s | 14.4 s | 19.9 s | |
| text only, v1 | 3.17 s | 12.5 s | 24.9 s | |

- Wikipedia retrieval on its own, 10 queries: median **0.44 s**, max 0.89 s. This is network-bound, so it is representative.
- Whisper base.en on CPU: 0.4-0.95 s per 2-5 s clip when the machine was not saturated, and up to 7.5 s when it was. On a phone, Apple's on-device speech recognizer or Android's would stream partial results (estimate).
- **Estimated budget with Jev and a cloud search** (not measured): endpoint 0.5 s, then final ASR 0.3 s, then Jev "checkable?" 0.1 s, then search 0.5-1.0 s, then Jev "supports/refutes?" over the passages 0.1-0.2 s. That is about **1.5-2.1 s**, plus the time to send to the display (unknown). Adding a cloud LLM verdict adds about 1-3 s (feasibility.md §5 estimate).

## 4. Assumption 3: what Jev offers (public docs, read today)

- **What it is.** A "System One" model: you send a *state* and typed *questions*, and get back `choice` with probabilities and confidence, `score`, `noul` (a 0-1 probability that a statement is true of the state), or `box` for images. "It does not generate text, write code, or hold a conversation" ([coding agents](https://docs.typesafe.ai/introduction/coding-agents.md), [introduction](https://docs.typesafe.ai/introduction.md)). Questions in one request run in parallel and independently.
- **Latency.** "Most calls complete in about 100 ms" ([how to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md)). The Twitch chat cookbook measured "a median of about 0.1 seconds" ([twitch cookbook](https://docs.typesafe.ai/cookbooks/twitch_chat_filter.md)). **Unverified here.**
- **Knowledge.** "Do not rely on knowledge stored in model weights when current information can come from your own knowledge base" (how to build). Jev is therefore **not** a fact oracle and does not search. The evidence must come from our retrieval.
- **Access.** `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer <API_KEY>`. Keys come from [console.typesafe.ai/keys](https://console.typesafe.ai/keys). There are Python and JS SDKs, a browser Playground, and a model alias `jev-latest` ([quickstart](https://docs.typesafe.ai/introduction/quickstart.md), [API](https://docs.typesafe.ai/api.md)). An unauthenticated GET `/v1/models` returned 403 here. One cookbook mentions a "public rate limit" (4 workers); the exact limits and pricing are **unknown**. TypeSafe is **not** listed among the Junction tech challenges (no match in CHALLENGES.md), so whether there is an event key or prize is unknown.
- **Where it fits this pipeline** (patterns from its docs):
  - *Check-worthiness:* a Noul "this utterance makes a factual claim about the public world that could be checked against public sources", used as the "screen with a Noul first" pattern, plus a second Noul "is about a private person or a plan or prediction" to catch our borderline failures.
  - *Evidence judgment:* per retrieved passage or fact-check, a Choice of `supports / refutes / same topic but does not settle it / unrelated`, judged against the **verbatim** sentence. This is the shape of the [citation-check](https://docs.typesafe.ai/cookbooks/citation_check.md) and [verify LLM outputs](https://docs.typesafe.ai/cookbooks/verify_llm_outputs.md) cookbooks. It also fixes both of our false-alarm causes: there is no rewrite, and a mismatched fact-check comes back `unrelated`.
  - *Same-claim gate for ClaimReview:* a Noul "the fact-checked claim asserts the same thing, with the same polarity, as the utterance".
  - *Not Jev:* writing a search query, if one is needed (a cloud LLM, or the verbatim sentence), the search itself, and spoken summaries.

## 5. What worked, what failed, what is unverified

**Worked (verified here)**
- The full keyless loop: TTS → Whisper → detect → Wikipedia and a local ClaimReview index → verdict, with a 4.75 s median on a loaded laptop.
- The public ClaimReview feed is downloadable without a key (64,825 English-ish fact-checks, refreshed daily). It works as an offline "known misinformation" index for the demo.
- Clear-cut uncheckable chatter is ignored (12 of 12).
- An agreement rule (evidence and closed-book must both refute) cut true-claim flags from 2 to 1 of 14 without losing recall in the v2 run.
- The DAT Display, Inputs and audio-streaming APIs exist and are documented in the public SDK (1.0.1), and the Display preview runs in-app or in Chrome without glasses.

**Failed**
- A local 7B judge as the verdict model: it reached only 29-57% recall when grounded in evidence, and 43% of true claims were flagged when it was not.
- LLM claim rewriting: it flips negations.
- BM25 matching of fact-checks without a semantic same-claim gate.
- Detection on borderline speech: 3 of 12 private or forward-looking statements were marked checkable.
- Keyless web search: Google Fact Check Tools returns 403 and DuckDuckGo shows a bot wall. Only the Wikipedia API worked keyless.

**Unverified (what the team must do on site)**
| Item | How to verify (hours 0-3) |
|---|---|
| Jev accuracy and latency on our set | Get a key and port `pipeline.py` to two Jev requests (detect Nouls; evidence Choice per passage). Run all three result sets. **Pass:** true-claim flags ≤1/14, recall ≥10/14, p50 Jev call ≤200 ms |
| Cloud LLM / grounded search as verdict | Same harness with Gemini (search grounding, which also targets the Gemini API tech challenge) or Oxylabs `/search` for live web evidence. Compare against the 7B numbers above |
| Do Display units come with Neural Bands, and do Display taps and `onClick` work in Developer Mode | Ask Amanda Le at the booth. Run the DisplayAccess sample on a loaner. Send a card and click its button with the band and with the touchpad |
| Camera-stream audio on loaner glasses | It needs Wearables Developer Center approval (`skills/audio-streaming/SKILL.md`). Ask the booth whether Developer Mode is enough. Record 60 s of a TV clip through it, transcribe, and compare with the phone mic |
| Display while the camera streams | Known issue for capture. Test a stream with audio plus a display card update on a Display unit. If updates stall, use the **phone mic** for audio in the Display demo |
| Real ASR in the hall | Play our 40 clips from a speaker at 1-2 m and record through the glasses and the phone. Rerun `evaluate.py` |
| Field of view (sets the OCR distance) | Photograph a ruler at 1 m through the DAT stream |

## 6. Architecture I would build

```
Inputs                                   Phone app (DAT 1.0.1, one platform)                         Backend (keys server-side)
──────                                   ─────────────────────────────────────                      ──────────────────────────
(C) Look + press capture button ──photo/frame──► OCR (Vision / ML Kit) → sentence spans ─┐
(B) Media mode: camera-stream audio (beta)  ─┐                                           │
    or phone mic (fallback, GA)              ├──► on-device streaming ASR + endpointing ─┤──► 1. Jev request #1 (≈0.1 s):
(A) Ambient conversation: NOT in MVP         ┘     20 s ring buffer, nothing stored      │      Noul checkable-public-claim, Noul private/plan/prediction
Wearer's tap / Neural Band select ("check that") ────────────────────────────────────────┘   2. Retrieval in parallel:
                                                                                                  local ClaimReview index (64k, daily feed)
                                                                                                  + live web (Wikipedia; Gemini grounding or Oxylabs if keyed)
                                                                                             3. Jev request #2: per candidate, Choice
                                                                                                  supports / refutes / does-not-settle / unrelated
                                                                                                  + Noul "same claim, same polarity" for each fact-check
                                                                                             4. Policy in code (precision first):
                                                                                                  DISPUTED  = ≥1 same-claim fact-check rated false
                                                                                                              OR ≥2 independent sources "refutes" at p≥0.9
                                                                                                  SUPPORTED / NO VERDICT otherwise; never "false" from model memory
Output ◄────────────────────────────────────────────────────────────────────────────────── verdict + 1-3 source names/URLs
  Ray-Ban Display: 600x600 FlexBox card: "Disputed" chip, the claim as heard, "Health Feedback: False",
                   ButtonGroup [Sources] [Dismiss]; Neural Band/touchpad focus+select; Sources card pages through
  Gen 2 / no display: earcon; tap → TTS verdict; tap again → next source (ElevenLabs or system TTS)
  Phone mirror: transcript, the claim, evidence, probabilities, "what was sent / stored" (nothing kept after 20 s)
States to show (CHALLENGES.md:L900): not registered, permission denied, session paused/stopped, display asleep,
  Inputs lost after re-don (re-add), audio route failed (HFP before stream), offline (local ClaimReview only), thermal.
```

Design decisions that follow from the spike:
- **Never rewrite the claim.** Judge the verbatim sentence. If a search query is needed, use the sentence itself or keyword extraction, and judge the evidence against the original.
- **Proactive only on a published fact-check match**, which is high precision and low coverage. Everything else is on demand ("check that"). This matches "context on demand (not ambient)" in Meta's acceptable-use guide (feasibility.md §6).
- **Show who disputes the claim, not "FALSE".** The card names the fact-checker. "No verdict" is a normal, frequent outcome and is shown as such.

## 7. Fallback demo path (short device slots)

1. **Primary (Display unit with Neural Band, 5 minutes):** a laptop plays a 60 s "news segment" (our TTS script with 3 false, 3 true and 2 uncheckable statements). A printed poster carries one false headline. The wearer looks at the poster and presses capture, and a card appears. Then they tap to check the last sentence from the "TV". The phone mirror is cast to a screen.
2. **Short slots only:** use one slot to record real glasses audio and frames of the script and poster, and to confirm that Display cards and taps work. Afterwards, run the same app with **MockDeviceKit + MockDisplayKit preview** (in-app or in the Chrome simulator). Use the phone mic for audio, because the mock cannot inject stream audio, and replay the recorded poster frame through `setCameraFeed(fileURL:)` (did-i.md §3).
3. **No glasses at judging:** the phone app with the Display preview on screen and a pre-recorded real-glasses video. Say plainly that it is the mock.
4. **In every path:** a scoreboard of our policy against the naive closed-book prompt on the labelled set, showing **true claims wrongly flagged** (here 1/14 against 6/14).

## 8. Revised MVP

- **Name and framing:** "Check that". A wearer-initiated check of what you see or what media just said. Proactive pop-ups appear only when a published fact-check matches. Drop "detects misinformation in every conversation" and "cut misinformation worldwide".
- **Audience (pick one for the deck):** older adults and others targeted by health and scam misinformation on TV and posters, or people with low literacy or low vision who cannot easily read the source themselves (audio mode). The second scores on accessibility (CHALLENGES.md:L890, L902).
- **Inputs:** (C) capture button to OCR to check. (B) media audio as a 20 s ring buffer with "check the last sentence", using the phone mic and adding camera-stream audio if it works on the loaners.
- **Pipeline:** Jev detect and evidence judgments, local ClaimReview plus Wikipedia (plus a keyed web search if available), and the precision-first policy in §6.
- **Output:** a Display card with a Sources button (Neural Band or touchpad). Gen 2 and phone fallback via TTS.
- **Trust and consent:** the LED stays on during capture, there is no always-on room listening, a 20 s buffer is discarded, nothing is stored, and the phone shows what was sent. Bystander speech is out of scope.
- **Evaluation slide:** a labelled set of 100 or more statements (ours plus hard borderline items), with recall, **true claims wrongly flagged**, "no verdict" rate and p50/p90 latency, against the naive closed-book baseline.
- **Cut:** always-on ambient conversation checking, multilingual Finnish, voice-model dialogue about sources (keep a "read next source" TTS), and live web search if no key.

## 9. Hour-by-hour outline (3 people, 40 h)

A = mobile/DAT, B = ML/pipeline, C = full-stack, demo and deck.

| Hours | A (mobile/DAT) | B (ML/pipeline) | C (full-stack/demo/deck) |
|---|---|---|---|
| 0-3 | At the booth: Display units, Neural Bands, Developer Mode, `CAPABILITY_DENIED`, camera-stream audio approval. Build DisplayAccess and CameraAccess, and send a test card | Get a Jev key. Port the harness to Jev (2 requests) and run the 40-item set plus 12 borderline items. Try the Gemini or Oxylabs evidence path if keys exist | Backend skeleton (`/check`), provider modules with mocks, local ClaimReview index service |
| 3-4 | **Gate (all three):** with Jev, true claims flagged ≤1/14 and recall ≥10/14 on text, and Display card + tap works on a loaner. If the accuracy gate fails, switch to fact-check-match-only mode. If Display fails, go audio-only on Gen 2 | | |
| 4-12 | Capture-button trigger → frame → on-device OCR. Phone-mic ring buffer + streaming ASR. Display card and Sources pages | Jev same-claim gate, evidence Choice, policy thresholds, eval harness (100+ items incl. hard negatives) | Phone mirror UI, state handling screens, poster and news-segment script and TTS |
| 12-14 | **First full real-glasses slot:** record frames and audio, time each stage | Rerun the eval on real recordings | Storyboard the demo, first deck outline |
| 14-22 | Robustness: paused/stopped, re-don Inputs, display sleep, offline mode | Latency tuning (parallel retrieval, caching) | Integration, demo script, backup video |
| 22-28 | Sleep in shifts; keep devices charged | | |
| 28-34 | Camera-stream audio, if approved; Gen 2 audio-only mode | Final held-out evaluation numbers | Deck: problem, audience, trust, evaluation against naive, pilot (e.g. a senior-centre or library media-literacy programme) |
| 34-38 | Second real-glasses slot: full run and backup video | Freeze thresholds | Peer-review rehearsals |
| 38-40 | Bug fixes only | Bug fixes only | Submit (deadline Sunday 10:00, 00-rules-and-jury.md) |

## 10. Verdict

**Go-with-changes (estimate)**, on feasibility only:
- **Buildable.** Display cards with Neural Band and touchpad interaction are documented for third-party apps, and the pipeline runs end to end in under 5 s even on a loaded laptop.
- **Not buildable as described.** An always-on detector of what other people say is held back by beamformed HFP, beta-only ambient audio, a known Display-with-capture issue, and a 7B-class verdict step that flags 1 to 6 of 14 true statements depending on design. The accuracy half rests on Jev or a cloud model that we could not test without keys.
- **Kill condition.** At hour 4, with Jev or a cloud model on our labelled set, true claims flagged above 1/14, or recall below 8/14 even when relevant evidence is retrieved. In that case, ship fact-check-match-only mode, which has high precision and low coverage, or hand the slot to the next concept in `_top5.md`.
- **Live-demo probability.** About 50% for a clean run on real Display glasses (device access, Neural Band availability, Display with audio, venue Wi-Fi). About 85% for the mock plus phone path with recorded real-glasses clips (estimates).

<!-- complete -->
