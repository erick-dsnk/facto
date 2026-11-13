# Spread (Bahn Express): competitive intelligence

**Summary**
- Spread is a bespoke sponsor-built simulation with a shared leaderboard, so there are no prior winners, public clones or open-source solutions to copy. I found none (searches below). Rivals are other teams plus Bahn's own "House best" bot.
- Closest analogues are bot-vs-simulator leaderboard contests (Paradigm puzzles, INFORMS dynamic-pricing challenge). Their lesson: adaptive, regime-aware pricing beats a tuned static rule.
- Crowding estimate (estimate, not data): medium. It is a concrete, scoreable, agent-friendly challenge, but it is niche in domain and needs a live-run discipline many teams will skip.
- To stand out, the jury stage rewards elegant, clear, creative, robust (spread.bahnexpress.com/judging). A distinctive submission is a small set of well-ablated ideas, not a big LLM agent.

## 1. Same sponsor and same challenge: prior winners

- Bahn Express: Helsinki car-logistics startup with a freelance driver network, EUR 5M round announced Dec 2025. https://news.cision.com/san-francisco-oy/r/bahn-express-raises--5m-to-rapidly-scale-its-automotive-logistics-platform-across-europe,c4282838 and https://www.bahnexpress.fi/about (seen in search results only, not opened).
- Prior Spread winners: none found. The Spread site mentions none (opened https://spread.bahnexpress.com/ and /llms.txt). Searching "Bahn Express Spread Junction" returned nothing relevant. Status: unknown, probably first run of this format (estimate).
- Prior Junction winners (context): a Wikipedia-derived list credits BREAKDANCE (2024) and WAVELET (year unconfirmed); neither is related to dispatch or pricing. https://en.wikipedia.org/wiki/Junction_(hackathon) (search snippet, page not opened). 2022 final was chosen by peer evaluation plus partner judging: https://view.asiae.co.kr/en/article/2022111311381508794 (snippet only).
- Searches for Junction 2025 agentic-track winners found nothing usable.

## 2. Similar competitions and submissions

| Analogue | What it is | Relevance | URL |
|---|---|---|---|
| Paradigm puzzles (AMM, Prop AMM, Prediction Market) | Public leaderboard of strategies run against a simulator; fee/price control, regime sensitivity warned | Same shape: write a policy, hidden competitor, shared seeds | https://www.paradigm.xyz/puzzles/prop-amm/about (search snippet) |
| Dev.to "I placed #2 in a prediction market challenge using autoresearch" | Writeup of an automated-experiment-loop approach on a Paradigm puzzle | Hints top entrants use automated parameter search over seeds | https://dev.to/octavic/i-placed-2-in-a-prediction-market-challenge-using-autoresearch-9j (snippet only; contents not read) |
| INFORMS dynamic pricing and learning with competition | Academic contest; a 2024 winner used Gaussian Processes | Online learning of competitor price response | https://arxiv.org/abs/1804.03219 (snippet only) |
| lablab.ai Band of Agents | Agent hackathon with PnL leaderboard | Shows LLM-agent teams tend to be judged on narrative plus PnL | https://lablab.ai/ai-hackathons/ai-trading-agents (snippet only) |

Caveat: I did not read these in full; treat as pointers.

## 3. Open source and commercial products

- No GitHub repo for car-hauling pricing or driver-fee marketplaces surfaced. Closest: RidePilot (open-source scheduling and dispatch for human-service transport), GNUTruckTools (SourceForge). Both snippet-only, not verified.
- Commercial car-hauling dispatch: Super Dispatch, CarShipIO (quotes, dispatch, invoicing): https://www.selecthub.com/p/dispatch-software/super-dispatch/ (snippet only). They solve record-keeping and load boards, not simulated margin optimisation under competition.
- Bahn Driver app (gig management for drivers and dealerships): https://marlvel.ai/apps/bahn-driver (snippet only).
- Bahn provides its own baselines: House starter (loses EUR 67,177 at level 8), House best (EUR 12,551/week at level 8, EUR 8,404 at level 6), and an unbuildable oracle (EUR 16,578). Source: https://spread.bahnexpress.com/how (opened).

## 4. What the sponsor's own materials reveal (opened pages)

- ~1,000 price requests per week, 15 minutes to answer; quote very high to decline. The competitor reacts: if you win most of a dealer's orders it lowers prices for that dealer. You never see its prices. (https://spread.bahnexpress.com/how)
- Drivers learn your fee-escalation pattern, so always-rising fees get waited out. (same)
- Level 8: third of drivers, competitor 40% above list, one unannounced low-price day, dealers trust on-time teams. Late-car refunds 10/25/50/100%. (same)
- Judging: elegant, clear, creative, robust; margin no longer counts after the top 10; present each idea with with/without margin and on-time numbers on the same weeks; the page warns to cut slides an agent wrote that you cannot explain. (https://spread.bahnexpress.com/judging)
- Kits, starter bots and a fork/reveal feature are provided (llms.txt, CHALLENGES.md:L355-408 as summarised by Agent A), so baseline code will be identical across teams.

## 5. What most teams will reach for first (estimates)

1. Run the starter, then hand-tune a markup over list price and a fee schedule.
2. Give an LLM agent the llms.txt and let it write the bot, with an LLM called per quote for dealer-note parsing.
3. Grid or Bayesian search of markup and escalation parameters on a handful of practice weeks.
4. Decline unprofitable lanes by quoting very high.
5. Raise fees near deadline to stay above 90% on-time.
6. Overfit to one practice world or a single seed.

## 6. Obvious ideas to avoid presenting as the idea

- "An LLM agent decides every quote and fee" (slow, unexplainable, hard to defend as robust).
- Plain parameter tuning of markup and fee with no mechanism story.
- A live dashboard of margin as the main deliverable (every team with a viewer will show one; Bahn already provides a run viewer per Agent A).
- Generic "reinforcement learning" without ablations.
- Dealer-note parsing alone, without showing it moves margin or on-time share.

## 7. Crowding estimate

Estimate: **medium**. Reasoning (all inference):
- For: clear scoring, hosted API, TypeScript and Python kits, no hardware, agent-friendly, EUR 2000/1000/500 prize. Fits teams running coding agents in parallel.
- Against: sponsor domain is niche, the gate is a top-10 margin rank during the weekend, final requires staying up and running live Sunday 08:00, and the 90% on-time rule eliminates sloppy bots. Many teams will drop out after the first ranking rounds.
- Number of Junction teams entering: unknown. No participant counts for this challenge were found.

## 8. How to look different

- Lead with a mechanism, not a model: for example capacity-aware bidding (quote price rises as free drivers fall), online estimate of competitor price response per dealer, and a fee-escalation schedule randomised so drivers cannot learn to wait.
- Detect regime changes (outage, level-8 low-price day) from win-rate shifts and show it on a timeline.
- Show ablations on the same seeds with units, exactly as the judging page requests (20+ seeds is our own suggestion).
- Demonstrate restart-proofness: kill the bot mid-week and resume from last event (the starter reconnects from the last event; final treats 20 s silence as a break per the how page).
- Keep the system small and each part explainable in one slide.
- Be honest on failure modes: the judging page asks for what did not work and what would break the system.

<!-- complete -->
