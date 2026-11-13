# Feasibility: The Web Is Your Real-Time Database (Context.dev)

Agent D (technical feasibility). Written 2026-11-13.

## Summary

- **We can build this.** It is a pure software challenge: an HTTP API with a TypeScript SDK, plus webhooks, plus an LLM decision layer. That is squarely in our core skill set and needs no hardware (CHALLENGES.md:L2797, L2819). Estimate: a strong core feature ships in about 20 to 25 of the 40 hours, which leaves time for polish, evaluation numbers and the pitch.
- **The biggest unknown is which plan the JUNCTION26 credits put us on.** The challenge promises 50 concurrent requests and no rate limit (CHALLENGES.md:L1687, L2797). The public docs say a Free organisation gets **2 concurrent requests, 10 monitors and 10 requests per minute** (https://docs.context.dev/account/billing.md, https://docs.context.dev/optimization/rate-limits.md). If redeeming the code does not lift those limits, a "watch many sites" design breaks. Settle this with a mentor before committing.
- **"Real-time" is slower than the challenge wording suggests.** A monitor runs at most every **10 minutes** (https://docs.context.dev/monitors/schedules). A manual "run now" is queued, and the docs give no execution time. Webhook delivery latency is not documented either (https://docs.context.dev/webhooks.md). Showing a change on stage within seconds therefore has to be engineered: a web page we control, plus "run now" or our own fast polling, with a recorded replay as backup.
- **Demo reliability is good if we control the trigger** (estimate 8/10). It is poor if the demo depends on a third-party site changing live or on venue Wi-Fi delivering webhooks to a laptop (estimate 4/10). The design below assumes the first.

## 1. Architecture a credible entry needs

The judging gives 20% each to impact, creative multi-source use, demo completeness ("how ready is it for production?"), technical execution ("latency and accuracy of data") and real-timeness ("react to change over time or take a one-off snapshot?") (CHALLENGES.md:L1706-L1726). A credible entry therefore needs history, several sources, a measurable decision and a deployed app.

```
                 +-------------------- Context.dev ---------------------+
                 | monitors (page / search / sitemap / extract) --webhook-+--> /api/webhooks/context (verify HMAC, dedupe on body id)
                 | scrape + JSON extract, news, search, brand, parsers   |
                 +-----------------------^------------------------------+
                                         | SDK calls (server only, key from env)
 scheduler (Vercel cron / Worker cron) --+--> collectors: poll fast sources ourselves when 10 min is too slow
                                         v
                     Postgres (Neon) or SQLite: sources, snapshots (time series), change events, decisions, metrics
                                         v
                     decision agent (LLM): fuses the change event + enrichment/news context -> typed decision + action
                                         v
                     web UI: live timeline/diff feed (SSE), entity pages, latency and accuracy panel, "why" with sources
                                         +--> actions: Slack/email/webhook out, re-rank, alert
```

Components, with an estimate of who builds what (three people plus agents):
1. **Context.dev client module** (one file, mockable, per the CLAUDE.md conventions). Handles the `success` flag checks, `maxAgeMs: 0`, timeouts and retry policy. It has a fixture-backed mock for development and for demo fallback.
2. **Ingestion**: monitors created at startup and a webhook receiver, plus a cron poller for sources where we want sub-10-minute freshness or that monitors do not cover (news, social parsers).
3. **Store**: snapshots and events kept over time. The real-timeness criterion rewards visible history ("since Friday night, X changed 14 times").
4. **Decision layer**: an LLM with a typed output (decision, confidence, cited evidence URLs), with source fusion as the differentiator for "creative use".
5. **UI**: a live event feed, a per-entity timeline, and a metrics panel showing change-to-decision latency and extraction accuracy on a small labelled set (our ML strength).
6. **Deployment** to a public URL. Monitor webhook receivers must be public HTTP(S) URLs (https://docs.context.dev/monitors/limits-and-errors.md), so a deployed backend is cleaner than a laptop and tunnel. The challenge suggests Cloudflare Tunnel for local webhooks (CHALLENGES.md:L2841).

The sponsor's own reference app, GPU Terminal, is the template to copy: Next.js, Neon Postgres, and a Vercel cron every 30 minutes that scrapes with Context, runs structured extraction only on changed documents, and keeps snapshots in Postgres (https://github.com/context-dot-dev/gpu-terminal). That is a good sign that the stack is proven. It also shows that the sponsor's own "live" product refreshes every 30 to 60 minutes, not every few seconds.

## 2. Critical dependencies and how we get access

| Dependency | Access during the event | Notes |
|---|---|---|
| Context.dev account and API key | Sign up at context.dev/signup, redeem JUNCTION26, copy a key (CHALLENGES.md:L2816-L2818) | Keys start with `ctxt_secret_`, server-side only, env `CONTEXT_DEV_API_KEY` (https://docs.context.dev/quickstart) |
| 50,000 credits | The redeem code (CHALLENGES.md:L1687) | One balance per organisation, shared by every key (https://docs.context.dev/account/credits) |
| SDK | `npm install context.dev` (CHALLENGES.md:L2819), Node 20+ (https://docs.context.dev/sdks.md) | |
| Public HTTPS endpoint for webhooks | Vercel/Cloudflare deploy, or Cloudflare Tunnel (CHALLENGES.md:L2841) | Must return 2xx within 15 s (https://docs.context.dev/webhooks.md) |
| LLM API (Claude/OpenAI) for decisions | Our own keys | Not provided by the sponsor. Context's Answers endpoint is an alternative but costs 10 or 100 credits per call (https://docs.context.dev/account/credits) |
| Database | Neon/Supabase free tier, or SQLite | |
| Third-party target sites | The open web | Some sites block automated access, and respecting their terms is our responsibility (CHALLENGES.md:L2842) |
| Mentors | On site Fri until 23:00, Sat 09:00 to Sun 02:00, Sun from 07:00 (CHALLENGES.md:L1681) | The CTO is also the lead judge (CHALLENGES.md:L2859) |

## 3. Limits, pricing, latency and reliability (documented)

**Plan limits: a documented conflict.**
- The challenge says "There is no rate limit, with a maximum of 50 concurrent requests per organisation" (CHALLENGES.md:L2797) and "Each team can run up to 50 concurrent requests" (CHALLENGES.md:L1687).
- The billing docs list the Free plan at 1,000 credits a month, **2 concurrent requests, 10 monitors and 1 active batch**. Developer is 10 concurrent and 100 monitors, and Pro is 100 concurrent and 1,000 monitors (https://docs.context.dev/account/billing.md).
- Free also has a cap of 10 requests per minute per organisation (https://docs.context.dev/optimization/rate-limits.md, https://docs.context.dev/quickstart).
- The docs do not say how redeemed credits interact with Free plan limits: unknown (https://docs.context.dev/account/billing.md). `GET /monitors/limits` returns `monitors_limit`, so we can check our real monitor allowance on Friday night (https://docs.context.dev/monitors/limits-and-errors.md).

**Credit costs** (https://docs.context.dev/account/credits):

| Operation | Cost |
|---|---|
| Scrape | 1 (2 with browser actions); +4 if JSON extraction succeeds |
| Search | 1 per 10 results |
| News | 1 per 10 results |
| Answers | 10 `fast`, 100 `ultra`. **`ultra` is the default** |
| Brand | 10 |
| Styleguide | 10 |
| People enrich | 20 per match |
| Company search | 2 or 10 per page |
| Monitor run | 1 for page/sitemap, 2 for search, 10 for extract. Baseline runs count. Failed runs are free |

Cached results cost the same as fresh ones (CHALLENGES.md:L2840).

**Budget estimate (ours):** 20 page monitors every 10 minutes for 36 hours is about 20 × 216 = 4,300 credits. 10 search monitors every 10 minutes is about 4,300 credits. A poller scraping 30 pages with extraction every 5 minutes is about 30 × 5 × 432 = 65,000 credits, **which blows the budget**. So run extraction only when the markdown hash changes, as GPU Terminal does. Never leave Answers on its `ultra` default.

**Freshness and latency.**
- Monitor schedule minimum: 10 minutes. With no schedule, a monitor runs once a day (https://docs.context.dev/monitors/schedules, https://docs.context.dev/monitors/overview.md).
- Run now: `POST /v1/monitors/{id}/run` returns 202 and queues the run. Execution time is undocumented. If a run is already in progress, the new one is skipped as "superseded" (https://docs.context.dev/monitors/schedules).
- Each monitor's first run is a baseline that never reports a change. Search monitors only report results published **after the monitor was created** (https://docs.context.dev/monitors/overview.md, https://docs.context.dev/monitors/targets/search.md). **Consequence: create the monitors on Friday night, or the search-based demo has nothing to show on Sunday.**
- Extract-monitor snapshots refresh at most once a day (https://docs.context.dev/monitors/overview.md). They are useless for intra-day real-time work.
- Scrape: the server deadline defaults to 90 s, and the maximum is 300 s (https://docs.context.dev/optimization/timeouts.md).
- No latency figures are published for any endpoint: unknown. We must measure p50 and p95 ourselves in hour 1.
- Results are cached for up to 3 days by default. Use `maxAgeMs: 0` for fresh data (CHALLENGES.md:L2840).

**Correctness traps.**
- A 200 response can contain failed outputs, so check each `success` (CHALLENGES.md:L2839, https://docs.context.dev/quickstart).
- **The SDK retry trap.** The TS and Python SDKs time out after 60 s per attempt and retry twice on 408, 409, 429 and 5xx. Scrape's server deadline is 90 s. The docs warn that if the SDK timeout is not raised above the deadline, the SDK may retry while the first attempt is still running (https://docs.context.dev/sdks.md). That means duplicate calls, possible duplicate charges and extra concurrency against a possibly tiny limit. Set `timeout` explicitly.
- JSON extraction fills required, non-nullable fields with a best-effort value "which can be a guess". Mark facts that might be missing as nullable. Long pages are truncated, and the output then carries `isTruncated: true` (https://docs.context.dev/scrape/json.md).
- Semantic search monitors fail the run with `judge_failed` if the judge returns no verdicts. Failed runs send no webhook (https://docs.context.dev/monitors/targets/search.md, https://docs.context.dev/monitors/overview.md).

**Webhooks.**
- Signing: `X-Context-Signature: t=<unix>,v1=<hex>`, an HMAC-SHA256 over `t.rawBody` keyed with the `whsec_` secret. Verify against the raw body before parsing it (https://docs.context.dev/webhooks.md).
- Deduplication: one page says to deduplicate on the body `id` (https://docs.context.dev/webhooks.md), and the monitors page says `X-Context-Id` (https://docs.context.dev/monitors/overview.md). Use the body `id`.
- Retries: at 10 s, 60 s, 300 s and onwards (https://docs.context.dev/monitors/overview.md). Manual replay is available for 7 days (https://docs.context.dev/webhooks.md). Replay is a useful demo-recovery tool.
- Payload: the fields inside `data.change` for page monitors (whether there is a diff or before/after text) are **not documented in the pages we opened: unknown**. Search-monitor changes include `matched_urls`, `evidence`, and in semantic mode a `title`, `summary` and `importance` (https://docs.context.dev/monitors/targets/search.md). If page changes carry no diff, we need to scrape again and diff the content ourselves (about 1 credit each).

**Service reliability.** We found no public status page or incident history for context.dev. A search returned only an unverified generic StatusGator "Context" page (https://statusgator.com/services/context/map). Unknown. Treat it as a young API (YC S26, CHALLENGES.md:L1704): plan for a fallback.

## 4. Integration complexity given our skills

Low. Estimate: 2 out of 10 on the integration side.
- It is REST plus a typed TS SDK.
- There is an MCP server and an agent skill for our coding agents (CHALLENGES.md:L2822, L2835).
- Webhook HMAC verification is about 20 lines of code.
- The hard parts are product and data design, not plumbing:
  - picking sources that change often enough to show;
  - designing extraction schemas that stay accurate;
  - getting a fused signal that is not trivially "scrape and summarise".
- Our ML and evaluation strength maps directly onto the "accuracy" half of the technical execution criterion: a labelled set of 30 to 50 extractions, precision of change detection, and a latency histogram.

## 5. Does it fit in 40 hours? Smallest complete version

**Yes.** Estimated plan, with three people working in parallel and agents:

| Hours | Work |
|---|---|
| 0-2 | Sign up, redeem the code, check `monitors_limit`, the concurrency limit and the rate limit, and measure p50/p95 latency for scrape, news, search and brand. Ask mentors the questions in §7. Pick the use case. |
| 2-8 | Client module and mock, DB schema, deployed skeleton with the webhook receiver. **Create the real monitors by the end of Friday night** so history and search baselines start accumulating. |
| 8-20 | Collectors, decision agent, live feed UI, actions (Slack/email). |
| 20-30 | Multi-source fusion, metrics panel (latency and accuracy), labelled eval set, controlled demo page, recorded-replay fallback. |
| 30-38 | Polish, rehearsal (×3 on venue Wi-Fi), pitch, README with "endpoints used and why" for the tech challenge (CHALLENGES.md:L2789). |

**Smallest complete version** (still scores on all five criteria):
- One vertical, for example supplier/competitor risk or a "scrape the economy" price index.
- At least 10 real targets watched by page monitors, plus 2 or 3 search monitors and a news poll per entity. That is three source types, aimed at "creative use".
- History stored since Friday night and shown as a timeline (real-timeness).
- One LLM decision type with cited evidence.
- One outbound action.
- A deployed URL.
- A visible metrics panel (technical execution).

**Cut first:** brand theming, people enrichment, social parsers, batch.

## 6. Live demo: likelihood and failure modes

Estimate **8/10** with the mitigations below, and **4/10** without them.

| Failure | Likelihood (estimate) | Mitigation |
|---|---|---|
| A real target site does not change during the 3-to-5-minute demo | High | Never depend on it. Show the weekend timeline for real history, and trigger the live moment on **a page we control** (for example a mock supplier price page we edit on stage), then call run-now or our own poller |
| Run-now queue or webhook delivery takes minutes (undocumented) | Medium | Measure it on Saturday. If it is slow, the live path uses our own direct `scrape` with `maxAgeMs: 0` plus a diff (one API call, seconds, estimate), and monitors carry the background history |
| Concurrency 2 or 10 rpm (Free limits) produces 429s during the demo | Medium until confirmed | Confirm the limits on Friday. Queue calls client-side, and pause the background pollers during the demo |
| Venue Wi-Fi drops or the tunnel dies | Medium | Deploy the backend to the cloud so webhooks do not touch the laptop. Bring a phone hotspot |
| Target sites block the scraper or give partial content | Medium | Pre-test every target. Prefer sites with official feeds or the documented parsers. Respect site terms (CHALLENGES.md:L2842) |
| Credit exhaustion on Sunday | Low-medium | A credit meter in the dashboard. No `ultra` Answers. Extract only on a hash change |
| LLM decision is slow or wrong on stage | Low-medium | Use a fast model with typed output, a precomputed context bundle per entity, and a timeout that falls back to a rules-based decision |
| Duplicate events from SDK retries or webhook retries | Medium | Raise the SDK timeout, use idempotent writes keyed on the body `id` |
| Everything fails | Low | A recorded replay mode in the mock module plays the real captured event sequence through the same UI |

## 7. Ask the sponsor on site before committing

1. Does redeeming JUNCTION26 move us off Free limits (2 concurrent, 10 monitors, 10 rpm)? What are our real concurrency, rate and `monitors_limit` values? (CHALLENGES.md:L2797 vs https://docs.context.dev/account/billing.md)
2. What is typical run-now execution time and webhook delivery latency? Can a monitor be scheduled below 10 minutes for the event?
3. What exactly does a page-monitor `change.detected` payload contain? Is there a diff or before/after text?
4. Is calling Context.dev in the core flow formally required for the main challenge, or only for the Best Use tech challenge (CHALLENGES.md:L2780)? What is the main-challenge submission format? (Unknown in the source text.)
5. Will they judge from a live demo, a video or the repo? Does the CTO (lead judge, CHALLENGES.md:L2859) want endpoint-level detail?
6. Which endpoints are newest or least used, so our project shows them off (showcase value, CHALLENGES.md:L1698)?
7. Are there known flaky targets or blocked categories, and how should we handle sites whose terms forbid scraping?
8. What are the expected latency and reliability of news and search freshness? How soon after publication does an article appear?

<!-- complete -->
