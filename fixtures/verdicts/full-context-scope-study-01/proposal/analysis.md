# Full-context scope clarification proposal

The saved results support testing one source-specific qualifier-coverage clarification. They do not establish that the prior scope16 prompt improves full-context decisions. The new proposal is frozen and independently reviewed; it is not wired into production and has not been called.

## What the existing evidence establishes

Scope16 supplied one passage per full judge request. Both the baseline and the earlier scope replacement accepted all eight independently labelled matches and rejected all eight mismatches at the unchanged .85 threshold. No decision improved. Those results establish a useful regression set, not a coverage gain or evidence that missing qualifiers remain protected in a six-source judgment.

Comparison24 used six saved public contexts, baseline versus a content-basis-only treatment, each in original and reversed order. Its 24 observations contain 124 source assessments. The frozen request hashes show that **only content-basis instructions changed** within each paired condition; scope and stance instructions, evidence order and companions were unchanged. It therefore did not test either the prior scope16 wording or this new proposal in full context.

The independent selected-source audit distinguishes source presence from complete proposition coverage. Its three partial selected passages all received high scope and stance scores under both baseline and basis-treatment arms:

| Exact retained source | Missing link in the retained passage | Scope across all four calls | Stance across all four calls | What the basis treatment changed |
| --- | --- | --- | --- | --- |
| BD04 UNESCO report, `ev-8d8e57597f36a9992ee5` | South-east Siberia / Russian Federation / coordinates do not explicitly supply the claimed continent relation. | .91–.93 | Contradicts .99–1.00 | It became selected in both candidate orders. |
| BD04 ILEC record, `ev-566051bb4c4b0e20f045` | Buryat/Irkutsk, Russia and coordinates omit the continent mapping. Its North America mention compares water volume, not the lake's location. | .90–.93 | Contradicts .99 | Basis crossed from .70/.84 to .93/.96; both candidate orders became definitive. |
| BD11 Nobel ceremony, `ev-e31747a5310036c8ce8b` | Recipient, Physics and 1901 are present; the first-award ordinal is absent. The excerpt's “first” concerns discovery of X-ray properties. | .95–.96 | Supports .96–.99 | A separate memorial passage crossed the basis gate only in the reversed candidate order, enabling a definitive selection with this partial ceremony passage. |

These are latent relation/qualifier failures, not evidence that the basis treatment first caused scope to fail. The actual full-context scope mistakes were already present in the baseline. A source-quality improvement can expose them by allowing incomplete sources to satisfy the remaining qualification path. This does not prove whether the model filled missing facts from a companion, world knowledge, source identity or its desired verdict; the saved outputs cannot identify that internal cause.

The geographic claim is false in reality, but this analysis follows the retained-evidence rule: the selected passages do not themselves state the continent mapping. The memorial has an explicit first-Physics statement; that does not transfer the ordinal to the ceremony or establish independent underlying proof of it. Source quality and independence remain separate questions.

BD09 provides an additional event-relation diagnostic. The UNTC registry states `Places/dates of conclusion`, while the UNTS passage states `Signed at London`; neither explicitly equates that event with adoption. UNTC nevertheless receives scope .86–.90, and UNTS .71–.88. The actual UNESCO legal text explicitly says `Adopted in London on 16 November 1945` and consistently receives scope .98 and support 1.00. Its remaining basis rejection is a different mechanism and will not be repaired by a scope clarification.

The BD03 country relation and BD10 congressional-creation relation remain complete selected-passage controls in the independent audit. BD05's remaining source-family and quality restrictions likewise cannot be repaired by changing scope. The existing contexts must remain intact, including the excluded BD11 safety sentinel, competing passages, raw origin links and original/reversed orders.

## One proposed change

Append the exact text in `scope-appendix.txt` to the existing per-source scope instructions. Change no stance instruction, answer option, state field, content-basis question, confidence threshold or final policy rule. The original value-disagreement and universal-counterexample guidance remains verbatim.

