# The Web Is Your Real-Time Database (Context.dev, Data Track)

**Summary**
- Context.dev, a YC-backed web-data API startup, wants "a product that reacts to the live web" built on its API (CHALLENGES.md:L1631-L1639). Each team gets 50,000 free credits (CHALLENGES.md:L1687).
- Judging uses five criteria at 20% each: real-world impact, creative use of live web data, demo completeness, technical execution (latency and accuracy) and **real-timeness** ("does it react to change over time or take a one-off snapshot?") (CHALLENGES.md:L1706-L1726).
- Prizes are €2,000 + swag for 1st, €500 + swag for 2nd and swag for 3rd (CHALLENGES.md:L1728-L1740). A companion tech challenge, "Best Use of Context.dev", can be stacked on the same project (CHALLENGES.md:L2764-L2789).
- It needs no hardware and plays to our strengths (TypeScript, LLM agents, data pipelines). The risk is that the obvious ideas (price trackers, news monitors) are crowded. To win, a project has to fuse several live sources into a decision or action that changes visibly during the demo.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | The Web Is Your Real-Time Database | CHALLENGES.md:L1631 |
| Sponsor | Context.dev | CHALLENGES.md:L1635, L1702-L1704 |
| Track | Data Track | CHALLENGES.md:L1629 |
| Main requirement | "Build a product that turns live web data into decisions, actions or experiences that weren't possible before." | CHALLENGES.md:L1653 (also L1639) |
| Mandatory use of the Context.dev API | **Unknown** for the main challenge. It is not stated there, though it is clearly expected. The companion tech challenge does require it: "at least one Context.dev endpoint in its core flow" | CHALLENGES.md:L2780-L2785 |
| Judging emphasis | Real-world impact 20%, creative use of live web data 20%, completeness of demo 20% ("How ready is it for production?"), technical execution 20% ("Latency and accuracy of data"), real-timeness 20% | CHALLENGES.md:L1706-L1726 |
| Prize | 1st €2,000 + swag; 2nd €500 + swag; 3rd swag. Context.dev would also "love to feature standout projects on our social channels" | CHALLENGES.md:L1728-L1740, L1698 |
| Provided APIs | Web: search, scrape (markdown/HTML/screenshots/images), crawl, URL mapping, structured extraction, research answers. Entities: brand data, company/people search and enrichment, NAICS/SIC. Signals: news search, monitors with webhooks. Scale: batch API, PDF/document parsing | CHALLENGES.md:L1689-L1692 |
| Additional capability (tech challenge text) | Scraping social media feeds such as TikTok and Instagram | CHALLENGES.md:L2812 |
| Credits / limits | 50,000 non-expiring credits per team with code JUNCTION26, and up to 50 concurrent requests | CHALLENGES.md:L1687, L2797 |
| Rate limits | The tech challenge says "There is no rate limit, with a maximum of 50 concurrent requests per organisation" (CHALLENGES.md:L2797). The public quickstart says the Free plan allows 10 requests per minute (https://docs.context.dev/quickstart). **Conflict: ask a mentor whether redeeming JUNCTION26 lifts the per-minute cap.** | as cited |
| Data / hardware | No dataset is provided: "the live web is your dataset". No hardware | CHALLENGES.md:L2797 |
| SDKs / tooling | TS/Node, Python, Ruby and Go SDKs, CLI, MCP server (https://mcp.context.dev/mcp), agent skill, Playground | CHALLENGES.md:L2819-L2835 |
| Mentors | CTO Beer van der Drift, CEO Yahia Bakour and engineer Thomas Oomens. On site Fri until 23:00, Sat 09:00 to Sun 02:00, and Sun 07:00 to the end | CHALLENGES.md:L1681-L1683 |
| Submission requirements (main challenge) | **Unknown.** The challenge text gives none. The general Junction platform rules are not in this source | — |
| Submission requirements (Best Use of Context.dev) | "a GitHub repository and a demo of your project, plus a short note on which Context.dev endpoints you used and why" | CHALLENGES.md:L2789 |
| Judges | Unknown by name. Partner judges choose challenge awards (jury/pitch guide PDF, p.1 overview), so it is presumably Context.dev staff (**estimate**) | 00-Jury-profiles-and-pitch-guide.pdf |

### Credit costs (from https://docs.context.dev/account/credits)
Scrape costs 1 credit (+4 if JSON extraction succeeds). Crawl costs 1 per page, search 1 per 10 results and news 1 per 10 results. Answers cost 10 (`fast`) or 100 (`ultra`, the default). Brand costs 10 and styleguide 10. People search costs 10 or 50 per page, people enrich 20 per match and company search 2 or 10 per page. A monitor run costs 1 (page/sitemap), 2 (search/browser actions) or 10 (extract). **Estimate:** 50k credits covers a hackathon comfortably, but only if we avoid the default `ultra` Answers mode (100 credits per call) and do not set high-frequency extract monitors on many targets.

### Monitors (the "real-timeness" primitive), from https://docs.context.dev/monitors/overview.md
- Target types: `page` (exact or semantic detection via `instructions`), `sitemap`, `extract` and `search`.
- The default schedule is daily. Interval schedules exist, e.g. `{"type":"interval","frequency":1,"unit":"days"}`. **The minimum interval is unknown** (not described). Ask the mentors, because this matters for showing live change in a demo.
- Webhooks: `webhook.url` with a signing secret and events `change.detected` / `run.completed`. Deduplicate on the `X-Context-Id` header.
- The first run is a baseline and never reports a change.

### Gotchas from the official text (CHALLENGES.md:L2839-L2842)
- A 200 response can contain a failed output, so check `success`.
- Results are **cached for up to 3 days by default**. Use `maxAgeMs: 0` for fresh data (cached results cost the same). This matters directly for the real-timeness criterion.
- Crawls, batches and monitors are asynchronous, so local webhooks need a tunnel.
- Some sites block automated access, and teams must respect site terms.

## 2. What the sponsor is actually trying to encourage

**Reading (inference):** Context.dev is a young API company (YC S26, $9M seed, CHALLENGES.md:L1704). It wants (a) showcase projects it can post as marketing (L1698) and (b) proof that its *less obvious* endpoints, monitors/webhooks, brand, enrichment and news, unlock products beyond "scrape a page and summarise it". The evidence for this reading:
- Real-timeness is a full 20% criterion, and its wording explicitly rejects "a one-off snapshot" (L1724-L1726). Static scraping demos are penalised.
- "Creative use of live web data" asks "One scrape call or interesting combination of different sources?" (L1712-L1714), which rewards multi-source fusion.
- The themes map one-to-one onto product lines. *Scrape the Economy* uses scrape/batch, *The Web, Watched* uses monitors and news, *Brand in a Box* uses the brand API, and *Truth at Internet Speed* uses search/answers (L1665-L1673 vs L1689-L1692).
- The example projects are their own marketing showcases: the GPU price tracker and Yapper leaderboard are live Context.dev examples (CHALLENGES.md:L2850), the Stan blog post is a customer case study (https://www.context.dev/blog/stan-builds-an-internal-leaderboard-with-context-dev, which names no specific endpoints), and the Ferndesk story is a brand.dev case (L1661).
- "Completeness of demo ... How ready is it for production?" (L1716-L1718) means they want something that looks like a real product that could become a customer, not a research toy.

## 3. Explicit requirements, quoted

- "Build a product that reacts to the live web." (CHALLENGES.md:L1639)
- "Build a product that turns live web data into decisions, actions or experiences that weren't possible before." (CHALLENGES.md:L1653)
- Judging: "Real-world impact(20%) Does this connect to a real business or consumer need?", "Creative use of live web data(20%) One scrape call or interesting combination of different sources?", "Completeness of demo(20%) How ready is it for production?", "Technical execution(20%) Latency and accuracy of data", "Real-timeness(20%) Does it react to change over time or take a one-off snapshot?" (CHALLENGES.md:L1708-L1726)
- Stacked tech challenge: "your project must call **at least one Context.dev endpoint in its core flow**, not just as a side feature"; "The data from Context.dev must **visibly drive something in the demo**"; "Submit a **GitHub repository and a demo of your project**, plus a short note on **which Context.dev endpoints you used and why**." (CHALLENGES.md:L2780-L2789)
- "Teams are responsible for respecting the terms of the sites they use." (CHALLENGES.md:L2842)

## 4. What a mediocre submission looks like (estimate)

- A single-source dashboard that scrapes one category of prices once, shows a table and calls it "live". It fails real-timeness and creativity, and the sponsor's own GPU tracker already does this (https://gpurentalprices.com/, L1657).
- A "chat with any URL" or "summarise the news about company X" wrapper around one scrape or answers call. It adds nothing beyond the Playground.
- A fact-checker that runs one search query and asks an LLM for a verdict, with no source quality handling, latency figures or accuracy evaluation.
- A demo that relies on 3-day-cached data (no `maxAgeMs: 0`), so nothing changes on stage.
- Webhooks that only work on a laptop, a demo that breaks when a site blocks the scraper, and no fallback.

## 5. What an exceptional submission would demonstrate (estimate)

- **Visible change on stage.** Something on the web changes, or a scheduled monitor or search fires, and within seconds the product makes a decision or takes an action (alert, re-rank, re-price, re-brand, flag a claim). A timeline or diff view shows how the product reacted over the weekend, not just a snapshot. This scores directly on real-timeness.
- **Fusion of three or more heterogeneous sources** (e.g. monitors + news + company enrichment + social feeds + PDF filings) into one derived signal no single source gives, like a live "supplier risk index" or a "scraped inflation index" (the *Scrape the Economy* theme).
- **A named user and a decision.** For example a procurement analyst who stops checking 40 supplier sites by hand (cf. L1651), with a clear "what action happens now" step, ideally an agent that acts rather than just displays.
- **Measured technical execution**: shown end-to-end latency (change on the web → action), extraction accuracy on a small labelled set, and dedupe and error handling (`success` flags, retries, webhook dedupe on `X-Context-Id`). Our ML/eval background is an edge here.
- **Production feel**: deployed URL, a working onboarding flow (e.g. Brand-in-a-Box self-branding from the judge's own email is a strong live interaction), and a clean UI.
- **Showcase value for Context.dev**: it uses less obvious endpoints (monitors, brand, enrichment) well enough that they would post it (L1698).
- For the overall prize (inference): data-plumbing projects can feel abstract to a general jury. Pairing the live data with a vivid consumer or civic story, or with a mobile/wearable surface (e.g. a push or glasses alert when something you care about changes), would widen its appeal beyond the partner judges.

## 6. Constraints that could disqualify or sink a project

- **Not using Context.dev in the core flow.** Explicit for the tech challenge (L2780). For the main challenge this is unknown as a formal rule, but **estimate:** a project not built on Context.dev would be judged poorly by Context.dev judges.
- **Scraping sites against their terms**: teams are responsible (L2842). Avoid demos built on scraping sites that forbid it (e.g. some marketplaces or social networks), especially if presented as production-ready.
- **Personal data**: people search/enrichment touches personal data. A project that profiles private individuals could raise GDPR and ethics objections from judges (**estimate**; the challenge text does not mention this).
- **Credit exhaustion**: `ultra` Answers (100 credits) and extract monitors (10 per run) can burn the 50k budget (https://docs.context.dev/account/credits).
- **Rate-limit ambiguity**: 10 rpm on Free (quickstart) vs "no rate limit" (L2797). Confirm after redeeming the code.
- General Junction submission rules and deadlines: **unknown** from these sources.

## 7. Physical hardware work

**None.** "No special hardware is needed; the live web is your dataset" (CHALLENGES.md:L2797). All you need is a laptop with Node 20+ or Python 3.9+ and internet access (L2833). An optional consumer-device front end (phone notifications, Meta glasses) would be our choice, not a requirement.

<!-- complete -->
