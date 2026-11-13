# Personal Economic Trainer (S-Pankki): challenge intelligence

**Summary**
- S-Bank (S-Pankki) wants an AI "financial coach" that lets a customer **chat with their own transaction data**. It should answer anything from "how much did I spend on taxis last month?" to "what is safe for me to spend this week?" and "what if I cut dining out by 20%?". The coach should also teach a three-basket view of spending: mandatory regular, mandatory irregular, and everyday leakage (CHALLENGES.md:L2038-2048).
- Judging is five criteria at **20% each**: financial-literacy impact, originality of AI integration, clarity of the mobile UX, feasibility, and potential to integrate into S-mobiili. Prizes are **Airbnb gift cards** of €2000, €1000 and €500, not cash (CHALLENGES.md:L2091-2109).
- Resources: a synthetic dataset of about 346 MB in a public GitHub repo, covering 5,100 customers with age and postal code and two years of categorised transactions with MCC codes. Statistics Finland open data can supply benchmarks. The recommended output is a mobile app, or a web app that can be embedded in one (CHALLENGES.md:L2052, L2081).
- **No physical hardware.** It is pure full-stack plus LLM-agent plus data work, squarely in our skill set. The main risk is a crowded field, because "chat with your bank data" is the obvious idea and many teams will build it. Winning needs a sharp pedagogical insight and trustworthy numbers, not just a chatbot.

Sources opened: CHALLENGES.md:L2028-2111; https://github.com/hackjunction/Junction-2026-S-pankki (README and the four CSVs, plus a 3 MB sample of the LFS transactions file); https://www.s-pankki.fi/sv/aktuellt/2026/s-bank-plcs-financial-statements-bulletin-1-january31-december-2025/ ; https://apps.apple.com/fi/app/s-mobiili/id740514933 ; https://www.cxtoday.com/ai-automation-in-cx/bunq-finn-financial-ai-assistant/ ; https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__ktutk ; docs/00-Jury-profiles-and-pitch-guide.pdf (via pdftotext). The original challenge page (hackjunction.app/participate/45/challenges/311) did not render for the fetcher, so CHALLENGES.md is the only copy of the official text we have.

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Personal Economic Trainer | CHALLENGES.md:L2030 |
| Sponsor | S-Pankki / S-Bank, "Finland's fourth-largest bank, with 3.5 million customers" | CHALLENGES.md:L2034, L2040 |
| Track | FinTech Track. It is the only challenge under that heading, which runs from L2028 to the Tech Challenges at L2114 | CHALLENGES.md:L2028 |
| Main requirement | "build an AI experience that lets people chat with their own money", using the synthetic transaction dataset | CHALLENGES.md:L2042 |
| Recommended output | "a mobile app, or a web app that can be embedded in a mobile app — our customers are on mobile." It says *recommended*, not mandatory | CHALLENGES.md:L2052 |
| Judging emphasis and weights | Impact on financial literacy, including the pedagogical angle (20%); Originality of AI integration (20%); Clarity of the mobile user experience (20%); Feasibility (20%); Potential to integrate into S-mobiili (20%) | CHALLENGES.md:L2091-2095 |
| Prize | 1st: €2000 Airbnb gift card; 2nd: €1000 Airbnb gift card; 3rd: €500 Airbnb gift card | CHALLENGES.md:L2099-2109 |
| Provided data | Repo `hackjunction/Junction-2026-S-pankki`. `tx_junction_transactions.csv` (~346 MB, Git LFS) has the columns `customer_id, bank_account_id, tx_date, tx_timestamp, category, tx_amount_eur, balance_after_eur, transaction_type, merchant_id, mcc_code`. `tx_customers_junction.csv` holds `customer_id, customer_postal_code, customer_age`. There are also two **mortgage** files: application event history, and a link to `customer_id` with the final decision. The CSVs have a UTF-8 BOM | CHALLENGES.md:L2070, L2081; repo README |
| Data facts we measured (from our own download) | 5,100 customers (5,101 lines including the header), ages 18-90. Mortgage outcomes: 200 applications, 150 approved and 50 rejected. In a 3 MB sample (~30k rows, 45 customers) the dates run from 2024-10-01 to 2026-09-30 and the categories are Groceries, Restaurants, Transportation, Utilities, Entertainment, Health, Salary, Housing, Home & Tech, Lifestyle, Travel, Invest Deposit/Withdraw, Salary Sweep and Other Income. Purchases carry MCC codes such as 5812/5814 for restaurants and fast food, and 4111, 5541/5542 and 7523 for transport and fuel | repo files, our profiling. The sample-based numbers are estimates for the full file |
| Mortgage files' role | **Unknown.** The challenge text never mentions mortgages. They may serve a "big purchase / affordability" coaching angle, or they may belong to another use | repo README vs CHALLENGES.md:L2028-2111 |
| Open data suggested | "open data sources (e.g., Statistics Finland) to offer meaningful benchmarks". The Household Budget Survey tables include 14q4 (expenditure by age of reference person), 14pg (by income quintile) and 14q7 (by municipality grouping), all 2012-2022 | CHALLENGES.md:L2050, L2060; pxdata.stat.fi StatFin__ktutk |
| Optional bonus | Multi-bank view under PSD2: "How could an AI coach use the customer's full financial picture?" It is explicitly not required | CHALLENGES.md:L2062-2064 |
| Mentors | Carl-Edvard (Calle) Holmberg, Chief Innovation Officer, who is also the main contact; an S-Bank IT/AI development representative; a transaction-data data scientist; 1-2 business owners of the customer problem | CHALLENGES.md:L2074-2079 |
| Hardware | None | entire challenge text |
| APIs / sandbox banking API | None provided. Only static CSV data is given, so there is no S-mobiili SDK or embedding spec (unknown) | CHALLENGES.md:L2066-2081 |
| Submission requirements | **Unknown.** The challenge text gives no deliverables, demo format or deadline. General Junction submission rules are not in this section | CHALLENGES.md:L2028-2111 |
| LLM provider restrictions / data-handling rules | Unknown (not stated) | n/a |

