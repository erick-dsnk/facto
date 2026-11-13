# Valio Aimo "Trusted Trade Agents": technical feasibility (Agent D)

**Summary**
- **Feasible and low-risk for this team (estimate: buildable 8/10, demo reliability 8/10).** It is software only. The mock API is live, fast (0.5-2 s per call) and returned identical answers on repeated calls when tested on 2026-11-13. We tested the canonical "1,000 L lactose-free milk by Monday" request against it and it resolves to real products and prices.
- **We must build the hardest parts ourselves.** The sponsor gives us only `price` and `availability` endpoints plus a static catalogue file. Search, quotes, orders, approvals and the audit log are all ours to build (verified in the OpenAPI spec). The work is a gateway, a policy engine, an agent and an approval UI, all TypeScript and LLM work the team is strong at.
- **Main risks:**
  - order cut-off times that depend on the clock and may expire before judging;
  - converting between units and lot sizes;
  - treating an empty allergen list as "allergen-free";
  - an LLM choosing the wrong product (for example chocolate milk);
  - venue Wi-Fi or the API failing during the demo.

  All of them can be mitigated: build a deterministic core, keep a frozen-clock fixture mode, and let the LLM only parse requests and explain decisions.
- **Smallest complete version (about 18 person-hours, an estimate):** natural-language request → structured requirement → filter the local catalogue → live price and availability → rank → policy decision → auto-order or human approval → audit log. Every judging criterion depends on this end-to-end flow (30% for "end-to-end", CHALLENGES.md:L661-663), so build it first.

---

## 1. What the sponsor actually provides (verified on 2026-11-13)

Portal: https://junction26.valioaimo.fi/ (password in CHALLENGES.md:L637; API key in CHALLENGES.md:L643). Spec: https://junction26.valioaimo.fi/openapi.json (requires a portal login cookie).

| Resource | What we observed | Source |
|---|---|---|
| `GET /api/ping` | `{"status":"ok"}`, about 0.8 s. A bad key returns HTTP 401 `Invalid or missing API key` | live curl |
| `POST /api/availability` | Body `{customer, requestedDate, products[1..1000]}`. More than 1,000 products returns HTTP 422. Returns `closingTime`, `salesBlock`, `logisticModel` (Stock/Terminal) and **at most one** `scheduleLine` `{availableAmount, availableDate, salesUnit}`. Latency 0.5-2.0 s | openapi.json, live curl |
| `POST /api/price` | Same body. Returns `catalogPrice` (per sales unit), `comparisonPrice` + `comparisonUnit` (L or KG only), `listPrice`, `tax`, `validFrom/validTo`, `netPriceFound`, `error`. About 1.1 s | openapi.json, live curl |
| Customer number | "customer number does not affect response so you can pass in whatever" | openapi.json |
| Order / cart / search / customer endpoints | **None exist.** We have to mock order placement and approval | openapi.json |
| Product file | 87 MB JSON with 17,546 products. **It took 214 s to download** (about 400 KB/s) on 2026-11-13. "will not change during the challenge without separate announcement" | `/api/products/download`, openapi.json |
| Delivery reliability CSV | 57 KB, `productId,deliveryReliability` (0-1), and not every product has a value | portal home, download |
| Carbon footprint CSV | 157 KB, `productId,AVG kg CO2-eq/kg`, given **per product group** rather than per product | portal home, download |
| Rate limits | "Undisclosed rate limits are in place". The spec says not to poll all products. We made 12 back-to-back calls and got **no HTTP 429** (observed; the actual limit is unknown) | openapi.json, live curl |
| Data use | The dataset "must not be used for anything outside of this challenge" | portal home page |
| Webshop test accounts | "will be shared separately once available" (unknown whether they will come) | CHALLENGES.md:L647 |

### Live test of the canonical request (2026-11-13 ~22:00 Helsinki, requestedDate 2026-11-16 = Monday)

| Product | Name (en) | Model | Available | Price per sales unit | €/L |
|---|---|---|---|---|---|
| 464306 | Valio Arki Eila semi-skimmed lactose-free 1 l | Stock | 9,999,999,999 ST | 1.01 (net price) | 1.01 |
| 465039 | Valio Eila semi-skimmed lactose-free 1 l (case of 5) | Terminal | 999,999 KI | 6.86 | 1.37 |
| 464201 | Valio semi-skimmed milk lactose-free 1 l UHT | Stock | unlimited | 1.56 | 1.56 |
| 469363 | (substitute of 464306) | Stock | **384 ST** (partial) | 2.48 | 2.48 |
| 464440 | Valio semi-skimmed lactose-free 0.5 l (substitute of 464201) | — | **empty scheduleLines (unavailable)** | 0.88 | 1.76 |

