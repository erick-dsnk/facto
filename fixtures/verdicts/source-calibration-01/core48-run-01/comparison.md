# First public source-basis comparison

**Do not promote the candidate.** At the unchanged .85 content threshold, it
accepted six fewer independently labelled substantive units and recovered none.
Both arms rejected all 15 primary non-substantive/insufficient units. This small,
clustered rubric experiment does not establish population calibration or factual
reliability, and it does not measure production verdict coverage.

The frozen core48 plan ran exactly once, with one pass per arm and no retries.
All 16 calls completed. The eight separately preserved boundary units were not
executed. Three predeclared disputed core units remained scheduled but excluded
from primary metrics. Production remains unchanged and the candidate is unwired.

| Partition / arm | Primary units | Labelled substantive accepted | Labelled substantive rejected | False accepts | Correct rejects |
|---|---:|---:|---:|---:|---:|
| Development / baseline | 16 | 7 / 10 | 3 | 0 | 6 |
| Development / candidate | 16 | 5 / 10 | 5 | 0 | 6 |
| Validation / baseline | 29 | 13 / 20 | 7 | 0 | 9 |
| Validation / candidate | 29 | 9 / 20 | 11 | 0 | 9 |

All scheduled units have results: development 16/16, validation 32/32. The
validation primary denominator is 29 because Q23, Q39 and Q47 were excluded
before model output. Both arms reject all three. If all three were substantive,
each arm adds three false negatives; if all were non-substantive, each adds three
correct rejects. No result was removed after seeing its prediction.

The six paired regressions are Q02 (research detection timing), Q21 (prize-share
record), Q26 (contents of a company's dated announcement), Q33 (historical formal
proclamation), and Q45/Q46 (historical event and destruction account). Five
candidate decisions still select `substantive` but give it .63–.82 probability,
below .85. Q46 selects `non_substantive` with P(substantive)=.49 while separately
classifying the genre as `substantive_secondary`. Thus separating genre did not
improve the fixed-threshold operating result in this cohort. The experiment does
not justify lowering a threshold.

Other label/model disagreements help bound the next investigation:

- Both arms reject all six independently adjudicated minimal named-method,
  named-finding or named-formal-record descriptions (Q07, Q11, Q15, Q19, Q31,
  Q43). These include promotional surroundings that do not erase the precise
  quoted research/record proposition under the frozen content-only labels.
  Their inclusion was resolved before model output, not tuned to the result.
- An identified record can receive different quality decisions for different
  propositions: the same Nobel record supplies both a 1903 prize share and an
  explicitly listed additional 1911 award. Both were labelled substantive; the
  candidate rejects both, and the baseline rejects the latter.
- Substantive passages that contradict the proposition also remain difficult:
  research track placement, alternating Wright flights, and a catalog explicitly
  saying that a purchase price is absent. Content-basis labels concern evidence
  substance independently of agreement. These observations do not establish why
  the model assigned a particular probability.

The 48 units come from 12 source families, with families kept within development
or validation. Many units are related transformations or propositions about the
same passage; their outcomes are not 48 independent source-reliability trials.
Source labels assess disclosed content, not authenticity, factual truth or expert
competence. The corpus includes clearly marked synthetic hard negatives and
mixed-content controls. Zero false accepts among 15 primary rejections cannot
establish a reliable false-accept rate. Origin-pair and eight extra boundary
predictions were not executed here. No end-to-end, high-risk or source-independence
gate was bypassed or evaluated by these isolated quality questions.

Actual accounting: 16 consumed Jev attempts / 16 started fetches; 0 Exa;
89,200 measured input tokens, all 16 calls reporting usage; 387,860 request bytes;
32,800 response bytes; 2,053 ms campaign duration. Jev USD and output-token cost
remain unknown; Exa cost is zero. No transport failure, missing usage or budget
stop occurred. Code/source hashes matched the freeze before and after execution;
each sent request body was checked against its frozen hash.

Evidence: `report.json` contains split metrics, strata, confidence bins and raw
answers; `events.jsonl` preserves each attempt and terminal result;
`comparison.json` lists every paired pass change. Plan hash:
`f010dee47cb4aabbfe31a39f9f9518bfbcadd67373a314f8e999bf5068e11647`.

Keep the baseline and candidate frozen. Any further question redesign, threshold
study, boundary execution or repeat requires a new declared experiment; this
report authorizes none of those actions.
