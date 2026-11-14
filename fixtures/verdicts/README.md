# Verdict policy fixtures

The executable cases in `services/api/src/policy/verdict.test.ts` use synthetic
passages and `.test`/example domains to exercise control flow. They are not live
retrieval results or measured fact-checking accuracy. The scoped NOAA fixture
tests the registry URL and proposition boundary, not a new provider fetch.

Each definitive fixture carries a retained excerpt, exact URL and validated
evidence ID. Tests cover support, contradiction, misleading, insufficient evidence,
credible conflict, source families, attribution, official advertising, fabricated
citations and malformed provider output. The judgment adapter preserves excerpts
and accepts enumerated retained IDs only.

`policy/sources.ts` documents the small source registry. New single-source
exceptions require a proposition-specific source review; `sourceRole: primary`
alone never authorizes a definitive verdict. All other cases need at least two
independent direct passages, with stricter corroboration for health/safety claims.
