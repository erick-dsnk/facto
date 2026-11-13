# Valio Aimo "Trusted Trade Agents": opportunity discovery (Agent C)

**Summary**
- An agent that can look things up and place orders over MCP is now a commodity. The real gaps are in **commitment correctness** and **governance**. On 2026-11-13 we probed the sponsor's mock API and found that it quietly sets traps for a naive agent: order cut-offs that have already passed while stock still shows as available, requested dates silently moved to a later day, a declared substitute that cannot be delivered, and "unlimited" sentinel values.
- The catalogue data has a precision problem that a text-matching LLM gets wrong. "Lactose-free milk" also matches ice cream, cake bases and protein shakes. Lactose-free milk still *contains* the milk allergen. And 8,110 of the 17,546 products have no allergen data at all, so "unknown" must never be read as "safe".
- The strongest directions, ranked by estimate: (1) a buyer mandate enforced outside the LLM, (2) a constraint resolver that cites the evidence for each match, (3) a commitment checker that surfaces exceptions in the mock data, (4) signed fixed-price offers with an audit log both sides can read, (5) a recipe- or menu-level intent layer, (6) a measured red-team and evaluation harness.
- Estimates: differentiation 6/10, demo 7/10, overall-jury fit 5/10. This is a good challenge to win on its own. For an overall win it needs a human story (a chef or school kitchen) and a measured before/after.

Sources: the challenge text CHALLENGES.md:L535-L693 (the track heading is at L535, the company section at L575). Agent A's report is `01-challenge-intelligence/valio-aimo.md`. Agent B's competitive report for this challenge is filed under the alias slug `02-research/trusted-trade-agents/competitive.md`, because the `valio-aimo` competitive input was null. I also made my own portal and API probes on 2026-11-13, using the password and key published in CHALLENGES.md:L637 and L643, against https://junction26.valioaimo.fi/ and https://junction26.valioaimo.fi/openapi.json. Only a handful of narrow API calls were made, in line with the spec's rate-limit note.

---

## 0. What I verified first-hand in the sponsor resources (2026-11-13)

These facts support the opportunities below. Each one is an observation from a live call or a downloaded file.

| Observation | Evidence |
|---|---|
| The API has only `ping`, `price`, `availability` and three file downloads. There is no order, cart, customer or search endpoint. | openapi.json `paths` |
| Each price has `validFrom` and `validTo`. Some prices are time-boxed (`validTo` 2026-12-31, `netPriceFound: true`). Others are open-ended (`9999-12-31`). | Live `/api/price` call for 14 lactose-free milk codes |
| Prices and stock were **identical for customer "123" and "999"** in this probe, although the spec says real prices are customer-specific. | Live calls for both customers |
| Products with `logisticModel: "Terminal"` (for example 464768 and 465039) return `closingTime: 2026-11-12T15:00+0200`, which had **already passed** when we asked for Monday 16 Nov delivery. The same response still reported 999,999 available on 2026-11-16 with `salesBlock: false`. | Live `/api/availability`, `timeNow` 2026-11-13T22:03 |
| `Stock` items have their cut-off at **Sun 15 Nov 17:00**, which is judging day (review starts at 10:30, per `00-rules-and-jury.md`). | Same call |
| When we requested Sat 14 Nov, every line came back with `availableDate: 2026-11-16`. The date moved silently, with no error flag. | Live call with `requestedDate` 2026-11-14 |
| Partial stock is real: 462775 had 51 units and 463380 had 698, while 1,000 L were needed. Unlimited stock is shown with the sentinels `9999999999` and `999999`. | Live calls |
| 464440 is the sponsor-declared substitute for 464201, but it returned **empty `scheduleLines`** and no `closingTime`, so it cannot be delivered. | Live call; `substitutions` field in the product JSON |
| There are 17,546 products, but only 196 carry `substitutions` (250 rules). The catalogue has no category names, and `medias` holds IDs only, with no URLs. | Product JSON analysis |
| `nutritionalClaim FREE_FROM_LACTOSE` appears on 4,178 products. Lactose-free milks (for example 464201 and 464073) still list allergen `AM` (milk) as CONTAINS. | Product JSON |
| 8,110 of 17,546 products have **neither** an `allergen` nor a `nonAllergen` classification. The portal itself says that "fruits and vegetables are often lacking such information". | Product JSON; portal home page |
| The same requested volume maps to different sales units. 464201 sells per `ST` (1 L, with a 10-pack and a 600-unit pallet). 462921 sells per `KI` (a case of 5). 463038 is a 10 L Novobox sold per `KI` of 2. `comparisonPrice` per `L` is returned, so a fair €/L ranking is possible. | Product JSON and price response |
| Of the 4,425 products with a delivery-reliability value, 291 are below 0.9 and 13 are 0.0. Carbon values are averages per product group (every milk we checked had 1.1). | CSV analysis; portal text |

