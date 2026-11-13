# Opportunity discovery: The Internet Butler (Exa)

**Summary**
- Exa's brief asks for a personal agent that does the web digging for a tedious real-life task, carries it "as close to done as it can" and leaves the final approval to the user. It must be demoed on a real case (CHALLENGES.md:L709). Five criteria score 20% each: information a model could not know from training data, usefulness to a specific group, clarity of sources, originality, and live judge queries (CHALLENGES.md:L739-L757).
- The ideas named in the brief (rent-increase checker, benefits finder, flight claims, date planner) will each be built by several teams, and commercial tools already cover them (see competitive.md). The gaps worth chasing are not new task categories. They are (1) **rules that changed after model training cutoffs**, (2) **Finnish-language bureaucracy for international residents**, (3) **follow-through over days with Exa Monitors**, (4) **an evidence pack the counterparty has to accept**, and (5) **paper or photo in, approved action out**.
- The strongest single proof hook is real and very recent. Finland's amended Act on Residential Leases took effect on **1 October 2026**, six weeks before the event. Among other things, it shortened the landlord's notice periods (hekaoy.fi). A bare LLM will very likely give the old rules (estimate), and an Exa-backed agent with live fetching can show the new ones with citations.
- Estimates (ours): differentiation 6/10, demo 7/10, overall-jury fit 5/10. The partner prize is much easier to win than the overall prize, because Junction overall winners tend to be technically striking (competitive.md §1).

---

## What the brief rewards (for a teammate who has not read it)

| Item | Text | Source |
|---|---|---|
| Task | "Develop a personal agent that helps people get stuff done... find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case." | CHALLENGES.md:L709 |
| Areas | Special occasions, daily errands, rent, missed benefits, business information, travel disruption | CHALLENGES.md:L711 |
| Criteria (20% each) | Use of Exa beyond training data; usefulness to a specific group of real people; clarity in showing sources; originality; works on live queries, including the judges' own | CHALLENGES.md:L739-L757 |
| Exa features on offer | Search in fast, balanced and deep modes; Contents (full text, highlights, summaries, subpage crawling); date, domain and category filters; structured JSON; **past versions of pages**; Websets; **Monitors**; hosted MCP server; SDKs | CHALLENGES.md:L721-L725 |
| Prize | 1st: $2,500 cash, $5,000 Exa credits, a hoodie per person and a TRMNL dashboard. 2nd: $1,500 and $3,000 in credits. 3rd: $500 and $1k in credits | CHALLENGES.md:L761-L771 |

## Underused Exa capabilities (read from the docs)

These capabilities are in the docs, but the obvious ideas and Exa's own demo gallery barely use them. That makes them the cheapest source of originality points.

