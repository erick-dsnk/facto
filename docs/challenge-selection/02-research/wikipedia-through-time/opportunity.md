# Wikipedia Through Time: opportunity discovery (Agent C)

**Summary**
- The open space is the *combined* track. Most teams will build the RAG chatbot, which is the starter's TODO. The sponsor's own SVT starter lists "combine with the RAG demo" as a step still marked "later" (https://github.com/MariaDB/mariadb-system-versioning-wikipedia). Nobody owns time-aware, revision-cited answers yet.
- Two MariaDB capabilities are badly underused and fit Wikipedia closely. The first is **bitemporal tables**: application-time `PERIOD FOR` combined with system versioning, so the database can hold both when a historical event happened and when Wikipedia said it. The second is **vector search over historical versions**. Neither appears in the starters.
- Cheap LLM extraction over 862k revisions now makes *claim-level* history practical: when a fact appeared, who added it, whether it was sourced, how long it survived, and what an edit war was about. Older tools work at the token or byte level (WikiWho, History Flow).
- The best demo shape is to ask the same question "as of 2010" and "now", then click through to the exact edit that changed the answer. A non-expert gets the before/after in about 30 seconds (estimate).
- Stackable honestly: Verda (named for this exact use, CHALLENGES.md:L2141), Gemini API or Gemma (the LLM step), Codex, and optionally Modal or Oxylabs. Database tech challenges (MongoDB, Tiger Data, Aiven) conflict with "MariaDB at the core" and are weak fits.

Sources used: CHALLENGES.md:L1898-L2027, Agent A's report (`../../01-challenge-intelligence/wikipedia-through-time.md`), Agent B's report (`competitive.md`), plus the URLs cited inline. Web search hit the session budget partway through, so some background claims are labelled estimates rather than sourced.

---

## What the sponsor gives us that others will underuse

| Capability | What the docs say | Used by starters? | Source |
|---|---|---|---|
| `FOR SYSTEM_TIME AS OF / BETWEEN / FROM..TO / ALL` | Point-in-time and range queries over history | AS OF and ALL: yes (SVT starter) | https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/system-versioned-tables |
| `system_versioning_insert_history` (10.11+) | Lets you insert history with real past timestamps | Yes (SVT starter) | same |
| Partitioning `BY SYSTEM_TIME ... AUTO` | Separates current and historical rows | Yes (yearly, 26 partitions) | same; SVT starter README |
| Transaction-precise history, `AS OF TRANSACTION` | InnoDB only; not combinable with SYSTEM_TIME partitioning | No | system-versioned-tables doc |
| `WITHOUT SYSTEM VERSIONING` columns | Exclude a column, such as a mutable vector or score, from history | No | same |
| **Bitemporal tables** (`PERIOD FOR application_time` + `WITH SYSTEM VERSIONING`) | Versions data on both the valid-time axis and the system-time axis | **No** | https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/bitemporal-tables |
| `VECTOR(n)` + `VECTOR INDEX` (modified HNSW, `M` 3-200, cosine/euclidean) | Index is used only with `ORDER BY VEC_DISTANCE..() LIMIT k`. **One vector index per table**; the indexed column must be NOT NULL. GA from 11.8 | One vector per article (RAG starter) | https://mariadb.com/docs/server/reference/sql-structure/vectors/vector-overview ; https://sources.debian.org/src/mariadb/1%3A11.8.3-1/mysql-test/main/vector.result (search snippet, not opened) |
| `INFORMATION_SCHEMA.VECTOR_INDEXES` (13.1+) | Index size, nodes, cache memory | No | vector-overview doc |
| Dataset fields | M: `parent_id`, `user`, `anonymous`, `comment`, `minor`, `sha1`, `bytes`, `timestamp` per revision. S: `wikidata_id` links fi/sv/en (2,919 topics in all three) and a category tree. L: 568k current fi articles, no vectors, no categories | Partly | https://github.com/MariaDB/mariadb-wikipedia-datasets |

Technical unknown that matters for areas 1 and 3: the docs do not say how a `VECTOR INDEX` behaves on a system-versioned table. They do not say whether history rows are in the HNSW graph, or whether `AS OF` is applied after the `LIMIT`. Unknown. A related bug (MDEV-35246) involved a versioned table that returned fewer vector results than `LIMIT`. It was fixed in 11.7.1, and no limitation was documented (https://jira.mariadb.org/browse/MDEV-35246). The safe estimate is a separate non-versioned `chunk_vectors` table with explicit `valid_from`/`valid_to` columns, joined to the versioned article table. Asking the mentors (Robert Silén, AI Lead, CHALLENGES.md:L1973) on Friday night is cheap and could itself turn into a MariaDB blog-worthy finding.

---

## Opportunity 1: Time-aware retrieval ("ask Wikipedia as of a date") with revision-level citations

**Gap.** RAG over Wikipedia retrieves only current text and cites only at article level. The challenge's own example of the combined track asks "what did Wikipedia say about this in 2015, and what has changed since?" (CHALLENGES.md:L1926). The sponsor's SVT starter leaves "combine with RAG" as a later step and suggests "one vector per year per article" without building it (https://github.com/MariaDB/mariadb-system-versioning-wikipedia). Agent B found no tool that combines an as-of-date view, grounded Q&A over a past version and edit attribution (competitive.md §3, estimate from limited search).

**Evidence of the opening.**
- RAG starter: one vector per article, no chunking, no Ask step, and it misses facts inside long articles (Agent A §1; https://github.com/MariaDB/mariadb-vector-wikipedia-rag).
- The SVT starter loaded only 50 of the ~19,750 articles, at about 1.2 GB on disk, because every version is a full copy (SVT README). Doing time-aware retrieval across dataset M needs real data-modelling work: deltas, per-year snapshots, or embeddings only for changed sections. That work is the differentiation.

**Why the sponsor cares.** This is the challenge's flagship "BOTH (for very advanced teams)" example (CHALLENGES.md:L1924-L1926), it scores against "effective and creative use of MariaDB" (L1983-L1985), and it fills the gap in their own starter. One SQL statement that mixes `VEC_DISTANCE_COSINE` with `FOR SYSTEM_TIME AS OF` is exactly the kind of snippet MariaDB can put in a blog post (inference).

**How it reads to the overall jury.** It is legible: you ask a question, slide the date, and the answer changes with a link to the edit. It shows technical depth if we measure it, for example time-aware vs current-only retrieval on questions whose answer changed (an honest metric, rubric 15%). The problem framing has to name a user, such as an editor auditing a contested article or a journalist checking what was "known" at a date. Otherwise it reads as a tech demo (estimate).

**Before/after demo.** Ask "Kuinka monta ihmistä kuoli sisällissodassa?" ("How many people died in the Civil War?") as of 2006 and as of now. Show the two answers side by side, with the rev_id, editor and edit comment that changed the figure. The example is illustrative: whether this particular figure changed in the data is unknown until we check dataset M.

## Opportunity 2: Claim-level history ("git blame for facts") and semantic edit-war explanation

**Gap.** Existing provenance tools work at the token or byte level. WikiWho / Who Wrote That? shows who wrote each token (https://meta.wikimedia.org/wiki/Community_Tech/Who_Wrote_That_tool/en). History Flow and WikiWash visualise text flow (competitive.md §3). The SVT starter detects reverts by SHA-1 and colours "edit war" months, but it cannot say *what* was being fought over. XTools counts only reverts made by the immediately following edit (Agent A §5, citing https://xtools.readthedocs.io/en/3.3.9/tools/articleinfo.html). Nothing we found gives a *claim* lifecycle: when a factual statement first appeared, whether it carried a `<ref>`, which edits changed its wording, whether it was reverted, and how long it survived (estimate, limited search).

**Why now.** Extracting atomic claims and matching them across thousands of revisions per article needs an LLM plus embeddings. *Suomen sisällissota* has 3,357 versions and *Talvisota* 2,143 (SVT README). Doing this by rule-based diffing was impractical at hackathon scale before cheap fast LLMs and batch GPUs (estimate). We only need to process the *changed* paragraphs between consecutive revisions. `parent_id` and `sha1` in dataset M make that diff set small (dataset README).

**Evidence of demand.** The challenge's own insight section asks for tools that help "verify and trust", "detecting gaps and weak spots", "edit wars or bias detection, and edit-history analytics" (CHALLENGES.md:L1950). It names editors as a valid user group (L1948). Wikimedia's own *Citation Needed* AI experiment drew about 1,000 installs, but sustained usage was "low/nonexistent". The likely reasons given were that it was too manual and that misinformation is "more subtle and systemic" than single claims (https://meta.wikimedia.org/wiki/Future_Audiences/Experiment:Citation_Needed). Inference: a tool that surfaces systemic patterns in context, such as unsourced claims that entered during an edit war, addresses that lesson better than another paste-a-claim checker.

**Why the sponsor cares.** It uses SVT for what it is uniquely good at, `FOR SYSTEM_TIME BETWEEN` over a claim's lifetime. It also uses vectors to match a claim across rewordings, so it scores on both the bonus axis (L2005) and originality (L1999).

**How it reads to the overall jury.** It has a distinctive insight: semantic diffs instead of text diffs. The specific user is an editor or patroller. The honest-evidence metric could be precision of claim matching on a hand-labelled sample. The risk is that it reads as niche to peers who don't edit Wikipedia, so the demo needs a vivid single case (estimate).

## Opportunity 3: Bitemporal history: "when it happened" vs "when Wikipedia said so"

**Gap.** History articles mix two timelines: the *event* (1918) and the *telling* (edits from 2003 to 2026). MariaDB natively supports bitemporal tables, application-time `PERIOD FOR` plus `WITH SYSTEM VERSIONING` (https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/bitemporal-tables). Neither starter touches application-time periods, and we found no Wikipedia tool that models both axes (estimate). The challenge text explicitly invites "tracing how the story of a historical event has been rewritten" (CHALLENGES.md:L1922).

**What it enables.** An LLM extracts dated facts ("event, valid-from, valid-to, value, source rev_id") into an application-time-period table, versioned by edit time. A query can then ask: "As Wikipedia stood in 2010, what did it say happened in Tampere in April 1918, and how has that account changed since?" The result is a two-axis visual: event time on X, edit time on Y. This is the "narrative drift" idea Agent B flagged (competitive.md §8), done with a native database feature rather than in Python.

**Why the sponsor cares.** Bitemporal support is an advanced, rarely demonstrated MariaDB feature. Showing it on its flagship user's data is showcase material. It is an inference, but a strong one, given the stress on "added technical ambition" for SVT (L1930) and the blog credit for winners (L1940).

**How it reads to the overall jury.** It has a distinctive insight and a beautiful visual if it works. The risk is legibility: "bitemporal" needs a one-sentence explanation at the peer table. The Finnish Civil War is a historically contested topic (well known, not sourced here; estimate), and that makes a strong story for a Helsinki audience. Feasibility risk is medium-high: LLM extraction quality on Finnish wikitext is unknown, so scope it to a handful of articles and show measured extraction accuracy.

## Opportunity 4: Cross-language framing and coverage gaps (fi / sv / en, and S vs L)

**Gap.** The challenge says "Comparing the same article between languages can reveal surprising insights" (CHALLENGES.md:L1950) and points out that LLM world views differ from Wikipedia's NPOV (L1946). Dataset S links 2,919 topics across fi, sv and en via `wikidata_id`, with bge-m3 multilingual vectors already computed (dataset README). Dataset L holds all 568k Finnish articles (same). Two gaps are open:
- **Framing divergence:** aligning passages across languages with multilingual vectors, then using an LLM to classify differences as omission, emphasis or contradiction. Topics such as the Finnish Civil War or Åland likely read differently in Swedish and Finnish (estimate).
- **Coverage gaps:** topics that are rich in en/sv but thin or missing in fi, or Finnish-history articles in L that fall outside S's category tree. This is an editor's to-do list, matching "detecting gaps and weak spots in article coverage" (L1950).

**Limits.** Only Finnish has revision history (dataset M is fi only), so this area is RAG-only unless it is combined with area 1 or 2. Agent B lists plain cross-language comparison as an obvious idea (competitive.md §5), so the distinctive part has to be the claim-level alignment and an editor work queue, not a side-by-side view.

**Jury read.** It is legible ("Swedish Wikipedia says X, Finnish says Y"), and peers grasp it fast. The direct link to MariaDB SVT is weaker, so it is a good *feature* of a combined tool rather than a standalone entry (estimate).

## Opportunity 5: Scale as a feature: full-Wikipedia, chunked, hybrid, measured

**Gap.** "Scalability across the provided datasets" is 20% of the partner score (CHALLENGES.md:L1987-L1989). The starter publishes a baseline of 86% hit@10 on 37 questions, and lists chunking and hybrid RRF as TODOs (https://github.com/MariaDB/mariadb-vector-wikipedia-rag). Dataset L has no vectors at all (dataset README). Verda's bounty literally suggests "Embed MariaDB's full Wikipedia dataset with batch jobs and serve a RAG assistant on top" (CHALLENGES.md:L2141).

**Opportunity.** Use batch GPUs to chunk and embed L (568k articles, 1.4 GB text) and load it into MariaDB. Then report a benchmark panel: load time, index size (via `INFORMATION_SCHEMA.VECTOR_INDEXES` on 13.1+), p50/p95 latency at S/M/L, and hit@k against the starter's 86%. Index and cache tuning (`M`, `mhnsw_max_cache_size`) are documented knobs most teams won't touch (vector-overview doc).

**Why the sponsor cares.** It directly answers their "prototype fast and then prove their tool scales" intent (L1960) and stress-tests their vector index on a realistic corpus. Their 2025 hackathon rewarded deep vector engineering such as an adaptive query optimizer (competitive.md §1, https://mariadb.org/hackathons/).

**Jury read.** On its own this is infrastructure. It feeds the overall rubric's "honest measured evidence" (15%) and "credible scale step" (15%), but it is not a story. Treat it as the backbone under area 1 or 2, not as the headline (estimate).

---

## Combinations that are new (summary)

| Combination | What becomes possible | Areas |
|---|---|---|
| `FOR SYSTEM_TIME AS OF` + vector top-k in one query (or a valid-time vector side table) | Time-scoped RAG with rev_id citations | 1 |
| LLM claim extraction + vector matching + `FOR SYSTEM_TIME BETWEEN` | Claim lifecycles and "what the edit war was about" | 2 |
| Application-time `PERIOD FOR` + system versioning + LLM date extraction | Bitemporal "event time vs telling time" view | 3 |
| bge-m3 cross-lingual vectors + `wikidata_id` + LLM | Framing and coverage diffs as an editor queue | 4 |
| Batch GPU embedding + MariaDB HNSW on 568k articles | Scale proof and an honest retrieval benchmark | 5 |

## Stackable tech challenges (honest fit)

| Tech challenge | Fit | Why |
|---|---|---|
| Verda Compute | **Strong** | Named use case for this dataset (CHALLENGES.md:L2141); embedding L and LLM extraction over M both need real compute |
| Gemini API | Good | The LLM step (answers, claim extraction) can be Gemini. Needs a written explanation; all members must be 18+ (`_tech-challenges.md`, L2518) |
| Gemma | Good | Open model for batch claim extraction, hostable on Verda or Modal (`_tech-challenges.md`) |
| Codex | Good | Development-process prize, stackable with anything (`_tech-challenges.md`) |
| Modal | Possible | Alternative to Verda for GPU embedding; needs a live deployed demo (`_tech-challenges.md`) |
| Oxylabs Web API | Possible, niche | Live-scraping cited `<ref>` URLs to check whether a source still supports a claim fits area 2 (CHALLENGES.md:L3241). Adds scope |
| Aiven / MongoDB / Tiger Data | Weak | MariaDB must be the core store (L1914). Aiven's listed services do not include MariaDB (`_tech-challenges.md`), so only a side role such as a Valkey cache, which is unlikely to score as "meaningful" |
| ElevenLabs | Weak | Narrated "history of this article" is a gimmick unless voice is central |

Verda and Codex together are the realistic pair. Gemini or Gemma is a third if the model choice is free.

---

## Estimates

All three numbers are my estimates.

- **Differentiation potential: 7/10.** The combined track with claim-level or bitemporal provenance is unclaimed (competitive.md §3, §8), and the sponsor's own starter leaves the combination for "later". It is not higher because the obvious RAG chatbot will be common and the "time slider" is already in the starter, so the distinct core must be visible in the first 30 seconds.
- **Demo potential: 7/10.** "Same question, two dates, click to the edit that changed it" is a clean before/after with no hardware risk. The risks are Finnish-language content (needs on-screen translation for peers and jury) and load time for dataset M on demo hardware (5-7 GB, Agent A §1).
- **Jury fit: 5/10.** The rubric weights a worthwhile problem with a specific user (20%) and peer-floor wow (15%). Wikipedia trust and provenance is a credible problem, and "who rewrote history" is an engaging hook, but the audience reads as niche, and the path forward depends on Wikimedia adoption, which is unproven (Citation Needed's low retention is a caution). Measured-evidence and technical-depth criteria fit well. Best combined-objective value comes from area 1 as the backbone, with area 2 or 3 as the "insight" and area 5 as the evidence.

<!-- complete -->
