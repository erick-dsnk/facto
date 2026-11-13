# Team idea `live-fact-check`: placement against the existing candidates

**Summary**
- **Set it aside as described. Don't make it the backup.** Using the exact weighting from `_top5.md`, it scores **41.5 / 44.1 / 43.5** (Meta award / overall win / combined). That ranks it **16th, 15th and 16th of 18**, roughly 30 points behind `did-i` and `panel-reader`. All five judges and the spike agree on the reason: no GA input can reliably hear other people. It also judges bystanders without their consent. And one wrong "misinformation" pop-up in front of a judge would end the pitch.
- **Its strongest buildable variant is "Scam Check"**: deliberate look-and-tap checks of letters, notices and flyers for older or low-vision users, with Jev doing the typed checks. It reaches about **59-60 in every view (about 7th of 18; 6th, tied with `basket`, on the overall view)**. If we take each judge's best variant score, even when the judges described different variants, the ceiling is about 62. That is still about 10 points below `panel-reader` and 12 below `did-i`.
- **Head-to-head, it loses to every one of the existing top five on Meta alignment and real-world value.** It beats `beacon` and `nod` only on feasibility, and only in the reshaped variant. No current recommendation exists yet: `07-final-selection.md` has not been written. The working picks from `_top5.md` §7 are `panel-reader`+Find (Meta award and combined) and `did-i` (overall).
- **What would change this:** a Jev measurement on site of ≤1/14 true claims flagged with ≥10/14 recall; a Meta mentor explicitly endorsing claim or scam checking; a named pilot partner; *and* the spikes for `panel-reader`, `did-i` and `teardown-memory` all failing. Without all of these, it stays out of the top five.

---

## 1. Method (reused unchanged from `05-evaluation/_top5.md`)

- **Judge scores.** The five judge scores for the idea as described come from the five reports in this folder: meta-judge 43, competitive-researcher 40, demo-evaluator 55, senior-engineer 38 and skeptical-investor 37. Each judge used the same scale and criteria as its `05-evaluation` counterpart.
- **Weights** (`_top5.md` §2):

| Criterion (judge) | Start | **Meta award** | **Overall** | **Combined** |
|---|---|---|---|---|
| Official-criteria alignment (meta-judge) | 25 | 35 | 5 | 25 |
| Novelty (competitive-researcher) | 20 | 15 | 20 | 20 |
| Demo impact (demo-evaluator) | 20 | 10 | 30 | 20 |
| Technical feasibility (senior-engineer) | 15 | 20 | 15 | 15 |
| Real-world usefulness (skeptical-investor) | 10 | 20 | 25 | 15 |
| Sponsor tech (estimate) | 10 | 0 | 5 | 5 |

- **Sponsor column (my estimate, 50 as described, 55 for the variants).** Jev/TypeSafe is **not** a Junction tech challenge: "TypeSafe" appears nowhere in CHALLENGES.md (grep, 0 matches; also feasibility.md §4). The honest fit is Gemini search grounding as the evidence source (Gemini API challenge) and ElevenLabs for reading sources aloud. Both are peripheral, so this column does not decide any placement.
- **How the variant scores were built.** No judge scored the same variant on all five lenses, so I compose each variant row from the judges' own variant scores and fill the gaps with my estimates, marked *est.* below. Section 4 shows that no plausible choice of gap values changes the conclusion.
- **Pre-spike scores.** The existing rows are pre-spike judge scores, and so is this idea's row. Spike evidence on both sides is weighed separately in section 5.

## 2. Extended score table

Existing rows are copied from `_top5.md` §3. The new rows are computed with the same formula (Python, checked).

