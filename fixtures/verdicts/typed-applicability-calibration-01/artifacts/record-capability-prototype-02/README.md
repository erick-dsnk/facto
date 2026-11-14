# Unwired record-capability prototype 02

Version 2 fixes the reviewed v1 token-binding gap. A token now binds the complete supplied retained-source material, raw origin/dependence graph with versioned records and bridges, exact claim revision, and assessment identity and actual state. Changing a companion source while keeping its stable ID no longer preserves an old token.

The reviewed v1 code, tests, results and review remain unchanged in `../record-capability-prototype-01`, pinned by manifest SHA-256 `4366f1fb62a4eee5180a6a719c817a4a819364d8fa72fba9efbf50db48b2e574`. V2 has separate code and result files. The original 22-case corpus, independent labels, four reviewed receipts and installed manifest are unchanged.

## State binding

The strict context schema requires:

- Exact claim text and an explicit claim revision.
- Up to six retained records, including exact ID, URL, excerpt, title, publisher, publication/retrieval dates, text basis and additional acquisition/provenance metadata. Missing values are explicit `null`; unknown fields cannot silently disappear.
- Up to twelve raw graph nodes with distinct version keys, revisions, complete record material and node state. These include prior versions, incoming records and origin bridges outside the final retained selection. Selected node mappings must agree with the exact retained records. The parser rejects excess nodes rather than dropping them.
- Every supplied directed origin/dependence link, relationship, link state and additional graph state. References must resolve to actual versioned nodes; duplicate keys, dangling links and inconsistent retained mappings fail closed.
- Assessment ID, revision, full bounded assessment state and an input hash bound to the exact claim/revision, material, graph, risk and conflict state. The hash is recomputed over actual validated contents. A caller-provided digest cannot replace those contents.

The capability audit includes separate hashes for retained material, the raw graph and assessment state as well as the combined context. Reusing a token requires all bindings to match. Updating an input hash after a material change still cannot make an old token validate, because the actual contents and assessment state are bound too. The target evidence must exactly match its record in the full snapshot.

Bounded JSON validation rejects accessors, unusual prototypes, cyclic structures, sparse arrays, unsupported values, nonfinite numbers and excessive nesting, keys, strings or serialized bytes before canonical hashing. Each additional JSON object is capped at 64 KiB and the complete context at 256 KiB. This is an offline memory bound, not a provider request allowance.

Completeness remains a trusted-runtime responsibility. This prototype validates and binds the full supplied snapshot; it cannot discover records withheld by a caller or prove that an assessment was actually produced by a model. A future runtime adapter must supply every relevant acquisition and policy field, preserve the raw graph, and rerun ordinary checks when their inputs change. This module does not interpret assessment results, solve conflicts or issue a verdict.

## Preserved authority boundary

The existing admin-pinned manifest, content-addressed canonical proof files, private runtime handles, exact full-record-unit alignment, frozen structured claim frames, ordinary-risk restriction, receipt revocation and installation retirement remain in force. The expected installation hash and path cannot come from a source or model. SHA-256 verifies the integrity of independently reviewed proof bytes; it is not an issuer signature.

The source manifest remains `61d06043365be55ad91b8f85e01d336b82c481d83585fdcba4906604471cda4e` and the installed manifest remains `7ba7660e882afd1d5cea4ba37784567cde6ba53dc7633eaa065632f79434fcd4`. Original acquisition times and origin lineage are preserved. Current/latest and unresolved temporal frames remain unavailable. No fresh origin reader, current-version proof route or raw-English claim-frame adapter was added.

A capability still establishes only bounded record provenance. It grants no independent corroboration, factual stance, confidence change or conflict resolution. Every result preserves the requirement to apply the existing substance, scope, relevance, stance, risk, citation and full-pool conflict gates. All tokens from a retired installation are invalid.

## Separate v2 evaluation

All 22 unchanged frozen cases matched their applicability labels: 10 applicable and 12 unavailable. All four opposed-value pairs retained equal applicability. Eight positive requests reuse four passages; the additional positive controls cover a supplied conflict flag and saved canonical bytes. These counts are correlated applicability checks, not factual coverage measurements.

The corpus did not supply real model assessment output or a full contrary passage for its synthetic conflict control. `fixture-context.ts` therefore builds explicitly marked synthetic assessment-binding fixtures, includes the unchanged original source observation metadata, and labels the synthetic conflict marker as such. No model output or factual contrary passage is fabricated as source evidence. The full context snapshots are saved per case in `results/shadow-report.json`.

The 57 passing tests include the original trust-boundary controls plus replacements of same-ID companion text, URL, title, publisher, dates, basis and nested provenance; same-ID prior-version changes; raw bridge removal; edge direction/relation/state changes; assessment-only changes; claim revision changes; stale assessment input; material-digest-only spoofing; and structural/byte limits. The replacement tests use valid complete snapshots and recomputed input hashes, so they establish invalidation beyond malformed-input rejection. Tests also confirm that re-evaluating provenance never assigns a verdict or resolves the supplied conflict.

TypeScript checks pass. The source corpus and v1 snapshot are rechecked against their frozen manifests. Detailed results and independent review are included alongside the new manifest.

```sh
/workspace/junction-2026/node_modules/.bin/tsc -p /workspace/task-evidence/record-capability-prototype-02/tsconfig.json
/workspace/junction-2026/node_modules/.bin/tsx --test --test-reporter=tap /workspace/task-evidence/record-capability-prototype-02/tests/*.test.ts
```

No production module, dependency, prompt, threshold or runtime hook changed. There were zero network or project-provider calls. This work does not establish live coverage, raw-English applicability accuracy, current-version authenticity or release readiness.
