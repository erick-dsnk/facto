# Personal Economic Trainer (S-Pankki): technical feasibility (Agent D)

**Summary**
- **Feasible, low technical risk (our estimate: 8/10 that a strong core ships in 40 h).** There is no API, SDK, credential or hardware to depend on. The only inputs are four CSVs in a public GitHub repo (~363 MB in total) and an LLM API we already use (CHALLENGES.md:L2066-2081; https://github.com/hackjunction/Junction-2026-S-pankki).
- The data is clean and internally consistent. In our 25 MB sample (250k rows, 361 customers), every running balance reconciles with the transaction amounts. A full load is roughly 3.6M rows (estimate), which DuckDB or Postgres handles in seconds. Merchant names are **not** included, only opaque IDs such as `MRC-GRO-0032`. The "three baskets" are **not** labelled and must be inferred.
- The architecture that wins on trust: **a deterministic money engine (SQL/TS, unit-tested) plus an LLM that only calls typed tools and explains results**, delivered in a phone-sized embeddable web view. The smallest complete version is about 20-25 build hours, which leaves margin for polish and pitch.
- **Demo reliability is high (estimate 8/10) if we pre-load the data, pin one or two demo personas, and keep a cached or offline fallback for the LLM.** The demo would fail on venue Wi-Fi or LLM latency, on a hallucinated number the judges catch, or on a persona whose balance is negative most of the time. That last one is common: 247 of the 361 sampled customers go below zero at some point.
- Before committing, ask S-Bank on site about the LLM and data-residency expectations, the language (Finnish or English), the meaning of the mortgage files, how negative balances and "Salary Sweep" should be read, and what "integrate into S-mobiili" should look like in a demo.

---

## 1. What we actually have to build on

| Resource | Status | Access | Source |
|---|---|---|---|
| `tx_junction_transactions.csv` | 362,796,501 bytes (HTTP content-length we measured). Git LFS | Public. `git lfs pull` or the raw download from `media.githubusercontent.com`. A plain clone or ZIP gives an LFS pointer | repo README; our `curl -I` |
| `tx_customers_junction.csv` | ~100 KB, `customer_id, customer_postal_code, customer_age` | Public | repo README |
| `mtg_negotiation_history.csv`, `mtg_tx_customer_link_and_final_mtg_infio.csv` | ~640 KB + ~20 KB, mortgage events and outcomes | Public. **Role in this challenge: unknown** (the challenge text never mentions mortgages) | repo README; CHALLENGES.md:L2028-2111 |
| Licence / usage terms of the dataset | **Unknown.** No licence file or statement in the README | n/a | repo page |
| Banking API / sandbox / S-mobiili SDK / embedding spec | **None provided** | n/a | CHALLENGES.md:L2066-2081 |
| Open benchmarks: Statistics Finland Household Budget Survey | Tables 14q4 (by age), 14pg (by income quintile), 14q7 (by municipality group), all 2012-2022. Live PxWeb JSON API, CORS enabled | Public, no key. Server config: `maxValues 120000, maxCalls 40, timeWindow 60` (40 calls per minute) | https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/ ; https://pxdata.stat.fi/PxWeb/api/v1/en/?config ; https://pxdata.stat.fi/api1.html |
| Licence of Statistics Finland data | **Unknown from the pages we opened** (the API page does not state it) | n/a | https://pxdata.stat.fi/api1.html |
| Mentors | CIO Calle Holmberg (main contact), an IT/AI representative, a transaction-data scientist, business owners | On site | CHALLENGES.md:L2072-2079 |

### Data facts we measured
These come from the first 25 MB of the transactions file, which we downloaded and profiled: 250,044 rows, customers CUST00001 to ~CUST00361. Figures for the full file are extrapolations and are labelled as estimates.

- **Columns:** `customer_id, bank_account_id, tx_date, tx_timestamp, category, tx_amount_eur, balance_after_eur, transaction_type, merchant_id, mcc_code`. The file has a UTF-8 BOM. `tx_timestamp` uses a SAS-style format (`03OCT24:09:04:04`), so it needs a custom parser.
- **Date range:** 2024-10-01 to 2026-09-30. The data ends about six weeks before the event (2026-11-13), so with the real clock "this week" and "last month" return nothing. The demo clock has to be pinned to the dataset's end date.
- **Size:** 254 to 1,212 transactions per customer over two years. In the 50 customers we checked, each had one account. Estimate for the full file: ~3.6M rows and 5,100 customers.
- **Balance integrity:** 0 mismatches in 249,683 consecutive-row checks of `prev_balance + amount = balance_after`. Running balances can be trusted for forecasting.
- **Negative balances:** 6,686 rows. **247 of 361 customers go negative at least once.** This matters for the safe-to-spend feature (see the failure modes in section 6).
- **Transaction types:** purchase 82%, utilities_payment, salary, housing_payment, investment_deposit, salary_sweep, other_income, investment_withdrawal.
- **Categories:** Groceries, Restaurants, Transportation, Utilities, Entertainment, Health, Salary, Housing, Home & Tech, Lifestyle, Travel, Invest Deposit and Withdraw, Salary Sweep, Other Income.
- **MCC codes** are present on purchases, with 55k blanks on non-purchases. They include **4121 (taxis/limousines), 4,003 rows**, so "how much did I spend on taxis" *is* answerable via MCC. Agent A's 3 MB sample did not contain any. Others include 5814 (fast food, our coffee proxy), 5812 (restaurants), 5813 (bars), 4111 (commuter transport), 5541/5542 (fuel), 7523 (parking), 4511 (airlines) and 7011 (hotels).
- **Merchants:** 516 opaque IDs (`MRC-<CAT>-NNNN`), **no names**. "How much at Alepa?" or "my Spotify subscription" cannot be answered from the data. Subscription detection is limited to recurring amounts within the categories.
- **Recurring obligations are noisy, not fixed.** For example, CUST00001 pays housing of 511.90, 535.20, 511.08, 525.74, 536.28 and 495.88 on varying days (the 3rd to the 8th of the month), and salary of 2,032 to 2,551 on about the 15th. Recurrence detection needs a tolerance band of roughly ±10% on amount and a day-of-month window. It cannot use exact matching.
- **Irregular large costs exist:** p95/max is 815/3,861 for Home & Tech, 264/2,522 for Health, and 806/4,437 for Travel. This gives real material for basket 2 (mandatory but irregular), but nothing labels them mandatory. We must decide by heuristics (Health, large Home & Tech) and say so in the UI.

## 2. Architecture a credible entry needs

```
Phone (judge's or ours) -- PWA / embeddable web view, 390px-first
   |  chat + generated charts + "how we got this" drawer
   v
API (Next.js / Node, TypeScript)
   |-- LLM orchestrator: tool-calling only, no free arithmetic
   |      tools: query_spend(filters), baskets(), recurring(), safe_to_spend(date),
   |             what_if(change), persona(), benchmark(age, category)
   |-- Money engine (pure TS or SQL, unit-tested)
   |      recurring detection -> basket classifier -> cash-flow forecast -> simulator
   |-- DuckDB (or Postgres) loaded once from the CSVs; precomputed per-customer tables
   |-- Benchmarks: Statistics Finland 14q4 / 14pg snapshot saved to JSON at build time
   |-- Personas: k-means / GMM over 5,100 customers' category-share vectors (offline, Python)
   v
LLM provider (Claude via API; mock module + response cache for demo)
```

Key design rules, which are our recommendations:
1. **The LLM never computes numbers.** Every figure comes from a tool result and is rendered with its provenance (the filter used, the transaction count, and a link to the rows). This is the trust story a bank judge will probe, and it maps onto "Feasibility" and "S-mobiili integration", 20% each (CHALLENGES.md:L2094-2095).
2. **Use structured query tools, not free text-to-SQL.** We get a fixed tool schema (category, MCC set, date range, aggregation). This removes SQL-injection and hallucinated-column failures, and is easier to test. A guarded read-only SQL tool can be the fallback for the "MyData free exploration" angle (CHALLENGES.md:L2050).
3. **Precompute per customer.** Baskets, recurring items and the persona are computed offline for all 5,100 customers, so the live path is a few millisecond queries plus one or two LLM calls.
4. **Send aggregates to the LLM, not raw histories.** This is both a privacy story (an inference about what a bank judge values) and a latency and cost win.
5. **Pin a demo clock:** "today" = 2026-09-30 (the dataset's end). Otherwise "this week" and "last month" return empty.

## 3. Critical dependencies and access during the event

| Dependency | How we get it | Risk |
|---|---|---|
| S-Bank dataset | Download **tonight**, verify it is not a pointer (`head -c 200`), commit it to no repo (it is 363 MB). Keep a copy on two laptops plus a Parquet conversion | Low. Public, and we already pulled a sample successfully |
| LLM API (Anthropic) | Our own key. Rate limits on the Start tier are far above our need (for example Sonnet 5.5: 4,000 RPM, 2M ITPM). Spend cap $500/month on Start | Low for limits. **Ramp limits** can 429 on sudden bursts (for example a load test right before the demo), so warm up gradually. Source: https://platform.claude.com/docs/en/api/rate-limits |
| Statistics Finland | Snapshot the needed table to JSON at build time; never call it live | Low. API limit 40 calls/60 s (config endpoint) |
| Hosting | Any (Vercel/Cloudflare/Fly) plus a local fallback on a laptop and phone hotspot | Low |
| S-mobiili embedding | Does not exist for us; we mock it (an S-mobiili-like shell or a deep link from a transaction row). **Do not use S-Bank logos or branding as if official.** Label it a concept mock | Medium (pitch credibility only) |

## 4. Limits, pricing, latency, reliability

- **Anthropic API:** documented Start-tier limits, a monthly spend cap (Start $500, Build $1,000), and ramp limits that 429 on sudden spikes (https://platform.claude.com/docs/en/api/rate-limits). A chat turn with 2-3 tool calls means 2-4 sequential model calls. Our estimate is 3-8 s end-to-end with a mid-size model, which is noticeable on stage. Mitigations: stream tokens, use a fast model for tool routing, use prompt caching for the system prompt and tool schemas (cached reads do not count toward ITPM, same source), and pre-warm the demo questions.
- **Cost (estimate):** well under $50 for the whole hackathon, including development, because context is aggregates rather than raw histories.
- **PxWeb:** 40 calls/60 s, max 120,000 cells per query, and a 503 on a 60 s timeout (https://pxdata.stat.fi/api1.html, config endpoint). This is irrelevant if we snapshot. The data covers **2012-2022**, which is stale relative to 2024-2026 synthetic data. Say so in the UI (or index for inflation; estimate).
- **Dataset reliability:** static and verified consistent (section 1). Repo licence unknown.
- **Venue network:** unknown. Junction Wi-Fi is typically congested (unverified; treat as a risk, not a fact). Have a hotspot and a local mode.

## 5. Integration complexity given our skills

Our estimates of hours of agent-assisted work for three people, run in parallel:

| Component | Skill fit | Est. hours | Risk |
|---|---|---|---|
| Data ingest (CSV→DuckDB/Parquet, BOM, SAS timestamp parse) | Data | 2 | Low |
| Recurring detection plus three-basket classifier (heuristics: housing/utilities/salary periodicity; Health and large Home & Tech as irregular-mandatory; Restaurants/5814/Entertainment/Lifestyle small tickets as leakage) | Data/ML | 5-6 | Medium. Correctness on noisy recurrences needs tests |
| Safe-to-spend forecast (balance + expected income − upcoming recurring − irregular buffer, until next payday) | Data | 3-4 | Medium. Negative balances (section 6) |
| What-if simulator (scale category by x%, project 3/6/12 months) | Data | 2 | Low |
| Spender personas (clustering over 5,100 customers, LLM names clusters) | ML | 3 | Low |
| Statistics Finland benchmark snapshot plus category mapping (COICOP ↔ our categories) | Data | 3 | Medium. The category mapping is lossy; state it |
| LLM tool-calling orchestrator plus provenance payloads | Full-stack/AI | 5 | Low |
| Mobile web UI: chat, inline charts, basket view, provenance drawer, S-mobiili-style shell | Mobile/web | 8-10 | Low-medium (the polish takes the time) |
| Eval harness: 30-50 golden questions with SQL-computed expected answers | AI/ML | 3 | Low. High pitch value |
| Pitch, demo script, fallback video | All | 4 | Low |
| **Total** | | **~38-44 person-hours of work, spread over ~120 person-hours available** | Comfortable |

Native or Expo is optional. A PWA in a phone frame meets "a web app that can be embedded in a mobile app" (CHALLENGES.md:L2052). Voice input (Whisper/realtime) is a stretch add-on at an estimated 3-4 h, and should only be added if the core is done by hour 24.

## 6. Smallest complete version, and does the core fit?

**Yes. The core fits comfortably** (estimate). The smallest complete version that still answers every example question in the brief (CHALLENGES.md:L2042) is:
1. A customer picker (2-3 curated personas) plus a chat on a phone-sized UI.
2. Answers to the four brief questions with correct, sourced numbers: taxis last month (MCC 4121), "what kind of spender am I" (cluster persona), safe to spend this week, and dining −20% what-if.
3. A three-basket breakdown card for the user, with the leakage basket made concrete ("5814 fast food/coffee: €X/month").
4. A "how we got this" drawer on every number.
5. One Statistics Finland benchmark line (by age), with the source cited.

Everything else is stretch: proactive nudges, voice, the PSD2 multi-bank mock, the mortgage-affordability angle, and Finnish-language output.

**Milestones (estimate):** H0-6 data loaded, engine skeleton, UI shell. H6-18 engine complete with tests, tool calling end to end. H18-26 personas, benchmarks, provenance UI. H26-32 eval set, polish, Finnish toggle. H32-38 freeze, demo rehearsals, fallback video. H38-40 buffer.

## 7. Live-demo likelihood and failure modes (do not soften)

Our estimate is an **8/10** chance the live demo works, *with* the mitigations below. Without them it drops to about 5/10.

| Failure mode | Likelihood (est.) | Impact | Mitigation |
|---|---|---|---|
| **Hallucinated or wrong number caught by a judge.** The S-Bank data scientist will know the data | Medium if the LLM does arithmetic, low with tools-only | Fatal for "Feasibility" and trust | Tools-only numbers, provenance drawer, golden-question eval |
| **"This week" / "last month" returns empty** because the real clock is November 2026 and the data ends on 2026-09-30 | High if not handled | Embarrassing | Pin the demo clock to the dataset end and show it in the UI ("Data as of 30 Sep 2026") |
| **Safe-to-spend is negative or absurd for the demo persona.** 247 of 361 sampled customers dip below zero, and Salary Sweep / Invest moves distort the balance | High for a random customer | Undercuts the headline feature | Curate personas. Handle negative balances explicitly as a coaching moment ("you're €X short before payday; here's what to pause"). Treat sweeps and investment moves as transfers, not spending |
| **Recurring detection misses rent** because of ±5-10% amount jitter and shifting days | Medium | Wrong basket 1 | Tolerance-band detection, plus unit tests on the curated personas |
| **Question needs merchant names** ("Spotify", "Alepa") | Medium. Judges ask natural questions | Bot fails or invents | Have the LLM say plainly that merchant names are not in the data and offer category/MCC instead. Test this refusal path |
| LLM latency of 5-10 s on stage, or a 429 or 5xx | Low-medium | Dead air | Streaming, a fast model for routing, pre-warm, a cached-response replay mode for the scripted questions, and a recorded backup video |
| Venue Wi-Fi down | Unknown | Demo stalls | Phone hotspot. Laptop-local server plus local DuckDB; only the LLM needs the internet |
| Dataset download fails at the venue (LFS bandwidth) | Low (we can pre-fetch) | Blocks day 1 | Download before the event and share by USB/AirDrop |
| Crowded field: many teams build "chat with bank data" | High (Agent A's estimate) | Not a technical failure, but it lowers win odds | Differentiate on the pedagogy, trust and eval story, not on the chat itself |

## 8. Questions to ask S-Bank on site before committing

1. **LLM and data-residency:** Do they expect, or would they reward, an EU-hosted or self-hostable model? Is sending aggregates to a US LLM API acceptable for the demo? (Unknown, and it affects the "integrate into S-mobiili" score.)
2. **Language:** Finnish, Swedish or English UI expected for judging? (Unknown.)
3. **Mortgage files:** Are they intended for this challenge (an affordability coach), or left over from something else? (Unknown.)
4. **Semantics:** What do `Salary Sweep`, `Invest Deposit`/`Withdraw` and negative `balance_after_eur` represent (overdraft, credit line, or an artefact of the generator)? Is there a hidden ground truth for recurring or irregular-mandatory items?
5. **Dataset licence and reuse:** Can the code and data be published after the event? (The README states no licence.)
6. **S-mobiili integration:** What would make the integration story credible to them? A web view in the app, a deep link from a transaction row, any design system or tokens we may use? Is using S-Bank branding in a mock allowed?
7. **Submission format and deadline** for this challenge: video, repo, live demo slot, judging-round length. (Unknown from the challenge text.)
8. **Demo date context:** Is it acceptable to treat 2026-09-30 as "today"?

## Sources opened
- CHALLENGES.md:L2028-2111 (official challenge text)
- https://github.com/hackjunction/Junction-2026-S-pankki (README, file list, data dictionary, LFS notes)
- https://media.githubusercontent.com/media/hackjunction/Junction-2026-S-pankki/main/tx_junction_transactions.csv (HEAD for size; first 25 MB downloaded and profiled locally)
- https://platform.claude.com/docs/en/api/rate-limits (Anthropic rate, spend and ramp limits)
- https://pxdata.stat.fi/api1.html and https://pxdata.stat.fi/PxWeb/api/v1/en/?config (PxWeb limits)
- https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/ (Household Budget Survey table list)
- Agent A report: docs/challenge-selection/01-challenge-intelligence/personal-economic-trainer.md

<!-- complete -->
