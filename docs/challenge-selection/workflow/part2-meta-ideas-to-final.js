export const meta = {
  name: 'junction-challenge-selection-part2-meta',
  description: 'Junction 2026, Meta AI Glasses challenge: generate ideas, judge them independently, spike the top five, pick a project and backup',
  phases: [
    { title: 'Idea generation', detail: 'five generators with different angles, then consolidation' },
    { title: 'Independent judges', detail: 'five evaluators score every candidate without seeing each other' },
    { title: 'Top 5', detail: 'aggregate scores, apply hard rejections' },
    { title: 'Feasibility spikes', detail: 'throwaway code against the real SDK and docs, no keys' },
    { title: 'Final selection', detail: 'one project plus backup per objective' },
  ],
}

const ROOT = '/Users/ciprian/code/Junction 26'
const DOC = `${ROOT}/docs/JUNCTION_2026_CHALLENGES.md`
const OUT = `${ROOT}/docs/challenge-selection`
const SPIKES = '/private/tmp/claude-501/-Users-ciprian-code-Junction-26/0b7e22bb-475f-46d0-b0ee-bd58ea7f4e50/scratchpad/spikes'

const CONTEXT = `
## Situation
We are a three-person team at Junction 2026 (Helsinki hackathon, started 13 November 2026, about 40 hours of build time). After researching every challenge we have committed to one: "AI Glasses for Everyone, Everyday" by Meta. That decision is final; do not revisit it. You are one agent in a pipeline that now decides what to build for it. Other agents handle the other stages, so do only the task described below.

## Team
- Three people, all experienced with AI development tools and running many coding agents in parallel, so raw implementation speed is high and feature count is not our constraint.
- Confident in: full-stack web apps and AI agents (TypeScript, LLM APIs, agent orchestration), ML and data science (training, evaluation, data pipelines), mobile and wearables (apps, device SDKs, streaming audio/video).
- Not confident in embedded electronics.

## How prizes are decided
Meta's judges choose the challenge award. Face-to-face peer review by other participants selects five overall finalists. A seven-person jury picks the overall winner from those finalists. A project may also enter side "tech challenges" (Best Use of X). We care about three separate objectives and want an answer for each: (1) winning the Meta challenge, (2) winning overall, (3) the best combined chance at both.

## Sources you should read before working
- Official challenge text: lines 878-946 of ${DOC} (cite as CHALLENGES.md:L<line>).
- Our research on this challenge: ${OUT}/01-challenge-intelligence/ai-glasses.md and ${OUT}/02-research/ai-glasses/competitive.md, opportunity.md and feasibility.md. The feasibility report covers device access (about 20 shared devices), the Meta Wearables Device Access Toolkit and its limits; treat those constraints as real.
- Judging mechanism, juror lenses and the overall-winner rubric: ${OUT}/00-rules-and-jury.md.
- Stackable tech challenges: ${OUT}/01-challenge-intelligence/_tech-challenges.md.
- The web (load search and fetch with ToolSearch if they are not already available) for Meta developer documentation, existing glasses apps, prior hackathon entries and anything else you need to verify.

## Evidence rules
Claims about rules, SDK capabilities, device limits or existing products need a citation: a CHALLENGES.md line, one of our research files, or a URL you opened. When the sources do not say something, write "unknown". Label estimates as estimates. The team will commit 40 hours on the strength of these files, so an invented SDK capability is the most damaging mistake you could make.

## Resuming
This pipeline may be restarted after an interruption, so before doing any work check whether your output file already exists. If it exists and ends with the line "<!-- complete -->", an earlier run finished this task: do no new work, read the file, and return the structured result derived from it. If it exists without that line, it is a partial draft; reuse what is sound and finish the task. When you finish writing your report, make "<!-- complete -->" its last line.

## Output
Write your report as GitHub-flavoured markdown to the exact file path given in the task (create parent directories as needed), written for a teammate who has not followed the pipeline. Lead with a three-to-five line summary, then the detail. Do not modify any other file in the repository. Then return the structured result requested; keep its free-text fields short, since the markdown file holds the detail.
`

