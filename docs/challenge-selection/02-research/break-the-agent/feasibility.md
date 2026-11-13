# Break the Agent (AfterQuery): technical feasibility

**Summary**
- **Buildable: yes, and it suits us.** There is no hardware, no external data and no sponsor API beyond the harness. We would write a Python or TypeScript MCP server that holds a deterministic simulated world, a verifier script, a scripted reference policy and a few task seeds. All of it runs in Docker through Harbor, an open-source harness under Apache-2.0. *Estimate:* a complete minimal entry takes 20 to 25 person-hours of engineering.
- **The real risk is research, not engineering.** We have to find a mechanic that frontier agents *consistently* fail at, for fair reasons, while our reference run succeeds. Nothing guarantees that a first design produces a stable gap. Budget for 2 or 3 design iterations, and decide by hour 14 or so.
- **Reward integrity is a solvable systems problem.** OpenCode has a shell and internet access in the agent container. Hidden state and scoring therefore have to live in a sidecar container the agent cannot read, and the verifier must not be something the agent can tamper with.
- **Demo risk is moderate and mostly infrastructure.** The known risks are OpenCode's per-trial Node/NVM download being throttled on venue wifi, an OpenCode exit-code bug, and multi-container tasks running only on the local Docker provider. Each has a concrete mitigation, listed below.
- **Ask the mentors before committing:** what counts as an acceptable "reference run", how judges run the stop-early baseline, which model and how many credits we get, and whether judges rerun on local Docker.

---

## 1. What we must build (from the challenge text)

| Requirement | Source |
|---|---|
| An environment with a clear goal, actions the agent can take and a reward we can check | CHALLENGES.md:L429-431 |
| Run a frontier agent and compare it with a stronger reference run we can demonstrate and reproduce | CHALLENGES.md:L431 |
| Failures come from decisions, and the information and tools needed to succeed are available | CHALLENGES.md:L433, L449 |
| A reward that resists hacking; do-nothing and stop-early earn little or no credit | CHALLENGES.md:L433, L449 |
| Judges run it from the README with one command and reproduce our numbers | CHALLENGES.md:L449 |
| Judges rerun with "the standard harness": the reference run, 3 agent runs, a do-nothing baseline and a stop-early baseline, then hunt for exploits for 15 minutes | CHALLENGES.md:L451, L475 |
| Harness: "Harbor running the OpenCode agent", connected over MCP, plus a scoring skeleton and frontier credits "for the 48 hours" | CHALLENGES.md:L483-489 |
| Tiebreaker: a smaller model that improves after training on experience from our environment | CHALLENGES.md:L453, L439 |

## 2. The harness, as documented (what we verified)

I read the Harbor docs and a shallow clone of `harbor-framework/harbor` at commit `b06002e`, dated 2026-11-13, version `0.25.0` in `pyproject.toml`.

- **Task format.** A task is a directory containing `instruction.md`, `task.toml`, `environment/` (a Dockerfile or `docker-compose.yaml`), `solution/solve.sh` (the reference, run by the built-in `oracle` agent) and `tests/test.sh`. The test script must write `/logs/verifier/reward.txt`, or `reward.json` for labelled or multi-dimensional rewards. Source: https://docs.harborframework.com/tasks/overview.md
- **MCP.** `[[environment.mcp_servers]]` in `task.toml` takes a name and a transport (`stdio`, `sse` or `streamable-http`) plus a URL or command. "Compatible agents register them automatically." Source: https://docs.harborframework.com/tasks/configuration
  - Harbor's OpenCode adapter declares `mcp_servers=True` and writes them into `~/.config/opencode/opencode.json` as `{"type":"remote","url":...,"oauth":false}`. **It passes no headers**, so MCP auth headers cannot be relied on. Source: `src/harbor/agents/installed/opencode.py` L297-306 and L839-858 in the clone; issue https://github.com/harbor-framework/harbor/issues/2402 (open, "There is no way to attach a credential to a server").
