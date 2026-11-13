# Opportunity discovery: "The Web Is Your Real-Time Database" (Context.dev, Data Track)

Agent C (opportunity discovery). Written 2026-11-13.

**Summary**
- The obvious move, "monitor a page, then send an LLM summary", is already a commodity (competitive.md §3-4). The gaps are in what happens **after** a change is detected: fusing it with other sources, **measuring** it against ground truth, and **closing the loop** with an action for a named user.
- Five directions look open. (1) A lead-time engine that shows the web announces things before the news does. (2) Live economic indicators backtested against official statistics. (3) Fact-checks that re-check themselves when their sources change. (4) Closed-loop agents for one niche operator. (5) Consumer experiences built from the rarely used transaction-to-merchant lookup.
- The strongest fit for both the sponsor and the overall jury is a direction that produces **a number nobody else can fake**, such as "hours of lead time over the news" or "error against the official CPI". It matches the "honest measured evidence" lens on the jury rubric, and the CTO, who is lead judge, also sits on the overall jury (00-rules-and-jury.md:L8, L99).
- Estimates: differentiation 6/10, demo 7/10, jury fit 6/10. Every candidate stacks honestly with Best Use of Context.dev, and most stack cheaply with Tiger Data, Gemini or Codex.

Note on sources: the shared web-search budget ran out partway through this task. Claims below rest on the challenge text, docs pages I opened on docs.context.dev, and Agent B's and Agent D's reports. Anything I could not verify is marked "unknown" or "estimate".

---

## Underused sponsor capabilities (from the docs)

These features are documented but absent from the challenge's examples and from the obvious ideas list (competitive.md §5). Mentors are therefore unlikely to have seen many projects use them (estimate).

| Capability | What it does | Source |
|---|---|---|
| **Sitemap monitors** | Report URLs that **appear or disappear** in a site's sitemap, with include/exclude path filters and a double read to avoid false alerts during a sitemap rebuild. A new `/pricing/enterprise` or `/careers/…` page can show up before any announcement. | https://docs.context.dev/monitors/targets/sitemap.md |
| **Semantic search monitors** | Run a web query on schedule. An AI judge keeps only *new developments* that match natural-language `instructions`. The output has `title`, `summary`, `importance`, `evidence` and `matched_urls`. | https://docs.context.dev/monitors/targets/search.md |
| **Semantic page monitors with `instructions`** | Filter out cosmetic changes ("ignore dates and typo fixes"). | https://docs.context.dev/monitors/overview.md |
| **News `type` and `story_id`** | Articles are labelled `editorial`, `press_release`, `regulatory_filing` or `advisory`. `story_id` groups syndicated copies of one story. Entity search accepts a company name, domain, ticker or ISIN, and returns `match.confidence`. | https://docs.context.dev/news/overview.md |
| **Brand lookup by transaction** | Resolves a raw bank or card descriptor (with MCC, country and city hints) to a brand profile, or returns `NOT_FOUND`. | https://docs.context.dev/brand/lookup-by-transaction.md |
| **Highlights** | Return passages from a page that answer a given question. This also works on **YouTube transcripts**. | https://docs.context.dev/scrape/highlights.md |
| **Prebuilt parsers** | TikTok, Instagram, Reddit, YouTube, G2, Yelp, Tripadvisor, Google Maps, Google Play and App Store. | https://docs.context.dev/llms.txt |
| **Extract monitors** | Watch a site's key pages against a JSON schema and return diffs, summaries and evidence. The baseline data refreshes only about once a day. | https://docs.context.dev/monitors/targets/extract.md |
| Browser actions | Click, scroll and wait. These need a **paid plan**; on Free they return `403 PAID_PLAN_REQUIRED`. | https://docs.context.dev/scrape/browser-actions.md |

Constraints that shape every direction (from feasibility.md):
- Monitors run at most every 10 minutes.
- Search monitors only report results published after the monitor was created, so **create monitors on Friday night**.
- Plan limits are in conflict between the challenge text and the docs (unknown until checked on site).
- Webhook latency is undocumented.

The live moment on stage therefore needs a source we control, or our own direct scrape. The monitors supply the history from the weekend.

---

## Opportunity 1: The lead-time engine ("the web leaks before the news")

**Gap.** Monitoring tools say *that* something changed. None of the products Agent B found say *how early* we knew compared with the moment it became news. Companies leave traces before they announce anything: new sitemap URLs, job postings, edits to pricing pages, press-release drafts and filings. No product we found measures and sells that **lead time** as the core metric (estimate, based on the product set in competitive.md §3; search budget exhausted).

**Evidence.**
- Sitemap monitors detect new URLs, page monitors detect semantic edits, and news search returns `published_at`, `type` and `story_id`. Together they let us timestamp "first web trace" against "first news article" for the same event.
- The judging asks "one scrape call or interesting combination of different sources?" (CHALLENGES.md:L1712-L1714) and "react to change over time" (L1724-L1726).