const ANGLES = [
  ['accessibility', 'People for whom hands-free, eyes-up assistance changes what they can do: blind and low-vision users, deaf and hard-of-hearing users, people with memory, attention or motor difficulties, and the people who support them.'],
  ['everyday-consumer', 'Ordinary daily life for a mainstream wearer: errands, cooking, shopping, travel, language, family, learning, health habits. The challenge title says "for everyone, everyday"; take that literally and look for a trigger that recurs daily.'],
  ['hands-busy-work', 'People whose hands and eyes are occupied while they work or practise a skill: trades, repair, lab work, care work, logistics, cooking professionally, sport and music practice, field inspection.'],
  ['capability-first', 'Start from the device and SDK rather than from a user: list what the glasses and toolkit can actually do today (camera stream, microphones, speakers, capture triggers, phone-side compute) and what they cannot, then find uses that only this exact combination enables and that a phone in the hand does worse.'],
  ['social-play-and-evidence', 'Two under-explored directions: shared, playful or social experiences between people; and concepts whose value can be measured against a baseline during the weekend (a task completed faster, fewer errors, a benchmark), since several jurors care most about measured benefit and honest failure rates.'],
]

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, user_problem: { type: 'string' }, mechanism: { type: 'string' },
      demo_30s: { type: 'string' }, hardest_risk: { type: 'string' }, mvp: { type: 'string' },
    }, required: ['name', 'user_problem', 'mechanism', 'demo_30s', 'hardest_risk', 'mvp'] } },
  },
  required: ['ideas'],
}

phase('Idea generation')
const generated = (await parallel(ANGLES.map(([key, desc]) => () =>
  agent(`${CONTEXT}
## Your task: generate project concepts from one angle
Your objective is to maximise our probability of winning, not feature count. Several generators are working in parallel, each from a different starting point so that the set is diverse. Yours:

"${key}": ${desc}

Generate seven differentiated project concepts for the Meta challenge from this angle. For each concept give:
1. The specific user and problem, with one concrete moment in their day.
2. Why existing solutions (including the phone in their pocket and the glasses' built-in assistant) are insufficient.
3. The novel technical mechanism: what we figured out that makes this materially better than the obvious approach.
4. Why the glasses are essential rather than decorative.
5. A 30-second live demonstration that works at a noisy peer-review table, including what the observer sees or hears.
6. The hardest implementation risk, and whether the demo survives without a physical device (for example via the toolkit's mock device or a recorded stream).
7. The smallest complete MVP.
8. Which Meta judging criteria and which juror lenses it satisfies, and which tech challenges it could honestly stack.

Reject generic AI wrappers ("describe what I see", a chatbot in glasses, a plain translator or memory recorder) unless you have a credible mechanism that sets the concept apart; the competitive report lists what judges will have seen. Prefer concepts with a visible before/after and something measurable against a baseline. Respect the documented SDK limits: a concept that needs a capability the toolkit does not expose is not a candidate.

Write ${OUT}/04-ideas/${key}.md with the seven concepts in that structure, ordered by how strong you think they are, with a note on the two you would bet on and why.`,
    { label: `ideas:${key}`, phase: 'Idea generation', model: 'opus', schema: IDEA_SCHEMA }).then(r => r && { angle: key, ...r })))).filter(Boolean)

const CAND_SCHEMA = {
  type: 'object',
  properties: {
    candidates: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string', description: 'short kebab-case id, unique' }, name: { type: 'string' }, source_angles: { type: 'array', items: { type: 'string' } },
      user_problem: { type: 'string' }, mechanism: { type: 'string' }, why_glasses: { type: 'string' }, demo_30s: { type: 'string' },
      hardest_risk: { type: 'string' }, mvp: { type: 'string' }, stackable: { type: 'array', items: { type: 'string' } },
    }, required: ['id', 'name', 'user_problem', 'mechanism', 'why_glasses', 'demo_30s', 'hardest_risk', 'mvp'] } },
    dropped: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } },
  },
  required: ['candidates', 'dropped'],
}
const consolidated = await agent(`${CONTEXT}
## Your task: consolidate the generated concepts into a candidate list
Five generators produced concepts independently (full write-ups in ${OUT}/04-ideas/<angle>.md; read them, the summaries below omit detail):
${JSON.stringify(generated)}

Produce the candidate list that five independent judges will score. Merge concepts that are the same idea, keeping the strongest mechanism and demo from each version and noting which angles converged on it (convergence means the idea is obvious to others too, which matters for novelty). Drop concepts that are generic wrappers, that need an SDK capability our feasibility report says is unavailable, or that are plainly dominated by another candidate. Keep between 14 and 20 candidates and keep the set diverse; do not rank them, because ranking is the judges' job and they should not inherit your preferences.

Write ${OUT}/04-ideas/_candidates.md with one section per candidate using the eight-point structure from the generators' files, a short id for each, and a final list of what you merged or dropped and why.`,
  { label: 'consolidate', phase: 'Idea generation', model: 'opus', schema: CAND_SCHEMA })

