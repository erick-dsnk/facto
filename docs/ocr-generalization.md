# Generalized photographed-text target selection

The production change preserves original OCR observations and adds an image-aware selector before claim submission. It is configurable with an OpenAI-compatible vision endpoint and can ask the wearer to choose between distinct content items. The experiment harness keeps the previous site-specific experiment frozen for comparison.

## Source-preserving experiment

`tools/ocr_experiment/generalized.py` and `generalized_run.py` implement a separate runner. Inference receives only the photo, exact OCR observations with immutable IDs and original-frame polygons, and optional wearer intent. Evaluation annotations are accessed only after inference returns. No filename/site/template/ground-truth branches drive inference.

Raw observations have deterministic `L` IDs. Supplemental screen-crop OCR is transformed back into original coordinates and receives `S` IDs. Overlapping rereads remain separate alternatives linked to the original IDs. A bad crop cannot delete original observations, and an alternate reading never silently replaces a number or name. The `--all-views` evaluation flag sends every original and mapped crop observation, including overlaps, matching the native evidence shape. Without that flag, overlapping alternatives are retained in artifacts while only spatially missing crop lines supplement the original selector input. These input modes must be distinguished when comparing runs.

Local geometry proposes blocks using relative spacing, overlap, alignment and text height, allowing perspective-induced bounding-box overlap. It retains every observation regardless of image-edge position. Color cues do not restrict hue: repeated narrow bands distinct from neighboring background can suggest selected text. Uniform colored page surfaces and large colored cards are not accepted merely because they are saturated. Geometry is a fallback proposal mechanism, not proof of semantic content roles; automatic acceptance requires explicit intent or the narrow selection cue. Other candidates require confirmation.

The production vision adapter sees the original photo and optional intent. It proposes an inventory of visible content items using a short quote as a locator. The backend matches each quote to a unique spatially contiguous span of immutable OCR lines; only those original lines become the public candidate or claim. Generated quotes never become submitted transcription. Matching normalizes case, punctuation and whitespace and allows narrowly defined OCR `i`/`l` confusion; it does not use edit-distance correction or repair numbers/negations. Unmatched or ambiguous items remain a reason to require confirmation, even when one other item matches.

The public contract supports separate context IDs; the compact production-provider contract currently leaves them empty. Attribution inside the claim, such as “Zelensky says,” remains part of the selected source lines. Unknown/duplicate IDs and invalid statuses are rejected at the public boundary. Visible truncation withholds automatic fact checking. A bounded region reread can be retained as an alternate transcript; critical token differences are reported without synthesizing a corrected claim. The separate experimental `--mode multimodal` adapter retains the earlier source-ID-selection protocol and is not the final production model protocol.

The official live evaluation path is `--mode production`: each photo goes through the actual authenticated TypeScript `/v1/sessions/:sessionId/ocr/select-target` route via its evaluation bridge. `--mode multimodal` is a separate configurable experimental adapter, and its evidence must not be confused with production-route validation.

## Application setup

The iPhone defaults to local OCR and conservative local target proposals. To enable image-aware selection, configure the backend's `OCR_VISION_BASE_URL` (an OpenAI-compatible API root including `/v1`) and `OCR_VISION_MODEL`, plus `OCR_VISION_API_KEY` if the provider requires it. `OCR_VISION_TIMEOUT_MS` defaults to 12000 and `OCR_VISION_MAX_TOKENS` to 1200. The endpoint must support the structured JSON-schema response format used by the adapter. Start the application backend with the repository's normal session/join-code configuration (`npm run dev` or `npm start`). The fact-checking provider configuration remains separate.

In the iPhone connection settings, enable **Understand photo layout on server** and save the connection. This explicit opt-in sends an upright JPEG and OCR observations to the authenticated backend. The app bounds the image to a 2560-pixel maximum edge and 4 MB; the original full-photo OCR observations are retained locally and sent alongside the prepared image for source alignment. The configured vision provider receives the photo and optional intent. The app's backend URL must be reachable from the phone. A provider URL such as `http://127.0.0.1:8094/v1` refers to the machine running the backend; it is not the address to enter as the iPhone backend URL. For a LAN setup, expose the application backend on its LAN interface and enter that machine's reachable backend address on the phone.