**Why the sponsor would care.**
- It is the clearest argument for buying Context.dev monitors rather than a news API: "our customers learned X hours earlier".
- It uses the newest products (monitors arrived in beta in July 2026 and news search in October 2026, per competitive.md §2).
- It is a story they can post as marketing (L1698).

**How the overall jury would read it.**
- The metric is legible in one sentence: "On 14 events this weekend we saw it a median of N hours before the first article".
- It suits the jury's "distinctive insight" and "metric that cannot be gamed" lenses (00-rules-and-jury.md:L132, L134). Failure cases (false early signals) are easy to show.
- Risk: real events during a 40-hour window may be few. A backfill over historical news plus the Wayback Machine could fix that (estimate; that data source is unverified).

**Live demo.** Publish a new page on a site we control. The sitemap or page monitor fires, the agent drafts the alert and the evidence trail, and a "lead time vs news" counter starts on screen.

---

## Opportunity 2: Live economic indicators with a ground-truth backtest ("Scrape the Economy", done honestly)

**Gap.**
- Official price and labour statistics are monthly, with a lag. MIT's Billion Prices Project showed that online prices can produce **daily** price indexes across several countries (https://www.nber.org/papers/w22111), with lags of about three days versus a monthly CPI (search snippet from news.mit.edu; not opened, treat as unverified).
- That capability sits with academics and the commercial PriceStats. A small team can now build a **local, niche, open** version, for example a Helsinki grocery basket, Nordic rents or tech job postings. LLM structured extraction removes the per-site scraper maintenance that once made this impractical (estimate). The sponsor's GPU tracker shows the pattern but publishes only a ledger, with no validation (competitive.md §2).

**Evidence.**
- The theme is named in the brief (CHALLENGES.md:L1667).
- JSON extraction costs 5 credits per successful page, so a basket of about 200 items refreshed several times a day fits the budget if we extract only on a hash change (feasibility.md §3; budget is an estimate).

**Why the sponsor would care.** It matches their first theme, uses batch and extract at scale, and becomes a public index that keeps citing them (like GPU Rental Prices).

**How the overall jury would read it.**
- Strong on honest evidence: plot our nowcast against the last few official releases and show the error.
- Weaker on "specific user" unless we name one, such as a treasury analyst, a journalist or a tenant union. Real-timeness on stage is weak, because prices do not move in five minutes. The demo moment has to be a controlled price change propagating into the index, plus the weekend history.

**Risks.**
- Site terms. The brief makes respecting them our responsibility (L2842).
- Official Finnish release timing: unknown (not checked).

---

## Opportunity 3: Self-rechecking fact-checks ("Truth at Internet Speed", over time)

**Gap.**
- Fact-checkers and paste-a-claim tools check a claim **once** (competitive.md §3 lists Factiverse, ClaimCrush and Doublecheck as live-claim checkers).
- Nothing we found keeps a verdict **alive**: when a cited source is edited or retracted, or new evidence appears, the verdict should flip and everyone who relied on it should be told. That fits this challenge's real-timeness criterion (L1726) better than a one-shot checker.
- Users would include newsrooms, policy teams, Wikipedia editors and AI-answer audits. That the lifecycle gap is unserved is an estimate; I could not verify it with search.

**Evidence.**
- Semantic page monitors with instructions such as "report changes to figures, dates or retractions" fit this directly.
- Highlights pull the exact supporting passage from the source.
- News search with `type: advisory/regulatory_filing` and semantic search monitors find new contradicting evidence.

**Why the sponsor would care.** It hits the "Truth at Internet Speed" theme (L1673) without being the commodity checker, and it shows off monitors, highlights and news together.

**How the overall jury would read it.**
- The before/after is very legible. On stage, edit the figure on our own source page and watch a claim card turn from green to red, with the diff and the passage.
- Accuracy can be measured on a labelled set of real source revisions.
- Risk: it reads as "media tooling" and needs a sharp named user to score on impact.

---

## Opportunity 4: A closed-loop agent for one niche operator (change, then fused context, then action)

**Gap.**
- Generic monitors stop at the alert (webdog, changedetection.io, Firecrawl /monitor; competitive.md §3-4).
- The challenge asks for "decisions, actions or experiences" (L1653), and its intro names the analysts who "copy-paste prices, check supplier websites by hand and read the news to catch risks" (L1651).
- The gap is the step after the alert: fuse the change with entity news, company enrichment and an internal record, then **do** something. Examples: draft the re-order to a backup supplier, re-price our listing, open a ticket with the evidence, or update the CRM.
- Candidate niches (estimate; demand unverified):
  - procurement teams at SMEs watching about 30 suppliers;
  - e-commerce sellers watching competitor pricing and stock;
  - bid managers watching public-tender portals and buyer news;
  - VC or sales teams watching portfolio or target companies for hiring and pricing moves.

**Evidence.**
- Entity news by domain, ticker or ISIN, with `match.confidence` and `story_id` deduplication (news overview).
- Semantic page and search monitors (monitors docs).
- Company and people enrichment (L1690).
- The obvious-ideas list shows competitor monitors to Slack are crowded. The *action plus fusion* part is the uncrowded half (competitive.md §6, §8).

