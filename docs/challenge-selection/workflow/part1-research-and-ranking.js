export const meta = {
  name: 'junction-challenge-selection-part1',
  description: 'Junction 2026: challenge intelligence, per-challenge research teams, and three opportunity rankings ending in a top-5 shortlist',
  phases: [
    { title: 'Rules & tech challenges', detail: 'judging mechanism, jury lenses, stackable tech challenges' },
    { title: 'Challenge analyst', detail: 'Agent A: one structured challenge report per challenge' },
    { title: 'Competitive intel', detail: 'Agent B: prior winners, existing products, obvious ideas', model: 'sonnet' },
    { title: 'Opportunity discovery', detail: 'Agent C: gaps and differentiated angles' },
    { title: 'Technical feasibility', detail: 'Agent D: architecture, dependencies, demo reliability' },
    { title: 'Ranking', detail: 'three independent rankings plus database and shortlist' },
  ],
}

const ROOT = '/Users/ciprian/code/Junction 26'
const DOC = `${ROOT}/docs/JUNCTION_2026_CHALLENGES.md`
const JURY = `${ROOT}/docs/00-Jury-profiles-and-pitch-guide.pdf`
const OUT = `${ROOT}/docs/challenge-selection`

const CHALLENGES = [
  ['decode-the-noise', 'Decode the Noise', 11, 100],
  ['earned-trust-in-ai-code', 'Earned Trust in AI Code', 101, 272],
  ['make-unicorns-real', 'Make Unicorns Real', 273, 354],
  ['spread', 'Spread: run a car transport company for a week', 355, 408],
  ['break-the-agent', 'Break the Agent', 409, 534],
  ['trusted-trade-agents', 'Trusted Trade Agents', 535, 574],
  ['valio-aimo', 'Valio Aimo', 575, 696],
  ['internet-butler', 'The Internet Butler / Your Personal Assistant', 697, 779],
  ['green-european-renaissance', 'The Green European Renaissance', 780, 877],
  ['ai-glasses', 'AI Glasses for Everyone, Everyday', 878, 946],
  ['intel-physical-ai', 'Stop Simulating, Start Moving (Intel Physical AI Challenge)', 947, 1037],
  ['robot-teleoperation', 'The Robot Teleoperation Challenge', 1038, 1142],
  ['aaltonomous-humanoid', 'Aaltonomous Humanoid', 1143, 1281],
  ['make-blueprints-talk', 'Make Blueprints Talk', 1561, 1628],
  ['web-real-time-database', 'The Web Is Your Real-Time Database', 1629, 1743],
  ['rethinking-recruitment', 'Rethinking Recruitment', 1744, 1897],
  ['wikipedia-through-time', 'Wikipedia Through Time', 1898, 2027],
  ['personal-economic-trainer', 'Personal Economic Trainer', 2028, 2113],
].map(([slug, title, start, end]) => ({ slug, title, start, end }))

const CONTEXT = `
## Situation
We are a three-person team entering Junction 2026 (Helsinki hackathon, starting 13 November 2026, about 40 hours of build time). We are selecting which challenge to enter and what to build. You are one agent in a multi-stage selection pipeline; other agents handle the other stages, so do only the task described below.

## Team
- Three people, all experienced with AI development tools and running many coding agents in parallel, so raw implementation speed is high.
- Confident in: full-stack web apps and AI agents (TypeScript, LLM APIs, agent orchestration), ML and data science (training, evaluation, data pipelines), mobile and wearables (apps, device SDKs, streaming audio/video).
- Not confident in embedded electronics or robotics. We are reluctant to take challenges that hinge on physical hardware debugging, but consumer-device challenges (for example Meta smart glasses) are acceptable. Do not rule a hardware challenge out for us; describe honestly how much physical hardware work it needs.
- Healthcare challenges are out of scope and are not being researched.

## How prizes are decided
Partner (sponsor) judges choose each challenge award. Face-to-face peer review by other participants selects five overall finalists. A seven-person jury picks the overall winner from those finalists. One project may also enter side "tech challenges" (Best Use of X). We care about three separate objectives: (1) winning a single partner challenge, (2) winning overall, (3) the best combined chance at both.

## Sources
- Official challenge text: ${DOC} (cite as CHALLENGES.md:L<line>).
- Jury profiles and pitch guide: ${JURY} (a PDF; read it with the Read tool using the pages parameter, or pdftotext).
- The web: use web search and fetch (load them with ToolSearch if they are not already available) for sponsor documentation, past Junction and Devpost winners, GitHub and existing products.

## Evidence rules
Every factual claim about rules, prizes, requirements, APIs or existing products needs a citation: a CHALLENGES.md line reference or a URL you actually opened. When the sources do not say something, write "unknown" instead of guessing, because the team will make an irreversible choice from these files and an invented eligibility rule or prize could send us down the wrong challenge. Label your own estimates and inferences as estimates.

## Resuming
This pipeline may be restarted after an interruption, so before doing any work check whether your output file already exists. If it exists and ends with the line "<!-- complete -->", an earlier run finished this task: do no new research, read the file, and return the structured result derived from it. If it exists without that line, it is a partial draft from an interrupted run; reuse what is sound in it and finish the task. When you finish writing your report, make "<!-- complete -->" its last line.

## Output
Write your report as GitHub-flavoured markdown to the exact file path given in the task (create parent directories as needed), written for a teammate who has not read the challenge text. Lead with a three-to-five line summary, then the detail. Do not modify any other file in the repository. Then return the structured result requested; keep its free-text fields short, since the markdown file holds the detail.
`

