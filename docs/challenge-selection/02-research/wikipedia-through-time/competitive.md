# Wikipedia Through Time: competitive intelligence (Agent B)

**Summary**
- Likely moderately crowded. The RAG half is the default "obvious" build (starter repo + chunking + LLM Ask step); the SVT half is rarer and the sponsor explicitly wants it (CHALLENGES.md:L1904-L1908, L1950-L1956).
- Sponsor's own past hackathon winners were novel *applications* of MariaDB Vector (YouTube semantic search), not Wikipedia chatbots; a Wikipedia RAG tool only placed runner-up in 2025.
- Existing tools cover edit-history visualisation (History Flow, WikiWho/Who Wrote That, WikiWash) and old-revision viewing (TimeTraveller script), but I found none that combines as-of-date cited Q&A with edit attribution (estimate, from limited search).
- To stand out: combined RAG + SVT "what did Wikipedia say then vs now, and which edit changed it" with scale proof across S/M/L datasets.
- Evidence limit: no Junction-specific winners for MariaDB exist (this is its first Junction challenge as far as I could find); search tool is US-only and shallow, so GitHub coverage is sampled, not exhaustive.

## 1. Same sponsor's previous hackathons

| Finding | URL |
|---|---|
| MariaDB hackathon list: Helsinki Python Hackathon (Mar-May 2025: Integration winner MCP integration; Innovation winner YouTube semantic search); Bengaluru BangPypers 2025 (Airflow, Dagster integrations; Adaptive Query Optimizer for MariaDB Vector; Multimodal Embeddings); CloudFest 2023/2024. Page does not mention Junction. | https://mariadb.org/hackathons/ |
| 2025 Innovation winner: YouTube Semantic Search (Dmytro Abramov): captions, semantic chunking, all-MiniLM-L6-v2, MariaDB VECTOR, CLI + light web frontend in Docker. Blog said "beyond just a proof of concept". Runner-up: "Wikipedia Enhancer", no further details in the post. | https://mariadb.org/youtube-semantic-search-hackathon-winner-innovation-track/ |
| Wikipedia Enhancer repo: RAG over Wikipedia chunks (CSV loaded, single article per query), pasted source text compared, OpenAI suggests factual improvements, Streamlit, MIT. Shows a Wikipedia+MariaDB RAG entry already exists and was only 2nd. | https://github.com/djstockma/wiki-rag-enhancer |
| Judges' pattern (inference, estimate): winners were complete, working, well-scoped apps with clear utility, and several winners were deep MariaDB engineering (query optimizer, multimodal embeddings). | https://mariadb.org/hackathons/ |

