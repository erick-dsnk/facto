export const meta = {
  name: 'junction-team-idea-evaluation',
  description: 'Score the team\'s real-time fact-checker idea with the same five judges, spike it, and compare it against the existing candidates',
  phases: [
    { title: 'Independent judges', detail: 'same five lenses and standards as the candidate evaluation' },
    { title: 'Feasibility spike', detail: 'throwaway code and docs check, no keys' },
    { title: 'Comparison', detail: 'place the idea in the existing score table on all three objectives' },
  ],
}

const ROOT = '/Users/ciprian/code/Junction 26'
const DOC = `${ROOT}/docs/JUNCTION_2026_CHALLENGES.md`
const OUT = `${ROOT}/docs/challenge-selection`
const SPIKES = '/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes'

const IDEA = `"Live fact-checker" (id live-fact-check), in the team's own words:

> Everyone is aware that we are experiencing a tech renaissance, but this comes with ups and lows, one of them being the huge boom in misinformation. Our idea is to create a real time misinformation detector/fact checker for everyday use with Meta glasses. Our bet is that by using this, misinformation spread can be cut down worldwide. The flow is: the user turns on the fact checker, it uses Jev + database searches + real time web searches to determine what information could be categorized as "checkable"; if it determines something contains misinformation a pop-up appears on the user's display POV. The user is then able to check the sources by doing some finger movements, or it could also ask a voice model to dictate them.

Notes for reading it: "Jev" is one of TypeSafe's System One models, which turn natural language into typed judgments and probabilities (look up TypeSafe's public documentation to see what it can do, its latency and how it is accessed). The description does not say whether the input is what the wearer hears (speech around them), what they see (text, screens, posters), or both; where that matters to your assessment, assess the variants separately. The pop-up and finger-gesture steps assume glasses with a display and gesture input; check against our feasibility research and Meta's documentation which glasses models and toolkit versions actually expose a display and gestures to third-party apps, and assess the audio-only fallback too.`

const CONTEXT = `
## Situation
We are a three-person team at Junction 2026 (Helsinki hackathon, started 13 November 2026, about 40 hours of build time). We have committed to one challenge: "AI Glasses for Everyone, Everyday" by Meta. A pipeline of agents already generated candidate project concepts, had five independent judges score them, and sent the top five to feasibility spikes. The team has now proposed an idea of its own and wants it weighed against those candidates on exactly the same criteria. You are one agent in that evaluation; do only the task described below.

The team wants an accurate placement, not encouragement and not a hatchet job. They will decide what to build from this, so a score inflated because the idea is theirs would cost them the weekend, and so would one deflated for no reason.

## The idea under evaluation
${IDEA}

## Team
- Three people, all experienced with AI development tools and running many coding agents in parallel, so raw implementation speed is high.
- Confident in: full-stack web apps and AI agents (TypeScript, LLM APIs, agent orchestration), ML and data science, mobile and wearables (apps, device SDKs, streaming audio/video).
- Not confident in embedded electronics.

## How prizes are decided
Meta's judges choose the challenge award. Face-to-face peer review by other participants selects five overall finalists. A seven-person jury picks the overall winner from those finalists. A project may also enter side "tech challenges" (Best Use of X). We care about three separate objectives: (1) winning the Meta challenge, (2) winning overall, (3) the best combined chance at both.

## Sources you should read before working
- Official challenge text: lines 878-946 of ${DOC} (cite as CHALLENGES.md:L<line>).
- Our research on this challenge: ${OUT}/01-challenge-intelligence/ai-glasses.md and ${OUT}/02-research/ai-glasses/competitive.md, opportunity.md and feasibility.md (device access, the Meta Wearables Device Access Toolkit and its limits).
- Judging mechanism, juror lenses and the overall-winner rubric: ${OUT}/00-rules-and-jury.md.
- Stackable tech challenges: ${OUT}/01-challenge-intelligence/_tech-challenges.md.
- The existing candidates: ${OUT}/04-ideas/_candidates.md. Their evaluation: ${OUT}/05-evaluation/ (one file per judge, and _top5.md with the aggregate table). Spike reports: ${OUT}/06-feasibility/. A final recommendation may exist at ${OUT}/07-final-selection.md; it is being written by another agent and may not be there yet.
- The web (load search and fetch with ToolSearch if they are not already available).

## Evidence rules
Claims about rules, SDK capabilities, device limits or existing products need a citation: a CHALLENGES.md line, one of our files, or a URL you opened. When the sources do not say something, write "unknown". Label estimates as estimates.

## Resuming
This pipeline may be restarted after an interruption, so before doing any work check whether your output file already exists. If it exists and ends with the line "<!-- complete -->", an earlier run finished this task: do no new work, read the file, and return the structured result derived from it. If it exists without that line, it is a partial draft; reuse what is sound and finish. When you finish writing your report, make "<!-- complete -->" its last line.

## Output
Write your report as GitHub-flavoured markdown to the exact file path given in the task (create parent directories as needed), written for the team. Lead with a three-to-five line summary, then the detail. Do not modify any other file in the repository. Then return the structured result requested; keep its free-text fields short.
`

