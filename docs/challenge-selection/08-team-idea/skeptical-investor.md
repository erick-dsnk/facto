# Team idea `live-fact-check`: sceptical-investor lens (real-world usefulness and repeat value)

**Summary**
- **Score: 37/100 (estimate). Not a hard reject.** That puts it **14th of 18** in the existing table, between `private-hand` (38) and `show-me-once` (35), and well below `did-i` (72) and `panel-reader` (68).
- The problem is real at the scale of society, but it is weak for the individual wearer. The people who would switch on a fact-checker are mostly people who already avoid misinformation. The people who spread it will not wear a device that contradicts them. So the bet that this cuts misinformation worldwide is the claim an investor would push back on hardest.
- The trigger is frequent in theory, since claims are everywhere. It is weak in practice. It needs the glasses on, the checker on and the mic listening to *other people*. Most misinformation lives on the phone, where phone tools already work. The moment it fires is socially costly: a "misinformation" pop-up while a friend or relative is talking.
- **The best variant (about 52) is a narrow professional one:** a hands-free claim log for journalists and fact-checkers at live events such as press conferences, debates and council meetings. Their job brings the trigger back every day, and there is a named buyer type (for example Faktabaari or a newsroom; none contacted). Even so, it would place only 6th-7th.

---

## 1. Criteria (adopted unchanged from 05-evaluation/skeptical-investor.md)

| Weight | Question |
|---|---|
| 30% | Recurring trigger, at a moment the user is plausibly wearing the glasses |
| 25% | Severity, and who cares |
| 20% | Beats the incumbent |
| 15% | Believable next step (a pilot type and a buyer) |
| 10% | Trust that survives use |

Scale anchors are the same as before: 80+ means fund a pilot, 60-79 a real need with one major doubt, 40-59 plausible but occasional or niche, below 40 a one-off use or the incumbent wins. All sub-scores are **estimates**.

## 2. Criterion-by-criterion assessment

The idea does not say what the input is, so I assess the input variants separately where it matters.

| Criterion | Sub-score (estimate) | Weighted |
|---|---|---|
| Recurring trigger (30%) | 40 | 12.0 |
| Severity and who cares (25%) | 35 | 8.75 |
| Beats the incumbent (20%) | 40 | 8.0 |
| Believable next step (15%) | 40 | 6.0 |
| Trust that survives use (10%) | 25 | 2.5 |
| **Total** | | **37** |

### 2.1 Recurring trigger (40)
- **Heard speech: conversations.** These happen daily, but the user has to choose to have the checker running while talking with people. That is ambient listening to bystanders, which runs against Meta's own design principle of "narrow purpose, short retention, obvious to bystanders" and "context on demand (not ambient)" (feasibility.md §6). There is also a hardware problem. The documented mic route (HFP) is "beamformed toward the wearer's voice", and the non-beamformed camera-stream audio is **beta-only** (feasibility.md §3, from Meta's [mic docs](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/)). Capturing *other people's* speech well therefore depends on a beta capability. On-glasses Speech (beta) "silently stops" after about 1 minute (feasibility.md §5). Continuous use also runs into thermal and battery limits; real drain figures are unknown (feasibility.md §5).
- **Heard speech: TV, radio, podcasts, talks.** This is the most natural trigger (a debate, a news segment). But you are rarely wearing smart glasses on the sofa (wear time is unknown, the same caveat as in the original table), and broadcast fact-checking already exists without glasses (see 2.3).
- **Seen text: screens.** Most everyday misinformation arrives on the phone. Pointing the glasses camera at your own phone is close to the "mirroring a phone screen" the brief says is not enough (CHALLENGES.md:L886, L890). A phone-side checker or share-sheet would beat it.
- **Seen text: posters, print, packaging.** Real, but such text rarely carries checkable misinformation. Health and supplement claims on packaging are the exception. The trigger is occasional.
- **Net.** The need *exists* often. The moment when the user wants a check, is wearing the glasses and has the checker running is much rarer. Novelty fades fast, and nothing in the flow brings the user back except their own wish to be corrected, which research suggests is weak (2.2).

