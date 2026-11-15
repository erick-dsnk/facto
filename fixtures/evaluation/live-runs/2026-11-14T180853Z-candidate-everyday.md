# Live eval: candidate-everyday

Started 2026-11-14T18:08:53.480Z, finished 2026-11-14T18:10:35.068Z. Server: loopback, live mode. Completed, 59 checks, 2 sessions.

| Metric | EVERYDAY: candidate-everyday |
|---|---|
| Cases | 59 |
| Accuracy, 4 labels | 44/50 (88.0%) |
| Outcome accuracy, all labels | 52/59 (88.1%) |
| Wrong True/False | 0 (0 true called false, 0 false called true) |
| Can't verify share | 2/51 (3.9%) |
| Skip share | 3/51 (5.9%) |
| Errors and timeouts | 0 |
| Latency median / P95 | 1.19 s / 3.60 s |
| Exa searches per check | 0.64 (59 rows) |
| Jev calls per check | 2.02 (59 rows) |

## EVERYDAY confusion matrix

| expected \ predicted | true | false | misleading | cant_verify | speculation | not_a_claim | needs_confirmation |
|---|---|---|---|---|---|---|---|
| true | 27 | 0 | 0 | 0 | 0 | 1 | 0 |
| false | 0 | 17 | 1 | 2 | 0 | 2 | 0 |
| speculation | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| not_a_claim | 0 | 0 | 0 | 1 | 0 | 6 | 0 |
| needs_confirmation | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

HARD is the AVeriTeC held-out sample (CC BY-NC 4.0), read in place from the reference app checkout. Reports keep only ids, labels and metrics; no claim text, context, checked text or summary is stored.
