# Competitive intelligence: Personal Economic Trainer (S-Pankki)

**Summary**
- The core idea (chat with your own transactions via an LLM, plus cash-flow forecast and nudges) is the first thing every team and every existing product reaches for. Expect many near-identical "chat + dashboard + text-to-SQL" demos.
- Commercial chat-over-spending exists elsewhere (bunq Finn). The sponsor claims no Finnish bank has it (CHALLENGES.md:L2054); I found no contradicting evidence, but could not verify.
- The differentiator the sponsor explicitly rewards is pedagogy (three baskets, L2044-2048; 20% criterion, L2091) and S-mobiili integration (20%). Most hackathon finance bots skip both.
- Crowding estimate: medium-high (reasoning below). Evidence base is thin: no past S-Pankki/Junction winners were found, and the web-search budget ran out mid-research (see Limitations).

## 1. Previous winners / same sponsor
- **Past Junction S-Pankki challenge winners: unknown.** A search for them returned only generic Junction history (Wikipedia, Aalto, Ensto 2018) and nothing naming S-Pankki. https://en.wikipedia.org/wiki/Junction_(hackathon)
- S-Pankki's own site (https://www.s-pankki.fi/fi/) mentions no AI chat in S-mobiili on the page fetched; the S-mobiili product page itself was not in the fetched content, so absence is unconfirmed.

## 2. Similar hackathon winners and submissions
| Project | Event | What it does | URL |
|---|---|---|---|
| Finny AI | NatWest Group x Google Cloud NextGenHack (winner) | Mobile-first web app on Gemini/Cloud Run: predictive cash flow, goal-aware saving pots, proactive nudges, subscription detection; pitched with QR live demo | https://www.business-school.ed.ac.uk/about/news/nextgenhack |
| Prosper AI | Berkeley Hackathon 2023, LlamaIndex prize winner | Connects bank/investment accounts via Plaid-style provider, asks goals, gives personalised advice and charts | https://www.llamaindex.ai/blog/special-feature-berkeley-hackathon-projects-llamaindex-prize-winners-c135681bb6f0 |
| FinPilot | Bankjoy AI Code Fest 2025 (1st, internal event) | "AI Banking Consultant" prototype (details not fetched) | https://bankjoy.com/blog/ai-code-fest-2025 |
| FinSage, Moola, DollarPilot, FinLens, Xpense, etc. | Devfolio/Devpost/lablab entries; placements unverified | Conversational finance coaches, PDF/statement ingestion, budget bots | https://devfolio.co/projects/finsage-a55a , https://devpost.com/software/moola-r8b4fs , https://devpost.com/software/dollarpilot , https://lablab.ai/submissions/cmcs5auau006t356r78te9ej0 |

