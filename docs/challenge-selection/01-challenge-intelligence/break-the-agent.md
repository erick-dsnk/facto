# Break the Agent (AfterQuery): challenge intelligence

**Summary**
- AfterQuery asks for a **reinforcement-learning environment** (served to the agent over MCP) where a frontier agent consistently scores below a reference run your team can reproduce, the failures come from real decisions rather than tricks, and the reward is hard to game (CHALLENGES.md:L417, L431-433, L449, L483).
- Judging is mechanical and adversarial. Judges rerun your reference run, three agent runs, a do-nothing baseline and a stop-early baseline, then spend 15 minutes trying to exploit your reward (CHALLENGES.md:L451). The rubric is gap 30, meaningful difficulty 30, reward integrity 25, craft 15 (CHALLENGES.md:L449, L503-517).
- Prizes are €3,000 / €1,500 / €500, and 1st place also gets a work trial at AfterQuery (CHALLENGES.md:L443, L521-531). The tiebreaker is training a smaller model and showing it improves (CHALLENGES.md:L453).
- No physical hardware is involved. The work fits the team's ML/eval and agent-orchestration skills well. The main risks are reward design and reproducibility, not implementation volume.
- AfterQuery's mentor Daksh Raghuvanshi also sits on the **overall jury** (jury PDF p.2-3). This is an estimate of its effect, not a rule: rigour about baselines and gameable metrics should carry over well to the overall-winner stage.

---

## 1. Database record

| Field | Value | Source |
|---|---|---|
| Challenge | Break the Agent | CHALLENGES.md:L409 |
| Sponsor | AfterQuery (afterquery.com) | CHALLENGES.md:L413, L497-499 |
| Track | Agentic AI Track | CHALLENGES.md:L9 (the track heading that contains L409) |
| Main requirement | "Build a reinforcement learning environment that challenges today's best AI agents, demonstrate real failure modes, and show that its rewards reflect real progress." | CHALLENGES.md:L417 |
| Judging emphasis and weights | The gap 30 / Meaningful difficulty 30 / Reward integrity 25 / Craft 15. The page says "p" in the rubric and "%" in the criteria list; both add up to 100. | CHALLENGES.md:L449, L503-517 |
| Judging procedure | 10-minute demo. Judges then rerun the standard harness: the reference run, 3 agent runs, a do-nothing baseline and a stop-early baseline, followed by 15 minutes of exploit hunting. "Scores are based on these runs." | CHALLENGES.md:L451, L475 |
| Tiebreaker | When totals are close, a team that shows a smaller model improving after training on its environment's experience is favoured | CHALLENGES.md:L453, L477 |
| Prize | 1st: €3,000 + work trial at AfterQuery + merch. 2nd: €1,500 + merch. 3rd: €500. The intro text says "Members of the winning teams can go straight to the final stage of AfterQuery's interview process: a work trial", and that "Finalists also receive AfterQuery gear". The intro and the prize list differ slightly on who gets the trial and the gear. | CHALLENGES.md:L443, L519-531 |
| Provided harness | Harbor running the OpenCode agent, connected to your environment over MCP | CHALLENGES.md:L483-485 |
| Provided other | Scoring skeleton, frontier-model API credits per team, on-site mentors (environment design reviews, reward testing), and a starter kit with harness docs and the rubric | CHALLENGES.md:L483-489 |
| Mentors | Daksh Raghuwanshi and Ved Vedere, from AfterQuery's environments team | CHALLENGES.md:L493 |
| Provided data | None. You pick the setting yourself. | CHALLENGES.md:L429, L435 |
| Provided hardware | None | CHALLENGES.md:L479-489 |
| Which frontier model the judges run | unknown. Credits are for "frontier model API" only. | CHALLENGES.md:L483 |
| Submission requirements | A README that lets judges "run the evaluation ... with one command and reproduce your reported results" (L449). It must work with the standard harness (L451). Form, deadline, repo visibility and licence: **unknown**. The original challenge page (L411) did not render when fetched. | CHALLENGES.md:L449, L451 |
| Build time | The text says credits cover "the 48 hours" (L483). The team's planning figure is about 40 hours. | CHALLENGES.md:L483 |