Junction winners generally (context only, not this challenge): 2025 overall WAVELET; 2024 BREAKDANCE; 2023 "Driving Change"; sources thin and unverified by an official page (https://en.wikipedia.org/wiki/Junction_(hackathon)). Winners of tech-challenge prizes are not listed there. Past Junction MariaDB/Wikipedia winners: unknown.

## 2. The provided starters already do the obvious things

- RAG starter (https://github.com/MariaDB/mariadb-vector-wikipedia-rag): bge-m3 via Ollama, 29,460 articles fi/sv/en, one vector per article, Flask page, cross-language search, language/category filters, FULLTEXT comparison. Reports 86% hit@10 (keyword 41%). Marked TODO: Ask (cited LLM answer), hybrid search, chunking. Known weak: facts inside long articles, "who led Finland in the Winter War" returns the war article.
- SVT starter (https://github.com/MariaDB/mariadb-system-versioning-wikipedia): 50 articles, `FOR SYSTEM_TIME AS OF`, real timestamps via `system_versioning_insert_history`, SHA-1 revert detection, SVG timeline of edits/reverts, compare two dates, SQL shown. TODO: load all ~19,750 articles; storage blows up (2 GB for 50 articles).
- Implication: a team that only finishes the TODOs (add LLM Ask, chunk, load more articles) rebuilds what the sponsor already has in mind and will look the same as most others.

## 3. Existing tools and open source (edit history / time travel)

| Tool | What it does | URL |
|---|---|---|
| Wikipedia TimeTraveller user script | Opens the revision for a date-specific URL | https://www.Wikipedia.org/wiki/Wikipedia:WikiProject_User_scripts/Scripts/TimeTraveller |
| IBM History Flow | Classic visualisation of authorship flow; no longer downloadable | https://en.wikipedia.org/wiki/IBM_History_Flow_tool |
| Wiki History Flow (dodero) | SVG history flow from API | https://github.com/dodero/wikihistoryflow |
| Wikiswarm | Revision history to code_swarm | https://jamiedubs.com/wikiswarm |
| WikiWash | Browser view of history and live edits | https://opensource.com/life/14/12/lessons-learned-building-wikiwash |
| Who Wrote That? (WikiWho, Wikimedia Community Tech) | Per-sentence authorship browser extension | https://meta.wikimedia.org/wiki/Community_Tech/Who_Wrote_That_tool/en |
| WikiTrust | Colours text by survival; defunct | https://de.wikiup.org/wiki/Benutzer:NetAction/WikiTrust |
| Gamergate research tools (whoVIS etc.) | Visual exploration of intra-article disagreement / edit wars | https://ojs.aaai.org/index.php/ICWSM/article/view/14701 |

Gap (estimate): I did not find an open-source tool combining as-of-date view, LLM-grounded Q&A over a past version and per-claim edit attribution. Wikipedia's own history page and diff view cover manual time travel.

## 4. Existing RAG-over-Wikipedia products

- Wikidata Embedding Project (Wikimedia Deutschland, Jina AI, DataStax, Oct 2025): hybrid keyword+vector search on Wikidata, English/French/Arabic, built for RAG, open on Toolforge. https://techcrunch.com/2025/10/01/new-project-makes-wikipedia-data-more-accessible-to-ai ; https://tech.eu/2024/09/17/wikimedia-datastax-and-jina-ai-launch-semantic-search-for-ai-developers/
- General chat products (ChatGPT, Perplexity, etc.) answer Wikipedia-style questions with citations; I did not fetch a specific page, so treat as common knowledge, unverified here.
- Other GitHub "chat with Wikipedia" projects: not found in my search (unknown). They are almost certainly numerous (estimate).
- Sponsor goal context: the challenge itself notes LLMs hold a world view differing from Wikipedia's NPOV (CHALLENGES.md:L1962-L1964), which suggests grounded, source-faithful tools are valued.

## 5. What most teams will reach for first (estimate)

1. Finnish history chatbot: bge-m3 embeddings, top-k from MariaDB, LLM answer with article links (the starter's TODO).
2. Add chunking and hybrid (vector + FULLTEXT) retrieval.
3. Article "time slider" using `AS OF` plus a diff view.
4. Edit-war dashboard: revert counts per article, SHA-1 revert detection, editor timeline.
5. Cross-language comparison (fi/sv/en) of the same topic.
6. Fact-checking/gap-finder: paste text, compare with Wikipedia (as the 2025 runner-up did).
7. Polished UI over the starter Flask app, quiz/flashcards/study-assistant variants.

## 6. Ideas to avoid (judges will see them repeatedly)

- Plain "ask Wikipedia" Q&A with citations and nothing temporal.
- Starter UI reskinned; chunk+hybrid search as the headline.
- Revision slider/timeline and revert counter alone (the SVT starter already ships a timeline and revert detection).
- Generic Finland history study buddy / quiz generator.
- Paste-text fact-checker (precedent: 2025 runner-up).
- Anything using MariaDB only as a dumb vector store behind a generic LangChain wrapper.

## 7. Crowding estimate (my estimate, not data)

Likely **medium**. Arguments up: low barrier (starter repos, pre-computed vectors, LLM Ask step missing), cash and certification prizes, explicit "recommended for most teams" RAG track (CHALLENGES.md:L1904), Finland-themed data suits a Helsinki crowd. Arguments down: Data Track niche, requires database depth, small prizes (EUR 1,000 top, CHALLENGES.md:L1934-L1940) versus larger tracks, a MariaDB-only constraint, no hardware or brand draw. Attendee counts per challenge: unknown; Junction 2025 reportedly had about 1,500 hackers and 40 partners (https://en.wikipedia.org/wiki/Junction_(hackathon) / mirror results). I expect a handful of teams (guess 4-10), most on the RAG-only track, few on SVT or combined.

## 8. What would make a submission look different

- Combined RAG + SVT: "what did Wikipedia say about X on date D, and which edit (user, time, sha1) changed it?" with every claim cited to a revision, not just an article. This answers the challenge's own example (CHALLENGES.md:L1923-L1926) but with revision-level provenance.
- Temporal vector search: embed chunks per revision (or per changed section) and filter by `AS OF`, so retrieval itself is time-aware; most teams will embed only current text.
- Narrative-drift measurement: compare embeddings of the same section across years to quantify how the story was rewritten (the challenge's "rewritten history" idea, L1912-L1914), plus fi/sv/en divergence.
- Scale evidence: dataset M (862k revisions) and L (568k articles) load times, query latency and storage (compressed/separated text, as the SVT starter notes), shown as a benchmark panel; scalability is 20% (L1989).
- Editor-facing use: a tool that flags weak or contested passages for editors, with NPOV framing, rather than a reader chatbot.
- Demo: a live, honest benchmark (e.g. beat the starter's 86% hit@10 on its own 37 questions) and visible SQL, which matches how the sponsor presents its starters.
- Prize caveat: first place is EUR 1,000 plus credits; winning here does not itself help the overall jury, whose criteria are in the PDF (not reviewed in this task).

<!-- complete -->
