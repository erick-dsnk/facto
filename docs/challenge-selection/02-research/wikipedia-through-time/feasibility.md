# Wikipedia Through Time (MariaDB): technical feasibility (Agent D)

**Summary**
- **Feasible and low-risk for us.** The whole challenge is software and data. MariaDB publishes all three datasets as GitHub release downloads with no accounts or keys, and gives us two working Python starters: one for RAG, one for time travel through system-versioned tables (SVT). The core is SQL, an LLM call and a web UI, which is squarely our skill set. Estimate: a strong combined entry (RAG plus SVT) is about 70-80% likely to ship in 40 h. A RAG-plus-SVT minimum is about 95% likely.
- **The real risks are data volume and MariaDB vector quirks, not APIs.** The SVT loader for the full 862k-revision dataset M is marked "to do" upstream. Embedding dataset L on a laptop would take about 95 h. Vector inserts are slow, about 50-135 rows/s. A vector index cannot sit on a partitioned table, and the starter's SVT table is partitioned. Filtered vector search is very slow.
- **The demo can run fully offline on one laptop.** Use a local MariaDB in Docker and keep the LLM behind a mock with cached answers. The internet is needed only for the live LLM call. Estimate: demo reliability about 8/10.
- **Decide the architecture in hour 1.** Keep vectors in a separate, non-partitioned table and use SVT for history. Do not try to version the vectors. Load M with our own Parquet loader as a background job started in the first hours. On L, embed one vector per article through a hosted bge-m3 API, not chunks.

---

## 1. What the challenge asks, in brief

Build a tool for Wikipedia readers or editors with MariaDB at the core (CHALLENGES.md:L1914). It can use vector-search RAG with grounded, cited answers (L1918), system-versioned tables for change-over-time queries (L1922), or both (L1926). Five criteria at 20% each include "technical execution and scalability across the provided datasets" (L1987-L1989). Any LLM, embedding model or frontend is allowed (L1960). The data is Finnish Wikipedia, history of Finland (L1954, L1960).

## 2. Architecture a credible entry needs

```
Browser UI (Next.js / React)
   │  question + optional "as of" date / article timeline
   ▼
API (TypeScript or Python; the starters are Python/Flask)
   ├── embed(question)  ── bge-m3 (local Ollama or hosted API; must match stored vectors)
   ├── MariaDB (one server, Docker mariadb:lts)
   │     ├── article            (S/L current text, FULLTEXT)            ← RAG starter schema
   │     ├── chunk_vector       (page_id, rev_id, chunk_no, VECTOR(1024) NOT NULL, VECTOR INDEX) ← NOT partitioned
   │     └── article_hist       WITH SYSTEM VERSIONING (M: 862k revisions, real timestamps via
   │                            system_versioning_insert_history=1, text COMPRESSED)  ← SVT starter schema
   ├── LLM (any hosted model, behind one module with a mock)  → answer with [rev_id] citations
   └── analytics SQL: FOR SYSTEM_TIME AS OF / ALL, LAG(sha1) revert detection, window functions
```

