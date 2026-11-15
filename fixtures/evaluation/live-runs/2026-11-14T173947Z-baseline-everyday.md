# Live eval: baseline-everyday

Started 2026-11-14T17:39:47.029Z, finished 2026-11-14T17:41:45.029Z. Server: loopback, live mode. Completed, 59 checks, 2 sessions.

| Metric | EVERYDAY: baseline-everyday |
|---|---|
| Cases | 59 |
| Accuracy, 4 labels | 26/50 (52.0%) |
| Outcome accuracy, all labels | 29/59 (49.2%) |
| Wrong True/False | 0 (0 true called false, 0 false called true) |
| Can't verify share | 7/51 (13.7%) |
| Skip share | 18/51 (35.3%) |
| Errors and timeouts | 0 |
| Latency median / P95 | 0.92 s / 5.95 s |
| Exa searches per check | n/a |
| Jev calls per check | n/a |

## EVERYDAY confusion matrix

| expected \ predicted | true | false | cant_verify | not_a_claim | needs_confirmation | skip |
|---|---|---|---|---|---|---|
| true | 18 | 0 | 2 | 0 | 6 | 2 |
| false | 0 | 8 | 5 | 2 | 7 | 0 |
| speculation | 0 | 0 | 0 | 1 | 0 | 0 |
| not_a_claim | 0 | 0 | 0 | 2 | 4 | 1 |
| needs_confirmation | 0 | 0 | 0 | 0 | 1 | 0 |

HARD is the AVeriTeC held-out sample (CC BY-NC 4.0), read in place from the reference app checkout. Reports keep only ids, labels and metrics; no claim text, context, checked text or summary is stored.
