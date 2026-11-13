# Personal Economic Trainer (S-Pankki): opportunity discovery (Agent C)

**Summary**
- The obvious entry is a chat UI over the CSV that answers "how much did I spend on X" and draws a pie chart. Most teams will build it (Agent A's estimate). The gaps sit around that chat, not inside it. They are **trust in the numbers**, **basket 2 (mandatory but irregular shocks)**, **making leakage felt rather than reported**, **free exploration in the MyData spirit**, and **a privacy story a bank could actually ship** (CHALLENGES.md:L2038-2064).
- The dataset's most underused asset is its **population**: 5,100 customers with age and postcode over two years. That allows peer cohorts, learned shock distributions and spender personas, which a single-customer chatbot cannot provide. The 2012-2022 Statistics Finland tables are a weaker substitute (feasibility.md §4).
- The best live before/after moments: the same judge's question answered by a naive LLM and by our verifiable engine; the "safe to spend" figure before and after a learned irregular-cost buffer; and replaying the user's own past year with one habit changed.
- Tech challenges we could honestly stack: **Verda** (its brief names "a banking coach" as an example, CHALLENGES.md:L2142), **Gemma** (EU-hostable open model), and low-effort **Codex**, **Gemini API** and **Aiven** (Postgres). **ElevenLabs** and **Tiger Data** fit only if we choose those features anyway.
- Our estimates: differentiation 5/10 (crowded brief), demo 7/10, overall-jury fit 5/10. Partner-win odds are better than overall odds.

> Research note: the session's web-search budget was exhausted when this run started, and Agent B's competitive report was not available (null). Claims about existing products are therefore limited to the pages listed under Sources. The state of other bank assistants (Nordea, OP, Revolut, Cleo and others) is **unknown** in this report and is not assumed.

---

## Context in two paragraphs (for a teammate who has not read the brief)

S-Bank (S-Pankki) wants an AI "personal economic trainer". It should let a customer chat with their own transactions, from "how much did I spend on taxis last month?" to "what kind of spender am I?", "what is safe for me to spend this week?" and "how much could I save if I reduced dining out by 20%?" (CHALLENGES.md:L2042). S-Bank values a pedagogical three-basket model: mandatory regular, mandatory irregular, and everyday leakage (L2044-2048). It also asks for MyData-style free exploration rather than fixed charts (L2050), plain-language explanations, what-if simulation and safe-to-spend/safe-to-save guidance (L2060). A PSD2 multi-bank view is an optional bonus (L2062-2064). The output should be mobile or embeddable web (L2052). Five criteria are each weighted 20%: literacy impact, originality of AI integration, mobile UX clarity, feasibility, and fit with S-mobiili (L2091-2095). Prizes are €2000, €1000 and €500 Airbnb gift cards (L2099-2109).

Data (repo `hackjunction/Junction-2026-S-pankki`, README opened): about 346 MB of transactions with category, MCC, running balance and opaque merchant IDs, plus 5,100 customers (age and postcode) and two mortgage files whose role is not explained. Agent D profiled a 25 MB sample and found that balances reconcile exactly, there are **no merchant names**, recurring payments are noisy (±5-10%), the data runs from 2024-10-01 to 2026-09-30, and **247 of 361 sampled customers go below zero at least once** (feasibility.md §1).

---

## Opportunity 1: Answers you can verify (the trust layer)

**Gap.** "Chat with your money" fails the moment a number is wrong, and bank judges include a transaction-data scientist (CHALLENGES.md:L2072-2079). The brief's first word is "trusted" (L2038). Public claims about existing bank assistants are about **speed and automation, not accuracy**. bunq's Finn reports a 47-second average resolution and 70-97% automation. The trade press notes that these figures are self-reported, not comparable with each other, and "meaningful only when answers are relevant, safe, and understandable". The same article cites bunq's own March 2026 research: 35% of UK adults do not trust AI for banking matters at all ([cxtoday.com](https://www.cxtoday.com/ai-automation-in-cx/bunq-finn-financial-ai-assistant/)). We found no published accuracy benchmark for conversational banking assistants (we could not search further, so treat this as unknown rather than proven absent).

**Evidence that it is hard on this data (feasibility.md §1, §7):** there are no merchant names, so questions about named merchants must be refused honestly. Taxis are reachable only through MCC 4121. Rent jitters ±10% and moves across days. Salary Sweep and investment moves distort spending. The dataset ends six weeks before "today". A naive text-to-SQL bot will answer confidently and wrongly on several of these.

**Direction.** The LLM never does arithmetic. It calls a small set of typed, tested tools, and every figure carries a "how we got this" receipt (filter, number of rows, the rows themselves). A golden-question evaluation set of 30-50 questions, including adversarial ones, has expected answers computed in SQL. We publish accuracy against a naive LLM-over-CSV baseline and show the failure cases.

**Why S-Bank would care (inference).** A bank cannot ship a coach that invents balances. Provenance plus an evaluation suite is what makes "Feasibility" and "Potential to integrate into S-mobiili" (40% combined, L2094-2095) believable to their IT/AI team.

**Overall-jury reading (estimate).** This is the strongest single fit with the jury rubric's "honest measured evidence" and "distinctive insight vs baseline" criteria (35% combined, 00-rules-and-jury.md §rubric). It speaks to Daksh ("does this beat a simple baseline, can your metric be gamed?"), Beer and Arturs. On its own it is not a wow moment at a peer-review table. It needs a visible side-by-side to be legible in 60 seconds.

**Live before/after.** A judge types a question, and two panes answer: "LLM on the CSV" vs "Trainer". One is wrong, or invents a merchant. The other gives the right number and a tap-to-see receipt.

---

## Opportunity 2: Basket 2, the "washing machine" nobody budgets for

**Gap.** S-Bank names mandatory-irregular costs as a basket of their own (CHALLENGES.md:L2047). Typical safe-to-spend logic is balance minus known bills until payday (our estimate of the common approach), and it treats irregular shocks as surprises. The data shows the shocks are real and heavy-tailed: p95/max of €815/€3,861 for Home & Tech, €264/€2,522 for Health and €806/€4,437 for Travel (feasibility.md §1). It also shows the result: most sampled customers dip below zero (247 of 361). Nothing in the data labels a cost "mandatory", so this is an inference problem.

**Underused capability.** With 5,100 customers over two years, we can **learn shock frequencies and sizes per cohort** (age band, region from postcode, spending profile), something a one-customer tool cannot do. The output is a personal "irregular buffer": "people like you hit a €300+ health or home cost about every N months; set aside €X a month". This is ML/data-science work we are strong at (estimate).

**Direction.** Safe-to-spend = balance + expected income − upcoming recurring − *learned* irregular buffer, through to next payday. Negative-balance personas become a coaching moment, not a bug.

**Why S-Bank would care (inference).** It turns the pedagogical model they asked for into a number the customer acts on. It is a natural safe-to-save hook (L2060) and leads into savings products. It is the least likely basket for other teams to treat seriously (estimate).

**Overall-jury reading (estimate).** It has a specific user (a young adult living payday to payday, cf. L2054) and a non-obvious mechanism (cohort-learned shock priors). It can be measured by backtesting: would last year's buffer have prevented the overdrafts in the following months? That is "honest evidence" a juror can check.

**Live before/after.** The safe-to-spend figure for a persona, naive vs buffered, then a replay of the past six months showing that the naive figure would have sent them negative in month 4 and the buffered one would not.

---

## Opportunity 3: Make leakage felt, and give people a reason to come back

**Gap.** Basket 3 is "spending that slips through your fingers" (CHALLENGES.md:L2048). Showing a category total teaches little. S-Bank wants people to "understand where their money really goes" and to build "healthier money habits" (L2048, L2060). A one-off Q&A chat fails the overall jurors' retention question ("why will anyone use this again?", Otto, 00-rules-and-jury.md L96).

**Direction (choose one strong mechanic, not all):**
- *Counterfactual replay:* rerun the user's real last 12 months with one habit changed (−20% dining, as in L2042), redraw the balance curve, and say what it would have funded. The data's reconciled running balances make this exact (feasibility.md §1).
- *Habit fingerprints:* detect the small, frequent, time-of-day patterns (MCC 5814 fast food/coffee, 5813 bars) from `tx_timestamp`, and name them in plain language.
- *Weekly check-in loop:* a short proactive nudge with one commitment, then measuring the user against it next week. In a demo, simulate the weeks by stepping the pinned clock forward through the dataset.

**Why S-Bank would care (inference).** It hits "impact on financial literacy (including the pedagogical angle)" (L2091) directly and fits S-mobiili's weekly usage pattern: 1.7M weekly users, and S-mobiili is to be "the starting point for all customer paths" ([S-Bank 2025 bulletin](https://www.s-pankki.fi/sv/aktuellt/2026/s-bank-plcs-financial-statements-bulletin-1-january31-december-2025/)).

**Overall-jury reading (estimate).** The most legible on the peer floor ("your coffee habit = a weekend in Tallinn") and universally relatable. Technically it is the shallowest of the six, so it should ride on Opportunity 1 or 2 for depth.

**Live before/after.** Two balance curves for the same year, actual vs with one habit changed, animated on a phone.

---

## Opportunity 4: MyData-style exploration with generated views and peer benchmarks

**Gap.** S-Bank explicitly asks to "let users explore their own data freely rather than showing fixed charts the bank has picked for them" (CHALLENGES.md:L2050) and encourages benchmarks against open data (L2050, L2060). Statistics Finland's household budget tables only cover **2012-2022** (feasibility.md §4), which is stale against 2024-2026 data, and mapping COICOP to the dataset's categories loses detail.

**Underused capability.** The dataset is a ready-made, current peer group: 5,100 customers with age and postcode. "People your age in your postcode area spend €X on restaurants" can be computed live, with Statistics Finland as a cited second opinion. Clustering the population also answers "what kind of spender am I?" (L2042) with real personas instead of LLM flattery.

**Direction.** The LLM chooses and parameterises a chart or card component (generative UI) from a constrained set, backed by the same typed tools as Opportunity 1, so a question produces a fitting visual rather than text. Benchmarks always show the cohort size and source.

**Why S-Bank would care (inference).** It is the literal MyData request, and peer comparison is a known engagement driver (our estimate, not sourced).

**Overall-jury reading (estimate).** Visually strong, and good for "originality of AI integration" (L2092). On its own it is a feature rather than an insight, so the jury may read it as incremental.

**Live before/after.** The same question gives a fixed dashboard in S-mobiili today versus a chart generated in response to the phrasing. The current S-mobiili screens were not reviewed for this report, so their contents are unknown.

---

## Opportunity 5: A coach a Finnish bank could actually deploy (data stays in the EU, Finnish-first)

**Gap.** Two of the five partner criteria are about deployability: feasibility and S-mobiili integration (CHALLENGES.md:L2094-2095). Most hackathon entries will send raw transaction histories to a US API (estimate). The brief claims "no Finnish bank yet lets customers chat with their own financial data" (L2054). The blocker for a bank is plausibly compliance and data residency more than model capability (inference; ask the S-Bank IT/AI mentor, feasibility.md §8 Q1).

**Direction.** Only aggregates leave the money engine, and the conversational model is an open-weight model on EU infrastructure. Verda's brief offers exactly this pattern: "Run open-weight models for a banking coach … on infrastructure you control, instead of sending data to someone else's API" (CHALLENGES.md:L2142). Verda is "hosted in European data centers" (L2130). Gemma is one candidate open model (L2546 onwards). We would show quality parity with a frontier API on our golden set (Opportunity 1), which makes the privacy claim measurable. A Finnish-language mode serves S-mobiili's audience. Whether Finnish is expected in judging is unknown (feasibility.md §8 Q2).

**Why S-Bank would care (inference).** It answers "could we actually run this?" in a way a chat demo cannot, and fits the 2024-2027 "customer-centric, digital" strategy ([2025 bulletin](https://www.s-pankki.fi/sv/aktuellt/2026/s-bank-plcs-financial-statements-bulletin-1-january31-december-2025/)).

**Overall-jury reading (estimate).** It speaks to Arturs's "clear path to production" and Umar's "into a real user's hands" (00-rules-and-jury.md L98, L100). It is not visible on the peer floor, so it supports a demo rather than being one. It is the key that unlocks the Verda and Gemma stacks.

---

## Opportunity 6 (speculative): Goal and readiness coaching, including mortgages and PSD2

**Gap.** The repo ships **mortgage application histories linked to customers, with outcomes** (150 approved and 50 rejected per Agent A; README opened), but the brief never mentions them, so their **role is unknown**. If they are fair game, "how far am I from a home loan like the ones that get approved, and which habits close the gap?" is a strong long-horizon goal for young adults (cf. L2054). The PSD2 multi-bank view (L2064) is a separate optional bonus with no data provided. It would have to be mocked. PSD2 has been in full effect since 14 Sep 2019 ([Wikipedia](https://en.wikipedia.org/wiki/PSD2)).

**Caution.** 200 applications is a tiny sample for any predictive claim (estimate). Ask the S-Bank mentors before investing time (feasibility.md §8 Q3).

**Overall-jury reading (estimate).** It is a meaningful life goal and a real user, but the risk of over-claiming from 200 rows is high. Treat it as a stretch layer on top of Opportunities 1-3.

---

## Combinations that are new or were impractical before recent AI

- **Tool-calling LLM + deterministic engine + per-answer provenance.** Only recently reliable enough to keep the model from doing maths (estimate). This is what turns "chatbot" into "trusted coach" (Opp. 1).
- **Population-learned priors + personal history** for irregular shocks and personas (Opp. 2, 4). This is classical ML, but the LLM makes it explainable in plain language, which is the pedagogy S-Bank asks for (L2060).
- **Generative UI from a constrained component set** (Opp. 4).
- **Open-weight EU-hosted model at near-frontier quality on a narrow, tool-backed task** (Opp. 5). This is why Verda frames a banking coach as an example (L2142). Whether a model of Gemma's size matches a frontier API on our golden set is unknown until measured.
- **Voice in Finnish** (streaming speech in and out) is possible but optional. It is low value for the rubric unless it is central to the experience (estimate).

## Stackable tech challenges (honest fit)

| Tech challenge | Honest fit | Effort | Note |
|---|---|---|---|
| Verda Compute Track | **Strong.** The brief names "a banking coach" as an example (CHALLENGES.md:L2142). Judged on ambition, fit, working prototype and path to scale (L2184) | Medium | Must document the process and post a summary in Discord (L2155-2156). Only if we really serve the model on Verda |
| Best Use of Gemma | **Good** if the open model in Opp. 5 is Gemma | Low-medium | Can run via Verda or Modal (L2546 onwards) |
| Best Use of Codex | Fine. Development-tooling usage, stackable with any challenge (L2434) | Low | Honest only if we really use Codex in the build |
| Best Use of Gemini API | Possible, but conflicts with the EU open-model story unless Gemini does a distinct job (for example generative UI). The brief wants more than "adding an LLM" (L2482 onwards). Members must be 18+ | Low | Pick either the Gemini or the open-model narrative as primary |
| Best Use of Aiven | Plausible. Aiven PostgreSQL as the transaction store, "meaningful part" required (L2917, 40% weight L2941) | Low | |
| Best Use of Tiger Data | Plausible. Transactions are time series, and continuous aggregates suit per-customer monthly rollups (L2284 onwards) | Low | Prize is small (Stream Deck Mini). Choose either this or Aiven |
| Best Use of ElevenLabs | Only if voice is a real feature | Low | Small prize |
| MongoDB, Vultr, Cloudinary, Oxylabs, Context.dev, Nemotron, Solana, Arduino, Atech, CRACI, Entire, Modal | Weak or forced for this challenge (estimate) | n/a | Do not stack for the sake of it. The jury discounts feature breadth (00-rules-and-jury.md summary) |

## Our estimates

| Dimension | Score | Reasoning |
|---|---|---|
| **Differentiation potential** | **5/10** | The brief writes the obvious solution for every team, and many teams will enter (Agent A's estimate). Real headroom exists in Opportunities 1 and 2 plus the population data, but other strong teams may find the same trust angle. |
| **Demo potential** | **7/10** | No hardware, deterministic data and phone-sized UI make the demo reliable (feasibility.md: 8/10 with mitigations). Before/after moments (naive vs verified, buffered safe-to-spend, counterfactual replay) are visual and relatable. Capped because "a chat on a phone" looks familiar on the peer floor. |
| **Overall-jury fit** | **5/10** | Strong on user (relatable, young adults), evidence (golden-set accuracy vs baseline, backtested buffer) and path forward (a named distributor with 2.6M users). Weaker on "distinctive insight / hard constraint": fintech chat may read as incremental to Beer, Timo and Arturs unless the insight is sharp. No juror has a fintech link (00-rules-and-jury.md L92-100). |

Implication (estimate): this challenge is a better bet for objective (1), winning the partner challenge, than for (2), winning overall. The most likely combined path is **Opportunity 1 + 2 as the core, 3 as the legible hook, and 5 to unlock Verda and Gemma.**

## Sources opened
- CHALLENGES.md:L2028-2111 (challenge text); L2116-2225 (Verda); L2284-2323 (Tiger Data); L2390-2420 (ElevenLabs); L2434 (Codex); L2470-2600 (Gemini, Gemma); L2905-2961 (Aiven)
- https://github.com/hackjunction/Junction-2026-S-pankki (README)
- https://www.cxtoday.com/ai-automation-in-cx/bunq-finn-financial-ai-assistant/
- https://www.s-pankki.fi/sv/aktuellt/2026/s-bank-plcs-financial-statements-bulletin-1-january31-december-2025/
- https://en.wikipedia.org/wiki/PSD2
- Internal: 01-challenge-intelligence/personal-economic-trainer.md (Agent A), 02-research/personal-economic-trainer/feasibility.md (Agent D), 00-rules-and-jury.md
- Attempted, not readable: web.meetcleo.com (403), Bank of Finland and Finnish financial-literacy pages (404). Web search was unavailable (session budget exhausted).

<!-- complete -->