const chRef = c => `Challenge: "${c.title}" (slug ${c.slug}). Its official text is lines ${c.start}-${c.end} of ${DOC}; read that whole range first (the track heading may sit a few lines above).`

const A_SCHEMA = {
  type: 'object',
  properties: {
    sponsor: { type: 'string' },
    track: { type: 'string' },
    one_line: { type: 'string', description: 'what the challenge asks for, one sentence' },
    prize: { type: 'string', description: 'prize as stated, or "unknown"' },
    mandatory_requirements: { type: 'array', items: { type: 'string' } },
    judging_emphasis: { type: 'string', description: 'stated criteria and weights, or "unknown"' },
    provided_resources: { type: 'array', items: { type: 'string' } },
    disqualifiers: { type: 'array', items: { type: 'string' } },
    sponsor_real_goal: { type: 'string' },
    exceptional_submission: { type: 'string' },
    technical_difficulty: { type: 'integer', description: '1-10 estimate' },
    physical_hardware_dependence: { type: 'string', enum: ['none', 'consumer-device', 'provided-kit', 'heavy'] },
  },
  required: ['sponsor', 'one_line', 'prize', 'mandatory_requirements', 'judging_emphasis', 'disqualifiers', 'sponsor_real_goal', 'exceptional_submission', 'technical_difficulty', 'physical_hardware_dependence'],
}
const B_SCHEMA = {
  type: 'object',
  properties: {
    saturation: { type: 'string', enum: ['low', 'medium', 'high'], description: 'how crowded the solution space is with existing products and prior hackathon entries' },
    expected_team_interest: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'], description: 'estimate of how many Junction teams will pick this challenge' },
    obvious_ideas: { type: 'array', items: { type: 'string' }, description: 'ideas judges will see repeatedly' },
    notable_existing_solutions: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['saturation', 'expected_team_interest', 'obvious_ideas', 'notable_existing_solutions', 'summary'],
}
const C_SCHEMA = {
  type: 'object',
  properties: {
    opportunities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, gap: { type: 'string' }, why_now: { type: 'string' } }, required: ['name', 'gap'] } },
    differentiation_potential: { type: 'integer', description: '1-10 estimate' },
    demo_potential: { type: 'integer', description: '1-10 estimate' },
    jury_fit: { type: 'integer', description: '1-10 estimate of fit with the overall jury lenses' },
    stackable_tech_challenges: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['opportunities', 'differentiation_potential', 'demo_potential', 'jury_fit', 'stackable_tech_challenges', 'summary'],
}
const D_SCHEMA = {
  type: 'object',
  properties: {
    buildable_in_40h: { type: 'integer', description: '1-10 estimate that a strong core feature ships in 40 hours with this team' },
    demo_reliability: { type: 'integer', description: '1-10 estimate that a live demo works on the day' },
    critical_dependencies: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'array', items: { type: 'string' } },
    unknowns_to_resolve_on_site: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['buildable_in_40h', 'demo_reliability', 'critical_dependencies', 'blockers', 'unknowns_to_resolve_on_site', 'summary'],
}