### Harness facts from the web (to confirm against the starter kit)
- **Harbor** describes itself as a "Framework for evaluating and improving agents" from the creators of Terminal-Bench, released under Apache-2.0. It can "Generate rollouts for RL optimization". It installs with `uv tool install harbor` and runs with `harbor run -d <dataset> -a <agent> -m <model>`. Source: https://github.com/harbor-framework/harbor
- **Task layout:** `instruction.md`, `task.toml`, `environment/Dockerfile`, `solution/solve.sh` (the reference solution) and `tests/test.sh`. The verifier "must produce a numerical reward ... at `/logs/verifier/reward.txt`", or write `/logs/verifier/reward.json` for multi-dimensional rewards. Multi-step tasks go under `steps/<name>/`. Source: https://docs.harborframework.com/tasks/overview.md
- **MCP is declared in `task.toml`** as `[[environment.mcp_servers]]`, with transports `sse`, `streamable-http` or `stdio`. Network modes are `no-network`, `public` and `allowlist`. The verifier timeout defaults to 600 s, and the agent has no timeout by default. Source: https://docs.harborframework.com/tasks/configuration
- **Repeated attempts:** use `-k <attempts>` or `n_attempts`. Source: https://docs.harborframework.com/jobs/run-a-job.md. The exact agent ID strings (for example opencode, oracle, nop) were not on the pages I opened, so they are **unknown**. Check `harbor run --help`.
- **OpenCode** is an MIT-licensed open-source coding agent. It "Connect[s] local and remote MCP servers" and supports 200+ providers. Source: https://opencode.ai/
- **AfterQuery** describes itself as an applied research lab that builds training data for frontier models. Its offerings include "RL + rubrics" and "Agent environments (API/MCP)". It names NVIDIA (Nemotron/GDPval), Hebbia and Legora (the BAR legal agent benchmark). Source: https://www.afterquery.com/

## 2. What the sponsor is actually trying to encourage

This section is my reading of the evidence, not a stated aim.

- **Recruiting and a sample of their own product.** AfterQuery sells "Agent environments (API/MCP)" and "RL + rubrics" to frontier labs (afterquery.com). The challenge is a miniature version of that work: "choosing a problem worth learning, defining an action and observation space, and defining a reward function" (CHALLENGES.md:L423). The 1st prize is a fast track to "the final stage of AfterQuery's interview process: a work trial with our environments team" (CHALLENGES.md:L443). They are looking for people who can already do that job.
- **Environment-design judgement over size.** "A small environment with a well-chosen challenge can be enough" (CHALLENGES.md:L471). "We care about what makes the environment useful for learning and what your experiments reveal" (CHALLENGES.md:L435).
- **Honest evaluation.** Half the rubric penalises fake difficulty and gameable rewards. "Unfairly withheld information, trick wording, impossible timing, or broken tools" scores zero (CHALLENGES.md:L449), and judges actively hunt for exploits (CHALLENGES.md:L433, L451). The jury guide's lens for Daksh matches this: "Does this actually beat a simple baseline, and can your metric be gamed?" (jury PDF p.3). It also notes his StoreBench lesson that a higher mean can hide a lower pass rate (jury PDF p.3, finding 3).
- **Possibly a source of new task ideas.** "What should AI agents be able to do that they still struggle with today?" (CHALLENGES.md:L421). Novel, realistic failure modes are what labs buy. This is an inference.

## 3. Explicit requirements (quoted)

- "Choose a setting you find interesting and **build an environment an agent can interact with**." "Explain why you chose it and what an agent could learn there." (CHALLENGES.md:L429)
- "Your environment should have **a clear goal, actions the agent can take, and a reward you can check**." (CHALLENGES.md:L431)
- "Run a frontier agent in it and compare the results with a stronger reference run your team can demonstrate and reproduce." (CHALLENGES.md:L431)
- "Show **where the agent falls short and why**. The challenge should come from the decisions it needs to make, with access to the information and tools needed to succeed." (CHALLENGES.md:L433)
- "We'll also try to find shortcuts that earn a high score without completing the task: **reward hacking**." (CHALLENGES.md:L433)
- "doing nothing or stopping early earns little or no credit; completing the task well remains the best way to score." (CHALLENGES.md:L449)
- "judges can run the evaluation from your README with one command and reproduce your reported results." (CHALLENGES.md:L449)
- The harness "connects to your environment over **MCP**" (CHALLENGES.md:L483). Compatibility with Harbor + OpenCode is therefore effectively required (my inference from L451 and L483).
- Optional: "Train a smaller model using experience from your environment and show whether it improves." (CHALLENGES.md:L439)

