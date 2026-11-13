# Competitive intelligence: Make Blueprints Talk (Stoa)

**Summary**
- The generic version of this idea ("chat with your drawings", RAG over PDFs, VLM + page citation) is already a commercial category (Nomic, Kreo, Togal.CHAT, STACK Assist, Stoa itself). Teams that build it will look like a weaker copy of existing products.
- No public record found of earlier Junction/Stoa winners or of any hackathon entry for this exact task (unknown; searches returned nothing). Closest analogues are generic BIM-chat hackathon projects.
- The documented hard gap is symbol counting: frontier VLMs score about 0.40-0.55 on door/window counting (AECV-Bench). A hybrid system (exact geometry for IFC/DXF/vector PDF, small detector for raster, LLM only for parsing, overlay evidence, abstention) is the differentiated lane.
- Crowding estimate (ours): medium-high on the "VLM + RAG + citation" lane, low on the "format-aware hybrid with measured accuracy and cost" lane.

Challenge text: CHALLENGES.md:L1561-1628. Judging: accuracy 25%, visual verification 25%, creativity 25%, low inference cost 25% (CHALLENGES.md:L1607-1610). The sponsor asks for solutions "which next year's frontier models won't make obsolete", e.g. hybrids of frontier models, CV, 3D, geometry or small fine-tuned models (CHALLENGES.md:L1571-1575 region, "The Challenge" paragraph).

## 1. Previous winners and similar hackathon entries

- **Stoa at earlier Junctions: unknown.** A web search for Stoa + Junction winners found nothing (searched; no citable source). Do not assume a precedent.
- Junction 2025 main winner was reportedly team WAVELET; Junction 2025 had 1,500+ participants and ~40 partners (secondary, from search snippets of Wikiwand/Aalto, pages not opened): https://www.wikiwand.com/en/articles/Junction_(hackathon) , https://www.aalto.fi/en/news/aalto-students-and-researchers-shape-together-how-we-age-with-ai-at-junction-hackathon-2025 . Not construction related; no detail on how partner-track winners were chosen.
- Related hackathon entries (from search result summaries only; I could not open the Devpost page, which returned 403):
  - RealBIM on Devpost (BIM project; contents unverified): https://devpost.com/software/realbim
  - Microsoft Garage: RAG copilot chat over a 3D building model on Azure AI Search, a Microsoft Global Hackathon winner: https://www.microsoft.com/en-us/garage/wall-of-fame/ai-powered-reconstruction-of-destroyed-buildings/ (summary only, not opened)
  - Ahlsell x Microsoft AI Blueprint Hackathon, RAG to turn plans into quotes (LinkedIn snippet, no technical detail).
  - A.Team GenAI hackathon "Floorplan.ai": text to floor plans via GPT, 48h prototype, the reverse direction: https://a.team/master-case-studies-collection/floorplan-ai
  - Pattern: hackathon construction-AI entries are overwhelmingly LLM wrappers/RAG chat. None found with measured accuracy on symbol counting.

## 2. Open-source and research implementations

| Item | What it is | Relevance | URL |
|---|---|---|---|
| AECV-Bench (arXiv 2601.04819) | Benchmark: counting on 120 floor plans, 192 drawing QA pairs. Text/OCR QA up to 0.95; symbol counting (doors/windows) often 0.40-0.55; authors recommend domain-specific representations and tool-augmented human-in-the-loop workflows. (Opened abstract.) | Evidence the VLM-only baseline is weak; supports the hybrid lane | https://arxiv.org/abs/2601.04819v1 |
| FloorPlanCAD (ICCV 2021) | Vector CAD floor-plan dataset, 30 categories, GCN+CNN panoptic symbol spotting baseline | Prior art for detecting symbols in vector data (not opened in full; from search results) | https://arxiv.org/abs/2105.07147v2 |
| floorcad-yolov8n-detect (HF) | YOLOv8n on FloorPlanCAD, 35 classes, mAP50 0.770; AGPL-3.0; not validated for sign-off. Opened. | A first-reach baseline others may download; also a licence issue | https://huggingface.co/mudasir13cs/floorcad-yolov8n-detect |
| Architect (HF) YOLOv8m | FloorPlanCAD fine-tune, CC-BY-NC-4.0 (search result, not opened) | Same | https://huggingface.co/SamirShabani/Architect/blob/main/README.md |
| RF-DETR via Roboflow | Apache 2.0 detector family recommended for door/window symbols (search result summary) | Likely detector choice | https://roboflow.com/answers/best-model-for-floor-plan-detection |
| MCP4IFC | Open-source MCP server over IfcOpenShell/Bonsai; query/create/edit IFC with LLM; licence unstated. Opened. | Obvious "LLM + IFC tools" route | https://show2instruct.github.io/mcp4ifc/ , https://github.com/Show2Instruct/ifc-bonsai-mcp |
| AI-BIM-APP | Web app, chat panel sends extracted IFC data to OpenAI (search/docs summary) | Typical naive IFC chat | https://www.mintlify.com/bnares/AI-BIM-APP/guide/querying-with-ai |
| Graph-RAG over IFC (arXiv 2504.16813), IfcLLM (arXiv 2605.13236 per search listing) | LLM generates Cypher/graph queries over IFC; IfcLLM reports 93.3-100% first-attempt accuracy on three IFC models (search summary, unverified) | IFC half is a solved-ish research topic | https://www.emergentmind.com/papers/2504.16813 |
| MechVQA (arXiv 2605.30794) | 3.3K mechanical drawings, 21K QA pairs; not architectural | Shows VQA-on-drawings is an active research area | https://arxiv.org/pdf/2605.30794 |

