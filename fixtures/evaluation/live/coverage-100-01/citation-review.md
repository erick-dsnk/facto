# Coverage100: exact selected-citation review

Status: prospective method and complete first-run selected-citation audit finished. This review owns only this document and `citations/`. Frozen research/cases/dataset/plan/executor and production source remain untouched.

After root confirms the final first-run report is stable, bind the audit to its SHA256 and extract every definitive result's original selected IDs, URLs and exact retained excerpts. Allocate unique original URLs to four disjoint groups, preserving all per-case occurrence bindings. No selected reference may be replaced by an unselected source, a curator ground-truth reference, an alternate URL or a retry. The full80factual-case denominator and20controls remain separate; abstentions and other misses never disappear because their outcomes have no selected citations.

Reviewers will make one bounded public request sequence per exact selected URL: at most8redirects,15-second total deadline including redirects/body reading and3MB retained body perURL. Record actual fetch attempts, proposed/followed redirects, status, finalURL, time, byte counts, truncation, body/text/proof hashes and access limitations. Transport failures before response have unknown origin receipt; a fetch invocation must not be described as proven remote receipt. No Exa/Jev/provider requests. Source bodies stay outside Git.

Every selected occurrence requires actual agent inspection of both original retained excerpt and accessible source content. Check the complete proposition's entity, relation, asserted or incompatible alternative value, date/event-role, place/population, quantity/ordinal, negation and conditions. A missing material premise in the retained excerpt cannot be silently supplied by an unretained heading. Contradiction needs matching-scope contrary evidence rather than absent support. An error/bot/SSO/app shell, withheld paywall text or truncation before needed content remains unverified despiteHTTP200 or a prestigious domain. PDF/non-JavaScript fallback extraction is permitted offline from the exact saved response and must be disclosed and hashed.

Keep source provenance separate from content verification: same publisher, copied/paraphrased material, common underlying records and unresolved origins. Different domains do not authenticate independent evidence; official-looking hosts do not establish truth. Agent content inspection is not human review. The aggregate reviewer authored PartD and knows its labels; this is independent inspection of model-selected evidence, not blinded evaluation or independent authorship of every ground-truth label.

Report all-selected content verification across the original80facts, plus selected-reference occurrence counts and cases with at least one verified selected citation. These are distinct metrics. Root may report live verdict/admission/control results separately; this audit does not certify readiness, calibrate the model or claim causal improvement over earlier OPEN campaigns.

Prepared helpers: `fetch-selected.mjs`(Node syntaxchecked), `extract-text.py`(offlineHTML/PDF), `audit-integrity.py`(exactID/URL/excerpthash/selectedset binding) and six passing synthetic binding tests. The checker consumes agent semantic assessments; it does not mechanically establish truth or independence.

## Completed audit

The immutable first-run report SHA-256 is `e6cefc9877f271a231b4fd1834df0a9d6609a6dc7b03bed7846667b555a1111d`. All 100 inputs completed. The campaign's raw factual result remains **69/80 correct definitive labels, 10 abstentions and one clarification**, with no observed wrong definitive label or operational failure. Its 20 controls are separate from the factual denominator. Source inspection below does not change or replace those first outcomes.

The final audit is `citations/citation-audit.json`, SHA-256 `7edcee32de6c28961bbad128b5093d05305b593ea295cbba1eb889d4ebb919b5`. All **246 original selected occurrences across 69 definitive cases** were inspected, covering 245 unique original URLs. One selected NPS URL was shared by two mineral cases and was fetched once with both case-specific bindings preserved. Four disjoint groups completed the work: A evidence_filter, B source_policy, C jev_review, D exa_review. Each group checked both the exact retained excerpt and the retrieved source's material context. All original ID/URL/excerpt hashes, saved body/text hashes and proof hashes passed the aggregator's integrity checks.

| Content inspection metric | Result |
|---|---:|
| All original selected references inspected | 246/246 |
| Selected occurrences with matching substantive content and retained scope | 198/246 |
| Facts with every original selected reference content-verified | **31/80** |
| Definitive cases with every selected reference content-verified | 31/69 |
| Facts with at least one verified selected reference | 68/80 |
| Facts with at least two verified selected publisher/domain groups | 62/80 |
| Selected occurrences failing access/content retrieval | 41 |
| Accessible selected occurrences with incomplete material scope | 7 |

