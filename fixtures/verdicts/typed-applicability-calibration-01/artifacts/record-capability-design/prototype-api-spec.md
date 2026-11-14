# Unwired record-capability prototype: module and API contract

Status: proposed engineering design outside the repository. No production module, registry entry, prompt, threshold, API contract or verdict is changed. This extends design-review.md after reviewing mechanism.md; it does not certify the new corpus or its labels. No candidate production implementation, first labels or provider outcomes were read.

## Intended effect and limits

The plan §9 permits a directly relevant primary/authoritative source for the particular fact, or two sufficiently independent relevant sources. The prototype can establish the former provenance capability for a bounded record relation. It cannot establish that a claim is true, make a passage substantive, supply an omitted condition, raise a probability or suppress credible contrary evidence. All existing substance, directness, exact-scope, stance, confidence, risk, citation and full-pool conflict/dependence gates remain independent requirements. Health/safety and disputed claims do not gain a new single-record route.

A usable receipt requires independently inspected identity and competence proofs, an exact canonical document/version and actual record contents. Official-looking hosts, document headings, URLs, model classifications and source-provided digests cannot create receipts. An institution's authority over its own record is bounded: an award register records an award, a normative instrument states its rule, and a statistical release reports its scoped estimate. None establishes merit, compliance, efficacy, an unrestricted population or a different event verb.

## Modules and trusted inputs

Keep all types and data server-only. Prototype modules live outside the repository until a separate integration decision:

- `types.ts`: strict schemas with unknown fields rejected; bounded strings, arrays and byte sizes.
- `manifest.ts`: load the installed immutable manifest, verify its digest and revocations, and index canonical document/version keys. No user/source-selected path or network loading.
- `snapshot.ts`: bounded local archive reader; verify canonical acquisition and deterministic extraction bytes against the installed manifest. Opaque artifact handles are created only here.
- `bind.ts`: exact retained-passage alignment and material-span containment, with original UTF-16 offsets checked against exact strings. No Unicode folding, ellipsis expansion, model rewriting or whitespace deletion.
- `applicability.ts`: compare a separately supplied claim frame with the receipt's permitted relation and material circumstances; return reasons without stance.
- `evaluate.ts`: pure orchestration, returning a capability token or an unavailable reason plus audit. It has no provider client and cannot issue a verdict.
- `shadow.ts`: run the prototype against frozen corpus inputs; produce contrast metrics. No production policy import is required.

The private artifact/token constructors are not exported. TypeScript branding alone is not a security boundary: every public module entry validates runtime inputs, and `evaluate` accepts trusted handles obtained from the local store rather than caller-authored `verified: true` objects. Local store paths are resolved from installed content addresses under one fixed root, with no symlink traversal or arbitrary filenames. Limit each installed receipt to a bounded number of units and reviewed bytes; the runtime visits at most the existing six evidence records.

```ts
// Sketch; runtime schemas enforce these shapes.
type Digest = string; // exactly 64 lowercase hex characters
interface RecordReceipt {
  id: Digest; schemaVersion: 1;
  issuerId: string; identityProofRefs: Digest[]; competenceProofRefs: Digest[];
  document: { canonicalURL: string; canonicalId: string; versionId: string };
  class: 'normative_text' | 'legal_instrument' | 'award_register' | 'reported_measure';
  relation: string; // installed finite vocabulary, never arbitrary regex or claim text
  scope: { subjectKind: string; jurisdiction?: string; population?: string;
           edition?: string; reportingPeriod?: string; conditions: string[] };
  proof: { rawBodySHA256: Digest; extractionSHA256: Digest; extractorVersion: string;
           acquiredAt: string; requestedURL: string; finalURL: string;
           redirects: string[]; httpStatus: 200; complete: true };
  unit: { extractionStart: number; extractionEnd: number; sha256: Digest;
          materialSpans: Array<{ role: string; start: number; end: number }> };
  temporal: { mode: 'immutable_version' | 'historical_release' | 'current_version';
              applicableFrom?: string; applicableUntil?: string;
              lastCurrentVersionCheck?: string; recheckAfter?: string };
  originFamily: string; derivedFrom: Digest[]; supersedes: Digest[];
  limitations: string[]; review: { method: string; inspectedAt: string; evidenceRefs: Digest[] };
}
interface ClaimFrame {
  exactText: string; exactTextSHA256: Digest;
  relation: string; referent: string; materialContext: Record<string, string>;
  timeMeaning: 'explicit_version' | 'explicit_historical' | 'current' | 'unresolved';
  // Asserted compared values remain claim data; receipts never store an expected answer.
  comparedValues: Array<{ role: string; exactText: string }>;
}
type Result =
  | { kind: 'capability'; token: RecordCapability; audit: Audit }
  | { kind: 'unavailable'; reason: string; audit: Audit };
function evaluate(input: {
  manifest: InstalledManifest; artifact: VerifiedSnapshot;
  evidence: { id: string; url: string; excerpt: string; retrievedAt: string };
  frame: ClaimFrame; now: string;
}): Result;
```

