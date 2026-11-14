# Native material seam02 — unwired

Seam02 consumes the actual internal `selectAlternateEvidenceWithContext` output added in commit `192b8f7`. It replaces seam01's graph reconstruction with native input-version keys, dependency witnesses and family mapping. There are no production edits, provider/model calls, capability activation, new source trust, prompt/threshold changes or source-selection changes. Seam01 and earlier evidence remain immutable.

`node /workspace/task-evidence/capability-selection-seam-02/check.mjs` passes TypeScript, **31 offline tests**, and **151 pre-edit selector-oracle pools**. Source and input bytes are pinned/rechecked; the native selector source matches commit 192b8f7. The 151 pools comprise 11 saved public09 alternate pools and 140 synthetic/permutation pools; all retained records, actual version bindings and native graph projections match. No old factual answer is reused on new material.

## Native snapshot

The compatible opaque API remains `captureSelectionMaterial`, `inspectMaterial`, `assertPrototypeCompatible`, `captureRuntimeOwner`, `assertCurrentOwner`, `inspectOwnerBinding` and `awaitCurrentMaterial`. New exports are `assertCompleteNativeGraph` and the **pure, untrusted** `deriveInitialGraph` helper.

For a real prior scheduling judgment, capture calls the native selector once and consumes its output directly. It never runs a second copy detector or reconstructs families from selected records. Every normalized original/incoming occurrence survives, including omitted bridges, old/current same-ID versions and unused earlier same-pass duplicates. Actual native retained keys resolve the prior seam's identical-version phase ambiguity; last-per-pass duplicate behavior remains explicit.

Each node keeps the native canonical input material digest/metadata, supplied URL/sourceGroup/echoGroup, phase/ordinal, `usedForDependence` and `dependenceEchoGroup`. The node record used for a retained projection includes the exact final retained echo metadata. Raw/canonical input echo, full-graph dependence echo and final retained echo remain separately inspectable. At most 12 raw occurrences become at most 66 pair rows; excess inventory fails without truncation.

Native positive edges map directly to `common_origin` with their native reasons. All other pairs are `unclear`; absent edges confer no independence. Native family mapping and all prior-origin scheduling inputs are bound in graph state. These are conservative selection facts, not authenticated origins or positive semantic assessments.

Completeness is explicitly limited to **normalized selector inputs**, not complete provider responses, original source bodies, all earlier enrichment versions or uncached origin access. The snapshot is deeply frozen and detached. A serialized or foreign handle cannot recover private state. Empty/overlong valid production titles remain exact; prototype02's narrower nonempty/1000-character title rule makes those projections unavailable, rather than dropping a node or altering a title. Saved09 supplies both incompatibility controls.

## Two-phase initial path

An initial pre-ask snapshot has no prior judgment. It preserves exact already-normalized records, supplied group/echo static links and every occurrence, but marks `mode:initial_pending_judgment`, `nativeContextAvailable:false` and `completeAtSelectorInputBoundary:false`. It supplies no fabricated assessment, risk or conflict result. Both `assertCompleteNativeGraph` and `assertPrototypeCompatible` reject it for receipt/capability use.

Raw material and derived graph identity are separate:

- `rawGeneration` binds exact public claim, every original/incoming material record, phase/ordinal and supplied metadata. It is unchanged by a valid initial graph completion.
- `graphGeneration` binds local retained projection, nodes, links, native graph state and actual origin scheduling outputs.
- `materialGeneration` binds both. The pending handle and its pre-ask generation never mutate after a response.

`deriveInitialGraph(pendingMaterial, judgment)` is **a pure data helper**. It requires the pending initial path, exact checked text, unchanged judged record identity/material/order, native selection of originals plus empty incoming, stable raw generation and exact retained material/order parity. A native deduplication that would lose an initial occurrence fails explicitly. Changed claim, title, metadata, record/version/order or missing bridge cannot silently complete the old material.

Its frozen `UntrustedInitialGraphDerivation` contains the completed native snapshot, stable raw generation, pre-ask material generation, derived graph generation and supplied-judgment digest. It explicitly sets `authorityGranted:false` and `actualDispatchBinding:false`. It returns no new MaterialHandle, RuntimeOwnerHandle, completed-assessment execution handle or capability. A caller can supply a synthetic Judgment and obtain untrusted derived data; that does not prove a model ran or authorize a result. The helper must not be mistaken for a public `mint(Judgment, callerHashes)` API.

The separate assessment adapter owns actual completion. Its private actual-ask closure must seal the final serialized request and question mapping, await and validate the actual same-request full response, retain its actual Judgment/answers/hashes and charged attempt, then call this helper while checking original owner/resources before and after synchronous derivation. Only that private WeakMap may associate completed graph data with an execution receipt. The original pending material/owner, raw generation, pre-ask generation and completed graph generation stay distinct in that binding. The graph is derived from response outputs; it was not present in the original prompt, and refreshing an input hash is not a rerun.

The assessment author's separate adapter05 implements that private boundary and its own tests. It is not embedded or minted here. Adapter03, source manifests, prototype02 and all predecessor seams remain unchanged. Independent runtime review approved seam02's pure material/graph boundary. The separate adapter's actual-dispatch and final-issuance review remains its own responsibility; no joint activation approval or live applicability evidence is implied by injected fetch tests.

## Runtime ownership

The preserved owner closure binds actual Session/RequestRecord identity, request/revision/epoch, exact admitted claim/slot/Unicode scalar span, inherited `acceptedAt+10000` deadline, material generation and installation generation. It checks running state, cancellation, session expiry, actual ownership and both generations before/after asynchronous work and at use. Source metadata cannot create those private handles. Shared attempt budget/reservation and local transport ownership stay with the separately reviewed dispatch-owner adapter; this package does not fork or replace that factory.

For initial completion, the pending owner's pre-ask binding remains fixed. A changed raw generation invalidates its dispatch. The separately private actual-response product binds a derived graph generation without pretending it is a new pre-ask input. No cache, result, notification or receipt is committed by this module. Existing quality, scope, stance, credible conflict, source-family, verdict and presentation gates still apply.

Local snapshots have a 256 KiB memory bound; that is not an outbound request allowance. Actual request bytes/tokens, one charged experimental ask, inherited reservations, original deadline and body/reader cleanup belong to the adapter's real dispatch path. Local metadata need not all appear in the provider projection; raw-material hash and actual serialized-request hash are deliberately different.

## Validation scope

The 31 tests cover native graph/version fidelity, same-ID fallback and correction, actual original phase/last duplicate keys, omitted copy/origin bridges, frozen-generation behavior, source metadata/Unicode/title incompatibilities, initial pending unavailability, pure completion parity and record-loss rejection, changed origin-output graph identity, exact prior/admitted claim/span binding, and cancel/epoch/revision/session/deadline/material/install/completed-owner gates. The 151-pool oracle check verifies material/graph projection without factual judgment simulation.

The runtime's separate 12-case phase-transition design is preserved at `two-phase-native-context-runtime-design/design.md`. Those actual-dispatch, forged/foreign/replay, charged-attempt and late-response cases are jointly exercised by the assessment adapter; pure helper tests alone do not establish them. Review pointers and predecessor hash checks are recorded separately.
