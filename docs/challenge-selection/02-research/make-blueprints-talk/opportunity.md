# Make Blueprints Talk (Stoa): opportunity discovery (Agent C)

**Summary**
- The documented gap is not "chat with drawings", which Stoa and others already sell (stoabuild.com, competitive.md §3). It is *reading the drawing itself*: symbol counts and quantities, verified in seconds and computed cheaply. VLMs score about 0.40-0.55 on door and window counting ([AECV-Bench](https://arxiv.org/abs/2601.04819v1)), and Stoa's site does not mention quantities or takeoff ([stoabuild.com](https://stoabuild.com/)).
- The strongest underused asset is the **dataset's own hidden structure**: DXF block references, PDF vector paths, IFC entities, and *ground-truth geometry shipped with the sources*. CubiCasa5k has polygon SVG annotations in 80+ categories. Swiss Dwellings has WKT door, window and room polygons in metres under CC BY 4.0. With these we can produce exact answers with true-by-construction evidence, and train a small detector for raster scans on Verda GPUs.
- Five directions follow: (1) vector-first exact answers, (2) a detector trained on labels the dataset already ships, (3) an evidence ledger that the user can edit and that recomputes the answer, (4) a measured cost and accuracy cascade, (5) multilingual question-to-query parsing with a small open model.
- Estimates (ours): differentiation 7/10, demo 7/10, jury fit 6/10. Verda Compute, plus Gemma or Nemotron, plus Codex stack honestly. Physical hardware work: none.

Inputs read: CHALLENGES.md:L1561-1628; [01-challenge-intelligence/make-blueprints-talk.md](../../01-challenge-intelligence/make-blueprints-talk.md) (Agent A, which includes its own analysis of the preview dataset); [competitive.md](competitive.md) (Agent B); [00-rules-and-jury.md](../../00-rules-and-jury.md); [_tech-challenges.md](../../01-challenge-intelligence/_tech-challenges.md).

Web sources opened for this report: https://stoabuild.com/ ; https://arxiv.org/abs/2601.04819v1 ; https://github.com/CubiCasa/CubiCasa5k ; https://zenodo.org/record/7788422 ; https://huggingface.co/datasets/sylvainhellin/ifc-bench ; https://pymupdf.readthedocs.io/en/latest/recipes-drawing-and-graphics.html ; https://ezdxf.mozman.at/docs/tutorials/blocks.html ; https://docs.ifcopenshell.org/ifcopenshell-python/geometry_processing.html (index only).

Note: the session's web-search budget ran out during this task. Claims below rely only on the pages listed above and on Agents A and B. Points I could not verify are marked "unknown".

---

## Context in two paragraphs (for a teammate who has not read the brief)

Stoa, a Helsinki construction-AI startup, wants "a program that answers natural language questions about construction drawings and building information models accurately and verifiably" (CHALLENGES.md:L1571). "A great answer is correct and shows where in the drawing it came from so a human can verify it in seconds" (L1575). They want approaches "which next year's frontier models won't make obsolete", such as hybrids of frontier models, CV, 3D, geometry or small fine-tuned models (L1577). Four criteria are weighted 25% each: accuracy, visualised reasoning, creativity and low inference cost (L1607-1610). Prizes are €1000 plus a work trial, €750 and €250 (L1614-1624).

The dataset has about 14,000 drawings (PDF, DWG, DXF, IFC, SVG, PNG and JPEG) in about 30 languages, with about 120,000 quantity questions *with answers*. Its scoring rule is that counts must be exact and areas, lengths and volumes must be within 2% (dataset README, via Agent A). The preview (922 files, 7,990 Q&A) is mostly counts (6,076) and areas (1,599). By source it is cubicasa5k 4,270, swiss_dwellings 2,358, ifc_models 1,049 and ifc_bench 249 (Agent A's analysis of the preview). How judges measure accuracy and cost is **unknown**.

---

## Opportunity 1: Vector-first exact answers (the drawing already "knows" the answer)

**Gap.** The default approach rasterises every file and asks a VLM (competitive.md §4). Many files are not pictures but structured data:
- DXF files store repeated symbols as named block references, so `msp.query('INSERT[name=="..."]')` returns every instance of a block ([ezdxf blocks tutorial](https://ezdxf.mozman.at/docs/tutorials/blocks.html)).
- PDF pages expose every vector path, with its bounding rect, colour and line style, through `page.get_drawings()` ([PyMuPDF docs](https://pymupdf.readthedocs.io/en/latest/recipes-drawing-and-graphics.html)).
- IFC models contain typed entities, and IfcOpenShell has geometry utilities such as `shape_volume` and `face_area`, plus a selector syntax ([IfcOpenShell docs index](https://docs.ifcopenshell.org/ifcopenshell-python/geometry_processing.html); only the index was readable, so the detailed behaviour is unverified).

Counting identical block inserts, or clustering identical vector-path signatures, gives a count that is exact and costs nothing per question. The evidence is the entities themselves, so it cannot be hallucinated.

**Evidence that it is underused.**
- STACK Assist reportedly reads only searchable text (competitive.md §3, from a snippet).
- Stoa's own site describes cited Q&A, revision compare and clicking a door tag to open a detail. It does not mention quantities or takeoff ([stoabuild.com](https://stoabuild.com/)).
- Agent B found no public repo that combines multi-format routing with overlays (competitive.md §2; absence is not proof).

**Honest limit.** In the preview, vector and model files are a minority: 123 PDF, 66 DXF, 20 DWG, 14 IFC and 10 SVG, against 680 PNG/JPG. The largest question source, cubicasa5k, is raster (Agent A). So this lane alone covers well under half of the questions (estimate). Opportunity 2 must cover the raster part. DWG needs conversion, and the converter is unknown (Agent A §6). Whether the PDFs are vector or scanned images is unknown until we inspect them.

**Why Stoa would care (inference).** It is exact, free at inference, and cannot be made obsolete by model progress, which matches L1577 and L1610 directly. Customers' real drawing sets are mostly CAD exports, so this is the production path for them (estimate).

**How it reads to the overall jury.** It gives a crisp, distinctive insight: "the file already contains the answer, and the AI was looking at a picture of it". It is strong on technical depth (20%) but only moderately visual unless it is paired with overlays.

## Opportunity 2: A detector trained on labels the dataset already ships

**Gap.** For raster scans, teams will either use a VLM (weak at counting: 0.40-0.55 on doors and windows, [AECV-Bench](https://arxiv.org/abs/2601.04819v1)) or download an off-the-shelf FloorPlanCAD YOLO model. Those models are trained on another domain and carry AGPL or NC licences (competitive.md §2). Very few teams will notice that the dataset's own sources ship dense geometric ground truth:
- **CubiCasa5k**: 5,000 floor plans "annotated into over 80 floorplan object categories" as polygons in SVG ([GitHub](https://github.com/CubiCasa/CubiCasa5k)). In Stoa's bundle these are Finnish plans under CC BY-NC-SA (Agent A). The README did not show the licence text in what I fetched.
- **Swiss Dwellings**: `geometries.csv` holds WKT polygons in metres for areas (rooms), separators (walls), openings (doors, windows) and features (sinks, bathtubs): about 715k openings and 520k areas, under CC BY 4.0 ([Zenodo 7788422](https://zenodo.org/record/7788422)). The preview ships Swiss Dwellings as PDF, DXF and PNG of the same plans (Agent A). That gives aligned vector and raster twins, with free labels for raster training and an exact cross-check.

A small segmenter or detector (doors, windows, rooms, sanitary fixtures) fine-tuned on Verda GPUs for a few hours could plausibly beat VLM counting at a tiny fraction of the cost. That is our estimate and still needs to be measured.

**Caveats.**
- The Q&A for cubicasa5k and swiss_dwellings were probably generated from these same annotations (inference). Training on them and testing on the same files would be leakage, so split by file or by building.
- If Stoa judges on a hidden set of *other* sources, such as US practice drawings (opening_design) or archive scans (habs, finna), the detector must generalise. That protocol is unknown, so ask at the booth.
- NC/SA licences limit Stoa's commercial reuse of a CubiCasa-trained model. Swiss Dwellings (CC BY) is the cleaner training source.

**Why Stoa would care.** "Small fine-tuned models" is named explicitly (L1577). Retrainable, cheap, local models are a moat that frontier models do not erase (inference).

**How it reads to the jury.** It gives a measurable before/after: "VLM: 6 doors (wrong). Ours: 9 numbered boxes, 9 correct, €0.0001." It also gives real depth (training plus evaluation) and honest numbers on a held-out split, which is 15% of the jury rubric.

## Opportunity 3: Evidence as an editable ledger, not a citation

**Gap.** The market's notion of "verifiable" is a page citation or a highlighted text span. Stoa cites the "document and page behind each sentence" ([stoabuild.com](https://stoabuild.com/)), and Nomic and Civils.ai do similar things (competitive.md §3). Agent B lists "page-number highlight as visual evidence" as an obvious idea. To these judges, a page citation is table stakes.

The open direction is to make the **answer a pure function of a visible evidence list**:
- a count is the number of numbered boxes or entity IDs;
- an area is the sum of listed room polygons, each labelled with its m²;
- an IFC answer is the set of highlighted GUIDs.

When the human removes a false positive or adds a missed door with one click, the answer recomputes. "Verify in seconds" (L1575) becomes "correct in seconds", and every correction becomes a labelled training example (flywheel).

The ledger should also include **abstention**. IFC-Bench has 194 "Incomplete Information" questions whose ground truth states the gap, for example "Load-bearing classification data is not available in this model" ([IFC-Bench](https://huggingface.co/datasets/sylvainhellin/ifc-bench)). An empty or contradictory ledger lets the system say "not determinable".

**Why Stoa would care.** The visualised-reasoning criterion carries 25% (L1608). Site engineers will only trust quantities they can audit (inference). The correction loop is also a product feature Stoa does not advertise.

**How it reads to the jury.** This is the most legible angle for the peer floor. A visitor sees boxes appear, clicks one away, and the number changes within about 10 seconds. It gives a credible path forward: the next user is a site engineer, they come back because the corrections improve the model, and the scale step is per-customer fine-tuning. This is our assessment.

## Opportunity 4: A measured cost and accuracy cascade (cost as a first-class output)

**Gap.** "Low inference cost" is 25% of the score (L1610), but the measurement method is unknown (Agent A). Agent B found no competitor or hackathon entry that publishes accuracy *and* cost per question (competitive.md §1-2). A router that takes the cheapest sufficient route per question can show a **Pareto curve** and a live per-question cost meter against a VLM-only baseline:
1. Exact parse (vector or IFC).
2. Small detector.
3. VLM on a cropped region, only when confidence is low.

When two independent routes agree (for example the vector count and the raster detector on Swiss Dwellings twins), confidence is high. When they disagree, the system escalates or abstains.

**Why Stoa would care.** In production, VLM calls on full-resolution sheets across thousands of sheets per project are expensive (inference, Agent A §2). A cascade with measured routing is exactly the "hybrid" architecture L1577 asks for.

**How it reads to the jury.** It maps directly onto the "honest measured evidence: baseline, failure cases, a metric that cannot be gamed" criterion (15%, 00-rules-and-jury.md). Use Stoa's own scoring rule (exact counts, 2% tolerance) on a held-out split. One slide carries it: "X% at €a per question vs Y% at €b for GPT-only." The visual wow is low on its own, so it is a supporting pillar rather than a headline.

## Opportunity 5: Multilingual question to typed query with a small open model

**Gap.** The dataset covers about 30 languages, and the preview pairs the same question in English, Finnish, German, Estonian and Danish (Agent A §5). Teams will pass raw questions to a frontier LLM. A cheaper and more testable design uses a small open model (Gemma, or Nemotron hosted on Verda credits, CHALLENGES.md:L2179-2180 via Agent A) to parse any language into a typed query, such as `{op: count, class: door, scope: unit 3, unit: pcs}`. Deterministic code then executes the query.

Cross-lingual consistency becomes a built-in test: the same question in five languages must yield an identical query and answer. Whether the drawings' own labels (room names in Finnish or German) need translation for scoping is unknown, but likely (estimate).

**Why Stoa would care.** Nordic customers mean Finnish, Swedish and Estonian sites (inference from CHALLENGES.md:L1581 "largest construction companies in the Nordics"). Parsing with a small model costs almost nothing.

**How it reads to the jury.** It is a quiet enabler. A live moment works well: a juror asks in their own language and gets the same overlay. On its own it is not a headline.

---

## Combinations that are newly practical (estimate)

- Vector twins as **free supervision** for raster models (Opportunity 1 feeds Opportunity 2). The Swiss Dwellings PDF/DXF/PNG triples allow this without any hand labelling.
- Cheap open VLMs and LLMs (Nemotron 3.5 Super VL, Gemma) as *fallback and parser only*, which only recently became good enough at multilingual structured output (inference). One GPU-credit pool (Verda) serves training, batch preprocessing of 10 GB and hosting.
- A verification UI whose overlays come from the same computation as the number. VLM-returned coordinates are not reliable enough for this (competitive.md §4.5, unverified).

## Live-demo before/after (estimate)

1. Upload a Finnish floor plan (CubiCasa, with the credit shown per licence) and ask "how many doors?" in Finnish.
2. **Before:** the frontier VLM answers with a confident wrong number and no evidence.
3. **After:** numbered boxes appear, the count is correct, the cost meter shows a fraction of a cent, and the route badge reads "detector".
4. Click away a box: the count changes. Ask an IFC question with no answer: the system abstains, citing the missing property.
5. Close on one slide of held-out accuracy and €/question against the baseline.

## Tech challenges an entry here could honestly stack

| Tech challenge | Honest fit | Why |
|---|---|---|
| Verda Compute Track | Strong | Detector fine-tuning plus batch preprocessing of the 10 GB dataset need real GPU compute, which fits the "could not do on a laptop" criterion (_tech-challenges.md row 1, CHALLENGES.md:L2116-2222). Requires a Discord write-up. |
| Best Use of Gemma *or* Nemotron | Medium | Either can serve as the multilingual parser or the low-confidence VLM fallback. Nemotron must be "central to core function", with a text explanation (L2588-2614). A fallback-only role is a weaker claim. Gemma has prose-only criteria (L2546-2584). |
| Best Use of Codex | Easy | Development-process prize, stackable with any challenge (_tech-challenges.md). |
| Best use of Modal | Alternative to Verda | Only if we host on Modal instead. It needs a live deployed app (L3163-3229). Doing both duplicates effort. |
| Gemini API | Possible | Only if Gemini is the VLM baseline or fallback. All members must be 18+ (L2518). It undercuts the "cheap open model" story. |
| MongoDB, Aiven, Cloudinary and others | Weak | Would be bolted on, not meaningful. |

## Estimates (ours)

- **Differentiation potential: 7/10.** The obvious lane (VLM plus page citation) is crowded and already Stoa's own product. Opportunities 1-3 are a clearly distinct lane that few teams will reach (Agent B estimates 1-3 teams). It is not 9+ because the "hybrid router" idea is the natural strong answer, and other ML-heavy teams may converge on it.
- **Demo potential: 7/10.** The overlay plus click-to-correct before/after is visual and quick, and the cost meter adds a number. Drawings are a niche subject for peers, and the demo depends on a trained detector working by Sunday morning.
- **Jury fit: 6/10.** The fit is strong on a specific user (site engineer), distinctive insight, measured evidence and path forward (Stoa work trial, correction flywheel). It is weaker on peer-floor emotional pull, because B2B quantity takeoff is less gripping than consumer or social-impact stories. Jury PDF links: Agent A found no mention of Stoa or construction in the jury PDF. 00-rules-and-jury.md lists juror Timo as tied to Lifeline, a Stoa investor (CHALLENGES.md:L1581), and whether he recuses himself is unknown.

<!-- complete -->