phase('Rules & tech challenges')
const prelim = parallel([
  () => agent(`${CONTEXT}
## Your task: judging mechanism and jury digest
Read the whole jury PDF and the opening section of the challenges file. Check the official Junction 2026 site (hackjunction.com and the challenge page linked at the top of the challenges file) for the current rules on judging, peer review, finalists, team size, submission and demo requirements, and whether one project may enter several challenges.

Write ${OUT}/00-rules-and-jury.md covering: how each award is decided and by whom; submission and demo requirements; what is known and unknown about peer review; each of the seven jurors' lens, rehearsal question and best evidence; the shared qualities the panel rewards; and a short scoring rubric (five to seven criteria with weights) that later agents can apply to estimate "overall winner" appeal, with the reasoning for the weights. Separate what the official sources state from what the guide infers.`,
    { label: 'rules-and-jury', phase: 'Rules & tech challenges', model: 'opus', schema: { type: 'object', properties: { judging_mechanism: { type: 'string' }, multi_challenge_rule: { type: 'string' }, jury_rubric: { type: 'string', description: 'the overall-winner rubric with weights, compact' }, peer_review_notes: { type: 'string' }, unknowns: { type: 'array', items: { type: 'string' } } }, required: ['judging_mechanism', 'multi_challenge_rule', 'jury_rubric', 'peer_review_notes', 'unknowns'] } }),
  () => agent(`${CONTEXT}
## Your task: tech challenge catalogue
The "Tech Challenges" section runs from line 2114 to the end of ${DOC}. These are side prizes ("Best Use of X") that a project may be able to stack on top of a main challenge. Read the whole section.

Write ${OUT}/01-challenge-intelligence/_tech-challenges.md with one table row per tech challenge (sponsor, what must be used, prize, stated judging criteria, eligibility conditions, effort to integrate honestly for a web/AI project, citation) followed by notes on which ones are cheap to stack and which demand the project be built around them. This is extraction from the document; do not research the web beyond confirming what a product is when the text is unclear.`,
    { label: 'tech-challenges', phase: 'Rules & tech challenges', model: 'sonnet', schema: { type: 'object', properties: { tech_challenges: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, requirement: { type: 'string' }, prize: { type: 'string' }, stack_effort: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['name', 'requirement', 'prize', 'stack_effort'] } } }, required: ['tech_challenges'] } }),
])

