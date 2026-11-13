# Make Blueprints Talk (Stoa): challenge intelligence

**Summary**
- Build a program that answers natural-language questions about real construction drawings and BIM (IFC) models, accurately **and verifiably**. It should show where in the drawing each answer came from, so a human can check it in seconds (CHALLENGES.md:L1571, L1575).
- The four criteria are weighted equally at 25% each: accuracy, visualised reasoning for verification, creativity and **low inference cost** (CHALLENGES.md:L1607-1610). Prizes are €1000 plus a work trial at Stoa, €750 and €250 (CHALLENGES.md:L1614-1624).
- Stoa provides a large dataset: about 14,000 drawings (PDF, DWG, DXF, IFC, SVG, PNG and JPEG scans) in about 30 languages, with about 120,000 quantity-takeoff questions **with answers**. The scoring rule is that counts must be exact and areas, lengths and volumes must be within 2% (dataset README). This is pure software with no physical hardware, and it fits our ML, CV and agent skills well.
- The core difficulty is real. Frontier VLMs are still weak at symbol counting, such as doors and windows (AECV-Bench, arXiv 2601.04819). Stoa explicitly wants hybrid approaches that "next year's frontier models won't make obsolete" (CHALLENGES.md:L1577). We do not know how accuracy will be measured at judging (hidden test set or not).