`RecordCapability` binds the manifest/receipt/artifact hashes, exact evidence ID/URL/excerpt hash, exact claim hash/frame hash, relation, document/version, origin lineage and original proof time. It expires with manifest revocation/freshness applicability. A token cannot be attached to another excerpt, revision, subject or claim. It contains neither a positive assessment nor a verdict. The downstream conceptual hook is `hasApplicableReviewedRecordCapability(evidence, exactClaim, auditContext)`; it can satisfy only the primary-record branch of source qualification. It is not wired in this prototype.

## Acquisition and exact passage binding

Use **dated reviewed snapshots** for the initial executable prototype. The trusted local snapshot reader verifies the exact canonical raw-body and extraction hashes recorded during original inspection, validates the record-unit offsets/hash, and preserves the original requested/final URL, redirects and access timestamp. These are historical acquisition proofs, not a new origin accessibility observation or cryptographic issuer signature. A byte-identical saved copy keeps the same lineage; it creates no independent corroborator.

The runtime Exa excerpt must be an exact contiguous substring of the audited unit and contain every material span necessary for the relation, in their original associations. The bound excerpt itself must carry the operative fields and qualifications; identity metadata or nearby archived text cannot rescue a title-only excerpt, a missing exception or a clipped table label. If multiple equal matches exist and their material roles differ, fail closed. The current evidence excerpt must satisfy the existing 2,000-character bound; an archived unit may be longer only if all required fields still fit inside that retained excerpt. Retain original text and offset conventions; calculate hashes over UTF-8 bytes, not codepoint counts.

A search highlight containing ellipses or normalized whitespace that does not exactly align is unavailable. The prototype does not silently expand it from the archive. A caller could use an already permitted contents attempt to acquire a better bounded passage, but capability code neither schedules the call nor changes acquisition ranking. It never treats a failed target body or index title as successful verification.

The existing Exa path allows at most three contents attempts within its existing ten-second retrieval deadline and retains bounded passages. It does **not** expose the complete canonical origin response needed for a newly verified full-page digest. Therefore an Exa-only result is not a fresh `VerifiedSnapshot`. No additional GET, unbounded crawler, fourth contents request or reset deadline is introduced. If future code supports a bounded trusted canonical reader, all bytes, attempts and time must consume those same existing allowances, and oversized/partial bodies cannot produce a fresh artifact. That adapter needs separate review; it is absent here.

This resolves the mechanism.md full-hash requirement without pretending Exa provides it: canonical hashes authenticate the explicitly dated saved artifact; exact retained-quote alignment binds present evidence to that artifact. It does not prove that a mutable page still has that version today. A live contents excerpt alone cannot authorize freshness or establish that no amendment exists.

## Relation applicability and temporal behavior

Receipt lookup is by installed canonical document/version identity, with an explicit reviewed alias/redirect list if needed; same-host pages and guessed mirrors are unavailable. All field associations and relation vocabulary are reviewed independently of stance. Signing, adoption, ratification, publication and entry into force are separate relations. Award year and publication year are different fields; an award entry without a complete ordinal record cannot establish “first.” Definition and compliance, reported estimate and exact population, and issuing an instrument and its effect remain different relations.

