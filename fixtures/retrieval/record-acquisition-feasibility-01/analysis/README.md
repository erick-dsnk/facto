# Independent acquisition material accounting

**0/4 declared families produced a retained excerpt that binds the registered canonical URL and entire audited unit exactly.** All four acquisitions returned; there was no operational failure. This is a literal material-feasibility result, not a factual accuracy, source-quality or readiness score. The original registry, units, quotes and capture remain unchanged.

Independent reconciliation verified all 21 capture-manifest files and nine unique predispatch/settlement journal pairs. It reproduced the exact approved search serialization, contents URL/options restrictions and all recorded body hashes/lengths:

| Measurement | Observed |
|---|---:|
| Search / contents / Jev | 4 / 5 / 0 |
| Actual HTTP boundary attempts | 9 |
| HTTP200 / fully drained / settled | 9 / 9 / 9 |
| Pending or unknown reservations | 0 |
| Request bytes | 6,426 |
| Observed / stored response bytes | 121,753 / 121,753 |
| Returned Exa cost / missing cost fields | $0.038 / 0 |
| Retained records | 17 |

The four component intervals were 1697/1408/2977/1521 ms. Five contents responses reported `source:cached`; they provide no uncached canonical-origin observation or current-version proof. The returned cost is provider-reported, not independently verified billing. Requested highlight `maxCharacters:4000` was not assumed to bound returned strings: six captured highlights exceeded 4000 codepoints, while every accepted response and retained excerpt stayed within the actual byte/quote bounds.

## Per-family material findings

| Family | Exact observed distinction | Primary |
|---|---|---:|
| RFC8174 | Registered `.txt` URL absent. The entire 953-character unit occurs at the unreviewed `/info/rfc8174/` URL in exactly three named raw fields. It is absent from all four retained excerpts. The exact contents-text interval proves the chosen 2000-character window begins 257 characters into that unit, losing its prefix. | Miss |
| Canadian Holidays Act | The returned official page is `section-2.html`, not registered `FullText.html`. It visibly includes both conditional subsections, but no captured raw/retained field equals or exactly contains the registered whole unit. Headings, markup, spacing and citation presentation differ; this is not classified as merely whitespace or an exact proper-subunit proof. | Miss |
| Pulitzer2021 Fiction | Registered canonical URL is retained, but its 2000-character window begins in author biography and includes finalists/navigation. The raw highlight's opening winning-work heading and `Winning Work` heading lie outside that window. The exact registered full unit is absent even from raw fields, so this is not a claim that window selection alone would restore binding. | Miss |
| ONS first rounded release | Registered first-release canonical URL absent. Returned material includes a release index, another government's publication and a later unrounded-release PDF. The retained latter window contains quality/related-link/citation material; it cannot substitute for the reviewed first rounded release. No exact registered full unit appears in captured raw or retained fields. | Miss |

The raw RFC occurrences are **only**:

- `attempt-01`, RFC `/info/rfc8174/`, `results[0].highlights[0]`.
- `attempt-02`, the same URL, `results[0].text`.
- `attempt-02`, the same URL, `results[0].highlights[0]`.

These family-level observations must not be copied onto every retained record. `results/reconciliation.json` attributes each occurrence to response/result URL/field/hash. For the same contents text, the registered unit occupies codepoints [3953,4906) and the retained quote [4210,6210); the missing unit interval is UTF-16 [0,257]. This is an exact same-field substring proof, without trimming or repairing the quote. The URL remains unreviewed for the installed receipt regardless of that loss.

No returned excerpt is an exact proper subunit of its registered unit or an intact larger quote containing the entire unit. No whole-excerpt difference was demonstrated to consist solely of whitespace edits. That does not establish that every missing match reflects missing semantics: different renderings, document versions, paths and selected windows must remain distinct. The analyzer never casefolds, Unicode-normalizes, stitches passages, changes unit definitions, accepts an unreviewed alias or awards near-match credit.

## Artifacts and checks

`results/analysis.json` is the first independent literal analysis; it ignores collector convenience matches. `results/reconciliation.json` adds actual request/journal accounting, result-level raw attribution and exact same-field window intervals. The first output was preserved while the interval addendum was prepared. `analyze.py` and `audit_capture.py` perform no transport operation. Their CLI accepts only the declared public capture and writes fresh result paths.

Fifteen offline tests cover exact whole-unit binding, canonical URL/alias rejection, intact larger quotes without trimming, UTF-16 missing-material arithmetic, diagnostic-only whitespace edits, case/Unicode changes, raw-versus-retained separation, no stitched highlights, all-four denominators, incomplete raw-body uncertainty, path/symlink rejection, registry/proof pins and unambiguous exact interval attribution. All pass. `check.py` also rebuilds analysis in a temporary output and requires byte-identical results without changing the original capture or first analysis output.

Original report SHA256: `29f0d47264ff863bfc05fad22c9c0fc8467cb0611fcbdc145253171a02521502`; capture manifest SHA256: `2dfce1983136220ff877ecff2fa7cce0845023aa5b43fb16f1baf4c4f2914c4c`. The plan and collector04 are pinned in code and match the one-run authorization. There were zero new network/model/provider calls by this analysis worker.
