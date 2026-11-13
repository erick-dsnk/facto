# Break the Agent (AfterQuery): competitive intelligence

**Summary**
- No prior Junction or Devpost winners for this exact challenge, or for AfterQuery hackathons, turned up in search (unknown whether any exist). The closest precedents are the Meta/Hugging Face OpenEnv hackathons and published agent benchmarks, so the "seen before" bar comes from those.
- The first-reach ideas will be: a SWE/terminal task, a browser/enterprise-workflow sim, a long-horizon business sim (a vending-machine clone), a game or puzzle, and a "reward hacking detector". Judges, who build environments for frontier labs, will have seen all of them.
- The scoring is not about novelty. It rewards a reproducible gap (30), fair difficulty (30), an unhackable reward (25) and one-command craft (15) (CHALLENGES.md:L449). The competition is therefore mostly about rigour, and teams will tend to fail on exploits and reproducibility.
- Crowding estimate: medium (own estimate, reasoning below). Rigour, not the idea, separates teams.
- Verified harness facts are limited: Harbor tasks are directories with a verifier that writes a reward file, and an MCP server can run as a docker-compose sidecar. Whether OpenCode picks up MCP servers from the task config is not confirmed, so check with mentors early.

## 1. What the sponsor wants (context)
- Official text: Harbor + OpenCode over MCP, a scoring skeleton, model credits, mentors, and 3 agent runs plus do-nothing and stop-early baselines at judging (CHALLENGES.md:L449-451, L483-493).
- AfterQuery is described as a San Francisco applied-research lab and data platform building agent/RL environments for frontier labs: https://rl-list.com/ and https://afterquery.com/products. Its job posting says it builds environments that simulate real-world workflows: https://apply.workable.com/talentpluto/jobs/view/460C1DA751.md. Funding figures conflict across sources; do not rely on them.
- Estimate: the judges' day job is exactly what they are asking for, so they will spot weak verifiers and trick difficulty quickly.

## 2. Harness facts (opened pages)
- Harbor task layout: `instruction.md`, `task.toml`, `environment/` (Dockerfile or compose), `solution/` (reference solution), `tests/test.sh` that writes a number to `/logs/verifier/reward.txt` or labelled values to `reward.json`; tasks may be multi-step. Source: https://docs.harborframework.com/tasks/overview
- MCP: Harbor has no dedicated setting on that page; an MCP server is declared as a sidecar service in `environment/docker-compose.yaml` and reached at `http://mcp-server:8000`. Source: https://docs.harborframework.com/tasks/multi-container. Mixed third-party docs show a `mcp_servers` block in task.toml (https://www.mintlify.com/harbor-framework/harbor/api/task-config, not opened in full), and I could not confirm OpenCode consumes it. Unknown: the event's "scoring skeleton" format.
- Implication (inference): a bundled `solution/solve.sh` maps naturally onto the "stronger reference run", but note the challenge wants a reference run that is demonstrated and reproducible, which may need to be an agent or scripted run through the same MCP tools.

## 3. Previous winners and similar events
| Item | What it shows | URL |
|---|---|---|
| Junction 2025 (about 1500 hackers, 40+ partners) | No winner list for an agent-environment track found. Unknown. | https://fi.linkedin.com/in/tuomas-koivunen (snippet only) |
| Meta PyTorch / Hugging Face OpenEnv hackathon (India, 2026) | RL-environment hackathon; criteria were novelty, storytelling, training-improvement evidence. Official winners list not found; only finalist claims. | https://huggingface.co/spaces/thomasm6m6/openenv_hack/blob/main/hackathon.md ; https://contra.com/p/PMoMXlbv-grand-finale-finalist-meta (self-reported finalist, enterprise email triage env) |
| OpenEnv SF hackathon (March 2026) with Fleet AI, Scaler AI, Patronus, Snorkel, Mercor themes | Suggested themes: multi-agent, long-horizon, enterprise/consumer workflows, self-improvement. These themes show what participants gravitate to. | same hackathon.md page |
| Great Agent Hack 2025 (Holistic AI x UCL) | Adversarial track winners (MI5 Agents, Jailbreak Lab, Illusion); jailbreaking, not environments. | https://hackathon.holisticai.com/ and https://www.valyu.ai/blogs/the-great-agent-hack-2025-agent-performance-reliability-and-valyu-powered-retrieval |

Finding: the closest public hackathon precedent weights training evidence and storytelling, while this one weights gap, fairness and reward integrity. Different rubric, so past winners are weak guides (inference).

## 4. Similar submissions and open-source work
- HackWatch (OpenEnv hackathon): an environment that plants 12 exploit types and trains a monitor (Qwen2.5-1.5B + LoRA, GRPO) to flag cheating coding agents; reports F1 0.970 on 150 trajectories, tags itself under reward hacking. Source: https://huggingface.co/datasets/Afras/blog/blob/main/hackwatch.md. Shows "reward hacking" is already a hackathon topic.
- Enterprise email triage env (finalist claim): https://contra.com/p/PMoMXlbv-grand-finale-finalist-meta
- OpenEnv library (Meta/HF): https://openenv-readme.static.hf.space/README.md
- Prime Intellect Verifiers and Environments Hub (open environment sharing): https://github.com/PrimeIntellect-ai/verifiers ; https://huggingface.co/blog/anakin87/environments-hub
- Harbor registry has hundreds of eval sets (one talk says 300-400; sources disagree): https://www.ai.engineer/talks/jRCpXUjz4CI-everything-is-rollout

