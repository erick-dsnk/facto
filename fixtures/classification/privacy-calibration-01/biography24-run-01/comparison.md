# Public biographical records and privacy: first comparison

The clarified question admitted **12/14 exact safe public-span occurrences**,
compared with **2/14** for the original question, while both arms admitted **zero
private spans across 12 private-bearing controls**. This is evidence for this
prompt clarification on a small, independently labelled open development cohort.
It is not a population privacy guarantee or end-to-end fact-checking result.

The 24 independently authored units were labelled independently with 24/24
agreement before provider output. Twelve units contain public role, published
work, award or official-act records; twelve contain synthetic private data,
including public-figure health, finances, home/contact information, identity
documents and lived anecdotes. Two private-bearing units also contain an exact
safe public clause. Thus there are 14 safe-span occurrences representing 12
unique public propositions. All units retain their author's `open_development`
partition; there is no held-out or population-calibration claim.

| Full-classifier outcome | Original question | Clarified question |
|---|---:|---:|
| Exact public-only admissions | 2/12 | 11/12 |
| Exact safe mixed-clause admissions | 0/2 | 1/2 |
| Total exact safe-span admissions | 2/14 | 12/14 |
| Wholly private controls leaking a claim | 0/10 | 0/10 |
| Mixed controls leaking a private component | 0/2 | 0/2 |
| Private-bearing whole utterances admitted intact | 0/12 | 0/12 |
| Inputs matching all expected admission spans | 12/24 | 22/24 |
| Failed/missing inputs per arm | 0 | 0 |

The clarified question corrected nine public-only privacy blocks and one safe
mixed-clause privacy block, without an admission regression in this cohort.
This comparison used the actual full classifier and all its gates, with identical
state, candidate spans and question names; only `private_data` wording changed.
The strict `<.10` privacy threshold, deterministic private-data checks,
contained-private-span veto, completeness, assertion, exact-scope and coherence
gates were unchanged. Raw answers to other questions can vary between calls;
this is one paired pass, not repeated evidence of stability.

The two remaining misses concern the same public publication statement, alone
(P04) and next to a private clause (P23). In both arms the exact safe candidate is
`public_fact` with probability 1 and has privacy score below .10. The classifier
instead chooses `multiple_propositions`, so the unchanged structure gate blocks
admission. In the clarified arm those privacy scores are .02 and .04; completeness
is .97 and .96. These are structure misses, not unresolved privacy distinctions.

For the other mixed input P24, the exact safe candidate's privacy score falls
from .54 to .08; its public-fact probability .99, completeness .94, coherent
structure, assertion and scope .97 qualify in both arms. Only that exact safe
clause is admitted in the clarified arm. Its private component and the enclosing
whole remain blocked. Named public figures did not gain permission to export
the synthetic health, finance, home/contact, credential or private-anecdote
controls. No web-search provider was called in this experiment.

Actual accounting: one pass per arm, 48 consumed Jev attempts / 48 actual started
fetches, 0 Exa, 114,314 measured input tokens, all 48 calls reporting usage,
463,846 request bytes, 57,686 response bytes, and 5,608 ms campaign duration.
There were no retries, failures, missing usage or budget stops. Exa cost is zero;
Jev USD and output-token cost remain unknown. The request/source guards passed
before every call, and source hashes still matched after completion. No raw
model requests, authorization headers or keys are retained in the run artifacts;
named answers/probabilities and sanitized admission offsets are retained. The
independent synthetic-control corpus is retained separately.

The experiment itself changed no production file. An exact prompt-only
production diff is prepared separately for independent review. This report does
not authorize changing thresholds, relaxing another gate, rerunning these units,
or treating ordinary public-biography handling as permission to disclose a
public figure's sensitive personal details.

`report.json` and `events.jsonl` preserve the complete single campaign;
`comparison.json` records gate-level diagnostics by exact candidate offsets.
Frozen plan hash:
`3be69ebb7626cf4248ad7338e011e071dc29af1ca9c946876d1d8d7b4c600b96`.
