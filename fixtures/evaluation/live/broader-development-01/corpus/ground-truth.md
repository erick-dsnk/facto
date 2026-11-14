# Broader open development set — 14 November 2026

This is **open development data**, deliberately visible to implementers for inspection and tuning. It is **not blind, not held out, and not evidence of general accuracy**. Author status: pending independent source and label review. Do not execute a live campaign until that review has been completed.

The author did not inspect implementation code or diffs, original heldouts, or earlier sealed sets, and did not execute the pipeline or use project API keys. Project context was limited to AGENTS.md and docs/plan.md; the eligibility and evidence rules in plan sections 8–9 informed the expected behavior. Unknown sealed data may overlap by coincidence; no no-overlap certification is made.

## Denominators and use

| Unit | Count |
| --- | ---: |
| Total input texts | 16 |
| Ordinary factual inputs / unique factual propositions | 12 |
| True unique facts | 6 |
| False unique facts | 6 |
| Controls | 4 |
| Eligible exact public span occurrences | 13 |
| Inputs with no eligible public span | 3 |

BD01–BD12 form the **12-claim unique factual denominator**. BDC04 repeats BD07 solely to test public/private span isolation: it adds one eligible occurrence but **no unique fact**. Score factual accuracy on BD01–BD12 once each. Report control behavior separately. A campaign that includes the mixed repeat may report 13 eligible occurrences, but must disclose that repeated propositions and possible cache reuse are not independent factual samples.

The four controls are one personal anecdote, one pure opinion, one incomplete fragment, and one synthetic private/public mixture. The mixed case is an eligible-span isolation control, not a negative-admission control. The other three contain no eligible public spans. Neither private synthetic statement receives a truth label.

All inputs are English typed development fixtures. Exact spans use half-open Unicode code-point offsets into unnormalised original text. They include the final punctuation where present. No live audio/OCR/hardware measurement is implied.

## Factual ground truth

| ID | Exact claim | Truth | Admission | Evidence |
| --- | --- | --- | --- | --- |
| BD01 | The Great Fire of London occurred in 1666. | True | check | D01-P, D01-A, D01-C |
| BD02 | Magna Carta was first issued in 1216. | False | check | D02-P, D02-C |
| BD03 | Mount Kilimanjaro is located in Tanzania. | True | check | D03-P, D03-C |
| BD04 | Lake Baikal is in Africa. | False | check | D04-P, D04-C |
| BD05 | In the SI definition of the second, the unperturbed ground-state hyperfine transition frequency of the caesium-133 atom is fixed at 9,192,631,770 Hz. | True | check | D05-P, D05-C |
| BD06 | The chemical symbol for gold is Ag. | False | check | D06-P, D06-C |
| BD07 | The Panama Canal opened to world trade in 1914. | True | check | D07-P, D07-C |
| BD08 | The first modern Olympic Games were held in Paris in 1896. | False | check | D08-P, D08-C |
| BD09 | UNESCO's Constitution was adopted in London on 16 November 1945. | True | check | D09-P, D09-C |
| BD10 | The Smithsonian Institution was created by a British royal charter in 1846. | False | check | D10-P, D10-C |
| BD11 | Wilhelm Conrad Röntgen received the first Nobel Prize in Physics in 1901. | True | check | D11-P, D11-C |
| BD12 | The Great Barrier Reef lies off the west coast of Australia. | False | check | D12-P, D12-C |

### BD01

The Great Fire of London took place in September 1666; only its year is tested.

Scope: calendar year of the historical London fire.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD02

Its first issue dates to June 1215. The 1216 version was a later reissue.

Scope: first issue, not a later reissue; no exact sealing-location assertion.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD03

The maintained volcano country record and encyclopedia place Kilimanjaro in Tanzania.

Scope: named mountain's country; no elevation/eruption-status claim.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD04

Lake Baikal is in Siberia, Russia, not Africa.

Scope: named lake's continent/location; no depth ranking or volume claim.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD05

BIPM fixes this exact transition frequency to 9 192 631 770 Hz in defining the second.

Scope: SI normative definition as checked 2026-11-14; unperturbed ground state, hyperfine transition, caesium-133, exact fixed value, unit Hz.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD06

Gold's symbol is Au. The tested symbol Ag is not gold's symbol.

Scope: standard chemical element symbol, not an alloy/brand abbreviation.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD07

The Panama Canal Authority gives 15 August 1914 as opening to world trade.

Scope: opening to world trade, not construction start, earlier test passage, expansion or transfer.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD08

The first modern Games were held in Athens in 1896.

Scope: first modern Olympic Games; neither ancient Games nor founding of IOC in Paris.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD09

The legal text explicitly gives adoption in London on 16 November 1945; entry into force was a different event on 4 November 1946.

Scope: adoption of Constitution, place London, exact date; no member/signatory-count assertion.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD10

It was established by an act of the US Congress approved on 10 August 1846, not a British royal charter.

Scope: legal establishment mechanism in 1846; founder's British nationality is separate.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD11

The Nobel award record identifies Röntgen as 1901 recipient; independent biography identifies it as the first Physics Nobel.

Scope: first Physics Nobel recipient and year; not a claim about first prize in any category or discovery date.

Expected definitive label when qualifying evidence is retrieved: `supported`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

