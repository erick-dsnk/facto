# Portable backend continuation

This package is an explicit allowlist of OPEN experiment source, installed record bytes, corpora, analysis and completed-run evidence. Original bytes and original absolute paths are preserved in `restore-map.json`; identical files share one deterministic gzip blob. Archived TypeScript/Python/JSON is inert blob data in the repository. There are no vendor trees, credentials, `.env` files, private/sealed evaluation bodies, or cache directories.

Read `CURRENT-STATE.md` first. **NEW24 is complete and failed its advance criterion. Never rerun it. Adapter11 is design only.** Historical authorization JSON is evidence, not reusable permission.

## Verify and extract without executing archived code

With a clone at `/workspace/junction-2026-current`, set the package directory to `fixtures/continuation/fresh-cloud-continuation-01` in that clone. These commands are separate, explicit actions; the restorer never invokes Git, npm, shell commands, network, imports of archived modules, installations, or live runners.

```
python3 restore.py
mkdir /tmp/backend-restored
python3 restore.py --target-root /tmp/backend-restored --extract
python3 restore.py --target-root /tmp/backend-restored --verify-restored
```

That relocates bytes to `/tmp/backend-restored/workspace/task-evidence/...` and proves data integrity only. It does not make absolute-import modules executable there. To place data at its original paths in a fresh cloud box, inspect the map and explicitly use `--target-root / --extract`. Existing identical files are accepted; any conflicting file or symlink causes refusal before extraction writes. The target root must already exist. No original workspace lookup or fallback is used.

Package integrity is bound by `BUNDLE-MANIFEST.json` and the Git publication commit. The manifest cannot protect against a malicious publisher replacing itself; obtain the exact commit/manifest hash from the publishing handoff. Gzip decompression, path validation and per-file/total sizes are bounded. A failed extraction may leave newly created exact files, but never overwrites differing bytes; re-verification identifies incomplete restoration.

## Exact historical source prerequisites

`git-checkout-map.json` records exact commits, tree hashes, package locks, tracked source pins and the original npm dependency pins. Source repos and npm packages are deliberately not embedded. Their availability on the future machine must be checked, not assumed. If an exact commit is unavailable, stop that replay and report the missing prerequisite; never substitute latest source.

Keep the active checkout separate. After obtaining the published repository normally, a human/agent can explicitly create these detached compatibility worktrees, only if both destination paths are absent:

```
git -C /workspace/junction-2026-current worktree add --detach /workspace/junction-2026 04ac297523291b1aa289761d5ba3bed98610536f
git -C /workspace/junction-2026-current worktree add --detach /workspace/stack-20 9f4090d609eac0101f4fb1bdcef0908be2cbc7ee
```

Git naturally refuses occupied worktree paths. Do not delete, reset or overwrite a preexisting checkout to make these commands succeed. Fetching missing commits, if necessary, is a separate network action. Fresh `npm ci` in each compatibility checkout is also a separate explicit dependency-install action. Never symlink to a nonexistent prior box's `node_modules`. Tested environment: Node 24.22.1, npm version in the map; package-lock pins govern versions. Native esbuild/Node platform differences can change installed bytes, so recheck required source pins before an offline module replay. No previous provider-run authorization is revived by reproducing the environment.

## Scope and gaps

The bundle preserves current prototype/import source, exact installed data, the complete NEW24 frozen plan/application-source closure, recorded npm hashes (not package bytes), neutral inputs and post-run-only annotations/helper/results. Complete prior experimental histories are not copied just for archival completeness. `unmaterialized-references.json` explicitly records references that require external Git/npm or omitted historical replay inputs. Some historical manifest verifiers demand predecessor folders intentionally absent here; use this bundle's exact-byte verifier for restored files rather than claiming all old scripts can run.

The inert `initial-allowlist-recipe.py.txt` records initial curation only; it does not regenerate later completed-capture additions. The author-time `export.py` reads only the final enumerated `allowlist.json`, which is the authoritative reproducible export input. They are not restore instructions and will fail on a box without the originals. The standalone `restore.py` uses package files only.