**Why the sponsor would care.** It uses four or more endpoint families in one core flow, which is exactly their customer story (e.g. Zero, Sixtyfour on their blog; competitive.md §2).

**How the overall jury would read it.**
- Credible business value and a clear "next user".
- But it is the most likely direction to look like "another B2B dashboard" at the peer-review table unless the action visibly happens in seconds and the user is concrete.
- Best combined with Opportunity 1's lead-time metric, so there is a number to show.

---

## Opportunity 5: Consumer "live web" experiences from the transaction-to-brand lookup

**Gap.**
- `by_transaction` turns a cryptic card descriptor into a real merchant with logo and domain (brand lookup by transaction).
- Chaining it with monitors on that merchant's **pricing and terms pages** gives a consumer product that is not in the obvious list. It could alert "Your subscription's price page changed, and your next charge will be €X", or "Their cancellation terms changed", and draft the cancellation or refund email.
- It also covers "Brand in a Box" (L1671) honestly, since each alert card is auto-branded.
- An alternative using our mobile strength: a phone or Meta-glasses glance at a storefront or product that pulls live reviews (the Google Maps, Yelp and Tripadvisor parsers) and live prices. Any such glasses capability is unverified here, and it would make this a consumer-device project.

**Evidence.**
- The endpoint exists, with MCC, country and city hints. Its credit cost is not listed on that page (unknown).
- Page monitors with `instructions` can ignore cosmetic edits.
- Bank data would be mocked or uploaded as a CSV for the demo (demo-first convention). A live PSD2 bank connection is out of scope (estimate).

**Why the sponsor would care.** It exercises an endpoint almost nobody will use, plus brand and monitors, in a consumer story suited to social media.

**How the overall jury would read it.**
- A relatable user and a wow moment ("upload statement, see every merchant become a live watched entity").
- Weaker technical depth unless we show measured merchant-resolution accuracy and alert precision.
- Real-world money impact is easy to explain in 60 seconds.

---

## Combinations that are newly practical (estimates)

- **Semantic judges plus our own evaluation layer.** Context.dev's monitor judge decides relevance. We add a labelled set and report precision and recall of "meaningful change", which is a technical-execution score (L1720-L1722) few teams will show.
- **Time-series store plus the monitor event stream.** A real event-sourced history makes "since Friday night, X changed 14 times" a first-class view (Tiger Data fits naturally).
- **LLM structured extraction instead of handwritten parsers.** Multi-site indices (Opportunity 2) cost hours rather than weeks to set up, which a 40-hour team could not do before reliable schema extraction (estimate).
- **YouTube transcripts and social parsers with highlights.** These turn video and social chatter into timestamped claims or signals for Opportunities 1 and 3.

## Stackable tech challenges (honest fit)

| Tech challenge | Fit | Note |
|---|---|---|
| Best Use of Context.dev | **Yes, natural** | Core flow and visible demo are guaranteed. Needs the repo plus a note on the endpoints used and why (CHALLENGES.md:L2780-L2789). |
| Best Use of Tiger Data | Yes | Snapshots and change events are time series (Opportunities 1, 2). |
| Best Use of Gemini API / Codex | Yes, low effort | Gemini for the decision or extraction layer; Codex in our dev workflow. Gemini needs a written explanation, and participants must be 18+. |
| Best Use of Aiven / MongoDB Atlas | Plausible | As the primary store. Pick only one database sponsor. |
| Best Use of ElevenLabs | Weak to plausible | A voice briefing of overnight changes (Opportunity 4). Risk of looking bolted on. |
| Best agentic usecase of Oxylabs | **Avoid** | It is a competing web-data API. Using both in the core flow muddies the Context.dev story (estimate). |
| Verda / Modal | Only if we self-host models | For example, a fine-tuned change-relevance classifier. Medium effort and not needed. |

## Estimates

- **Differentiation potential: 6/10.** The field will be crowded with monitors, trackers and fact-checkers (competitive.md). Opportunities 1, 3 and 5 sit outside that cluster, and the measured-evidence angle is rare. But the API is open to everyone, and the core mechanic is easy to copy.
- **Demo potential: 7/10.** A controlled page edit that flips a verdict or fires an action in seconds is very legible. Monitor latency is undocumented and real-world sources are slow, so the live moment must be engineered, with a replay fallback (feasibility.md §6).
- **Jury fit: 6/10.** It is strong on "honest measured evidence" and "technical insight", the lenses of the CTO, who sits on both panels (00-rules-and-jury.md:L99). It is weaker on peer-floor "wow" than hardware or consumer-device projects. Its overall-win chance depends on a sharply named user and one striking number.
- **Best combined bet (estimate):** Opportunity 1 (lead time) or Opportunity 3 (self-rechecking fact-checks). Either can be fused with Opportunity 4's closed-loop action for one named user.

<!-- complete -->