const JUDGES = [
  ['meta-judge', 'opus', 'You are scoring as a Meta partner judge. Apply the official judging criteria in the challenge text exactly as written, with their stated weights if any, criterion by criterion. Consider what Meta wants to showcase about its glasses and toolkit and what it would be embarrassed to award (privacy problems, policy violations, uses that make the product look creepy).'],
  ['skeptical-investor', 'opus', 'You are a sceptical investor with the overall jury\'s concerns in mind: is the problem real, who cares enough to use this, why would they use it again after the first impressive demo, and what is the believable next step. Paying interest and actual repeated use are different things; look for a recurring trigger. Score on real-world usefulness and repeat value.'],
  ['senior-engineer', 'opus', 'You are a senior engineer who has to ship this in 40 hours and demo it live. Identify implementation risks, hidden dependencies, latency and battery limits, device-access problems (shared devices, pairing, app registration) and whether the demo survives if we only get a device for short slots. Score on the probability that the MVP works reliably in the live demo.'],
  ['competitive-researcher', 'sonnet', 'You are a competitive researcher. Search the web for existing products, glasses apps, open-source projects and prior hackathon entries that do the same thing, and for built-in features of the glasses that already cover it. Score on novelty and differentiation that survives this search, and cite what you found with URLs.'],
  ['demo-evaluator', 'opus', 'You are evaluating the demonstration. First as a fellow hacker at a noisy face-to-face peer-review table with about two minutes: is the value obvious without explanation, is there a visible before/after, can a bystander try it? Then as the seven-person jury watching a three-minute pitch: does the demo show a measured result against a baseline and an insight? Score on demo impact across both settings.'],
]

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', description: '0-100 on your lens, same scale as the existing table' },
    hard_reject: { type: 'boolean' },
    rank_among_existing: { type: 'string', description: 'e.g. "would place 6th of 18 in the existing table for this lens"' },
    closest_existing_candidates: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
    strongest_objection: { type: 'string' },
    best_variant: { type: 'string', description: 'the version of the idea that would score highest on your lens, and its score' },
  },
  required: ['score', 'hard_reject', 'rank_among_existing', 'closest_existing_candidates', 'reason', 'strongest_objection', 'best_variant'],
}

phase('Independent judges')
const judgesP = parallel(JUDGES.map(([key, model, role]) => () =>
  agent(`${CONTEXT}
## Your task: evaluate the team's idea from one perspective
${role}

An earlier agent with exactly this lens scored every existing candidate; its criteria, ranked table and reasoning are in ${OUT}/05-evaluation/${key}.md. Read that file first and adopt its criteria and standard, so that your score for the new idea sits on the same scale and can be placed directly into that table. Score the idea as the team described it, on your lens only, 0-100. Set hard_reject under the same conditions as before: it cannot satisfy a mandatory requirement, needs an unavailable SDK capability or inaccessible data, depends on an unreliable integration, cannot produce a working demonstration, or is essentially an existing product without meaningful differentiation.

You are one of five evaluators working independently and will not see the others' assessments. State where the idea would rank in the existing table for your lens, name the existing candidates it overlaps with most, give the strongest objection, and then describe the variant of this idea that would score highest on your lens (narrower user, different input, different output) with the score you would give that variant.

Write ${OUT}/08-team-idea/${key}.md with the criterion-by-criterion assessment and evidence.`,
    { label: `judge:${key}`, phase: 'Independent judges', model, schema: JUDGE_SCHEMA }).then(r => r && { judge: key, ...r })))