- **Reference example to fork.** `examples/tasks/hello-mcp` contains a FastMCP sidecar using streamable-http on `http://mcp-server:8000/mcp`. A `docker-compose.yaml` adds the `mcp-server` service, with a healthcheck, next to `main`. **Limitation quoted from its README:** "Multi-container tasks require the **docker** environment provider ... They are not supported on cloud providers (Daytona, Modal, E2B, etc.)" Source: https://github.com/harbor-framework/harbor/tree/main/examples/tasks/hello-mcp
- **Built-in agents** include `oracle`, `nop`, `opencode` and `opencode-v2`. The `nop` agent does nothing, which matches the "do-nothing baseline". **There is no built-in stop-early agent**, so we would provide one as a custom agent class. Source: `src/harbor/models/agent/name.py` and `src/harbor/agents/nop.py`.
- **CLI.** `harbor run -p <dataset dir> -a <agent> -m <model> -k <attempts> -n <concurrency> -e docker`. Source: https://docs.harborframework.com/jobs/run-a-job.md. Install with `uv tool install harbor` or `pip install harbor` (https://github.com/harbor-framework/harbor). The package requires Python >=3.12 (`pyproject.toml` in the clone).
- **Verifier isolation.** In `shared` mode the tests are uploaded to `/tests/` *after the agent runs*, inside the agent's container. `separate` mode starts a fresh sandbox, and "the agent's filesystem changes are not inherited". The docs do **not** describe any protection against an agent tampering with the reward in shared mode. Source: https://docs.harborframework.com/tasks/verifier
  - Harbor's own anti-hacking example runs the agent as a non-root `agent` user and the verifier as `root`. Source: `examples/tasks/reward-hacking/hello-world-non-root-user`.
- **Agent powers.** The OpenCode adapter declares `native_web_tools=True`, which gives the agent web tools. OpenCode itself is a coding agent with shell and file tools. *Inference:* the agent can run `curl`, scan the network and read any file in `main`.
- **Timeouts.** `[agent].timeout_sec` defaults to no timeout and `[verifier].timeout_sec` to 600. OpenCode's MCP defaults are 30 s startup, 30 s catalogue and 12 h execution. OpenCode "Code Mode is on by default (`codemode: true`)". Sources: https://docs.harborframework.com/tasks/configuration and https://opencode.ai/docs/mcp-servers/

### Documented reliability problems (Harbor issue tracker)
- **#2777 (open):** the OpenCode agent "repeatedly downloads NVM per trial, causing GitHub throttling and setup-only failures". Those trials fail before the agent runs. https://github.com/harbor-framework/harbor/issues/2777. *Mitigation:* pre-install Node and `opencode-ai` at the pinned version in our `main` Dockerfile. The adapter skips installation when `is_requested_version_installed` passes (`opencode.py` L428).
- **#4019 (open):** `opencode run` exits 1 after an uncaught `EPIPE` following a successful `write`, "so any harness that checks the exit code reports a failure". It was reproduced on Harbor 0.25.0 on macOS aarch64. https://github.com/harbor-framework/harbor/issues/4019. *Mitigation:* have the agent's work happen through MCP calls rather than file writes, and confirm on site whether the verifier still runs after a non-zero agent exit (**unknown**).
- **#3195 (open):** ATIF trajectory conversion drops error-only tool responses. This affects the failure analysis, so we should log every tool call on the server side ourselves. https://github.com/harbor-framework/harbor/issues/3195
- **#1922 (open):** there is no token-level capture (token ids and logprobs) for CLI agents. Online RL directly through OpenCode is therefore not supported, and the tiebreaker training would have to be SFT or rejection-sampling on logged trajectories. https://github.com/harbor-framework/harbor/issues/1922

### Unknowns in the harness
The following are not stated anywhere I could read, so treat them as **unknown**:
- which "frontier" model the credits buy, and how many credits;
- the Harbor and OpenCode versions the judges pin;
- whether the "scoring skeleton" (L483) imposes a reward format;
- how judges invoke the stop-early baseline;
- whether judges run on local Docker, which multi-container tasks require.

## 3. Architecture a credible entry needs

```
tasks/<env>-seed-{01..N}/
  instruction.md            goal, rules, tool list (all info needed to succeed)
  task.toml                 [[environment.mcp_servers]] -> http://world:8000/mcp
                            [agent] user="agent", timeout_sec=~900
                            [verifier] user="root"
  environment/
    Dockerfile              main: node + opencode-ai pre-installed (pinned), non-root user
    docker-compose.yaml     adds `world` sidecar (healthcheck, as in hello-mcp)
    world/                  MCP server + simulator (all hidden state lives HERE)
  solution/solve.sh         reference policy: a scripted/planning agent that calls
                            the SAME MCP tools (no privileged state)
  tests/test.sh             fetches score from world's /score?token=<secret in tests/>,
                            writes reward.json {reward, completion, efficiency, ...}
agents/stop_early.py        custom Harbor agent: K tool calls then submit
scripts/eval.sh             ONE command: oracle, nop, stop-early, opencode -k 3 -> table
analysis/                   failure taxonomy from server-side action logs
```

