# The Internet Butler / Your Personal Assistant (Exa): challenge intelligence

**Summary**
- Exa (a search API built for AI) asks for a personal agent that takes a tedious real-life task such as rent law, benefits, travel disruption or occasion planning, digs through the live web with Exa, and gets it "as close to done as it can," leaving final approval to the user, demoed on a real case (CHALLENGES.md:L705-L711).
- Judging is five equal criteria at 20% each: use of Exa beyond training data, usefulness to a specific group of real people, clarity of sources, originality, and a working demo on **live queries the judges type themselves** (CHALLENGES.md:L737-L757).
- The prize is $2,500 cash plus $5,000 in Exa credits for 1st place (CHALLENGES.md:L761-L763). The software-only stack plays directly to our strengths, and there is **no physical hardware work**.
- The main risk is that the space is crowded, since a generic "research assistant" also describes Perplexity Comet and Exa's own Agent API. Our estimate is that the win goes to a narrow, real user group, an agent that ends in a concrete drafted action, and a source trail that is visible on every claim.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | The Internet Butler / Your Personal Assistant | CHALLENGES.md:L697 |
| Sponsor | Exa (exa.ai) | CHALLENGES.md:L701, L733-L735 |
| Track | Agentic AI Track (listed under "Main Challenges") | CHALLENGES.md:L7-L9 |
| Main requirement | "Develop a personal agent that helps people get stuff done… find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case." | CHALLENGES.md:L709 |
| Judging emphasis and weights | Use of Exa 20%, Usefulness 20%, Clarity of sources 20%, Originality 20%, Working implementation on live queries 20% | CHALLENGES.md:L737-L757 |
| Prize | 1st: $2,500 cash, $5,000 Exa credits, Exa hoodie per person, Exa-branded TRMNL dashboard. 2nd: $1,500 cash, $3,000 credits, hoodie per person, Exa macropad. 3rd: $500 cash, $1k credits, hoodie per person. Every participant gets $50 in credits | CHALLENGES.md:L759-L775 |
| Prize caveat | The challenge body still contains unfilled template placeholders ("\[cash amount\]", "\[API credits\]"). It is unknown whether the credits for "every team that submits a working project built on Exa" are separate from the $50 per participant. We treat the Prizes list (L759-L775) as authoritative, but this should be confirmed on site | CHALLENGES.md:L715 |
| Provided APIs/data | $50 in Exa credits per participant (code EXA50JUNCTION, redeemed at dashboard.exa.ai/billing) and the full API: the Search API (fast/balanced/deep modes), the Contents API (full text, highlights, summaries, subpage crawling), date/domain/category filters, structured JSON output, past page versions, Websets, Monitors, a hosted MCP server, Python/JS SDKs, the demos.exa.ai gallery, on-site Exa engineers and Discord | CHALLENGES.md:L721-L729 |
| Provided hardware | None | CHALLENGES.md:L719-L729 |
| Submission requirements | Not stated in the challenge text beyond "Demo on a real case" and a demo that works on live judge queries. Repo, video or form requirements are **unknown** | CHALLENGES.md:L709, L757 |
| Original page | https://hackjunction.app/participate/45/challenges/298 (a JS app that returned no content when fetched, so it could not be verified) | CHALLENGES.md:L699 |

**API facts from the sponsor docs, which are useful for sizing our credit budget**
- The `/search` `type` values are `auto` (default), `lite`, `deep-lite` (~4 s) and `deep` (multi-step with synthesis). `fast`/`instant` are legacy. Category filters are `company`, `publication`, `news`, `personal site`, `financial report` and `people`. `outputSchema` returns structured JSON, with at most 10 properties and 2 nesting levels. `maxAgeHours: 0` forces live content, and `snapshotAsOf` returns past page versions. Source: https://docs.exa.ai/reference/search
- Pricing: search `lite` costs $4/1k and `auto` $7/1k, `deep`/`deep-lite` $12/1k, contents $1/1k pages, Answer $5/1k, and Monitors $2/1k. The Exa Agent API runs $0.012 (minimal) to $1.00 (xhigh) per request. Source: https://exa.ai/pricing
- Exa Agent (launched 16 June 2026) is a single API for deep research, list-building and enrichment with subagents and `outputSchema`. Source: https://exa.ai/blog/exa-agent
- Websets are asynchronous verified-list building with criteria and enrichments. The free plan caps a webset at 25 results, the **Websets API requires a paid Websets plan**, and it bills separate credits. Whether the event access covers this is unknown, though the challenge says Websets "will be provided" (CHALLENGES.md:L725). Source: https://docs.exa.ai/websets/api/overview
- Our estimate: $150 in team credits ($50 × 3) covers roughly 12k `deep` searches or about 150 `high`-effort Agent calls, which is enough for development and judging if we cache during development.

## 2. What the sponsor is actually trying to encourage

**Reading (inference):** Exa wants showcase apps that prove *"search built for AI"* gives agents information an LLM cannot hallucinate its way to: fresh, local, long-tail and verifiable facts. It also wants teams to become paying API users after the event.