## 2. What the sponsor is actually trying to encourage

Our reading, which is an inference: S-Bank is scouting a **concrete, shippable feature concept for S-mobiili**. It wants a conversational money coach aimed at improving financial literacy, especially among young adults, which it could brand as a Finnish first. It is less interested in a generic chatbot demo. Evidence:
- Strategy fit is explicit. "The challenge ties directly to S-Bank's strategy of serving customers increasingly digitally and to our vision for S-mobiili" (CHALLENGES.md:L2054). S-Bank's 2025 bulletin says "we are making S-mobiili the starting point for all customer paths" and reports "over 2.6 million unique users and more than 1.7 million weekly users" (s-pankki.fi bulletin). One of the five criteria, worth 20%, is "Potential to integrate into S-mobiili" (CHALLENGES.md:L2095).
- They claim first-mover positioning: "no Finnish bank yet lets customers chat with their own financial data" (CHALLENGES.md:L2054). We found nothing that contradicts this for Finland. The current S-mobiili listing mentions only a "virtual assistant" that answers common questions in the message centre, plus purchase breakdowns by product group (App Store listing). Outside Finland, bunq's Finn has offered this since December 2023 with questions like "How much did I spend on Amazon this year?" (cxtoday), so the concept itself is not novel.
- Pedagogy, not analytics, is the differentiator they ask for. They "value a pedagogical angle" built on the three-basket model, and want solutions "that help people understand where their money really goes" (CHALLENGES.md:L2044-2048). They also want something that "explains financial concepts in plain language, simulates 'what if' scenarios, and guides users toward healthier money habits, for example through safe-to-spend and safe-to-save guidance" (CHALLENGES.md:L2060). Financial literacy is weighted 20%.
- MyData philosophy: "let users explore their own data freely rather than showing fixed charts the bank has picked for them" (CHALLENGES.md:L2050). That means open-ended querying driven by the user.
- Target segment: "especially among young adults" (CHALLENGES.md:L2054).
- Who judges is an inference. The mentors include a business owner of the customer problem and the Chief Innovation Officer (CHALLENGES.md:L2074-2079), so they will probably also judge. That suggests feasibility and integration realism (trust, regulation, the in-app flow) weigh as much as the AI.

## 3. Explicit requirements (quoted)

- "Using a large synthetic transaction dataset modelled on real S-Bank data, build an AI experience that lets people chat with their own money, from simple questions like 'How much did I spend on taxis last month?' to deeper ones like 'What kind of spender am I?', 'What is safe for me to spend this week?' or 'How much could I save if I reduced dining out by 20%?'." (CHALLENGES.md:L2042)
- "We value a pedagogical angle: everyone's spending falls into three baskets: 1. mandatory and regular (e.g. rent) 2. mandatory and irregular (e.g. a broken washing machine), and 3. everyday spending that slips through your fingers (e.g. coffees)" (CHALLENGES.md:L2044-2048)
- "Think in the spirit of MyData: let users explore their own data freely rather than showing fixed charts the bank has picked for them." (CHALLENGES.md:L2050)
- "**Recommended output:** a mobile app, or a web app that can be embedded in a mobile app — our customers are on mobile." (CHALLENGES.md:L2052)
- "Benchmarking personal data against open population data is encouraged but not mandatory." (CHALLENGES.md:L2060)
- "Optional bonus angle (not required, the challenge is fully solvable with the provided data and open data): Multi-bank view: under PSD2…" (CHALLENGES.md:L2062-2064)

