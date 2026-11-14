# Actual-provider automatic presentation — 14 November 2026

The backend delivered an actual selected-topic notification and correctly handled disabled notifications, low priority, a personal control and a muted manual request. The six-scenario campaign finished with **five action passes and one inconclusive result**: the intended supported-fact silence scenario abstained. All six requests received correlated terminal feedback. No scenario was repeated or substituted.

The [artifact package](../fixtures/evaluation/live/automatic-development-08/README.md) retains the predeclared manifests, isolated-session wrapper, original report and journal, query audit, independent citation review, hashes and offline metrics. It is open, purposefully selected development evidence, not a blind release evaluation. Known public development outcomes informed the selection. It adds **zero new facts** to any accuracy denominator.

## Observed action scenarios

| Scenario | Actual result | Actual presentation | Outcome |
| --- | --- | --- | --- |
| AD01: default notification permission disabled; BD10 | contradicted | silent / notifications_disabled | Pass |
| AD02: enabled literal selected topic; BD10 | contradicted | **notify / selected_topic_contradiction** | Pass |
| AD03: enabled supported-fact target; BD09 | insufficient_evidence | silent / automatic_noncontradiction | **Inconclusive** for supported-fact branch |
| AD04: enabled, unselected, low-priority BD10 | contradicted; priority 0.18 | silent / insufficient_priority | Pass |
| AD05: synthetic personal automatic control | private_or_personal skip; zero Exa attempts | silent / private_or_personal | Pass |
| AD06: muted intentional manual BD07 check | supported | silent / muted | Pass |

Each scenario used a new authenticated server/session and empty cache. All five factual result occurrences reported `cached:false`. BD10's three appearances remain repetitions of one proposition. The other factual inputs were BD09 and BD07; there were five eligible occurrences, three unique existing propositions, and one private control. The personal control expected no `claim.result`, so cache-result status was not applicable.

AD02's actual `claim.result` carried the exact predeclared public span, revision 1 and `notify/selected_topic_contradiction`. Its practical-consequence assessment was 0.18; the enabled literal topic supplied relevance. AD04 used the same proposition in a separate session with no selected topics and numeric priority 0.18. Separate sessions prevent a prior notification or cache entry from explaining its silence.

Silence alone is insufficient for AD03: its verdict was `insufficient_evidence` with `insufficient_independent_evidence`, not `supported`. Generic action-string metrics match six actions, but the stricter predeclared branch score remains five passes and one inconclusive. A later separately declared action probe cannot replace this observation.

## Freeze, calls and safeguards

| Identity or measure | Recorded value |
| --- | --- |
| Backend commit | `aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c` |
| Source SHA256 | `09c18944f1eba27dd09293a31511824014cbea0f92057c7c7e5b6445fcb70d42` |
| Manifest SHA256 | `2c223938aa63f555bc4ae9e0c09fbd43381071ace2a13778cdbedea9cd2ca8d0` |
| Executed wrapper SHA256 | `243a4398b26f11b036d2e33d7506846b33675b5ce28294dc2ac9821838d0fff1` |
| Actual provider attempts | 21: **12 Jev / 6 search / 3 contents**, all HTTP 200 |
| Measured input tokens / unresolved reservations | **69,270 / 0** |
| Request bytes | **289,105** |
| Known returned cost | **$0.048 partial**; all 12 Jev costs unknown |
| Cohort elapsed time | **19,989 ms**, including automatic-session spacing |
| Terminal / local-stop / transport-failure counts | **6 / 0 / 0** |

The declared cumulative cap was 24 Jev / 12 search / 18 contents calls, 180,000 charged input tokens, 1,000,000 total request bytes, 65,536 bytes per request and 90 seconds. The 24,000-token unknown-attempt reservation is an uncertainty allowance, not a guaranteed upper bound. Each new session received only the remaining allowance. The wrapper conservatively waited at least 4.1 seconds after the preceding automatic scenario completed before beginning the next; this wait counted toward the cohort wall cap, separately from request processing latency. Observed terminal durations were 535, 594, 1,128, 416, 158 and 469 ms in scenario order. Provider/index/CDN caching is not ruled out by fresh session caches.