### BD12

It lies off Australia's northeastern coast in the Coral Sea.

Scope: named Great Barrier Reef's location; no current ecological-status assertion.

Expected definitive label when qualifying evidence is retrieved: `contradicted`. The truth label is independent of a particular run's evidence sufficiency; an operational timeout is not a truth error or an `insufficient_evidence` result. Report abstentions, wrong definitive labels, and correct definitive labels separately.

## Controls and privacy

| ID | Exact input | Initial admission | Expected public span |
| --- | --- | --- | --- |
| BDC01 | I misplaced my blue notebook on the train yesterday. | skip | None |
| BDC02 | Handwritten postcards are more charming than digital messages. | skip | None |
| BDC03 | The treaty was signed in | wait | None |
| BDC04 | My rent is €980 a month. The Panama Canal opened to world trade in 1914. | check | The Panama Canal opened to world trade in 1914. |

BDC01 and BDC04 are fabricated text. They do not report anyone's actual private event or rent. Never query the anecdote, rent, whole mixed input, or synthetic personal details. BDC04 allows only the exact second sentence, at code points **[25, 72)**. No rewriting or inference of a broader proposition is allowed.

BDC03 initially waits for bounded continuation. Without continuation it must expire to skip/clarification with no search or truth verdict. Under a manual check a clarification response is appropriate; a complete transcript segment does not itself make the proposition complete.

## Selection and wording

The 12 topics were chosen across stable history, geography, scientific conventions and institutional records before any pipeline execution. None was selected because an observed engine run succeeded. The public topics excluded in the assignment were avoided.

Two drafts were clarified during research, before pipeline use: Magna Carta's first-issue year replaces a sealing-location assertion because scholarship warns against assuming one exact original sealing event; UNESCO's Constitution adoption date replaces ambiguous establishment wording because adoption (16 November 1945) differs from entry into force (4 November 1946). These changes preserve the exact final statements in cases.json; future edits require a new manifest hash.

## Source rubric and origin caveats

Sources qualify by their relationship to the exact fact, not by looking official. Primary material here includes documentary transcripts, normative standards, the issuing body's legal/award/event/operational records, maintained scientific identification data, and formal designation records. A modern institutional retrospective or database is labeled as such; it is not presented as an eyewitness or a new experiment.

Independent editorial corroboration is supplied where located (including separately written Britannica and ABA material). Different websites do not automatically mean independent evidence. In particular:

- D01-P is a modern derivative transcript of Pepys's contemporary diary; D01-A is a custodian record of related primary holdings. D01-C is separately written museum history. The manuscript images themselves were not visually transcribed by this author.
- D05-P and D05-C reproduce the same SI definition. NIST is an independent publisher, but the wording and normative origin are shared. Count one standard-definition family, not two independent experiments.
- D06's element symbols share international nomenclature. The IUPAC commission's own record directly establishes the symbol; RSC corroborates the table interpretation.
- D09-P and D09-C share the same legal instrument. The UN registry independently administers a record of conclusion and entry into force, but it is not an independent documentary origin for adoption. D09-P directly establishes the tested adoption date; no fully independent underlying origin is claimed.
- UNESCO listing mirrors, Nobel site biography/award variants, IOC pages, translations of the same charter, and copies/scans of the Smithsonian act must be grouped by origin rather than counted separately.
- D07-C is a **search highlight**. The fetched bounded Britannica body stopped before the date, so this record does not claim full-page quote verification.
- Some source pages discuss figures outside the tested scope that differ (e.g. historical athlete counts or Baikal depth). Those are not merged into the tested claim.

Each source record in sources.json provides URL, bounded verbatim excerpt and context, role, fact-specific authority rationale, origin group, copy caveat, retrieval basis, and the dated check. Selected excerpts were checked as exact substrings of their returned page text or explicitly marked highlight. These checks establish what the connected retrieval returned; they do not certify a fresh origin-server fetch. Publication, retrieved/check date and historical event date are distinct.

## Research and measurement status

Research used 20 connected Exa searches requesting 80 results and 4 batched fetch calls requesting 32 URLs, with duplicates. These are research-request counts, not independent-evidence counts or 80 unique qualified sources. Final retained evidence comprises 25 bounded source records. Source text was requested and checked on **2026-11-14**. The tool may return indexed/cached text; no independent HTTP-status or live origin-freshness audit is claimed.

**Pipeline latency: not measured.** No admission, retrieval, judgment or end-to-end project pipeline call was executed by the author. Web-research timing must never be reported as pipeline latency. No model accuracy, retrieval success rate, wrong verdict count or cost/check has yet been measured on this set.

## Files and review handoff

- cases.json: rich case labels, exact spans, denominators, rationale and provenance.
- live-manifest.json: strict projected harness input; contains no rich research-only metadata.
- sources.json: machine-readable evidence register with bounded text.
- sources.md: human-readable evidence register.
- manifest.json: SHA-256 hashes and byte counts for the authored artifacts.
- SHA256SUMS: hash list, including manifest.json.
- author-validation.json: static checks only; not a pipeline run.

The parent will commission an independent reviewer to assess source relevance, scope, origin/copy caveats, truth labels and span/privacy behavior before use. The author's static validation does not satisfy that independent review.
