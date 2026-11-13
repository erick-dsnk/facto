# Make Blueprints Talk (Stoa): technical feasibility (Agent D)

**Summary**
- **Feasible, with a high chance of a working build. No hardware is involved.** I downloaded the preview dataset and spiked it today. About 33% of Stoa's public questions (Swiss plans plus IFC models) can be answered **exactly and deterministically** from the vector or BIM data that sits next to each drawing. Each IFC count and room-area answer I tested matched exactly (ifcopenshell), and a 20-minute DXF heuristic got 65/65 window counts right (details in section 3). These answers also come with free, pixel-exact evidence overlays, at roughly zero inference cost.
- **The hard part is the remaining 67%.** These are door, window and fixture counts on small raster CubiCasa scans (85,514 of 127,044 questions in the full set). VLMs are weak at this: symbol counting is "often 0.40-0.55 accuracy" (arXiv 2601.04819). A fine-tuned detector is the credible answer, but it is the riskiest workstream, and the public CubiCasa5K annotations likely cover the same images, which creates a leakage question we must clear with Stoa.
- **Smallest complete version (about 20 hours):** a format router, exact IFC/DXF/PDF-text solvers, a multilingual question parser, an evidence viewer, an eval harness that reports accuracy and cost per question, and a cheap VLM fallback with abstention for raster. The stretch goal is a YOLO-style detector trained on Verda GPUs.
- **The biggest unknown is how judges measure accuracy and cost** (CHALLENGES.md:L1607-1610 gives weights only). If they bring unseen raster scans (habs, finna, europeana or wikimedia, which have no public questions at all), the deterministic advantage disappears. Ask Stoa in the first hour.
- Estimates: buildable 8/10, live-demo reliability 8/10. The demo can run fully offline from precomputed indexes.

Sources opened for this report: CHALLENGES.md:L1561-1628 and L2120-2200 (Verda); the preview zip (downloaded) and the full zip's central directory, README and questions.jsonl (read via HTTP range requests) at the Supabase URLs in CHALLENGES.md:L1595-1597; https://github.com/CubiCasa/CubiCasa5k ; https://zenodo.org/records/2613548 ; https://arxiv.org/abs/2601.04819v1 ; https://huggingface.co/datasets/sylvainhellin/ifc-bench ; https://verda.com/blog/junction-2026 ; https://docs.verda.com/ ; https://docs.verda.com/inference/rate-limits ; https://github.com/ThatOpen/engine_web-ifc . Agent A's report: `docs/challenge-selection/01-challenge-intelligence/make-blueprints-talk.md`.
Limitation: the shared web-search budget ran out partway through this task. I could not check LibreDWG/ODA reliability, Verda per-token pricing or ultralytics licensing on the web, and these are marked "unknown" below.

---

## 1. What the data actually looks like (measured by us)

**Full dataset** (central directory and questions.jsonl read via HTTP range requests, without downloading 9.8 GB):

| Source | Files (main formats) | Public questions | How answerable |
|---|---|---|---|
| cubicasa5k | 4,787 PNG | **85,514 count** (67%) | Raster only. Needs CV or a VLM |
| swiss_dwellings | 1,040 each of PDF, DXF and PNG | 25,568 count, 12,016 area | **Exact**: vector PDF text and semantic DXF layers |
| ifc_models | 533 IFC, 107 PDF, 107 SVG, 500 PNG | 642 count, 2,218 area, 64 length, 138 volume | **Exact** from the IFC (the PDFs are rendered from it, per README) |
| ifc_bench | 30 IFC | 820 free-text | IFC queries plus an LLM to phrase the answer |
| opening_design | 678 PDF, 271 DWG, 9 DXF, 48 IFC | 64 (door schedules, areas, text) | Real US drawing sets. PDF text and tables |
| habs, finna, europeana, wikimedia | 6,566 JPG, 135 SVG | **0** | Historic raster scans. No ground truth |

Totals: 127,044 questions on 5,939 files. Types: count 111,763, area 14,243, text 836, volume 138, length 64. The README is identical to the preview's and states the scoring rule: "counts must be exact; areas, lengths and volumes within 2%; text answers are free-form."

**Questions are heavily templated.** CubiCasa has 7 question templates × English and Finnish (windows, WC seats, sinks, showers/bathtubs, storeys, doors, saunas). The Swiss set has about 12 templates in English, German, French and Italian, plus "net floor area of room X". The ifc_models questions follow "How many {doors|windows|spaces|walls|columns|beams|stairs} in model X" and "net floor area of room 'NAME (ID)' on '{storey}'". This is our analysis of the preview and full questions.jsonl. **Implication:** a template matcher plus a cheap LLM fallback parses almost everything, and the LLM is rarely on the hot path.

