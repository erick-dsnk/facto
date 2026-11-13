# Make Unicorns Real (Cala): opportunity discovery (Agent C)

**Summary**
- Most teams will build an investor matcher, a due-diligence memo agent or a market map (competitive.md section 5). The open space is in the parts of Cala's graph that those ideas ignore: **sanctions, PEP and beneficial-ownership data, corporate parent and subsidiary structure, dated relationships (`valid_since`/`valid_until`) and per-property sources** (https://cala.ai; https://docs.cala.ai/api-reference/entities.md; https://docs.cala.ai/api-reference/entity-introspection.md).
- The strongest gap is **reverse diligence**. Founders check the investor before signing: is the fund still deploying, does it lead, how does it behave when things go wrong, and is the money itself clean (sanctions, PEP, ultimate owner, new EU FDI-screening triggers). Investors are well served by diligence tools. Founders are not, and the only founder tool we found (Grove's Investor Check) does not name its sources.
- Four more directions: claim-checking a pitch deck against the graph; an exit or acquirer map built from corporate structure and balance-sheet cash; time-aware "is this still true" signals; and a Slush-floor "who am I meeting" brief on a phone. All are pure software. None needs physical hardware.
- Estimates: differentiation **7/10**, demo **8/10**, overall-jury fit **6/10**. Every direction depends on data coverage that nobody has tested yet (feasibility.md section 2), so run the coverage spike in hour 0-3 before choosing.

---

## 0. What the obvious entries leave unused (sponsor capabilities)

| Capability | Evidence | Used by the obvious ideas? |
|---|---|---|
| Per-property `sources` (name, date, document URL) and KnowBit `origins` | https://docs.cala.ai/api-reference/entities.md ; https://docs.cala.ai/api-reference/search.md | Usually shown as a footnote at most |
| Relationship `valid_since` / `valid_until` dates | entities.md (above) | No |
| Corporate structure: `IS_SUBSIDIARY_OF`, `IS_ULTIMATE_PARENT_OF`, `IS_DIRECT_PARENT_OF`, `IS_BENEFICIARY_OWNER_OF`, `IS_BOARD_MEMBER_OF`, `PARTICIPATES_IN_CORPORATE_EVENT` | https://docs.cala.ai/api-reference/entity-introspection.md | No |
| Sanctions (OFAC SDN, EU, UN), PEP rosters, corporate registries and UBO, court records | https://cala.ai (Finance data sources) | No. The obvious ideas use only funding data |
| `Sanction`, `CorporateEvent`, `Patent`, `Law`, `FinancialMetric` entity types | https://docs.cala.ai/api-reference/query.md (entity enum) | No |
| `numerical_observations` time series (for example "Cash and Cash Equivalents", us-gaap) with `published_time` | entities.md ; entity-introspection.md | No |
| Lookup by LEI, CIK or SIREN | https://docs.cala.ai/api-reference/lookup-entity.md (listed in https://docs.cala.ai/llms.txt) | No |

Caveats: the docs never name an investor or funding relationship, and there is no `Investor` entity type (query.md). Search origins carry **no date** (search.md), so freshness has to come from entity property `sources[].date` or from dates inside KnowBit text. Coverage of European private rounds is **unknown** (feasibility.md section 2).

---

## 1. Reverse diligence: founders vetting the investor and the money

**Gap.** Founders are vetted in depth, yet "many founders sign term sheets without doing the same homework in reverse" (https://www.crv.com/content/investor-due-diligence). CRV's recommended checks are whether the fund is still deploying and has reserves, how the investor treated portfolio companies that struggled, and Form ADV/IAPD disciplinary records. The tools it suggests are manual: LinkedIn, Crunchbase and SEC IAPD (same URL). Carta data shows deployment slowing sharply for 2021-2022 vintage funds, and the founder advice is to ask "Which fund vintage are you deploying from?" (https://www.upstartsmedia.com/p/carta-data-for-spotting-vc-zombies). The one founder-side product we found, Grove's Investor Check, scores fund lifecycle, partner attribution, "conviction in tough moments" and network, "based on public sources" that it does not name, and the page does not say whether the brief is automated (https://www.grovevc.com/news/introducing-the-check-investor-due-diligence/).

**A second layer nobody targets for founders:** the source of the money. The new EU FDI-screening regulation makes screening mandatory when a foreign investor is sanctioned, linked to a foreign government, or controlled from outside the EU through an EU vehicle (search snippets from law-firm alerts, for example https://www.mondaq.com/constitutional-administrative-law/1812796/eu-adopts-new-fdi-screening-regulation-what-changes-for-investors; I did not open the page, so treat it as unverified). Cala holds sanctions, PEP, UBO and parent-chain data in the same graph as funding rounds (https://cala.ai; entity-introspection.md). That combination is something web search cannot assemble with sources.

**Why Cala would care (inference).** It joins Cala's enterprise KYC and compliance positioning ("Compliance, KYC, risk analysis or investments", https://cala.ai) to the startup audience at Slush, and it needs multi-hop sourced data: fund → rounds led → dates → portfolio follow-ons and down events → partner → ultimate owner → sanctions/PEP.

**Overall jury.** A specific user (a founder holding a live term sheet), an irreversible decision, and a red/yellow/green brief where every line has a source. These are easy to explain at the table (estimate).

**Risk.** Lead/follow roles and European fund vintages may be thin in the graph (feasibility.md section 8 Q3-4). Sanctions hits on real VCs will be rare, so the demo needs a real, sourced example of a sanctioned or PEP-linked entity. That example must not defame any real investor (estimate).

## 2. Claim-check a pitch deck or data room against the graph

**Gap.** DD-memo agents produce *new* text (competitive.md section 3). Few tools check the *claims a founder already made*, such as "no direct competitors", "ex-CTO of X", "market of €Y" or "customers include Z", against sourced records. An LLM reading a deck cannot tell true from false. Cala returns the claim, the matching record and its source (search.md `explainability` → KnowBit → origin).

**Evidence.** Founder background checks and reference checks are standard but manual (search results: https://www.crv.com/content/reference-check-questions-for-founders, https://signatureblock.co/articles/founder-reference-checks, seen as snippets only). Cala exposes `IS_CEO_OF`, `IS_BOARD_MEMBER_OF` with validity dates, competitor rounds and court records (entity-introspection.md; https://cala.ai).

**Why Cala would care.** It is the clearest "sourced data beats web search" story: each claim gets a verdict of verified, contradicted or unknown, with a link. It maps directly onto "Investing with confidence … well-sourced background check" (CHALLENGES.md:L301) with a fresher angle (estimate).

**Overall jury.** The before/after is very visible: the deck slide on the left, the annotated version on the right. It also yields a measurable metric (claims checked, precision on a hand-labelled set), which matches the jury's "honest measured evidence" criterion (00-rules-and-jury.md). The audience is founders too: "check your own deck before Slush".

**Risk.** Coverage for small private companies is unknown. "Unknown" verdicts must be shown honestly rather than counted as passes.

## 3. Exit and acquirer map from corporate structure and cash

**Gap.** The challenge names "mapping who might buy a startup one day" (CHALLENGES.md:L303), but that is the least crowded seed idea (competitive.md section 5 lists acquirer mapping nowhere in its top 6). Cala holds parent and subsidiary chains, `CorporateEvent` participation (M&A), SEC filings and `FinancialMetric` time series such as cash and equivalents (entity-introspection.md; https://cala.ai). The question to answer: "Who has bought companies like mine, who has the cash, and which subsidiary actually does the buying?" Web search answers that poorly, because the acquirer is often a subsidiary of a listed parent (inference).

**Why Cala would care.** It uses the parts of the graph where Cala's data is strongest (SEC/US public companies, feasibility.md section 2) and that funding-only ideas never touch.

**Overall jury.** A founder or a corp-dev scout gets a short list with a reason and a source. The link to a real decision is weaker than in area 1 (an exit is years away for most founders), so the "real need" score is lower (estimate).

**Risk.** Coverage of M&A events for private targets is unknown. Tying M&A to industry needs `OPERATES_IN_INDUSTRY` traversal, which costs many calls at 10 rpm (feasibility.md section 2).

## 4. Time-aware graph: "is this still true?"

**Gap.** Databases go stale. The challenge text itself says "outdated databases" (CHALLENGES.md:L283), and the founder pain behind "still actively investing today" is explicit (CHALLENGES.md:L297). Cala dates its relationships (`valid_since`/`valid_until`) and its property sources (entities.md). A product can show *change*: a partner who left a fund, a fund whose last led round was 20 months ago, a board seat that ended, a company whose CEO changed after its last round. As far as we found, no listed competitor puts staleness at the centre (competitive.md section 2; inference).

**Why Cala would care.** It proves that the data is "fresh, traceable" (https://cala.ai) rather than only claiming it.

**Overall jury.** This is better as the engine inside area 1 or 2 than as a product of its own. A standalone "change feed" drifts toward the crowded "funding news alerts" idea (competitive.md section 5, item 4).

**Risk.** Whether `valid_until` is populated for people-to-fund relationships is **unknown**. Test it in the coverage spike.

## 5. Slush-floor brief: "who am I about to talk to?"

**Gap.** Slush starts right after the hackathon (CHALLENGES.md:L285). Founders and investors meet back to back and prepare from browser tabs (CHALLENGES.md:L283). A phone-first flow helps here: scan a badge or say a name, resolve the entity with `entity_search` (with a disambiguation step), and get a 20-second sourced brief with one question to ask. It fits the team's mobile and streaming-audio skills. Meta glasses are possible but not required (estimate).

**Why Cala would care.** People will use it at Slush during the following week, and that is the stated bar (CHALLENGES.md:L285).

**Overall jury.** Peer-floor legibility is the highest of all five directions: a reviewer can say their own name and get a brief. It also carries the highest risk of an empty result (feasibility.md section 7, failure mode 3) and the highest originality risk, since it is close to "chat with Cala on a phone" (estimate). Best used as the delivery surface for area 1 ("brief me on this investor before my meeting"), not as the core.

---

## Combinations that are new now (estimates)
- **Sourced graph + LLM claim extraction**: reliable extraction of atomic claims from a deck PDF has only become practical with recent long-context multimodal models, and Cala supplies the ground truth (areas 2 and 1).
- **Graph + live web baseline side by side**: run the same question through a web-search LLM and through Cala, then show which claims each side can source. Oxylabs `/search` at runtime with source URLs shown qualifies for its tech challenge (CHALLENGES.md:L3233-3328, via _tech-challenges.md row 18). Note the tension: "Cala core, not an add-on" (CHALLENGES.md:L287) means the web side must be visibly the *baseline* and not a data source.
- **Voice delivery**: an ElevenLabs spoken brief for area 5 (_tech-challenges.md row 7).

## Tech challenges this could stack honestly
| Tech challenge | Fit | Note |
|---|---|---|
| Best Use of Codex | High | Development-process claim (_tech-challenges.md row 8, L2434) |
| Best Use of Gemini API | Medium-high | If Gemini is the orchestrator or extracts deck claims. All members must be 18+ (L2518) |
| Best agentic usecase of Oxylabs | Medium | Only as the live web-search baseline with URLs shown (L3249, L3263). Setup needs a $500 plan with a 100% discount code, which must then be cancelled (L3283) |
| Context.dev | Medium-low | Same role as Oxylabs, so pick one. It needs "centrality of live web data" (30%), which pulls against "Cala core" |
| Aiven or MongoDB Atlas | Medium | The Cala cache and replay store, which we need anyway because of the 10 rpm limit (feasibility.md section 3). Aiven's prize is larger and its criteria are stated (L2905-2958) |
| ElevenLabs | Low-medium | Only with area 5 voice delivery |
| Hardware challenges (Arduino, Atech) | None | No honest fit |

## Estimates
- **Differentiation potential: 7/10.** The obvious ideas are saturated (competitive.md), but areas 1-3 use graph regions (sanctions/UBO, corporate structure, dated relationships) that funding-only entries ignore. A Grove-style investor check already exists, so the edge must come from multi-hop sourcing and the money-source layer. Capped by unknown coverage.
- **Demo potential: 8/10.** The deck annotation (area 2) and the red/yellow/green term-sheet brief (area 1) are clear before/after visuals. A live side-by-side with web search is dramatic. Held back by latency of up to 180s and 10 rpm, so a pre-warmed cache is mandatory (feasibility.md section 7).
- **Overall-jury fit: 6/10.** A specific user, a measurable metric (claim precision against a hand-labelled set) and a credible path forward (people use it at Slush) all score well. However, finance tooling is less "worthwhile problem" in jury terms than societal topics (estimate), and peers may see it as yet another founder tool. The table needs a 60-second hook such as "type your investor's name".

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L273-353
- /Users/ciprian/code/Junction 26/docs/challenge-selection/01-challenge-intelligence/make-unicorns-real.md and _tech-challenges.md
- /Users/ciprian/code/Junction 26/docs/challenge-selection/02-research/make-unicorns-real/competitive.md and feasibility.md
- https://docs.cala.ai/llms.txt ; https://docs.cala.ai/api-reference/entities.md ; https://docs.cala.ai/api-reference/search.md ; https://docs.cala.ai/api-reference/query.md ; https://docs.cala.ai/api-reference/entity-introspection.md
- https://cala.ai
- https://www.crv.com/content/investor-due-diligence
- https://www.upstartsmedia.com/p/carta-data-for-spotting-vc-zombies
- https://www.grovevc.com/news/introducing-the-check-investor-due-diligence/
- Search snippets only (not opened): EU FDI-screening law-firm alerts (mondaq.com, cms.law); founder reference-check guides

<!-- complete -->