I did not find a public GitHub repo combining multi-format routing, detectors and VLM QA with overlays (one search; absence is not proof).

## 3. Commercial products already solving (parts of) it

- **Stoa itself**: answers questions from drawings, specs, contracts, schedules and cites the document and page behind each sentence; clicking a wall type or tag opens the governing detail beside the plan; revision comparison. Opened: https://stoabuild.com/ . Implication: judges are the team that already shipped citation-first chat. A page-citation demo is table stakes to them; the open problem they flagged is accuracy on symbols/quantities (inference, from CHALLENGES.md "hardest unsolved problems").
- **Togal.AI**: CV takeoff of rooms/areas, counts items, Togal.CHAT for NL queries; strongest on architectural floor plans, weaker on MEP/structural; $299/user/month. https://www.mastt.com/software/ai-blueprint-reader
- **Kreo (Caddie)**: plain-language blueprint Q&A, extracts tables/room names; Pro GBP 95/user/month. Same source.
- **Bild AI**: quantities, cost, code compliance; **Markovate**: CV symbol detection + OCR; **Mastt AI Agent**: drawing summaries (no takeoff). Same source.
- **Nomic**: answers over drawing sets with sheet-level citations. https://www.nomic.ai/compare/best-ai-for-blueprint-reading (vendor comparison page, self-interested).
- **STACK Assist**: chat over plans, reportedly reads only searchable text, not image content (search snippet; the docs page returned 404): https://help-preconstruction.stackct.com/docs/stack-assist
- **Civils.ai**: opens the source page and highlights cited text (search snippet): https://civils.ai/ai-for-construction-project-management
- General LLMs (ChatGPT/Claude/Gemini): fine for informal single-sheet questions, to be verified (Nomic page above); AECV-Bench numbers show counting failures.

## 4. What most teams will reach for first

Estimates (ours), based on the above and on what is easiest in 40 hours:
1. PDF to images, send to Claude/GPT/Gemini vision with the question, return text (the baseline).
2. RAG chat: OCR/text extraction, embeddings, vector DB, cite page number.
3. IFC loaded with IfcOpenShell, LLM writes Python or Cypher (MCP4IFC style).
4. Download a FloorPlanCAD YOLO model, count doors/windows, ask the VLM to explain.
5. Bounding-box overlay on the page image from VLM-returned coordinates (VLM box accuracy on drawings is itself unreliable; unverified here).
6. Slick chat UI with a PDF viewer; no measured accuracy or cost.

## 5. Obvious ideas to avoid (as the headline)

- "ChatGPT for blueprints": VLM-only QA with page citation.
- Generic RAG over drawing PDFs/specs.
- IFC chatbot via LLM-generated queries with no drawing-side story.
- Off-the-shelf YOLO door/window counter with no evaluation, plus chat wrapper.
- Highlight-the-page-number as "visual evidence".
- Training/benchmark claims on the public Q&A without a held-out split (answers are supplied per Agent A; unseen-question protocol unknown).

## 6. Crowding estimate (ours)

**Medium-to-high interest, concentrated in the weak lane.** Reasoning:
- Prize is modest (EUR 1000 + work trial, CHALLENGES.md:L1614-1624) but a work trial at a well-funded startup is attractive; the track is AI-infrastructure with Verda GPU credits.
- Low barrier: any team with an LLM key can produce a demo, so many entries will be the baseline in section 4. Heavy dataset (10 GB, ~14k drawings across formats) and scoring/overfitting pitfalls deter the lazy lane, and CAD/IFC parsing needs real work.
- Few teams will do multi-format geometry plus fine-tuned detection plus honest cost/accuracy measurement. We estimate 1-3 such teams at most (guess; no participant data available).
- Junction 2025 scale (1,500+ participants) suggests many tracks compete for attention (secondary source).

## 7. What would look different

1. **Format-aware router**: exact answers from IFC (IfcOpenShell), DXF (ezdxf-style block/layer counting) and vector PDF paths; detector/VLM only for raster. Show the route taken per answer.
2. **Evidence as the product**: clickable overlays (boxes, room polygons, highlighted IFC element IDs) generated from the same computation that produced the number, so they are true by construction, not VLM-hallucinated coordinates.
3. **Measured results**: held-out split, Stoa-style scoring, accuracy and EUR per question against a VLM-only baseline, shown on one slide. This directly targets two 25% criteria.
4. **Honest abstention** and confidence, with "show me where it is unsure" overlays.
5. **Cost story**: LLM only for question parsing (small/cheap model, e.g. Nemotron on Verda credits, CHALLENGES.md:L2179-2180 per Agent A), no per-page frontier VLM calls.
6. **Multilingual** (dataset covers ~30 languages per Agent A) handled by the question parser, not per-language engineering.
7. Respect per-file dataset licences and keep credits when displaying drawings (Agent A, dataset README); avoid AGPL/NC weights in anything shown as a product claim.

Risks to flag: unknown scoring protocol and submission format; hidden question set could punish overfit; Stoa's own product already cites pages, so judges will discount that part.

<!-- complete -->
