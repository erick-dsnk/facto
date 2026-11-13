# Spread (Bahn Express): technical feasibility (Agent D)

**Summary**
- **Buildable: yes, with high confidence.** This is pure software against a hosted, documented, deterministic simulation API. There are official TypeScript and Python kits (a starter of about 200 lines), fork and reveal for research, and no hardware, credentials beyond a team key, datasets or paid APIs (llms.txt; HANDBOOK.md "The first 15 minutes"). A ranked, positive-margin level-8 bot is an evening's work. A competitor team ("Upsala") already shows about €31.7k over five level-8 weeks roughly two hours after hacking opened (practice leaderboard, read 21:33 on Friday 13 Nov).
- **The hard part is competitive, not technical.** The gate is the top 10 of about 64 registered teams by margin in one live level-8 week. House best scores about €60k over five weeks, against about €31.7k for the best student team so far (leaderboard). Reaching the top 10 needs a measured pricing and capacity policy, not just a working bot. Estimate: about 50-65% for a strong team.
- **The live "demo" is the Sunday 08:00 final.** It runs unattended for about 34 minutes, with 20 actions/s and 50 reads/s and 4.5 real seconds per price request (API.md "Limits"; HANDBOOK "The final"). Its failure modes are a crash without state rebuild, 429s from bursty actions, a slow LLM call on the request path, and dropping under 90% on time. All are preventable with the kit's rebuild pattern plus two Saturday test finals (14:00 and 20:00). The jury presentation is slides or a video, not a live demo (judging page).
- **Timing caveat (fact):** it is already Friday 21:33 local, and the ranking rounds opened at 19:30. Every hour of delay before committing costs leaderboard data.

Sources opened: CHALLENGES.md:L355-406; https://spread.bahnexpress.com/llms.txt ; https://spread.bahnexpress.com/kit/API.md ; https://spread.bahnexpress.com/kit/HANDBOOK.md ; https://spread.bahnexpress.com/kit/RULES.md ; https://spread.bahnexpress.com/judging ; https://spread.bahnexpress.com/v1/leaderboards/practice?level=7 and ?level=8 (live JSON); https://spread.bahnexpress.com/kit/spread-typescript.tar.gz (file listing only). Agent A's report: docs/challenge-selection/01-challenge-intelligence/spread.md.

---

## 1. What we are building (in one paragraph)

A long-running process that plays one simulated week of a car-transport dispatcher. It receives `price_request` events and answers with a `quote` per delivery option within 15 world minutes. On `order_won` it `post`s a gig with a non-decreasing fee schedule of 1-48 steps, or sends a direct `offer` to one driver. It reacts to `gig_dropped`, `gig_expired`, `deadline_close`, `visit_failed`, `order_changed` and so on with `reprice`, `withdraw`, `release` or a repost. Score is gross margin. At least 90% of won orders must arrive on time, or the team is not ranked (CHALLENGES.md:L367-369; HANDBOOK "Events", "The client"; RULES.md L13).

## 2. Architecture a credible entry needs

All components below are our design (an estimate), built on documented API behaviour.

