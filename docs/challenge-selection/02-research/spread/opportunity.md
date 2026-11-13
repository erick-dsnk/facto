# Spread (Bahn Express): opportunity discovery (Agent C)

**Summary**
- Spread is a simulation game played over an API. Our bot runs one week of a Finnish car-transport company. It quotes dealers against a hidden competitor, then pays freelance drivers through gigs. The score is gross margin, and at least 90% of orders must be on time (CHALLENGES.md:L365-369). The top 10 by margin in one live level-8 final go to a jury, which then judges only how **elegant, clear, creative and robust** the system is (CHALLENGES.md:L381-383; https://spread.bahnexpress.com/judging).
- The biggest gap is that the game's two decisions, the dealer quote and the driver fee, are coupled through one scarce resource: drivers in a given town at a given hour. The starter and the obvious approaches treat the two decisions separately. A single **shadow price of driver capacity** that drives both is the most elegant direction we found. The sponsor's docs hint at it without spelling it out.
- Other open directions: steering the competitor and dealer trust on purpose; fee schedules designed against drivers who learn; a multilingual note reader graded against ground truth (practical only now, with LLMs); and using `fork` to explain counterfactual decisions as evidence.
- Overall-jury fit is weak to moderate (estimate). This is a sponsor simulation with a slides-only jury, and it is hard to make legible at a peer-review table. The partner-challenge fit is strong. Stacking is honest only for a few tech challenges: Codex, Gemini or Gemma for the note reader, and possibly Vultr hosting.

Sources opened for this report: CHALLENGES.md:L355-408; https://spread.bahnexpress.com/kit/HANDBOOK.md (read in full); https://spread.bahnexpress.com/kit/RULES.md (sections searched); https://spread.bahnexpress.com/judging (read in full); https://spread.bahnexpress.com/v1/leaderboards/practice?level=8 (live JSON, read 21:57 Fri 13 Nov). Also the reports from Agents A, B and D in this folder and in `01-challenge-intelligence/spread.md`.

---

## Context a teammate needs (facts)

- Dealers send about 1,000 price requests a week. Each request has 15 world minutes to answer, which is 4.5 real seconds in the final (HANDBOOK "The final"; https://spread.bahnexpress.com/how via Agent B). For each request the dealer compares our price with a hidden competitor's price (HANDBOOK "Dealers compare prices").
- After a win we post a gig with a fee schedule that never falls, 1 to 48 steps, or we send a direct offer to one driver (HANDBOOK "The game", "Direct offers").
- Level 8, which is the final's level, has about a third of the normal number of drivers. The shortage is spread unevenly across towns. Competitor prices sit 26-54% above list. Each week also has an unannounced outage, flu and bulk order, and a 20%-off price war on one day. Dealers accept up to 25% higher prices from us after on-time deliveries (HANDBOOK "Levels", "The shortage", "Dealer trust").
- The starter loses €72,612 on seed `spread-1` at level 8 and is not ranked (HANDBOOK "The first 15 minutes").
- Live state on the level-8 practice leaderboard at 21:57 Friday: House best has €60,449 over five weeks. The best student team, "Bob the builders", has €40,273 and is ranked on all five weeks. "Upsala" has €31,695 but is unranked because one week came in at 86.6% on time (leaderboard JSON). Strong teams are already active two and a half hours into the event.

---

## Opportunity 1: one shadow price for driver capacity that drives both the quote and the fee

**Gap.** The game has two decisions, the dealer price and the driver fee, but one bottleneck: drivers who can reach a given pickup at a given hour. The starter quotes list price and posts at the typical fee plus a fixed escalation, with no link between the two (HANDBOOK "The first 15 minutes", items 1-2). The obvious ideas Agent B lists (tuned markup, tuned fee schedule, LLM per quote) also keep the two decisions apart. No visible approach puts a price on the opportunity cost of using a well-placed driver. That cost is "cost to move this car" plus "what this driver could have earned us on another order".

**Evidence that it matters.**
- "To win all requests is a mistake for two reasons. The bad orders lose money. The extra orders also use your well-placed drivers, so your good orders cost more." (HANDBOOK "Dealers compare prices")
- "The competitor knows nothing about your drivers, your other orders or your timing. That is your advantage." (same section). This is the sponsor stating outright where the edge lies.
- "A system that wins every car it can is not ranked." The shortage varies by town and is new in every world (HANDBOOK "The shortage"). A static markup cannot track that.
- Some drivers are visible: "You see the position of a driver while that driver works one of your gigs. Thus you know where your drivers finish." A second gig for a driver already on one "costs only the extra time and tickets" (HANDBOOK "The cost of a gig depends on where the driver is"). This **live location of our own drivers is an underused signal** for both pricing and the choice of who gets a direct offer.
- The 90% on-time rule is a hard constraint. The capacity price is its natural Lagrange multiplier (our framing): raise it when the projected on-time share drifts toward 90%. Single-week variance is real. Upsala's 86.6% run and House best's 90.05% run were both close to the line (leaderboard JSON).

**Why the sponsor would care (inference).** Quoting with live knowledge of driver supply is the real dispatcher's job: Bahn quotes fixed prices at order time and pays freelancers through an app (Agent A, citing bahnexpress.com). A capacity-priced quote carries over directly to their business. It also matches "Elegant: a simple idea that does a lot of the work" (judging page).

**How it reads to the overall jury (estimate).** It is the strongest "distinctive insight" angle: one number per town and hour that explains every accept, decline and fee. It plots well as a heatmap of Finland over the week, which helps legibility. The user is specific: a Bahn dispatcher. The jury will still see a simulation.

---

## Opportunity 2: steer the competitor and farm dealer trust as a deliberate strategy

**Gap.** Most teams will treat the competitor as noise to estimate (Agent B: "online learning of competitor price"). The docs say the competitor **reacts to us**, and at level 8 dealers **reward** our reliability. That turns the game into a portfolio problem over dealers. Which dealers do we concentrate on to build trust, and at what win share does the competitor start cutting its prices for them? We found no approach that treats this as a policy instead of a side effect (Agent B found no public solutions at all).

**Evidence.**
- "Each morning it looks at each dealer's recent requests. Where you won most of them, it lowers its prices for that dealer. Where you won few, it raises them." Each team plays its own copy of the competitor, so "it answers only your wins" (HANDBOOK "Dealers compare prices").
- Dealer trust: +1% accepted price per on-time order, up to +25%. A late order halves that dealer's count (HANDBOOK "Dealer trust"). Losing a quote costs nothing, and leaving a request unquoted costs a little goodwill (same).
- Regime events that are not announced but can be detected from our own win and loss stream: the outage (dealers in one region turn to a backup about 30% above the competitor, 08:00-18:00) and the price war (competitor 20% below usual everywhere for one day) (HANDBOOK "Levels", "The shortage"). The competitor's lane factor has a part that "is almost the same in every world", which can be learned across practice worlds (same).
- Win and loss outcomes are censored binary data. "No reveal gives the competitor's price" (HANDBOOK "Research"). Learning from this is a classic censored or logistic estimation problem. The INFORMS dynamic-pricing-with-competition literature (Agent B: https://arxiv.org/abs/1804.03219) is directly relevant.

**Why the sponsor would care (inference).** In real car logistics, repeat dealers and reliability-based pricing power are commercial levers. A system that shows "protect trust at dealer X, give up volume at dealer Y" is a business insight, and the jury explicitly wants "a new way to see the dealers" (judging page, "Creative").

**How it reads to the overall jury (estimate).** It reads as "game theory against an adaptive rival", which is interesting but abstract. A timeline showing the moment the bot detected the price war and stopped chasing it would be a clear before/after for a peer reviewer.

---

## Opportunity 3: fee mechanisms designed against drivers who learn

**Gap.** The starter's escalation of +10% per hour up to 1.5×, then steep near the deadline, is exactly the pattern the docs say gets exploited. "The obvious idea" list includes "raise fees near the deadline to hit 90%" (Agent B). Treating the drivers' app as a mechanism-design problem is an open direction. The driver model is described in unusual detail, which makes it designable.

**Evidence.**
- Drivers keep a belief per team: booked fee over first viewed fee, and minutes to booking. "A system that always raises its fees teaches drivers to wait. A repost at a higher fee counts as a raise." (HANDBOOK "Drivers learn your fees")
- "A raise does not notify". Notifications reach only drivers within 30 km of the first pickup, and no one reads them from 23:00 to 07:00. A driver hears of each order once (HANDBOOK "Drivers see a gig, then decide"). Timing the post matters as much as the fee.
- Direct offers "save most on gigs whose fee drivers expect to rise". The limits are three per driver per day and three open per gig, and an offer lasts 10 minutes (HANDBOOK "Direct offers"; RULES.md "Direct offers", L91-97). This is an **underused tool**: the starter never sends offers (HANDBOOK, starter list).
- Multi-car gigs and trade-in pairing are allowed up to 12 hours of driving, and "a gig that ends near a driver's home, or near their next pickup, is cheap for that driver" (HANDBOOK "The game", "The cost of a gig…").
- A fee that "only just pays a driver gets more drops" (HANDBOOK "Drivers drop bookings…"). Holding a booking longer raises the drop risk, so posting early is not free either.
- The reveal gives `views.csv` (who saw which fee, when) and `gigs.csv`. A per-lane booking-hazard curve can be fitted from our own data (HANDBOOK "Research").

**Why the sponsor would care (inference).** Fee-setting for freelance drivers is Bahn's core marketplace problem. "How you set fees" is named as a good presentation topic (judging page).

**How it reads to the overall jury (estimate).** It is relatable: "we stopped training our gig workers to wait". It touches gig-economy fairness and efficiency. Shown alone it is a medium-depth story. It is stronger as one of two ideas under Opportunity 1.

---

## Opportunity 4: a multilingual note reader graded against ground truth (only practical now)

**Gap.** Dealer notes in Finnish, Swedish and English change ready times, hours, deadlines, licence and plate needs, and tyres. "The world does what the note says, whether or not your system reads it." The starter reads only clock times near a few keywords (HANDBOOK "Notes change what happens"). Agent B warns that note parsing **alone** is an obvious idea. What is uncommon is a reader that is **measured** (precision and recall against `legs.csv` truth), sits off the 4.5-second critical path, and has its margin effect ablated.

**Evidence.**
- Notes come "in paraphrase, with abbreviations and typos, sometimes in two languages, with corrections". "A reader of the common phrasings reads most notes but not all. The reveal says what the note of each order that you won meant, so you can measure your reader." "A system that reads notes well makes more money." (HANDBOOK "Notes change what happens")
- The failure costs are concrete. A failed visit costs half the car's share of the fee, at least €25. A missed tighter deadline counts as late (HANDBOOK "Events", `visit_failed`; notes table).
- Latency constraint: 4.5 real seconds per request in the final, with 20 actions/s (HANDBOOK "The final", "Limits"). That suggests an LLM (or small model) used offline to label, or distilled into rules and a cache, with an asynchronous fallback. Whether outside LLM calls are allowed during the final: **unknown** (Agent D, question 1 for the booth).

**Why now (estimate).** Reading messy Finnish and Swedish dealer shorthand into structured constraints was impractical for a weekend team before current LLMs. It is now cheap. Having **ground truth for every won leg** makes it one of the few hackathon NLP components that can be graded honestly.

**Why the sponsor would care (inference).** Reading free-text dealer instructions is real dispatcher toil at a Finnish company serving FI, DK and DE dealers (Agent A).

**How it reads to the overall jury (estimate).** This is the most immediately legible piece for a peer reviewer: a messy Finnish note on the left, structured constraints on the right, and "failed visits fell from X to Y". It is also the honest hook for the Gemini or Gemma tech challenges.

---

## Opportunity 5: counterfactual evidence with `fork`, and an agent-driven research loop

**Gap.** The judging page asks for "Your margin and on-time share with the idea and without it, on the same weeks". It also warns that a change alters the rest of the week, so comparisons need several seeds (judging page; HANDBOOK "Practice tools"). Most teams will show one leaderboard number (estimate). Two capabilities are underused:
- **`fork`** copies a world "with the same future draws", so you can try two decisions on the same future (HANDBOOK "Practice tools"). That allows per-decision attribution, such as "taking this car cost us €X downstream". It is more precise than whole-week ablations, and it is a natural "why did the bot do that?" explainer.
- **Deterministic seeds plus reveal CSVs** allow an automated experiment loop in which coding agents propose a change, run it over 20+ seeds, and keep or drop it. Agent B notes that a #2 finisher in a Paradigm simulator contest described a similar "autoresearch" loop (https://dev.to/octavic/i-placed-2-in-a-prediction-market-challenge-using-autoresearch-9j, snippet only).

**Evidence of constraints.** There is a maximum of 8 practice worlds, and a fork uses one slot. The practice rate is shared (about 170 req/s at 60 teams) and drops to 20/s during the test finals. Ranking runs cannot be forked or revealed (HANDBOOK "Limits", "Practice rankings"). Throughput is bounded by the server, not by our compute. That is why GPU-heavy tech challenges (Verda, Modal) do not fit honestly.

**Why the sponsor would care.** It is exactly the presentation format they asked for, and "Robust: … show this with results over many weeks" (judging page).

**How it reads to the overall jury (estimate).** It is strong on "honest measured evidence" (15% of the overall rubric, per 00-rules-and-jury.md): a baseline, failure cases, and a metric the sponsor's server computes so it cannot be gamed. It is weaker on wow unless it is visualised as "the agent found the outage on its own".

---

## Opportunity 6 (supporting): a live run that survives restarts and keeps the on-time rate safe

**Gap.** This is not a headline idea, but it is a gate. The final is a single unattended 34-minute run. Many teams will lose their top-10 place to crashes, 429 storms, or one bad week under 90% (Agent D, section 7). The judging page lists "survives a restart, a slow network and a surprise" as part of "Robust".

**Evidence.** If the system stops, requests go to the competitor. The world keeps going, and the system can restart and rebuild from `snapshot` and `events` (HANDBOOK "The final"). A final request over the limit gets 429 at once (HANDBOOK "Limits"). The server can restart mid-final (HANDBOOK "The client").

**Direction.** Rebuild that is safe to run twice, a single paced sender, a live on-time projection that tightens acceptance (this links to the shadow price in Opportunity 1), and a kill -9 drill during the Saturday test finals at 14:00 and 20:00 (HANDBOOK "Practice tools").

**How it reads to the overall jury (estimate).** It is invisible unless dramatised: "we killed it live during the final and it rebuilt in 5 s" is a credible robustness moment.

---

## Tech challenges an entry here could honestly stack

The challenge facts come from `01-challenge-intelligence/_tech-challenges.md`. The fit judgements are our estimates.

| Tech challenge | Honest? | How |
|---|---|---|
| Best Use of Codex | Yes, low effort | Use Codex agents for the parallel experiment loop (Opportunity 5). It must be genuine development use. |
| Best Use of Gemini API / Gemma | Yes, if the note reader uses it | Offline labelling or a distilled note reader (Opportunity 4), with a written explanation. Gemma, self-hosted and cached, avoids the latency and rule-uncertainty problems. Whether LLM calls are allowed in the final is unknown. |
| Best Use of Vultr | Plausible | Run the final bot on a VM near Stockholm (judging page advice). Whether Vultr has a suitable Nordic region is unverified. |
| Aiven / MongoDB Atlas / Tiger Data | Weak but honest | Store events, reveals and experiment results (time-series events fit Tiger Data). Each is marginal to the idea, so expect low prize odds. |
| Entire, CRACI | Possible | Dev-workflow and CI tooling. It adds overhead during a time-critical weekend. |
| Verda, Modal, Nemotron, ElevenLabs, Cloudinary, Oxylabs, Solana, Arduino, Atech, Context.dev | No | Compute is not the bottleneck (the server's rate limits are), and there is no media, web or hardware need. Forcing them would read as add-ons. |

---

## Estimates (ours, with reasons)

- **Differentiation potential: 6/10.** There is no prior art and the field is bespoke (Agent B). Opportunities 1 and 2 are genuinely uncommon framings that the docs reward ("your advantage", "a new way to see the dealers"). Against that: everyone gets the same kit and docs, strong teams are already near €40k over five weeks, and the core ideas are hinted at in the handbook, so the best teams will converge on similar mechanisms. We would stand out through how clearly we explain and measure the ideas more than through the ideas themselves.
- **Demo potential: 5/10.** The partner jury sees slides or a video, not a live demo (judging page). For peer review there is a strong before/after: starter at −€72k against our bot, a map replay from Bahn's run viewer, a Finnish note turned into constraints, and a timeline of the detected price war. It still takes explaining in 60-90 seconds, and the final happens at 08:00, before the review session.
- **Jury fit (overall): 4/10.** By the rubric: specific user (Bahn dispatcher), fair; distinctive insight and depth, good; measured evidence, excellent (server-scored, ablations); live demo, weak (simulation); peer legibility and wow, weak to fair; path forward, fair (a real company, but the sponsor's world is synthetic). Partner-challenge fit is much higher, about 8/10 by our estimate. Spread suits objective (1), winning the partner challenge, far better than objective (2), winning overall.

<!-- complete -->
