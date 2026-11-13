# Spread (Bahn Express): challenge intelligence

**Summary**
- Spread is a simulation game played over an API. We write a dispatcher bot that runs a simulated week of a Finnish car-transport company: it quotes prices to dealers against a hidden competitor, then posts each won car as a gig with a rising fee schedule for freelance drivers. The score is gross margin, and at least 90% of won orders must be on time (CHALLENGES.md:L365-369).
- The prize is a two-stage gate. First, finish in the top 10 by margin in one live, level-8 final on **Sunday 08:00** (about 34 minutes; registration closes 07:30). Then a jury judges how **elegant, clear, creative and robust** the system is, and margin no longer counts (CHALLENGES.md:L379-383; judging page). Prizes are €2000 / €1000 / €500 (CHALLENGES.md:L393-405).
- Physical hardware: none. It is pure TypeScript or Python against an HTTP/WebSocket API, with official kits, deterministic practice worlds, fork, reveal and a public leaderboard. It suits our ML, optimisation and agent skills.
- The risk is mostly competitive and operational rather than technical. Everyone plays the same objectively scored game, House best sets a high bar, and a crash or slow network during the 34-minute final can knock us out of the top 10.

Sources opened: CHALLENGES.md:L355-406, https://spread.bahnexpress.com/llms.txt, https://spread.bahnexpress.com/kit/RULES.md, https://spread.bahnexpress.com/kit/HANDBOOK.md, https://spread.bahnexpress.com/kit/API.md, https://spread.bahnexpress.com/judging, https://www.bahnexpress.com/ . The jury PDF (docs/00-Jury-profiles-and-pitch-guide.pdf) does not mention Bahn, Spread or logistics (searched with pdftotext).

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Spread: run a car transport company for a week | CHALLENGES.md:L355, L363 |
| Sponsor | Bahn Express (Helsinki; moves cars for 400+ dealers in FI/DK/DE) | CHALLENGES.md:L359, L389-391; bahnexpress.com |
| Track | Agentic AI Track. Spread sits under the `## Agentic AI Track` heading, which runs from L9 to L779 | CHALLENGES.md:L9 |
| Main requirement | Build a system that runs the company for the simulated week: quote dealers, post gigs and set driver fees. Score = gross margin. At least 90% of won cars must arrive by their deadline | CHALLENGES.md:L367-369; RULES.md "The game" |
| Judging, stage 1 (gate) | The top 10 ranked teams by margin in the Sunday 08:00 final (one secret level-8 week). Teams below 90% on time, or that win no order, are not ranked | CHALLENGES.md:L381-383; RULES.md L13-15 |
| Judging, stage 2 (winner) | The jury judges **elegant, clear, creative, robust**. "Reaching the top 10 is enough. After that, your margin no longer counts." **Weights: unknown** (none stated) | CHALLENGES.md:L383; judging page |
| Prize | 1st €2000, 2nd €1000, 3rd €500 | CHALLENGES.md:L395-405 |
| Provided resources | A simulation server with practice worlds at levels 1-8: deterministic, with `fork` and `reveal`. TypeScript kit (Bun / Node 22.18+) and Python kit (3.9+) with a roughly 200-line starter. HANDBOOK, RULES, API.md, OpenAPI JSON, llms.txt for agents, a run viewer, ranking rounds with two house teams (starter and "House best"), and two test finals on Saturday at 14:00 and 20:00 | CHALLENGES.md:L373-375; llms.txt; HANDBOOK "Practice tools"; judging page |
| Data available in-game | Map (places plus all-pairs road km/minutes), driver list (home, rating, licence, completed gigs, drops), gig views by driver, reveal CSVs (requests, legs with ground truth, views, gigs, events). The competitor's prices and drivers' costs are **never** revealed | API.md "The map"; RULES.md L87, L152; HANDBOOK "Research" |
| Hardware | None | entire spec; no hardware is mentioned |
| Submission | On the Junction platform by **Sunday 10:00**: the submission hash from the team page, a link to the code, and a presentation (5-10 slides or a short video). A preliminary submission is due Friday 23:59. "Every team submits" | judging page "What to submit"; CHALLENGES.md:L383 |
| Registration | Create the team at spread.bahnexpress.com/join with event code `spread-kmu9z6` | CHALLENGES.md:L373 |
| Rate limits | Practice: up to 1,000 req/s, shared across teams (about 170/s at 60 teams). Final: 20 actions/s and 50 reads/s, and an over-limit request gets 429 immediately. Max 8 practice worlds and 16 streams | API.md "Limits", "Errors"; HANDBOOK "Limits" |
| Restrictions on LLM / tool use | None stated (unknown). llms.txt invites you to "Give your agent" the docs | CHALLENGES.md:L375 |
| Team size / eligibility specifics | unknown (not stated in the Spread docs) | n/a |

