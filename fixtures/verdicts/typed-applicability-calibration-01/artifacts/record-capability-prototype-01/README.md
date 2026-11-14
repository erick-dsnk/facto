# Unwired record-capability prototype 01

This standalone TypeScript prototype matched all 22 frozen applicability labels: 10 applicable and 12 unavailable. The eight ordinary positive requests reuse four source passages in opposed-value pairs; they are not eight independent record facts. Each pair received the same applicability result. The two additional applicable controls cover a retained synthetic conflict and local reuse of a previously inspected canonical body.

The prototype issues a bounded provenance capability, never a factual verdict. It has no production imports, provider client, network calls, new dependencies or production wiring. No source-quality model, final verdict policy or coverage benchmark runs here. Raw-English claim framing and current-version authentication remain unsolved integration requirements.

## Trusted installation and runtime boundary

`install.ts` verifies every file in the immutable source corpus manifest `61d06043365be55ad91b8f85e01d336b82c481d83585fdcba4906604471cda4e`. It converts four independently reviewed receipts, thirteen successful public acquisition proofs and twenty-two frozen structured claim frames. It does not parse expected labels. The installed manifest digest is `7ba7660e882afd1d5cea4ba37784567cde6ba53dc7633eaa065632f79434fcd4`.

The admin-only bootstrap supplies the installation directory and expected digest. Neither can come from a source, request or model. SHA-256 protects the integrity of this reviewed installation; it does not itself establish issuer identity. Identity and competence are inherited from the dated independent review of the referenced public proofs. In particular, the Pulitzer proof retains its documented same-publisher identity limitation and receives no independence credit.

The runtime verifies content-addressed local bytes, strict schemas, bounded sizes, receipt-to-proof bindings, exact record-unit hashes and exact claim text. Manifest, snapshot, frame and capability objects use private runtime identity, not a serializable `verified` field or TypeScript branding alone. A source cannot introduce an issuer, receipt, frame or arbitrary proof path. Same-host pages, copied headings and untrusted mirrors receive no capability from their appearance.

Installation files and bootstrap code must remain administratively controlled. This is not a sandbox against a process able to replace trusted code or mutate its filesystem concurrently. Paths reject symlinks, traversal and non-content-addressed descendants; reads use `O_NOFOLLOW` and bounded file descriptors. Explicitly retire an old installation before replacing it with a new revocation manifest. `retireInstalledManifest` immediately invalidates that instance's handles and tokens. There is no network revocation discovery.

## Exact text, scope and time

The corpus specifies audited record units but does not independently label smaller required field spans. The compiler therefore conservatively requires the entire audited unit in the retained excerpt. It does not infer a shorter acceptable span from desired outputs. Original codepoint offsets are converted to UTF-16 only after checking the exact text and UTF-8 digest. No Unicode, whitespace or ellipsis normalization is performed. Clipped exceptions, title-only excerpts and a quoted obsolete definition fail alignment.

Only independently frozen frames can express relation, document/version and material scope. A different asserted value of the same relation stays eligible; a different population, reporting period or event relation does not. The receipt stores no expected verdict or claim-matching regular expression. Raw-English text is only checked against the frame's exact text and digest; it is not interpreted.

Every proof is a dated local snapshot. The audit retains original acquisition time, requested/final URL, redirects, raw-body and extraction digests. Loading a saved artifact is not a fresh source request. Current/latest and unresolved temporal frames fail closed. No `lastCurrentVersionCheck` timestamp or matching mutable URL can create a current-version capability; that future route would require a separately reviewed proof artifact and temporal policy.

## Full-policy limitation

Ordinary risk is required. Health/safety, disputed and unknown risk do not gain this route. A capability cannot resolve a credible conflict, add independent corroboration, raise a probability or substitute for substantive contents, relevance, scope, stance and citation checks. Every capability says those gates and the conflict veto remain required.

The context binding currently covers the target excerpt plus caller-provided retained evidence IDs, risk/conflict state and origin links. It does not inspect or bind the bodies of other sources and does not independently establish that the supplied conflict state is complete. The synthetic conflict control verifies preservation of that supplied context and mandatory-veto flag; it is not a test of production conflict detection or a final verdict veto. Any future integration must bind the complete existing judgment state and enforce all gates without dropping contrary evidence or origin bridges.

## Validation and reproducibility

`results/shadow-report.json` contains every case, unavailable reason or capability audit, expected applicability, paired passage groups and proof limitations. Expected labels are loaded only after all 22 applicability decisions. Source originals and labels were not changed.

The trust-boundary suite covers forged/serialized handles, hostile fields and accessors, path traversal, symlinks, individual/aggregate byte caps, altered raw/extraction/receipt/manifest bytes, wrong versions and relations, clipped material, exact Unicode alignment, temporal failures, token reuse, changed context, risk controls, revocation and explicit installation retirement. TypeScript checks pass. Detailed TAP output is in `results/tests.tap`.

Commands use tooling already installed in the shared repository, not production modules or new packages:

```sh
/workspace/junction-2026/node_modules/.bin/tsc -p /workspace/task-evidence/record-capability-prototype-01/tsconfig.json
/workspace/junction-2026/node_modules/.bin/tsx --test --test-reporter=tap /workspace/task-evidence/record-capability-prototype-01/tests/trust-boundary.test.ts
/workspace/junction-2026/node_modules/.bin/tsx /workspace/task-evidence/record-capability-prototype-01/src/shadow.ts
```

The installer is deliberately one-shot and fails if the destination exists. `installCorpus(newAbsoluteDestination)` can create a separately pinned installation for testing. Do not overwrite the reviewed original corpus or silently replace an installed manifest after loading it.

During test development, two initial test assertions were corrected: the legal excerpt contained no newline to replace, and the wrong publication-date frame already failed at unresolved time before relation comparison. The mechanism and frozen labels were not loosened. A separate relation-substitution assertion was retained. The initial 29/31 run was followed by a passing suite with explicit retirement coverage.

Independent design sources remain in `../record-capability-design/design-review.md` and `prototype-api-spec.md`; retrieval feasibility is documented in `../record-capability-retrieval-review/feasibility.md`. Successful offline applicability checks support further review only. They establish no live coverage gain, release readiness or production authorization.