### 2.2 Severity and who cares (35)
- Misinformation is a real problem for society, and the jury will accept that. The investor question is *who among the wearers suffers without this*. Mostly no one, at least not in the moment.
- Self-selection works against the "worldwide" bet. In a NewsGuard field experiment, encouraging people to install a credibility-rating extension produced no detectable change in low-quality news consumption over 3 weeks on average. About 65% of the sample already had a mostly reliable news diet, and some shift appeared only among heavy misinformation consumers ([Nieman Lab](https://www.niemanlab.org/2022/05/do-browser-extensions-keep-anyone-away-from-fake-news-sites-maybe-on-the-edges-a-tiny-bit/); search summary). A CSCW 2025 talk notes that fact-checks and flags can feel "biased or paternalistic" ([UDel talk](https://sensifylab.cis.udel.edu/docs/Prerana-Spotting%20Online%20News-CSCW%20Talk-2025.pdf); search summary only).
- There is no named user in the description ("everyday use", "worldwide"). Kia's and Otto's first questions ("who cares enough to use it", "why use it again", 00-rules-and-jury.md §5) have no answer yet.

### 2.3 Beats the incumbent (40)
- **Broadcast and live audio.** Factiverse sells live fact-checking that transcribes video, audio and broadcasts, detects claims and cross-references them. TechCrunch reports it fact-checked the US presidential debates for media partners ([TechCrunch](https://techcrunch.com/2024/11/17/norwegian-startup-factiverse-wants-to-fight-disinformation-with-ai); [LiveFC paper](https://arxiv.org/html/2408.07448v2); search summaries).
- **Wearable, conversational.** Two research prototypes already do almost exactly this flow: speech → claim detection → web evidence → a discreet alert. MIT Media Lab's FactNudger ("Feeling the Facts", CHI 2026) runs on Android and Wear OS and reached a correct verdict on **77%** of 125 real fact-checked claims ([MIT Media Lab](https://www.media.mit.edu/projects/feeling-the-facts/overview/); search summary). "Factually" ([arXiv 2504.17204](https://arxiv.org/abs/2504.17204), opened) uses vibration on a watch or ring. Both chose haptics on a watch rather than glasses. The glasses' edge is the visual card with sources and the camera for seen text, which is real but incremental.
- **On demand.** Pulling out a phone and asking a chatbot with web search, or asking a voice assistant, already covers the "is that true?" moment for the people motivated enough to ask. Whether Meta AI on the glasses does live web search for that question is unknown; I did not verify it.
- **Jev's role.** Per TypeSafe's docs, Jev returns typed judgments and probabilities over the state you provide. It does "not write replies … or generate explanations", and the page mentions no world knowledge or web search ([System One](https://docs.typesafe.ai/concepts/system-one.md), opened; latency figures not given, unknown). Jev can therefore do the *checkable claim?* and *does this retrieved evidence support or refute it?* steps. The truth itself comes from the web and database retrieval. That is a sensible architecture, but it is the same one as FactNudger and LiveFC, so it is not a moat.

### 2.4 Believable next step (40)
- The consumer path ("everyone, worldwide") has no buyer and no pilot. Subscription demand for personal fact-checking is unverified (unknown).
- There is a believable institutional pilot, but the idea does not name one. Fact-checking organisations (Faktabaari in Finland, Factiverse's partners such as Factchequeado per [Factchequeado](https://factchequeado.com/novedades/20240626/factchequeado-announces-a-collaboration-with-factiverse-to-leverage-cutting-edge-technology-in-the-fight-against-mis-and-disinformation), search summary) or newsrooms covering live events. None have been contacted.
- The display and gesture flow narrows deployment. Pop-ups need Ray-Ban Display; DAT Display apps are a "single integration" across devices, but only Display has the lens. Finger gestures need Neural Band through the **beta** Inputs capability, where "every error ends the stream" and inputs stop after re-donning (feasibility.md §3, §5). The audio-only fallback (spoken alert, or reading sources aloud) works on RBM Gen 2, but reading out URLs or sources while someone is talking to you is poor UX.

### 2.5 Trust that survives use (25)
- This is the weakest point. A wrong "misinformation" flag on something a family member just said is a social and political event, not a minor error. With roughly 1 in 4 wrong verdicts on curated claims (FactNudger's 77%, which is a different system and only a reference point), a daily user would see false flags every day (estimate).
- Contested claims (politics, health) will make the tool look partisan to some users, which matches the "biased or paternalistic" finding above. False negatives silently imply that a claim is true.
- Consent: other people's speech is processed by a cloud service, though not identified. That is within the AUP, which bans identifying people, not listening ([AUP](https://wearables.developer.meta.com/acceptable-use-policy), via feasibility.md §6). It still collides with the brief's "appropriate consent" (CHALLENGES.md:L902, L906) for bystanders who never agreed.

## 3. Hard-reject check

**Not a hard reject.**
- **Mandatory requirements:** an audio-first DAT version satisfies the brief, with display as optional (CHALLENGES.md:L898).
- **SDK capability:** the core loop of mic, phone ASR, retrieval, Jev and a spoken alert runs on GA capabilities. Capturing others' speech well and gestures both depend on beta features (see above), which weakens the idea but does not block it.
- **Working demo:** a demo is possible with a seeded claim.
- **Existing product:** close but not identical. Factiverse covers broadcasts and FactNudger is a research prototype on a watch, so there is no shipping glasses product I could find. This is the same reasoning I used for keeping `heads-up-sounds` out of hard reject.

## 4. Placement and overlap

- **Rank: 14th of 18** (37). It sits above `show-me-once` (35), `cross-contact` (34), `heads-up-sounds` (30) and `which-way-now` (28), and below `private-hand` (38).
- **Closest existing candidates:** none is a fact-checker. The shared engine is "read what the wearer sees and judge it against reference data": `basket` (labels judged against an allergen list) and `which-way-now` (a board judged against your trip). On the listening side, `table-talk` processes companions' speech and runs into the same social cost at every use. The most similar *repeat-value* problem is `heads-up-sounds`: a capable incumbent and an all-day-wear assumption.

## 5. Strongest objection

The users who would switch it on don't need it, and the users who need it won't wear it. Each daily use runs ambient listening on the people around you, and puts a ~1-in-4 chance of a wrong "misinformation" verdict (an estimate from the closest research prototype) in front of you mid-conversation. So the habit dies after the novelty, and the "cut misinformation worldwide" claim has no mechanism.

## 6. Variant that would score highest on this lens

**"Press Pass": a hands-free claim log for journalists and fact-checkers at live events** (press conferences, election debates, council meetings). Changes from the original:
- **Narrower user:** a reporter or fact-checker whose *job* is to catch checkable claims as they are spoken. The trigger is daily for political and local-government reporters, and it does not rely on consumer motivation.
- **Different input:** the speaker at the podium (one source, a public setting, a public statement, so no consent problem with private conversations). The camera adds slide or chyron text. On-demand capture is the primary mode: a tap on the glasses means "check the last 30 s". This avoids running all-day ambient listening, the 1-minute Speech stop and the battery cost.
- **Different output:** no verdict pop-up. Jev picks the checkable claims from the transcript and ranks retrieved evidence by support or refutation. The Display shows, or audio speaks, one line: "claim logged, 2 sources disagree". The full claim list with sources lands on the phone or in the newsroom tool for the reporter's follow-up question or article. A human makes the final call, so false positives cost little.
- **Next step:** a pilot with Faktabaari or a Finnish newsroom at a municipal or parliamentary press event (not contacted). The incumbent is Factiverse on broadcast streams, and the gap is non-broadcast, in-room events.
- **Score for this variant: about 52 (estimate)**, which would place it 6th-7th. The trigger rises to about 60 and the next step to about 60. Trust rises to about 55 because a human stays in the loop. Severity stays moderate (about 45), since it saves journalist time rather than solving a personal harm. Beats-incumbent is about 45, because Factiverse and LiveFC could extend to this. It is still below `did-i` and `panel-reader`, because the user base is small and the 10x over a laptop running LiveFC in the press room is unproven.

A consumer alternative is a **pull-only "Is that true?" button** for health claims heard from salespeople or at the pharmacy, aimed at older adults. It scores about 42 (estimate): the trust and consent problems are fixed, but the trigger becomes occasional.

## Sources opened or searched for this report
- CHALLENGES.md:L878-946; 00-rules-and-jury.md §5, §7; 05-evaluation/skeptical-investor.md; 05-evaluation/_top5.md; 04-ideas/_candidates.md (headings); 02-research/ai-glasses/feasibility.md; competitive.md.
- TypeSafe [System One](https://docs.typesafe.ai/concepts/system-one.md) (opened).
- [Factually, arXiv 2504.17204](https://arxiv.org/abs/2504.17204) (opened); [MIT Media Lab, Feeling the Facts / FactNudger](https://www.media.mit.edu/projects/feeling-the-facts/overview/) (search summary).
- [TechCrunch on Factiverse](https://techcrunch.com/2024/11/17/norwegian-startup-factiverse-wants-to-fight-disinformation-with-ai), [LiveFC paper](https://arxiv.org/html/2408.07448v2), [Factchequeado x Factiverse](https://factchequeado.com/novedades/20240626/factchequeado-announces-a-collaboration-with-factiverse-to-leverage-cutting-edge-technology-in-the-fight-against-mis-and-disinformation) (search summaries).
- [Nieman Lab on the NewsGuard extension experiment](https://www.niemanlab.org/2022/05/do-browser-extensions-keep-anyone-away-from-fake-news-sites-maybe-on-the-edges-a-tiny-bit/), [CSCW 2025 talk (UDel)](https://sensifylab.cis.udel.edu/docs/Prerana-Spotting%20Online%20News-CSCW%20Talk-2025.pdf) (search summaries).

<!-- complete -->
