# Trusted Trade Agents (Valio Aimo): opportunity discovery (Agent C)

**Summary**
- Looking up products and placing orders over MCP is already commodity (see Agent B). The open gaps are about **commitment and trust**: the sponsor's mock has no order or approval layer, its price data has no usable quote expiry, it returns availability as sentinel values, and its own substitution list is unsafe to apply blindly. A hand-checked count on the sponsor data: of 250 sponsor-defined substitution pairs, 62 change the allergen set, 50 drop a nutritional claim and 87 change the sales unit or lot size.
- The strongest directions are a verifiable offer-to-order protocol (signed fixed-price offers with Peppol-style accept, change and reject responses), guardrails as a machine-checkable mandate enforced on the seller side, and constraint-safe substitution with a measured "naive agent vs. guarded agent" comparison on real catalogue data.
- The overall jury will read this as niche protocol work unless the demo has one visible before/after. The best candidate: a naive agent orders an allergen-changing substitute or the wrong pack quantity, and the guarded interface blocks it or routes it to a human, with a pass rate measured over many requests.
- Estimates: differentiation 7/10, demo 7/10, jury fit 6/10. Tech challenges that stack honestly at low effort: Gemini API, Codex, Aiven or MongoDB Atlas, and Gemma.

Sources: CHALLENGES.md is `/Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md`. The data facts come from the resource portal's `openapi.json`, the product JSON and the reliability CSV, which earlier agents downloaded from https://junction26.valioaimo.fi/ on 13 Nov 2026. The counts below are my own analysis of those files and are labelled "data analysis". Estimates are labelled as estimates.

---

## 0. Data findings that create the gaps (data analysis, 13 Nov 2026)

| Finding | Detail | Why it matters |
|---|---|---|
| No order, cart or approval endpoint | The OpenAPI 0.1.0 spec contains only `ping`, `price`, `availability` and three download links | The whole inquiry-to-commitment step (CHALLENGES.md:L558) is ours to design, which makes it the main place to stand out |
| Price validity is not a quote expiry | Catalogue and list prices come back with `validTo: 9999-12-31`, and `netPriceFound` is `false` (live `/api/price` response) | A "fixed price" order needs an offer that expires and is bound to its terms. The mock does not provide one |
| Availability uses sentinel values | Terminal products report `999999`. One Stock product returned `9999999999` (live `/api/availability`) | An agent that takes these as real stock will over-commit. The trust semantics need to be explicit |
| Cut-off can be in the past while lines still say "available" | A Terminal product returned `closingTime` 2026-11-12 15:00 at `timeNow` 2026-11-13 21:59, with a schedule line for 2026-11-16 | It is ambiguous whether the item can still be ordered. The interface should state this rather than leave it to the agent to guess |
| The sponsor's substitution list is unsafe to apply blindly | 189 products carry 250 substitution pairs. 62 pairs change the allergen code set. One example: rice pie 461697 → 471172 adds codes including AE (egg in the GS1 allergen code list; I recalled this mapping and did not check it). 50 pairs drop a nutritional claim and 87 change the sales unit or lot size (for example 6 kg ST → 12×230 g KI) | This is direct evidence for "Allergen-safe substitution under pressure" (CHALLENGES.md:L612) and for the 15% robustness score (L671) |
| The allergen data has no containment level | Allergen values carry an id with a `None` value, so "contains" and "may contain" cannot be told apart | This is a trust-protocol gap (L594). An agent cannot safely auto-commit on an allergen constraint without knowing the claim's quality |
| Data quality is uneven | 3,068 of 17,546 products lack GS1/Synkka data (no GTIN, ingredients or nutrition). Delivery reliability covers only 4,425 products, and 291 of those are below 0.9 | Claims need provenance and confidence attached, which is the portal's own note that "data quality varies" (Agent A §1) |
| The catalogue is multi-supplier | 648 distinct `vendorName` values | "Comparing offers" (L541) can mean comparing suppliers within Valio Aimo's assortment, with no marketplace needed |
| The catalogue is GS1 Synkka data | The product objects sit under `synkkaData` with GTINs and unit GTINs. GS1 Synkka is GS1 Finland's product-information pool used by Finnish foodservice wholesalers (search results only: https://www.vincit.com/our-work/meira-nova, https://gs1.se/en/partner/fmcg-solutions-2/) | Trust can be anchored in an existing industry identifier system instead of an invented one |

