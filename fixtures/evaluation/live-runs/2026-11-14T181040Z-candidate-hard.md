# Live eval: candidate-hard

Started 2026-11-14T18:10:40.427Z, finished 2026-11-14T18:14:58.773Z. Server: loopback, live mode. Completed, 100 checks, 3 sessions.

| Metric | HARD: candidate-hard |
|---|---|
| Cases | 100 |
| Accuracy, 4 labels | 38/100 (38.0%) |
| Outcome accuracy, all labels | 38/100 (38.0%) |
| Wrong True/False | 0 (0 true called false, 0 false called true) |
| Can't verify share | 55/100 (55.0%) |
| Skip share | 9/100 (9.0%) |
| Errors and timeouts | 0 |
| Latency median / P95 | 2.35 s / 5.14 s |
| Exa searches per check | 1.25 (100 rows) |
| Jev calls per check | 2.45 (100 rows) |

## HARD confusion matrix

| expected \ predicted | true | false | misleading | cant_verify | speculation | not_a_claim |
|---|---|---|---|---|---|---|
| true | 11 | 0 | 1 | 15 | 5 | 3 |
| false | 0 | 11 | 1 | 19 | 0 | 4 |
| misleading | 0 | 1 | 3 | 8 | 1 | 2 |
| cant_verify | 0 | 0 | 0 | 13 | 2 | 0 |

HARD is the AVeriTeC held-out sample (CC BY-NC 4.0), read in place from the reference app checkout. Reports keep only ids, labels and metrics; no claim text, context, checked text or summary is stored.