const spikeP = agent(`${CONTEXT}
## Your task: feasibility spike for the team's idea
Do not debate whether this is feasible; attempt the hardest parts now. Write and run throwaway code in ${SPIKES}/live-fact-check/ (create it; keep all code and downloads there, never in the repository). The earlier spike reports in ${OUT}/06-feasibility/ show what other agents already established about the Meta toolkit, its mock device and the build; read them and do not repeat that work.

The assumptions most likely to kill or reshape this idea, in the order to test them:
1. Output and input surface: can a third-party app put a pop-up on a display and receive finger gestures on the glasses available at this event, or is the toolkit limited to camera, microphone and speaker? Establish this from Meta's documentation and our feasibility research, and define the audio-only version if needed.
2. The pipeline on representative input: take recorded speech containing a mix of true claims, false claims and uncheckable statements (public clips or text-to-speech you generate), then run transcription, checkable-claim detection, evidence retrieval and a verdict using whatever is available here without keys (open models, keyless search endpoints, public fact-check datasets or the Google Fact Check claim data if reachable). Measure end-to-end latency from the end of a spoken claim to a verdict, and precision and recall on a small labelled set, including how often it flags something true as misinformation.
3. What Jev offers for the claim-detection and verdict steps according to TypeSafe's public documentation, and what needs a key.

We have no physical glasses and no API keys in this environment: do not look for credentials, and report any step that needs a key or a device as "unverified" with exactly what the team must do to verify it on site. Stop once you have answers to these three.

Write ${OUT}/08-team-idea/feasibility.md in the same form as the other spike reports: what you ran and the actual measurements; what worked, failed and remains unverified; the architecture you would build; a fallback demo path if device access is limited to short slots; a revised MVP; an hour-by-hour outline for three people over 40 hours; and your verdict.`,
  { label: 'spike:live-fact-check', phase: 'Feasibility spike', model: 'opus', schema: { type: 'object', properties: {
    verdict: { type: 'string', enum: ['go', 'go-with-changes', 'no-go'] }, works_probability: { type: 'integer', description: 'estimated % that the MVP demo works live' },
    display_and_gestures_available: { type: 'string' }, measured_latency: { type: 'string' }, measured_accuracy: { type: 'string' },
    verified: { type: 'array', items: { type: 'string' } }, unverified: { type: 'array', items: { type: 'string' } }, killers: { type: 'array', items: { type: 'string' } },
    revised_mvp: { type: 'string' }, summary: { type: 'string' },
  }, required: ['verdict', 'works_probability', 'display_and_gestures_available', 'measured_latency', 'measured_accuracy', 'verified', 'unverified', 'killers', 'revised_mvp', 'summary'] } })

const [judgesRaw, spike] = await Promise.all([judgesP, spikeP])
const verdicts = judgesRaw.filter(Boolean)
if (verdicts.length < JUDGES.length) log(`Only ${verdicts.length} of ${JUDGES.length} judges returned`)
if (!spike) log('The feasibility spike failed; the comparison proceeds without measurements')

phase('Comparison')
const comparison = await agent(`${CONTEXT}
## Your task: place the team's idea in the existing comparison
Independent verdicts on the team's idea (full reasoning in ${OUT}/08-team-idea/<judge>.md):
${JSON.stringify(verdicts)}

Feasibility spike result (full report at ${OUT}/08-team-idea/feasibility.md):
${JSON.stringify(spike)}

Read ${OUT}/05-evaluation/_top5.md and reuse its exact weighting and method, including the three weighted views (Meta challenge award, overall win, combined), so that the new idea gets a row computed the same way as every existing candidate. Read the spike reports for the existing top five in ${OUT}/06-feasibility/ and, if it exists, ${OUT}/07-final-selection.md.

Then answer what the team needs to know:
- Where the idea ranks among all candidates on each of the three views, as described and in its strongest variant.
- A head-to-head against each of the existing top five (and against the current recommendation if one exists): where it is better, where it is worse, and on what evidence.
- Whether it should replace the recommended project, become the backup, be merged into an existing candidate, or be set aside, and what specific evidence would change that answer.
- If it is not the top choice as described, the smallest set of changes that would make it competitive, and what it would then score.

Numerical scores from language models organise the comparison; they are not the answer. Where judges disagree widely or a placement turns on one score, read their reports and decide on the evidence. State the conclusion plainly in the first lines even if it is not what the team hopes for.

Write ${OUT}/08-team-idea/comparison.md with that analysis and the extended score table.`,
  { label: 'comparison', phase: 'Comparison', model: 'opus', schema: { type: 'object', properties: {
    verdict: { type: 'string', enum: ['replace-recommendation', 'make-backup', 'merge-into-existing', 'set-aside'] },
    rank_meta_award: { type: 'string' }, rank_overall_win: { type: 'string' }, rank_combined: { type: 'string' },
    weighted_scores: { type: 'string' }, headline: { type: 'string' }, strongest_points: { type: 'array', items: { type: 'string' } }, weakest_points: { type: 'array', items: { type: 'string' } },
    changes_to_compete: { type: 'array', items: { type: 'string' } }, improved_variant_rank: { type: 'string' }, what_would_change_verdict: { type: 'string' },
  }, required: ['verdict', 'rank_meta_award', 'rank_overall_win', 'rank_combined', 'weighted_scores', 'headline', 'strongest_points', 'weakest_points', 'changes_to_compete', 'improved_variant_rank', 'what_would_change_verdict'] } })

return { comparison, verdicts, spike }
