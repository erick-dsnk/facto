# Wikipedia Through Time (MariaDB)

**Summary**
- MariaDB wants a useful, original tool for Wikipedia readers or editors with MariaDB at its core, using native vector search (RAG track), system-versioned tables (SVT track), or both (CHALLENGES.md:L1906, L1914-L1926).
- Judging uses five criteria at 20% each: MariaDB use, implementation and scalability across the datasets, usefulness, design and demo, and originality. SVT or combined entries get a "bonus" weighted at 0% (CHALLENGES.md:L1983-L2005).
- MariaDB supplies real data: three Finnish "history of Finland" datasets (S has pre-computed bge-m3 vectors in fi/sv/en, M has 862k revisions, L has all 568k Finnish articles), plus two working starter repos. No hardware is involved.
- 1st prize is €1,000 cash, €1,000 in UpCloud credits and MariaDB certification vouchers (CHALLENGES.md:L1934). The prize is small, but the scope is tight and suits our web, AI-agent and data skills. A plain RAG chatbot is the obvious entry that will fail to stand out. The winning space is the SVT or combined track: time-travel RAG and edit-war or narrative-drift analytics.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Wikipedia Through Time | CHALLENGES.md:L1898 |
| Original page | https://hackjunction.app/participate/45/challenges/307 (not opened; the transcription says the page showed "Closed") | CHALLENGES.md:L1900, L5 |
| Sponsor | MariaDB (MariaDB Foundation mentors) | CHALLENGES.md:L1902, L1972-L1973 |
| Track | Data Track (the `## Data Track` heading at L1629 is the nearest track heading above; the next is FinTech at L2028) | CHALLENGES.md:L1629, L2028 |
| Main requirement | "build a tool for Wikipedia that doesn't exist yet, or that exists but is badly underused, with MariaDB at the core of your stack", in the RAG, SVT or combined track | CHALLENGES.md:L1914-L1926 |
| Judging emphasis and weights | Effective and creative use of MariaDB 20%; Implementation (technical execution and scalability across the provided datasets) 20%; Usefulness for readers or editors 20%; Design and demo quality 20%; Originality 20%; Bonus for SVT or combined 0% | CHALLENGES.md:L1983-L2005, also L1930 |
| Prize | 1st: €1,000 cash, €1,000 UpCloud credits and a MariaDB certification for every team member (5 vouchers, value USD 750). 2nd: €500. 3rd: €250. All winners credited in a mariadb.org blog post | CHALLENGES.md:L1934-L1940, L2009-L2023 |
| Provided software | MariaDB Server (open source) with native vector search; system-versioned tables | CHALLENGES.md:L1960 |
| Provided data | Small, medium and large datasets drawn from Finnish Wikipedia (history of Finland). Details from the repo: S has 19,285 fi, 4,921 sv and 5,254 en articles as clean Markdown, with pre-computed bge-m3 1024-dim vectors and a category tree. M has 19,742 fi articles and **862,076 revisions** of raw wikitext (12.2 GB raw, 315 MB download, about 5-7 GB in MariaDB), with user, comment, minor, sha1 and bytes columns. L has 568,416 fi articles (all of Finnish Wikipedia, current versions, 1.4 GB text) with no vectors. Text is licensed CC BY-SA 4.0 | CHALLENGES.md:L1960; https://github.com/MariaDB/mariadb-wikipedia-datasets |
| Starter code | RAG starter: Python and Flask, Ollama bge-m3, a `VECTOR(1024)` column with `VECTOR INDEX ... DISTANCE=cosine` and `VEC_DISTANCE_COSINE`. It does semantic search only and has no "Ask" or LLM step, no chunking and no hybrid search. SVT starter: 50 articles with 31,848 versions loaded with real edit timestamps through `system_versioning_insert_history=1`, queried with `FOR SYSTEM_TIME AS OF / ALL`. It has a timeline, revert view and two-date compare. Both were developed on MariaDB 12.2.2 | https://github.com/MariaDB/mariadb-vector-wikipedia-rag ; https://github.com/MariaDB/mariadb-system-versioning-wikipedia |
| Provided hardware | None | CHALLENGES.md:L1958-L1960 |
| Freedom of stack | "Teams are free to pair MariaDB with any LLM, embedding model or frontend framework of their choice." | CHALLENGES.md:L1960 |
| Mentors | Kaj Arnö (MariaDB Foundation Executive Chairman) and Robert Silén (MariaDB Foundation AI Lead), on site throughout | CHALLENGES.md:L1970-L1973 |
| Submission requirements | Unknown. The challenge text states no challenge-specific deliverables such as a repo, video or deploy URL. General Junction submission rules are not in CHALLENGES.md for this challenge | CHALLENGES.md:L1898-L2024 |
| Judges | Unknown by name. The challenge text names no judges, and the jury PDF does not mention MariaDB (searched with pdftotext). Estimate: the two mentors are likely judges | CHALLENGES.md:L1972-L1973 (mentors only) |
| Related side challenge | Verda "Best Use of Verda" explicitly suggests "Embed MariaDB's full Wikipedia dataset with batch jobs and serve a RAG assistant on top." Embedding dataset L on GPUs would serve both challenges | CHALLENGES.md:L2136-L2141 |