| Component | What it does | Why it is needed (source) |
|---|---|---|
| **Event loop / world adapter** | One code path for both modes: practice (`advance` with batched actions, deterministic) and final (WebSocket `stream?after=seq` plus `actions`). | The final closes `advance`, `fork` and `delete` and runs its own clock (API.md "The final"). The starter already does both (HANDBOOK "The first 15 minutes", item 6). |
| **State rebuild** | On start, rebuild books from `GET /worlds/{id}` (snapshot) and `GET /events?after=-1`. Dedupe by `seq`. Persist the last `seq` and any learned model state to local disk. | "If your system stops, start it again at once" (judging page). The server can restart during the final and returns 502/503/504 for under a minute (API.md "Errors"; HANDBOOK "The client"). |
| **Rate-limit-aware action queue** | One sender with a token bucket, at most 20 actions/s in the final. Batch up to 50 actions. Read `RateLimit-*` headers. Prioritise quotes, then urgent reposts, then reprices. | A final request over the limit gets 429 at once (API.md "Limits"). |
| **Capacity model** | Per town and day, estimate how many drivers can move a car: driver list (home, licence, rating, drops), plus live views, bookings and drops. The output is a "cost to move" and a "probability of on-time delivery" for a candidate leg. | Level 8 has a town-specific shortage, and "A system that wins every car it can is not ranked" (HANDBOOK "The shortage"). |
| **Quote policy** | Price = f(estimated competitor price, our move cost, on-time risk, dealer trust count). Decline by quoting far above list. Learn the competitor's level online from wins and losses per lane and day. Detect the outage (raise prices in the region) and the price war (stop chasing that day). | Competitor price = list × lane × day × world level (+26% to +54% at L8) × noise, and it adapts to our wins (HANDBOOK "Dealers compare prices"; "The price war of level 8"). |
| **Fee / gig policy** | Start fee and schedule shape per lane, slot and urgency. Avoid always-raise schedules, which teach drivers to wait. Use direct offers to drivers who end one of our gigs nearby. Consider multi-car gigs and trade-in pairing (12 h driving cap). | HANDBOOK "Drivers learn your fees", "Direct offers"; RULES.md (gigs). |
| **Note reader** | Parse Finnish, Swedish and English notes into structured constraints: ready time, real hours, tighter deadline, manual gearbox, plates, summer tyres. Validate against the reveal's `legs` truth. | "A system that reads notes well makes more money"; the reveal gives ground truth per won leg (HANDBOOK "Notes change what happens"; API.md "The reveal"). |
| **Research and evaluation harness** | Run N seeds × M configs in parallel (8 practice worlds max), export reveal CSVs, compute margin and on-time share, and produce ablation tables. | Jury wants "with the idea and without it, on the same weeks" (judging page). Max 8 open practice worlds (API.md). |
| **Ops** | Run on a small cloud VM near Stockholm (the server resolves to 13.62.255.80; we measured 0.23 s for one HTTPS request from the team laptop). Use a supervisor with auto-restart (systemd or pm2), logs and a manual-action CLI. | "A cloud machine near Stockholm, where our server is, is a good choice" (judging page). |

LLM use: optional. It is best for the **note reader** and for offline analysis or agent-driven parameter search, not for per-request pricing (see §4).

## 3. Critical dependencies and how we get them

| Dependency | Access | Status |
|---|---|---|
| Team key | Create the team at spread.bahnexpress.com/join with code `spread-kmu9z6` (CHALLENGES.md:L373) | Self-serve and immediate. Registration closes at 07:30 Sunday and pauses 13:45-test end and 19:45-test end on Saturday (judging page) |
| Simulation server | https://spread.bahnexpress.com (hosted by Bahn) | Live and answering now (verified: leaderboard JSON, kit download HTTP 200) |
| Kits | TS: `/kit/spread-typescript.tar.gz` (spread.ts 14 KB, starter.ts 23 KB, types.ts, reveal-csv.ts, no deps). Python: `spread-0.1.0` wheel, no deps (HANDBOOK; tar listing) | Downloaded and verified |
| Map | `GET /v1/map`, no key, no token cost (API.md "The map") | Public |
| Data for learning | Our own reveals (requests, legs truth, views) and events. **Never** competitor prices or driver costs (API.md "The reveal") | Generated by playing |
| LLM API (optional) | Our own Anthropic or other key | Not provided by the sponsor. Cost is small if used only for notes (estimate) |
| Cloud VM near Stockholm | Our own account (for example AWS eu-north-1) | Not provided. A few euros (estimate) |

No hardware, no NDA, no sponsor-gated data. Single point of failure: the Bahn server itself.

## 4. Limits, latency and reliability (documented or observed)

