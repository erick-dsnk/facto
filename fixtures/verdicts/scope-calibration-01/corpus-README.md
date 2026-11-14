# Open scope-compatibility calibration

Sixteen proposition/passage units test whether the evidence addresses the same referent, relation and material circumstances. The intended first-label balance is eight matches where the asserted value is contradicted, and eight mismatches involving another edition, period, entity, standard, population, condition or relation. They are paired across eight public source families;16 observations do not mean16 independent sources. This is a targeted development set, not blind evaluation, factual accuracy, source-quality calibration or production evidence.

Selected sources are the University of Utah Marriott Library (Frankenstein editions), Statistics Canada (2021 census), National Geographic (South American geography), NIST (foot standards), Australian Museum (egg-laying mammals), StatPearls/NCBI (adult bone count), Particle Data Group/Lawrence Berkeley National Laboratory (methane properties), and Suez Canal Authority (dimensions). All eight selected originals returnedHTTP200. Their raw response hashes and observation times are retained in `origin-checks.json`. Unused early source searches returned403 for UPenn and Morgan and are not counted as accessible selected sources.

Every model-facing excerpt is an exact contiguous substring of a saved connected-web extraction, no longer than1350 Unicode code points. `sourceExtractionSpan` points to its saved extraction file with half-open code-point offsets. Extraction may normalize HTML, markdown, whitespace or mathematical formatting; HTTP200 and an extraction-substring check do not imply literal byte identity with raw HTML. The snippets deliberately limit context for some controls: e.g., newborn counts from adjacent unretained text cannot be used to answer a newborn claim when only adult count is retained. This is disclosed truncation for scope analysis, not a claim about the full page's usefulness.

Propositions intentionally contain wrong values or changes of referent/conditions. They are test propositions, never asserted factual conclusions. The eight positive scope cases all involve contradiction or a universal counterexample; this cohort does not test every support-scope combination. Matching scope alone grants no definitive verdict, substantive basis, source authority or independent origin. Formal standards reproduced across institutions remain one underlying decision where dependence is shown.

During this authoring assignment, the curator inspected only publicly named broader-development texts to exclude overlapping cases and public source material, not implementation/candidate prompts, private sealed cases or original heldouts. Before this separate assignment, the same curator had read existing production scope instructions while diagnosing the public broader baseline. That prior baseline exposure is disclosed; the authoring-phase no-read flags do not mean lifetime blindness. No new scope candidate prompt was viewed. No project-key/model/engine calls were made. Unknown coincidental overlap with sealed sets cannot be ruled out and was not investigated. All units remain open development.

Files:

- `annotation-inputs.json`: shuffled minimal id/proposition/title/URL/excerpt packet for independent second annotation.
- `units.unlabeled.json`: same units plus audit metadata. Strata and counterfactual metadata must never enter model state.
- `annotation-first.json`: independently frozen first labels/reasons/supporting substrings.
- `rubric.md`: scope separated from agreement and other evidence gates.
- `first-freeze.json`: pre-output corpus/label hashes.
- `origin-checks.json`: selected original-page availability and response hashes.

The second annotator must freeze their labels before reading first labels, implementation, candidate prompts or model outputs. Preserve ambiguous cases and any disagreement; do not force the intended8/8 balance or relabel to favor a model. Root has not authorized executing this corpus; future runs need a concrete freeze and bounded call/token/byte/wall-time plan. No thresholds, prompts or production policies were modified.

Independent review completed: all16 labels agree, eight matches and eight mismatches, with no unresolved ambiguity or exclusions. Both original annotation files remain unchanged. `annotation-adjudicated.json` and `adjudication.json` record the agreement and exposure caveat; `manifest.json` freezes the exact artifacts.