- **`snapshotAsOf`** returns "the newest stored version of each page as of this instant". It reads stored versions only and never fetches live (https://docs.exa.ai/reference/search). This lets the agent show what a page said before and what it says now. How well finlex.fi and kela.fi are covered by stored history is **unknown**, so it needs an hour-1 test.
- **`maxAgeHours: 0`** returns live content fetched within the last 60 seconds (https://docs.exa.ai/reference/search). The UI can show "fetched just now" next to a source.
- **`outputSchema` + `output.grounding`** gives per-field citations with a `low`, `medium` or `high` confidence. Schemas are limited to 10 properties and 2 levels of nesting, and the feature adds about 2 s (https://docs.exa.ai/reference/search). This maps directly onto the 20% Clarity criterion.
- **Monitors** (launched 30 March 2026) run a search on a schedule and post only *new* results to a signed webhook. They can return structured output with grounding. The minimum interval is one hour, and omitting `trigger` creates a manual-only monitor that can be fired on demand (https://exa.ai/docs/reference/monitors-api-guide, https://exa.ai/docs/changelog/exa-monitors-launch). Firing a run on demand is what makes a live demo possible despite the one-hour minimum.
- **Categories** `company`, `people`, `news`, `financial report` and `personal site` support counterparty research. `company` and `people` do not support date filters (https://docs.exa.ai/reference/search).
- **Agent API with Exa Connect** can attach up to five premium partner data sources to a run through `dataSources` (https://exa.ai/docs/reference/agent-api/connect/overview). Runs are asynchronous, and high effort costs $0.50 per run (feasibility.md §4). This suits an optional "deep dive" more than the live path.
- **What Exa already demos:** a gallery of 22 titles, including Web Chatbot, Voice Search, Grounding Comparison, Exa vs Native Search, Market Monitor and Morning Briefs. It has **no personal-task or approval-gated agent** (https://demos.exa.ai, opened, titles only). Generic chat, monitoring news and grounding comparisons are therefore already shown by Exa itself, so they are not original on their own.

---

## Opportunity areas

### 1. "The rules changed last month": temporal-correctness butler
- **Gap.** People ask LLMs about rules that changed after the training cutoff, and the answer comes back confident and wrong. The vertical tools that exist (rent checkers, EU261 claimers) are mostly US, UK or EU-generic (competitive.md §3). None of them visibly reason about which version of a rule applies on a given date.
- **Evidence that the change is real and recent:**
  - Finland's amended Act on Residential Leases applies from 1 October 2026 to new **and existing** leases. It shortens the lessor's notice period to 3 months for tenancies under 2 years and 4 months above that. It also adds a default smoking ban, electronic notices and new termination grounds (https://www.hekaoy.fi/?p=25570, opened).
  - Kela moved most students off the general housing allowance onto the student housing supplement on 1 August 2025. The supplement is **not granted automatically** and has to be applied for (Kela news pages, via search snippet: https://www.kela.fi/news/students-will-be-transferred-from-the-general-housing-allowance-scheme-to-the-student-housing-supplement-scheme-on-1-august-2025). This is a textbook "missed benefit".
  - EU261 has been reformed. A political agreement was reached in June 2026 and reportedly kept the 3-hour threshold (https://www.fiaregion1.com/eu-agreement-on-air-passenger-rights-preserves-core-consumer-protections/, snippet). One non-official source says it was published as Regulation (EU) 2026/2202, with most rules applying from 23 October 2027 (https://skyrefund.com/en/blog/eu261-reform-2026, snippet; **unverified**, so confirm on EUR-Lex). Either way, which version applies depends on the date of the flight.
- **Why Exa would care.** This is the literal first criterion: "information that could not have come from a model's training data alone" (CHALLENGES.md:L739-L741). It also showcases features most teams will not touch, `snapshotAsOf` and `maxAgeHours: 0`.
- **Demo before/after.** One lease question goes to a bare LLM and to the butler side by side. The bare LLM gives the pre-October notice period; the butler gives the new one, with the finlex or official passage highlighted and dated. If stored history exists, a page diff (`snapshotAsOf` versus live) sits next to it.
- **Overall jury.** Strong on "honest measured evidence" (15%). A small eval of about 20 date-sensitive questions comparing bare-LLM accuracy with the butler's is a metric that is hard to game. The insight is distinctive but not deep technically (estimate).
- **Risk.** How well Exa indexes Finnish legal pages and how much stored history it keeps is **unknown** (feasibility.md §5).

### 2. Finnish bureaucracy for international residents (cross-lingual butler)
- **Gap.** The authoritative sources (Finlex, Kela, Vero, DVV, Migri, municipal pages and tenant-board decisions) are often primarily in Finnish. The English versions are summaries or translations, and how fully and how quickly English mirrors Finnish is **unknown**; our estimate is that it lags. Competitive research found no Finland- or Kela-specific rent or benefits agent (competitive.md §3; not checked exhaustively).
- **Evidence.** Rental deposit disputes reach the Consumer Disputes Board (kuluttajariitalautakunta). The board's recommendations are not binding but were followed in about 65% of cases where compliance is known (2025 annual report, https://www.kuluttajariita.fi/app/uploads/sites/9/2026/05/Toimintakertomus-2025.pdf, via snippet). Reported decisions include a ruling that normal wear cannot be deducted from a deposit (https://www.mtvuutiset.fi/artikkeli/riittamaton-siivous-kalusteet-rikki-vuokranantaja-pidatti-vakuuden-nain-neuvoi-kuluttajariitalautakunta/9196212, snippet). The decision database itself could not be reached (404 on the guessed URL), so its searchability is **unknown**.
- **Why Exa would care.** It shows that meaning-based search finds the right Finnish passage from an English question, and it uses `includeDomains` whitelists, of which up to 1,200 are allowed (feasibility.md §2). This is long-tail content well outside training data.
- **Demo before/after.** An international student holds a Finnish-language letter (a rent increase or deposit deduction). The butler explains it in English, cites the Finnish source alongside a translation, finds analogous board decisions, and drafts a reply in Finnish for approval.
- **Overall jury.** Peer-floor legibility is high, because a large share of Junction participants are internationals who live this problem (estimate). The "specific user" (20%) is crisp: international students and new residents in Finland.

### 3. A butler that follows through: Monitors as a task's "wait" step
- **Gap.** Most real errands cannot be finished in one sitting. You wait for a response deadline, a Kela decision, a rule that is about to enter force, a rental listing that fits, or rebooked flight options. Today's agents answer once and forget (estimate). Exa's own monitor demos are a market monitor and morning briefs (https://demos.exa.ai), which are feeds, not task follow-through.
- **Evidence.** Monitors deliver only content they have not returned before, can return structured output with grounding, and support manual-only monitors that can be triggered on demand (https://exa.ai/docs/reference/monitors-api-guide). The feature is new (March 2026 launch, https://exa.ai/docs/changelog/exa-monitors-launch), so few teams will know it well (estimate).
- **Why Exa would care.** It uses a newly shipped product beyond search, and it creates recurring API usage, which is the developer-retention goal behind "keep supporting promising teams after the event" (CHALLENGES.md:L717).
- **Demo before/after.** The judge sets up a task. We trigger the monitor live, and a new source arrives through the webhook. The butler re-plans, and an updated draft appears with an "approve?" card. A pre-seeded monitor with a few days of history shows the longer arc.
- **Overall jury.** "Credible path forward" and "return reason" (15%) are built in, because a user comes back when the monitor fires. A webhook firing on stage needs a manual trigger to be reliable.

### 4. The evidence pack: output the counterparty has to accept
- **Gap.** General agents (ChatGPT Agent, Comet, Manus) answer with a list of links (competitive.md §3). A landlord, airline or Kela caseworker does not read a chat transcript. They read a letter. Neither the generic nor the vertical tools found attach the governing passage, its date and an archived copy to each claim in the outgoing letter (estimate from competitive.md; not exhaustively checked).
- **Evidence.** `output.grounding` already gives field-level citations with confidence (https://docs.exa.ai/reference/search). The approval-at-the-end requirement (CHALLENGES.md:L709) makes a drafted, cited action the natural final artifact.
- **Why Exa would care.** It turns the Clarity criterion (CHALLENGES.md:L747-L749) into the product itself rather than a side panel. Low-confidence claims are flagged instead of being asserted.
- **Demo before/after.** A messy situation goes in. Out comes a one-page letter where every sentence has a footnote holding the quoted source passage, its URL and the fetch date, plus a "claims I could not verify" box. The user edits it and approves it, and nothing is sent automatically.
- **Overall jury.** It reads as trustworthy AI, and the "could not verify" box is honest failure handling. It is a modest step technically on its own, so combine it with area 1 or 2.

### 5. Paper or photo in, approved action out (multimodal intake)
- **Gap.** Tedious tasks usually begin with a document: a rent-increase notice, a Kela decision, an airline email, a parking fine. Typing the facts in is the friction. This plays to the team's mobile and wearables strength. Consumer glasses or phone-camera capture is an option, and it needs no physical hardware debugging.
- **Evidence.** That the brief's examples (rent, benefits, travel disruption) arrive as letters is our inference from CHALLENGES.md:L707-L711. The Gemini API tech challenge rewards a "meaningful" Gemini use with a written explanation (_tech-challenges.md row 9, CHALLENGES.md:L2470-L2542), and a multimodal document reader fits that honestly.
- **Why Exa would care.** It is neutral for Exa. It improves Usefulness and the real-case demo, but Exa remains the retrieval layer.
- **Demo before/after.** Point the phone at a physical letter. Within about 60 s the screen shows what the letter means, which rule applies (cited), what you can do, and a drafted reply awaiting approval. This is the most legible before/after for peer review (estimate).
- **Overall jury.** It scores high on wow and legibility. On its own it is "OCR plus agent" and not deep, so treat it as the front end for areas 1 to 4.

### 6. (Secondary) Counterparty check: who am I dealing with?
- **Gap.** Before disputing something or signing, people want to know about the other side: the landlord company, a contractor, an airline's rejection pattern. Exa's `company`, `people` and `news` categories (https://docs.exa.ai/reference/search) make this cheap, but Exa already demos company and people enrichment and adverse-media checks (https://demos.exa.ai). It is useful mainly as a sub-step, for example "this landlord company has N public board disputes". **Low originality on its own.**

---

## Combinations that are new now (inference)
- **Stale-LLM baseline plus point-in-time retrieval.** Measuring how wrong a frontier model is on recently changed rules, and fixing it with dated retrieval, only became demonstrable once rules changed after model cutoffs. The recent Finnish lease change is a gift for this.
- **Cross-lingual meaning search plus LLM drafting in the official language.** An agent that reads Finnish sources and writes Finnish letters for an English speaker was impractical before good multilingual LLMs and semantic search (estimate).
- **Monitors plus an approval-gated action queue.** This turns the butler from a single answer into an ongoing errand runner.

## Stackable tech challenges (honest fit)

| Tech challenge | Honest? | How |
|---|---|---|
| Best Use of Codex | Yes | It is a dev-process claim, and the team already runs Codex (_tech-challenges.md row 8). |
| Best Use of Gemini API | Yes, if Gemini does real work | Multimodal letter reading (area 5) or the drafting LLM. All members must be 18+ (CHALLENGES.md:L2518). |
| Best Use of ElevenLabs | Plausible | Voice intake or a read-aloud explanation for low-literacy or non-Finnish users. Criteria are unknown. |
| MongoDB Atlas / Aiven | Plausible, low value | Persist cases, monitor state and the audit trail of approvals. |
| Context.dev or Oxylabs | Risky | Both are live web-data APIs that overlap with Exa. Using one could dilute the "built on Exa" story (inference). Oxylabs also requires buying and then cancelling a $500 plan (_tech-challenges.md row 18). Use at most one, for a clearly distinct role such as scraping a dynamic form page Exa cannot render. |
| Cloudinary | Weak | Only if photo upload (area 5) is central, and it adds a survey form. |

## Recommended framing (for the idea stage)
Combine **area 1 (temporal correctness) with area 2 (Finnish, for internationals)** as the core, use **area 4 (evidence pack)** as the output format and **area 5 (photo intake)** as the front end, and add **area 3 (Monitors)** as the stretch goal. This lands each of Exa's five 20% criteria on a visible screen moment. It avoids the duplicated generic "rent checker" because it is tied to a law that changed six weeks ago, for a user group the global tools ignore.

## Estimates (ours)
- **Differentiation potential: 6/10.** The task category is crowded (competitive.md: saturation high). Differentiation comes from execution: date-aware retrieval, Finnish sources and Monitors follow-through. Other teams can reach "Finnish rent" too, so it is not a moat.
- **Demo potential: 7/10.** A photo of a real letter becomes a cited, approval-ready reply, with a bare-LLM side by side being visibly wrong on the October 2026 rule. That is a strong before/after. The risks are latency (deep search takes 4-12 s) and unknown Finnish index coverage (feasibility.md §4-§5).
- **Overall-jury fit: 5/10.** It fits well on specific user, measured evidence and legibility. It is weaker on "distinctive technical depth", and past Junction overall winners were technically striking projects rather than research agents (competitive.md §1). This is a better bet for the partner prize than for the overall win.

## Unknowns to resolve early
- Exa index coverage and stored-snapshot history for finlex.fi, kela.fi and kuluttajariita.fi
- Whether the Consumer Disputes Board's decisions are searchable online (the guessed URL returned 404)
- The final EU261 reform status (EUR-Lex)
- Monitors pricing under event credits (not on the guide page)
- Exa's submission format

<!-- complete -->