- **Practice rate:** a shared budget of 10,000 req/s split equally across active teams, capped at 1,000 per team. That is about 170/s at 60 teams and 50/s at 200. It drops to **20/s for everyone while a final or test final runs** (API.md "Limits"). A level-8 week takes the starter about 1,891 requests. That is about 2 s quiet, about 11 s at 60 teams, about 95 s during a test final, plus RTT per request: at 20 ms, 1,250 requests take ≥25 s (API.md). **Consequence (estimate):** sweeps of 20 seeds × several configs are cheap at night, but the 8-world cap and the per-team bucket are the real throughput limit, and network RTT dominates from Helsinki unless we run sweeps on the Stockholm VM. During the test finals our practice sweeps nearly stop.
- **Final rate:** 20 actions/s (burst 50) and 50 reads/s (burst 50). Over the limit returns 429 immediately, with no queueing (API.md "Limits"). The bulk order (30-40 cars from one yard) plus reposts can burst past 20 actions in one second. Batch and pace them.
- **Final clock:** 18 real s per weekday hour, so 15 world minutes is **4.5 real seconds** to answer a price request (HANDBOOK "The final"). Several requests often arrive at once (RULES.md L7). A synchronous LLM call per request (1-5 s, estimate) risks missing `respondBy`. Unanswered requests go to the competitor and cost a little goodwill.
- **Server restarts:** 502/503/504 without a body, back in under a minute, and the world continues. Re-send and re-read state. `advance` answers can repeat events after a restart, so dedupe by `seq` (API.md "Errors", "Practice worlds").
- **Stream:** closed with code 1013 if more than 4 MB behind. Max 16 streams. Reconnect with `after=seq` (API.md "The stream").
- **Driver list** can be up to 5 s stale while the world moves (API.md table).
- **Determinism:** practice is deterministic per seed, level and actions, but any change alters the rest of the week, so comparisons need several seeds (HANDBOOK "Practice tools"). Ranking runs cannot be forked or revealed (API.md).
- **Pricing:** free. No sponsor-side cost.
- **Reported outages or problems:** none found. This is a new, event-specific platform, so there are no external reports (unknown).

## 5. Integration complexity given our skills

Low for integration, high for the optimisation itself. Our estimate:
- **API integration: 1-2 hours.** The kits wrap every route, handle `RateLimit` headers and include the final-mode rebuild (HANDBOOK "The client"; "In the final, the starter then waits 5 seconds, rebuilds its books…").
- **Modelling: the real work.** This needs online estimation (competitor price per lane and day from binary win/loss, which is a censored or logistic problem), a capacity and cost model for drivers under shortage, fee-schedule design against learning drivers, plus notes NLP. These match our ML and data-science and agent skills. Nothing needs skills we lack.
- **Parallel-agent fit: good.** These split well into separate modules (quote, fee, notes, harness, ops), each with a measurable metric on fixed seeds. The shared risk is that all modules interact in one score, so integration testing on the same seed set is mandatory.

## 6. Does it fit in 40 hours? Smallest complete version

Actual remaining time (fact): hacking started on Friday 19:30. The final is on Sunday 08:00, which is about 34.5 h from now, including sleep and the overnight ranking rounds. Submission closes on Sunday 10:00 (judging page).

**Smallest complete version (MVP, about 6-8 h, estimate):**
1. Starter in TS or Python, with a fixed decline rule: do not quote, or quote far above list, on legs into towns with few drivers (from the driver list) or with risky notes.
2. Quote at about list × (1 + k), with k tuned on 10 seeds to stay under the competitor (whose level is +26% to +54% at L8).
3. Higher initial fee (for example 1.3-1.6× typical) with a short schedule, and an early-escalation rule.
4. A cap on open un-booked orders per town and day, to protect the 90% on-time minimum.
5. Rebuild-on-restart, which the starter already has, running on a VM under a supervisor.

That should be ranked (≥90% on time) with positive margin on most level-8 seeds. **Estimate:** it probably lands near the middle of the active field, not the top 10.

**Strong version (fits in the remaining time, estimate):** online competitor-price learner per lane, day and dealer, plus outage and price-war detectors; capacity-aware acceptance; dealer-trust-aware pricing; notes parser (rules plus a cached LLM fallback, scored against reveals); direct offers to nearby finishing drivers; trade-in or same-yard multi-car gigs; 20-seed ablation harness.

