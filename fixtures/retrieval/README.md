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
requests; it does not judge truth. Initial retrieval searches the exact admitted
claim with five results. An explicitly configured balanced alternate uses eight
results and a descriptive record query containing the verbatim admitted claim.
Both use the supported neutral `objective` and query-directed highlights with a
4,000-character requested limit. Content enrichment requests 12,000 characters
of text and 4,000 characters of query-directed highlights together. Existing and
enriched highlights remain candidates when a page prefix is incidental.

Each invocation makes one search. The caller controls the alternate pass and
must share the existing two-search/three-content budget. An optional shared
`canConsume` context stops optional enrichment when that budget is exhausted.
Neither pass follows retrieved links or executes retrieved instructions.

Excerpts remain one exact contiguous span of at most 2,000 Unicode code points.
Selection anchors on local subject coverage, then compact subject span and
source order. It does not rank anchors by agreement with the claim's numbers or
qualifiers. Nearby preceding/following context is retained when it fits. A distant
correction, keeper footer, or qualification outside that window can still be
lost. Selection does not infer currentness, guarantee relation relevance, or
assert that the entire page was inspected. The synthetic regression with an
early correction and distant obsolete summary keeps the same correction when
the checked year is swapped; it does not claim semantic currentness detection.

Local analysis uses overlapping 600-code-point paragraph windows at a 200-point
stride plus a linear sentence/line scan. Prefix offsets advance incrementally;
there is no repeated whole-prefix reconstruction. At the parser's maximum
100,000-character page bound a single long paragraph has at most 500 windows.
With many short paragraphs there can be more windows, but each input point is
visited by at most three overlapping windows plus the sentence/line scan, so
total scanned text remains linear. Individual scoring units are at most 600
points. A maximum-size unpunctuated-line
regression covers newline termination. A local 99,835-character stress page took
about 30 ms; that measurement is not a latency guarantee.

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

The authorized public acquisition-only diagnostic and independent artifact review
are recorded in [public-acquisition-01-resumed](public-acquisition-01-resumed/README.md).
This record contains no Jev judgments and makes no factual-accuracy claim.