const cands = consolidated.candidates
log(`${cands.length} candidates go to the judges; ${consolidated.dropped.length} merged or dropped`)

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    scores: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, score: { type: 'number', description: '0-100 on your lens' }, hard_reject: { type: 'boolean' },
      reason: { type: 'string' }, strongest_objection: { type: 'string' },
    }, required: ['id', 'score', 'hard_reject', 'reason', 'strongest_objection'] } },
  },
  required: ['scores'],
}
const JUDGES = [
  ['meta-judge', 'opus', 'You are scoring as a Meta partner judge. Apply the official judging criteria in the challenge text exactly as written, with their stated weights if any, and score each candidate criterion by criterion. Consider what Meta wants to showcase about its glasses and toolkit and what it would be embarrassed to award (privacy problems, policy violations, uses that make the product look creepy).'],
  ['skeptical-investor', 'opus', 'You are a sceptical investor with the overall jury\'s concerns in mind: is the problem real, who cares enough to use this, why would they use it again after the first impressive demo, and what is the believable next step. Paying interest and actual repeated use are different things; look for a recurring trigger. Score each candidate on real-world usefulness and repeat value.'],
  ['senior-engineer', 'opus', 'You are a senior engineer who has to ship this in 40 hours and demo it live. Identify implementation risks, hidden dependencies, latency and battery limits, device-access problems (shared devices, pairing, app registration) and whether the demo survives if we only get a device for short slots. Score each candidate on the probability that the MVP works reliably in the live demo.'],
  ['competitive-researcher', 'sonnet', 'You are a competitive researcher. For each candidate, search the web for existing products, glasses apps, open-source projects and prior hackathon entries that do the same thing, and for built-in features of the glasses that already cover it. Score each candidate on novelty and differentiation that survives this search, and cite what you found with URLs.'],
  ['demo-evaluator', 'opus', 'You are evaluating the demonstration. First as a fellow hacker at a noisy face-to-face peer-review table with about two minutes: is the value obvious without explanation, is there a visible before/after, can a bystander try it? Then as the seven-person jury watching a three-minute pitch: does the demo show a measured result against a baseline and an insight? Score each candidate on demo impact across both settings.'],
]

phase('Independent judges')
const CAND_BLOCK = `Candidates (full write-ups in ${OUT}/04-ideas/_candidates.md, which you should read):\n${JSON.stringify(cands)}`
const verdicts = (await parallel(JUDGES.map(([key, model, role]) => () =>
  agent(`${CONTEXT}
## Your task: evaluate every candidate from one perspective
${role}

${CAND_BLOCK}

You are one of five evaluators working independently, each with a different lens; you will not see the others' assessments, and the candidates were written by other agents, so you have no stake in any of them. Score every candidate 0-100 on your lens only, using the same standard for each so the scores are comparable, and use the full range. Set hard_reject when a candidate cannot satisfy a mandatory requirement, needs inaccessible data or an unavailable SDK capability, depends on an unreliable integration, cannot produce a working demonstration, or is essentially an existing product without meaningful differentiation. Give the strongest objection to every candidate, including the ones you like.

Write ${OUT}/05-evaluation/${key}.md with your criteria, a ranked table, and a paragraph of evidence for each candidate.`,
    { label: `judge:${key}`, phase: 'Independent judges', model, schema: JUDGE_SCHEMA }).then(r => r && { judge: key, ...r })))).filter(Boolean)
if (verdicts.length < JUDGES.length) log(`Only ${verdicts.length} of ${JUDGES.length} judges returned; aggregation proceeds with those`)

phase('Top 5')
const top = await agent(`${CONTEXT}
## Your task: aggregate the independent evaluations into a top five
${CAND_BLOCK}

Independent verdicts from the evaluators (full reasoning in ${OUT}/05-evaluation/<judge>.md):
${JSON.stringify(verdicts)}

Combine these into a comparison. Start from this weighting and adjust it to the official Meta criteria where they differ, saying what you changed: alignment with official judging criteria 25%, novelty and differentiation 20%, demo impact 20%, technical feasibility 15%, real-world usefulness 10%, sponsor technology integration 10%. Compute three views, because we have three objectives: Meta challenge award, overall win (peer review then jury), and combined.

Numerical scores from language models are a way to organise the comparison, not the answer. Where judges disagree by a wide margin, or where a placement turns on one score, read the evaluators' reports and decide on the evidence. A hard rejection from any judge removes a candidate unless you can show from the sources that the judge was wrong. Where two strong candidates are complementary, you may propose a combined concept, as long as its MVP is still small.

Select five concepts to send to feasibility spikes: they should include the best candidate for each of the three objectives. For each, state the single hardest technical assumption that a short experiment should test first.

Write ${OUT}/05-evaluation/_top5.md with the full score table (every candidate, every judge, three weighted views), the hard rejections, the disagreements and how you resolved them, and the five selected concepts with their spike question.`,
  { label: 'top5', phase: 'Top 5', model: 'opus', schema: { type: 'object', properties: { top5: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, name: { type: 'string' }, concept: { type: 'string', description: 'self-contained description including mechanism and MVP' }, serves: { type: 'string' },
    spike_question: { type: 'string' }, scores: { type: 'string' },
  }, required: ['id', 'name', 'concept', 'serves', 'spike_question'] } }, notes: { type: 'string' } }, required: ['top5', 'notes'] } })