The appendix distinguishes coverage of the subject/relation/material qualifiers from agreement, permits ordinary interpretation, explicit negation and logical counterexamples, and prohibits adding absent factual links. It distinguishes a separate metadata title field from an actual in-body record heading or row label attached to operative contents. A different asserted value of a covered relation remains in scope. A different event, period, population or missing ordinal/geographic relation does not become covered through topic overlap.

Logical counterexamples must follow from retained premises. An explicit earlier occurrence can refute a claim that an event first occurred later; an arbitrary award in the claimed year cannot establish that it was the first award. A passage naming a different continent can refute the asserted continent without an external factual mapping; a country name alone cannot supply its continent. Actual in-body field associations remain usable, while titles cannot fill a missing body fact.

The frozen candidate file is `candidate-freeze.json`, SHA-256 `04124646b25100b3bcd1f8fe4e7324db91ed83f7744d339a68494bf69ce610b7`. The exact appendix text hash is `724a653bfab1a94aa22189ffc6368b3c64b881658033802a6982ccd472d04662`. `final_stack_review` approved the exact wording before any new prospective control bodies were read.

## Prospective constraints and evaluation plan

The independent author is preparing a separate 12-context synthetic cohort, with six matched contrast families and three to six records per context. It is a scope/stance study, not a reuse of record-capability applicability labels. Its bodies and first labels are authored without the exact appendix or implementation. A second reviewer must freeze independent labels before adjudication or any model calls. Synthetic records must be explicit, and their outputs receive no factual-coverage credit.

Required contrasts cover missing versus explicit ordinal, retained geographic mapping, distinct event verbs, material conditions, separate metadata titles versus in-body record labels, and valid compared-value/negation/counterexample cases. Complete companions should be retained alongside incomplete target passages to test source-specific leakage. Include same-referent contradictory values and material-scope mismatches so a stricter question cannot succeed merely by rejecting everything. Preserve ambiguity instead of forcing labels.

Keep three denominators separate: prospective full-context labelled source decisions; unchanged scope16 regression decisions; and the six previously inspected full-context safety diagnostics. Do not count reversed copies or matched source variants as independent facts. Report per-source scope, stance and all other question spillovers, including any genuine coverage regression. Known contexts alone cannot justify a revision or promotion.

The plan must freeze exact input hashes and paired request hashes before execution. Baseline and candidate state and every non-scope question must be byte-identical within a pair. Keep all companions, source text and origin bridges; do not isolate the preferred target or alter labels after results. Keep all thresholds and all final-policy gates unchanged. No retry or failed-case selection after the first pass.

An offline byte projection shows the appendix adds 667 bytes per scope question. Applied only to baseline comparison24 requests, the largest projected request is 62,207 bytes, within 64 KiB. Combining the appendix with the separate basis treatment would reach 65,759 bytes and exceed that cap. The proposed study is therefore **scope-only versus baseline**, not a combined treatment. Do not remove companions, shorten evidence or silently increase the cap to make a combination fit.

Root selected smaller staging before any new outputs: 24 calls for twelve prospective contexts and 24 for six existing contexts in both orders, **48 calls maximum**, with separate metrics. The prior scope16 live rerun is explicitly deferred, not silently omitted or treated as a test of the new appendix. Its saved results remain background regression design evidence only. The executable runner and actual per-stratum prepared bytes, token reserve, total-byte and wall limits will be frozen after prospective data and independent labels are ready and require root authorization before provider calls.

## Limits

This proposal is a safety constraint on source qualification, not a demonstrated useful-coverage recovery. It cannot supply absent evidence, authenticate a primary source, recover missing substantive contents or establish independence. Even successful scope scores would not prove correct final verdicts. No provider, network or production operation was performed for this analysis. All input paths/hashes, 24 saved observations and paired question differences are preserved in `input-pins.json`, `prompt-comparison.json` and `saved-output-analysis.json`.
