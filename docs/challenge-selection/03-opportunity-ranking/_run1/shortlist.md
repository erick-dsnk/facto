# Challenge shortlist: top 5 plus 2 alternates

**Summary**
- **The five picks are Trusted Trade Agents (Valio Aimo), Make Blueprints Talk (Stoa), Earned Trust in AI Code (Tieto), Decode the Noise (Hostinger) and AI Glasses (Meta).** The first four have the best average rank across the three rankings, and the first three made every ranker's top 6. AI Glasses is the overall-win ranker's #1.
- **Coverage of the objectives.** Partner prize: Trusted Trade Agents (#1). Overall win: AI Glasses (#1). Combined: Trusted Trade Agents (#1), with Blueprints, Earned Trust and Decode the Noise next. Blueprints, Earned Trust and Decode the Noise sit in the top 6 on all three lists.
- **Alternates: Internet Butler (Exa) and Personal Economic Trainer (S-Bank).** Internet Butler is the first substitute for AI Glasses if we cannot get reliable access to a device on site.
- **No challenge failed a hard rejection test on verified evidence.** The four robotics and hardware-kit challenges, plus Spread, Break the Agent, Wikipedia, Web Real-Time, Make Unicorns Real and Rethinking Recruitment, are dropped on score. Several of the robotics challenges have access gates that could turn into hard rejections (details below).
- `valio-aimo` and `trusted-trade-agents` are **one challenge** (CHALLENGES.md:L535-693). It was researched twice, and here it takes one slot.

All ranks and scores come from the three ranking files in this folder: `ranking-challenge-prize.md`, `ranking-overall-winner.md` and `ranking-combined.md`. The resolutions below are my judgement, made from those files and the research reports. Where I say "estimate", I mean it.

## 1. Side-by-side: all challenges across the three rankings

The rank shown is each challenge's position on that list; "=" marks a tie. Mean rank is a simple unweighted average of the three ranks, which I used as a first sort for "high on more than one list".

| Challenge (slug) | Sponsor | Prize rank (score) | Overall-win rank (score) | Combined rank (score) | Mean rank | Decision |
|---|---|---|---|---|---|---|
| Trusted Trade Agents (`trusted-trade-agents`) | Valio Aimo | 1 (75) | 9= (57) | 1 (70.2) | 3.7 | **Pick** |
| Valio Aimo (`valio-aimo`) | Valio Aimo | 1= (75) | 9= (57) | 1= (70.2) | 3.7 | Merged with the row above (same challenge) |
| Make Blueprints Talk (`make-blueprints-talk`) | Stoa | 5 (70) | 3 (60) | 3 (67.2) | 3.7 | **Pick** |
| Decode the Noise (`decode-the-noise`) | Hostinger | 3 (72) | 5 (60) | 5 (66.5) | 4.3 | **Pick** |
| Earned Trust in AI Code (`earned-trust-in-ai-code`) | Tieto | 6= (67) | 4 (60) | 4 (66.8) | 4.7 | **Pick** |
| AI Glasses for Everyone (`ai-glasses`) | Meta | 8= (66) | 1 (65) | 10 (65.2) | 6.3 | **Pick** (overall-win bet, conditional on device access) |
| Internet Butler (`internet-butler`) | Exa | 13 (62) | 2 (61) | 8 (65.2) | 7.7 | **Alternate 1** |
| Personal Economic Trainer (`personal-economic-trainer`) | S-Bank | 12 (63) | 6 (59) | 6 (66.2) | 8.0 | **Alternate 2** |
| Web Is Your Real-Time Database (`web-real-time-database`) | Context.dev | 8= (66) | 11 (56) | 7 (66.0) | 8.7 | Rejected |
| Wikipedia Through Time (`wikipedia-through-time`) | MariaDB | 4 (71) | 12 (53) | 12 (60.5) | 9.3 | Rejected |
| Make Unicorns Real (`make-unicorns-real`) | Cala | 11 (64) | 7 (57) | 11 (60.8) | 9.7 | Rejected |
| Rethinking Recruitment (`rethinking-recruitment`) | City of Espoo | 14 (59) | 8 (57) | 9 (65.2) | 10.3 | Rejected |
| Spread (`spread`) | Bahn Express | 8= (66) | 13 (46) | 14 (51.0) | 11.7 | Rejected |
| Break the Agent (`break-the-agent`) | AfterQuery | 6= (67) | 16 (43) | 13 (57.8) | 11.7 | Rejected |
| Robot Teleoperation (`robot-teleoperation`) | Rokoko | 16 (55) | 14 (44) | 15 (50.8) | 15.0 | Rejected |
| Intel Physical AI (`intel-physical-ai`) | Ignite Next x Intel | 15 (56) | 15 (43) | 17 (47.5) | 15.7 | Rejected |
| Green European Renaissance (`green-european-renaissance`) | Arduino | 18 (48) | 17 (40) | 16 (49.0) | 17.0 | Rejected |
| Aaltonomous Humanoid (`aaltonomous-humanoid`) | Aalto University | 17 (53) | 18 (30) | 18 (40.5) | 17.7 | Rejected |

The five picks are exactly the five best mean ranks (once the duplicate is merged). This was a check, not the method: I made each pick on the reasons below.

Two caveats from the rankers that apply to every row. On the overall-win list, ranks 2-11 are within 5 points. On the combined list, ranks 3-10 are within 2 points. Both rankers say to read these bands as ties (ranking-overall-winner.md, Caveats; ranking-combined.md, Summary). The choice of idea inside a challenge matters more than the order within a band.

## 2. The five picks

| # | Challenge | Objective(s) served | Prize (cited) | Why it is on the list |
|---|---|---|---|---|
| 1 | **Trusted Trade Agents (Valio Aimo)** | Partner prize (#1), combined (#1) | €4,000 / €2,000 / €1,000 cash (CHALLENGES.md:L681-693) | Largest cash prize among the software challenges. The rubric rewards the end-to-end demo (30%), autonomy and controls (20%) and exceptions (15%) (L659-679), which suits our agent and deterministic-core build style. The mock API was verified live, is deterministic, and handled 25 parallel calls without throttling (trusted-trade-agents/feasibility.md). The sponsor's data has measurable traps: 62 of 250 substitution pairs change allergens, there are sentinel stock values, and some cut-offs have already passed (trusted-trade-agents/opportunity.md, valio-aimo/opportunity.md). Those traps give a naive-vs-guarded benchmark that scores with Valio and also with the jury's "measured evidence" criterion. Weak spot: peer-floor legibility (overall rank 9). |
| 2 | **Make Blueprints Talk (Stoa)** | All three (prize 5, overall 3, combined 3) | €1,000 + work trial at Stoa / €750 / €250 (L1614-1624) | Highest raw jury-rubric score in the field (80%, ranking-overall-winner.md). The rubric of accuracy, visual evidence, creativity and cost at 25% each (L1607-1610) is close to the jury's evidence lens. The feasibility spike matched 7/7 IFC counts, 5/5 room areas and 65/65 DXF windows (make-blueprints-talk/feasibility.md). Verda stacks naturally. Weak spots: 67% of the public questions are raster symbol counts that need a detector, the evaluation protocol is unknown, and the cash prize is small. |
| 3 | **Earned Trust in AI Code (Tieto)** | All three (prize 6=, overall 4, combined 4) | €2,000 / €1,000 / €500 (L259-269) | Our own daily domain. Measurement (25%) and Evidence (20%) (L241-255) match the jury's lens. The sponsor repo gives a legible before/after: on branch ju26-issue-2297 (237 files, L149), 222 files reduce to 3 distinct lines plus 1 anomaly (earned-trust-in-ai-code/opportunity.md). Codex stacks honestly. Weak spots: high expected interest from other teams, Tieto weights the concept over the implementation (L151), and **there is no feasibility report** (the file is missing), so its feasibility scores are the rankers' estimates. |
| 4 | **Decode the Noise (Hostinger)** | All three (prize 3, overall 5, combined 5) | €2,000 / €1,000 / €500 + hosting (L83-97) | The safest build on the list (feasibility 9/10, demo reliability 8/10, decode-the-noise/feasibility.md). Detection quality is 40% of the score (L76-79), which rewards an ML team with an honest evaluation: precision, false-positive rate and abstain rate against a baseline. The mandatory live Hostinger deployment (L29) is easy for us and filters out weaker teams. Weak spots: whether traffic-bot detection counts as on-theme next to propaganda is unknown, and the shared AI Router credits are of unknown size. |
| 5 | **AI Glasses for Everyone (Meta)** | Overall win (#1) | One award: Ray-Ban Meta glasses for each member of the winning team (L939-943); possible invite to Meta's AI forum on 18 Nov (L908) | The only challenge where the demo is the pitch. Peers understand a wearable demo in seconds, and peer review is the gate to the jury (00-rules-and-jury.md §3, §7). Meta's four equal criteria (L934-937) mirror the jury's, it plays to our mobile skills, and the Gemini API tech challenge (€4,000 first prize) stacks naturally. **Conditional:** the devices are shared, 10 Ray-Ban Display plus 10 RBM Gen 2 (L914-915), and how they are allocated is unknown. The feasibility report is an unfinished draft of 13 lines ending in a TODO (I opened 02-research/ai-glasses/feasibility.md). Meta's docs, as cited in that draft, say Web Apps have no camera or mic access, so a perception idea has to use the phone-side Device Access Toolkit. |

**How the five spread the risk.** Four are pure software with feasibility at or above 8/10 where a report exists. One (AI Glasses) is a consumer device with an access gate. Two are safe partner-prize bets (Valio, Decode the Noise). Two are evidence-heavy bets that serve both objectives (Blueprints, Earned Trust). One has a high-variance overall-win upside (AI Glasses).

## 3. Alternates

| Alternate | Ranks (prize / overall / combined) | When to promote it | Reason |
|---|---|---|---|
| **1. Internet Butler (Exa)** | 13 / 2 / 8 | If Meta cannot guarantee device time on Friday night, swap it in for AI Glasses as the overall-win bet | Overall #2: a relatable errand with an easy before/after, dated sources against a stale bare LLM, built around the Finnish lease-law change of 1 Oct 2026 (internet-butler/opportunity.md). Pure software, with $2,500 cash plus Exa credits for 1st (L759-775). Its partner odds are poor because the field is saturated (competitive report: "high"), and 20% of the score is judges' own live queries (L757). |
| **2. Personal Economic Trainer (S-Bank)** | 12 / 6 / 6 | If a pick collapses on site (for example Tieto's repo will not build, or Hostinger rules traffic bots off-theme) | Combined #6 and overall #6: a specific user, a clean dataset and an S-mobiili path (L2042-2095). Verda names a banking coach (L2142). Prizes are gift cards, €2,000 for 1st (L2099-2109). There is **no competitive report**, so how crowded it is remains unknown. |

## 4. Rejected challenges

I found **no verified hard rejection**. For every challenge, the sources show a route by which we could meet the mandatory requirements and get a working demo. The robotics rows carry gates that would become hard rejections if they fail on site (marked "gate"). Everything below is rejected on score.

| Challenge | Ranks (P / O / C) | Reason |
|---|---|---|
| `valio-aimo` | same as Trusted Trade Agents | Duplicate of pick #1, not a separate challenge (CHALLENGES.md:L535-693). |
| Web Is Your Real-Time Database | 8= / 11 / 7 | Close to the line, mid-pack everywhere. Monitor ideas are highly saturated. Plan limits conflict: the text promises "no rate limit" (L2797), but the docs list the Free plan at 10 rpm, and there is a 10-minute monitor floor (web-real-time-database/feasibility.md). Its stacking strength (Best Use of Context.dev) does not make up for that. |
| Wikipedia Through Time | 4 / 12 / 12 | Strong partner odds (an underused MariaDB showcase) but a weak specific user and path forward for the jury. The M load and L embedding are unbuilt slip risks (wikipedia-through-time/feasibility.md). This is the one to revisit if the team decides to weight partner odds alone. |
| Make Unicorns Real | 11 / 7 / 11 | Saturated investor-tool space. Cala's free plan allows 10 rpm, and queries can take up to 180 s, so it is about 4/10 fully live (make-unicorns-real/feasibility.md). The 1st prize is non-cash (L289, L345-351). |
| Rethinking Recruitment | 14 / 8 / 9 | Low technical depth for the jury, and the rubric is 45% impact (L1870-1880). It has no sponsor tech, and only the opportunity report exists. |
| Spread | 8= / 13 / 14 | Jury access requires a top-10 finish by margin among about 64 teams, estimated at 50-65% (spread/feasibility.md). Under 90% on time means not ranked. A simulation is hard to pitch at the peer table. |
| Break the Agent | 6= / 16 / 13 | Research risk: there may be no stable, fair gap by about hour 14. It cannot be read at a table, and it has no end user (break-the-agent/feasibility.md, opportunity.md). |
| Robot Teleoperation | 16 / 14 / 15 | **Gate:** manual approval of the SDK licence by Rokoko reps (L1094-1097), and an unknown number of glove kits. Gear-only prizes (L1129-1139). Real-robot teleop is estimated at about 3/10. |
| Intel Physical AI | 15 / 15 / 17 | **Gate:** 25 stations with an unknown allocation process (L981). Only about 2 record-and-train iterations fit, and a live run on shifted bricks is about 50% (intel-physical-ai/feasibility.md). Physical robot work is a team weakness. |
| Green European Renaissance | 18 / 17 / 16 | Embedded prototyping is a team weakness. A working physical prototype is 20% of the score (L860), and a Project Hub post is mandatory (L820). The feasibility report is unfinished. |
| Aaltonomous Humanoid | 17 / 18 / 18 | **Gate:** a strict sim gate, and only about 5 teams reach the real robot (L1271-1277). The real-world result is 40% of the score and is an organiser-run episode we cannot rehearse. Difficulty 8. |

## 5. Disagreements between rankers and how I resolved them

1. **Trusted Trade Agents: #1 for prize and combined, #9 for overall.** The overall ranker scored peer legibility 2.5/5: "B2B procurement is dull at a peer table". Resolution: keep it as the partner-prize and combined anchor, not as the overall-win bet. Both reports say the fix for the overall lens is a kitchen-buyer persona plus a visible block-or-approve moment (valio-aimo/opportunity.md). Idea generation should test that framing.
2. **AI Glasses: #1 for overall, #10 combined, #8= prize.** The combined and prize rankers marked it down for a single non-cash prize (L943) and unknown device access. I opened the feasibility file: it is a 13-line draft with source notes and a TODO, so its feasibility number is unverified. Resolution: include it, because the shortlist must contain the strongest overall-win pick and no software challenge comes close on peer legibility. Make it **conditional**: if Meta cannot confirm device time on Friday night, promote Internet Butler. A finished feasibility pass (DAT streaming latency, permissions) should come before the final choice.
3. **Internet Butler: #2 for overall, #13 for prize.** Both rankers agree the category is saturated. They differ only because saturation hurts a partner prize directly, while for the overall win it hurts only through "looks like other tables". Resolution: alternate 1, the substitute for the overall-win slot.
4. **Wikipedia Through Time: #4 for prize, #12 on the other two.** Resolution: rejected. The shortlist already holds three stronger partner-prize bets that also score on the jury lenses. Wikipedia's specific user is the weakest of the software options.
5. **Break the Agent and Spread: #6= and #8= for prize, bottom third for overall.** Resolution: rejected. Both have rigorous rubrics but have research or gate risk (no stable gap; top-10 margin gate) and poor peer-floor legibility.
6. **The duplicate Valio slug.** All three rankers flagged that `valio-aimo` and `trusted-trade-agents` are one challenge. Resolution: merged into one pick. The research from both folders should be read together: `trusted-trade-agents/` has the competitive report, and `valio-aimo/` has the live API probes.

## 6. Open questions to ask sponsors and organisers before the final choice

**Organisers (affects all picks)**
- Can one project enter more than one main challenge? (unknown, 00-rules-and-jury.md §4)
- Is peer review cross-track? What is the review quota, and is there a penalty for not reviewing? (unknown, §3)
- What format do top-5 pitches use (live demo or slides), and how long are they? What does the Friday 23:59 preliminary submission require?

**Valio Aimo (Trusted Trade Agents)**
- Should teams build their own order, quote and approval layer, or is an order endpoint coming? Is there an expected order format?
- What do the 9999999999 sentinel and the past `closingTime` values mean? May the demo use a simulated "now", since the Monday-delivery cut-off is Sun 15 Nov 17:00, during judging?
- What are the rate limits and API uptime through Sunday judging? Will judges use our laptop, a hosted URL, or run it themselves?
- Do they prefer a particular standard (MCP, OpenAPI, AP2/UCP-style mandates)? May fixtures from the dataset sit in a public MIT repo?

**Stoa (Make Blueprints Talk)**
- Is there a hidden test set or live questions, and from which sources?
- How is inference cost measured (EUR per question, tokens, GPU time, including training)?
- May we train on the public CubiCasa5K annotations? May we use sibling DXF and IFC files when a question targets the PDF or PNG?
- What is the submission format, and how are free-text answers graded?

**Tieto (Earned Trust in AI Code)**
- Does the sample repo build and run its tests on the agent branches? (This is untested by us: there is no feasibility report.)
- Which requirements set and code standards will be handed out on site (L225-227)? Are the deliverables (concept card, walkthrough, lessons log, video, L155-157) hard requirements?
- Which partner model credits are available (L231)?

**Hostinger (Decode the Noise)**
- Is web-traffic bot detection fully on-theme, or do judges expect propaganda or social-text detection?
- How large are the AI Router credits, what are the rate limits, and which model IDs are enabled? Can we have several keys with spend caps?
- When are the VPS and domain handed over? Does calling an external LLM from the VPS still count as "running on Hostinger"? Can Hostinger share real abuse logs?

**Meta (AI Glasses)**
- How are the 20 devices allocated? Can one team keep a device overnight and for the Sunday demo?
- Do the devices have the SDK, Meta AI app and firmware versions that DAT needs (SDK 1.0.1 requires app V292 and firmware V128, per the feasibility draft's sources)?
- Are there Acceptable Use Policy restrictions that matter, for example on face recognition or bystander capture?
- Does the "Best overall" award mean there are no runner-up places?

**Alternates (only if promoted)**
- Exa: can the team pool its credits and get a higher QPS for the demo? How well does Exa index finlex.fi and kela.fi?
- S-Bank: is a US-hosted LLM acceptable, or is an EU-hosted model expected? Which UI language should the judging demo use? What are the mortgage CSVs for?

<!-- complete -->