Takeaway: the happy path is cheap and simple (1,000 × 464306 ≈ €1,010 net). The data **does** contain natural exceptions to show: partial stock (469363), unavailability (464440) and explicit substitution rules. We will have to set up scenarios (budgets, a brand preference, a higher volume, a later date) so that the demo reaches them.

## 2. Data gotchas we verified (each one breaks a naive build)

1. **NaN tokens in the product JSON.** Standard `JSON.parse` and Python `json.load` fail on them. Replace `\bNaN\b` with `null` before parsing; Python then parses the file in 1.4 s (observed). Preprocess the file once into a slim index (SQLite or a compact JSON).
2. **Units.** Sales unit codes are SAP-style Finnish codes such as `KI`, `ST`, `PAL`, `KRS`, `PAK`, `PRK`, `RAS`. 6,622 products have `salesUnit ≠ baseUnit`. **The meaning of the codes is not documented** (unknown; we infer KI = case, ST = piece, PAL = pallet). Only 762 products have a litre volume in `synkkaData.unitConversions`. *Our trick (an estimate, but it worked on every milk we checked):* litres per sales unit ≈ `catalogPrice / comparisonPrice` when `comparisonUnit = L` (for example 465039: 6.86 / 1.37 ≈ 5 L per KI; 464768: 30.42 / 2.54 ≈ 12 L). The safest approach is to cross-check that against the `units[].sizeInBaseUnits` packaging hierarchy and the volume parsed from the name.
3. **`allowedLotSize` is 0.01 for 16,872 products** and 1.5-10 for the rest. The semantics are unknown (it might be a minimum order step in sales units). Ask the sponsor.
4. **Allergens.** 17,535 products have an `allergen` classification group, but only 7,205 have a non-empty list. **An empty list does not mean allergen-free**, and the portal says fresh produce often lacks the data. Treat "no data" as "unknown, needs human" in the policy engine; this is also a strong guardrail to show off. `FREE_FROM_LACTOSE` appears as a GS1 `nutritionalClaim` on 4,178 products; filter on that rather than on names.
5. **The keyword "lactose free" finds chocolate milk, protein drinks, kefir and cake bases** (89 name hits). The requirement parser needs a product-type facet, not just keyword matching. The 349 category codes have **no names** (unknown labels), so we must infer the categories ourselves from member products.
6. **An unknown product ID returns empty `scheduleLines`**, the same as "unavailable". Validate IDs against the local catalogue before calling the API, or the agent will report "out of stock" for an ID the LLM invented.
7. **Availability sentinels.** Stock items returned `9999999999`; the documentation mentions only `999999` for Terminal items. Treat both as "no known limit".
8. **Cut-off logic depends on the clock.** For Monday 16 Nov delivery, Stock items had `closingTime 2026-11-15T17:00`, but Terminal items showed `closingTime 2026-11-12T15:00`, which had already passed. Even so, `availableDate` was 2026-11-16. The semantics are unclear (ask). A request for 2026-11-14 returned `availableDate 2026-11-16`, so date shifting happens.
9. **Price validity.** Net prices are valid until 2026-12-31 and catalogue prices until 9999-12-31. This is fine for "fixed-price quotes" with an expiry date.

## 3. Architecture a credible entry needs

```
 Buyer side                                   Valio Aimo side (our mock of their agent interface)
┌──────────────────────┐   MCP (tools) and    ┌─────────────────────────────────────────────┐
│ Buyer agent (LLM)    │   OpenAPI REST twin  │ Agent Gateway                               │
│ - parse NL request → │ ───────────────────▶ │ - search_products (local index, GS1 facets) │
│   structured need    │                      │ - get_offers → live price+availability,     │
│ - pick tools, explain│ ◀─────────────────── │   returns a signed, expiring Quote (JWS)    │
└─────────┬────────────┘   signed quotes,     │ - place_order(quoteId, mandateRef)          │
          │                order status       │ - get_order / audit feed                    │
┌─────────▼────────────┐                      │ Mock order book (SQLite, state machine)     │
│ Buyer mandate/policy │                      │ Rate-limit-aware client + response cache    │
│ (declarative JSON:   │                      │ Fixture mode (recorded responses, frozen    │
│ spend caps, allergen │                      │ clock) for offline demo                     │
│ hard rules, subst.   │                      └──────────────────┬──────────────────────────┘
│ tolerance, brands)   │                                         │ X-API-Key
│ → auto / approve /   │                         junction26.valioaimo.fi /api/price, /availability
│   deny + reason codes│
└─────────┬────────────┘
┌─────────▼────────────────────────────────────────────┐
│ Web app: approval inbox (diff: asked vs proposed,    │
│ why, policy rule hit), order view, two-sided audit   │
│ log (human-readable + hash-chained JSON)             │
└──────────────────────────────────────────────────────┘
```

