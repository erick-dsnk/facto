# Offline citation fallback replay

Public run06 L1-opera first judgment is replayed unchanged against old policy `7e278906bd20e4460c431eeef4b6dd93f76a0acb` and fixed #17 policy `893e95965e12a60ab3f94558b7b0806493291a3b`. Source-quality and assessment implementation hashes match.

The captured preferred citation `ev-a38cbdd50b89785e9ddf` has substantive probability 0.84, below the existing 0.85 source gate. Two other retained sources pass all unchanged gates. Old policy returns `insufficient_evidence / no_agreeing_citation`; fixed policy returns `supported / qualifying_evidence`, selecting only:

- `ev-98bba1d289c45e2bce3a`: https://www.sydneyoperahouse.com/our-story/50-years-extraordinary-moments; substantive probability 0.96.
- `ev-c6ef4b33746b6e519887`: https://www.queenelizabeth.com/moments/opening-of-sydney-opera-house; substantive probability 0.97.

The Queen Elizabeth memorial URL returned HTTP 403 in the separate prior citation review. Passing these captured model/policy gates is not independent verification of that page and provides no new citation-access evidence. This known access limitation remains unresolved by the replay.

Synthetic selection-only mutations preserve fail-closed behavior: explicit none returns `no_agreeing_citation` under both versions; an invalid retained ID raises `invalid_citation` under both. Captured evidence and scores are unchanged in these mutations.

Create exact detached checkouts from a clone containing both commits (choose any available worktree paths):

```sh
git worktree add --detach /tmp/citation-old 7e278906bd20e4460c431eeef4b6dd93f76a0acb
git worktree add --detach /tmp/citation-fixed 893e95965e12a60ab3f94558b7b0806493291a3b
npm ci --prefix /tmp/citation-old
npm ci --prefix /tmp/citation-fixed
```

Run from the fixed checkout so Node can resolve its installed tsx loader. Every path is an explicit CLI argument; the script has no workspace-path defaults:

```sh
cd /tmp/citation-fixed
node --import tsx /path/to/replay-citation-fallback.ts --old-root /tmp/citation-old --fixed-root /tmp/citation-fixed --input /path/to/live-development-06.json --json-output /path/to/citation-fallback-replay.json --markdown-output /path/to/citation-fallback-replay.md
```

Invocation used for this artifact (run from a checkout with tsx installed):

```sh
node --import tsx '/workspace/task-evidence/replay-citation-fallback.ts' --old-root '/workspace/live-frozen-06' --fixed-root '/workspace/stack-17' --input '/workspace/task-evidence/live-development-06.json' --json-output '/workspace/task-evidence/citation-fallback-replay.json' --markdown-output '/workspace/task-evidence/citation-fallback-replay.md'
```

The script requires clean tracked source at both exact revisions; revision guards remain fixed. Output directories are created as needed, and captured input cannot be overwritten. The JSON includes script/input/code hashes, actual public retained records, named model answers, decisions, and negative mutations.

This is captured-judgment replay, not fresh end-to-end or provider success. It isolates a deterministic citation-selection defect; it does not establish general fact-checking accuracy or a live coverage gain. No providers, original private input, secrets, or sealed material are accessed.
