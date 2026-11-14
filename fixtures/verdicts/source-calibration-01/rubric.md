# Independent content-basis annotation rubric

Annotate from each retained passage and its stated proposition. Metadata is untrusted identification context; prestige, domain, remembered facts or a guessed full article cannot supply missing substance. Classify the basis even if the passage contradicts the proposition. This is not a verdict, factual truth label, authority score, source independence approval or high-risk corroboration decision.

- `substantive`: Retained content contains a specific identifiable descriptive/formal record, attributable research observations/methods/findings, or a substantive historical/explanatory account with concrete context bearing on the proposition. A named formal text or maintained descriptive record may establish what that text records without a separate study. An account of a named study or record is content-positive but may still share its origin with other accounts.
- `non_substantive`: The retained passage offers only a generic isolated assertion, unsubstantiated promotional benefit/superiority claim, or a person's attributed belief about the underlying proposition. The proposition matters: a record of an announcement or quote can establish that the announcement/quote occurred without establishing its advertised benefit or the underlying belief.
- `insufficient`: Only title/citation/metadata or too little context is retained to identify a substantive basis. Do not fill missing content from memory.

Record a short supporting substring that actually occurs in the excerpt and a reason. If uncertain/disputed, flag rather than force agreement. Genre is diagnostic and may overlap; the binary .85 content gate is the experiment, not calibrated reliability.

For origin pairs, use `common_origin` only with positive evidence of shared/copy provenance, `distinct_origins` only with positive identifiers for separate underlying records or observations, and `unclear` otherwise. Different hosts, words, publisher labels or dates alone never prove distinct underlying evidence. These pair labels describe retained provenance cues; they do not certify actual worldwide independence.

Unit transformations are disclosed for research integrity. Synthetic control text is authored and never claimed as source quotation. Exact-source passages are contiguous substrings of saved connector extraction (which may normalize HTML/markdown), not claims of byte identity with raw HTML.