Design rules. These are *estimates*, drawn from the rubric and the harness facts above.
1. **Deterministic world given a seed.** Agent variance should then come only from the model, so the reference and baselines reproduce exactly.
2. **The sidecar holds all state.** The agent container holds no answers, solver code or seeds. Use a single MCP port and **no** unauthenticated debug or score endpoints. Gate the score endpoint with a token that exists only in `tests/` (uploaded after the agent finishes) and in the sidecar image.
3. **Score on the terminal outcome, never on activity.** The reward is the value achieved relative to the reference or optimum. An unsubmitted or truncated episode scores 0, or is capped well below a completed one. Do not award partial credit for each tool call. This is how do-nothing and stop-early get about 0 (L449).
4. **The reference is a non-LLM policy using only the public tools.** Examples are a search or planning solver, or a greedy policy with lookahead. That makes the "stronger reference run" cheap, deterministic and clearly fair. **Unknown whether judges accept a scripted reference instead of an LLM reference; ask (section 7).**
5. **Run the agent as non-root**, protect paths, and keep the repo and seeds private until judging. The agent has web tools, so a public repo containing the solver would be an exploit.
6. **Log every MCP call on the server side**, because Harbor trajectories lose some error responses (#3195). The failure taxonomy is built from those logs.

The difficulty mechanic has to come from the challenge's starting points (L459-467): multi-step planning, exploring an unfamiliar system, managing limited resources, or adapting to new information. *Estimate:* the most dependable gap-makers against frontier agents are long horizons with delayed consequences, costly information gathering under a budget, and state the agent must track across many steps. Choose a mechanic for which we can write a strong scripted solver. Which environment to build is a separate pipeline stage and is not decided here.

## 4. Dependencies and access during the event

| Dependency | Access | Risk |
|---|---|---|
| Harbor (OSS, Apache-2.0) | `uv tool install harbor` today; pin the version | Low. Fast-moving repo (commit dated today). Pin the version and confirm it matches the judges' |
| OpenCode agent | Installed by Harbor per trial, or pre-baked in our image | Medium. See #2777 and #4019 |
| Docker on our laptops | Already available (Mac aarch64 is reported working in #4019) | Low. Multi-container runs need local Docker |
| Frontier model credits | Provided by AfterQuery (L483) | **Unknown model, amount and rate limits.** Bring our own Anthropic/OpenAI keys as a backup for development |
| MCP server SDK (Python FastMCP, as in hello-mcp, or the TS SDK) | Public packages | Low |
| GPU for the stretch training | **Unknown** whether provided. Use our own cloud GPU or a hosted fine-tuning API | Medium. Stretch goal only |
| Datasets | None needed; the world is simulated | None |

**Cost and latency (estimates).** One OpenCode trial on a frontier model with 30 to 100 tool calls is roughly 0.3 to 3M tokens and 3 to 15 minutes. Development needs perhaps 100 to 200 trials, and the judges' rerun is 6 trials per seed. Keep episodes short (cap `[agent].timeout_sec`) and use 3 to 5 seeds, or the judges' rerun becomes slow and expensive. No API pricing is quoted because the model is unknown.

## 5. Integration complexity for our team

- **MCP server and simulator:** low. This is our core skill set.
- **Harbor task packaging and compose sidecar:** low to medium. We fork `hello-mcp`. Expect half a day of Docker fiddling: networking, healthcheck, non-root permissions, pre-baking OpenCode.
- **Reward hardening:** medium. We have to red-team it ourselves, with a written exploit log: curl the MCP server directly, call `submit` immediately, spam actions, look for answers in the filesystem or on the web, edit `/logs/verifier`, poison binaries the verifier uses, exhaust a timeout.
- **Making the gap stable:** high uncertainty. This takes iteration, not code. Three agent runs is a small sample, so the frontier mean must sit well below the reference, with low spread across runs.
- **Tiebreaker (SFT of a small model):** medium to high for 40 hours. Our ML experience covers it, but it needs a GPU, a served OpenAI-compatible endpoint that OpenCode can use, and before/after Harbor runs. It is feasible only if the core is frozen by about hour 28.

## 6. Does it fit in 40 hours?

**Smallest complete version (the 95% build):** one environment, 3 to 5 seeds, an MCP sidecar with about 5 to 8 tools, a scripted reference scoring about 0.9 or more, `nop` scoring 0, a stop-early agent scoring about 0, OpenCode with a frontier model scoring clearly lower over 3 runs per seed, a `reward.json` with a breakdown, a failure taxonomy of 3 or 4 categories with example trajectories, an exploit log of 8 or more attempted hacks with their outcomes, and `./eval.sh` as the single command.

**Indicative schedule (estimate):**
| Hours | Milestone (go/no-go) |
|---|---|
| 0-4 | Harbor plus `hello-mcp` running with `-a opencode` on the provided credits; OpenCode pre-baked in the image. **Gate: the harness works end to end.** |
| 4-12 | World v1, MCP tools, verifier, scripted reference, nop and stop-early agents |
| 12-16 | Pilot: 2 seeds × 3 frontier runs. **Gate: gap of at least 0.3 with failures we can explain; otherwise change the mechanic (have a backup mechanic sketched).** |
| 16-26 | Tune difficulty for fairness, add seeds, red-team the reward, write the exploit log |
| 26-32 | Final eval runs, failure taxonomy, ablations (for example, the same task with the bottleneck removed shows the gap closing, which proves the failure is meaningful) |
| 26-36 (parallel) | Stretch: SFT of a small model on reference and successful rollouts, before/after runs |
| 32-40 | README, one-command check on a clean machine, demo freeze, pitch |

With three people running parallel agents, the engineering fits comfortably. The schedule is driven by the wall-clock time of eval runs and how many design iterations we need.

## 7. Live demo and judging reliability

The 10-minute demo can be pre-recorded results plus one live trial. Scoring comes from the judges' own reruns (L451), so **reproducibility on their machine matters more than our stage demo.**

What would make it fail:
1. **The gap collapses or is noisy.** The frontier agent solves a seed in a judge's rerun, or the reference fails. This is the biggest risk. Mitigate with deterministic seeds, a deterministic reference, several seeds, and gaps that are large rather than borderline.
2. **The judges' environment differs.** A different Harbor or OpenCode version, a cloud provider (which breaks multi-container), or a different model. Mitigate by asking up front, pinning versions in the README, and providing a single-container fallback if required. The fallback is a stdio MCP server inside `main`, but that weakens isolation because the agent could read the server's files, so hidden state would need protecting with file permissions.
3. **OpenCode setup failures** (#2777 throttling on venue wifi) or **non-zero exits** (#4019) are read as agent failures. Mitigate by pre-baking OpenCode, keeping the agent's work in MCP calls, and testing the full `eval.sh` on a second laptop.
4. **A judge finds an exploit in 15 minutes.** That scores 0 of 25 (L449). Mitigate with sidecar isolation, a token-gated score endpoint, terminal-outcome scoring and our own published exploit log.
5. **"Unfair difficulty" verdict.** If the failure comes from ambiguous wording or a tool that is hard to use, we lose 30 points (L449). Mitigate by showing the reference uses the same tools and an ablation where clearer play closes the gap.
6. **Credits run out or are rate-limited** mid-event. Bring backup keys.

## 8. Questions to ask the AfterQuery mentors before committing

1. Is a **scripted, non-LLM reference policy** that uses the same MCP tools acceptable as the "stronger reference run"? Or must the reference be an agent, such as a stronger model or a better scaffold?
2. How exactly will judges run the **stop-early baseline**? Do they bring an agent, or do we supply one, and with what definition of "early"?
3. Which **model, credit amount and rate limits** come with the credits, and which model is "the frontier agent" for the 3 judged runs?
4. Do judges rerun on **local Docker**, which multi-container sidecars require? Which **Harbor and OpenCode versions**?
5. What does the **scoring skeleton** look like, and is `reward.json` with multiple keys acceptable, or must the score be a single `reward.txt`?
6. Is a **multi-task dataset** (several seeds) acceptable, and how many agent runs per task do they count?
7. May the **repo stay private** until judging, given that the agent has web tools?
8. What **time budget** per trial do judges tolerate?
9. Are the formal eligibility, licence and submission deadline rules published anywhere? These are **unknown** from the challenge text.
10. For the tiebreaker, does SFT on rollouts count as "training on experience", and is a GPU provided?

## Sources opened
- CHALLENGES.md:L409-534
- https://docs.harborframework.com/tasks/overview.md
- https://docs.harborframework.com/tasks/configuration
- https://docs.harborframework.com/jobs/run-a-job.md
- https://docs.harborframework.com/tasks/verifier
- https://github.com/harbor-framework/harbor, including the `examples/tasks/hello-mcp`, `examples/tasks/reward-hacking` and `src/harbor/agents` files read from a clone at commit b06002e
- Harbor issues #2777, #4019, #2402, #3195 and #1922 (URLs above)
- https://opencode.ai/docs/mcp-servers/
- https://www.afterquery.com/ (AfterQuery sells "Agent Environments (API / MCP)" to labs, which supports the view that the challenge mirrors its product)

<!-- complete -->