The last publisher/domain metric counts retained `sourceGroup` values among verified references. It is **not authenticated independence of underlying origins** and does not replace all-selected verification. The 11 nondefinitive factual cases remain in the original 80-case denominator. Pompeii (HA04) was the only definitive case with no independently verified selected reference: both selected scholarly URLs were inaccessible. That is an unverified selected-source result, not a newly observed wrong historical label.

The 31 cases receiving all-selected content credit are AD04, GB15, SC18, GB11, HA18, AD11, SC09, SC08, AD09, GB16, SC03, HA09, SC02, AD18, SC10, GB18, HA19, SC17, SC05, GB10, SC19, GB13, AD13, SC14, GB05, HA17, GB03, AD01, HA14, HA12 and AD16. The machine-readable audit retains every other definitive case and each unverified reference; no case or extra selected citation was discarded to improve the score.

### Access and content limits

The 245 original URLs produced 251 application GET attempts, including six followed redirects. There were zero retries, source substitutions or paid/provider calls. The readers retained **58,380,923 body bytes** and observed **58,388,826 bytes** before enforcing limits. Six transport attempts failed before any response; actual HTTP issuance and origin receipt for those attempts are unknown. The attempt counter must not be described as proven remote receipt of 251 requests.

Final URL responses were 209 HTTP 200, 19 HTTP 403, four HTTP 503, two HTTP 402, two HTTP 202, two HTTP 404 and one HTTP 526, plus the six no-response failures. A successful HTTP status did not automatically receive credit. Two PubChem pages returned browser checks, a FranceArchives page supplied a small script wrapper, and a HISTORY Tour-de-France URL redirected to a generic corporate landing page. These HTTP 200 responses did not provide the selected substantive content. A HowStuffWorks HTTP 202 WAF challenge also remained unverified.

Two PDF binaries reached the 3 MB cap. The ECHR brochure's saved portion could be decoded and contained the exact retained Strasbourg-seat paragraph with all material institution/location context. It received **relevant-content-only verification**, with `bodyTruncated=true`, `fullDocumentRetrieved=false` and explicit access limits. The audit does not claim its entire binary was retrieved or read. The Monet thesis PDF's saved portion could not be decoded sufficiently to inspect the selected passage; it remained unverified. No second download, backfill or replacement reference was attempted.

### Retained-scope limits

Seven accessible occurrences did not receive exact-scope credit:

- The Australian Museum quartz table gave hardness 7 but did not explicitly identify the Mohs scale or the mineral's defining calibration role. The actual table remains recorded as substantive partial evidence rather than silently supplying the missing scale premise.
- The retained HISTORY Titanic excerpt described April 14/15 events but omitted 1912. The fuller page's year was not backfilled into the model's retained evidence.
- Two Alhambra references identified Granada without explicitly giving Spain in the retained/source material inspected. Other selected Alhambra evidence did provide both city and country, but it did not replace these two partial references.
- The retained Java article described Sun's release of the first implementation but omitted the explicit development-at-Sun relation found elsewhere on the page. Release and development were kept distinct.
- A 2008 ECHR paper described establishment in Strasbourg in 1959 rather than explicitly establishing a continuing seat. Its historical founding-location statement was not silently upgraded to the checked present-tense location relation.
- A NASA children's Saturn page said scientists think the particles are icy snowballs or ice-covered rocks. The audit preserved its qualification and did not treat it as an explicit majority-composition measurement settling the claim's “mostly” qualifier.

These are disclosed limits of selected excerpts, not observed wrong labels. Alternative selected references often covered the same claim, but all-selected credit requires every originally selected reference to pass.

### Provenance and interpretation

This is agent inspection of selected content, not human review or a blind source audit. The aggregate reviewer authored Part D and knew those expected labels. Publisher identities, institutional hosts, article titles and model confidence were never used as factual authority by themselves. Explicit observations, named relations, alternative values, dates and qualifications in the actual source content supplied the credit.

Underlying provenance remains uncertain. Different publishers can reuse one underlying record or explanatory account. The silver materials explicitly disclosed a PubChem/CIAAW dependency, and other public educational or historical accounts may share origins. Publisher/domain grouping therefore does not prove independent corroboration. The audit grants no blanket reliability endorsement to a publication or to unrelated statements elsewhere on a source page.

The raw 69/80 correctness result demonstrates useful behavior on this new OPEN development cohort. The stricter 31/80 all-selected content verification measures a different remaining gap. Neither number is a population accuracy estimate, a causal improvement estimate, independent authentication of source origins or a readiness certification. The previous interrupted and 32-input campaigns remain separate and unchanged.