Applicability compares referent/relation/material circumstances, not whether an asserted measured value agrees. A wrong date offered as the value of the same event can remain applicable; a date identifying a different reporting period or edition cannot. The supplied claim frame makes those roles explicit. Unknown relation, implicit unresolved period, population, pressure, jurisdiction or edition returns unavailable. The record's statement and the claim remain available to ordinary stance assessment; the receipt does not decide their agreement.

The prototype runner accepts independently authored frozen claim frames. This makes binding logic executable without claiming raw-English routing is solved. Production cannot trust frames from a user, source or unsupported model assertion. A future generic frame adapter would need exact-claim binding, separate calibration on relation/temporal/qualifier counterexamples, and budgeted integration; no such adapter is approved by this document. Existing directness/scope judgments still apply even to a correctly framed claim.

Temporal rules fail closed:

| Claim/receipt situation | Capability result |
| --- | --- |
| Explicit historical release or immutable identified version, aligned contents and applicable time | Eligible for provenance capability; audit uses the original inspection time. |
| Current/latest/now claim with only an old snapshot | Unavailable, even if a title/version string still matches. |
| Current-version receipt with an independently verified current-version check, before reviewed recheck deadline | May be applicable only within the proved effective period and reviewed policy; no default freshness duration. |
| Missing/expired recheck policy, unknown amendment status, revoked receipt or contradictory version metadata | Unavailable; do not guess. |
| Known newer version and explicitly older historical claim | Keep the older receipt only for its identified historical scope; preserve lineage and qualifications. |
| Claim time unresolved where material | Unavailable; normal admission/clarification and policy behavior remain. |

Revocation is a trusted manifest fact, not a source instruction. Failure to prove capability returns the ordinary two-source route or abstention; it never proves falsehood. Existing acquisition/auth/transport/provider errors retain their operational semantics. Full raw evidence and conflict/dependence graphs remain intact; an unavailable capability cannot delete a contrary passage, bridge or known extraction failure.

## Frozen evaluation and promotion boundary

Before prototype execution, record one immutable manifest of the newly authored OPEN packet, neutral rubric, both independently dated label files and adjudication. No substitutions after output. Use every declared unit, preserve unknown/disputed labels in a separate boundary stratum, and group supported/refuted variants by underlying passage/record so correlated pairs are not counted as new independent records. Existing broad-development facts are excluded from this new capability corpus and never receive new factual-denominator credit.

Predeclare these contrasts, using the same retained text and assessment inputs: ordinary two-family qualification versus ordinary qualification plus the unwired receipt result. Report provenance eligibility separately from final verdict eligibility; do not invent verdicts if no model output is part of the study. Opposite compared values for one relation must receive identical capability results. Forged identifiers, altered bytes, title-only text, same-host unrelated pages, wrong versions/periods/populations, missing qualifications, unresolved origin and expired current proofs must not obtain capability. Mirrors must retain canonical lineage, and a synthetic credible-conflict witness must still veto the final definitive route even when a receipt binds.

Proposed engineering acceptance for the prototype: **zero false capabilities across all labeled hard negatives; all critical trust-boundary controls pass; at least 80% receipt applicability recall among independently labeled, fully accessible, exactly alignable positive units; and no decrease in full-pool conflict/dependence protection.** Report numerator/denominator for each class and failure type, with no dropping inaccessible or failed intended units from the declared total. The 80% is a proposed development bar, not a plan requirement or backend release result. Require zero disagreement between valid supported/refuted paired capability outcomes and zero altered-text/forged-proof successes. Small paired samples do not establish general precision or universal authority.

A successful prototype only supports a later integration proposal. It does not meet the separate useful-coverage backend release gate, replace independently verified citation audits, justify threshold changes or authorize promotion. If the bounded record proof or reliable claim-frame adapter cannot be built for a class, that class remains unavailable.
