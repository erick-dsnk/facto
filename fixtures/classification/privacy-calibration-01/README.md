# Public-biography privacy question experiment

This package preserves the independently authored 24-unit public development
corpus, two independent label sets, frozen adjudication, original runner and
candidate bytes, hashes and the single paired full-classifier execution.
`corpus-README.md` contains the original author's dataset methods and limitations.
All private-bearing inputs are explicitly synthetic development controls. No
real private data, authorization headers or keys are included.

The clarified question admitted 12/14 exact safe-span occurrences versus 2/14 for
the original question. Both arms leaked 0 private spans across 12 private-bearing
controls (10 wholly private and 2 mixed). Public-only admissions were 11/12 versus
2/12; mixed safe-clause admissions were 1/2 versus 0/2. The remaining misses were
the unchanged `multiple_propositions` gate for one publication statement, alone
and repeated next to a private clause. The 14 occurrences represent 12 unique
public propositions, not 14 independent examples.

The candidate changed only the `private_data` question on the actual classifier;
state, candidate prefixes and every other question stayed identical. The strict
`private_data < .10`, deterministic private-data backstops, contained-private-span
veto and all completeness, structure, assertion and scope gates stayed intact.
Independent P1 review approved promotion of exactly the frozen question. The
production prompt and boundary tests are commit `a7e6e98`.

All 48 actual Jev calls completed once, without retry: 114,314 measured input
tokens, 463,846 request bytes, 57,686 response bytes and 5,608 ms total. No Exa
calls occurred. Jev USD and output-token cost remain unknown. See
`biography24-run-01/comparison.md` for the complete interpretation and
`report.json`/`events.jsonl` for named outputs and sanitized admission offsets.

This is one small open development cohort, with synthetic privacy controls and
no held-out generalization or population-privacy guarantee. It measures admission,
not retrieval, verdict correctness, factual truth or end-to-end usefulness. No
threshold was tuned and no failed unit was rerun. All predeclared units remain.

`package-manifest.json` hashes the original artifact bytes. Executable source
files are archived with `.txt` suffixes to keep the development evidence outside
the application build. `source-freeze/` retains the production classifier/client/
span/contract bytes used during the experiment before prompt promotion. The
original runner intentionally refuses changed source hashes and existing output
directories; this archive is not permission to replay the campaign or spend keys.

