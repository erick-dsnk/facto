# Reviewed record capabilities: independent design review

This is a proposal for evaluation, not production authorization. A generic single-source path is defensible only when trusted provenance establishes why a particular record can evidence a particular relation. Substantive-looking text, an official domain, a model's source-role answer and an independently verified keeper capability are different things. The current passage classifier does not supply that trusted chain.

## Proposed attestation

Keep attestations server-side and separate from the frozen app/API contracts. An attestation is an immutable reviewed data object, never a stored verdict, known-case exception or endorsement of an entire host. Suggested fields:

| Field | Required meaning |
| --- | --- |
| `attestationId`, `schemaVersion`, `manifestHash` | Stable identity and integrity of the reviewed object. |
| `issuerId`, `issuerName` | The authenticated issuing institution or keeper, not a string asserted by retrieved text. |
| `issuerIdentityProofs` | Inspected public evidence connecting the canonical source to that issuer; requested/final URL, access time, body hash and relevant retained proof. TLS proves control of a host, not general competence or document authenticity. |
| `competenceClass`, `competenceScope`, `competenceProofs` | The independently established role and limits of the issuer, including jurisdiction, population or field. A ministry, museum or company is not competent for every proposition it publishes. |
| `canonicalDocumentId`, `canonicalURL`, `documentClass`, `version`, `issuedAt`, `effectivePeriod` | The exact instrument, register or dataset and its temporal identity. Unknown values remain unknown and cannot satisfy a required check. |
| `recordLocator` | The section, row, award edition, register entry or observation-series identifier. |
| `relationClass`, `permittedFieldRoles` | Bounded relations this record can establish; the values themselves remain record data, not expected verdicts. |
| `retrievalProof` | Exact requested/final URLs, redirects, HTTP outcome, original access time, truncation status, raw body SHA256 and extraction SHA256. |
| `recordContentSHA256`, `extractionMethod`, `excerptAlignment` | A reproducible association between actual record contents and a retained passage. Document identity or a heading cannot replace missing contents. |
| `originFamily`, `derivedFrom`, `supersedes`, `supersededBy` | Copy/translation/mirror lineage and version relations. Mirrors do not confer new authority or independent observations. |
| `reviewMethod`, `reviewerRole`, `reviewedAt`, `reviewEvidence` | Honest attribution, including independent-agent review when applicable; no invented human approval gate. |
| `validForClaimsAsOf`, `recheckPolicy`, `revocationState`, `limitations` | Explicit freshness, use and withdrawal limits. Original inspection times are never relabeled as fresh. |

Candidate relation classes should initially be narrow: a normative definition's stated terms; an operative legal instrument's rule within its jurisdiction and effective period; an awarding body's recorded award outcome; or a maintained administrative dataset's explicitly reported measure under its stated methodology. These classes need independent validation before adoption. An empirical health, safety or disputed generalization is outside this proposed ordinary-claim shortcut.

## Binding and decision requirements

1. Establish issuer identity and bounded competence independently of the passage being judged. Local trusted configuration may identify a canonical source, but a hostname alone never authorizes a verdict. Public uploads, commentary, press opinion and advertisements on that host have no inherited capability.
2. Bind an attestation to the canonical document, version and actual record contents. Preserve both raw transport hashes and extracted content hashes. If a proposed normalization removes layout, it must preserve field association, numbers, units, dates, negation and qualifications; an unreviewed model rewrite is not a canonical record. Prefer explicit stable record formats over guessing which changing HTML regions are irrelevant.
3. Require the retained passage to contain the actual relevant field or operative clause and align to the attested record. A matching title or document number is insufficient. If new material differs from the attested content or cannot be aligned, no capability is applied until revalidated.
4. Match the original admitted proposition to the permitted relation, referent and material circumstances. Do not silently change “X happened” into “the website says X.” Signing, adoption, ratification, entry into force, publication and implementation are distinct events. A stated award year does not supply a missing “first” ordinal.
5. Preserve every existing conflict, directness, scope, probability, citation, malformed-provider, budget and risk gate. Capability can satisfy a source-qualification route; it cannot manufacture model confidence or bypass a credible contrary passage. The complete retained dependence/conflict graph remains available even when a source cannot qualify as a definitive citation.
6. If verification cannot finish inside the existing bounded acquisition budget, abstain or emit the appropriate operational failure. Do not add an unrestricted crawler, silently raise caps or treat inaccessible content as verified. Reusing an earlier exact proof is explicitly dated and is not a new accessibility observation.

## Threat model and required development contrasts

- **Forged headings and identifiers:** pair a valid canonical record with a fabricated header, altered body value and a title-only fragment. Identity strings and prestige cannot rescue missing or changed contents.
- **Same-host authority laundering:** pair an actual instrument with a user page, institutional blog, advertisement and press release hosted by the same issuer. An announcement can establish that announcement, not its advertised efficacy or every asserted underlying fact.
- **Stale or wrong versions:** include repealed rules, amended standards, old award editions, earlier reporting periods and explicitly historical claims. A newer document does not automatically invalidate a correctly scoped historical fact; a historical record does not establish a current rule.
- **Mirrors and derivative records:** include exact mirrors, translations, republications and summaries. They retain lineage and never create independent corroboration. A mirror requires its own authenticity binding to the canonical record, not merely a matching title.
- **Relation substitution:** contrast issuer/record identity with claimed real-world effects, award receipt with merit or health, a rule with measured compliance, and a statistic as reported with an unrestricted population claim.
- **Partial or contradictory content:** test clipped exceptions, table labels separated from values, pressure/population changes, conflicting current records, known extraction failures, and corrupted or truncated bodies. Failure must preserve uncertainty rather than make the positive route easier.
- **Prompt or metadata injection:** source text cannot create attestations, choose trusted IDs, alter scope, suppress a conflicting source or turn untrusted URLs into verified origin evidence.

Evaluate on a newly authored open capability corpus with frozen independent labels before provider outputs. Separate authenticity, issuer competence, relation entailment, scope, copy origin and final policy outcomes in reporting. Do not add rules solely for previously failing development propositions. A safe generic path may be infeasible for a given source class under the present bounds; abstention remains the result in that case. This design does not establish backend readiness or justify promoting a source-quality candidate that showed no independent gain.
