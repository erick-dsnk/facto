# Candidate09 guard revision03

Preserves original finalized plan and revision02 byte-exact. After completed batch01, runtime independently reported the guard had stopped continuation on a diagnostic schema error: deterministicPublicIssues is an array of public-span diagnostic rows, including rows with issue:null. Nonempty array alone does not mean a privacy issue.

This revision changes only that assertion: the field must be a list, each row a dictionary with an explicit issue key whose value is None. Missing/malformed/non-null issues still fail. Exact freeze3-way binding and every other source, privacy, budget, auth, accounting and stop guard remain. No corpus, expected label, source, caps, output paths or prior reports changed. This is post-batch01 schema correction, not retroactive predispatch approval; paid batch01 must never be rerun. Root explicit continuation review remains required. Author did not inspect partial/completed report bodies or invoke providers.