**Ambitious extras (skip unless ahead):** fork-based lookahead or rollouts inside practice (unavailable in the final, so of limited use), RL on fee schedules.

## 7. Live demonstration: likelihood and failure modes

The "demo" that matters is the **unattended Sunday 08:00 final**. The jury session (10:30-14:00) uses slides or a video (judging page). The likelihood that our system runs cleanly through the final is **about 9/10 if we rehearse in both test finals (estimate)**. The likelihood of finishing in the top 10 is a separate, competitive risk of about 50-65% (estimate).

What would make it fail (not softened):
1. **Not in the top 10.** Sixty-four teams are registered at L8. The best non-house five-week total is already about €31.7k, against House best at about €60.4k (leaderboard, 21:33 Fri). One secret week with noise means even a good system can drop out. This is the dominant risk, and no engineering removes it.
2. **Under 90% on time in the final → not ranked.** Even strong teams miss it on single weeks: Upsala run 3 had 86.6% and House best run 3 had 90.05% (leaderboard). A single-week final gives no averaging. We need a safety margin (target ≥94% in practice) and a live on-time monitor that tightens acceptance when on-time share drifts.
3. **Crash or hang mid-final with no rebuild.** Requests go to the competitor while we are down (judging page). Mitigation: supervisor auto-restart, idempotent rebuild from snapshot and events, and a test of kill -9 mid-run in a test final.
4. **429 storms.** The final returns 429 with no wait (API.md). Bursty reposts after a flu day or the bulk order could silently drop actions. Mitigation: a single paced sender and retry on 429.
5. **Slow decision path.** 4.5 s per request window. An LLM on the critical path, or a heavy model, could miss `respondBy`. Mitigation: deterministic quote path, and notes parsed asynchronously with a cached, rule-based fallback.
6. **Network or laptop.** Venue Wi-Fi, laptop sleep at 08:00. Mitigation: run on a cloud VM near Stockholm.
7. **Overfitting to practice seeds.** Competitor lane factors are partly new per world, and the shortage factor is new per town per world (HANDBOOK). Mitigation: evaluate only on fresh seeds and ranking rounds.
8. **Human factor.** Someone must be up by 07:00 Sunday and confirm `GET /v1/final` returns the new world at 07:30.
9. **Server-side failure.** Bahn's single server goes down. This is outside our control, and the docs say worlds resume after restarts (API.md).

## 8. Ask the sponsor at the Bahn booth before committing

1. Are LLM calls and other external services allowed in the system during the final? (Not stated: unknown.)
2. Is manual intervention during the final allowed without limit? The handbook says you "can … act by hand" (HANDBOOK "The final"). Does the post-final replay check treat manual actions differently?
3. What exactly does "we replay every team's week to check each score" verify, and can anything we do (for example, non-deterministic timing) fail it? (judging page)
4. How is the top 10 handled if many teams are clustered or tied, and is there any fallback if the server fails during the final (a re-run)? (unknown)
5. Is the final week's level-8 world-parameter range (drivers, competitor level) the same as practice? Is it a weekday-start week, unlike the Thursday-start test finals? (HANDBOOK says test finals start Thursday 00:00. Whether the final starts Monday 00:00 is implied by the 34-minute duration, but confirm.)
6. Can one project also be submitted to other Junction tracks or tech challenges? (Junction-level rule: unknown here.)
7. Does the jury weight the four criteria (elegant, clear, creative, robust) equally? (Weights unknown.)

## 9. Bottom line for the selection stage (estimate)

- Technical buildability: **9/10.** No hardware or access risk. The kit already handles the plumbing.
- Live run reliability: **8/10.** It rises to 9 with VM, supervisor and test-final rehearsal. It is driven by our engineering, not the sponsor's.
- The real uncertainty is **winning the gate** against about 64 teams and then impressing a jury on clarity and ablations. This is a good fit for an ML and agents team that can run many parallel experiments overnight, but the margin-to-top-10 is not guaranteed.

<!-- complete -->