## 2. What the sponsor is actually trying to encourage

Our reading, which is an inference: Bahn wants to see **better automated dispatch and pricing**, meaning the two decisions its human dispatchers make all day. Those are (a) what price to quote a dealer against a competitor and (b) what fee to offer freelance drivers, and when. They also want to meet engineers who can reason clearly about such a system, which looks like a recruiting and idea-harvesting motive. Evidence:
- The game is a faithful model of their real operation. "Bahn moves cars for car dealers, and a freelance driver drives each car on its own wheels" (CHALLENGES.md:L365). Their site describes single-driver, single-car moves, a driver app, and fixed prices confirmed at order (bahnexpress.com). They also offer to talk about "real dispatch" at the booth (CHALLENGES.md:L385).
- The jury explicitly ignores margin after the top-10 cut and rewards ideas they "did not expect: a new way to see the dealers, the drivers or the week" (judging page, "Creative"). They want transferable insight, not just a high score.
- "Robust" is defined as doing well on unseen weeks, shown "with results over many weeks", and surviving "a restart, a slow network and a surprise" (judging page). That is a production-dispatch mindset.
- The presentation guidance asks for ablations: "Your margin and on-time share with the idea and without it, on the same weeks" (judging page). They want a measured, scientific approach.
- The mechanics are built around real pain points: multilingual dealer notes in Finnish, Swedish and English; driver drops and no-shows; driver shortages that vary by town; dealer trust; and a competitor that adapts to your wins (RULES.md L83-85, L99-108, L155-164; HANDBOOK "Dealers compare prices").

## 3. Explicit requirements (quoted)

- "Your team builds the system that runs the company for that week." (CHALLENGES.md:L367)
- "your score is your gross margin, what the dealers pay you less what you pay the drivers. At least 90% of your cars must arrive by their deadline." (CHALLENGES.md:L369)
- "If fewer than 90% of the orders you win arrive on time, you are not ranked. This is the delivery minimum. A team that wins no order is not ranked." (RULES.md L13)
- "The final is on Sunday at 08:00. Every team plays its own copy of one secret week, which runs by itself for about 34 minutes. Registration closes at 07:30." (CHALLENGES.md:L381)
- "The 10 ranked teams with the highest margin present to our jury, in 5 to 10 slides or a short video. The jury judges how elegant, clear, creative and robust your system is." (CHALLENGES.md:L383)
- "Your system must run until the end." / "If your system stops, start it again at once. It rejoins the same week." (judging page)
- Submission: "Your submission hash… A link to your code… Your presentation. Slides or a short video." "Submit on the Junction platform by Sunday 10:00." (judging page)
- Hard game rules that cost money but do not disqualify: premium cars need experienced drivers (€150 fine); an EV below 30% charge on a route over 200 km needs a charging stop (€100 fine plus 90 min late); a gig with several cars is limited to 12 h of driving; an undelivered car at world end costs 2x its price (RULES.md L119-125, L138).

## 4. What a mediocre submission looks like

