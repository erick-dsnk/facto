# Backend prototype readiness contract — proposed

Scope: the typed-text fact-checking backend, authenticated HTTP/WebSocket transport, admission, retrieval, judgment, presentation policy and bounded runtime. iOS, glasses, ASR, deployment and device measurements remain excluded. This document proposes an engineering release decision; it does not certify readiness or change policy thresholds.

## Required by the existing plan and issues

Sources: GitHub issues 15, 16, 17, 18, 20 and 24. Requirements retain their original scope; wearable-only acceptance remains deferred.

- Admit exact complete public spans; preserve negation, quantities, conditions and Unicode offsets. Private/opinion/nonasserted content must not receive factual verdicts or unsafe public searches. Unresolved input clarifies or waits and expires within bounds.
- Zero private details in inspected queries, zero stale output after stop and zero duplicate backend delivery capable of causing repeated speech. Record any harness-blocked unsafe query as a failure, separately from actual exposure.
- Every definitive result needs relevant, scope-matched substantive evidence and validated retained citations. Preserve conflict, dependence, risk and misleading-context requirements. Official publication, attribution, domain prestige or model confidence alone cannot establish truth.
- Keep operational failure distinct from completed insufficient evidence. Maintain the common ten-second deadline, attempt/queue/memory limits, cancellation, revision/session isolation and error-free factual-cache semantics.
- Manual requests receive permitted result, clarification or service-status feedback. Automatic notification requires a qualifying contradiction, permission, current healthy state, priority and available budget; other outcomes stay silent and inspectable.
- Record all critical privacy, source, correction, cancellation and operational-failure fixtures. Run applicable full gates. Independently inspect every definitive demo citation and disclose who or what opened and assessed it, the exact source content, access failures, scope and provenance limits. Agent source inspection is reported as agent inspection, never as human review. No additional human approval or sign-off gate is imposed by this contract.
- Aim for at least 90% held-out eligibility precision; report eligible misses/recall and all denominators. Record factual errors, abstentions, source relevance, action correctness, latency and partial costs separately. Do not substitute fixture success for live accuracy.

The plan's numerical admission/verdict thresholds are initial tunable policy settings, not calibrated truth probabilities. The plan does not set a numerical useful-coverage requirement. On inspection method, §9 says to “inspect the fixture sources manually,” §15 describes live text evaluation “with human-reviewed evidence,” and issue 24 says to “Inspect demo citations manually.” None specifies a separate approval or human sign-off action. The operational requirement here is independent content inspection with honest method disclosure; it must not be relabeled human review when performed by an agent.

## Proposed additional engineering release bar

Before dispatch, freeze one fresh independently authored release cohort: 40 ordinary eligible facts, balanced 20 true/20 false across four factual domains of ten each, plus 20 privacy/opinion/ambiguity/action controls. Predeclare exact expected spans/actions, authoritative ground truth, rubric, budgets, metrics and stopping rules. Use cold requests; cache and warm-repeat checks are separate operational observations.

- At least 32/40 correct, fully source-verified definitive results; at least 7/10 per factual domain and 14/20 per truth polarity. All eligible inputs remain in the denominator, including admission misses, abstentions and timeouts.
- Zero wrong or unsupported definitive results. Independently open every selected reference and verify exact proposition/scope, substantive content and provenance. A selected reference that cannot be verified prevents that result receiving source-verified coverage credit; do not silently substitute another retained source.
- At least 90% admission precision and recall, with candidate/span counts and action confusion reported. Zero unsafe queries, critical privacy/lifecycle/budget regressions or unsupported automatic alerts.
- Terminal feedback for every manual input. At most one factual operational failure among forty; it still fails useful coverage. Preserve the existing deadline rather than raising it to improve completion.
- Report cold latency including timeout terminals, actual attempts/usage, unknown charges and all failures. These small finite-sample bars qualify only the declared prototype scope; they do not establish production accuracy or a population failure rate.

## Development and evaluation discipline

Improve on separate open public development/calibration data first: balance true/false propositions, substantive source types, scope qualifiers, bare assertions, advertising, attribution, copied text, common-origin bridges and unknown provenance. Keep the existing 36-case development fixture denominator and 21 presentation cases explicit; new live cohorts have separate denominators. Second-label quality/origin units independently and adjudicate before provider output. Tune only against development data with declared rationale and adverse regressions; never remove safeguards to force a result.

After development meets the proposed bar, freeze the commit and source scope hash, run the full gate, and execute the new release cohort once in predeclared bounded batches. A failed release remains a failure; revise against development evidence and use a separately prepared fresh evaluation after another freeze. All three prior sealed campaigns and the original held-out bodies remain protected, immutable and unrun again. Never pool different cohorts/freezes or infer causal improvement from their differences. Keep drafts and issues open while readiness criteria remain unmet.
