# Automatic presentation development, first run 08

Executed exactly once against clean commit `aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c`, source SHA256 `09c18944f1eba27dd09293a31511824014cbea0f92057c7c7e5b6445fcb70d42`. All six isolated authenticated HTTP/WebSocket sessions produced correlated terminal receipts. Five action scenarios passed; one remains inconclusive because the factual result abstained. No scenario was repeated or replaced.

| Scenario | Actual verdict / terminal | Actual action and reason | Outcome |
| --- | --- | --- | --- |
| Disabled automatic permission, BD10 | contradicted | silent / notifications_disabled | Pass |
| Enabled literal selected topic, BD10 | contradicted | **notify / selected_topic_contradiction** | Pass |
| Enabled supported-fact target, BD09 | insufficient_evidence | silent / automatic_noncontradiction | **Inconclusive** for supported-fact branch |
| Enabled low priority, no selected topic, BD10 | contradicted; priority 0.18 | silent / insufficient_priority | Pass |
| Synthetic personal automatic control | claim.skipped; private_or_personal | silent / private_or_personal | Pass; zero Exa attempts |
| Muted intentional manual check, BD07 | supported | silent / muted | Pass |

The notify receipt was an actual provider-backed `claim.result`, with the exact predeclared public span, request revision 1, and a cold result. Its practical-consequence assessment was 0.18, so the selected topic enabled this notification. All five factual result occurrences were cold because each scenario used a fresh session; BD10's three appearances are still repeated development data. This cohort adds **zero facts** to any factual-accuracy denominator.

Actual usage: **21 attempts**, comprising 12 Jev, 6 search and 3 contents calls. Every attempt returned HTTP 200. Input usage was 69,270 measured tokens with zero unknown reservations; requests totaled 289,105 bytes. Cohort elapsed time was 19,989 ms including conservative spacing between automatic sessions. Known cost was $0.048, explicitly partial because all 12 Jev costs were unknown. All limits remained within the predeclared cumulative cap.

All 18 unauthorized session-join, check and WebSocket probes returned 401. Post-run auditing matched all six search queries to their current admitted public proposition or approved alternate, and matched all nine search/contents instruction digests to the frozen helpers. Three content target URLs were recorded. The personal input, credentials and raw originalText were absent from the report and journal. The source freeze remained clean.

The journal contains 48 records: 21 predispatch reservations, 21 completed-attempt checkpoints and six case checkpoints. No operational or provider failures occurred. Operational completion does not turn AD03's abstention into a supported-silence pass.

Selected-source review is pending: 14 selected-reference occurrences across six unique URLs. Ground-truth sources and correct action routing do not establish that every runtime-selected reference supports its exact proposition. Hardware delivery, native clients, ASR and deployment were not exercised.

Artifacts:

- `automatic-development-first-run08.json`: complete sanitized observation; SHA256 `d9065e26c43183b13d165a9560f638c57c982d9274530d75860d590cdb410fc9`.
- `automatic-development-first-run08.json.journal.jsonl`: durable journal; SHA256 `0f28afc16ad8387c929007521934ee85c15a1c7c7d1704b2cf6c1883b2a14240`.
- `automatic-development-first-run08.aggregate.json`: per-scenario scoring and usage.
- `automatic08-query-audit.json`: exact-public-query and instruction-digest audit.
- `automatic08-selected-citations.json`: selected runtime references for independent review.