## 2. What the sponsor is actually trying to encourage

**Reading:** MariaDB wants showcase material proving that MariaDB is an AI-era database: vector search plus temporal tables in a single SQL engine, on the data of its flagship user, Wikipedia. It especially wants the under-marketed system-versioned tables to look compelling. The output it wants is code and demos it can blog about and reuse in tutorials.

Evidence:
- The framing stresses that MariaDB stores Wikipedia but its potential is "untapped": search is keyword-based and edit history is "rarely explored" (CHALLENGES.md:L1910).
- SVT is singled out for "added technical ambition" (CHALLENGES.md:L1930, L2005). The Insight section says they are "especially excited by 'time-travel' tools" (CHALLENGES.md:L1950).
- "Scalability across the provided datasets" is a scored criterion (CHALLENGES.md:L1989). They built S/M/L so that teams "prototype fast and then prove their tool scales" (CHALLENGES.md:L1960). A demo that runs on S only will score lower.
- The RAG starter ends with an unbuilt "Ask" step and lists its own gaps: one vector per article, no chunking, no hybrid RRF, and FULLTEXT with no Finnish stemming. These gaps are what the sponsor expects teams to close (https://github.com/MariaDB/mariadb-vector-wikipedia-rag).
- The NPOV remark (CHALLENGES.md:L1946) and "verify and trust", "bias detection" and cross-language comparison (CHALLENGES.md:L1950) show they want grounding that is faithful to Wikipedia, not to the LLM's prior knowledge.
- Precedent: in MariaDB's 2025 AI RAG hackathon, a Wikipedia RAG editing assistant ("Wikipedia Enhancer") was only the innovation runner-up. A YouTube semantic search tool won (https://mariadb.org/youtube-semantic-search-hackathon-winner-innovation-track/, per search-result summary; page not opened). Inference: a basic Wikipedia RAG assistant has been done in front of these judges before.
- Blog credit for all winners (CHALLENGES.md:L1940) supports the "showcase content" reading.

## 3. Explicit requirements (quoted)

- "build a tool for Wikipedia that doesn't exist yet, or that exists but is badly underused, with MariaDB at the core of your stack." (CHALLENGES.md:L1914)
- RAG track: "use MariaDB's native vector search to build retrieval-augmented generation (RAG) functionality that let people ask questions of Wikipedia and get grounded, source-cited answers" (CHALLENGES.md:L1918)
- SVT track: "use MariaDB system-versioned tables (SVT) to build tools that query how knowledge changes over time" (CHALLENGES.md:L1922)
- Both: "combine the two, for example a RAG assistant that can answer 'what did Wikipedia say about this in 2015, and what has changed since?'" (CHALLENGES.md:L1926)
- "Judges will focus on effective and creative use of MariaDB RAG and/or system-versioned tables, technical execution and scalability across the provided datasets, real-world usefulness for Wikipedia readers or editors, and design and demo quality." (CHALLENGES.md:L1930)
- "The source articles are in Finnish, so a multilingual embedding model is recommended for the RAG track" (CHALLENGES.md:L1954). This is a recommendation, not a rule.

## 4. What a mediocre submission looks like

- A chat UI over dataset S that calls `VEC_DISTANCE_COSINE`, stuffs the top-k whole articles into an LLM and prints titles as "sources". It is essentially the starter repo plus the missing "Ask" step.
- Runs on S only, with no evidence on M or L. That loses the 20% "scalability across the provided datasets" criterion.
- Citations at article level rather than passage level, and no check that the answer is supported by the cited text. Answers drift toward the LLM's own world view, which the sponsor flags explicitly (CHALLENGES.md:L1946).
- MariaDB used as a dumb vector store, with the logic in Python or a separate vector DB. Or SVT mentioned in the pitch but not exercised through `FOR SYSTEM_TIME` queries.
- A generic demo question in English ("tell me about the Winter War") with no reason why a Wikipedia reader or editor needs this tool.

## 5. What an exceptional submission would demonstrate (estimates)

- **Combined track with a strong narrative.** Example: "Wikipedia time machine". You ask a question and get a cited answer as of a chosen date, plus a diff of how the answer changed and which edits (user, comment, timestamp, rev_id) changed it. All of this comes from `FOR SYSTEM_TIME AS OF` joined with vector retrieval over chunks, ideally in a single SQL query.
- **Real SVT depth on dataset M** (862k revisions), not just the 50-article starter. Load with real timestamps (the starter's `system_versioning_insert_history` technique). Then run analytics: revert and edit-war detection through sha1 identity reverts (a known gap: XTools only detects reverts by the immediately following edit, per https://xtools.readthedocs.io/en/3.3.9/tools/articleinfo.html), contentious-section heatmaps, and "how the story of event X was rewritten" timelines.
- **Measured retrieval quality.** Chunked embeddings, hybrid vector plus FULLTEXT with RRF, and a hit@k comparison against the starter's published 86% hit@10 on its 37 questions (https://github.com/MariaDB/mariadb-vector-wikipedia-rag). Show a numeric improvement on the slide.
- **Scale proof.** The same tool running on L (568k articles): embedding times, index build, query latency at S, M and L. A GPU batch embed could double as a Verda side-challenge entry (CHALLENGES.md:L2141).
- **Trust features.** Passage-level citations with deep links to the exact rev_id, answers that refuse when the evidence is absent, cross-language (fi/sv/en via wikidata_id in S) comparison of coverage gaps or framing differences (CHALLENGES.md:L1950).
- **A clear user.** An editor-facing tool (for example "show me unsourced claims that appeared during an edit war") or a reader-facing one, demoed live with a polished timeline visualisation.

## 6. Constraints that could disqualify or sink a project

- MariaDB not at the core: using another vector DB or temporal store would fail the main requirement (CHALLENGES.md:L1914). Estimate: probably disqualifying in practice.
- Not using the provided datasets: "scalability across the provided datasets" is 20% of the score (CHALLENGES.md:L1989). Using other data is not stated as forbidden (unknown).
- Licence: Wikipedia text and the S vectors are CC BY-SA 4.0, so attribution and share-alike apply (https://github.com/MariaDB/mariadb-wikipedia-datasets). Estimate: low risk, but credit the source in the UI.
- Formal submission rules, deadlines and repo or video requirements: unknown from the challenge text.
- Practical risks (estimates): M needs about 5-7 GB in MariaDB and a long load. Embedding S yourself takes about 5 hours on a laptop (use the provided vectors). Embedding L is not pre-done. Vector search needs MariaDB ≥ 11.7 and `system_versioning_insert_history` needs ≥ 10.11 (starter READMEs). The vector index is not always chosen by the optimizer, so query shape matters (RAG starter README).

## 7. Physical hardware work

**None.** This is a pure software and data challenge. No devices are provided or needed (CHALLENGES.md:L1958-L1960). The only "hardware" concern is compute: disk and RAM for dataset M, and optionally a GPU for embedding dataset L faster (Verda is available as a side challenge, CHALLENGES.md:L2136-L2141).

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L1629, L1898-L2027, L2120-L2145
- https://github.com/MariaDB/mariadb-wikipedia-datasets
- https://github.com/MariaDB/mariadb-vector-wikipedia-rag
- https://github.com/MariaDB/mariadb-system-versioning-wikipedia (the challenge text's third link has this label but its href points to the RAG repo, CHALLENGES.md:L1966; the SVT repo exists at the labelled URL)
- Web search results only (pages not opened): mariadb.org 2025 AI RAG hackathon winners; XTools Page History docs
- Jury PDF: searched with pdftotext for "MariaDB" or "Wikipedia" and found no matches

<!-- complete -->