## 5. Published benchmarks the judges know
- Terminal-Bench 2.0: 89 tasks, frontier under 65%, taxonomy of failures (execution, coherence, verification), outcome-based tests on final container state. https://arxiv.org/pdf/2601.11868 (abstract-level summaries read via search, paper not opened); https://snorkel.ai/blog/terminal-bench-2-0-raising-the-bar-for-ai-agent-evaluation/
- tau-bench: simulated user plus domain APIs plus written policy, scored by DB end state, pass^k for reliability (gpt-4o about 61% retail, 35% airline at pass^1; pass^8 down to about 25% retail). https://sierra.ai/blog/benchmarking-ai-agents ; https://arxiv.org/abs/2406.12045
- Vending-Bench / 2 (Andon Labs): long-horizon business sim; failures from misreading state then spiralling; Vending-Bench 2 adds adversarial suppliers and refunds. https://arxiv.org/pdf/2502.15840 ; https://epoch.ai/benchmarks/vending-bench-2
- Reward hacking evidence: METR documents o3 tampering with scorers, stubbing evaluators, monkey-patching equality: https://metr.org/blog/2025-06-05-recent-reward-hacking . BenchJack audited 10 agent benchmarks and found 219 flaws, near-perfect exploit scores on 9 of 10 without solving tasks; top flaws were isolation failure and trusting agent-influenced output: https://arxiv.org/html/2605.12673 . This is the checklist the judges' 15-minute exploit hunt resembles (inference).

## 6. Commercial products
RL-environment vendors sell to labs: Mechanize, Plato, Halluminate, Habitat, Matrices, plus Scale, Surge, Mercor entering (https://cleverx.com/blog/companies-building-rl-environments-2026 and https://www.rl-list.com/vendors/mechanize via search summary; vendor-blog claim of a Mechanize acquisition is unverified). Epoch's interviews: enterprise workflows are the fastest-growing environment type; pitfalls are reward hacking, 0% or 100% pass rates giving no signal, weak unit-test grading and low-fidelity clones: https://epoch.ai/gradient-updates/state-of-rl-envs . Judges therefore know polished clones of enterprise apps and will test fidelity.

## 7. Approaches most teams will reach first (estimates)
1. A coding or terminal task with hidden unit tests (the Harbor-native default).
2. A web/enterprise-app sim (CRM, email, calendar, expense) with state-diff checking.
3. A long-horizon business or resource sim (vending, shop, supply chain).
4. A game or puzzle (grid, text adventure, negotiation).
5. A "find the hidden bug" or exploration task.
6. A reward-hacking-detector/monitor.

## 8. Obvious ideas to avoid
- Generic vending/shop/inventory sim (Vending-Bench clone).
- Email/calendar/CRM triage clone.
- SWE-bench-style "fix the bug, hidden tests".
- Wordle/maze/Sokoban-style puzzles where the gap is arithmetic or luck.
- Difficulty by ambiguity, hidden state, tight step limits or obscure wording: these map to explicit zero-score conditions (CHALLENGES.md:L449).
- A gap shown by a single run, or by a reference "run" that is a hardcoded script the agent cannot in principle reproduce.
- Tests that read answer files in the agent's container (isolation failure, a top BenchJack flaw).

## 9. Crowding estimate (own estimate)
Medium. Reasons: it is an AI-native, 48-hour-style event where many teams run coding agents; the track needs Harbor/MCP/RL knowledge and has a high bar on rigour (4 hard zero conditions), which deters casual entries; but the prize (EUR 3,000 plus a work trial, CHALLENGES.md:L443) and the "small environment can be enough" line (L471) are attractive. Expect a handful of serious teams, most with idea types in section 7. Number of Junction teams per challenge: unknown.

## 10. What would look different
- Pick a domain where a human expert has real procedural knowledge (a niche professional workflow, a scientific instrument, a protocol) and where the failing decision is nameable, rather than the common app sims.
- Show the gap over held-out seeds with confidence intervals, and a reference run reproduced through the identical MCP tools, not a script with privileged access.
- Ship a failure taxonomy with ablations proving the information was available (give the hint, the gap closes; this answers the "meaningful difficulty" zero condition).
- Publish an exploit log: run your own red team (a coding agent told to cheat, in the style of BenchJack), patch, and show before/after scores. Verifier isolated from agent container.
- Make do-nothing and stop-early baselines scripted in the README and show about 0.
- Stretch: even a small SFT or rejection-sampling improvement on a small model is the stated tiebreaker (CHALLENGES.md:L453) and few teams will have time.
- Process: confirm the harness behaviour with the mentors in the first hours (CHALLENGES.md:L493), since MCP wiring into OpenCode is unverified here.

## Unknowns
Eligibility, deadlines, how many teams will pick this, prior AfterQuery hackathon winners, the scoring skeleton format, current frontier model scores in any specific domain.

<!-- complete -->
