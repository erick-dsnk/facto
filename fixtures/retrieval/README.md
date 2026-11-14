# Retrieval verification

Deterministic retrieval fixtures live next to the adapter in
`services/api/src/providers/exa/retrieval.test.ts` and the normalization fixtures
in `services/api/src/evidence/normalize.test.ts`. They use injected providers and
synthetic passages; they are not live source observations or accuracy evidence.

Run both with:

```sh
npx vitest run services/api/src/providers/exa/retrieval.test.ts services/api/src/evidence/normalize.test.ts
```

The fixtures cover private-context exclusion from the initial query, exact admitted
spans, provider failure versus successful empty retrieval, prompt-injection text,
actual HTTP cancellation, source provenance, copied passages, Public Suffix List
grouping, URL deduplication, Unicode excerpt bounds and three-page content limits.

The adapter uses the official Exa SDK with a bounded, abortable HTTP transport.
Only `/search` and `/contents` at `https://api.exa.ai` are enabled. It never fetches
arbitrary source URLs directly. `EXA_API_KEY` is supplied by server configuration.
Page text is fetched for at most three promising results when highlights are
absent/short or omit claim-critical numbers, negation, attribution or qualifiers.
The deterministic relevance check only selects passages and limits content
requests; it does not judge truth. Excerpts remain a single exact contiguous span,
and evidence starts unjudged. A pure balanced alternate-query builder and a
six-record merge/dedupe helper are provided for future budgeted rejudgment; the
retriever still makes one exact-claim search and does not wire a second pass.

Evidence starts unjudged: source role is unknown, relevance/scope are false and
stance is unrelated. The judgment and deterministic source policies must qualify
it before any definitive verdict. Copy grouping detects obvious syndication;
it does not establish that ungrouped sources are independent.

Publication metadata preserves the provider's precision: a date-only value stays
`YYYY-MM-DD`, and an explicit-offset ISO datetime retains its stated time. Unknown,
invalid or ambiguous local dates are `null`; a publication day never implies that
the source supplied a midnight timestamp.

Live relevance, freshness and citation inspection still require configured Exa
credentials and a separately recorded live evaluation.
