# Screen-photo OCR development experiment

This experiment evaluates the nine supplied 1536 × 2048 glasses photos on Linux. It is an offline prototype under `tools/ocr_experiment`; the iPhone application and server runtime are unchanged. Original photos, processed images, OCR transcripts and local reports are kept under ignored `artifacts/ocr-experiment/` because the browser rails include private account information.

## What is already in main

At main `b3dd415`, `apps/ios/GlassesLab/Capture/OCRService.swift` already performs accurate Apple Vision recognition on the full photo, detects a text-containing display rectangle, perspective-corrects it and reruns recognition on that display. It falls back to the original image when no useful crop is obtained. It uses language correction and a 0.4 confidence threshold. `ScreenDetector.swift` scores proposed rectangles by held text area and prefers a smaller rectangle retaining at least 90% of the best text score. There is no inner article/post/paragraph selection at this stage. Thus a raw-photo experiment alone does not reproduce the current code path.

Apple Vision cannot run in this Linux environment. RapidOCR is a reproducible surrogate; there is no evidence here that it performs equally to Apple Vision, and RapidOCR confidence is not calibrated to Apple's confidence. OpenCV contour proposals are also a substitute for Vision rectangle proposals, not a faithful native detector reproduction. See [Apple's text-recognition documentation](https://developer.apple.com/documentation/vision/recognizing-text-in-images) and [region-of-interest API](https://developer.apple.com/documentation/vision/imageprocessingrequest/regionofinterest).

## Fixed recognition and ablations

The final run uses `rapidocr-onnxruntime==1.2.3`, its bundled PP-OCRv3 detector and mobile orientation classifier, and an English PP-OCRv3 recognizer from the [official RapidAI model directory](https://huggingface.co/spaces/RapidAI/RapidOCR/tree/main/models/text_rec). The dictionary is from [PaddleOCR release/2.6](https://github.com/PaddlePaddle/PaddleOCR/blob/release/2.6/ppocr/utils/en_dict.txt). Model download hashes are enforced by `download_models.py`; output `provenance.json` records every model hash, package version, script hash, ground-truth hash and settings. Each sample records the original file hash and dimensions. The recognizer uses the same model, detector settings, orientation classifier and confidence cutoff in every variant. The detector is limited to a 1536-pixel longest side, cutoff is 0.4, and the shortcut that treats wide images as a single text line is disabled globally. CPU sessions use two intra-operation threads and one inter-operation thread.

The paired variants are:

1. **Raw:** recognize the original full photograph.
2. **Screen:** propose quadrilaterals from image edges and bright low-saturation surfaces, score them by recognized text, apply the existing native selection idea (text area, minimum two lines, tighter crop within 90%), perspective-correct the chosen quad, and recognize the full crop. Fall back to the full image. This is the current-like surrogate baseline.
3. **Upscale:** screen crop, bicubic scaling up to 2× within the detector's 1536-pixel input bound.
4. **Gray:** same upscale with grayscale.
5. **Contrast:** same upscale with grayscale and conservative CLAHE (clip limit 1.5).
6. **Sharpen:** contrast variant plus conservative unsharp masking (1.4 original − 0.4 Gaussian, sigma 1).
7. **Selected:** select a target automatically from screen OCR geometry/pixels, crop with an eight-pixel margin, upscale up to 3× within the same detector limit and recognize again. The final output is the reread, with the initial selected transcript retained for diagnosis.
8. **Oracle:** crop the manually annotated intended target and recognize with the same engine. This is a diagnostic manual-crop condition (not a mathematical accuracy upper bound), never a production selector and never included as automatic success.

The selector never accesses manual labels or filenames. It prioritizes a thin connected blue text-selection band over ordinary page content. A large red breaking-news card is presented as an ambiguous candidate. X post structure uses the post heading, author handle and right-rail boundary to isolate the primary post body and stop before media/timestamps/replies. Otherwise, aligned lines with similar letter heights form bounded groups and the prominent heading is selected. A collapsed post containing `View more` or an ellipsis is marked truncated. Ambiguous, truncated or missing targets have an empty `fact_check_text`; their visible candidate transcript is preserved for review. This experimental code cannot infer the wearer's intended paragraph from gaze and must not silently treat the dominant headline as proven intent.

Crop/contrast/sharpen operations are deterministic pixel transforms. No generative image editing, text reconstruction, super-resolution or language-model completion is used. Enhancement is a fixed ablation rather than an oracle choosing whichever variant scores best on each image. Tesseract's [image-quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) explains why skew, noise, scaling and thresholding must be assessed separately rather than assuming every enhancement helps.

## Evaluation rules

`ground_truth.json` contains manual visible-text transcriptions and normalized target boxes, audited on the original images by a separate agent. Labels include primary target, secondary paragraph where applicable, ambiguity and visible truncation. The selected paragraph in image 5 is the intended target; its article heading is context only. The two homepage photos are correlated views of the same page, with inherently uncertain intent. Image 9 ends at visible `Dea... View more`; it is never expanded into an unseen claim.

Scoring normalizes Unicode/case/whitespace and punctuation, retaining letters/numbers/apostrophes. Emoji and punctuation fidelity are therefore outside the lexical metrics. Character error rate (CER) and word error rate (WER) are Levenshtein distance divided by reference length; both can exceed 100% when output includes insertions. The final raw boxes and transcripts retain original punctuation for manual inspection.

- **Target token recall:** multiset intersection of expected and output tokens divided by expected tokens. It is capped at 100%; repeated matches do not earn extra credit. A full-screen output can match generic target words by accident, so this alone is insufficient.
- **Target-region CER/WER:** map detected line boxes back to original coordinates, retain lines whose centers fall inside the annotated primary target, then score their transcript. This assesses text recognition separately from unrelated output. Lines that span multiple regions remain an approximation.
- **Spatial clutter fraction:** fraction of output tokens whose line centers fall outside the annotated intended target. It measures unwanted text from browser chrome, navigation, other stories, keyboard, and surrounding paragraphs. Unannotated context is intentionally counted as non-target. This is distinct from **nonmatching token fraction**, which also counts OCR errors and should not be described as pure clutter.
- **Selected-output CER/WER:** score the entire automatic candidate transcript against the expected target, penalizing any extra content. Ambiguous/truncated candidates are measured for diagnostic reading quality but are withheld from automatic fact checking.

Results are macro-averages across nine images unless stated otherwise; aggregate token totals and OCR wall times are also stored. Timings are local CPU wall time per recognition pass; selection relies on raw and screen passes, so the selected-pass time alone is not end-to-end latency. Neither local CPU timing nor this study proves iPhone performance. Boxes/confidences and individual stage times are in each `result.json`.

## Iteration history and limits

- Iteration 1 ran all nine photos with the bundled Chinese recognition model. English words frequently fused, a blue video panel was mistaken for a selection, and permissive grouping absorbed subtitles and adjacent stories. These are saved failures, not final baseline numbers.
- The original manual boxes also contained coordinate mistakes. Independent visual review corrected them against original image dimensions before the final comparison. Earlier oracle metrics using those boxes are invalid and are not used as evidence of OCR quality.
- Iteration 2 used the official English recognizer and corrected labels. Its first two samples exposed a RapidOCR default that bypassed detection for a wide crop, incorrectly feeding a multi-line heading to a single-line recognizer. The run was stopped. The shortcut is disabled globally in the final run.
- Iteration 3 freezes the English model and refined selector and reruns every paired variant on all nine originals. The selection rules were developed against these images. Results are development-set evidence, not a held-out benchmark. There are only article/homepage/X examples, including near-duplicates, and no TV/forum/non-English/rotated-display/blur/multiple-screen validation set.

## Reproduce locally

Use a separate virtual environment; do not add these dependencies to the app package manifest.

```bash
python3 -m venv .venv-ocr
.venv-ocr/bin/pip install -r tools/ocr_experiment/requirements.txt
mkdir -p artifacts/ocr-experiment/models
.venv-ocr/bin/python tools/ocr_experiment/download_models.py --output artifacts/ocr-experiment/models
.venv-ocr/bin/python -m unittest discover -s tools/ocr_experiment -v
.venv-ocr/bin/python tools/ocr_experiment/run.py \
  --images "$ORIGINAL_PHOTOS_DIR" \
  --ground-truth tools/ocr_experiment/ground_truth.json \
  --rec-model artifacts/ocr-experiment/models/en_PP-OCRv3_rec_infer.onnx \
  --rec-keys artifacts/ocr-experiment/models/en_dict.txt \
  --output artifacts/ocr-experiment/reproduction
```

Set `ORIGINAL_PHOTOS_DIR` to the directory containing the nine original JPEGs, or replace it with that directory's path. `download_models.py` writes the two recognition files into the directory passed to `--output`; keep those files out of version control.

Output includes `provenance.json`, `ground-truth.json`, `results.json`, `summary.json`, and per-photo `result.json`, screen/variant/target/oracle PNGs and a selection overlay. The runner refuses to reuse cached outputs when code/model/labels or original image hashes differ; use a new directory or explicit `--force`. The output directory creates a `.gitignore` to keep images/transcripts local. Keep the original supplied filenames or supply a corresponding manifest. Do not publish the original photos or full OCR transcripts with private browser/account text.

The final measured run also preserves its executed runner as `script.py`, whose SHA-256 matches `provenance.json`. Cache-reuse guards were added to the repository runner after that run; independent review confirmed that this diff changes no OCR, selector or metric behavior. The provenance ground-truth hash refers to the source JSON bytes. The saved `ground-truth.json` is reserialized with different formatting but was verified to contain identical parsed labels.

## Final measured results

| Variant | Mean target token recall | Mean target CER | Mean target WER |
|---|---:|---:|---:|
| raw | 94.7% | 0.5% | 5.3% |
| screen | 94.7% | 0.5% | 5.3% |
| upscale | 93.0% | 0.7% | 7.0% |
| gray | 88.4% | 2.7% | 11.6% |
| contrast | 83.9% | 5.6% | 16.1% |
| sharpen | 84.5% | 5.2% | 15.5% |
| selected_existing | 94.7% | 0.5% | 5.3% |
| selected_reread | 83.9% | 1.5% | 16.1% |
| oracle | 90.6% | 2.3% | 10.5% |

For raw/screen/image ablations these columns score the annotated target region. For selection-only/reread/oracle they score the entire candidate transcript, so added clutter is penalized. The selection-only variant reuses existing recognized lines; it adds no OCR pass. All-nine candidate quality includes the two ambiguous homepage candidates and the truncated post, whose text is withheld from automatic fact checking.

| Image | Automatic decision | Raw target excerpt | Selected reread excerpt | Raw target CER | Selected CER |
|---|---|---|---|---:|---:|
| 01 | heading; selected | Key questions still unanswered as air travel / slowly gets on track | Key questions still unanswered as air travel / slowly gets on track | 0.0% | 0.0% |
| 02 | heading; selected | Additional delays and / cancellations expected in New / York this weekend, governor says | Additional delays and / cancellations expected in New / York this weekend, governor says | 0.0% | 0.0% |
| 03 | heading; selected | Us floated idea of Ukraine swapping land for / NATO membership,Zelensky says | Us floated idea of Ukraine swapping land for / NATO membership,Zelensky says | 0.0% | 0.0% |
| 04 | heading; selected | Iran war live:Israel vows Gaza / 'offensive policy' despite / caretaker status | Iran warlive:Israelvows Gaza / 'offensive policy'despite / caretakerstatus | 0.0% | 5.6% |
| 05 | highlight; selected | At least one Palestinian has been killed and two others wounded / nfter Isracli forces carried out a drone strike on the al-Mawasi / rea of Khan Younis in southern Gaza, just days after Israel / fatally struck a hospital in Gaza | At least one Palestinian has been killed and two others wounded / nfter Israeli forces carried out a drone strike on the al-Mawasi / area of Khan Younis in southern Gaza,just days after Israel / fatally struck a hospital in Gaza | 1.4% | 0.5% |
| 06 | dominant_card; ambiguous | One killed as Israel vows Gaza / 'offensive policy'despite / caretaker status | One killed as lsrael vows Gaza / 'offensive policy'despite / caretaker status | 1.4% | 2.8% |
| 07 | dominant_card; ambiguous | One killed as Israel vows Gaza / 'offensive policy'despite / caretaker status | One killed as Israel vows Gaza / 'offensive policy'despite / caretaker status | 1.4% | 1.4% |
| 08 | post; selected | BREAKING: Iran attack with balistic missile on USA.Heavy Damage / Reported in the USA! / How will US react now* / @grok is it a confirmed news? | BREAKING:Iran attack with balistic missile on USA.Heavy Damage / Reported intheUSA! / AHowwill US react now* / @grok is it a confirmed news? | 0.8% | 3.8% |
| 09 | post; truncated | Big News / Confirmed By Government / President Putin is official Dea... View more | Big News / * / Confirmed By Government / President Putin is official Dea...View more | 0.0% | 0.0% |

The measured result supports **layout selection before fact checking**, with the existing recognized lines retained as the default. The English surrogate already recognized these large headlines well. Additional grayscale/contrast/sharpening damaged some text; cropping and rerecognizing also introduced spacing errors, including image 4 (`war live` → `warlive`) and image 8. The highlighted paragraph in image 5 did improve from 1.35% CER to 0.45% after a focused reread, but that is not a consistent overall gain.

On all nine candidate outputs, selection without rereading kept target CER **0.54%** and WER **5.32%**, while reducing mean spatial clutter from **89.59% raw / 89.97% current-like screen** to **0%**. Full raw output contained **1,632 normalized tokens**, full screen output **1,658**, and the selected existing lines **143**. This is measured against the annotated target geometry, not a claim that every one of those 143 tokens is correct. Candidate crop+reread contained **136 tokens** and increased CER to **1.55%**, WER to **16.08%**. Word spacing errors can cause a small character change but several word errors. Target recall inside the raw/screen target boxes was **94.68%**; full-page multiset target recall was **95.13%**, slightly inflated by generic matching words elsewhere on the page.

The selector accepted six candidates (01–05 and 08), flagged two homepages for clarification (06–07), and flagged the collapsed post as truncated (09). On the six accepted candidates, selection-only CER was **0.35%** and WER **1.92%**; crop+reread CER was **1.63%** and WER **16.54%**. This is not a blind target-selection accuracy result: heading/paragraph intent is an evaluation assumption except for the visible highlight, and these rules were refined on these very photos. A separate visual review inspected every final `target.png` and `selection.png` and confirmed that each crop contains its labeled intended candidate without unrelated story text. Yellow alternative boxes in overlays are diagnostic candidates, not additional selected text.

Smaller secondary paragraphs show why the existing screen-crop path still matters. These scores use manually annotated secondary regions and do not demonstrate automatic paragraph intent selection:

| Secondary target | Raw CER / WER | Screen CER / WER | Screen + upscale CER / WER |
|---|---:|---:|---:|
| 02: visible CNN body excerpt | 33.7% / 37.9% | 0.0% / 0.0% | 0.0% / 0.0% |
| 03: first CNN body paragraph | 0.0% / 0.0% | 0.0% / 0.0% | 0.0% / 0.0% |
| 04: first live-update paragraph | 3.2% / 22.5% | 1.4% / 10.0% | 0.9% / 7.5% |

The surrogate detected/cropped a screen on 01, 02, 03, 04 and 07; it fell back to the original on 05, 06, 08 and 09. This is an OpenCV detector limitation, not evidence that native Vision would fail on those images. Recognition wall time summed over nine images was **28.27 seconds raw**, **29.82 seconds screen**, **34.32 seconds upscale**, **35.81 seconds grayscale**, **30.99 seconds contrast**, **30.49 seconds sharpening**, **5.54 seconds selected crop reread**, and **5.22 seconds oracle**. The small-crop figures are additional passes after initial detection/recognition, not total pipeline latency.

A native follow-up should reuse `OCRResult.observations` to keep line boxes through grouping, prioritize a visible selection and explicit spoken intent, select one article/post block before the chunker, and return clarification or a visible-truncation state rather than feeding unrelated stories or a completed hidden claim downstream. Keep ordinary image pixels for the initial pass; add a bounded crop reread only when native measurements justify it. Compare these exact image hashes on the iPhone's actual Vision recognizer before adopting thresholds or claiming recognition gains. Include held-out X/forum/TV/dark-mode/non-English/blurred/rotated/multiple-display examples and measure native latency and downstream selected claim quality.

Validation: **10 focused unit tests pass**, covering metric insertion/repetition penalties, Unicode/truncation normalization, perspective-coordinate round trips, column separation, headline/subtitle grouping, empty abstention, blue-video rejection, explicit highlight priority, homepage ambiguity and collapsed-post truncation. Final observed outputs and provenance are at `artifacts/ocr-experiment/iteration-3-english/`; The analysis step writes `manifest.json` and `manifest.sha256` covering all original image hashes. `selection-only.json` stores the derived zero-extra-OCR ablation and accepted/ambiguous/truncated subsets. Run the additional report derivation with:

```bash
/tmp/junction-ocr-venv/bin/python tools/ocr_experiment/analyze.py artifacts/ocr-experiment/reproduction
```