const research = await pipeline(
  CHALLENGES,
  c => agent(`${CONTEXT}
## Your task: challenge analyst (Agent A)
${chRef(c)}
Follow links in the challenge text to sponsor material where that clarifies requirements or resources.

Write ${OUT}/01-challenge-intelligence/${c.slug}.md containing:
1. A database record: challenge, sponsor, track, main requirement, judging emphasis and weights, prize, provided APIs/data/hardware, submission requirements, each with a citation or "unknown".
2. What the sponsor is actually trying to encourage, and the evidence for that reading.
3. The explicit requirements, quoted.
4. What a mediocre submission would look like.
5. What an exceptional submission would demonstrate.
6. Constraints that could disqualify a project.
7. How much physical hardware work the challenge demands.`,
    { label: `A:${c.slug}`, phase: 'Challenge analyst', model: 'opus', schema: A_SCHEMA }),
  async (a, c) => {
    const brief = `Agent A's structured summary of this challenge (its full report is at ${OUT}/01-challenge-intelligence/${c.slug}.md):\n${JSON.stringify(a)}`
    const [bc, d] = await Promise.all([
      (async () => {
        const b = await agent(`${CONTEXT}
## Your task: competitive intelligence (Agent B)
${chRef(c)}
${brief}

Research on the web what already exists in this challenge's solution space, so we can avoid building what judges have seen many times:
- previous winners of the same sponsor's or similar challenges at Junction and other hackathons (Devpost, hackjunction, sponsor blogs);
- similar hackathon submissions;
- open-source implementations on GitHub;
- commercial products that already solve the problem;
- the approaches most teams will reach for first this weekend.

Write ${OUT}/02-research/${c.slug}/competitive.md with those findings (each with a URL), a list of the obvious ideas to avoid, an estimate of how crowded this challenge will be among Junction teams with your reasoning, and what a submission would need in order to look different from all of the above.`,
          { label: `B:${c.slug}`, phase: 'Competitive intel', model: 'sonnet', schema: B_SCHEMA })
        const pre = await prelim
        const cc = await agent(`${CONTEXT}
## Your task: opportunity discovery (Agent C)
${chRef(c)}
${brief}

Competitive findings from Agent B (full report at ${OUT}/02-research/${c.slug}/competitive.md):
${JSON.stringify(b)}

Overall-jury rubric (full digest at ${OUT}/00-rules-and-jury.md):
${JSON.stringify(pre[0])}

Stackable tech challenges (full table at ${OUT}/01-challenge-intelligence/_tech-challenges.md):
${JSON.stringify(pre[1])}

Look for gaps, not existing solutions. Identify:
- problems inside this challenge with high impact and poor existing solutions;
- underused capabilities of the sponsor's API, data or hardware (read the sponsor documentation);
- combinations of technologies that enable something new;
- things that were impractical before recent AI capabilities;
- angles that produce a compelling live demonstration with a visible before/after;
- which tech challenges an entry here could honestly stack.

Write ${OUT}/02-research/${c.slug}/opportunity.md with three to six opportunity areas (these are directions, not finished project ideas; a later stage generates ideas), each with the gap, the evidence for it, why the sponsor would care, and how it would read to the overall jury. End with your estimates for differentiation potential, demo potential and jury fit, with reasons.`,
          { label: `C:${c.slug}`, phase: 'Opportunity discovery', model: 'opus', schema: C_SCHEMA })
        return { b, c: cc }
      })(),
      agent(`${CONTEXT}
## Your task: technical feasibility (Agent D)
${chRef(c)}
${brief}

Assess whether our team can build a strong entry for this challenge in about 40 hours and demo it live. Read the sponsor's actual API, SDK, dataset or hardware documentation on the web. Determine:
- the architecture a credible entry needs;
- critical dependencies (APIs, datasets, credentials, devices) and how we get access during the event;
- API limits, pricing, latency and reliability problems that are documented or reported;
- integration complexity given our skills;
- whether the core feature fits in the time limit, and what the smallest complete version is;
- the likelihood of a successful live demonstration and what would make it fail;
- what we must ask the sponsor on site before committing.

Write ${OUT}/02-research/${c.slug}/feasibility.md with those findings. A reliable 95% build beats an ambitious 30% one, so be concrete about failure modes and do not soften them.`,
        { label: `D:${c.slug}`, phase: 'Technical feasibility', model: 'opus', schema: D_SCHEMA }),
    ])
    return { slug: c.slug, title: c.title, analyst: a, competitive: bc.b, opportunity: bc.c, feasibility: d }
  },
)

const done = research.filter(Boolean)
const dropped = CHALLENGES.filter(c => !done.find(r => r.slug === c.slug)).map(c => c.slug)
if (dropped.length) log(`Research failed for: ${dropped.join(', ')} (excluded from ranking)`)
const pre = await prelim

phase('Ranking')
const DATA = `Research results for ${done.length} challenges (one object each; full reports under ${OUT}/01-challenge-intelligence/<slug>.md and ${OUT}/02-research/<slug>/{competitive,opportunity,feasibility}.md, which you should open wherever a score looks decisive or surprising):
${JSON.stringify(done)}

Judging mechanism and overall-jury rubric (full digest at ${OUT}/00-rules-and-jury.md):
${JSON.stringify(pre[0])}

Tech challenges:
${JSON.stringify(pre[1])}`

