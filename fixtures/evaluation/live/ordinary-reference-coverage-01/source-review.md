# Independent ordinary-reference source review

State: source review and first-run selected-citation audit complete. Reviewer: `evidence_filter`, 2026-11-14. Active checkout: `/workspace/junction-2026-current`, initial base `e7ca003`.

Read `AGENTS.md`, `docs/fresh-cloud-continuation.md`, the restored NEW24 analysis report and summary, current assessment/source policy and judgment adapter. No historical sealed/private/held-out body was opened. No paid provider request has been made by this reviewer.

## Rationale and boundaries

The previous requirement that every useful secondary account identify an underlying named record can exclude developed reference descriptions of ordinary facts. A separate `ordinary_reference` category can make those accounts eligible for corroboration without treating their host or title as proof. The new category must still contain the actual entity/relation/value and every material scope qualification; merely repeating the proposition, reporting somebody's belief or advertising effectiveness remains insufficient.

The first inspected policy draft accepts this category only when risk is ordinary with the existing risk confidence threshold and no lexical high-risk trigger. It requires the unchanged family/dependence machinery and two qualifying families. The category does not receive the registry single-source exception or participate in the high-risk corroboration path. Directness, scope, stance, conflict and joint verdict gates remain mandatory. This is a deliberate general source-eligibility change, not a demonstrated accuracy improvement.

The adapter must preserve confidence semantics for existing substantive categories. The Jev author confirmed that the four-category probability sum applies only when `ordinary_reference` is selected; old substantive selections keep their old three-category sum, preventing the new ordinary category from increasing high-risk eligibility indirectly. Probabilities are model outputs, not calibrated factual certainty.

NEW24 failed its frozen criterion: 2/12 compatible passes, 0/6 incompatible accepts and 1/6 uncertain accept. All 24 ordinary outputs abstained. The confidently accepted ambiguous date-role example is a warning against letting a developed-sounding account settle an underspecified relation. No NEW24 capability is installed here. No confidence cutoff is lowered on account of those results.

## Exact selected-citation verification method

Once root's new bounded campaign has completed, freeze its first output before inspection. Extract the exact checked text, definitive verdict, original `selectedEvidenceIds`, and the corresponding retained URL/title/excerpt for every selected occurrence. Preserve all selected references, including references beyond the minimum corroboration count. Do not select a replacement URL because an original is inaccessible or incomplete.

For each unique selected URL, make a bounded public source retrieval; record timestamp, actual URL/redirect chain, HTTP status, content type, byte count, body hash and access limits. Retain source material or an exact reproducible content extract outside Git. A successful HTTP status alone is not content access: error pages, bot checks, unrelated redirects, app shells, truncation before the proposition and withheld paywall bodies remain unverified. No search snippet or domain reputation substitutes for inspecting the selected page.

Then independently compare the exact proposition against the retained excerpt and accessible page. Verify entity, factual relation, asserted value or contrary value, time/date role, place/population, negation, quantity, ordinals, conditions and exceptions. Record whether the excerpt is present or faithfully reproduced in the page and whether it supplies substantive evidence of the full proposition. For `contradicted`, the source must establish the incompatible alternative under matching circumstances; absence of support does not establish contradiction. For `misleading`, identify the concrete omitted qualification. Content that discusses only a partial relation fails exact-scope verification.

Record provenance separately: named document/dataset/keeper, page ownership where established, explicit shared origin, copied passages, and any uncertainty. Distinct publishers do not prove independent origins. Disclose agent inspection, not human review. State inaccessible references and unresolved origin relationships explicitly. A case receives all-selected content verification only if every original selected citation is accessible and substantively matches the exact scope. This metric does not itself authenticate origins or establish population accuracy.

The offline `source-review/audit-integrity.py` checks exact ID/URL/excerpt-hash binding, rejects substitutions/duplicates/method mislabeling, and prevents missing/inaccessible/partial/error-page references from receiving all-selected credit. It consumes agent semantic decisions; it does not automate them. Its six synthetic tests passed. It makes no network requests.

## Review sequence

The pre-campaign method and offline checks were prepared before campaign output inspection. Final source review and the later selected-citation audit are recorded separately below.

## Final pre-campaign source review

No blocking source-policy or adapter defect found in the reviewed patch. The new category is restricted to the ordinary path with two qualifying families; registry solo authority applies only when an existing substantive category qualifies. Stronger risk paths exclude the new category. Old category probability sums remain unchanged. The selected-evidence question is now self-contained and allows supporting, refuting and qualification-bearing sources rather than depending on another question's verdict answer.

Independent `source-review/policy-probes.mts` passed 17 probes covering two-source success, one-source rejection, registry solo rejection, source confidence and scope failures, common-origin pair and retained low-quality transitive bridge, exact copying, shared publisher, health/safety/disputed/unknown/low-confidence risk, lexical hazard, both corroborating citations, conflicting direct sources and the unchanged joint threshold. Focused repository suites (`providers/jev/judgment.test.ts`, `policy/judgment.test.ts`, `policy/verdict.test.ts`) passed 122 tests across three files. These tests use synthetic explicit assessments; they do not establish that Jev will classify live passages correctly.