Sources opened: CHALLENGES.md:L1561-1628; the preview dataset zip (downloaded and inspected: README.md, questions.jsonl, per-source LICENSE.md); https://stoabuild.com/ ; https://huggingface.co/datasets/sylvainhellin/ifc-bench ; https://arxiv.org/abs/2601.04819v1 ; https://github.com/CubiCasa/CubiCasa5k . The official challenge page https://hackjunction.app/participate/45/challenges/335 returned only "Junction Platform" (JS-rendered) when fetched. The jury PDF (docs/00-Jury-profiles-and-pitch-guide.pdf) does not mention Stoa, construction, drawings or BIM (searched with pdftotext).

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Make Blueprints Talk | CHALLENGES.md:L1563 |
| Sponsor | Stoa (Helsinki, "AI-native operating system for construction") | CHALLENGES.md:L1567, L1581 |
| Track | AI Infrastructure Track By Verda (Stoa's is the only challenge under this heading) | CHALLENGES.md:L1561 |
| Main requirement | "Build a program that answers natural language questions about construction drawings and building information models accurately and verifiably." | CHALLENGES.md:L1571 |
| Judging emphasis and weights | Accuracy of answers 25%; how well the solution visualises its reasoning so a human can verify the answer 25%; creativity 25%; low inference cost 25% | CHALLENGES.md:L1607-1610 |
| How accuracy is measured | **unknown**. The dataset README defines a scoring rule (counts exact; area, length and volume within 2%; text free-form). Whether judges run a hidden test set, live questions or our self-reported numbers is not stated | dataset README.md; CHALLENGES.md (silent) |
| How inference cost is measured | **unknown** (no unit, budget or measurement method stated) | CHALLENGES.md:L1610 |
| Prize | 1st: €1000 plus a work trial at Stoa; 2nd: €750; 3rd: €250 | CHALLENGES.md:L1614-1624 |
| Provided data | Preview, 0.5 GB: https://fwjydgxpttajiqpfmqtj.supabase.co/storage/v1/object/public/stoa-junction-2026/junction-dataset-preview.zip. Full dataset, 10 GB (HTTP content-length 9,768,952,082 bytes): https://fwjydgxpttajiqpfmqtj.supabase.co/storage/v1/object/public/stoa-junction-2026/junction-dataset.zip | CHALLENGES.md:L1595-1597; checked with curl |
| Dataset content (full) | "About 14,000 construction drawings (PDF, DWG, DXF, IFC, SVG, PNG and JPEG scans) from Europe and the US, in about 30 languages, with about 120,000 quantity-takeoff questions for roughly 40% of them." Question schema: `{"path","question","answer","unit","type"}`, where type is count, area, length, volume, text or other | dataset README.md |
| Dataset content (preview, measured by us) | 922 files (306 PNG, 374 JPG, 123 PDF, 66 DXF, 20 DWG, 14 IFC, 10 SVG). 7,990 questions on 320 files: 6,076 count, 1,599 area, 265 text, 34 volume, 16 length. By source: cubicasa5k 4,270, swiss_dwellings 2,358, ifc_models 1,049, ifc_bench 249, opening_design 64. habs, finna, europeana and wikimedia have **no** questions in the preview | our analysis of the preview zip |
| Sources inside the dataset | cubicasa5k (Finnish floor plans, CC BY-NC-SA), swiss_dwellings (PDF/DXF/PNG, CC BY), opening_design (US practice drawing sets and CAD), ifc_models, ifc_bench (IFC-Bench v2 questions), habs, finna, europeana, wikimedia | dataset README.md |
| Provided APIs / compute | None from Stoa. Track sponsor Verda offers free credits for every team and an NVIDIA Nemotron endpoint (via the separate Verda tech challenge) | CHALLENGES.md:L2179-2180 |
| Hardware | None | CHALLENGES.md:L1561-1628 (none mentioned) |
| Submission requirements | **unknown** beyond the judging criteria. No demo format, repo or test-harness requirement is stated | CHALLENGES.md:L1561-1628 |
| Licence constraints | Every file keeps its own licence. NC files (e.g. cubicasa5k) are non-commercial only, SA adaptations stay SA, ND files must stay unchanged. "Keep the credit when you show or share a drawing." | dataset README.md |
| Mentors / insight | Stoa's founding tech team plus a construction engineer with large-project experience | CHALLENGES.md:L1587 |
| Restrictions on models / LLM use | None stated (unknown). Hybrids of "frontier models, computer vision, 3D, geometry or small fine-tuned models" are encouraged | CHALLENGES.md:L1577 |

## 2. What the sponsor is actually trying to encourage

Our reading, which is an inference: Stoa is **harvesting ideas and recruiting** for the hardest part of its own product. Its live product already does "Q&A with citations" over project documents, where "Clicking a wall type or door tag opens the governing detail or clause beside the plan", and it runs on 20+ Nordic sites (stoabuild.com). The gap is reading the *drawing itself* (symbols, geometry, quantities) rather than the text, and doing it cheaply. Evidence:
- "General-purpose AI models frequently fail when analyzing complex technical drawings. This is one of the hardest unsolved problems in construction tech" (CHALLENGES.md:L1573). Independent evidence agrees: AECV-Bench finds "symbol-centric drawing understanding - especially reliable counting of doors and windows - remains unsolved" and recommends "tool-augmented" workflows (arXiv 2601.04819).
- They explicitly reward approaches that survive model progress: "solutions which next year's frontier models won't make obsolete … hybrid solutions which combine frontier models, computer vision, 3D, geometry or small fine-tuned models" (CHALLENGES.md:L1577). A pure prompt wrapper is what they are signalling against.
- Cost carries 25% of the score (CHALLENGES.md:L1610). In production, construction companies have thousands of sheets per project, so per-query VLM calls on full-resolution sheets are expensive. This is our inference.
- Verifiability carries another 25% (CHALLENGES.md:L1608), matching their product's citation-first UX (stoabuild.com). Site engineers must trust answers, so the answer has to point to the evidence.
- The dataset is quantity-takeoff questions (counts, areas, lengths, volumes) in many languages (README). That is the commercial use case (estimating and checking quantities), not chit-chat.
- The first prize includes a work trial (CHALLENGES.md:L1616), which is a direct recruiting signal.

## 3. Explicit requirements (quoted)

- "Build a program that answers natural language questions about construction drawings and building information models accurately and verifiably." (CHALLENGES.md:L1571)
- "Create a program which answers natural language questions about construction drawings. You will get a dataset of real technical drawings in many formats and languages together with example questions. A great answer is correct and shows where in the drawing it came from so a human can verify it in seconds." (CHALLENGES.md:L1575)
- "We are interested in solutions which next year's frontier models won't make obsolete." (CHALLENGES.md:L1577)
- Judging: "Accuracy of answers(25%)", "How well the solution visualizes its reasoning so a human can verify the answer(25%)", "Creativity(25%)", "Low inference cost(25%)" (CHALLENGES.md:L1607-1610)
- Dataset scoring convention: "counts must be exact; areas, lengths and volumes within 2%; text answers are free-form." (dataset README.md)
- Licensing: "Keep the credit when you show or share a drawing. NonCommercial (NC) files are for non-commercial use only." (dataset README.md)

## 4. What a mediocre submission looks like

Our estimate:
- A chat UI that sends the full drawing image and the question to GPT, Gemini or Claude and prints the answer. Accuracy on door and window counts would be poor (AECV-Bench reports symbol-centric accuracy often around 0.40-0.55; arXiv 2601.04819). There is no grounding, the cost is high per query, and it is exactly what "next year's frontier models" make obsolete.
- An answer with a vague "see the kitchen area" explanation or a full-page highlight, so the human cannot verify it in seconds.
- Handling only one format (PNG floor plans), and ignoring IFC, DXF and vector PDF, where exact answers can be computed from geometry.
- No measured accuracy on the provided Q&A set, no cost per question, and only a few cherry-picked demo questions.
- An IFC Q&A built only with an LLM writing ifcopenshell code, with no visual evidence shown in the model or plan.

## 5. What an exceptional submission demonstrates

Our estimate:
- **A format-aware hybrid router.** For IFC, DXF and vector PDF, it extracts exact geometry and entities (e.g. IfcSpace areas, wall lengths, slab volumes, door and window entities, PDF text and vector paths) and computes the answer deterministically. For raster scans (cubicasa5k PNG, archive JPEGs), a small fine-tuned detector or segmenter handles symbols such as doors, windows, WC, sinks and saunas. An LLM is used only to parse the question (in any of about 30 languages) into a structured query and to fill gaps.
- **Evidence overlays.** Every counted object gets a numbered bounding box or polygon on the sheet, areas show the summed room polygons with their values, and IFC answers highlight the elements in a 3D or plan view. A click on an item shows its source (entity ID, OCR text, detector confidence). Verification takes seconds, which hits the 25% visualisation criterion directly.
- **Measured numbers on Stoa's own scoring rule.** A held-out split of the provided questions gives accuracy per type and source (exact counts, 2% tolerance), compared against a frontier-VLM-only baseline and with cost per question (€ or tokens) for each. Example (estimate): "94% at €0.002/question vs 61% at €0.04 for GPT-only".
- **Honest abstention.** It says "not determinable from this model" when appropriate. IFC-Bench includes an "incomplete information" category (huggingface.co/datasets/sylvainhellin/ifc-bench), and the preview's ifc_bench answers include "Information not available in the BIM model".
- **Multilingual questions handled.** The preview pairs English with Finnish, German, Estonian and Danish versions of the same questions (our analysis of the preview's questions.jsonl).
- A story about why it won't be obsolete: deterministic geometry is exact forever, and small models are cheap and can be retrained on customer data.

## 6. Constraints that could disqualify or sink a project

- No formal disqualification rules are stated in the challenge text (unknown). The general Junction submission rules are not covered in this file.
- **Licence misuse** (estimate of risk): showing drawings without credit, or using NC (cubicasa5k) or ND data in ways the README forbids (dataset README.md). Keep the credits in the demo UI.
- **Unknown evaluation protocol.** If judges bring unseen drawings or questions, overfitting to the public Q&A (answers are included in questions.jsonl) would be exposed. Ask Stoa at the booth early whether there is a hidden test set, and how cost is measured.
- **Data volume.** The full dataset is about 9.8 GB; DWG needs conversion (e.g. ODA or LibreDWG, our assumption) and IFC needs ifcopenshell. Time-box format support.
- **Cost criterion.** A solution whose answer path is dominated by large VLM calls likely loses up to 25% (estimate).

## 7. Physical hardware work

**None.** The challenge is pure software: a dataset of files, any models and compute we choose (CHALLENGES.md:L1571-1597). GPU compute for fine-tuning a detector is available through Verda's free team credits (CHALLENGES.md:L2180). The same project could also enter the Verda "Best Use of Verda" bounty (CHALLENGES.md:L2134-2136), and possibly Best Use of Nemotron or Gemma if those models are used (CHALLENGES.md:L2588, L2546). Eligibility for multiple side challenges should be confirmed separately.

<!-- complete -->