The photo action accepts an optional **Headline or topic to check** hint. When multiple items remain, the app presents candidate text buttons for the same captured photo; choosing one reuses retained OCR evidence without taking or uploading another photo. A new capture or stop clears the pending choices. Truncated or unvalidated text is withheld from submission. Spoken intent capture is not wired to this hint field.

Native changes and XCTest cases are present in source, but this Linux environment has no Swift compiler, Xcode, simulator, or iPhone. The native application has not been compiled or exercised on a device here. Python regression results use the Linux OCR surrogate, and TypeScript tests cover the backend boundary; neither proves the Apple Vision/device path.

## Reproduce

Use the isolated `.venv-ocr` environment and frozen English PP-OCRv3 models from the original experiment; no application dependencies are introduced. Historical full-frame and screen OCR can be reused after original-image hashes are verified, keeping recognition fixed while comparing selection. Run outputs contain the executed source snapshots, script/model hashes, model name, package versions, exact IDs/text, supplemental observations, model failures and stage timings. Outputs and private photos remain Git-ignored. The photos are user-provided inputs and are not included in this repository.

```bash
.venv-ocr/bin/python -m unittest discover -s tools/ocr_experiment -v
.venv-ocr/bin/python tools/ocr_experiment/generalized_run.py \
  --images-dir "$ORIGINAL_PHOTOS_DIR" \
  --reddit-images-dir "$REDDIT_PHOTOS_DIR" \
  --reuse-raw --reread --mode local \
  --output artifacts/ocr-experiment/generalized/local-reproduction
OCR_VISION_BASE_URL=http://127.0.0.1:PORT/v1 \
OCR_VISION_MODEL=MODEL \
OCR_VISION_TIMEOUT_MS=12000 \
.venv-ocr/bin/python tools/ocr_experiment/generalized_run.py \
  --images-dir "$ORIGINAL_PHOTOS_DIR" \
  --reddit-images-dir "$REDDIT_PHOTOS_DIR" \
  --reuse-raw --all-views --mode production \
  --output artifacts/ocr-experiment/generalized/production-reproduction
```

Set `ORIGINAL_PHOTOS_DIR` to the folder containing the nine source photos and `REDDIT_PHOTOS_DIR` to the folder containing the two Reddit photos. The runner checks those files against the frozen baseline hashes. Cached OCR directories default to this checkout's ignored `artifacts/ocr-experiment/iteration-3-english` and `artifacts/ocr-experiment/reddit-unseen`; if you stored those caches elsewhere, pass `--baseline-dir PATH` and `--reddit-baseline-dir PATH`. The script locates repository metadata and backend source files relative to itself, so it can be launched from any working directory.

Direct experimental OpenAI-compatible configuration uses `OCR_SELECTOR_BASE_URL`, `OCR_SELECTOR_MODEL` and optional `OCR_SELECTOR_API_KEY`; the `OCR_VISION_*` names are aliases. `OCR_SELECTOR_COMPACT=1` retains all observations in a concise table for constrained local models. Keys are read only from the environment and never written to provenance.

The measured local Qwen3 runtime used Qwen3-VL-2B-Instruct Q4_K_M plus a Q8 projector, llama.cpp build 12387 (`a956a852c`), one parallel slot, 8192-token context, and 1024 maximum image tokens; minimum image tokens were unset. It exposed an OpenAI-compatible endpoint at `http://127.0.0.1:8094/v1` under model alias `qwen3-vl-2b-q4`. Runtime files and launch scripts were kept outside the repository on the development machine and are not required by the production route. The runtime warned that 1024 minimum image tokens are recommended for coordinate grounding. This is the measured development setup, not an asserted model-quality recommendation.

