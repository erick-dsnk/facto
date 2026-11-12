# Review rules (hackathon mode)

- Report **blocking issues only**: correctness bugs, security problems, leaked secrets, data loss, a broken demo flow, and edits outside the files the linked issue owns.
- Report at most 5 findings, most severe first. No praise, summaries or emoji.
- Each finding gives the concrete failure ("input X → wrong Y") and the fix in one line.
- Do not report anything lint, typecheck or tests already enforce, style or naming preferences, missing docs, or anything under `*.lock`, `dist/`, `build/`, `.next/` or generated code.