Nothing else is stated as mandatory. There are no submission artefacts, language requirement (Finnish/English: unknown) or tech-stack constraints.

## 4. What a mediocre submission looks like

Our estimate. This will probably be the modal entry, because the brief practically writes it:
- A React/Next web chat UI wrapped around an LLM with text-to-SQL or pandas over the CSV. It answers "how much on restaurants last month" and draws a pie chart, with no three-basket model and no teaching.
- Numbers the LLM computed or hallucinated, with no provenance. "Safe to spend" becomes a vague paragraph instead of a figure derived from recurring obligations and upcoming irregular costs.
- Desktop-first UI, with no thought about how it slots into S-mobiili (entry point, consent, tone, Finnish language).
- Questions that fail quietly on the data's real shape. One example from our sample: "taxis" has no dedicated category. Transport MCCs in the sample are 4111, 5541/5542 and 7523, and we saw no taxi MCC 4121 in the first 30k rows. A naive bot will answer confidently and wrongly.
- Benchmarks stated without a source ("you spend more than average").

## 5. What an exceptional submission would demonstrate

Our estimate:
- **A trustworthy number engine with an LLM on top.** Deterministic, tested computations do the work: recurring-payment detection, three-basket classification, a safe-to-spend formula, and what-if simulation. The LLM plans, explains and teaches, and every answer shows "how we got this", meaning the transactions and formula behind it. This is exactly what Daksh, Beer and Arturs probe in the jury guide: beat a baseline, show failure cases, show where a conclusion came from (jury PDF pp. 3, 6).
- **The three-basket model made tangible and personal.** The coach learns from history which irregular-mandatory costs to expect (car repairs, annual insurance) and proposes a buffer. It shows the "leakage" basket as a concrete habit ("your 3pm coffee = €38/month = a weekend trip by June"). The coach should teach, not just report.
- **Answers to the four example questions, done right and live, on a real synthetic customer.** "What kind of spender am I?" uses clustering or personas over all 5,100 customers, which is an ML angle we can do well. "Safe to spend this week" is a forward-looking cash-flow forecast. "Reduce dining by 20%" is a simulation tied to the projected balance.
- **MyData-style free exploration.** The user asks and the app generates the right visual on the fly, rather than a fixed dashboard.
- **Benchmarks with citations.** "People aged 25-34 in Finland spend X on restaurants" from Statistics Finland table 14q4, with the source shown in the UI.
- **Mobile-native polish:** a phone-sized embeddable web view or an Expo app. Ideally it includes voice (we have streaming-audio skills) and proactive nudges, which answers Otto's "why come back?" question.
- **Integration story:** one slide on how it slots into S-mobiili (entry from transaction list, consent screen, Finnish/Swedish/English), privacy (no raw data to the LLM beyond aggregates, or an EU-hosted model), and failure handling.
- Optional: the PSD2 multi-bank view, or an affordability coach that draws on the mortgage files, for example "how close am I to a home loan like the ones approved". The role of the mortgage files is unknown, so ask the mentors before investing in it.
- **Fit for us:** high. It is TypeScript, LLM agents, data science and mobile, with zero hardware. **Partner-win odds (estimate):** decent if we execute the trust and pedagogy angle. Many teams will enter because the brief is accessible. **Overall-winner potential (estimate):** moderate. The problem is universally relatable, which suits peer review, but "chat with your bank data" may read as incremental to the jury unless the insight and evaluation are distinctive.

## 6. Constraints that could disqualify a project or sink its score

- No explicit disqualifiers are stated in the challenge text (CHALLENGES.md:L2028-2111). General Junction rules are unknown from this section.
- Ignoring the mobile form factor is not stated as disqualifying, but it costs points: output is "recommended" as mobile (L2052), and mobile UX clarity is 20% (L2093).
- Building a project that has no use for the provided dataset probably fails the "Using a large synthetic transaction dataset" premise (L2042). This is an inference.
- Data handling is our inference: the data is synthetic, so privacy is not a blocker. Still, sending entire transaction histories to a non-EU LLM may hurt the "Feasibility" and "S-mobiili integration" scores with a bank judge.
- Practical gotcha: the transactions file is Git LFS. Downloading the ZIP or the raw URL can give a 134-byte pointer file. Use `git lfs pull` or the "Download raw file" button (repo README). The CSVs start with a BOM.

## 7. Physical hardware work

**None.** The challenge is software-only: static CSV data, LLM, and a mobile or web app (CHALLENGES.md:L2052, L2066-2081). The only devices involved are our phones for the demo.

<!-- complete -->