Takeaway: winners at bank-sponsored events pair chat with forecasting and proactive nudges in a mobile-first web demo. That is the bar and also the baseline everyone will hit. (Finny's list was fetched; the entries in the last row were only seen as search-result titles, not opened.)

## 3. Open-source implementations
- Agatha (MIT, FastAPI-style expense API, Llama 3.3 via Groq, text-to-SQL over SQLite; 1 star, 26 commits). https://github.com/devroopsaha744/agatha
- cardql (NL-to-SQL with validation over transactions SQLite, LangChain + Ollama, Streamlit chat). https://pypi.org/project/cardql/
- FinzyTrack (GPLv2 desktop app, Beancount ledger, NL queries). https://finzytrack-docs.pages.dev/
- Personal-Finance-Agent (SQLite, storage + analysis agents). https://github.com/Kirushikesh/Personal-Finance-Agent
- accountant24, ray-finance, Finsight (local, bring-your-own-model; seen in search results only): https://hn.svelte.dev/item/47306144
- Research note: a CIKM'25 paper, "FinAI Data Assistant", uses OpenAI function calling over a financial DB. Title/authors confirmed; the PDF was unreadable, so I did not verify its comparison with text-to-SQL. The search summary claimed vetted parameterised queries beat free text-to-SQL; treat that as unverified. https://www.arxiv.org/pdf/2510.14162

Implication: a working chat-over-CSV prototype is a few hours of work with these patterns. It cannot be the differentiator.

## 4. Commercial products
- **bunq Finn** (2023 launch, later made fully conversational): answers questions like average monthly grocery spend or total at a merchant, replaces in-app search, plans/budgets. Coverage is from 2023-24; current features unchecked. https://finextra.com/newsarticle/43465/bunq-launches-genai-chatbot , https://www.retailbankerinternational.com/news/bunq-makes-its-ai-assistant-finn-fully-conversational/ (via search snippets; the Finextra pages returned 403 when fetched).
- **Nordic incumbents**: Nordea and OP use AI virtual agents for customer service, not transaction analysis; Danske uses internal tools. No customer-facing transaction-chat launch found. https://www.privatebankerinternational.com/news/nordea-ai-virtual-agents/ , https://www.ibm.com/blog/ai-chatbots-improve-op-customer-relations/ (search snippets only). This is consistent with the sponsor's "first-of-its-kind" claim (CHALLENGES.md:L2054) but is not proof.
- Cleo, Emma, Monarch, YNAB, Copilot, Revolut: widely known chat/budget apps, but I could not research them (search budget exhausted, Cleo site returned 403). Listed only as likely comparators; no claims made about them.

## 5. What most teams will build first (obvious ideas)
1. Chat UI that turns questions into SQL over the CSV and answers in prose ("how much did I spend on taxis").
2. Category pie/bar dashboard with an LLM summary.
3. Budget/saving-goal bot with a "reduce dining by 20%" slider (the challenge text's own example, L2038).
4. Subscription / recurring-charge detector with alerts.
5. "What kind of spender are you?" persona label from an LLM prompt (L2038).
6. Gamified savings streaks and badges.
7. Voice assistant wrapper over the same chat.
8. Generic "AI advisor" persona giving investing advice (off-brief; the brief is literacy and spending).
9. Multi-bank/PSD2 view with faked data (optional bonus, L2074-2076).

## 6. Crowding estimate (estimate, not fact)
**Medium-high.** Reasons:
- Zero hardware, a clean CSV dataset, familiar LLM chat pattern: low barrier, so many teams will find it attractive.
- Challenge text gives example questions teams can implement directly (L2038).
- Prize is modest (1st EUR 2000 Airbnb card, L2099-2109) which may deter some but not volume.
- Healthcare is excluded for us, but other FinTech challenges compete for the same web/AI-agent teams. Number of teams: unknown.
- Judging is 20% each across five criteria (L2091-2095), so a polished but generic entry can place; hence the field will be competent, with many similar entries.

## 7. How to look different
- **Teach, not just answer.** Make the three baskets (L2044-2048) the product's spine: classify every transaction, show where money "slips through the fingers", and explain concepts in context. Most hackathon bots (Finny, Prosper) are advice/forecast tools, not pedagogical.
- **Deterministic, verifiable engine under the LLM.** Compute numbers in code (recurring detection, safe-to-spend, what-if) and have the LLM only call tools and explain, with "show the rows behind this number". This sidesteps the text-to-SQL pitfalls and answers the feasibility criterion.
- **Honest about the data.** The dataset has `merchant_id` and `mcc_code`, not merchant names or free text (README: https://github.com/hackjunction/Junction-2026-S-pankki), so basket classification and persona work must use MCC, amount patterns and timing; say so in the pitch rather than faking merchant names.
- **Integration story.** Ship as an embeddable mobile web view with an S-mobiili hand-off sketch, a privacy/MyData stance (L2056-2058) and Finnish-language support, as a direct hit on the 20% integration criterion.
- **Benchmarks.** Compare against Statistics Finland data (suggested at L2058-2060) with cited source.
- Avoid: a fixed set of charts (the brief says users should explore freely, L2056-2058), investment advice, unlabelled persona guesses.

## Limitations
- The WebSearch budget (200 shared calls) ran out partway; Cleo/Monarch/Emma/YNAB, Junction 2025 fintech winners and "safe to spend" product comparisons were not searched. Several URLs returned 403 (Finextra, Devpost, Cleo).
- Search-snippet-only sources are marked as such above.

<!-- complete -->
