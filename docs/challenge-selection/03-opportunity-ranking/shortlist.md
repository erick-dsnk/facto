# Challenge shortlist: top 5 plus 2 alternates

**Summary**
- **Picks: Earned Trust in AI Code (Tieto), Decode the Noise (Hostinger), Make Blueprints Talk (Stoa), Trusted Trade Agents (Valio Aimo) and AI Glasses (Meta).** The first four have the four best mean ranks across the three rankings. All four are in the top 6 of the challenge-prize and combined lists, and three of them (Earned Trust, Blueprints, Decode) are also in the overall-win top 6. AI Glasses is the overall-win ranker's #1.
- **Coverage.** Partner prize: Decode the Noise (#1) and Trusted Trade Agents (#2). Overall win: AI Glasses (#1) and Earned Trust (#2). Combined: Earned Trust and Trusted Trade Agents (joint #1).
- **Alternates: Rethinking Recruitment (Espoo)** replaces AI Glasses if Meta cannot promise dependable device access on Friday night. **The Web Is Your Real-Time Database (Context.dev)** replaces any software pick that falls apart on site.
- **Hard rejections: none were verified.** Every challenge has a documented route to its mandatory requirements and a working demo. The four robot and kit challenges have on-site access gates (licence approval, station or kit allocation, an organiser-run robot final), and they are rejected on score. `valio-aimo` and `trusted-trade-agents` are one challenge (CHALLENGES.md:L535, L575, one prize table at L681-693) and take one slot.

Ranks and scores come from `ranking-challenge-prize.md`, `ranking-combined.md` and `ranking-overall-winner.md` in this folder. All three are complete runs that used the finished feasibility reports. **This file replaces the earlier draft in `_run1/shortlist.md`**, which was written from older scores and before the Earned Trust and AI Glasses feasibility reports existed. The five picks are the same as in that draft, but the alternates changed (see §5). Where I write "estimate", the number is mine.

## 1. Side-by-side: all challenges across the three rankings

Ranks count the Valio duplicate once, so the rows below have no gaps. Each score is the ranker's own number. The ranking scales differ: prize and combined use weighted 0-100 scores, and overall-win multiplies the rubric score by feasibility and a peer-gate factor. Compare ranks, not raw scores, across columns. The mean rank is an unweighted average, used as a first sort for "high on more than one list".

| Challenge (slug) | Sponsor | Prize rank (score) | Overall rank (score) | Combined rank (score) | Mean rank | Decision |
|---|---|---|---|---|---|---|
| Earned Trust in AI Code (`earned-trust-in-ai-code`) | Tieto | 5 (69) | 2 (64) | 1 (72.5) | **2.7** | **Pick** |
| Decode the Noise (`decode-the-noise`) | Hostinger | 1 (75) | 6 (60) | 3 (69.8) | **3.3** | **Pick** |
| Make Blueprints Talk (`make-blueprints-talk`) | Stoa | 4 (72) | 3 (62) | 4 (68.5) | **3.7** | **Pick** |
| Trusted Trade Agents (`trusted-trade-agents`) | Valio Aimo | 2 (74) | 9 (57) | 2 (72.3) | **4.3** | **Pick** |
| Valio Aimo (`valio-aimo`) | Valio Aimo | = row above | = row above | = row above | n/a | Merged (same challenge) |
| AI Glasses for Everyone (`ai-glasses`) | Meta | 8 (65) | 1 (65) | 9 (62.8) | 6.0 | **Pick** (conditional on device access) |
| The Web Is Your Real-Time Database (`web-real-time-database`) | Context.dev | 7 (66) | 10 (55) | 5 (67.8) | 7.3 | **Alternate B** |
| Rethinking Recruitment (`rethinking-recruitment`) | City of Espoo | 13 (60) | 4= (61) | 6 (67.0) | 7.8 | **Alternate A** |
| Internet Butler (`internet-butler`) | Exa | 12 (62) | 4= (61) | 8 (65.3) | 8.2 | Rejected (close call) |
| Personal Economic Trainer (`personal-economic-trainer`) | S-Bank | 10= (63) | 7 (59) | 7 (66.3) | 8.2 | Rejected (close call) |
| Wikipedia Through Time (`wikipedia-through-time`) | MariaDB | 3 (73) | 11 (52) | 11 (59.3) | 8.3 | Rejected |
| Make Unicorns Real (`make-unicorns-real`) | Cala | 9 (64) | 8 (58) | 10 (60.8) | 9.0 | Rejected |
| Break the Agent (`break-the-agent`) | AfterQuery | 6 (67) | 14= (43) | 12 (57.8) | 10.7 | Rejected |
| Spread (`spread`) | Bahn Express | 10= (63) | 12 (46) | 15 (49.8) | 12.5 | Rejected |
| Robot Teleoperation (`robot-teleoperation`) | Rokoko | 15 (55) | 13 (44) | 13= (50.8) | 13.7 | Rejected (on-site gate) |
| Intel Physical AI (`intel-physical-ai`) | Ignite Next x Intel | 14 (56) | 14= (43) | 16 (48.8) | 14.7 | Rejected (on-site gate) |
| Green European Renaissance (`green-european-renaissance`) | Arduino | 17 (49) | 14= (43) | 13= (50.8) | 14.7 | Rejected |
| Aaltonomous Humanoid (`aaltonomous-humanoid`) | Aalto University | 16 (53) | 17 (30) | 17 (39.8) | 16.7 | Rejected (on-site gate) |

Every ranker warns that its middle band is a statistical tie. On the prize list, places 1 to about 9 are closer than the error in the crowding estimates. On the overall list, places 1-11 span 65 to 55. On the combined list, places 3-9 are within about 4.5 points. So the cut between the fourth pick and the alternates rests on **appearing high on several lists**, not on a single score.

## 2. The five picks

| # | Challenge | Objective(s) served | Prize (cited) | Why it is on the list | Main risk to check on site |
|---|---|---|---|---|---|
| 1 | **Earned Trust in AI Code (Tieto)** | Combined (#1=), overall (#2), prize (#5) | €2,000 / €1,000 / €500 (CHALLENGES.md:L259-269) | Best mean rank. This is our daily work: deciding when a named human can accept an agent-written PR (L124-135). Measurement 25% and Evidence 20% (L241-255) match the jury's "measured evidence" criterion. The sponsor's own branch gives a before/after: on `ju26-issue-2297`, 222 of 237 files reduce to 3 repeated lines plus 1 anomaly (02-research/earned-trust-in-ai-code/opportunity.md). Feasibility 9, demo 8, no proprietary API (feasibility.md). Codex stacks honestly. | Expected interest is "high" (competitive.md). Tieto weights the concept above the implementation (L151), which narrows our engineering edge. The EOL .NET 8 build must work in hour 1 (feasibility.md). |
| 2 | **Decode the Noise (Hostinger)** | Prize (#1), combined (#3), overall (#6) | €2,000 / €1,000 / €500 + 1 year of hosting and a domain (L83-97) | Detection quality is 40% (L76) and the sponsor values "honest" detection and false-positive handling over a polished front end (L29). An ML team with a labelled eval and baseline is favoured. "Clean the traffic" (web-log bot detection) is an official direction (L39; note that the prize ranker cites L35, which is "Spot the swarm"). Lowest-risk build in the set (feasibility 9, demo 8). The Hostinger firewall API as an enforcement actuator is unused (opportunity.md). | VPS and domain handover timing. Shared AI Router credits of unknown size (L52). The live URL on Hostinger is mandatory (L29). Peer appeal is modest ("infrastructure" at a table). |
| 3 | **Make Blueprints Talk (Stoa)** | Even on all three (prize #4, overall #3, combined #4) | €1,000 + work trial at Stoa / €750 / €250 (L1614-1624) | The most consistent ranks of any challenge. The rubric (accuracy, visual verification, creativity, cost at 25% each, L1607-1610) is measurable and close to the jury's evidence lens. A spike on the preview data answered 7/7 IFC counts, 5/5 room areas and 65/65 DXF windows exactly, at about zero cost, with overlays (feasibility.md). Difficulty deters chat-with-PDF teams. Verda stacks strongly. | 67% of questions are raster symbol counts, where VLMs reach about 0.40-0.55, so a trained detector is the riskiest workstream. The eval and cost protocol and the CubiCasa5K training permission are unknown. Smallest cash prize of the picks. |
| 4 | **Trusted Trade Agents / Valio Aimo** | Prize (#2), combined (#1=); weak for overall (#9) | €4,000 / €2,000 / €1,000 (L681-693), the largest software cash pool | The rubric pays for an end-to-end flow (30%, L661-663), controls and audit (20%) and exceptions (15%) (L659-679). The mock API was verified live (trusted-trade-agents/feasibility.md, valio-aimo/feasibility.md). The sponsor's data has measurable traps: 62 of 250 substitution pairs change allergens, lactose-free milk still carries the milk allergen, 46% of products have no allergen data, sentinel stock values, past cut-offs (valio-aimo/opportunity.md). That gives a naive-vs-guarded benchmark which scores with Valio and with the jury. | B2B ordering is hard to read at a peer table, so it needs a kitchen persona and a visible block-or-approve moment. Junction 2025 also had a Valio case, so expect prepared teams (valio-aimo/competitive.md). The Sunday 17:00 cut-off falls during judging, so freeze the demo clock. |
| 5 | **AI Glasses for Everyone (Meta)** | Overall (#1) | One award only: Ray-Ban Meta glasses for each member of the winning team (L939-943), plus a possible Meta AI forum invite (L908) | The only challenge whose demo is understood in seconds at a peer table (peer-legibility 5/5, ranking-overall-winner.md), and peer review gates the jury (00-rules-and-jury.md). Meta's four 25% criteria (L934-937) mirror the jury's. It uses our mobile and streaming skills on a consumer device, not electronics. The Gemini API tech challenge (€4,000 first) stacks naturally. The feasibility report is now complete: build 7, demo 6. | **Conditional.** 10 Ray-Ban Display and 10 RBM Gen 2 are shared (L914-915) and the allocation is unknown. Each pair takes one Meta account and one Developer-Mode app at a time, and capability gating in Finland is unknown. Without dependable glasses, demo reliability falls to about 3/10, and the report says to switch early (ai-glasses/feasibility.md). |

**How the five spread risk.** Four picks are pure software with feasibility 8-9 and demo reliability 8. One is a consumer device with an access gate. Decode and Valio are the safest partner-prize bets. Earned Trust and Blueprints are evidence-heavy builds that serve both the partner and the jury. AI Glasses is the high-variance bet on the overall win.

## 3. Alternates

| Alternate | Ranks (prize / overall / combined) | Promote when | Reason |
|---|---|---|---|
| **A. Rethinking Recruitment (Espoo)** | 13 / 4= / 6 | Meta cannot confirm a registered, capability-enabled pair of glasses that we can keep through Sunday judging | The software challenge with the best overall-win profile that also ranks well on combined. Everyone at a hackathon recognises the problem of AI CVs screened by AI. Impact 45% and UX 35% (L1870-1880). Cash prize plus a presentation to Espoo leaders (L1822-1824, L1884-1894). Feasibility 9, demo 8 (feasibility.md). Verda names a recruitment tool (L2142). Risks: low technical depth draws many teams, and any ranking of people breaches L1806. |
| **B. The Web Is Your Real-Time Database (Context.dev)** | 7 / 10 / 5 | A software pick fails on site: Tieto's .NET build will not run, Hostinger rules traffic bots off-theme, or Stoa forbids the deterministic or CubiCasa route | Best mean rank outside the picks (7.3). Best tech-challenge stacking (Best Use of Context.dev, L2780-2789). The sponsor's CTO sits on the grand jury (recusal unknown). Feasibility 8, demo 8 only if the live change is triggered on a page we control. Risks: saturated watch-diff-alert ideas, a 10-minute monitor floor, and the plan limits in the docs, which conflict with "no rate limit" (L2797). |

## 4. Rejected challenges

**Hard-rejection test.** I checked each challenge for three things: a mandatory requirement we cannot meet, data or hardware we cannot reach, and no path to a working demo. None fails on verified evidence. Three have gates that would become hard rejections if they fail on site, marked **gate** below.

| Challenge | Ranks (P / O / C) | Reason |
|---|---|---|
| `valio-aimo` | = Trusted Trade Agents | Duplicate of pick 4 (CHALLENGES.md:L535, L575). Read both research folders together: `trusted-trade-agents/` has the stronger competitive report and `valio-aimo/` has the live API probes. |
| Internet Butler | 12 / 4= / 8 | Close call against Alternate A. It ties on overall rank but is lower on combined. Saturation is "high". 20% of the score is judges' own live queries (L757), which brings deep-search latency, team-wide QPS limits and unknown Exa coverage of Finnish sites (internet-butler/feasibility.md). Demo reliability is 7, against 8 for Recruitment. |
| Personal Economic Trainer | 10= / 7 / 7 | Close call. It sits in the middle of every list but is not high on any. Saturation is "high" (chat over a CSV), and the prizes are gift cards (L2099-2109). |
| Wikipedia Through Time | 3 / 11 / 11 | Strong for the partner prize (an MariaDB showcase), weak on both other lists: vague user and path forward. The 20% scalability criterion depends on an M loader we would have to write and slow vector inserts (wikipedia-through-time/feasibility.md). Revisit only if the team decides to weight partner odds alone. |
| Make Unicorns Real | 9 / 8 / 10 | Middle of every list. Saturated investor-tool space. The non-cash first prize (L289, L345-351). The 10 rpm free plan and queries of up to 180 s put fully-live demo reliability at about 4/10 (make-unicorns-real/feasibility.md). |
| Break the Agent | 6 / 14= / 12 | Rigorous rubric and good cash, but the research risk is no stable, fair frontier-agent gap by about hour 14, and an RL environment is nearly illegible at a peer table (break-the-agent/feasibility.md). |
| Spread | 10= / 12 / 15 | Jury access needs a top-10 finish by margin among about 64 teams, estimated at 50-65% (spread/feasibility.md). A simulation is hard to pitch to peers. |
| Robot Teleoperation | 15 / 13 / 13= | **Gate:** SDK licence by manual Rokoko approval (L1094-1097), with an unknown kit count. Teams never control the G1 directly (L1241), so it would likely be sim-only. Gear-only prizes. |
| Intel Physical AI | 14 / 14= / 16 | **Gate:** 25 stations with unknown allocation (L981). Only 2-3 policy iterations fit, and a clean judged live run is about 50% (intel-physical-ai/feasibility.md). Physical robot work is outside our strengths. |
| Green European Renaissance | 17 / 14= / 13= | Embedded prototype work, 20% for a physical prototype (L860), a mandatory Project Hub post (L820), and an unknown kit-loan window. Prizes are boards. |
| Aaltonomous Humanoid | 16 / 17 / 17 | **Gate:** a held-out sim top-5 cut, then an organiser-run real-robot final we cannot rehearse (L1241, L1271-1277). About 15-25% chance to reach the robot and do well (aaltonomous-humanoid/feasibility.md). |

## 5. Disagreements between rankers and how I resolved them

1. **AI Glasses: overall #1, prize #8, combined #9.** The prize and combined rankers marked it down for a single non-cash prize (L939-943) and shared-device risk. I opened `02-research/ai-glasses/feasibility.md`, which is now complete. Its go/no-go rests on four booth questions (allocation, pairing, versions, capability gating in Finland), and it estimates demo reliability at 6/10, or 3/10 without dependable glasses. **Resolution:** include it, because the shortlist must carry the strongest overall-win pick and no software challenge matches its peer legibility. Make it conditional on the Meta booth answers on Friday night, with Alternate A as the swap.
2. **Trusted Trade Agents: prize #2 and combined #1=, but overall #9.** The overall ranker scored peer legibility low ("B2B procurement is dull at a peer table"). **Resolution:** keep it as the partner-cash anchor, not the overall bet. Idea generation should test the kitchen-buyer persona with a visible block-or-approve moment, which both opportunity reports recommend.
3. **Decode the Noise: prize #1 but overall #6.** The rankers agree that the eval-heavy rubric favours us. They differ only on peer appeal ("reads as infrastructure"). **Resolution:** pick it. It is in the top 6 everywhere, has the lowest build risk, and the "try to fool it" eval page is its peer hook. I corrected a citation: the "Clean the traffic" direction is at CHALLENGES.md:L39, not L35 as the prize ranking says. The conclusion is unchanged.
4. **Wikipedia Through Time: prize #3, but #11 on the other two.** **Resolution:** reject. The shortlist already holds stronger partner bets (Decode, Valio, Blueprints) that also score on the jury lenses, and Wikipedia has the weakest specific user among the software options.
5. **Rethinking Recruitment vs Internet Butler for the overall-win backup.** They tie at overall 4=. The earlier `_run1` draft picked Internet Butler, but under the current rankings Recruitment is higher on combined (6 vs 8) and on demo reliability (8 vs 7, from the feasibility reports). It also avoids judge-typed live queries (L757). **Resolution:** Recruitment becomes Alternate A. Butler drops out.
6. **Personal Economic Trainer (the earlier draft's alternate) vs Web Real-Time Database.** In the current rankings Web RTDB beats PET on prize (7 vs 10=) and combined (5 vs 7), and loses on overall (10 vs 7). Its mean rank is better (7.3 vs 8.2) and its stacking is stronger. **Resolution:** Web RTDB becomes Alternate B.
7. **Break the Agent and Spread: mid-table for prize, bottom third elsewhere.** **Resolution:** reject. Both have rigorous rubrics but carry research or leaderboard-gate risk and poor peer legibility.
8. **The duplicate Valio slug.** All three rankers flagged it. **Resolution:** merged into one pick.

## 6. Open questions to ask on site before the final choice

**Organisers (affect every pick)**
- Can one project enter more than one main challenge? (unknown, 00-rules-and-jury.md)
- Is peer review cross-track? What is the review quota, and is there a penalty for not reviewing?
- What format and length are the top-5 pitches (live demo or slides)? What does the Friday 23:59 preliminary submission require?
- Do jurors with sponsor ties recuse themselves (Beer/Context.dev, Arturs/Verda, Daksh/AfterQuery, Timo/Stoa)?

**Meta (AI Glasses): ask first, because it decides whether Alternate A is promoted**
- How are the 20 devices allocated? Can one team keep a pair overnight and through Sunday judging?
- Are the glasses pre-paired to Meta accounts or phones, and can we pair them to our own account and phone?
- Which firmware and Meta AI app versions are on the devices? Is Developer Mode on?
- Are DAT camera streaming, Display and the beta capabilities enabled for those accounts in Finland, or will we get `CAPABILITY_DENIED`?
- Is a Gen 2-only (audio-first) demo acceptable? Is on-device bystander face blurring acceptable under the AUP?

**Tieto (Earned Trust)**
- What format do the on-site requirement IDs take, and do they map to the four `ju26-*` branches (L141-149, L225-227)?
- Does a precomputed or replayed walkthrough count as "live" (L156)? Do seeded-defect copies of the branches count as synthetic data (L137)?
- Which partner models and how many credits are available (L231)? May we use our own keys?

**Hostinger (Decode the Noise)**
- Do judges rate web-traffic bot detection as on-theme as propaganda or social-bot detection?
- How large are the AI Router credits, what are the rate limits, which model IDs are enabled, and can we have several keys with spend caps?
- When are the VPS and domain handed over? Does calling an external LLM from the VPS still count as running on Hostinger? Can Hostinger share real abuse logs?

**Stoa (Make Blueprints Talk)**
- Is accuracy judged on a hidden test set, live questions or a self-reported eval, and from which sources?
- How is inference cost measured (euros per question, tokens, GPU time, including training)?
- May we train on the public CubiCasa5K annotations, and use sibling DXF or IFC files when the question targets a PDF or PNG?
- What is the submission format?

**Valio Aimo (Trusted Trade Agents)**
- Should we build our own order, quote and approval layer, or will an order endpoint come later?
- What do the 9999999999 and 999999 values and the past Terminal `closingTime` mean? May the demo freeze "now" before the Sun 17:00 cut-off?
- What are the rate limits and uptime through judging? Will judges use a hosted URL, our laptop, or run it themselves?
- Which standard do they prefer (MCP, OpenAPI, AP2/UCP-style mandates)? May dataset fixtures sit in a public MIT repo?

**Alternates (only if promoted)**
- Espoo: are mutual opt-in, explainable meeting suggestions acceptable under L1806, and is that line a hard disqualifier? Which event stage matters most?
- Context.dev: what are the real rate limit, concurrency and monitor limits after redeeming JUNCTION26? Can run-now monitors give near-real-time triggers, and what is the webhook latency?

<!-- complete -->