All 18 unauthorized join/check/WebSocket probes returned 401. The six actual search queries matched the exact current admitted public span or approved alternate, and all nine search/contents instruction digests matched the frozen helpers. Three requested content URLs were recorded. The synthetic personal input, credentials and raw `originalText` were absent from the report and journal; the personal case made zero search or contents calls. These observations describe this finite diagnostic, not a universal privacy guarantee.

The journal has 48 records: 21 predispatch reservations, 21 completed-attempt checkpoints and six case checkpoints. The source freeze remained clean. Later provider-status diagnostics are not retroactively attributed to this run. Costs remain partial; output-token counts and total provider costs are unknown.

## Selected-citation inspection

An independent AI agent inspected **all 14 selected-reference occurrences across six unique URLs**. The six exact URLs returned HTTP 200 public article bodies in requests initiated at 04:38:11 UTC on 14 November 2026; their original timestamps and body/text hashes are retained. Every selected reference was verified for its material relationship to the exact checked proposition. That gives four fully reviewed result occurrences, representing only **two unique existing facts**: BD10 repeated three times and BD07 once.

The Smithsonian references distinguish the British donor from the 1846 US congressional organizing act and presidential enactment. The two institutional histories share a publisher, and all four selected accounts concern the same act; four URLs do not establish four independent origins. The Panama Canal operator chronology and museum account support the bounded 1914 opening claim. Unrelated promotional statements and wider claims about the first vessel were not relied upon. Distinct publishers do not prove independent historical origins.

The reviewer matched each exact retained excerpt hash to saved source text, accounting for disclosed Unicode, whitespace, markup, punctuation and ellipsis-separated segments. This establishes material quotation alignment, not byte identity between HTML and extracted excerpts. No unselected source was substituted. The audit is AI-agent review, not human sign-off, a blind evaluation, proof of exhaustive retrieval or proof of uncached upstream state. Raw bodies remain in the external hash-identified archive; extracted text, metadata and reasoning are packaged in the repository.

This campaign covers typed backend requests through authenticated HTTP/WebSocket transport. It does not exercise native clients, hardware notification delivery, ASR or deployment, and it does not by itself establish backend readiness or population accuracy.

## Separate AD07 followup

After preserving the original six-scenario result, one [separate purposive followup](../fixtures/evaluation/live/automatic-development-ad07/README.md) used the already-reviewed BD07 Panama Canal statement. It ran exactly once on the same immutable backend in a fresh automatic session with notifications enabled, no selected topics and mute disabled. The actual cold result was **supported + silent/automatic_noncontradiction**, exercising the supported-fact silence branch. The terminal receipt arrived after 583 ms; complete campaign elapsed time was 779 ms.

AD07's predeclared cap was 6 Jev / 2 search / 3 contents calls, 80,000 charged input tokens, 24,000 reserved per unknown Jev attempt, 300,000 total request bytes, 65,536 bytes per request and 30 seconds. Actual usage was 2 Jev / 1 search / 0 contents, 13,243 measured tokens, 55,046 request bytes and zero unresolved usage reservations. All three provider attempts returned HTTP 200. The known partial cost was $0.007; both Jev costs remained unknown. Authentication probes returned 401, and the journal contains three predispatch, three finished-attempt and one case checkpoint.

Both selected references exactly matched AD06 by evidence ID, URL and excerpt SHA256. A separate AI agent reverified the saved source bytes, text hashes and quotation alignment, preserving the original 04:38:11 source-fetch timestamps and 04:42:02 review timestamp. It made **zero new source requests** and did not relabel prior access as current AD07 freshness. Both references support the bounded opening year; unrelated marketing and broader first-vessel claims remain outside the review.

The followup was selected using known development behavior and contributes **zero new unique factual claims**. Original AD03 remains inconclusive, and the original six-scenario score remains five passes and one inconclusive. AD07 is reported separately rather than pooled into that predeclared result.
