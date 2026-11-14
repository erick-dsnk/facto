# Unwired selector material and lifecycle seam

This outside-Git adapter captures **material identity and conservative dependence context**. It grants no provenance capability, source trust, assessment freshness or factual verdict. No production, prototype02, source-selection rule, provider DTO, prompt, threshold, budget or frozen evidence package changes.

`material.ts` calls the actual current `retainAlternateEvidence` and imports the actual `Session`, `abortable` and `assertWithinDeadline` primitives. It accepts the already available normalized original/incoming pools and optional prior scheduling judgment. An alternate pool requires a prior judgment with exactly matching checkedText and original material. Initial-only material capture needs no prior or fake assessment. Tests use synthetic pools and all 11 saved candidate09 facts with alternate pools; BD10 had no alternate. Saved09 is merely a public material fixture: the adapter invokes the current selector, including the later fallback, without claiming its output was the frozen09 live selection or carrying any factual answer forward.

## Minimal eventual #20 integration

No production API change was needed to test the seam: `pipeline.ts` already holds `evidence`, `additional` and the prior judgment at the selector call. **Selected `Evidence[]` alone is insufficient** to capture the omitted versions/bridges.

The smallest maintainable internal change, if separately authorized, would be a sibling `selectAlternateEvidenceWithContext` in `alternate-evidence.ts` returning `{ retained, inputVersions, dependenceLinks, familyById }` from the existing single selection computation. Preserve the current `retainAlternateEvidence(...): Evidence[]` wrapper and all current output, caps, conflict witnesses and family guards. Capture actual raw version identities and graph inputs before candidate/version replacement. This avoids duplicating the selector's private copy/family logic in a production adapter. It requires no app/contract change or wire metadata. An initial-only snapshot would use the same internal shape without an incoming pool.

Only a later explicit integration would insert a material handle in the trusted claim-local runtime state before judgment and carry its generation through response validation. The current outside-Git wrapper recomputes conservative graph context for feasibility and parity tests; it is not proposed as a second production selection implementation.

## Material interface

```ts
captureSelectionMaterial({ existing, incoming, checkedText, priorJudgment }): MaterialHandle
inspectMaterial(handle): Readonly<MaterialSnapshot>
assertPrototypeCompatible(handle): void
```

The opaque handle is a private WeakMap key. Cloned, serialized or caller-invented lookalikes fail. The snapshot is recursively frozen and copied from bounded primitive fields; it includes:

- Exact checked public text and the selector's exact retained `Evidence[]` for parity. Those semantic fields confer no positive trust; capability material uses the separate material-only record projection.
- Retained records, retained-node keys, every original and incoming version occurrence (at most 6+6), and all undirected pair links (at most 66). Excess inventory fails, rather than dropping a node to fit.
- Raw node state with supplied URL/sourceGroup/echoGroup plus phase/ordinal. Canonical URL/domain and selector-projected echo metadata stay explicit in the material record; supplied raw metadata is preserved separately. Same-ID old/current versions and nonretained bridges remain in the graph.
- Conservative raw copy/family links and prior common-origin scheduling links. Prior distinct-origin/unclear answers are disclosed in link state but confer no current positive independence. No first-pass stance/substance assessment is installed as material authority.
- A generation digest covering exact retained material, all raw versions/state and links. Order changes are deliberately new generations; a caller cannot keep question IDs while silently permuting record mappings.

When original and incoming records are materially indistinguishable after canonical projection, the return-only selector does not reveal their phase. The snapshot lists equivalent raw occurrence ordinals and explicitly marks `selectedPhaseIsNotInferred`; it does not invent a fresh fetch. Both versions remain. A future internal selector API could return the actual chosen input-version key directly.

Completeness is **only at the normalized selector-input boundary**. It does not prove complete raw Exa responses, all earlier highlight/page acquisition variants, an uncached origin access, or all historical revisions. `upstreamProviderBodiesComplete:false` is bound into the graph state. If future capability logic needs earlier acquisition versions, those must be captured upstream; an inventory exceeding 12 must become unavailable or require a separately reviewed bound, never silent truncation.

### Actual projection compatibility limitation

