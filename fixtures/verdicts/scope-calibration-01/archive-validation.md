# Archive validation

All 55 original package entries matched their recorded SHA-256 hashes before
staging. A scan against configured environment secret values and an API-key
pattern found no matches. No provider call or application source edit occurred
while packaging this evidence.

`git diff --cached --check` reports whitespace in verbatim public-source captures
(HTML and extracted Markdown). The retained bytes are intentionally unchanged;
stripping source whitespace would invalidate the archived provenance hashes.
The full local diagnostic is preserved outside the repository at
`/workspace/task-evidence/scope-calibration/archive-diff-check.log`. This archive
does not reinterpret an artifact whitespace diagnostic as a runtime test failure
or a reason to modify the original source captures.

The source experiment's eight offline tests and standalone TypeScript check
passed before the one authorized campaign. No full application-suite rerun was
needed for this immutable fixture-only copy; no runtime code changed here.