Evidence:
- "Use of Exa to retrieve information that could not have come from a model's training data alone" is a 20% criterion (CHALLENGES.md:L739-L741). This is a direct pitch for Exa against native LLM knowledge. Exa's own demo gallery has an "Exa vs Native Search" and a "Grounding Comparison" demo (https://demos.exa.ai).
- "Clarity in showing sources" is weighted equal to everything else (CHALLENGES.md:L747-L749), so trustworthy, citation-first UX is part of the product story.
- "We are joining Junction to meet builders… and keep supporting promising teams after the event" (CHALLENGES.md:L717), together with credits for every working Exa project (CHALLENGES.md:L715), shows a developer-acquisition motive.
- The example tasks (legality of a rent increase, missed benefits, travel disruption; CHALLENGES.md:L707, L711) are jurisdiction-specific and time-sensitive, which is where training data fails.
- Exa's past hackathon highlights praised "the power LLMs have when connected to the Internet" with personalised, practical tools (https://exa.ai/blog/best-pennapps-projects-with-exa-search).

## 3. Explicit requirements (quoted)

- "Build an agent that takes tedious tasks in people's lives off their hands." (CHALLENGES.md:L705)
- "Your agent should find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case." (CHALLENGES.md:L709)
- "Areas of interest: General tasks. Examples: planning special occasions, handling daily living errands, rent, missed benefits, business information, travel disruption, etc." (CHALLENGES.md:L711)
- "how well they use Exa to get information that could not have come from a model's training data alone, how useful they are to a specific group of real people, and how clearly they show their sources… originality and… whether the demo works on live queries, including ones the judges try themselves." (CHALLENGES.md:L713)
- Implied: the project must be "built on Exa" (CHALLENGES.md:L715). There is no stated minimum of endpoints.

## 4. What a mediocre submission looks like

- A chat UI wrapping Exa search and an LLM summary, i.e. "Perplexity for X". It answers questions but does not *do* anything. That fails "get the task as close to done as it can" and scores low on originality, because consumer agents such as Perplexity Comet already research, compare, shop and plan trips (https://www.perplexity.ai/comet).
- A generic audience ("for everyone") rather than "a specific group of real people" (CHALLENGES.md:L745).
- Sources dumped as a link list at the bottom with no claim-to-source mapping.
- A canned demo that breaks or takes minutes when a judge types their own query (CHALLENGES.md:L757). Typical causes are deep-mode latency without streaming, or prompts overfitted to one scenario.
- Answers that a bare LLM would give just as well, such as general travel tips, so Exa adds nothing visible.

## 5. What an exceptional submission would demonstrate (estimate)

- **One sharp user group and one painful, high-stakes task**, for example tenants in Finland checking whether a rent increase is lawful and drafting the objection letter, or travellers on a cancelled train or flight claiming EU passenger-rights compensation. It is demoed live on a real case with a real outcome artifact: a filled form, a drafted email or letter, or a booked-ready shortlist awaiting "Approve".
- **Visible "beyond training data" proof**: a side-by-side with a bare LLM, or freshness markers (publish date, `maxAgeHours: 0` live crawl, `snapshotAsOf` showing a rule changed). This maps directly onto criterion 1 and echoes Exa's own comparison demos (https://demos.exa.ai).
- **Claim-level citations**: every fact in the output is linked to a highlighted passage (Contents API highlights), with an official-domain allowlist via `includeDomains` and an "unverified" flag when sources disagree.
- **Deep use of the API surface**: search plus contents, `outputSchema` for structured extraction, Monitors for follow-up (e.g. "tell me when the benefit rules change or the claim deadline nears"), and possibly Websets for verified lists.
- **Robust to judge queries**: it streams progress, degrades gracefully, handles a query outside its niche honestly, and has a small eval set (say 20 real cases) with an accuracy number against a no-Exa baseline. The jury guide likewise asks agents to "show completed actions and verified outcomes rather than only persuasive text" and a baseline comparison (00-Jury-profiles-and-pitch-guide.pdf p.6).

## 6. Constraints that could disqualify or sink a project

- **Not built on Exa**: the "working project built on Exa" wording (CHALLENGES.md:L715) and the Use-of-Exa criterion imply that Exa must be central. Using another search API as the main retrieval layer would likely forfeit the challenge (inference).
- **Demo cannot handle live judge queries**: this is not formally disqualifying, but it costs up to 20% (CHALLENGES.md:L757).
- **Agent takes irreversible actions without approval**: the brief expects "final approval to the user" (CHALLENGES.md:L709). Auto-submitting payments or forms is risky. The team convention is also to stub payments (CLAUDE.md).
- **Healthcare-flavoured tasks**: the team has ruled healthcare out. Benefits eligibility is adjacent, but social-benefit (not medical) tasks are fine.
- **Credit exhaustion mid-demo**: $50 per person. Deep and Agent calls can burn through it, so cache and rate-limit.
- **Websets API access**: it may need a paid plan (https://docs.exa.ai/websets/api/overview). Whether the event provisions this is unknown, so don't make the demo depend on it without confirming with Exa engineers on site.
- Formal eligibility rules (team size, repo licence, submission form, deadline) are **unknown** from the challenge text.

## 7. Physical hardware work

**None.** This is a pure software challenge: web or mobile app, LLM, Exa API. No device is provided or required (CHALLENGES.md:L719-L729). The TRMNL dashboard and macropad are prizes, not build requirements (CHALLENGES.md:L763, L767). An optional consumer-device angle, such as a voice or glasses front-end, is possible but not needed, and our estimate is that it would add little to the scoring criteria.

<!-- complete -->