Production titles allow 4000 characters. Prototype02 requires nonempty titles up to 1000. Saved09 includes an empty title in BD08's alternate pool and a 2547-character title in BD12's alternate pool. This adapter preserves exact strings and every node. `assertPrototypeCompatible` separately returns unavailable for these snapshots; it never truncates a title, converts empty strings to null, or omits a bridge to satisfy the prototype. No fake completed `Context.assessment` is manufactured to make a material-only snapshot parse as a completed assessment context.

## Trusted runtime-owner interface

```ts
captureRuntimeOwner(material, {
  session, record, claimSlot, admittedClaim, readMaterialGeneration, readInstallGeneration
}): RuntimeOwnerHandle
assertCurrentOwner(owner): void
inspectOwnerBinding(owner): Readonly<OwnerBinding>
awaitCurrentMaterial(owner, work): Promise<T>
```

The owner closure captures the actual server-owned session and request-record objects, the trusted admitted claim for its slot, session ID/epoch, request ID/revision, claim slot/ID, an opaque owner identity, material generation and installation generation. It verifies the admitted claim ID, original input text, exact material claim, asserted/check admission and Unicode scalar source span, then rechecks that identity at every guard. This is a trusted runtime factory: only the real post-admission claim may be passed; a source-provided lookalike is not admission authorization. Its absolute deadline is inherited from `record.acceptedAt+10000`; it is never restarted after retrieval, correction or an artifact read. Source metadata cannot provide these handles or callbacks. `Session.current`, running state, abort signal, the inherited deadline and both live generations are checked before/after an await. `abortable` rejects cancellation even if injected work ignores its signal. No new provider attempt is consumed or allowance minted.

This guard must also run synchronously **immediately before** cache insertion, result delivery or notification. A successful awaited read is not permission to write later after installation retirement; a dedicated test covers that gap. The adapter's owner handle is claim-slot specific. Pending work from a canceled request, paused epoch, expired session, replacement revision, completed record, expired request, changed material or retired installation cannot commit through the demonstrated gate.

## Assessment and cache handoff

The assessment worker owns the separate typed dispatch adapter. Material capture supplies no pending risk/conflict answer and no completed assessment. Its next seal must bind the **actual final serialized request**, prompt/model/policy versions, question-ID→retained node/version/receipt mapping, owner identity and material/install generations. Only the actual validated post-response answers for that dispatch may produce assessment state. Rehashing an old answer on new graph/material does not establish a rerun.

The existing factual cache key normalizes claim text and includes context/language/mode/policy/model, but has no receipt/installation/assessment generation. If a future factual result depends on a capability, that derived cache must invalidate or revalidate on retirement/revocation and policy/version changes; 60-second TTL is insufficient. Serving a cached result also needs a new current runtime owner and current presentation checks. Neither public wire audit JSON nor a cached opaque-handle serialization can resurrect trust. No factual/capability cache is implemented by this adapter.

The graph snapshot is local. Its 256 KiB local memory limit is **not** a provider request allowance; the actual serialized provider request must remain under existing bytes/tokens/attempt/deadline caps. Only admitted public text, retained passages and narrowly selected trusted receipt fields belong in outbound typed questions. Raw graph state, arbitrary record metadata and lifecycle IDs must not be copied wholesale into a model request.

## Executable validation

Run `node /workspace/task-evidence/capability-selection-seam-01/check.mjs`. It records source/input hashes before and after checking and fails on drift. It runs TypeScript with the production project's strict-mode baseline and 23 tests. Earlier development checks caught the real title-width incompatibility; the final tests preserve the complete snapshots and explicitly reject incompatible prototype projection.

The tests cover actual selector parity on 11 public saved pools, all raw versions/bridges, exact Unicode/whitespace/metadata/timestamp changes, ambiguous identical variants, reordered mappings, 12-node/66-link bounds, no title truncation, stale prior material, opaque handles, mutation isolation, exact prior/admitted-claim/span identity, and cancellation/epoch/revision/session/deadline/material/install/completed-owner gates. No network/key/model/provider execution or backend-wide gate is performed. This is integration feasibility, not live applicability accuracy, factual coverage or release readiness.

Independent runtime review found that the initial seam checked prior evidence and owner slots without checking exact prior/admitted claim identity. That gap was corrected before final packaging, with three added regression tests; it was not a production change. The earlier prototype-width discovery remains preserved as an explicit unavailable compatibility case.