phase('Feasibility spikes')
const spikes = (await parallel(top.top5.map(t => () =>
  agent(`${CONTEXT}
## Your task: feasibility spike for one concept
Concept "${t.name}" (id ${t.id}): ${t.concept}
Full context: ${OUT}/05-evaluation/_top5.md and ${OUT}/04-ideas/_candidates.md.
The assumption to test first: ${t.spike_question}

Do not debate whether this is feasible; attempt the hardest part now. Write and run throwaway code in ${SPIKES}/${t.id}/ (create it; keep all code and downloads there, never in the repository). Useful targets: install the Meta Wearables Device Access Toolkit or its sample app and mock device if they are publicly obtainable and see how far a build gets; run the core perception or reasoning step on representative recorded input (a phone or webcam video, public sample clips, audio files) to measure accuracy and end-to-end latency; test the open-source or keyless parts of the pipeline. We have no physical glasses and no API keys in this environment: do not look for credentials, and report any step that needs a key or a device as "unverified", with exactly what the team must do to verify it on site. Spend your effort on the one or two experiments that could kill the idea, and stop once you have an answer.

Write ${OUT}/06-feasibility/${t.id}.md with: what you ran and the actual output or measurements; what worked, what failed and what remains unverified; the architecture you would build; a fallback demo path if device access is limited to short slots; a revised MVP; an hour-by-hour outline for three people over 40 hours; and your verdict.`,
    { label: `spike:${t.id}`, phase: 'Feasibility spikes', model: 'opus', schema: { type: 'object', properties: {
      verdict: { type: 'string', enum: ['go', 'go-with-changes', 'no-go'] }, works_probability: { type: 'integer', description: 'estimated % that the MVP demo works live' },
      verified: { type: 'array', items: { type: 'string' } }, unverified: { type: 'array', items: { type: 'string' } }, killers: { type: 'array', items: { type: 'string' } },
      revised_mvp: { type: 'string' }, summary: { type: 'string' },
    }, required: ['verdict', 'works_probability', 'verified', 'unverified', 'killers', 'revised_mvp', 'summary'] } }).then(r => r && { id: t.id, name: t.name, ...r })))).filter(Boolean)
if (spikes.length < top.top5.length) log(`${top.top5.length - spikes.length} spike(s) failed and are missing from the final comparison`)

phase('Final selection')
const final = await agent(`${CONTEXT}
## Your task: final selection
The five concepts that reached feasibility testing:
${JSON.stringify(top)}

Spike results (full reports in ${OUT}/06-feasibility/<id>.md; read them all, and read ${OUT}/05-evaluation/_top5.md):
${JSON.stringify(spikes)}

Choose what we build. Give a pick and a backup for each of our three objectives (Meta challenge award, overall win, combined), then one overall recommendation: the single project the team should start now and the backup to switch to if it fails, with the specific trigger and the latest hour at which switching is still sensible. Weigh a reliable build heavily: a concept with a 95% chance of working live usually beats a more ambitious one at 30%. Results the spikes left unverified are risks, not facts.

Write ${OUT}/07-final-selection.md containing: the recommendation and the reasoning in the first screen; the per-objective picks; a comparison table of the five; for the recommended project the MVP scope, what is explicitly out of scope, architecture, the measured baseline comparison we will show, the device-access plan and fallback demo, which tech challenges to stack and the cost of each, a three-minute pitch outline mapped to the juror lenses, and the questions to ask Meta at the booth before writing code; then the same in brief for the backup; and finally the remaining risks stated plainly.`,
  { label: 'final-selection', phase: 'Final selection', model: 'opus', schema: { type: 'object', properties: {
    recommended: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, why: { type: 'string' }, mvp: { type: 'string' } }, required: ['id', 'name', 'why', 'mvp'] },
    backup: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, switch_trigger: { type: 'string' } }, required: ['id', 'name', 'switch_trigger'] },
    per_objective: { type: 'string' }, stack: { type: 'array', items: { type: 'string' } }, booth_questions: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } },
  }, required: ['recommended', 'backup', 'per_objective', 'stack', 'booth_questions', 'risks'] } })

return { final, top5: top, spikes, candidates: cands.map(c => ({ id: c.id, name: c.name })) }