| Candidate | Meta | Novelty | Demo | Feas. | Useful | Spons. (est.) | Spread | Start | **Meta view** | **Overall view** | **Combined** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| did-i | 76 | 76 | 75 | 74 | 72 | 60 | 4 | 73.5 | **74.7** | **73.6** | **74.1** |
| panel-reader | 82 | 66 | 84 | 58 | 68 | 50 | 26 | 71.0 | 72.2 | 70.7 | 71.9 |
| teardown-memory | 73 | 64 | 77 | 55 | 50 | 45 | 27 | 64.2 | 63.9 | 62.5 | 64.5 |
| beacon | 74 | 78 | 73 | 30 | 54 | 55 | 48 | 64.1 | 61.7 | 62.0 | 64.0 |
| step-check | 64 | 45 | 79 | 66 | 56 | 45 | 34 | 60.8 | 61.5 | 62.0 | 61.4 |
| nod | 72 | 72 | 64 | 34 | 52 | 55 | 38 | 61.0 | 59.6 | 58.0 | 60.9 |
| *live-fact-check: "Scam Check" variant* | 64 | 52 *est.* | 70 | 60 *est.* | 50 *est.* | 55 | 20 | 59.9 | *59.2* | *58.9* | *59.6* |
| private-hand | 65 | 62 | 72 | 45 | 38 | 60 | 34 | 59.6 | 55.9 | 56.5 | 58.5 |
| basket | 56 | 48 | 65 | 60 | 60 | 60 | 17 | 57.6 | 57.3 | 58.9 | 57.6 |
| *live-fact-check: "Check that" (misinformation, visual, on demand)* | 53 | 58 | 62 | 66 | 42 | 55 | 24 | 56.9 | *55.0* | *56.0* | *56.2* |
| glance-log | 54 | 35 | 62 | 82 | 60 | 35 | 47 | 54.7 | 58.8 | 57.4 | 56.0 |
| coverage-inspector | 50 | 52 | 54 | 76 | 46 | 40 | 30 | 53.7 | 55.1 | 54.0 | 54.0 |
| cross-contact | 48 | 62 | 70 | 44 | 34 | 20 | 36 | 50.4 | 48.7 | 51.9 | 51.1 |
| show-me-once | 62 | 50 | 51 | 40 | 35 | 65 | 27 | 51.7 | 49.3 | 46.4 | 50.2 |
| which-way-now (HR) | 42 | 28 | 57 | 80 | 28 | 55 | 52 | 47.8 | 46.2 | 46.5 | 46.5 |
| sana | 46 | 36 | 41 | 57 | 45 | 60 | 21 | 46.0 | 46.0 | 44.6 | 45.2 |
| table-talk | 52 | 42 | 53 | 24 | 42 | 50 | 29 | 44.8 | 43.0 | 43.5 | 44.4 |
| **live-fact-check (as described)** | **43** | **40** | **55** | **38** | **37** | 50 | 18 | **44.1** | **41.5** | **44.1** | **43.5** |
| still-head | 34 | 38 | 58 | 44 | 40 | 15 | 24 | 39.8 | 40.2 | 44.0 | 41.0 |
| *live-fact-check: hearing-only (audio) variant* | 34 | 35 | 47 | 25 *est.* | 37 | 50 | 22 | 37.4 | *34.2* | *38.3* | *36.7* |
| heads-up-sounds (HR) | 49 | 40 | 32 | 12 | 30 | 25 | 37 | 34.0 | 34.8 | 30.6 | 34.2 |

Where each variant cell comes from:
- **Scam Check.** Meta 64 is from meta-judge.md §6 and demo 70 from demo-evaluator.md §6. Novelty 52 is my estimate: the competitive-researcher gave visible-claim checking about 58 but notes that Lens-style and one-shot Meta AI answers are close substitutes, and phone scam scanners are a known category (meta-judge.md §6). Feasibility 60 is my estimate, set below the engineer's 66 for "Check this" because a scam *SMS on a phone screen* is the hard OCR case: body text on a phone at arm's length "probably does not" reach the 14 px cap height that 360p needs (feasibility.md §2C), and the engineer also flags phone screens as harder (senior-engineer.md §2). Usefulness 50 is my estimate. Fraud against older adults is a named, recurring harm, but SMS scams already live on the phone, where phone-side scanners exist (no judge measured this directly). Nobody hard-rejected this variant.
- **Check that.** Meta 53 is from meta-judge.md §3 (deliberate visual). Novelty 58, demo 62 and feasibility 66 come from the competitive-researcher, demo-evaluator and senior-engineer best and visual variants. Useful 42 is the investor's consumer "Is that true?" button (skeptical-investor.md §6).
- **Hearing-only.** Meta 34 and demo 47 are each judge's figure for the hearing variant, and novelty 35 is the competitive-researcher's audio figure. Feasibility 25 is my estimate between `table-talk` (24) and the described 38, because the engineer calls it "the hardest input in the whole candidate set". The meta-judge and demo-evaluator would each **hard-reject** this variant on its own (meta-judge.md §3; demo-evaluator.md §4).