**The CubiCasa images are small.** For example, `colorful-11397.png` is 475×650 px, and its plans are partly rotated 180° (upside-down text). Symbols are only a few pixels across. This is hard for VLMs and also not trivial for detectors. The preview's images break down as 187 high_quality_architectural, 41 high_quality and 13 colorful, which matches the CubiCasa5K folder naming.

## 2. Architecture a credible entry needs

```
question + file ─► Question parser ──► structured query {op: count|area|length|volume|text, target, scope}
                   (template regex, ~30 langs;        │
                    cheap LLM fallback, cached)        ▼
                                          Format router (by path + sibling files)
        ┌──────────────┬───────────────┬───────────────┬──────────────────┐
        ▼              ▼               ▼               ▼                  ▼
   IFC solver     DXF solver     Vector-PDF solver  Raster solver     Free-text agent
 (ifcopenshell:  (ezdxf: layers  (PyMuPDF: words +  (fine-tuned       (LLM + ifcopenshell
  by_type, space  DOOR/WINDOW/    bboxes, vector     detector; VLM     tools, for ifc_bench
  footprint area, FIXTURE/UNIT_   paths; tables for  fallback with     and opening_design)
  volume, storey) OUTLINE/ROOM)   door schedules)    abstention)
        └──────────────┴───────┬───────┴───────────────┴──────────────────┘
                               ▼
              Answer + Evidence[] (bbox | polygon | IFC GlobalId, value, source, confidence)
                               ▼
     Web viewer: drawing with numbered overlays; "sum of these 12 rooms = 184.93 m²";
     IFC → 2D storey plan SVG with the highlighted spaces/elements (3D optional)
                               ▼
     Eval harness: held-out split, Stoa scoring rule, accuracy per type/source,
     € per question, versus a VLM-only baseline
```

Design points that map to the 25/25/25/25 criteria (CHALLENGES.md:L1607-1610). These are our estimates:
- **Accuracy:** be exact wherever geometry exists, and use the detector for raster. Abstain rather than guess when confidence is low. IFC-Bench has a whole "Incomplete Information" category (194 questions), per https://huggingface.co/datasets/sylvainhellin/ifc-bench.
- **Verification:** every solver emits evidence items with coordinates. This comes free from DXF entities, PDF word bboxes, IFC footprints and detector boxes.
- **Cost:** the deterministic paths cost about €0 per question. LLM use is limited to parsing off-template questions and phrasing free text. Report € per question measured over the full eval.
- **Creativity and future-proofing:** our pitch is that "geometry is exact forever and small models are cheap", which answers Stoa's "next year's frontier models won't make obsolete" (CHALLENGES.md:L1577).

## 3. Spike results today (preview data, our code in a scratch venv)

| Test | Result | Time to write |
|---|---|---|
| IFC Esplanades model: counts of IfcDoor, IfcWindow, IfcSpace, IfcWall, IfcColumn, IfcBeam, IfcStair | **7/7 exact** (211, 297, 285, 846, 37, 37, 4). The file opens in 0.5 s | 5 min |
| IFC room net floor area (`ifcopenshell.util.shape.get_footprint_area` on IfcSpace geometry) | **5/5 exact** to 0.01 m². This suggests Stoa generated the ground truth the same way (inference). About 1.4 s per space for geometry | 10 min |
| The IFC spaces carry no area property sets | Areas must be computed from geometry, not read from the property sets | — |
| Swiss PDF (matplotlib-rendered vector) | Every room label, room number and "xx.xx m²" value is extractable text. Apartment labels "Whg. A/B/…" and a legend are present. Area questions are sums of labelled values | 2 min |
| Swiss DXF semantic layers | DOOR, WINDOW, FIXTURE, ROOM_OUTLINE, ROOM_TEXT, UNIT_OUTLINE, WALL | — |
| Naive DXF counting over the 65 preview Swiss plans | windows (polylines/3) **65/65**, apartments (UNIT_OUTLINE) **55/65**, doors (arcs) **37/65**. A first heuristic, still to be refined (sliding and double doors) | 20 min |
| Fixtures (WC, washbasin, bathtub, shower) on FIXTURE | Undifferentiated circles and polylines on a single layer. Needs a shape classifier or the PDF legend (not done) | — |
| Environment gotcha | The machine's default `python3` is 3.15, and `venv`/ensurepip failed on it. `uv venv -p 3.12` with `ifcopenshell 0.9.0.post1`, `ezdxf 1.4.5` and `pymupdf 2.1` installed cleanly | — |