## 4. What a mediocre submission looks like

These are estimates.
- A puzzle or game where the frontier agent fails because of hidden information, ambiguous instructions, tight step limits or flaky tools. Under "Meaningful difficulty" that scores zero (CHALLENGES.md:L449).
- A single cherry-picked failing run. The gap is not stable across three judge reruns, or the "reference run" is a hand-written script that cheats by reading hidden state.
- A reward that is binary at the end, or easily padded. Examples: partial credit for activity, LLM-judge scoring that can be flattered, or a verifier that checks output format instead of the world state. Doing nothing or stopping early scores more than about zero.
- It runs only on the team's laptop: no Docker task, several manual steps, results that differ from the README.
- A demo that shows the environment but not an analysis of *why* the agent fails.

## 5. What an exceptional submission demonstrates

These are estimates.
- **A well-chosen decision bottleneck.** One of the starting points (multi-step planning, exploring an unfamiliar system, limited resources, adapting to new info; CHALLENGES.md:L459-467) is isolated in a small, realistic world. Every fact the agent needs can be reached through tools.
- **A reproducible gap with statistics.** The reference run (for example a scripted or search-based policy, or a human trace replay that only uses the agent's own tools) scores high. The frontier agent scores clearly lower across k≥3 runs, with mean, variance and pass rate shown. Seeded randomness or procedurally generated instances with held-out seeds rule out memorisation.
- **A failure taxonomy.** Trajectory logs are categorised into the agent's main mistakes (for example greedy early commitment, failing to re-plan after new information) and tied to specific decisions. Bonus: an ablation that shows the agent succeeds when the decision is made easier, which proves the difficulty is the decision itself and not the tools.
- **A red-teamed reward.** The reward is computed from verifiable world state by a verifier the agent cannot touch (a separate process, no shared filesystem). Do-nothing and stop-early score about 0. The team shows its own exploit attempts, including fixed ones, in an "exploit log". A dense/shaped reward is checked so that the optimum is still task completion.
- **One-command reproduction**, for example `harbor run -p tasks/... -a <agent> -k 3`, plus a script that rebuilds the results table.
- **Tiebreaker:** a small model (for example 1-8B) is fine-tuned or RL-trained on environment rollouts, using Harbor's rollout generation, and its score on held-out seeds improves. This is a natural fit for the team's ML skills.

## 6. Constraints that could disqualify or zero a project

None of these is stated as a formal disqualification. They are zero-point conditions from the rubric (CHALLENGES.md:L449):
- No measurable gap, or a gap that cannot be reproduced or checked against a demonstrated reference run. That loses 30 points.
- A gap caused by withheld information, trick wording, impossible timing or broken tools. That loses 30 points.
- Any exploit, loophole or task-avoiding strategy that beats successful play. That loses 25 points, and judges look for 15 minutes (L451).
- Judges cannot run or reproduce the evaluation from the README with one command. That loses 15 points.
- Practical (inference): it must run inside the provided Harbor/OpenCode harness over MCP (L451, L483). An environment built for a different interface risks being impossible to rerun.
- Eligibility, IP/licence, open-source requirement, team-size limits, submission deadline: **unknown**.

## 7. Physical hardware work

**None.** This is a purely software challenge: a containerised environment, an MCP server, a verifier and evaluation scripts. No hardware is provided or mentioned (CHALLENGES.md:L479-489). Compute needs are frontier API credits (provided) and, for the optional small-model training, a GPU. GPU access is not provided by AfterQuery according to the text (my reading of L483-489). Other tracks or tech challenges may offer GPU compute; that is unknown here.

<!-- complete -->