Design principles (our recommendations):
- **Deterministic core, LLM at the edges.** The LLM turns text into a typed `Requirement` (product type, claims, quantity + unit, date, preferences) and writes explanations. Filtering, unit conversion, ranking (good, better, best), policy decisions and order placement are plain TypeScript functions with unit tests. This is what makes the demo reproducible and gives the 20% "autonomy and controls" score something to show.
- **Open standards, so the openness criterion (15%, CHALLENGES.md:L677-679) has something to show:**
  - expose the gateway as an **MCP server** and an **OpenAPI 3.1** REST twin from the same tool schemas;
  - use GS1 identifiers (GTIN) and GS1 Synkka allergen and claim codes as the product vocabulary;
  - sign quotes as JWS (the trust protocol, CHALLENGES.md:L594).

  The vocabulary can be borrowed from existing open agent-commerce work:
  - The Universal Commerce Protocol defines Catalog, Cart, Checkout and Order capabilities over REST and JSON-RPC, with MCP, A2A and AP2 support (https://ucp.dev/). It covers no B2B or human-approval workflow, which is a gap we can claim to fill.
  - AP2 has "Open" mandates that carry budget constraints for human-not-present purchases, as verifiable digital credentials (https://ap2-protocol.org/). It is a good model for our buyer mandate.
  - MCP elicitation (`elicitation/create` with accept, decline or cancel) is a standard way for the server to ask a human for approval mid-flow (https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation). The spec marks it as new and liable to change, so the approval UI should be our own web app, with elicitation as an optional extra.
- **Respect the rate-limit warning.** Filter locally to fewer than 50 candidates before calling the API. Batch all candidates into one price call and one availability call per request. Cache results for about 60 s.
- **Fixture mode.** Record every live API response during rehearsal and replay it with a frozen "now" if the network or the API fails, or if cut-off times move during judging.

## 4. Critical dependencies and access

| Dependency | Access during the event | Risk |
|---|---|---|
| Valio Aimo mock API (`price`, `availability`) | Key in CHALLENGES.md:L643; works now | Sponsor uptime and undisclosed rate limits. Mitigation: fixtures |
| Product data JSON (87 MB) | Download now via API or portal; **do not commit it to a public repo** (data-use clause) | Slow download (214 s). Download once and share on a team drive or keep it outside git |
| Delivery reliability and CO2 CSVs | Same | Low |
| LLM API (Claude or OpenAI) with tool use and structured output | Our own keys | Latency and cost are small (estimate: under 10 calls per scenario) |
| Webshop test accounts | "once available" (CHALLENGES.md:L647) | Do not depend on them |
| Hosting (Vercel, Cloudflare or a laptop) | Ours | Venue Wi-Fi. Mitigation: run locally plus fixture mode |

No hardware, devices or paid sponsor services are involved.

## 5. Integration complexity given our skills (estimate)

Low to medium. The API surface has two endpoints with simple JSON; there is no OAuth, SDK or webhook. The real complexity is domain logic (units, lots, allergens, cut-offs, substitutions) and product design (policy model, approval UX, audit format). Full-stack and agent skills cover all of it. ML skills are optional (the stretch goal of detecting drift in standing orders).

## 6. Does it fit in 40 hours? Build plan (estimate, 3 people with parallel agents)

| Block | Hours (wall clock) | Owner |
|---|---|---|
| Ingest: NaN-safe parse → SQLite index with en/fi names, GS1 claims and allergens, litres/kg per sales unit, reliability, CO2, substitution graph | 0-5 | A |
| Gateway: MCP + OpenAPI tools, API client with batching, cache and fixtures, signed quotes, mock order state machine | 0-10 | B |
| Policy engine (declarative mandate, reason codes) + ranking (good, better, best) + unit tests | 3-12 | C |
| Buyer agent: NL → Requirement (structured output), tool loop, explanations | 5-14 | A |
| Web UI: request box, offers table, approval inbox with diff, audit timeline | 8-20 | B/C |
| **End-to-end MVP frozen (canonical milk scenario)** | **by ~h20** | all |
| Exceptions: partial availability split across products and dates, substitution under allergen rules, cut-off missed → next date | 20-30 | A/C |
| Trust: JWS-signed quotes verified by the buyer agent, a hash-chained audit log readable by both sides | 22-30 | B |
| Stretch: recipe-to-order or a proactive selling agent; CO2/reliability tie-breakers | 28-34 | any |
| Recording fixtures, rehearsal, pitch, backup video | 34-40 | all |

**Smallest complete version:** a single scenario ("1,000 L lactose-free milk by Monday").
1. The LLM parses the request; the code filters products with `FREE_FROM_LACTOSE` that are plain milk.
2. One live price call and one availability call.
3. Rank by €/L, then by delivery reliability.
4. Apply a policy rule (for example, auto-approve under €800 net, otherwise send to a human), so €1,010 goes to approval.
5. A human clicks approve, an order is created, and the audit log shows each step with its reasons.

This is about 18 person-hours (an estimate) and already covers all three core requirements (CHALLENGES.md:L557-559) plus the 30% end-to-end criterion.

## 7. Live demo: likelihood and failure modes

Estimated success with fixture fallback: **about 90%**. Without fixtures: about 70%, because of network, API and clock exposure.

| Failure mode | Likelihood (estimate) | Mitigation |
|---|---|---|
| **Cut-off passed:** a "by Monday" request demoed after Sun 15 Nov 17:00 makes Monday infeasible for every Stock item (`closingTime 2026-11-15T17:00`, observed) | High if judging is on Sunday afternoon or evening (the judging time is unknown) | Phrase the demo request relative to the demo time ("by Wednesday"), or present the missed cut-off as the planned exception; keep a frozen-clock fixture |
| Mock API down, slow or rate-limited (429) during judging, when every team is calling it | Medium | Fixture replay toggle; batch calls; cache |
| Venue Wi-Fi fails | Medium | Run locally; record fixtures; backup video |
| LLM picks the wrong product (chocolate milk, protein drink) or the wrong quantity unit (1,000 cases instead of 1,000 L) | Medium without guards | Typed `Requirement` + deterministic filters + a sanity check (`total litres ≈ requested ± one lot`) |
| Allergen "unknown" shown as "safe" | Medium | Policy: missing data means human approval; show it in the demo |
| Exceptions never fire because availability is effectively unlimited | High for the milk example | Scripted scenarios: high volume of 469363 (384 available), 464440 (unavailable), tight budget, brand exclusion |
| The NaN parse breaks on a re-downloaded file | Low | Preprocess once; commit only a derived index privately (check the data-use rule) |
| The dataset or API changes mid-event ("unless announced separately") | Low | Watch the announcements; re-record the fixtures |

## 8. Questions to ask the sponsor on site before committing

1. Do they expect an **order endpoint** to be mocked by teams (confirmed absent from the spec), or will one be added? Is there an expected order or confirmation format?
2. What do the **sales unit codes** (KI, ST, KRS, PAL, PAK, PRK, RAS, ...) and **`allowedLotSize`** (0.01 for most products) mean?
3. What do **`closingTime` for Terminal products** in the past and `availableDate` on the requested date mean together? Can we pass a simulated "now"?
4. What are the actual **rate limits**, and will the API stay up through judging? When exactly is judging (relevant to cut-offs)?
5. Will **category names** and **certificate/label data** ("already shown in the webshop", CHALLENGES.md:L563) be provided? We found label data only inside `synkkaData` classifications.
6. Do they **prefer a standard** (MCP vs OpenAPI vs UCP/AP2-style), or is any open one fine?
7. **Submission format** and the data-use rule: can the repo be public if the product data is gitignored?
8. Will the webshop test accounts arrive, and do they matter for judging?

## 9. Verdict (estimate)

A strong core is clearly buildable in 40 hours. The risk lies in the demo setup rather than the technology. Build the deterministic end-to-end flow by about hour 20, add fixture mode early, choose demo dates relative to the judging time, and spend the rest on guardrails, exceptions and the trust and audit layer, which is where the remaining 50% of the score sits (CHALLENGES.md:L669-675).

<!-- complete -->