## 4. Critical dependencies and access

| Dependency | Access | Risk |
|---|---|---|
| Stoa dataset: preview 0.5 GB, full 9.8 GB (CHALLENGES.md:L1595-1597) | Public Supabase URLs, no credentials. Our download of the preview took **326 s (about 1.5 MB/s)**, so the full set would take about 1.8 h at that rate (estimate). Range requests work, so you can fetch only questions.jsonl (900 KB compressed) or selected folders | **Start the full download now, before the venue Wi-Fi gets congested.** Store it on one machine and share it over LAN or a drive |
| ifcopenshell, ezdxf, PyMuPDF | pip/uv (verified installs on macOS arm64, Python 3.12) | Low. PyMuPDF's licence is not checked here (unknown). It is fine for a hackathon, but mention it to Stoa if they want the code |
| DWG (271 files, opening_design only) | Needs conversion (LibreDWG or ODA File Converter). **Reliability not verified** (search budget exhausted; the GNU page returned HTTP 429) | **Skip DWG.** Only 64 public questions sit in opening_design, and all of them are on PDFs |
| CubiCasa5K annotations and code (for a raster detector) | Zenodo record 2613548: a single 5.5 GB zip, CC BY-NC-SA 4.0, "over 80 object categories", polygon annotations (https://zenodo.org/records/2613548). The GitHub repo has pretrained weights on Google Drive, written for **Python 3.6.5 / PyTorch 1.0.0** (https://github.com/CubiCasa/CubiCasa5k) | The old stack makes porting risky. Converting SVG polygons to detector boxes takes us about 4-6 h (estimate). **There is leakage risk:** Stoa's cubicasa images appear to be the CubiCasa5K images renamed (its LICENSE.md says "Changes: files renamed"), so public annotations exist for the test images. Ask Stoa whether this is allowed |
| GPU for detector training | Verda free credits for every team, claimed via Junction Platform → Hackerpacks → Verda form (https://verda.com/blog/junction-2026; CHALLENGES.md:L2180). Amount: **unknown** | Coupon delays. Claim on Friday night (the workshop is at 20:30, CHALLENGES.md:L2182) |
| LLM for parsing and free text | Verda Inference API: OpenAI-compatible, billed per token, Kimi K3.1 Pro and DeepSeek V4.1 Flash (https://docs.verda.com/). A Nemotron endpoint is mentioned (CHALLENGES.md:L2179) but is not on the blog page. Or our own Claude/OpenAI keys | Rate limits are tiered, "New accounts start on the first tier", and no numbers are published (https://docs.verda.com/inference/rate-limits). Per-token price: **unknown**. Cache all parses |
| Browser IFC viewer (optional) | web-ifc (WASM, MPL-2.0, about 1.1k stars) (https://github.com/ThatOpen/engine_web-ifc) | The preview IFCs reach 64-74 MB (hitos, molio), so in-browser loading is slow (estimate). Prefer a server-rendered 2D SVG plan with highlights |

## 5. Integration complexity given our skills

- **IFC, DXF and PDF solvers: low to medium.** These are Python data wrangling and fit our ML/data skills. The difficulty is in the long tail of semantics. Examples: what counts as a "door" (double and sliding doors), "numbered indoor rooms excluding shafts and voids", "how many storeys" on a CubiCasa sheet, and "a double-bowl sink counts as one". Expect most of the solver time to go into matching Stoa's counting conventions, which is why the eval harness must exist from hour 2.
- **Question parsing: low.** It is mostly templates, with an LLM fallback emitting JSON.
- **Evidence viewer: low to medium.** It is our web strength: canvas or SVG overlays on PNG and PDF renders, plus a 2D IFC plan.
- **Raster detector: medium to high.** Annotation conversion, class mapping to Stoa's question semantics (e.g. "showers and bathtubs combined"), training on Verda, and post-processing for rotated and two-storey sheets. The team can do it, but this is where 40 hours get eaten.
- **Free-text IFC (ifc_bench) and opening_design: medium,** with low value (836 + 64 questions). Use an LLM agent with ifcopenshell tools, and time-box it.

## 6. Does it fit in 40 hours? Smallest complete version

**MVP (target 20 h wall-clock with 3 people plus agents; estimate):**
1. Data on disk and the eval harness (scoring rule, held-out split by file, € per question). Done by hour 3.
2. The parser and the format router.
3. IFC solver (counts, space area, volume, length) and Swiss solver (PDF text areas and room counts, DXF doors, windows and units). The goal is ≥95% on these sources (an estimate from the spike).
4. Raster fallback: a cheap VLM call with a strict JSON schema, tiles and upscaling, a confidence threshold and **abstain**. Report its true accuracy honestly.
5. A viewer with overlays and a one-click "verify" list, plus an eval dashboard: accuracy by source and type, € per question, and a comparison with a VLM-only baseline on a 200-question sample.

**Stretch (hours 20-34):** a detector trained on CubiCasa5K for windows, doors, WC, sinks, showers, bathtubs and sauna (subject to Stoa's OK on leakage), with its boxes as evidence. Then the fixture classifier for Swiss FIXTURE shapes, ifc_bench free text, and a 3D IFC highlight.

**Freeze at hour 34.** Use the rest for the pitch, the recorded backup video, and re-running the eval on a clean held-out split.

Suggested split: person A on IFC, PDF and DXF solvers plus the eval; person B on the raster detector (Verda) and VLM fallback; person C on the viewer, parser and pitch. All of them run coding agents in parallel.

## 7. Live demo: likelihood and failure modes

**Estimated demo reliability: 8/10**, provided we precompute indexes and cache LLM calls. The demo then needs no network.

What would make it fail or look bad:
1. **Judges hand over an unseen raster scan,** such as a habs or finna archive JPEG, a phone photo, or a non-CubiCasa style. The geometry advantage vanishes, the detector is out of distribution, and the VLM fallback is at roughly 0.4-0.55 on symbol counts (arXiv 2601.04819). *Mitigation:* show abstention with a confidence value, and tell that story deliberately.
2. **A Swiss question asked on the PNG rather than the PDF/DXF.** The vector path is unavailable, so route by sibling file. *Ask Stoa* whether siblings are fair game at judging.
3. **A large IFC (55-74 MB) parsed live.** Geometry for all spaces takes minutes (about 1.4 s per space measured on a 12 MB file). *Mitigation:* pre-index every IFC at startup and never compute geometry during the demo.
4. **Off-template or oddly phrased questions** typed live by a judge. *Mitigation:* the LLM parser fallback, plus an "I interpreted this as …" line in the UI.
5. **Venue Wi-Fi or LLM rate limits** (tiered, unpublished, per https://docs.verda.com/inference/rate-limits). *Mitigation:* a local cache and pre-run demo questions.
6. **Accuracy numbers inflated by leakage**, either from tuning on the public Q&A, which includes answers, or from training a detector on annotations of the test images. If Stoa evaluates on a hidden split, our headline number collapses in front of the people who will offer the work trial. *Mitigation:* report on a file-level held-out split and disclose the data used.
7. **Licence slip:** showing drawings without credit. The README requires keeping the credit, so display the source and licence under every rendered drawing.

## 8. Questions to ask Stoa on site before committing (first hour)

1. How is **accuracy** judged: a hidden test set, live questions, our self-reported eval, or all three? Which sources and formats are in it? Will habs, finna, europeana or wikimedia scans (no public questions) be used?
2. How is **inference cost** measured: €/question, tokens, wall-clock, GPU time? Does a one-off detector training cost count?
3. At judging, may we use **sibling files** (the DXF for a Swiss PDF, the IFC for an ifc_models PDF)? The README says same-name files are "the same drawing in another format".
4. Is training on the **public CubiCasa5K annotations** allowed, given that they appear to cover the same images? Or should we train only on a split that excludes the eval files?
5. Is there a required **submission format** (CLI over questions.jsonl, API, repo, demo video)? This is unknown from CHALLENGES.md:L1561-1628.
6. Do they care more about breadth (all formats) or depth (raster symbol counting)? Which question types matter most to their customers?
7. For free-text answers (ifc_bench, opening_design), how are they graded?

## 9. Verdict

The feasibility case is strong. A third of the benchmark is solvable exactly with a few hundred lines of Python, verified today, and that gives us a reliable floor and an excellent verification UX. The competitive edge on accuracy depends on raster symbol counting, the part Stoa calls unsolved. A 95%-reliable plan is to ship the deterministic plus VLM-with-abstention MVP first, and treat the detector as an upside bet. Do not commit until questions 1-4 are answered. Answer 1 alone can flip the strategy.

<!-- complete -->