Reviewed source SHA-256:

- `services/api/src/providers/jev/judgment.ts`: `b730bf4a54778a0f64fbfc81b1baa19a2e391f9e096d8e317d6a5b10191bc7f3`
- `services/api/src/policy/assessment.ts`: `17231d46fc8fcb0df59e4ac844dedd8c278508bdc0a24f960d7b447ecf3b9487`
- `services/api/src/policy/sources.ts`: `84f7c4394f8887d147c3de35bc777a8cc768c3541959a860fac501b2e69605eb`

Residual limits: ordinary-family counting remains the existing open-world domain/publisher/copy/known-origin graph heuristic, not independently authenticated provenance. A pair whose origins are unknown can still count under that preexisting ordinary rule. New categorical wording may change model confidence or confuse a developed factual account with a bare echo; only the prospective campaign can measure these outcomes for its declared examples. A one-source developed reference still abstains, even if an agent separately knows the fact. Medical/safety/disputed or uncertain-stakes accounts still require the old stronger evidence path. These remaining restrictions are intentional task safeguards, not newly demonstrated defects.

At the pre-campaign review checkpoint, exact campaign output was still pending and no provider requests or public fetches had been made by this reviewer. The completed public inspection is recorded below.

## Completed first-run selected-citation audit

The immutable first-run report at `run/report.json` was inspected only after completion. Its source freeze is `d81de5984903f607d4e6b8342f1777b3dc105f893f27e2739c98308d86f57147`. Four facts received definitive outputs before the campaign stopped on the fifth case's predispatch request-size guard. The remaining facts and controls were not executed. This audit does not rerun or replace any case or citation.

All 15 originally selected citation occurrences (15 unique URLs) were attempted once. **14/15 have independently inspected substantive content covering the exact proposition; 3/4 completed cases have every selected reference verified.** On the original eight-fact prospective denominator, this is four correct definitive results and three all-selected-content-verified results; the interrupted campaign is not a complete success.

| Completed case | Exact outcome | Verified selected references |
|---|---|---|
| OR01 Hastings, 1066 | supported | 3/3: Wikipedia, English Heritage, Battlefields Trust |
| OR02 Magna Carta first issued in 1315 | contradicted by first issuance in 1215 | 3/3: Parliament, US National Archives, Commons Library |
| OR03 Titicaca on Peru/Bolivia border | supported | 5/5: two NASA Earth Observatory accounts, Wikipedia, INRENA's UNESCO-hosted submission, Britannica students |
| OR04 Vienna on Danube | supported | 3/4: Organization of World Heritage Cities, Wikipedia, Britannica kids; selected DOI inaccessible |

The selected Vienna DOI returned a resolver 302 and Springer 301, followed by a 303 proposing an identity-provider redirect. The predeclared two-redirect limit stopped there, before issuing the identity-provider request. Its empty response body contains no inspectable abstract. The DOI reference remains **unverified**; the other three accessible Vienna references do not replace it or give that case all-selected credit. Wikipedia Vienna's one mobile-to-desktop redirect was followed and recorded.

The Magna Carta pages explicitly distinguish first issue in1215 from later reissues and1297 statutory form, matching the first-issuance relation rather than merely finding an earlier date. The river and country-border statements are explicit in the inspected passages. The INRENA submission's UNESCO-hosted page expressly assigns responsibility to the State Party and disclaims UNESCO endorsement and legal-boundary opinion; this limitation is retained. Both NASA articles share a publisher family, as do the two Parliament pages. Distinct accessible publishers are not independently authenticated underlying origins. Full copy/dependency provenance remains a limit even though the exact descriptive content is present.

Actual public inspection resource use: **18 dispatched GETs** (15 initial URLs plus three followed redirects), **3,657,667 response body bytes**, zero retries, zero paid provider calls, no body truncation. Each initial URL had a maximum two redirects, 15-second socket timeout and 2,000,000-byte read cap. The unissued third DOI redirect is recorded as a proposed redirect, not counted as a dispatched request.

`citation-audit.json` binds each original selected ID, URL and excerpt hash to fetch time, final URL/redirects, HTTP/access outcome, body hash, decoded text hash, exact supporting page passage/hash and agent scope/substance/provenance assessment. Raw bodies and decoded text are retained under `source-review/`. Original provider highlights sometimes contain ellipsis-separated portions and the current Vienna page differs in surrounding wording; the audit verifies the core substantive relations and does not claim complete contiguous equality of every full provider excerpt. The offline audit integrity checker independently reproduced 15 selected/15 inspected/14 content-verified/3 fully verified cases. No inaccessible source was replaced.