Key design facts behind this layout:
- **Vector index constraints.** Only one vector index per table, and the indexed column must be `NOT NULL` (https://mariadb.com/docs/server/reference/sql-structure/vectors/create-table-with-vectors). Vector indexes are rejected on partitioned tables with `ER_FEATURE_NOT_SUPPORTED_WITH_PARTITIONING` (MariaDB test suite, https://raw.githubusercontent.com/MariaDB/server/11.8/mysql-test/main/vector_partition.test). The SVT starter partitions its history table by `SYSTEM_TIME INTERVAL 1 YEAR` (https://github.com/MariaDB/mariadb-system-versioning-wikipedia), so **it cannot also carry the vector index.** No source says whether a vector index works on a non-partitioned system-versioned table: **unknown**. Test it in the first hour or simply don't depend on it.
- **Query shape.** The optimizer uses the vector index only for ascending `ORDER BY VEC_DISTANCE_*(col, const) LIMIT n` (https://mariadb.com/docs/server/reference/sql-structure/vectors/vector-overview). The RAG starter measured the subquery form at about 1 ms, against about 50 ms for a flat join. `EXPLAIN` alone does not show whether the index is used; check the `Handler_read%` counters instead (https://github.com/MariaDB/mariadb-vector-wikipedia-rag).
- **"As of" RAG without versioned vectors.** This is our recommended design and an estimate. Step 1: vector search over current chunks finds the relevant articles. Step 2: `SELECT text FROM article_hist FOR SYSTEM_TIME AS OF '2015-06-01 00:00:00' WHERE page_id IN (...)` fetches the historical text. Step 3: chunk and embed that text on the fly (a few articles take well under a second through the API), rerank, and answer with citations to (page_id, rev_id, date). A diff against the current text gives "what changed since", and `FOR SYSTEM_TIME ALL` names the edits responsible. This delivers the sponsor's own example question (CHALLENGES.md:L1926) without embedding 862k revisions.
- **Avoid filtered vector search as the main path.** Percona measured MariaDB at 0.4-0.5 QPS for vector search filtered to 1% selectivity (https://www.percona.com/?p=55277). The RAG starter measured 2.1 s for a category filter covering all articles (RAG starter README). Do the top-k first and filter afterwards, or filter inside the subquery only on small sets.

## 3. Critical dependencies and how we get them

| Dependency | Access | Notes / source |
|---|---|---|
| Dataset S (29k fi/sv/en articles, bge-m3 vectors) | GitHub Release `s-2026-10`, 156 MB; RAG starter `load.py --vectors` (119 MB Parquet) | Empty DB to searchable: 2 min 40 s (https://github.com/MariaDB/mariadb-vector-wikipedia-rag) |
| Dataset M (862,076 revisions of 19,742 articles, raw wikitext) | Release `m-2026-10`, 315 MB in 16 Parquet files; about 12.2 GB raw, estimated 5-7 GB in MariaDB | Loading M Parquet into the SVT schema is **"to do"** upstream (https://github.com/MariaDB/mariadb-wikipedia-datasets). The SVT starter loads only 50 articles (31,848 versions, about 1.2 GB) from 7z dumps; its full-list load is also "to do" (https://github.com/MariaDB/mariadb-system-versioning-wikipedia). **We must write this loader.** |
| Dataset L (568,416 fi articles, no vectors, no categories) | Release `l-2026-10`, 495 MB, one file | (https://github.com/MariaDB/mariadb-wikipedia-datasets) |
| MariaDB Server ≥ 11.7 (vectors), ≥ 10.11 (insert_history) | Docker `mariadb:lts` (12.3.3 when tested), about 0.4 GB image | Starter READMEs |
| Embedding model bge-m3 (1024-dim) | Local Ollama (`ollama pull bge-m3`) or hosted. DeepInfra lists bge-m3 at $0.010 per 1M tokens, 8,192-token context (https://deepinfra.com/BAAI/bge-m3). Rate limits not published there (only an optional 429 "fail fast") | Ollama needs `num_ctx` **and** `num_batch` set to 8192, or inputs over 2,048 tokens are refused or silently cut (RAG starter). Queries must use the same model as the stored S vectors. Mixing Ollama-computed S vectors with hosted bge-m3 query vectors is probably fine but untested (estimate). |
| LLM for answers | Any provider (CHALLENGES.md:L1960). Our own API key | Pricing and limits were not researched here (provider choice is open). Finnish-language quality matters. |
| Mentors | Kaj Arnö, Robert Silén on site throughout (CHALLENGES.md:L1972-L1973) | The README author's own "open questions" match our design questions. |

No credentials, devices or sponsor accounts are required. External rate limits only matter if we rebuild datasets from source: Hugging Face throttles anonymous requests, and the Wikipedia API allows 200 requests per minute per IP (RAG starter README). **Don't rebuild; use the release files.**

## 4. Documented limits, latency and reliability problems

- **Vector insert throughput is the main scale bottleneck.** The graph is updated on every INSERT, so loading is the index build. Percona measured 990k vectors (1536-dim) at 3.6 h on 11.8 (75.9 rows/s) and 5.4 h on 12.3 (50.7 rows/s), with a 30 GB graph cache and about 28 GiB peak RSS (https://www.percona.com/?p=55277). The starter rebuilt 28,345 vectors in 3.5 min, about 135 rows/s (RAG starter). Estimates:
  - **L at one vector per article** (568k): roughly 1.5-4 h of inserts. Feasible as an overnight background job.
  - **L chunked** (millions of chunks): **not feasible** in 40 h.
  - **Chunking S** (about 30k articles, roughly 150-300k chunks): about 20-60 min. Feasible.
- **Default `mhnsw_max_cache_size` is 16 MB.** Percona calls leaving it at the default unfair, and the starter left it at the default and called its effect "unverified". Raise it for L (estimate: a few GB).
- **Recall depends on parameters.** The defaults (M=6, ef_search=20) gave only 79% recall@10. M=16 with ef_search=80 gave 100%, at a median of 5.4 ms on 28k vectors (RAG starter). Set `M=16` at build time; it cannot be changed later.
- **Embedding on a laptop is slow.** About 100 articles/min on an M4 MacBook Air (RAG starter). Embedding L locally would take about 95 h (estimate from that rate): **infeasible**. A hosted API is cheap: L is about 1.4 GB of text, which we estimate at roughly 300-450M tokens, so about $3-5 at $0.01/M. But throughput depends on rate limits that are not published (**unknown**). A GPU (the Verda side challenge, CHALLENGES.md:L2136-L2141) is the alternative.
- **Query latency is fine.** About 60 ms end to end for vector search including question embedding, and a cold first query of about 1.6 s while Ollama loads the model (RAG starter). SVT "as of" queries take 0.04-0.65 ms, and rendering the 2,143-version Talvisota history takes 42 ms (SVT starter). The LLM call will dominate at about 2-10 s (estimate).
- **Retrieval quality baseline.** Whole-article vectors give hit@10 of 86% and hit@1 of 57% on 37 questions, with Finnish hit@1 at only 38%. Single-fact biography questions miss. FULLTEXT has no Finnish stemming and gets 0% on Finnish-only answers (RAG starter). Chunking and hybrid search are needed for a credible "grounded answers" claim.
- **SVT gotchas** (SVT starter README):
  - Prepared `TIMESTAMP ?` parameters need a full datetime, not a bare date.
  - Altering the table needs `system_versioning_alter_history = KEEP`.
  - Every version stores a full copy of the text. M is about 12 GB raw; the estimated 5-7 GB in the DB requires `COMPRESSED` columns.
  - Load in batches of 8 MB or less (the default max packet is 16 MB).
  - Edits in the same second need a microsecond nudge so their order is kept.
  - Set the timezone to `+00:00` everywhere.
- **Data caveats.** S and L are from an August 2025 snapshot while M is from October 2026, so "current" text differs between datasets. Hidden revisions are missing. 19% of M edits are anonymous. M text is raw wikitext, not Markdown, so it needs stripping before chunking or diffing (https://github.com/MariaDB/mariadb-wikipedia-datasets).

## 5. Integration complexity for our team

Low to moderate. No unfamiliar SDKs: everything is SQL, Python or TS, HTTP to an LLM, and a frontend. Where effort is required (estimates):
- **M loader** (Parquet to SVT with `system_versioning_insert_history`, batching, timestamp ordering, compression, resumability): 3-5 h to write and test, plus an **unknown wall-clock load time**. The starter's 50 articles loaded in 17 min 40 s from 7z, but that figure includes dump parsing. Our estimate for 12 GB is 1-4 h on a laptop SSD. Start it by hour 6 at the latest.
- **Chunking, hybrid RRF and evaluation**, reusing the starter's 37-question `evaluate.py`: 4-6 h.
- **Temporal RAG endpoint** (AS OF fetch, on-the-fly chunking, citation format, diff): 4-6 h.
- **Edit-war and revert analytics** (sha1 LAG/MIN window query already in the starter, extended to all of M with a per-article leaderboard): 2-4 h.
- **UI** (timeline slider, diff view, cited-answer panel): 6-10 h, parallelisable across agents.
- **Scale evidence** (S/M/L latency table, index build times): 2-3 h, mostly waiting.

The Python starters versus our TypeScript preference: either keep a thin Python data and load layer and put the app in TS, or go all-Python with Flask. The choice does not matter to the judges (estimate).

## 6. Does the core fit in 40 h? Smallest complete version

**Smallest complete version** (about 95% confidence, roughly 15-20 h of work):
1. S loaded with the provided vectors, plus an "Ask" endpoint giving LLM answers with article and rev_id citations. This closes the starter's missing step 7.
2. SVT history for a **subset** of M, for example 500-2,000 articles chosen by edit count, loaded with real timestamps.
3. A "time machine" view: a question plus a date returns an answer grounded in `AS OF` text, a diff against today, and a list of the edits (user, comment, time) in between.
4. A revert and edit-war panel using the sha1 window query.
5. A scale table: S full, M subset with measured load rate extrapolated, and L article-level search, even if only partly embedded.

**Strong version** (about 70-80% confidence): all of M loaded, chunked hybrid retrieval showing a measured hit@k gain over the 86% baseline, and L fully embedded at article level with latency numbers. Of these, the full-M load and the L embedding are the parts most likely to slip. Both are background jobs that fail quietly; check them every few hours.

## 7. Live demo: likelihood and failure modes

Estimate **8/10**. Everything except the LLM call runs locally.

Specific ways it fails:
- **Venue Wi-Fi or LLM outage.** Mitigation: cache the scripted demo questions' answers behind the mock module, and optionally fall back to a local Ollama LLM.
- **Cold-start latency.** Ollama's first query takes about 1.6 s, and a large MariaDB buffer pool is cold after a restart. Mitigation: warm-up script before going on stage.
- **Wrong-but-confident answers in Finnish.** A judge asks an off-script question, retrieval misses (hit@1 is only 57% at baseline), and the LLM fills the gap from its own priors. This is exactly the NPOV concern the sponsor raises (CHALLENGES.md:L1946). Mitigation: refuse when retrieval scores fall below a threshold, and show the passages.
- **The optimizer silently skips the vector index after a query refactor.** Search then drops to about 2 s (full scan measured at 1.8-2.1 s on 28k rows, RAG starter) or far slower on L. Mitigation: a regression test on `Handler_read%`.
- **The background M load or L embed did not finish or corrupted ordering.** Mitigation: resumable loaders (the starters' pattern), plus a pre-demo row-count check.
- **Laptop disk or RAM.** M takes 5-7 GB plus about 1 GB for L plus indexes. A large `mhnsw_max_cache_size` competes with Docker's memory limit on Mac. Estimate: you need at least 30 GB free disk and at least 16 GB RAM.
- **Raw wikitext in diffs looks ugly on screen.** Strip templates and refs before display.

## 8. Ask the sponsor on site before committing

1. Is the SVT table expected to hold all of M, or is a well-chosen subset plus extrapolated numbers acceptable for "scalability across the provided datasets"?
2. Do they have a tested loader for M Parquet into SVT, or load-time measurements? Upstream marks both as "to do".
3. Does a `VECTOR INDEX` on a non-partitioned `WITH SYSTEM VERSIONING` table work, and is it advisable? (Not documented; partitioned tables are confirmed unsupported.)
4. Recommended `mhnsw_max_cache_size`, and `M` / `ef_search` for 568k vectors on L. Is MariaDB 11.8 or 12.3 faster for bulk vector inserts? Percona found 11.8 built faster.
5. Do the judges expect L to be embedded, or is keyword plus article-level vectors on L enough? Do they have pre-computed L vectors?
6. Is a hosted embedding API acceptable, or do they prefer self-hosted models (an open-source ethos)?
7. Submission deliverables (repo, video, deployed URL), the deadline, and whether a demo on localhost is fine. **Unknown.** The general Junction 2026 rules were not found online.
8. Who judges: the two mentors only, or others? (Unknown per Agent A.)

## Sources opened
- /Users/ciprian/code/Junction 26/docs/JUNCTION_2026_CHALLENGES.md L1898-L2027
- /Users/ciprian/code/Junction 26/docs/challenge-selection/01-challenge-intelligence/wikipedia-through-time.md (Agent A)
- https://github.com/MariaDB/mariadb-wikipedia-datasets
- https://github.com/MariaDB/mariadb-vector-wikipedia-rag
- https://github.com/MariaDB/mariadb-system-versioning-wikipedia
- https://mariadb.com/docs/server/reference/sql-structure/vectors/vector-overview
- https://mariadb.com/docs/server/reference/sql-structure/vectors/create-table-with-vectors
- https://raw.githubusercontent.com/MariaDB/server/11.8/mysql-test/main/vector_partition.test
- https://www.percona.com/?p=55277 (Percona vector benchmark across six engines)
- https://deepinfra.com/BAAI/bge-m3
- Searched without a usable result: the Junction 2026 general rules (unknown)

<!-- complete -->