---

## 1. Verifiable fixed-price offer → order protocol (the missing commit layer)

**Gap.** Standards for agentic checkout exist, but they are consumer and card oriented: AP2 mandates, UCP checkout and ACP shared payment tokens (Agent B §4, https://ap2-protocol.org/, https://www.shopify.com/in/ucp). B2B ordering has its own open standard, Peppol BIS Ordering (UBL 2.1). It has an Order message and an Order Response with codes AB (received), AP (accepted), CA (accepted with line changes) and RE (rejected), and it identifies items by GTIN. However, it does not lock prices: prices in the Order are optional and "the Seller may change the price in an Order Response" (https://docs.peppol.eu/poacc/upgrade-3/profiles/28-ordering/). No standard I found binds *an agent's request* to *a firm, time-boxed, signed offer* to *an order the seller must honour*. The challenge asks for exactly that: "based on fixed prices rather than a negotiated quote" (CHALLENGES.md:L558).

**Direction (not a finished idea).** A seller-signed offer that carries its own expiry, cut-off and line-level availability semantics (exact stock, unknown Terminal stock, late date, sales block). The buyer agent commits by referencing the offer hash, with an idempotency key. The seller replies with Peppol-compatible AP, CA or RE semantics. The same objects are exposed over OpenAPI and MCP. The sponsor declared the transport choice out of scope (L616), so we stay transport-agnostic.

**Why the sponsor cares.** "Open, verifiable standards rather than a single platform's black box" (L549). The openness and production-path criterion is worth 15% (L677-L679). Peppol is already the EU's B2B/B2G e-procurement network, so mapping onto it gives Valio's IT and data-governance mentors (L632) a concrete production path. That last point is an estimate.

**Overall jury reading (estimate).** On its own this is weak: protocol design is hard to show at a peer-review table. It works as the backbone of the demo, for example the line "the price you were promised is cryptographically the price you were charged, or the order is refused". It answers Arturs's question about which hard constraint was solved, but Kia and Otto will need a user story.

## 2. Guardrails as a machine-checkable mandate, enforced seller-side

**Gap.** The obvious permission model is a hard-coded euro threshold in the buyer's UI (Agent B §7). Commercial B2B MCP servers have no approvals yet: Optimizely lists "approval chain automation" as planned (https://world.optimizely.com/blogs/vaibhav/dates/2026/5/introducing-the-optimizely-mcp-server/). AP2 has the right shape, an open mandate holding constraints and a closed mandate holding the final cart, both as signed credentials (https://ap2-protocol.org/). It does not define the foodservice constraint vocabulary: allergen and nutritional-claim hard rules, substitution tolerance, delivery slack, category allow-lists and per-site budgets. The sponsor names this guardrails model as a problem it wants tackled (L596).

**Underused capabilities.**
- W3C Verifiable Credentials 2.0 has been a W3C Recommendation since 15 May 2025 (https://www.w3.org/TR/vc-data-model-2.0/), so the mandate can be a standard credential and needs no bespoke format.
- MCP elicitation (spec 2025-06-18) lets a *server* pause a tool call and request structured input from the human through the client, who can accept, decline or cancel (https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation). This is a standard human sign-off channel that most teams will not know exists. Caveat: elicitation is marked "newly introduced… may evolve", and its schemas are flat primitives only.

**Newly practical (estimate).** An LLM can compile a purchasing manager's plain-language policy ("never auto-substitute anything that adds an allergen; under €500/day auto-commit dairy") into a structured mandate. A human reviews it, and a deterministic engine then enforces it. The LLM proposes and the code decides.

**Why the sponsor cares.** The autonomy and controls criterion is worth 20% (L673-L675). It also protects Valio Aimo: if the *seller* validates the mandate, Valio can prove it never accepted an order that the customer's own policy forbade. That is the "trust" in the challenge title.

**Overall jury reading (estimate).** Legible if shown as two runs: the same request under two different mandates gives one auto-commit and one approval prompt. Daksh's question "can your metric or guardrail be gamed?" fits well. A prompt-injection attempt on the buyer agent can be shown failing against a seller-side check.

## 3. Constraint-safe substitution and partial fulfilment ("good-better-best")

**Gap.** The sponsor's own substitution data is unsafe to apply blindly (§0: 62 of 250 pairs change allergens, 50 drop a claim, 87 change the sales unit or lot). A naive agent that "uses the sponsor's substitution list" would therefore cause the failure in the school-kitchen scenario (L612). The sponsor asks for substitution ranking within its own assortment (L598) and for recipe-logic substitution rather than SKU swaps (L606-L608). Substitution is only "optional" (L564), but robustness to exceptions is scored at 15% (L671), and how precisely the result matches the request is scored at 20% (L669).

**Underused data.** The data includes per-100 g nutrition (GDA values such as LACS for lactose and SALTEQ for salt), claims such as FREE_FROM_LACTOSE, `allowedLotSize`, unit conversions between pallet, case and piece with their GTINs, country of origin, the reliability CSV and the carbon CSV. Few teams will use unit conversion and lot size correctly (the "1,000 litres" maths, Agent A §4). That is an estimate.

**Direction.** A ranked substitution engine that treats allergens and claims as hard constraints and treats price, delivery reliability, carbon and origin as soft ones. It splits partial availability across products and dates, and every option explains its trade-off. Uncertain claims (no Synkka data, unknown containment level) escalate to a human instead of auto-committing.

**Why the sponsor cares.** It is listed problem L598 and scenarios L606-L612. It is also commercial: lost sales caused by a stock-out turn into accepted substitutes.

**Overall jury reading (estimate).** This gives the strongest before/after. Run a naive LLM agent and the guarded interface over the same set of 50-100 generated requests. Show "the naive agent ordered a substitute containing egg for an egg-free kitchen in X% of cases, ours in 0%, and the cost was Y escalations". That is the measured evidence the jury PDF asks for (00-rules-and-jury.md §6), and it is understandable in under a minute.

## 4. Trust-grade product claims (provenance and confidence per claim)

**Gap.** The sponsor asks for "the minimum data/verification standard for an external agent to trust Valio Aimo's claims on stock, price and origin without a manual check" (L594). Today nothing marks which claims are authoritative. Thirty-one hundred products have no Synkka data, the allergen containment level is missing, and the availability numbers are sentinels (§0). Agent-commerce standards cover payments and checkout, not product-claim provenance (Agent B §4; estimate based on the pages it opened).

**Direction.** Every claim the interface returns (allergen absent, lactose-free, stock quantity, origin, price) carries a source (GS1 Synkka by GTIN, Valio master data, live availability), a timestamp and a confidence or "exact vs. estimated" flag. Valio signs the claim, for example as a VC. The buyer's mandate can then say "auto-commit only on exact, signed claims".

**Why the sponsor cares.** Data ownership and trust are "existential" (L547), and "verifiable-credential or trust-layer approaches" are listed preferred tech (L626). Anchoring on GTIN and GS1 data that Finnish foodservice already uses is a production path the mentors can judge (estimate).

**Overall jury reading (estimate).** It is abstract on its own. It is best folded into areas 2 and 3 as the reason an escalation happened ("blocked: the lactose-free claim is unverified for this product").

## 5. One shared, two-sided audit ledger and a seller-side view of agent demand

**Gap.** The sponsor wants a log that is usable "for both buyer and Valio Aimo" (L600), and traceability that a human can read (L565). The obvious build is free-form LLM transcripts (Agent B §7). Nobody gives the *seller* structured visibility into agent-driven demand. That covers requests that could not be met, substitutions that were rejected and approvals that took too long, which is exactly the customer-relationship signal Valio fears losing to platforms (L547). The gap claim is an estimate.

**Direction.** An append-only, hash-chained event log covering request, candidate set, offer, mandate check, approval, order response and delivery. It renders as a plain-language narrative for the chef and as aggregate signals for Valio. Possible add-ons are standing-order drift detection (L614) and the proactive selling agent (L610), which proposes a seasonal or substitute item *within* the buyer's mandate.

**Why the sponsor cares.** It speaks to the "who owns the customer relationship" framing (L547) and to "how decisions are logged and auditable" (L675).

**Overall jury reading (estimate).** A good "path forward" answer for Otto and Umar on why anyone returns: the weekly standing order and Valio's demand insight. It is not a wow on its own.

## 6. A measured correctness benchmark for agent orders (supporting area)

**Gap.** No public benchmark checks whether an agent's wholesale order matches what was asked: units, lot sizes, claims, dates and cut-offs. I found none; this is an estimate based on Agent B's searches, which turned up no such thing. Daksh, a juror who leads RL at AfterQuery and wrote StoreBench, explicitly asks whether a project beats a simple baseline and whether its metric can be gamed (00-rules-and-jury.md §5).

**Direction.** Generate 50-100 realistic requests from the catalogue, such as the example "1,000 L lactose-free milk by Monday" (L569), egg-free menus and late-booking events. Score each order on exact constraints (quantity within lot rules, hard claims kept, deliverable by the date, before cut-off). Report the pass rate, failure examples and the escalation rate.

**Why the sponsor cares.** It quantifies "least manual correction needed" (L669).

**Overall jury reading (estimate).** This turns a protocol project into an evidence project, which is the jury's 15% "honest measured evidence" lens. Cost: roughly 4-6 person-hours (estimate).

---

## Stackable tech challenges (honest fit)

| Tech challenge | Honest use here | Effort (estimate) |
|---|---|---|
| Best Use of Gemini API | The buyer agent or the policy-to-mandate compiler runs on Gemini. A written explanation is required (per `_tech-challenges.md`) | low |
| Best Use of Codex | Codex used in development; stackable with any challenge (per `_tech-challenges.md`) | low |
| Best Use of Aiven *or* MongoDB Atlas | Hosted Postgres or Mongo for the offer, order and audit ledger | low |
| Best Use of Gemma | A small local model as the *second, independent* buyer agent, which shows the interface works across vendors | low-medium |
| Best Use of Tiger Data | Time-series for standing-order drift (L614). Only honest if area 5 is built | medium |
| Best use of CRACI | CI running the correctness benchmark from area 6 on each commit | medium |
| Oxylabs, Context.dev, ElevenLabs, Nemotron, Cloudinary, Solana, hardware | Not a natural fit. Voice ordering via ElevenLabs is possible but pulls the focus away from the trust story | n/a |

Whether one project may also enter a *second main* challenge is unknown (00-rules-and-jury.md §4).

## Estimates

- **Differentiation potential: 7/10.** Lookup-and-order is commodity, and crowding is medium (Agent B). The sponsor-data findings in §0 (unsafe substitution pairs, sentinels, past cut-offs, no containment level) are concrete, checkable and probably unnoticed by most teams. Combining a fixed-price signed offer, Peppol response semantics, a seller-enforced mandate and a measured benchmark is uncommon. It is capped because AP2, UCP and MCP vocabulary will be widespread, so the difference has to be shown, not claimed.
- **Demo potential: 7/10.** The flow is deterministic and needs no hardware. The guarded-vs-naive substitution comparison and the "same request, two mandates" runs give clear before/after moments. Risks: undisclosed rate limits (cache aggressively), and a two-agent demo that reads as plumbing if it is not framed around a chef or school kitchen.
- **Jury fit: 6/10.** It fits Arturs (hard constraint, path to production) and Daksh (baseline, adversarial cases, a metric that cannot be gamed) well. It fits Kia, Otto and Timo less well, because B2B ordering infrastructure is less emotive and the "named user" (a hotel purchasing manager or school-kitchen chef) has to be made vivid. Peer-floor legibility is the main risk to reaching the top 5.

<!-- complete -->