## Evaluation limits

All eleven existing photos are now regression examples. They cannot demonstrate blind generalization. The same laptop/capture setup and near-duplicate views further limit independence. RapidOCR is the original fixed Linux surrogate, not established accuracy-equivalent to Apple Vision. The historical OCR experiment used the unprepared originals as inputs; it does not evaluate the new 2560-pixel/4 MB iPhone transfer preparation. Cached OCR timings are historical local CPU stage times; their sum includes both full-frame and supplemental screen recognition when reporting end-to-end stage cost. They are not measured iPhone latency.

Report acceptance coverage alongside accepted-text CER/WER and status behavior. For a multi-story feed, `needs_target` with distinct complete candidates is appropriate; an empty result or a menu candidate is a failure. The report's best-candidate diagnostic uses evaluation labels to identify the closest *returned* candidate after inference; it is an oracle diagnostic, never inference or automatic target accuracy. Character/word normalization follows the original experiment and omits punctuation/emoji fidelity. Per-photo source transcripts retain exact strings.

32 focused experiment tests cover source-ID integrity, generated-transcript rejection, context separation, reading-order canonicalization, same-column peer candidates, image-edge content, translated/scaled geometry, perspective overlap, explicit intent, crop-only missing-line recovery, complete overlapping-view preservation, critical reread disagreement, bounded regions, false color highlights, ordinary `read more` language, and portable runner argument handling. Ten are frozen-baseline checks; twenty-two exercise the new harness. Production-route tests and native build evidence are reported separately.

## Measured results

The preserved-view local fallback run is saved at `artifacts/ocr-experiment/generalized/local-preserved-v2/`. It accepted **1/11 photos** (the highlighted paragraph), with accepted text **1.35% CER / 7.5% WER**. The other ten requested target confirmation. Its mean proposal/selection computation was **9.2 ms** after historical OCR. It matched the annotated expected selected/ambiguous/incomplete status on only **4/11**, and the oracle best-returned-candidate diagnostic CER was **32.1%**. Some headline groups remain incomplete or competing furniture ranks above them. This is a low-coverage local fallback, not successful generalization.

The first live production-route development run is saved at `artifacts/ocr-experiment/generalized/production-qwen2vl-2b-v1/`. It used local **Qwen2-VL-2B-Instruct Q4_K_M** with its Q8 vision projector, llama.cpp b12387, an **8192-token context**, a **1024-token image limit**, and JSON-object output with a 1200-token cap. All original observations fit the measured context budgets (1089–3127 text tokens, plus image/output/template overhead). The actual authenticated route returned `unavailable / selection_provider_error` on **11/11**; therefore **0/11** automatic claims were accepted. Mean bridge+selection time was **8.76 seconds**, with no assertion that the semantic model generalized successfully. Failures safely fell back to confirmation candidates.

Raw response diagnostics showed the old 2B model enumerating nonexistent OCR IDs until its output limit, rather than selecting content. A schema-constrained diagnostic on photo 01 removed out-of-enum IDs but still enumerated many real IDs, repeated competing candidates, and exhausted the output limit. That is a model-selection failure, not a recognizer failure, and is retained in ignored diagnostics. Strict validation correctly rejected both outputs.

Qwen3 ID-selection diagnostics also produced valid IDs for navigation rather than the target. The final production adapter therefore uses the image-first quote-locator approach described above. A development run at `artifacts/ocr-experiment/generalized/production-qwen3vl-final/` sent originals plus spatially missing crop lines and accepted 5/11. It returned three real Reddit-feed candidates. That run does not match the native all-view input shape and must not be used as evidence of native candidate coverage.

