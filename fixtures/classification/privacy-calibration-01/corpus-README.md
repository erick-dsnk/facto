# Public professional records and private material: open admission cohort

This predeclared cohort tests a narrow admission/privacy distinction. It is not a factual-verdict evaluation, a production privacy guarantee or an accuracy claim about all biographies.

The24 units contain12 complete public-record propositions and12 synthetic private/mixed controls. Public facts span three professional roles, three published works/bylines, three non-Nobel public awards, and three official/professional acts. Two less-familiar byline/professional names reduce exclusive reliance on famous-name recognition. All12 are checked against original public URLs returningHTTP200; `public-source-records.json` retains exact contiguous quotes from whitespace-normalized visible HTML, source/body hashes, dates and URLs. No private fact from a source biography is used as a test unit.

Private controls cover health, personal bank balances/debt, home/contact details, credentials/identity-document numbers and private lived events. All private persons, attributed public-figure roles, amounts, addresses, identifiers and events are invented. No actual secret or private personal information appears in the cohort. Fame, an award or an elected role must not waive these categories. Two mixed controls contain an exactly separable reused public clause; they remain private-bearing as whole inputs, while the safe public clause can be assessed separately under unchanged admission gates.

The twelve positive facts are not twelve independent source publishers, and the two mixed clauses reuse earlier public propositions. Do not count mixed reuse as additional unique factual coverage. Real public names versus invented private names is a remaining confound; this cohort cannot establish behavior for all unfamiliar public individuals or nuanced public/private disclosures. It intentionally avoids the baseline Röntgen/Nobel topic and any private sealed evaluation cases.

First labels were frozen before viewing candidate prompt/code or provider outputs. A second agent receives only a deterministic shuffled text-only packet and the rubric; category/provenance/first-label hints are omitted from that annotation packet. Both annotation files must remain intact, including disagreements, before adjudication. Model state receives exact candidate text and the real classifier's ordinary fields, never labels, source proofs or category metadata.

Files:

- `units.unlabeled.json`:24 shuffled units, metadata for audit only.
- `annotation-inputs.json`:minimal id/text packet for independent second labeling.
- `annotation-first.json`:curator labels, exact public/private strings and Unicode-code-point offsets.
- `rubric.md`:privacy/public-record distinction and mixed-span rules.
- `public-source-records.json`:public factual source proofs.
- `first-freeze.json`:pre-candidate/pre-output first-label and corpus hashes.

The runner is separately maintained at `/workspace/task-evidence/privacy-calibration/runner.ts`. Root authorized one pass of24 units per arm, maximum48 actual Jev calls, zero Exa project calls,200,000 measured input tokens with24,000 pending reserve,64KiB per request/1MiB total,120seconds and no retries. The current private-data threshold and every other admission/privacy gate stay unchanged. Corpus authoring used connected public research and original public HTTP reads, with zero project-key or classifier calls.
