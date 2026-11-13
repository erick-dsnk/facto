# Junction 2026 challenge selection

Output of a multi-agent workflow that picks our challenge and project. Inputs: `../JUNCTION_2026_CHALLENGES.md` and `../00-Jury-profiles-and-pitch-guide.pdf`.

## Layout
| Path | Stage | Contents |
|---|---|---|
| `00-rules-and-jury.md` | 1 | Judging mechanism, jury lenses, overall-winner rubric |
| `01-challenge-intelligence/<slug>.md` | 1 | Challenge analyst report per challenge |
| `01-challenge-intelligence/_tech-challenges.md` | 1 | Stackable "Best Use of X" prizes |
| `01-challenge-intelligence/_database.md` | 1 | One table across all challenges |
| `02-research/<slug>/{competitive,opportunity,feasibility}.md` | 2 | Three-agent research team per challenge |
| `03-opportunity-ranking/ranking-{challenge-prize,overall-winner,combined}.md` | 2 | Three independent rankings |
| `03-opportunity-ranking/shortlist.md` | 2 | Top 5 challenges and 2 alternates. **Team approves this before part 2** |
| `04-ideas/`, `05-evaluation/`, `06-feasibility/`, `07-final-selection.md` | 3-5 | Written by part 2 after the shortlist is approved |

Scope: 18 main challenges. Healthcare is excluded; hardware-heavy challenges are researched but penalised.

## Restarting after an interruption
Every agent checks for its own output file first. A file ending in `<!-- complete -->` is reused without new research; a file without that line is treated as a partial draft and finished. So a restart only pays for the work that had not finished.

- Same Claude Code session: ask Claude to resume the workflow run (it replays cached agent results).
- New session: ask Claude to "run the workflow at `docs/challenge-selection/workflow/part1-research-and-ranking.js`". Finished reports are picked up from disk.
- To force a redo of one report, delete that file and run again.

## Part 2 (Meta AI Glasses)
The team chose the Meta "AI Glasses for Everyone, Everyday" challenge after part 1, so part 2 runs on that challenge only: five idea generators → consolidated candidates (`04-ideas/`) → five independent judges and a top 5 (`05-evaluation/`) → real no-key feasibility spikes (`06-feasibility/`) → `07-final-selection.md`.

Its script is `workflow/part2-meta-ideas-to-final.js` and restarts the same way as part 1. Spike code lives outside the repo in the session scratchpad, so a new session re-runs any spike whose report is not marked complete.