## 3. Rank on each view (of 18 = 17 existing + this idea)

| Version | Meta award | Overall win | Combined |
|---|---|---|---|
| As described | **16th** (41.5) | **15th** (44.1) | **16th** (43.5) |
| Hearing-only variant | 18th (34.2, would be HR) | 17th (38.3) | 17th (36.7) |
| "Check that" (misinformation framing kept) | 11th (55.0) | 10th (56.0) | 9th (56.2) |
| **"Scam Check" (strongest variant)** | **7th** (59.2) | **6th**, tied with `basket` (58.9) | **7th** (59.6) |
| Cherry-picked ceiling (each judge's own best-variant score: 64/58/70/66/52) | 61.7, about 6th | 61.5, about 6th | 62.1, about 6th |

The cherry-picked ceiling mixes variants that the judges described differently (Scam Check, Check this, Press Pass), so it overstates what one build would get. Even so, it lands below all of the top five except `nod` and `step-check`.

## 4. Where the judges disagree, and whether a placement turns on one score

- **The judges agree on the idea as described.** The spread is 18 (37-55), the third-smallest spread in the table after `did-i` (4) and `basket` (17). The highest score is the demo-evaluator's 55, and it is high only because "fact-checker" is instantly legible. The same report says the as-described demo has no before/after and no baseline. All five strongest objections name the same failure: a confident false flag on a true claim, in front of a judge (demo-evaluator.md, senior-engineer.md, meta-judge.md §5).
- **The spike confirms that objection with measurements.** The no-evidence model flagged 5-6 of 14 true claims (43%), and even the grounded pipeline flagged 1-2 of 14. Each traced false alarm came from a reproducible pipeline cause: the rewrite dropping a negation, or an unrelated "False" fact-check (feasibility.md §3.1). The objection is measured, not a matter of taste.
- **The variant placement depends on my gap estimates.** I checked how much they matter. If novelty, feasibility and usefulness for Scam Check all take the most generous value any judge gave a related variant (58/66/52), the combined score is about 62. If they take the as-described values (40/38/37), it is about 50. No setting in that range reaches `teardown-memory` (64.5), let alone `panel-reader` (71.9) or `did-i` (74.1). The conclusion holds across every value I tried.
- **The meta-judge's "Meta's own stance" point** (Meta ended US third-party fact-checking because it "too often became a tool to censor", [Meta newsroom](https://about.fb.com/news/2025/01/meta-more-speech-fewer-mistakes/), cited in meta-judge.md §2) weighs on the misinformation framing, not on Scam Check. This is one reason Scam Check scores 11 points higher on that lens than "Check that".

## 5. Head-to-head against the top five

`07-final-selection.md` does not exist yet (checked 14 Nov), so there is no final recommendation to compare against. The working picks are those in `_top5.md` §7. Spike status: `beacon`, `did-i` and `nod` have full reports. `panel-reader` is a draft without results (06-feasibility/panel-reader.md). `teardown-memory` has no spike report yet.

### vs `panel-reader` + Find (current Meta award and combined pick: 72.2 / 70.7 / 71.9)
- **Fact-checker is worse on** Meta alignment (43 vs 82; Scam Check 64 vs 82), demo (55 vs 84; 70 vs 84), usefulness (37 vs 68) and accessibility. Panel-reader's blind-user story is exactly what L890/L902 ask for, while the fact-checker as described names no ability group (meta-judge.md §3 C4).
- **Fact-checker is better on** feasibility, but only for the reshaped variant (engineer 66 for "Check this" vs 58). It needs no fingertip or homography tracking: OCR of large text at ≥14 px cap height measured 5/5 at 360p (feasibility.md §2C). It also already has a measured end-to-end pipeline (4.75 s median), whereas panel-reader's spike has no results yet.
- **Net:** it loses by about 30 points as described and about 12 for Scam Check. It is better only if the panel-reader spike fails, and even then `did-i` is the named fallback.

### vs `did-i` (current overall pick: 74.7 / 73.6 / 74.1)
- **Worse on** every lens. The biggest gaps are usefulness (37 vs 72: did-i has the strongest daily trigger, while the investor's self-selection argument means the fact-checker's users "don't need it") and novelty (40 vs 76: Faktum, Ghost Mic, LiveFC, Halliday, Factually and FactNudger already exist, per competitive-researcher.md).
- **Both have the same structural lesson.** Each spike found that the naive model prompt is dangerously confident: did-i said "locked" on 22/22 non-locked bursts, and the fact-checker flagged 43% of true claims. Each is rescued by a precision-first design that says "not sure" or "no verdict". did-i's rescue (tag-anchored geometry, 42/43 correct when registered, did-i.md summary) is measured. The fact-checker's rescue (Jev evidence judgement) is **unverified** without a key.
- **Net:** it loses decisively. did-i keeps the overall slot.

### vs `teardown-memory` + scoreboard (63.9 / 62.5 / 64.5)
- **Worse on** Meta alignment (43 vs 73) and demo (55 vs 77). As described it also loses on usefulness (37 vs 50), while Scam Check (50 est.) ties it.
- **Better on** feasibility for the reshaped variant (66 vs 55) and on spike evidence: we hold measured pipeline numbers, and teardown has no spike report.
- **Net:** Scam Check sits about 5 points behind on every view. This is the closest contest, and the only one where a spike result could swap them.

### vs `beacon` (61.7 / 62.0 / 64.0)
- **Worse on** novelty (40 vs 78) and Meta alignment (43 vs 74).
- **Better on** feasibility in the reshaped form (66 vs 30), and it needs no beta Motion. But beacon's spike since then has shown a GA-only visual fallback (97-99% correct with slow turns, beacon.md summary), which cuts much of that advantage.
- **Net:** about 2 points behind beacon on the Meta and overall views and about 4 on combined, for Scam Check. Beacon also shares code with panel-reader Find, which the fact-checker does not.

### vs `nod` (59.6 / 58.0 / 60.9)
- **Worse on** Meta alignment (43 vs 72), novelty (40 vs 72) and accessibility (nod fills the motor-impairment gap, opportunity.md §1).
- **Better on** feasibility (reshaped: 66 vs 34). Nod's spike found 6.2 false "yes" per 5 minutes when always-on, and it only works prompt-gated, conditional on Motion at ≥15 Hz (nod.md summary).
- **Net:** Scam Check is level with nod (59.2 vs 59.6 Meta view; 58.9 vs 58.0 overall; 59.6 vs 60.9 combined). If the hour-0 Motion check fails, nod is a no-go. Even then, `private-hand` is the named reserve, and Scam Check only edges it (59.6 vs 58.5 combined).

## 6. Verdict: set aside

- **Don't replace the recommended project.** It is about 30 points behind both leaders as described and about 12-15 behind in its best form. The gap is driven by Meta alignment and real-world value, the two lenses Meta itself weights at 50% (CHALLENGES.md:L934-937).
- **Don't make it the backup.** The backups are already named and score higher: `did-i` behind `panel-reader`, and `teardown-memory` behind `did-i` (`_top5.md` §7).
- **Don't merge it into an existing candidate.** No top-five candidate needs a claim checker. Two parts of its work are worth reusing:
  1. The **"ours vs naive closed-book" false-alarm slide pattern**, which `did-i` already uses.
  2. The **Jev typed-judgement idea**: if a top-five candidate has a text-level "is this the same thing, same polarity?" check, Jev could do it in about 100 ms (vendor figure, unverified; feasibility.md §4).
- **Keep "Scam Check" as a parked reserve** behind `private-hand`, for the case where several spikes fail.

**What would change this answer** (all of it, not one item):
1. A Jev key on site, with the feasibility harness passing its own gate: ≤1/14 true claims flagged, ≥10/14 recall, p50 ≤200 ms (feasibility.md §5). Without this, the core promise is unproven.
2. A Meta mentor saying at the booth that claim or scam checking is a use case Meta wants to showcase (meta-judge.md §7). This would lift the C1/C4 penalty.
3. A named pilot partner, such as a senior-services, consumer-protection or media-literacy organisation (none contacted). This lifts usefulness and C3.
4. Top-five spikes failing: `panel-reader` fingertip tracking fails, the Motion gate kills `beacon` and `nod`, and `teardown-memory`'s ArUco registration fails. Only then does Scam Check at about 60 become the best remaining option.

## 7. If the team still wants it: the smallest set of changes that makes it competitive

| Change | Why (evidence) | Effect |
|---|---|---|
| 1. **Drop always-on hearing of other people.** The wearer starts every check ("check this"), and proactive pop-ups appear only on a same-claim published fact-check | HFP is beamformed to the wearer, and ambient audio is beta, needs Developer Center approval and has no mock injection (feasibility.md §2). It also conflicts with "deliberate, not ambient" (meta-judge.md §2) | Removes the would-be hard reject. Feasibility goes from 38 to about 66 |
| 2. **Make the input visual: a GA capture-button frame, then OCR**, using large-type props (letters, notices, posters) and not phone body text | ≥14 px cap height reads 5/5 at 360p; phone text at arm's length probably does not (feasibility.md §2C) | Demo goes from 55 to about 62. Novelty goes from 40 to about 58 (the visual space is less crowded) |
| 3. **Narrow it to one user and one harm: scams aimed at older or low-vision adults**, not "misinformation worldwide" | A named group, a non-political domain and a checkable verdict (meta-judge.md §6; demo-evaluator.md §6). It sidesteps Meta's stance on truth arbitration | Meta goes from 53 to about 64. Usefulness goes to about 50 (estimate) |
| 4. **Use a precision-first policy and show it.** Judge the verbatim text (never rewrite it), use a "not sure" band, never say "safe", and name the source | Rewrites flipped polarity, and unrelated fact-checks caused false flags (feasibility.md §3.1) | Protects the demo. Required to keep the scores above |
| 5. **Put a bystander-run scoreboard in the demo**: about 20 genuine and scam cards, with the human's guess, Meta AI and our app side by side, and false alarms counted | Gives the before/after and the in-demo baseline the jury rubric asks for (00-rules-and-jury.md §7, criterion 4) | Demo goes to about 70 |

**With all five changes the estimate is about 59-60 on every view (7th, or 6th tied on overall).** That is still about 12-15 points below the leaders and about 5 below `teardown-memory`. The idea is sound and buildable in this form, but it is not a winner on the evidence we have.

## 8. Sources
- Judge reports: `08-team-idea/{meta-judge, competitive-researcher, demo-evaluator, senior-engineer, skeptical-investor}.md`. Spike: `08-team-idea/feasibility.md`.
- Method and existing rows: `05-evaluation/_top5.md`. Spikes: `06-feasibility/{beacon, did-i, nod, panel-reader}.md` (panel-reader is a draft without results; there is no teardown-memory report).
- CHALLENGES.md:L934-937 (rubric), L890/L902 (accessibility, trust). 00-rules-and-jury.md §7.
- Every weighted score, the sponsor column and the cells marked *est.* are **my estimates**. Model scores organise this comparison; the decision rests on the evidence in sections 4 and 5.

<!-- complete -->
