# Continue in a new cloud environment

The previous cloud filesystem is not persistent. The portable continuation is committed in [`fixtures/continuation/fresh-cloud-continuation-01`](../fixtures/continuation/fresh-cloud-continuation-01/README.md). Obtain it from the exact published Git commit supplied with the handoff, not from a local path in the old chat.

The bundle manifest SHA-256 is `a065c49bcd6a07328685c41daf4c1514de227274b8f26a49051e2e4a80daf157`. It preserves 1,120 original OPEN evidence/source files in 927 deduplicated gzip blobs. It includes the unpublished prototypes, exact installed records, completed NEW24 requests/results, its post-run analysis and accounting audit, and the completed canonical-target probe. Archived code is inert data until explicitly restored. No credentials, vendor trees or sealed/private evaluation bodies are included.

## Start from a fresh clone

Use `/workspace/junction-2026-current` for active development. Read the repository `AGENTS.md`, this document, and the bundle's `CURRENT-STATE.md` and `README.md`. Verify the manifest hash and run the bundle's standalone `restore.py` in verification mode first. For example, from the package directory:

```sh
cd /workspace/junction-2026-current/fixtures/continuation/fresh-cloud-continuation-01
sha256sum BUNDLE-MANIFEST.json
python3 restore.py
python3 restore.py --target-root / --extract
python3 restore.py --target-root / --verify-restored
```

Extraction restores only the allowlisted `/workspace/task-evidence/...` files, accepts identical existing files and refuses conflicting files or symlinks. It does not run archived experiments, access the network, install packages, read secrets or revive any provider authorization. Use an empty temporary target root first if desired; that verifies data portability, not executability of absolute imports.

Some frozen offline modules depend on two historical Git checkouts. Create these **only when needed**, at absent destinations, using the exact commits in `git-checkout-map.json`:

```sh
git -C /workspace/junction-2026-current worktree add --detach /workspace/junction-2026 04ac297523291b1aa289761d5ba3bed98610536f
git -C /workspace/junction-2026-current worktree add --detach /workspace/stack-20 9f4090d609eac0101f4fb1bdcef0908be2cbc7ee
```

Do not overwrite an existing checkout or substitute the current head for a historical import. Install dependencies separately with `npm ci` where needed, using Node 24. The tested version was 24.22.1. Native package bytes may differ by platform; verify required pins before replaying offline modules. The package records these prerequisites without promising every historical experiment is runnable; `unmaterialized-references.json` lists intentionally omitted old replay inputs.

Check whether `JEV_API_KEY` and `EXA_API_KEY` are present without printing their values; environment variables may also need reprovisioning on the new box. ElevenLabs and Deepgram are outside this typed-text backend scope. On this cloud, Node external requests used `NODE_USE_ENV_PROXY=1`; confirm the new environment's proxy configuration before any newly planned provider work.

## Current results and remaining work

This publication supersedes the bundle's dated paragraph describing the Exa parser change as an isolated local integration. The fix has now propagated through all six draft branches: #31 → #32 → #33 → #34 → #35 → #36. It rejects explicit failed provider envelopes before normalization can discard their error metadata. Current integrated source at `7333f57c2da7c757014472194e8a5efcb4f707b4` passed lint, typecheck and **621 tests across 30 files**, plus **36/36 development scenarios and 21/21 presentation fixtures**. It is byte-identical in production/test source to the independently reviewed guard tree. Publication documentation and evidence additions do not change that source. Protected contracts, iOS, ASR and the original held-out fixture remain unchanged against the recorded baseline. The [publication validation receipt](../fixtures/continuation/fresh-cloud-publication-01/validation.json) records all six local branch gates; remote CI is checked separately against the published heads.

The backend is **not ready**. The latest full factual development cohort remains 4/12 correct definitive results, 3/12 with all selected citations independently verified, and eight abstentions. That dated cohort does not measure the new parser fix.

The later NEW24 semantic diagnostic completed once: **2/12 compatible cases passed, 0/6 incompatible cases were accepted, and 1/6 uncertain cases was incorrectly accepted**. All 24 ordinary policies abstained. It failed its criterion and adds no factual coverage. Do not promote adapter11, weaken thresholds or repeat that study to rescue its result. The separate canonical-target probe also completed once; its frozen exact-whole-unit metric was negative, with zero matches. These are separate observations, not a pooled score.

Read the restored `new24-semantic-analysis-01/report.md`, `new24-semantic-live-audit-01/audit.json` and `canonical-target-material-analysis-01/report.json`. Every bundled live authorization has been consumed. Never rerun/resume those campaigns or interpret their authorization files as fresh permission. New provider work needs a new concrete bounded plan under the user's continuing task authorization.

The [read-only next-intervention review](../fixtures/continuation/fresh-cloud-publication-01/new24-next-intervention-readonly-01/ASSESSMENT.md) rules out another missing-target explanation for NEW24. It identifies a separate ambiguous selector instruction, but that does not explain any NEW24 terminal blocker. Its proposed future comparison is a hypothesis, not a scheduled run or evidence of improvement.

Continue with the smallest general improvement supported by these failures. Preserve source scope, provenance, dependence, private-query isolation, deadlines, budgets and cancellation. Use subagents for disjoint implementation and independent review. Keep PRs as drafts; do not merge, deploy, close issues or notify reviewers. Read `docs/backend-readiness.md` before making a readiness claim. Keep the three historical sealed campaigns and the original held-out bodies protected and unrun again.