The final fixed-configuration run is `artifacts/ocr-experiment/generalized/production-qwen3vl-final-v3/`. It uses **all original and all mapped crop observations**, including overlapping/contradictory rereads (39–206 observations per photo), the actual authenticated production route, the default **12000 ms deadline**, and a **1200-token response cap**. Exact executed backend-source SHA256: `c92a41f9a1fd74faec77bd231111fa64df5f8521974cab2bb7ca1a7337b669fe`. Runner, bridge, backend source snapshots, model/runtime hashes, per-photo JSON, selected/candidate transcripts and overlays are retained in that ignored directory.

This final run accepted **5/11 photos (45.5% coverage)** and requested target confirmation for **6/11**. There were **no provider errors or timeouts**. Mean measured API selection time was **1.79 seconds**; mean bridge-plus-selection wall time was **2.60 seconds**. Historical full-frame and screen OCR are additional stages and are not included in those selection-only means. The five accepted transcripts scored **2.15% normalized CER / 2.00% WER** against their annotated intended targets. Four accepted article headlines had 0% normalized CER; the Reddit post's claim was retained but its separate `Reuters` suffix was omitted, producing 10.77% CER for that sample. Punctuation/case differences are normalized out of these scores.

| Photo | Intended behavior | Actual API decision | Returned candidates | Selected target CER | API seconds |
|---|---|---|---:|---:|---:|
| 01 | Select article headline | selected | 1 | 0% | 0.833 |
| 02 | Select article headline | selected | 1 | 0% | 0.817 |
| 03 | Select attributed article headline | selected | 1 | 0% | 0.953 |
| 04 | Select article headline | selected | 1 | 0% | 0.995 |
| 05 | Select highlighted paragraph | needs_target | 1 | withheld | 2.418 |
| 06 | Ask between homepage stories | needs_target | 6 | withheld | 3.766 |
| 07 | Ask between homepage stories | needs_target | 7 | withheld | 3.675 |
| 08 | Select original X post | needs_target | 1 | withheld | 1.597 |
| 09 | Mark collapsed post incomplete | needs_target | 2 | withheld | 1.829 |
| 10 | Select open Reddit post title | selected | 1 | 10.77% | 0.758 |
| 11 | Ask between Reddit feed posts | needs_target | 3 | withheld | 2.076 |

Status alone matched the annotation on **8/11**, but that overstates practical selection quality. Photo 05 returned the article headline rather than the highlighted paragraph. Photo 08 returned a reply instead of the original claim. Photo 09 returned short surrounding fragments instead of the truncated target; the native picker also checks visible truncation before submission, but the correct result would have been `incomplete`. Photo 11 returned three distinct feed items (router, Texas Senate, South Sudan), while the Detroit item failed source alignment. This is useful but partial candidate coverage. The final oracle best-returned-candidate diagnostic CER was **21.91%**, versus 16.79% in the reduced-view development run. Neither number measures automatic target-selection accuracy.

The intervening all-view run `production-qwen3vl-final-v2/` exposed an implementation inconsistency: the locator accepted the existing `i`/`l` OCR equivalence while duplicate-view coalescing compared a stricter spelling. Equivalent mapped observations such as `aviation`/`avlation` were then rejected as competing readings. Using the same existing canonical form in both places restored the three Reddit-feed candidates in v3. This changed source alignment, with the image prompt, model, runtime, inputs, timeout, and token budget fixed; v2 remains preserved. Genuine competing numeric/negation readings and unmatched quotes continue to be withheld.

The full-frame OCR target-region diagnostic over all eleven photos was **2.40% CER / 7.99% WER**, using annotated regions to isolate recognition after the fact. That annotation-assisted number is not the performance of a deployed automatic selector. Source preservation, guarded reconstruction, same-photo choice handling, and the integrated route are implemented; this small local model still misses important content on several regression layouts. These results do not establish generalized or unseen-layout reliability.

Final validation: **32 Python experiment tests passed**. The repository gate passed lint, TypeScript checking, and **821 tests in 43 files** using one Vitest worker to fit local memory. Native XCTest cases remain authored but unexecuted for the Linux/Xcode reason above. The run's source snapshots and exact transcripts permit further model/provider comparisons without changing OCR or using annotations during inference.
