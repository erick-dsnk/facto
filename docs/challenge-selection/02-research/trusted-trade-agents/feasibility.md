# Trusted Trade Agents (Valio Aimo): technical feasibility (Agent D)

**Summary**
- **Verdict (estimate): highly feasible for us.** The work is pure software (TypeScript, LLM tool use, a small data pipeline) with no hardware. The sponsor's mock API is live, fast (0.4-0.8 s per call), deterministic, and did not throttle 25 parallel calls in my test on 13 Nov 2026. A complete version fits in roughly 12-16 focused hours, which leaves about 20 hours for exceptions, trust features and polish.
- **The real work is building what the sponsor does not supply.** The mock only offers price and availability. There is **no order, approval or quote endpoint** ([portal OpenAPI](https://junction26.valioaimo.fi/openapi.json), password-protected). We have to build the order and approval layer, a policy engine and an audit log ourselves, and we have to get unit maths right (cases vs. litres).
- **Main demo risks:**
  - The mock's date behaviour is odd. Availability ignored `requestedDate` in my tests, and the order cut-off for Monday delivery is **Sun 15 Nov 17:00**, the same day as judging.
  - The mock returns undocumented quantity sentinels (999999 and 9999999999).
  - An LLM unit error (packs vs. litres) during the live run.
  - Sponsor-API or venue-network downtime.

  All of these can be mitigated with a deterministic core, a record-and-replay cache and a pinned scenario.
- **Ask the sponsor on Friday night:** whether a self-built order and approval mock is acceptable and expected; what the sentinels and the date and cut-off logic mean; whether the API stays up through judging; whether judges will run the entry themselves; and whether the product dataset may appear in our MIT-licensed public repo.

---

## 1. What I verified first-hand (13 Nov 2026, about 22:00 Helsinki)

| Fact | Evidence |
|---|---|
| The portal at https://junction26.valioaimo.fi/ redirects to `/login` and accepts the event password from CHALLENGES.md:L637. The home page lists a Pricing API, an Availability API, the product JSON plus its JSON Schema, a delivery-reliability CSV and a carbon-footprint CSV. | Portal home after login |
| The spec is OpenAPI 0.1.0. Its endpoints are `GET /api/ping`, `POST /api/price`, `POST /api/availability` and three `GET .../download` redirects. **There is no order, cart, quote or approval endpoint.** | https://junction26.valioaimo.fi/openapi.json |
| Auth is an `X-API-Key` header on everything under `/api`. The key is at CHALLENGES.md:L643. | Portal home; CHALLENGES.md:L641-L645 |
| A request carries `{customer, requestedDate, products[1..1000]}`. More than 1,000 products gives HTTP 422. The customer number does not affect responses. | OpenAPI description |
| Rate limits: "Undisclosed rate limits are in place". The spec also says solutions "should not be based on frequently retrieving prices and availabilities for **all** products". | OpenAPI `info.description` |
| Latency: ping took 0.95-1.5 s. Price and availability took 0.44-0.84 s. 25 parallel one-product availability calls all returned 200 in 0.44-1.28 s, with no rate-limit or `Retry-After` headers. The host sits behind Cloudflare. | My curl timings |
| Repeated identical calls gave identical price and availability bodies (only `timeNow` changed). | `diff` of two runs |
| `requestedDate` appeared to be **ignored** by availability. Requests for 2026-11-14, 11-16, 11-20 and 2027-01-15 all returned `availableDate: 2026-11-16` with the same amounts. That is consistent with the documented "earliest date when amount is available", but it means asking for a *later* date never changes the answer. | My curl tests |
| `closingTime` for Stock items was 2026-11-15T17:00+02:00, meaning order by Sunday 17:00 for Monday delivery. For Terminal items it was 2026-11-12T15:00, **already in the past**, yet they still showed delivery on 2026-11-16. That is inconsistent or unexplained. | Availability for 463038, 462921 and 460063 |
| Terminal stock is always reported as `999999` (documented). Some **Stock** items returned `9999999999`, which is **not documented** (for example 464073 and 463335). | Availability response vs. OpenAPI |
| An unknown product code still returns HTTP 200, with `error: true` (price) or an empty `scheduleLines` (availability). An empty `scheduleLines` also occurs for real products, such as 460013. | My curl tests |
| `products.json` is 87,077,467 bytes and took **137 s** to download from the conference network. It holds 17,546 products, 189 of which have a sponsor-defined `substitutions` list. | My download |
| Product record fields: `id`, `salesUnit`, `baseUnit`, `allowedLotSize`, `units[]{unitId, sizeInBaseUnits}`, `category`, `vendorName`, `countryOfOrigin`, `synkkaData` (names in en/fi/sv, `classifications`, `nutritionalContent`, `ingredients`, `unitConversions`, ...). | products.json |
| **Grounding the example request:** I found 70 products with a `FREE_FROM_LACTOSE` claim and "milk" in the English name. The list includes false positives such as "milk free" flour mix, wafer cones and "Milk Cream Powder". | My filter |
| **Unit trap:** 463038 "Valio Eila semi skimmed milk drink 10 l" sells in `KI` (case), and 1 KI = 2 ST of 10 L, so 20 L. Its price is €31.31 per KI with a comparison price of €1.57/L. Litres per sales unit can be derived as `catalogPrice / comparisonPrice` (31.31/1.57 = 19.9) or from `unitConversions.volume` when present. Neither value is a clean explicit field. | Product data plus live price |
| **Live answer for the example request (Monday 2026-11-16):** 463335 "Valio Eila 3% milk drink 1 l" costs €1.40/L with Stock `9999999999`. 464073 "Valio whole milk 1 l lactose free UHT" costs €1.64/L and has substitution → 464768. 463380 "Arla Café milk 1 L" costs €2.65/L with **698 ST available, which is partial for 1,000 L**. 462775 has only 51 ST. The data therefore contains a natural happy path (about €1,400 excl. VAT) and natural partial-availability cases. | Live price and availability calls |
| Schedule: final submissions close Sun 15 Nov 10:00 and review starts 10:30 (from our rules file, which cites the Junction site). The Terms let judges "run, access, and interact with your Submission in a test environment you provide". | docs/challenge-selection/00-rules-and-jury.md (lines 5, 22, 41-43) |

## 2. Architecture a credible entry needs

The judging puts 30% on a working request → lookup → order/approval demo, 20% on precision, 20% on guardrails and audit, 15% on exceptions and 15% on openness (CHALLENGES.md:L661-L679). Those weights point to a **seller-side gateway plus a separate buyer agent**, with every commitment decision made deterministically on the server:

```
 Buyer side                                   Valio Aimo side (what we "propose")
 ┌────────────────────┐   MCP / OpenAPI 3.1  ┌─────────────────────────────────────────┐
 │ Buyer agent (LLM)  │ ───────────────────▶ │ Agent Gateway                            │
 │ NL -> intent JSON  │  search / quote /    │  • catalogue search (local index)        │
 │ tool calls only    │  order / status      │  • quote = price+availability, signed,   │
 └────────────────────┘                      │    time-boxed (validTo / closingTime)    │
          ▲                                  │  • order: idempotency key, quote hash,   │
          │ approve/reject                   │    mandate check  -> COMMIT | PENDING    │
 ┌────────────────────┐                      │  • policy engine (deterministic)         │
 │ Approver UI (human)│ ◀─── pending ─────── │  • hash-chained audit log (2 views)      │
 └────────────────────┘                      └──────────────┬──────────────────────────┘
                                                            │ narrowed product IDs only
                                              record/replay cache ─▶ Valio mock API
```

Components (all estimates of design, not sponsor requirements):

1. **Catalogue index.** This is an offline extract-and-load step from `products.json` into SQLite or a JSON index, about 2-4 hours. It normalises names, claims, allergens and labels, and computes `litresPerSalesUnit` and `kgPerSalesUnit` from `units`, `unitConversions` and the name, with a confidence flag. It joins the reliability and carbon CSVs and the substitution lists. Search is a hard filter first (claim, comparison unit, category, allergens), with optional embedding or LLM reranking on top.
2. **Gateway API.** Built on OpenAPI 3.1 plus an MCP server, using `@modelcontextprotocol/server` v2 with Streamable HTTP and stdio, Zod schemas ([TS SDK](https://github.com/modelcontextprotocol/typescript-sdk)). It exposes `search_products`, `request_quote`, `place_order`, `get_order` and `list_pending_approvals`. A quote binds the line items, the price validity and the `closingTime`, and is signed (JWS, Ed25519). An order must reference the quote hash and an idempotency key.
3. **Policy / mandate engine.**
   - The buyer organisation's mandate is a JSON document: spend cap per order, allowed categories, hard allergen and claim constraints, maximum price per litre, delivery-date slack, and whether substitutions are allowed (only from the sponsor list, or any within constraints).
   - It is modelled on AP2's *open* mandate (constraints) and *closed* mandate (an authorised, finalised checkout) ([ap2-protocol.org](https://ap2-protocol.org/), Apache-2.0, v0.2). AP2's own samples are Python and Android, so we would implement a **documented subset** in TS rather than adopt an SDK.
   - The engine is pure code with unit tests. The LLM never decides whether an order commits.
4. **Buyer agent.** An LLM with tool use calls the gateway over MCP. Its job is to parse natural language into a structured intent and to explain choices. A second, different LLM or client hitting the same MCP endpoint is a cheap "it's open" proof.
5. **Approver UI and audit log.**
   - The approver UI is a small Next.js or Vite web page with a pending queue, approve and reject buttons, and a diff of request vs. offer.
   - The audit log is an append-only list in which each record holds `prevHash`. It has a buyer view and a Valio view, each step carries a one-line "why", and a "verify chain" button sits next to the log.
6. **Demo harness.**
   - A record-and-replay layer over the mock API (`LIVE`, `RECORD` or `REPLAY`), with an injectable clock.
   - Three or four pinned scenarios: a happy path, over-threshold approval, partial availability with a split order, and a sales block or substitution.
7. **Openness collateral.** A published OpenAPI file, an MCP tool listing, a mandate JSON Schema, and a short "mapping to UCP and AP2" page. UCP is Apache-2.0 with Checkout, Order and Identity Linking capabilities over REST, MCP or A2A, and has an official [js-sdk](https://github.com/universal-commerce-protocol) ([ucp](https://github.com/universal-commerce-protocol/ucp)). Its framing reads as consumer-oriented, and **whether it fits B2B wholesale is unknown**, so we cite it as an alignment target rather than claim conformance.

## 3. Critical dependencies and access

| Dependency | Access | Risk |
|---|---|---|
| Valio mock API (price and availability) | API key in CHALLENGES.md:L643, already working | Undisclosed rate limits; uptime during Sunday judging is **unknown**; Cloudflare-fronted |
| Product JSON, reliability CSV, carbon CSV | Portal downloads, already fetched | 87 MB and slow (137 s); the files "do not change during the challenge unless announced separately" (OpenAPI). The data "must not be used for anything outside of this challenge" (portal), so **keep it out of git** |
| An LLM API (Claude or any other) | Our own key | Latency of 2-10 s per agent turn (estimate) and provider rate limits; this is the main source of non-determinism |
| Hosting for judges | Our choice (for example Cloudflare or Vercel plus SQLite or KV) | The Terms allow judges to run the submission, so we need a hosted URL and demo credentials |
| Webshop test accounts | "will be shared separately once available" (CHALLENGES.md:L647); status **unknown** | Not needed for the core |
| Mentors on IT integration and data governance | CHALLENGES.md:L632 | Use them on Friday night for the open questions |

There are no paid APIs from the sponsor. The sponsor's documentation states no pricing for its APIs.

## 4. Integration complexity for our team (estimate)

- **Low:** the HTTP mock (two POST endpoints with plain JSON), the MCP server in TS, the approval UI, and LLM tool use. All of these sit in our strongest area.
- **Medium:**
  - Unit and pack maths across `salesUnit`, `baseUnit`, `units[].sizeInBaseUnits` and `allowedLotSize`.
  - Litres or kilograms per unit, which are not explicit fields.
  - Correctly interpreting the sentinels (`999999` Terminal = unknown, `9999999999` = unclear) and `closingTime`.
  - Search quality on noisy multilingual data. "Lactose-free milk" matches "milk free" products unless we also filter by `comparisonUnit = L` and category.
- **Medium-low:** JWS signing and a hash-chained log. Both need only standard libraries (WebCrypto Ed25519 and SHA-256).
- **Not needed:** hardware, payments (x402 and Nevermined are "relevant context but not required", CHALLENGES.md:L626) and real Valio systems (CHALLENGES.md:L623, L649).

## 5. Does it fit in about 38.5 build hours?

**Smallest complete version (MVP, target done by Sat 10:00, about 12-16 person-hours with agents; estimate):**
1. A catalogue index with deterministic unit maths, plus unit tests on 5-10 known products (463038, 463335, 464073, 463380, 462775).
2. A gateway with `search`, `quote` (live price and availability for 5-20 narrowed IDs) and `order`. The order goes to `COMMITTED` or `PENDING_APPROVAL` according to one mandate JSON.
3. A buyer agent that turns "1,000 L lactose-free milk by Monday" into an intent, then calls search, quote and order.
4. An approver page with one button, and an audit log with a human-readable "why" per step.
5. A record-and-replay cache and a pinned-date demo script.

That alone covers every core requirement (CHALLENGES.md:L557-L559) and the 30% end-to-end criterion.

**Then, in priority order (Sat 10:00 to Sun 06:00):**
- Exceptions: partial availability split across products, a late `availableDate`, `salesBlock`, empty schedule lines, and Terminal products weighted by delivery reliability.
- Substitutions: the sponsor list first, then good-better-best ranking within the constraints.
- Signed quotes and quote expiry.
- Hash-chained log verification.
- An MCP endpoint used by a second client.
- The openness write-up.
- Optional: carbon and label comparison.

Out of scope, and worth no credit: a marketplace, negotiation or a production transport choice (CHALLENGES.md:L549, L557, L616).

**Fit verdict (estimate): yes, with a wide margin.** The core is small. The risk is spreading effort over too many optional scenarios rather than running out of time.

## 6. Live demo: likelihood and failure modes (blunt)

Estimated likelihood of a clean live demo: **about 80-85%** with mitigations, and **about 55-65%** without them.

| Failure mode | How it bites | Mitigation |
|---|---|---|
| **Cut-off and date drift.** "By Monday" depends on a cut-off of Sun 17:00, and judging runs Sun 10:30-15:00 or later. If the mock's clock logic shifts (or if judges try it on Monday), Monday delivery becomes impossible and the happy path turns into an exception. Terminal items already show a *past* `closingTime`. | The demo's main path changes its outcome live | Treat `requestedDate` and the cut-off as first-class inputs. Make "too late, earliest is Tuesday" a designed exception path. Keep a `REPLAY` mode with a frozen clock and say so openly. |
| **Undocumented sentinels.** `9999999999` and `999999` read as real stock. | The agent claims "10 billion litres available", which is an instant credibility loss with sponsor judges | Map both to "unknown or unlimited" with an explicit flag, and ask the sponsor (section 7) |
| **Unit and pack error.** 1,000 L ordered as 1,000 cases of 20 L. | Fails the 20% "precision" criterion in front of the judges | Compute quantities deterministically, never with the LLM. Add property tests and show the maths in the UI ("50 KI × 20 L = 1,000 L") |
| **LLM misparses or loops.** | A slow or wrong turn on stage | Have the LLM output only an intent JSON validated by a schema, retry once, and offer a scripted fallback intent. Use a fixed model and temperature 0 |
| **Mock API down, slow, or rate-limited.** The limits are undisclosed, and Cloudflare is in front. | Lookup fails at the key moment | Use the record-and-replay cache and query only narrowed IDs (fewer than 50 per request) |
| **Venue Wi-Fi.** | Everything remote fails | Run a local build with replay fixtures and a phone hotspot as backup |
| **Search false positives.** "Milk free" wafer cones appear in the results. | Looks careless | Filter on claim, comparison unit L and category, and show the reasons for any exclusions |
| **Judges run it themselves** (Terms). | An unexplained UI or a missing key | Host it, ship a seeded demo account, and keep the README to one command |
| **Data or secrets leak into the public MIT repo** (rules file, line 5) | Breach of the portal data notice, and the API key exposed | Add `.gitignore` entries for the data, read the key from env (CLAUDE.md), and download the data in a setup script. Note that CHALLENGES.md itself contains the key and is currently untracked in our repo, so do not commit it to a public repo. |

## 7. Ask the sponsor on site before committing

1. Is building our own mock **order, quote and approval** service on top of price and availability what you expect? Will you provide an order endpoint later?
2. What does `availableAmount: 9999999999` on Stock items mean? Is it unlimited, unknown or a bug?
3. Is it intended that availability ignores `requestedDate` and always returns the earliest date? How should we read a past `closingTime` on Terminal items that still show delivery on Monday?
4. Will the mock API stay up, with unchanged data, through Sunday judging? What are the rate limits in practice?
5. How will partner judging run: our laptop, a hosted URL, or do you run it yourselves? When does it happen, and does the "by Monday" example need to work live on Sunday after the cut-off?
6. May the product dataset, or extracts of it such as fixtures, appear in our public MIT-licensed repo? (The portal says it must not be used outside the challenge.)
7. Do you prefer MCP, OpenAPI or A2A for the interface, and do you value AP2 or verifiable-credential-style mandates, or a simpler signed policy?
8. Are webshop test accounts coming (CHALLENGES.md:L647)? Is there anything they would show, such as certificates or labels in the webshop, that the JSON lacks?
9. Which spend or approval rules are realistic for a hotel-chain or school customer, so that our guardrail defaults look credible?

## 8. Sources

- CHALLENGES.md:L535-L693 (challenge text, judging and prizes).
- The resource portal https://junction26.valioaimo.fi/ and `/openapi.json` (password-protected, opened 13 Nov 2026), plus live calls to `/api/ping`, `/api/price`, `/api/availability` and the downloads.
- AP2: https://ap2-protocol.org/
- UCP: https://github.com/universal-commerce-protocol/ucp and https://github.com/universal-commerce-protocol
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Agent A report: docs/challenge-selection/01-challenge-intelligence/trusted-trade-agents.md
- Schedule and Terms digest: docs/challenge-selection/00-rules-and-jury.md
- Note: the session's web-search budget ran out during this task, so I found no community reports about the mock's reliability. Any such reports are **unknown**.

<!-- complete -->
