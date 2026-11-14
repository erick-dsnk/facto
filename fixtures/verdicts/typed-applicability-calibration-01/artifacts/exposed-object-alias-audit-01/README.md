# Exposed-object mutation audit

**No additional semantic/token authority alias was found.** Eighteen adversarial offline tests and TypeScript pass. They mutate actual returned objects and nested arrays, not only clones. Adapter05's known mutable returned `assessmentContext` bug is preserved in the runtime review and is not reproduced or counted as a new finding here. Adapter06's additional metadata/origin/assessment paths reject mutation.

The one newly observed surface is a **trusted in-process native-signal monkeypatch**, with no stale authority bypass. Root explicitly classified this as a host-integrity assumption, not a blocker for the study or grounds for another adapter revision. There are no source edits, packet changes, network calls or project-provider calls. All fetches are injected local fixtures; their attempt counters are not live-provider execution evidence.

## Results by surface

| Returned/exposed surface | Actual mutation test | Result |
|---|---|---|
| Adapter05/06 `judgment`, nested source assessments, risk and origin tuples | Replace actual returned passage, label, probability, source confidence, risk and origin ID | Writable detached result data. Private sealed context/actual-ask state remains unchanged; existing tokens still refer to the original assessment. A writable result is not an execution receipt. |
| Dispatch body hash, question map, scope-dimension arrays | Replace actual hash/receipt ID; push a dimension | Frozen; mutation rejected. |
| Semantic/completed audits and opaque handles | Change authority flags, raw generation and token kind | Frozen; mutation rejected. |
| Result envelopes and constructor binding inputs | Replace audits, push a forged semantic envelope; mutate the actual original bindings array after factory creation | Envelopes are mutable data, but opaque private identities do not retarget. Original valid token remains bound; a caller-authored token rejects. Constructor inputs are detached. |
| Seam02 material, node/record metadata, raw arrays and owner binding | Change actual nested metadata, push a node, replace deadline/owner/consume callback | Frozen snapshot data; mutation rejected. No Session, RequestRecord or budget object is exposed in the snapshots. |
| Adapter06 returned context, origin state, graph flags and assessment answers/judgment | Change actual nested metadata, graph availability, answer choice, risk and input digest | Frozen; all mutations rejected. This extends the known fix's safe-path checks without rerunning the old passage-alias reproduction. |
| Prototype02 issuer receipt, record units, material spans, issuer proofs, redirects, frozen frame, snapshot and installed summary | Change actual returned fields and push nested arrays | Frozen; private manifest/receipt identity and token verification remain unchanged. |
| Prototype02 capability audit, origin-link state, alignment roles and redirects | Mutate actual audit nested state/arrays | Frozen. The original caller input remains detached; changing it and refreshing its input digest rejects the old capability. |
| Standalone `bindExcerpt` alignment | Mutate returned locator/roles | Mutable data only. It does not alias the issuer receipt or a later capability's frozen audit. |

`object-inventory.json` lists actual returned object paths and freeze status without traversing native implementation internals. `observations.json` records the mutation outcomes. Mutable envelopes, callable values and native operational objects must not be conflated with writable private verification state.

## Native signal probe and threat-model limit

`inspectDispatchOwner(...).context` is frozen, but its `signal` is a live native AbortSignal. A caller holding that exact returned signal can shadow its `addEventListener` method before starting an injected hung fetch. The normal control settles after `Session.cancel`. The monkeypatched case remains pending beyond the 30 ms observation interval and only rejects after the injected fetch is released or the inherited timeout wins. Its one mock attempt stays charged; private owner checks still prevent any late token, cache write or result.

This requires trusted JavaScript executing in the host process. Public source/provider data cannot perform this method mutation, and the trusted runtime already owns the original RequestRecord/controller. It is not a demonstrated remote exploit, semantic authorization bypass or source-trust failure. Root directed that this assumption be disclosed rather than block the study. If a future real plugin boundary exposes these objects to less-trusted code, privately captured/bound event listener methods may be narrow optional hardening.

**Do not blanket-freeze AbortSignal.** A separate fresh-object control shows that on Node 24.22.1, freezing it makes `AbortController.abort()` throw TypeError. The audit changes no signal implementation or adapter source.

## Reproduction and preservation

Run `node /workspace/task-evidence/exposed-object-alias-audit-01/check.mjs`. It checks frozen adapter05/06 and prototype02 manifests before and after 18 tests and TypeScript, and fails on source or packet drift. The fixture is extracted from adapter05's public offline helper, with selectable 05/06 imports and an explicitly injected fetch. No live key, project API or source acquisition is used.

The known 05 context-alias reproduction remains at `native-completion-runtime-review/context-alias-05.test.ts`. The 06 fix was separately approved by the runtime reviewer. This audit supplies independent coverage of other exposed surfaces and preserves the host-signal probe; it assigns no new factual label, applicability accuracy or release credit.