const RANK_SCHEMA = {
  type: 'object',
  properties: {
    ranking: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, score: { type: 'number', description: '0-100' }, rationale: { type: 'string' }, biggest_risk: { type: 'string' } }, required: ['slug', 'score', 'rationale', 'biggest_risk'] } },
  },
  required: ['ranking'],
}
const LENSES = [
  ['challenge-prize', 'Probability that our team wins the partner (sponsor) challenge award. Weigh: fit between what the sponsor wants and what we can build exceptionally, competitive density among Junction teams, differentiation potential against obvious entries, feasibility and demo reliability, and how well an entry can showcase the sponsor technology. Ignore overall-jury appeal.'],
  ['overall-winner', 'Probability that a project built for this challenge becomes one of the five peer-review finalists and then wins the seven-person jury vote. Weigh: how well the challenge space supports the jury rubric (specific user value, a visible before/after, a defensible insight with a baseline, evidence under realistic conditions, a plausible continuation), how legible and striking the demo is to other hackers in face-to-face peer review, and feasibility. Ignore the sponsor prize.'],
  ['combined', 'Best combined expected outcome across the partner challenge award, the overall win, and stackable tech-challenge prizes. A challenge ranks highly here when one project can credibly compete for the sponsor award and also be a strong overall finalist, with cheap honest tech-challenge stacking as a bonus.'],
]
const rankings = (await parallel(LENSES.map(([key, desc]) => () =>
  agent(`${CONTEXT}
## Your task: rank the challenges for one objective
Objective "${key}": ${desc}

${DATA}

Score every challenge 0-100 for this objective using the same criteria for each, so the scores are comparable. Apply our team constraints: hardware-heavy challenges are penalised in proportion to the physical work involved, consumer-device challenges are not. Treat the 1-10 numbers from the research agents as rough inputs written by different agents with different calibration, and check the underlying reports before letting one decide a placement. Competition estimates are uncertain; say so where the ranking depends on them.

Write ${OUT}/03-opportunity-ranking/ranking-${key}.md with the criteria and weights you used, a full ranked table (score, per-criterion scores, one-line rationale, biggest risk) and a paragraph on each of the top six explaining the placement and what evidence would change it.`,
    { label: `rank:${key}`, phase: 'Ranking', model: 'opus', schema: RANK_SCHEMA }).then(r => r && { lens: key, ...r })))).filter(Boolean)

const [database, shortlist] = await parallel([
  () => agent(`${CONTEXT}
## Your task: compile the challenge database
Turn the data below into ${OUT}/01-challenge-intelligence/_database.md: one wide markdown table with a row per challenge (challenge, sponsor, track, main requirement, judging emphasis, prize, technical difficulty, competitive saturation, expected team interest, differentiation potential, demo potential, jury fit, buildable in 40h, demo reliability, hardware dependence, stackable tech challenges, top opportunity), followed by a link list to each challenge's four reports using relative paths. Copy values as given; write "unknown" for anything missing and do not fill gaps yourself.

${DATA}`, { label: 'database', phase: 'Ranking', model: 'sonnet' }),
  () => agent(`${CONTEXT}
## Your task: produce the top-5 challenge shortlist
Three agents ranked the challenges independently, one per objective. Their rankings (full reasoning in ${OUT}/03-opportunity-ranking/ranking-<objective>.md):
${JSON.stringify(rankings)}

${DATA}

Select the five challenges that should go forward to idea generation, plus two alternates. The five should serve all three objectives: include the strongest picks for the challenge prize, for the overall win and for the combined outcome, and prefer challenges that appear high on more than one list. Where the rankers disagree sharply, open the underlying research reports and decide on the evidence. Apply hard rejections: a challenge whose mandatory requirements we cannot meet, that needs inaccessible data or hardware, or that cannot yield a working demo, does not make the shortlist regardless of score.

Write ${OUT}/03-opportunity-ranking/shortlist.md with: a side-by-side table of all challenges across the three rankings; the five picks with the objective each serves and the reason; the two alternates; the challenges rejected and why; the disagreements between rankers and how you resolved them; and the open questions the team should ask sponsors on site before the final choice. The team will read this file to approve or edit the shortlist, so make the decision easy to check.`,
    { label: 'shortlist', phase: 'Ranking', model: 'opus', schema: { type: 'object', properties: { top5: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, serves: { type: 'string' }, reason: { type: 'string' } }, required: ['slug', 'serves', 'reason'] } }, alternates: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, reason: { type: 'string' } }, required: ['slug', 'reason'] } }, rejected: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, reason: { type: 'string' } }, required: ['slug', 'reason'] } }, disagreements: { type: 'string' }, onsite_questions: { type: 'array', items: { type: 'string' } } }, required: ['top5', 'alternates', 'rejected', 'disagreements', 'onsite_questions'] } }),
])

return { shortlist, rankings, dropped, research: done, prelim: pre, database_written: !!database }