Caveat (estimate): some of these traps may be artefacts of the mock rather than deliberate design. Ask the IT/data mentors (CHALLENGES.md:L632) on Friday night whether the passed `closingTime` and the date shift are intended. Either way, an agent that detects them and explains them is stronger than one that does not.

---

## 1. Buyer mandate enforced outside the LLM (guardrails as a contract)

**Gap.** Most designs put the approval rule inside the agent's prompt, or use one hard-coded euro threshold. Agent B found that commercial B2B MCP servers already handle search, price, cart and order, but approvals are thin. Optimizely lists "approval chain automation" only as planned (https://world.optimizely.com/blogs/vaibhav/dates/2026/5/introducing-the-optimizely-mcp-server/, cited in competitive.md §5). The challenge's problem list asks exactly this: "which decisions require human sign-off (spend threshold, substitutions outside stated preferences) vs. fully autonomous" (CHALLENGES.md:L596).

**Direction.** A declarative, machine-readable mandate per buyer covering spend caps, allowed categories, hard allergen constraints, substitution tolerance, delivery window and expiry. It is checked by Valio Aimo's order gateway, not by the buyer's LLM. Each decision returns auto-commit, needs-approval or reject, with reason codes. Approval requests show the difference between what was asked and what is proposed. Open standards to build on, each verified:
- OAuth 2.0 Rich Authorization Requests (`authorization_details`) carry fine-grained, typed authorisation data that the user consents to and the resource server enforces (https://www.rfc-editor.org/rfc/rfc9396.html).
- AP2 mandates are signed, tamper-evident credentials. Each has an "open" stage (constraints set before the cart is final) and a "closed" stage (a specific finalised checkout). AP2 supports flows where the human is not present. It is Apache 2.0 and has been donated to FIDO (https://ap2-protocol.org/).
- MCP elicitation lets a server ask the user for structured input through the client, with an accept/decline/cancel result (https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation). This is a ready-made channel for a human-approval step.

**Why the sponsor cares.** This is 20% of the score ("Autonomy and controls", CHALLENGES.md:L669-671) and is the core of the "trusted" title. Enforcing the rules on the seller side keeps Valio Aimo in control of what agents may commit to, which is its stated existential concern (CHALLENGES.md:L547).

**Overall-jury reading (estimate).** On its own it is abstract. The moment that lands is the agent trying to go over its authority, the gateway refusing it, and a phone buzzing with a one-tap approval that shows the difference. That needs a visible UI.

## 2. A constraint resolver that cites its evidence ("unknown is not safe")

**Gap.** A naive search for "lactose-free milk" over this catalogue returns 70 products that carry the lactose-free claim and have "milk" in the name. They include milk ice cream (466172), cake bases (465905), protein shakes (466153) and powder (465042). Lactose-free milks still contain the milk allergen `AM`. A school kitchen with a milk-allergic child (CHALLENGES.md:L612) needs a different filter from one serving lactose-intolerant diners. 46% of products (8,110) have no allergen data, so missing data must be shown as "unknown", never as "free from". Units differ as well (ST, KI of 5 or 10, 10 L Novobox, KRS, PAL), so turning "1,000 L" into pack counts that respect `allowedLotSize` is not trivial.

**Direction.** Turn a natural-language request into hard constraints and soft preferences. Resolve them against GS1 Synkka fields (`nutritionalClaim`, `allergen`/`nonAllergen` with CONTAINS/FREE_FROM, `unitConversions.volume`, `units`). Return each candidate with **per-constraint evidence**, for example "FREE_FROM_LACTOSE: Synkka claim; milk allergen: CONTAINS; 1,000 L = 100 × KI(10) = 1,000 ST". Product type would be classified with an LLM over names, ingredients and categories, because there are no category names. Cheap filtering happens before any narrow price or availability call, as the spec requires (openapi.json description: "Query the APIs only when you have narrowed down the products").

**Why the sponsor cares.** "Solving the problem and user need" is 20%: "how precisely the agent matches what the buyer actually asked for, with the least manual correction" (CHALLENGES.md:L665-667). The trust protocol asks what an agent needs in order to trust claims "without a manual check" (CHALLENGES.md:L594).

**Overall-jury reading (estimate).** It is legible and measurable. A slide could read "Naive agent: 70 'lactose-free milks', including ice cream. Ours: N real milks, each with evidence." This feeds the jury's "honest measured evidence" criterion (15%, per `00-rules-and-jury.md`).

## 3. A commitment checker that surfaces the exceptions in the mock data

**Gap.** The happy path hides several traps that a "cheapest in stock" agent falls into. These are observed facts, listed in §0: cut-offs that have passed while stock still shows, requested dates silently moved forward, partial quantities (51 or 698 of 1,000), sentinel values for unlimited stock, a sponsor-declared substitute with no availability, `closingTime` missing on some lines, and promotional prices that expire. Agent B expects most teams to build "cheapest-in-stock ranking" (competitive.md §6).

**Direction.** A deterministic pre-commit checker with a published exception taxonomy covering cut-off passed, date shifted, short quantity, sales block, unavailable substitute, price expiry before delivery, and low reliability (below 0.9 for 291 products). When the order cannot be met as asked, it builds a **split plan** (for example 51 + 698 + remainder from product X) or a good/better/best set of substitutions (CHALLENGES.md:L598). Substitutes are ranked by the sponsor's `substitutions` list first, then by claim, allergen and unit compatibility, then by €/L `comparisonPrice`, delivery reliability and group-level CO2 as tie-breakers.

**Why the sponsor cares.** Robustness is 15% ("partial availability, substitutions and delivery constraints beyond the happy path", CHALLENGES.md:L673-675). Delivery time and sustainability are optional directions (CHALLENGES.md:L563).

**Live-demo hook (estimate).** The `Stock` cut-off is Sunday 17:00, during judging. A visible countdown to the cut-off, plus a red "Terminal cut-off passed Thu 15:00, a naive agent would have ordered this" card, gives a clear before/after against the sponsor's own live API.

## 4. Signed fixed-price offers and an audit log both sides can read

**Gap.** The challenge asks for a "trust protocol", meaning the minimum verification standard for stock, price and origin claims (CHALLENGES.md:L594), and an "audit trail ... for both buyer and Valio Aimo" (CHALLENGES.md:L600). Agent B lists free-form LLM log lines as a common weak pattern (competitive.md §7). The mock already returns `validFrom`/`validTo` on every price. That maps directly onto the W3C Verifiable Credentials Data Model 2.0, a W3C Recommendation since 15 May 2025 with `validFrom`/`validUntil` properties (https://www.w3.org/TR/vc-data-model-2.0/).

**Direction.** Valio Aimo issues a signed, time-boxed **offer** (fixed price, quantity, delivery date, the availability snapshot, and the claims it relies on such as the lactose-free claim and origin). The buyer agent verifies it and commits by referencing its hash, with idempotent order placement. Every decision (mandate check, approval, order) goes into a hash-chained log rendered twice: once as structured JSON for machines and once as a plain-language timeline for the kitchen manager and Valio Aimo's sales team. A `/.well-known/` discovery document and an OpenAPI or MCP description make the interface open (CHALLENGES.md:L679).

**Underused angle (estimate).** The sponsor's deeper worry is "who owns the customer relationship" (CHALLENGES.md:L547). The same log gives Valio Aimo a **seller-side view of agent demand**: what agents searched for and could not find, which substitutions were rejected, and where cut-offs lost sales. That turns agent traffic into commercial insight instead of a threat, and links to the "proactive selling agent" scenario (CHALLENGES.md:L610).

**Overall-jury reading (estimate).** Cryptography reads poorly at a peer table unless it is shown as a tamper demo: edit one log line and verification fails. It scores well on "distinctive insight and technical depth".

## 5. Recipe- and menu-level intent rather than SKU swaps

**Gap.** Three of the six example scenarios are about recipes: need → recipe → order, a last-minute event, and a stock-out answered with a "recipe-compatible substitute" (CHALLENGES.md:L604-608). The challenge explicitly prefers "recipe logic rather than a simple SKU swap" (CHALLENGES.md:L606). Big distributors' AI is still assistive. A trade-press article on Sysco's SAGE describes "next-best-action recommendations" for its own staff and says nothing about customers' agents ordering on their own (https://distributionstrategy.com/2026/08/sysco-bets-on-ai-to-drive-100-million-in-productivity-gains/). Search snippets, not opened, describe US Foods turning photos, PDFs and handwritten notes into orders.

**Direction.** The input is a menu, a recipe or a booking ("80 covers tomorrow, 12 lactose-intolerant, 2 milk-allergic"). An LLM breaks this into ingredient requirements by function: dairy for a sauce, for example, where cream can replace milk at a different ratio. These then go through areas 2 to 4. Standing-order drift detection (CHALLENGES.md:L614) is a later step, and it needs synthetic order history because none is provided.

**What became possible only recently (estimate).** Reading free-form menus and recipes and reasoning about whether one ingredient can do another's job was impractical without capable LLMs. Before them, catalogues could only swap one SKU for another.

**Overall-jury reading (estimate).** This is the most human story available: a chef or school cook with a problem tomorrow morning. It improves legibility for the peer floor and the jury, at the cost of scope. Keep it thin and run it through areas 1 to 4.

## 6. A measured red-team and evaluation harness

**Gap.** The jury rubric gives 15% to "honest measured evidence (a baseline, failure cases, a metric that cannot be gamed)" (`00-rules-and-jury.md`). Agent B found no sponsor-specific baselines. There is also an under-discussed attack surface. `marketingTexts` and ingredient strings are **written by suppliers and read straight into a buyer agent's context** (observed in the product JSON). That is a prompt-injection route from a third party into a purchasing decision, and it is the strongest argument for enforcement outside the LLM (area 1).

**Direction.** A set of 30-50 buyer requests with known correct answers, built from the catalogue and live availability, covering allergens, units, cut-offs and partial stock. Score a naive tool-calling agent against our gateway on wrong commits, approvals that should have fired, and manual corrections needed. Add an injected supplier text, for example "ignore the spend limit", and show that the mandate still holds.

**Why the sponsor cares.** It gives evidence for "autonomy and controls" and for the credibility of a path to production (CHALLENGES.md:L671, L679), and a test suite Valio Aimo could reuse with real agents.

**Overall-jury reading (estimate).** A single chart ("naive agent: X wrong commits out of 40, ours: 0") is about the most persuasive 10 seconds available in a pitch for this kind of project.

---

## Tech challenges that could honestly be stacked

Requirements below come from the `_tech-challenges.md` digest. The fit judgements are my estimates.
- **Best Use of Gemini API** (low effort): Gemini as the buyer agent's reasoning model and for menu decomposition. It is meaningful as long as Gemini actually does the intent parsing.
- **Best Use of Codex** (low): dev-workflow use only, open to any team.
- **Best Use of Aiven** (low): managed Postgres for orders, mandates and the hash-chained audit log, which is a meaningful use.
- **Best Use of MongoDB Atlas** (low): store the 17.5k Synkka documents. The nested JSON fits naturally. Pick either Aiven or Atlas, not both, unless there is a clear reason.
- **Best Use of Gemma** (low to medium): run a local or open model as the buyer agent, framed as "the hotel chain's agent runs on its own infrastructure", which ties into data sovereignty (CHALLENGES.md:L547).
- **Best Use of Tiger Data** (low to medium): only if we build standing-order drift with synthetic time series. Otherwise it would be forced.
- **Best Use of ElevenLabs** (low): voice intake for the kitchen ("80 covers tomorrow"). It adds to the legibility story but is peripheral.
- Poor fits, not recommended: Cloudinary (the catalogue's `medias` has IDs only, no URLs), Oxylabs (the sponsor wants agents working against Valio Aimo, not the open web), Solana and x402. x402 is "relevant context but not required" (CHALLENGES.md:L626) and is aimed at pay-per-request, mostly stablecoin, payments (https://www.x402.org/), which does not suit invoiced B2B wholesale (estimate). Hardware tracks do not fit.

## Constraints to respect in any direction

- The product data "must not be used for anything outside of this challenge" (portal home page). Keep the dataset out of the public MIT repo and download it at build or run time instead (inference).
- Rate limits are undisclosed (openapi.json), so cache responses and query only narrowed product lists. A throttled live demo is a real risk.
- Check with the mentors (CHALLENGES.md:L628-632) whether customer-specific pricing exists in the mock. Our probe saw none.
- Webshop test accounts are not available yet (CHALLENGES.md:L647). Do not depend on them.

## Estimates

- **Differentiation potential: 6/10.** The common shape (MCP, an agent and an approve button) will be crowded; Agent B estimates medium crowding. The data-level findings in §0 (passed cut-offs, date shifts, allergen versus lactose, unknown allergen data, a substitute that cannot be delivered) and the supplier-text injection angle are specific and unlikely to be found by most teams. Getting them right is how to differentiate, not novelty.
- **Demo potential: 7/10.** It runs against the sponsor's live API, has a natural before/after (naive agent versus gated agent), a real cut-off countdown on judging day, and a tamper-evident log. It loses points because protocol and back-end work needs a deliberately built UI to show up at all.
- **Overall-jury fit: 5/10.** It scores well on technical depth, measured evidence and a credible path forward. It scores weaker on "worthwhile problem with a specific user" and on how quickly peers grasp it, unless it is framed around a named kitchen persona and one chart. Agent B's estimate is that overall winners tend to be polished, user-facing demos rather than protocol work.

<!-- complete -->