Our estimate:
- The kit starter with a few tuned constants: quote the list price, post at the typical fee plus 10% per hour, use keyword note parsing. The starter **loses €72,612 on seed spread-1 at level 8 and is not ranked** (HANDBOOK "The shortage"). Light tuning of it probably still fails the 90% minimum in a shortage, because "A system that wins every car it can falls under the delivery minimum" (RULES.md L161).
- An "LLM agent decides every quote" design with no driver-capacity model. In the final, 15 world minutes is about 4.5 real seconds per request, and actions are capped at 20/s (HANDBOOK "The final"; API.md "Limits"). It is likely to be slow, expensive and unmeasured.
- A pitch made of code screenshots and a tour of components, with no with-and-without comparisons across many seeds. The judging page warns against exactly this.
- No restart or rebuild logic, so the system crashes mid-final and drops out of the top 10.

## 5. What an exceptional submission demonstrates

Our estimate, grounded in the judging criteria:
- **Gets into the top 10 reliably.** It stays ranked in every ranking round at level 8, ideally near or above House best, and holds at least 90% on time with margin to spare.
- **One or two elegant core ideas that do most of the work.** One example is a capacity-aware bid policy: estimate, per town and day, how many drivers can actually move a car (from the driver list, views, bookings and drops), and quote high or decline when capacity is short. Another is a single fee-schedule model fitted from the reveal data. "A simple idea that does a lot of the work" (judging page).
- **Online learning** of the competitor's price per lane and day from its own wins and losses. The handbook says static tables go stale because the competitor reacts to you (HANDBOOK "Dealers compare prices"). It also detects the unannounced outage (raise prices there) and the price war (stop chasing that day), and uses dealer trust at level 8.
- **Creative use of the multilingual notes.** An LLM or rule-based parser, scored against the reveal's ground truth, which supports the claim "A system that reads notes well makes more money" (HANDBOOK, notes section). It may also make smart use of direct offers and multi-car gigs.
- **Evidence.** Ablations over 20+ seeds at level 8 with margin and on-time share, in the format "€12,551 a week, against −€67,177 for the starter, on the same 20 weeks" (judging page). Plus an honest "what did not work / what would break it".
- **Robustness.** Rebuilds state from `snapshot` and `events` after a restart, reconnects with `after=seq`, honours rate-limit headers, and runs on a cloud box near Stockholm (judging page; API.md "The stream").

## 6. Constraints that could disqualify a project

- **On time below 90% in the final**: not ranked, so no jury slot (RULES.md L13, L148).
- **Winning no order**: not ranked (RULES.md L13).
- **Not in the top 10 by final margin**: no jury presentation, so no prize (CHALLENGES.md:L383). This is the biggest practical risk.
- **Missing registration**: a team created after 07:30 Sunday cannot play the final. Registration also pauses from 13:45 and 19:45 on Saturday during test finals (judging page).
- **Missing submission** on the Junction platform by Sunday 10:00 (hash, code link, presentation). The preliminary submission is due Friday 23:59 (judging page). Whether a missing preliminary submission disqualifies: unknown.
- **System down during the final**: not disqualifying in itself, but requests go to the competitor while it is down (HANDBOOK "The final").
- Scores are replayed and checked after the final ("we replay every team's week to check each score", judging page). Rules on manual intervention: the handbook says you "can … act by hand" in the final (HANDBOOK "The final"), so this is allowed. Any other conduct rules: unknown.

## 7. Physical hardware work

**None.** The whole challenge is software against a hosted simulation API (HTTP, WebSocket and SSE), with TypeScript or Python kits (llms.txt; API.md). The only "infrastructure" advice is to run on a machine with a steady connection, for example a cloud VM near Stockholm (judging page).

## Notes for the selection stage (inferences)

- **Fit:** strong. It needs fast iteration, data analysis on reveal CSVs, parameter sweeps over many seeds, optimisation and RL-like policy tuning, and optionally LLM note parsing. These are all in our wheelhouse, and parallel agents help with sweeps.
- **Overall-winner potential (estimate):** moderate to low. A pricing and dispatch bot for a simulation is hard to make a compelling consumer-facing demo for peer review and the main jury, although a live map replay (run viewer) and a clear "AI dispatcher beats house AI" story could work.
- **Schedule cost:** the final is at 08:00 on Sunday. Someone must be awake and watching from 07:30, and the ranking rounds run through the night.

<!-- complete -->
