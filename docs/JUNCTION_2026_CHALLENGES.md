# Junction 2026 challenges

Source: [Junction 2026 — All Challenges](https://hackjunction.app/participate/45/challenges)

Transcribed from the Main Challenges and Tech Challenges detail pages on 13 November 2026. The page showed status “Closed”. Challenge wording, including any placeholders or inconsistencies on the source pages, is retained.

## Main Challenges

## Agentic AI Track

### Decode the Noise

[Original challenge page](https://hackjunction.app/participate/45/challenges/357)

by Hostinger

#### The Challenge

Build an AI-powered tool that detects propaganda, bots and bad actors online – and deploy it live on Hostinger's infrastructure.

#### Introduction

The internet was built to connect people, but it has also become the world's most powerful manipulation machine. Propaganda spreads faster than facts, bot networks shape public opinion at scale, and bad actors exploit the open web with growing sophistication. At Hostinger we host millions of websites, so we see this noise up close – and we believe the same technology that powers the web can also protect it. We're bringing this challenge to Junction because the best detection ideas won't come from one company; they'll come from builders who can go from idea to a live tool in 48 hours.

#### The challenge

Build a tool that analyses text, social content or web-traffic patterns to detect signs of coordinated propaganda, bot-driven amplification or bad-actor behaviour online. Solutions can take many forms: an API, a dashboard, a classifier with an explainable verdict, or a monitoring service for site owners.

Whatever you build, it **must be deployed and running live on Hostinger's infrastructure** by the end of the hackathon, with a public URL the judges can open. We care more about the strength and honesty of your detection logic – including how you handle false positives – than a polished front end.

#### Insight

**Directions we'd love to see tackled** (pick one, or combine them):

- **Spot the swarm** – detect coordinated inauthentic behaviour (bot networks, astroturfing, brigading) from posting timing, account similarity, text reuse and amplification patterns rather than from any single post.

- **Name the technique** – classify manipulation techniques in text (loaded language, fear appeals, whataboutism, fabricated authority) and explain the verdict in plain language, so a reader learns *why* something is propaganda, not just *that* it is.

- **Clean the traffic** – tell malicious bots, scrapers and credential-stuffing attempts apart from real visitors in web-server logs, and give site owners a clear, actionable view of what's hitting their site.

- **Trust the source** – score the provenance of a page or account (domain age, cloned content, AI-generated text, link networks) to help users judge who is really behind what they're reading.

We're especially interested in approaches that are **transparent and measurable** – show your precision and false-positive rate, not just a demo that works on the happy path.

#### Resources

#### What we'll bring

Every team working on this challenge gets a full Hostinger environment, **free for 1 month**, so "deployed live" is a realistic requirement, not a stretch goal. Use any language, framework or model – open-source or hosted – as long as the final product runs on Hostinger.

- **Hostinger VPS (KVM 2) per team** – 2 vCPU cores, 8 GB RAM, 100 GB NVMe storage, 8 TB bandwidth, full root access, Docker support and a free domain, with one-click templates for Ollama, n8n, Node.js and Python stacks.
- **Hostinger AI Router credits** for every team – one API key and one shared credit balance for 150+ leading models (Anthropic, OpenAI, DeepSeek, Mistral, xAI and more), OpenAI- and Anthropic-SDK compatible.
- **Hostinger AI Builder** 1-month plan to vibe-code a front end, dashboard or landing page and publish it live for free.
- **Hostinger Connector, API and CLI** – connect Claude Code, Cursor, VS Code or any MCP client to your Hostinger account and deploy, manage your server and connect a domain from your editor.
  - Docs: [docs.hostinger.com/hostinger-connector](https://docs.hostinger.com/hostinger-connector)
  - API reference: [developers.hostinger.com](https://developers.hostinger.com)
  - Open-source MCP server: [github.com/hostinger/api-mcp-server](https://github.com/hostinger/api-mcp-server)
- **On-site mentors** at the Hostinger booth for deployment, scaling, model choice and detection strategy, plus a dedicated Hostinger help channel for the whole weekend (link shared at kick-off and at our booth).

#### Mentors

**Minijus Savickas** (VPS Product) and **Emilis Strimaitis** (Innovations, AI agents) – at the Hostinger booth throughout the event.

#### Extra

Don't miss our talk **"Vibe Coding Solved Building. Now Comes the Hard Part"** on **Saturday at 13:00** – on shipping, securing and running your code in the real world. Teams that build something promising will have a path to continue the conversation with our engineering team after the event.

Company Info

#### Hostinger

Website: <a href="https://www.hostinger.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color: var(--participant-text-primary, #ffffffe6);" target="_blank">https://www.hostinger.com/</a>

#### Judging Criteria

- Detection quality (accuracy, false-positive handling, explainability)(40%)
- Technical execution & live deployment on Hostinger (25%)
- Originality & real-world impact(20%)
- Demo clarity(15%)

#### Prizes

- All three winning teams

  All three winning teams will also receive \*\*one year of Hostinger hosting and a domain\*\* to keep their project live, \*\*Hostinger swag\*\*, and a \*\*spotlight on Hostinger's social media channels\*\*.

- 1st Place

  2000 €

- 2nd Place

  1000 €

- 3rd Place

  500 €

---

### Earned Trust in AI Code

[Original challenge page](https://hackjunction.app/participate/45/challenges/351)

by Tieto

#### The Challenge

How does AI code review keep pace with AI-written code, while humans stay accountable for every change?

#### Introduction

It is Friday afternoon. A pull request lands from an agent. Two hundred lines, and your name is on the approval. Usually you would open the diff and start digging. But what if the change opened with its own explanation? What it does, why it was made, what else it touches, and how sure the AI is about each part. Suddenly you are not hunting for problems. You are checking a story, and questioning the parts that do not add up.

Pick **Earned Trust in AI Code**, and help define how code explains itself now and in the future.

#### Background

- Agent tokens passed human tokens in February 2026 and reached 7.3 trillion by August (OpenRouter data, a16z chart).
- Reviewing every change by hand does not scale, yet engineers need a sound basis to trust AI-reviewed code.

#### The challenge

Design an **AI code review concept**, then show it works. Define the concept, principles, reference implementation and technology considerations, across frontend, backend and security.

Challenge the traditional model: **is line-by-line review still the right way to ensure quality?** Balance risk, hallucination, transparency, confidence and quality in AI review. The result is a reference implementation that illustrates the concept – it is not a product.

##### What we expect from each team

1.  **Define the concept:** what your team recommends the "PR review" factory should follow.
2.  **State its key principles**, including how it balances risk, hallucination, transparency, confidence and quality.
3.  **Illustrate it as a reference**, on one sample agent-written change with its requirement ID.
4.  **Show what the AI found**, what it refused to decide, and why.
5.  **Show how the evidence** lets a named human accept the change without a full read.
6.  **Name the failure modes** you saw, and keep a short log of decisions.

*Use synthetic or cleared sample data only.*

\###Code input for the challenge

As an input for the challenge, please feel inspired but not limited with the code examples that we have collected for you. The repo is here (please make your own copy of this repo before you start the work) <https://github.com/te-industry-tech-office/junction26-messagepack-csharp> In the repo, you can find the following branches that contain code changes made by AI.

branch ju26-issue-2283 with agentic implementation of bug \#2283 (<https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2283>); this contains a commit of 4 files

branch ju26-issue-2234 with agentic implementation of bug \#2234 (<https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2234>); this contains a commit of 4 files

branch ju26-issue-2129 with agentic implementation of issue \#2129 (<https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2129>); this contains a commit of 28 files

branch ju26-issue-2297 with agentic implementation of issue \#2297 (<https://github.com/MessagePack-CSharp/MessagePack-CSharp/issues/2297>); this contains a commit of 237 files

We encourage to think "outside of the box" and in our evaluation we put more weight for the concept than only the technical implementation. "HOW CAN AI REVIEW THE CODE MADE BY AI SO THAT HUMANS CAN TRUST IT?"

##### Deliverables

- **Concept card:** recommendation, principles, trade-offs, limits
- **Live walkthrough** showing where the trust comes from
- **Lessons log** and a demo video/presentation

**Out of scope:** a finished product, model training and vendor selection.

**Expected outcome:** a concept with explicit trade-offs that humans can trust and be accountable for.

#### Insight

#### AI reviews. Humans stay accountable.

Trust is built on evidence a person can check and own, not on the AI being confident.

##### How humans build trust they can stand behind

1.  A named engineer owns each change and signs off on it.

2.  The AI review is advice with evidence, never the approval itself.

3.  Evidence is traceable to a requirement, so the owner can check it quickly.

4.  Depth of human review follows risk: low-risk changes get light checks, high-risk ones get a full read.

5.  Humans spot-check the AI reviewer, and track what it misses.

6.  Trust is earned per area, from track record, and withdrawn after escapes.

##### What the owner signs

- What was checked, and by whom or what

- What was not checked, and why

- The residual risk they accept

##### What is not accepted

- *"The AI said it was fine."* An unowned merge.

- Confidence without evidence, or a risk score nobody can explain.

##### What major vendors recommend

- Route human attention by risk; keep reviews fast and low-noise.

- Review with full repo context, and verify findings before posting.

- Measure outcomes (reverts, incidents), not review activity.

##### Directions you may take

Options, not requirements – every option keeps a named human accountable for the outcome.

- **Generalist reviewer:** one reviewer that covers frontend, backend, security and performance. How to train or prompt for that breadth is part of the work.

- **Classifier:** flag code that genuinely needs human review, and separate it from code that meets the standard.

##### Questions judges will ask

- What would make you not trust your own output?

- Who owns the decision?

- How would this scale?

#### Resources

#### What we'll bring

- **Background on what good code means at Tieto:** standards, security and quality
- **A requirements set:** intent, functional and non-functional
- **Sample agent-written changes**, each with its requirement ID

#### Model access

You have access to models from other Junction partners through **partner credits on the Junction Platform**. Connect any of these models to your concept.

Company Info

#### Tieto

Website: <a href="https://www.tieto.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.tieto.com/</a>

#### Judging Criteria

- Clarity(30%)

  A clear recommendation with stated principles, explicit trade-offs and limits.

- Practicality(25%)

  The concept could work in a real pull-request flow and scale, with a named human owning each decision.

- Measurement(25%)

  Shows how trust is measured: reverts and incidents don't rise as review time falls, AI findings are real and accepted, time to merge, share routed to humans.

- Evidence(20%)

  Evidence traceable to a requirement lets a named human accept a change without a full read, incl. what the AI found, what it refused to decide, and why.

#### Prizes

- 1st Place

  €2,000 cash prize for the winning team.

- 2nd Place

  €1,000 cash prize for the runner-up team.

- 3rd Place

  €500 cash prize for the third-place team.

---

### Make Unicorns Real

[Original challenge page](https://hackjunction.app/participate/45/challenges/350)

by Cala

#### The Challenge

Build a product that solves a real need for founders or investors, powered by reliable public data from Cala.

**Introduction:** Founders and investors make some of their most important decisions based on scattered information: dozens of browser tabs, outdated databases and gut feeling. AI agents could change that, but when they go to the web for answers, they find information that is messy, stale and disconnected. Cala gives agents a structured, reliable way to query the world's public information, from companies and people to funding rounds and investors. Now it's your turn to put it to work for the startup ecosystem, and help make the next unicorns real.

**The challenge:** Build a product on top of Cala's data that solves a real need for founders, investors, or both. It can be a focused tool for a specific user, like a first-time founder raising their very first round or a small fund deciding which industries to bet on next, or a broader tool for the whole ecosystem, like an agent that connects the right founders and investors. Don't try to cover everything: one need solved in an original, well-executed way beats a platform that does ten things halfway. You have a weekend, and Slush, Europe's main meeting point for founders and investors, starts right after: aim for a complete product they could start using the day after the hackathon. Make it rely on what makes Cala different: structured, sourced data on companies, funding rounds and investors, and the connections between them.

**How we judge:** We reward sharp ideas, done well: a fresh angle on a real need scores higher than a generic version of an idea we've seen many times. Focus beats breadth: one need solved brilliantly wins over many solved halfway. **• Real need (25%):** a clear user with a problem worth solving **• Execution (25%):** it works smoothly, end to end **• Originality (25%):** a fresh angle, even on a familiar problem **• Use of Cala (25%):** Cala is core to the product, not an add-on

**Prizes:** Each member of the winning team becomes a Cala Comet, a prize worth around €5,000 for a team of four. For three months, each member will get to attend one hackathon of their choice per month, with travel and accommodation covered by Cala. The winning team also gets €1,000 in Cala credits and Cala merch, and the runner-up team receives €500 in Cala credits and Cala merch.

**About Cala:** The world is increasingly run by agents, but when they need reliable external data, they go to the web and find information that is often hard to trust, out of date and scattered across sources. Cala is the public data layer for AI agents: an agent-first database of the world, built on a knowledge graph where every data point is sourced and connected, and queryable through an API or MCP. Enterprise clients already use Cala in agentic workflows across finance, pharma and legal. We're at Junction to see what builders create when reliable data is no longer the bottleneck.

#### Insight

**Some needs we hear often**, as starting points rather than a menu:

**• Raising money smarter:** helping founders find the investors who actually take the lead in funding companies like theirs, and who are still actively investing today.

**• Reading a market:** seeing who's competing, who just raised money and from whom, and how much funding is flowing into an industry.

**• Investing with confidence:** spotting promising young companies before anyone else does, or getting a quick, well-sourced background check on a company before putting money in.

**• Beyond funding:** finding first customers among companies that just raised, sizing a market with real company data, or mapping who might buy a startup one day.

We'd love to see needs we haven't thought of.

#### Resources

**Mentors:** Issey Masuda, Cala's co-founder and CTO, together with engineers from Cala's team, with expertise in knowledge graphs, data pipelines, LLM agents and MCP, on site throughout the event.

**Main contact:** Elies Delgado (Community Growth), <elies@cala.ai>

**What we'll bring:** Each team gets all the credits it needs to build on Cala, the public data layer for AI agents. Every data point is structured, sourced and connected, and you can query it through the API or MCP. Get started at docs.cala.ai, then redeem your credits with the code MAKEUNICORNSREAL: in console.cala.ai, go to Billing → Extra credits → Add credits → Add promo code (no payment details needed). Mentors from Cala's team will be on site throughout the event to support you.

**Extra details:** Join our workshop "Tips & tricks to Make Unicorns Real" on Saturday at 11:00 for an insider briefing: how to get the most out of Cala's data, how to build things web search can't, and what our judges will be looking for. The Cala team will stay around afterwards to help you shape your idea, and there may be some merch involved.

Real need (25%): a clear user with a problem worth solving • Execution (25%): it works smoothly, end to end • Originality (25%): a fresh angle, even on a familiar problem • Use of Cala (25%): Cala is core to the product, not an add-on

Company Info

#### Cala

Website: <a href="https://www.cala.ai/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.cala.ai/</a>

#### Judging Criteria

- Real need(25%)

  a clear user with a problem worth solving

- Execution(25%)

  it works smoothly, end to end

- Originality(25%)

  a fresh angle, even on a familiar problem

- Use of Cala(25%)

  Cala is core to the product, not an add-on

#### Prizes

- 1st

  5,000€ to attend any hackathon on the planet + 1,000€ in Cala credits + Cala Merch

- Runner Up

  500€ + Cala Merch

---

### Spread

[Original challenge page](https://hackjunction.app/participate/45/challenges/349)

by Bahn Express

#### The Challenge

### Spread: run a car transport company for a week

Bahn moves cars for car dealers, and a freelance driver drives each car on its own wheels. Spread is that work as a simulated world: a whole week in Finland, with its dealers, its cars, its deadlines and its drivers.

Your team builds the system that runs the company for that week. A dealer asks you for a price, and asks a competitor too. Quote too high and you lose the car. Win it, and you post the drive as a gig in our drivers' app and choose the fee. Pay too little and no driver takes it in time, and the car arrives late.

Every team runs the same week, and you all stand on the same leaderboard. You make as much money as you can: your score is your gross margin, what the dealers pay you less what you pay the drivers. At least 90% of your cars must arrive by their deadline. The most money takes you to the top.

#### Start

Create your team at **[spread.bahnexpress.com/join](https://spread.bahnexpress.com/join)** with the event code **spread-kmu9z6**.

Everything is on the site: the handbook, the rules, the API reference, the TypeScript and Python kits, and the leaderboard. Give your agent **[spread.bahnexpress.com/llms.txt](https://spread.bahnexpress.com/llms.txt)**.

#### How you win

Ranking rounds open from Friday 19:30. Every team plays the same secret weeks, so the leaderboard shows you where you stand. Our own best system plays every round. Beat it.

The final is on Sunday at 08:00. Every team plays its own copy of one secret week, which runs by itself for about 34 minutes. Registration closes at 07:30.

The 10 ranked teams with the highest margin present to our jury, in 5 to 10 slides or a short video. The jury judges how elegant, clear, creative and robust your system is. Reaching the top 10 is enough. After that, your margin no longer counts.

Find us at the Bahn booth. Ask us anything about the rules, the world or real dispatch, or ask for a hint.

Company Info

#### Bahn Express

Website: <a href="https://www.bahnexpress.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.bahnexpress.com/</a>

#### Prizes

- 1st Place

  2000€

- 2nd Place

  1000€

- 3rd Place

  500€

---

### Break the Agent

[Original challenge page](https://hackjunction.app/participate/45/challenges/328)

by AfterQuery

#### The Challenge

Build a reinforcement learning environment that challenges today's best AI agents, demonstrate real failure modes, and show that its rewards reflect real progress.

#### Introduction

Today's cutting-edge AI systems can solve Millennium Problems, discover new drugs, and create entire production apps with a few lines of prompting. But they still struggle in a wide variety of novel situations, ranging from everyday use cases to niche, highly technical workflows. We ask: **what should AI agents be able to do that they still struggle with today?**

At AfterQuery, we build environments for training and testing agents. The work starts with choosing a problem worth learning, defining an action and observation space, and defining a reward function that defines what success looks like. Getting those pieces right is a heavy research and engineering problem in itself.

For this challenge, we want to see your take on it. Build a world with something interesting to learn. Find out where strong agents struggle, and whether your reward actually encourages the behavior you intended.

#### The challenge

Choose a setting you find interesting and **build an environment an agent can interact with**. It could be a game, a scientific simulation, a software task, a real-world process, or something we haven't thought of. Explain why you chose it and what an agent could learn there.

Your environment should have **a clear goal, actions the agent can take, and a reward you can check**. Run a frontier agent in it and compare the results with a stronger reference run your team can demonstrate and reproduce. We'll provide the agent harness and model credits.

Show **where the agent falls short and why**. The challenge should come from the decisions it needs to make, with access to the information and tools needed to succeed. We'll also try to find shortcuts that earn a high score without completing the task: **reward hacking**.

The setting and approach are yours to choose. We care about what makes the environment useful for learning and what your experiments reveal.

##### Optional stretch goal

Train a smaller model using experience from your environment and show whether it improves.

##### Prizes

The top three teams receive €3,000, €1,500 and €500 in cash. Members of the winning teams can go straight to the final stage of AfterQuery's interview process: a work trial with our environments team, when they're ready. Finalists also receive AfterQuery gear.

How we judge: We'll look at four things: how much room there is for the agent to improve, whether its mistakes come from meaningful challenges, how well the reward holds up to exploits, and how well the environment is built and the results can be reproduced.

##### Judging rubric

**• The gap (30 p)** – Full points: the frontier agent consistently scores below a stronger reference run your team demonstrates; both results can be reproduced across repeated runs. Zero points: no measurable gap, or the claimed gap cannot be reproduced or checked against a demonstrated reference run. **• Meaningful difficulty (30 p)** – Full points: you can explain the agent's main mistakes and connect them to decisions in the task; the information and tools needed to do better are available to it. Zero points: the gap comes from unfairly withheld information, trick wording, impossible timing, or broken tools. **• Reward integrity (25 p)** – Full points: the reward measures success at the task and holds up when judges try to exploit it; doing nothing or stopping early earns little or no credit; completing the task well remains the best way to score. Zero points: an exploit, scoring loophole, or strategy that avoids the task earns a better score than successful play. **• Craft (15 p)** – Full points: the environment's rules and behavior make sense for the setting; judges can run the evaluation from your README with one command and reproduce your reported results. Zero points: the environment only works in your demo, or judges cannot reproduce the evaluation.

**How judging runs:** Each team gets a 10-minute demo. Judges then rerun the evaluation with the standard harness: your reference run, three agent runs, a do-nothing baseline, and a stop-early baseline. They also spend 15 minutes looking for reward exploits. Scores are based on these runs.

**Tiebreaker:** If point totals are close, we'll favor a team that shows a smaller model improving after training on experience from its environment.

#### Insight

#### Starting points

- Planning several steps ahead

- Exploring an unfamiliar system

- Using tools

- Managing limited resources

- Adapting when new information arrives

These are prompts, not a list of required features.

**A small environment with a well-chosen challenge can be enough.** Think about what better play looks like, how you would measure it, and whether an agent could increase its score without getting better at the task.

#### How judging runs

Each team gets a **10-minute demo**. Judges then rerun the evaluation with the standard harness: your reference run, three agent runs, a do-nothing baseline, and a stop-early baseline. They also spend **15 minutes looking for reward exploits**. Scores are based on these runs.

**Tiebreaker:** if point totals are close, we'll favor a team that shows a smaller model improving after training on experience from its environment.

#### Resources

#### What we'll bring

An open-source agent harness – **Harbor running the OpenCode agent** – that connects to your environment over **MCP**, a scoring skeleton, and frontier model API credits for each team to benchmark throughout the 48 hours.

- **Open-source agent harness:** Harbor + OpenCode
- **Scoring skeleton**
- **Frontier model API credits** per team
- **On-site mentors** for environment design reviews and reward testing
- **Starter kit:** harness documentation and the judging rubric

#### Mentors

**Daksh Raghuwanshi** and **Ved Vedere** from AfterQuery's environments team, on site all weekend. They build RL environments and agent evaluations for frontier AI labs.

Company Info

#### AfterQuery

Website: <a href="https://www.afterquery.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.afterquery.com/</a>

#### Judging Criteria

- The gap(30%)

  Full points: the frontier agent consistently scores below a stronger reference run your team demonstrates; both results can be reproduced across repeated runs. Zero points: no measurable gap, or the c

- Meaningful difficulty(30%)

  Full points: you can explain the agent's main mistakes and connect them to decisions in the task; the information and tools needed to do better are available to it. Zero points: the gap comes from unf

- Reward Integrity(25%)

  Full points: the reward measures success at the task and holds up when judges try to exploit it; doing nothing or stopping early earns little or no credit; completing the task well remains the best wa

- Craft(15%)

  Full points: the environment's rules and behavior make sense for the setting; judges can run the evaluation from your README with one command and reproduce your reported results. Zero points: the envi

#### Prizes

- 1st Place

  3,000€ + A work trial at AfterQuery + Merch

- 2nd Place

  1,500€ + Merch

- 3rd Place

  500€

---

### Trusted Trade Agents

[Original challenge page](https://hackjunction.app/participate/45/challenges/327)

by Valio Aimo

#### The Challenge

How can a food-service wholesaler let autonomous purchasing agents place an order – finding products, comparing offers and getting the right approval in a fraction of the time it takes today – without exposing real systems, confidential data or the marketplace roadmap?

#### Introduction

Valio Aimo® serves 20,000+ professional kitchens and is planning to build a digital B2B marketplace connecting foodservice buyers and suppliers. As ordering shifts from people clicking through a catalog to **AI agents making autonomous purchasing decisions**, the question of how a wholesaler exposes itself to those agents – what they can see, decide and be trusted with – becomes existential for data ownership, trust, and who owns the customer relationship.

The Digital B2B Marketplace is a future step in this direction; for Junction 2026 we are mocking today's webshop and backend systems, not the marketplace itself. We want you to prototype the **interface and operating model** that would let an external purchasing agent interact with Valio Aimo's systems, built on **open, verifiable standards** rather than a single platform's black box.

#### The challenge

B2B ordering in foodservice and wholesale is still largely manual or menu-driven: a buyer logs into today's Valio Aimo webshop and searches a catalog. The step we want to explore is **external purchasing agents** that find, compare, order and handle exceptions on the buyer's behalf, working with Valio Aimo directly – not by building a whole marketplace, but by defining the interface and operating model through which an external agent could interact with Valio Aimo's systems at all.

##### Core – your solution must enable

- **Product, price & availability lookup:** a structured way for an external agent to search for and retrieve what's available and at what price.
- **Requesting price & availability, then placing an order:** a defined interaction for moving from inquiry to commitment, based on fixed prices rather than a negotiated quote.
- **Permission & human-approval management:** what the agent may decide on its own, and what must go to a human for sign-off.

##### Optional – open directions (not required to win)

- **Delivery time & sustainability comparison:** not just price, but delivery reliability and the certificates/sustainability labels already shown in the webshop. *(Category-level carbon-footprint ranges are a stretch goal.)*
- **Substitution and other exception handling:** what happens when the exact request can't be met. *(Last year's Zero-Fail Logistics challenge covered failed deliveries in depth, so this isn't scored as core.)*
- **Traceability and explainability:** a human-readable record of what the agent did and why.

##### Example request

> *"I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability."*

A hotel chain's agent sends this request. Your solution returns products, prices and availability in structured form; the agent places the order within its authority or sends it to a human for approval.

**Impact:** This is not about replacing today's e-commerce UI with a chatbot. It is about defining how a European food-service wholesaler can be safely and openly readable by autonomous agents – before that interface gets defined by someone else's platform.

### Valio Aimo®

Valio Aimo® was created in 2021 as a bold leap forward by Valio, transforming traditional wholesale into a next-generation foodservice powerhouse.

We are more than a distributor: Aimo is where the breadth and agility of wholesale meet the deep product expertise, R&D capability, and brand-building strength of a global food innovator.

- **20,000 professional customers** across restaurants, foodservice operators, and industrial customers rely on us to keep their business running every single day.
- **25,000 product names** sourced from **700 trusted suppliers**, forming one of the most comprehensive foodservice assortments in Finland.
- **350 specialists** are committed to delivering excellence in logistics, service, and digital transformation.
- **Part of Valio**, Finland's leading dairy and food company, with:   - **€2.4B in revenue**   - Operations in **60 export markets**   - A pioneering sustainability mission: **carbon-neutral milk by 2035**

As part of Valio, Aimo represents the cutting edge of how foodservice can be reinvented for the AI-driven age.

**Valio Aimo® is not just serving today's kitchens; we are shaping the future of foodservice.**

#### Insight

#### Problems we'd love to see tackled

- **Trust protocol:** the minimum data/verification standard for an external agent to trust Valio Aimo's claims on stock, price and origin without a manual check.

- **Guardrails model:** which decisions require human sign-off (spend threshold, substitutions outside stated preferences) vs. fully autonomous.

- **Response logic:** how an agent handles partial availability and substitution ranking ("good-better-best") within Valio Aimo's own assortment.

- **Audit trail:** a usable, human-readable log of an agent's purchasing decisions, for both buyer and Valio Aimo.

#### Example scenarios to spark ideas

- **Need → recipe → order:** a chef plans next week's menu around a seasonal ingredient. The agent suggests recipes, works out what's missing from stock, and places the order.

- **Last-minute event:** an unexpected booking for tomorrow. The agent identifies what the recipes require, flags what can't be sourced in time, and proposes substitutions through recipe logic rather than a simple SKU swap.

- **Supplier stock-out:** a key product runs out mid-week. The agent proposes a recipe-compatible substitute before the kitchen notices the gap, and explains the trade-off.

- **Proactive selling agent:** Valio Aimo's own agent spots a new or seasonal product and proactively suggests it to the buyer's agent.

- **Allergen-safe substitution under pressure:** in a school or hospital kitchen, a substitution must still satisfy strict allergen and nutrition rules.

- **Standing order drift detection:** the agent learns a kitchen's recurring weekly order and flags anomalies (portion counts creeping up, cost drifting) before auto-renewing it.

**Scope note:** we are mocking a structured data/API interface. Whether Valio Aimo's production interface eventually becomes a traditional API, an MCP-style agentic interface or a full service agent of its own is outside the scope of this challenge.

#### Resources

#### What we'll bring

- **Synthetic product catalog, simulated suppliers and mock APIs** mimicking Valio Aimo's webshop/backend systems, built on realistic data: prices, availability behaviour, delivery lead times, and sustainability certificates/labels (category-level carbon-footprint ranges as a stretch goal).
- **No real-time, live or confidential data or systems** – everything you build against is synthetic.
- **Mentoring** on AI agents, wholesale trading rules, exception handling and data governance, plus coaching on which background data and rules are essential.

**Preferred tech:** AI agents (agentic/tool-use frameworks), open data/interop standards, recommendation logic, optional verifiable-credential or trust-layer approaches. Agentic payment standards (e.g. x402, Nevermined) are relevant context but not required.

#### Mentors

- **Marketplace/Commercial:** Hanna Forsström, Pirjo Kaartinen
- **Online Sales:** Minni Ruhtinas
- **IT/Tech integrations & Data governance:** Tommi Nurmi-Aro, Ville Takanen, Riku Tapper

**Access the challenge resources here:**  
<https://junction26.valioaimo.fi/>

**Resource portal password:** `aimo_ai_challenge`

The resource portal contains downloadable datasets, API documentation and instructions for accessing the mock backend systems.

**API authentication:**

API key: `junct_tDnQn4VI_nfhELGCOEkY4vbuxm324MmYmILuokYG03Y`

Use this API key to authenticate requests to Valio Aimo's mock APIs. Refer to the documentation in the resource portal for integration instructions.

**Webshop test accounts:** Test credentials and access instructions will be shared separately once available.

All provided data is synthetic. No production systems or confidential business data are involved.

Company Info

#### Valio Aimo

Valio Aimo® was created in 2021 as a bold leap forward by Valio—transforming traditional wholesale into a next-generation foodservice powerhouse. We are more than a distributor: Aimo is where the breadth and agility of wholesale meet the deep product expertise, R&D capability, and brand-building strength of a global food innovator. 20,000 professional customers across restaurants, foodservice operators, and industrial customers rely on us to keep their business running every single day. 25,000 product names sourced from 700 trusted suppliers, forming one of the most comprehensive foodservice assortments in Finland 350 specialists are committed to delivering excellence in logistics, service, and digital transformation. As part of Valio—Finland’s leading dairy and food company with €2.3B in revenue, operations in 50 export markets, and a pioneering sustainability mission (carbon-neutral milk by 2035)—Aimo represents the cutting edge of how foodservice can be reinvented for the AI-driven age. Valio Aimo® is not just serving today’s kitchens; we are shaping the future of foodservice.

Website: <a href="https://www.valioaimo.fi/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.valioaimo.fi/</a>

#### Judging Criteria

- Working end-to-end demo(30%)

  The solution runs through a full request → lookup → order/approval flow in the mocked environment, not just isolated pieces.

- Solving the problem and user need(20%)

  how Precisely the agent matches what the buyer actually asked for, with the least manual correction needed.

- Autonomy and controls(20%)

  Quality of the guardrails design. What the agent can decide alone, what needs human sign-off, and how decisions are logged and auditable.

- Robustness to exception situations(15%)

  Handling of partial availability, substitutions and delivery constraints beyond the happy path.

- Openness and credible path toward production(15%)

  Open, documented standards rather than a proprietary format, clear visibility of assumptions, well-justified technical choices, and a credible view of next development steps

#### Prizes

- 1st place

  4 000€

- 2nd place

  2 000€

- 3rd place

  1 000€

---

### The Internet Butler / Your Personal Assistant

[Original challenge page](https://hackjunction.app/participate/45/challenges/298)

by Exa

#### The Challenge

Build an agent that takes tedious tasks in people’s lives off their hands.

**Introduction:** Everyone has pain points in their day to day which require hours of digging and research like checking whether a rent increase is legal, or finding out which benefits a family qualifies for, which vegan restaurant to pick for an anniversary date, and more. The answers exist, but they are buried across the web. Exa is the search engine built for AI. It can find, read and compare information from across the web and pull it back as structured data, so your agent can do the digging and the task can be handed off completely.

**The challenge:** Develop a personal agent that helps people get stuff done. Your agent should find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case.

**Areas of interest:** General tasks. Examples: planning special occasions, handling daily living errands, rent, missed benefits, business information, travel disruption, etc.

**How we judge:** We will judge projects on how well they use Exa to get information that could not have come from a model's training data alone, how useful they are to a specific group of real people, and how clearly they show their sources. We will also look at originality and at whether the demo works on live queries, including ones the judges try themselves.

The winning team will receive \[cash amount\] and \[Exa API credits per member\], and the two runner-up teams will receive \[amounts\]. Every team that submits a working project built on Exa will receive \[API credits\] to keep building after the event. \[Consider a mentoring session or visibility on Exa's channels for the winners.\]

**About Exa:** Exa is a search engine built for AI. We index the web by meaning, so AI applications can find information by describing what they need, and we return clean, structured content that models can use directly. Companies such as Cursor, Cognition, HubSpot and AWS use Exa to connect their products to the web. We are joining Junction to meet builders, see new ideas for what AI can do with access to the whole web, and keep supporting promising teams after the event.

#### Resources

**What we'll bring:** Every participant will get \$50 in Exa Credits and access to our full API for the event. This includes the Search API with fast, balanced and deep research modes, and the Contents API for full page text, highlights, summaries and crawling a site's subpages.

Teams can filter results by date, domain and category (such as news, research papers, companies, people and personal websites), request results as structured JSON, and retrieve past versions of web pages.

We will also provide Websets for building verified lists of people, companies and opportunities, Monitors for recurring searches, our hosted MCP server, and Python and JavaScript SDKs. Our demo gallery at [demos.exa.ai](https://demos.exa.ai) has working examples teams can build from.

Exa engineers will be on site throughout the event to help with technical questions and project ideas, and there will also be a Discord channel to receive asynchronous advice.

Free \$50 Exa Credits: EXA50JUNCTION (Redeem it at [dashboard.exa.ai/billing](https://dashboard.exa.ai/billing))

Company Info

#### Exa

Website: <a href="https://exa.ai/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://exa.ai/</a>

#### Judging Criteria

- Use of Exa(20%)

  Use of Exa to retrieve information that could not have come from a model’s training data alone

- Usefulness(20%)

  Usefulness to a specific group of real people

- Clarity(20%)

  Clarity in showing sources

- Originality(20%)

  How original the idea is?

- Working Implementation(20%)

  Whether the demo works on live queries, including ones the judges try themselves

#### Prizes

- 1st Place

  \$2,500 Cash, \$5,000 in Exa credits, Exa hoodie per person & Exa branded TRMNL dashboard

- 2nd Place

  \$1500 cash, \$3,000 in Exa credits, Exa hoodie per person & Exa branded macropad

- 3rd Place

  \$500 Cash, \$1k Exa credits & Exa hoodie per person

- Participation Trophy

  Every Junction participant get free \$50 Exa Credits

---


## Hardware Track by Arduino

### The Green European Renaissance

[Original challenge page](https://hackjunction.app/participate/45/challenges/356)

by Arduino

#### The Challenge

#### Make Europe Green through Edge AI using Arduino

##### Introduction

Do you feel the world is moving to a Cyberpunk dystopian future where Europe is just the place where rich people drink Spritz? Let’s change that! If you like LEDs but not megacorp tech corporations, I have a challenge for you! Let’s use Edge AI and Arduino UNO Q to do the Green Renaissance of Europe!

##### The Challenge

The world is facing a new technological revolution around the new AI tools, where LLM and other AI technologies are rapidly changing the way we work, we communicate, we create and we solve problems.

Soon the Robots will be smarter than ever and Physical AI will be running in every small appliance and device.

It looks like America and Asia are taking the lead on this revolution and big companies from both continents will control, for good and for bad, these AI tools.

They tell you that the future is inevitable, but it is not true. Europe can change that!

Using Edge AI devices like the Arduino UNO Q we can create local solutions to local problems that are not dependant on governments or private companies. Most of these problems will have a huge impact in the environment having the opportunity to create step by step a Greener, high-technological and human Europe: The Green European Renaissance.

#### Insight

##### What we're looking for

We're looking for solutions that use Edge AI and the Arduino UNO Q to build Physical AI for local problems: solutions that improve people's lives while creating a greener, better environment to live and work in.

##### Example directions

Ideas can range from boosting local flora and fauna to saving energy, supporting elderly people's independence, reducing industrial impact, tackling climate change, improving energy efficiency, cutting pollution, or making cities more livable and human: using technology for good.

##### Submission: on Junction Platform and to Arduino Project Hub

To be eligible for prizes, you must publish your project on the Arduino Project Hub in addition to submitting it on the Junction platform, where peer review and judging take place.

- Log in at <https://projecthub.arduino.cc/>

- Click + NEW PROJECT

- Select the tag Junction Finland 2026

- Fill in the required parts

#### Resources

##### Logistics & Requirements

To help bring your ideas to life, we will provide a complete hardware kit featuring the **Arduino UNO Q** and a variety of **Modulino sensors** for your project. You can access to those from the Arduino Hardware Lab in 5th floor!

Instal Arduino App Lab here: <https://www.arduino.cc/en/software/#app-lab-section>

Company Info

#### Arduino

Website: <a href="https://www.arduino.cc/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.arduino.cc/</a>

#### Judging Criteria

- Technical Implementation & Edge AI (30%)

  How well the UNO Q, sensors and on-device AI are used

- Environmental & Social Impact(30%)

  How much the solution improves the environment and people's lives

- Creativity & Innovation (20%)

  Originality of the idea and approach

- Working Prototype & Demo(20%)

  A functioning physical prototype

#### Prizes

- 1st Team

  Ventuno Q unit per Team member

- 2nd Team

  UNO Q 4G + Plug and Make Kits per Team member

- 3rd Team

  Plug and Make Kit per Team member

---

### AI Glasses for Everyone, Everyday

[Original challenge page](https://hackjunction.app/participate/45/challenges/342)

by Meta

#### The Challenge

Demonstrate how a first-person field of view enables new or better interactions in everyday scenarios.

#### Introduction

AI glasses from Meta offer a first-person view that can make everyday interactions more useful, hands-free, and in the moment. At Junction, we invite you to explore where this perspective creates value beyond simply mirroring a phone screen. Help us turn a clear everyday need into an intuitive, inclusive experience for people with all abilities.

#### The Challenge

Build the best everyday use case using AI glasses from Meta, showing how a first-person field of view enables new or better interactions in everyday scenarios.

Best entries will clearly articulate the problem and intended audience, and deliver a functional prototype and deck to materialize their concepts. Creativity, technical execution, real-world impact, and inclusive interaction design for people with all abilities will be key criteria.

Both display and audio-first experiences will be considered on equal footing, as will web apps and Device Access Toolkit mobile integrations.

Show an original, relevant use case with a clear wearable benefit and a focused, plausible path to adoption or a pilot, backed by a functional prototype that handles permissions, errors, performance trade-offs, connectivity, and device state changes.

Interactions should be intuitive and inclusive for people with all abilities, with appropriate consent and safe data practices within the demo’s scope.

#### Insight

We are interested in focused everyday problems where wearables unlock hands-free, in-the-moment value beyond basic mirroring. Show a plausible path to adoption or a pilot, and make accessibility, appropriate consent, and safe data practices part of the demo.

##### Teams with the best submissions may be invited to join Meta on Wednesday, 18 November 2026, for an AI forum where leading industry professionals from various companies will explore the future of wearable AI.

#### Resources

Meta will provide shared AI glasses and on-site developer support for teams taking part in the challenge.

- 10 x Meta Ray-Ban Display for use during the hackathon
- 10 x RBM Gen 2 for use during the hackathon
- Charging and hygiene materials for the devices
- Developer support at the Meta booth to help teams with technical questions, with Amanda Le as the challenge mentor and point of contact

##### Mentors

- **Ming Lin**, Software Engineer: Web Apps
- **William La**, Software Engineer: Web Apps
- **Amy Lee**, Software Engineer: Web Apps
- **Odil Nikadambaev**, Software Engineer: Web Apps
- **Dennis Punjabi**, Software Engineer: DAT (iOS)
- **Amanda Le**, Product Marketing: DAT (Android)

Company Info

#### Meta

#### Judging Criteria

- Creativity and use case(25%)
- Technical execution(25%)
- Real-world value and feasibility(25%)
- User experience: input, accessibility and trust(25%)

#### Prizes

- Best overall

  Each member of the winning team will receive a pair of Ray-Ban Meta glasses.

---

### Stop Simulating, Start Moving: See It. Detect It. Act on It. The Intel Physical AI Challenge

[Original challenge page](https://hackjunction.app/participate/45/challenges/330)

by Ignite Next x Intel

#### The Challenge

AI is great on screen, but have you ever made it move? Welcome to the Intel Physical AI Challenge at Junction. This weekend, we’re taking your models out of the cloud and giving them hands, eyes, and real-time brains

#### Introduction

In many factories, people still inspect parts by eye and pull out the faulty ones, because programming a robot for the job takes specialist effort. With physical AI, you show a robot a task a few dozen times and it learns a policy it can run on its own. Ignite Next and Intel bring this to Junction, so you can take a real robot arm from first demonstration to an autonomous inspection cell in one weekend. You train your models on cloud GPUs and run them on Intel Core Ultra Series 3 (Panther Lake) laptops with Intel’s open-source robotics stack, which is built to take robot AI from the lab into production.

#### The Challenge

Each team gets its own station with an SO-101 robot arm, a leader arm for teleoperation, a top-view camera, an inspection camera and a box of Duplo bricks, some of which you mark as defective yourself.

Start by teleoperating the arm to record demonstrations, then fine-tune a vision-language-action (VLA) policy in Physical AI Studio on cloud GPUs. In parallel, train an Anomalib model that tells good bricks from defective ones at the inspection point. Then bring both together: the arm picks each brick, shows it to the inspection camera and drops it into the “good” or “defective” bowl, fully autonomously, with your models optimized with OpenVINO and running on the laptop’s CPU, GPU and NPU. Teams that get there early can push further with faster cycles, messier brick piles, new defect types or their own twist on the task.

#### Insight

We want to see how close a small, low-cost setup can get to a reliable inspection cell: how few demonstrations are enough, how well the policy copes with bricks in new positions, and how fast the full loop runs on the laptop’s CPU, GPU and NPU. Ideas we would like to see include using the anomaly score to trigger a re-grasp, sharing cameras between policy and inspection, and quantizing models with OpenVINO.

#### Resources

#### Challenge terms

Please read the [Challenge Terms](https://drive.google.com/file/d/1nKs-e-4FNk-AoMq1fCeRKM_6mpIkArRt/view?usp=sharing) before taking part. **By participating in this challenge, you agree to these terms.**

#### What we'll bring

You build on a complete robotics station in the Junction Hardware Lab and on Intel’s open-source Robotics AI Suite, with Intel engineers on site every day of the event.

- 25 stations, one per team, each with an Intel Core Ultra Series 3 (Panther Lake) laptop with 64 GB RAM
- An SO-101 follower arm with wrist camera and a matching leader arm for teleoperation
- Two external cameras for top view and inspection, at least one of them a RealSense D415 depth camera
- Duplo bricks, sorting bowls and markers to create your own defects
- Cloud GPU instances for policy training
- Physical AI Studio to record demonstrations and fine-tune VLA policies
- Anomalib for anomaly detection, plus OpenVINO and OpenVINO Physical AI for on-device inference
- A hands-on technical session on Saturday at 12:00

#### Mentors

Three to five Intel robotics and edge AI engineers with expertise in Physical AI Studio, OpenVINO and Anomalib, on site every day of the event and supported by the Ignite Next team.

##### Main contact person

Marvin Müller, Strategic Partnerships & Value Creation Lead, Ignite Next (<marvin.mueller@ignitenext.com>, +49 160 1684739)

Company Info

#### Ignite Next x Intel

Ignite Next is a deep tech scale-up program based in Dresden, in Silicon Saxony, that helps founders build semiconductor and physical AI companies together with industrial partners. Through our collaboration with Intel, we connect developers and startups with the hardware, software and experts they need to build real robots. Intel contributes its Core Ultra Series 3 processors and its open-source Robotics AI Suite, which is designed to take robot AI from first experiments to deployed systems. We are at Junction to meet the builders behind Europe’s next robotics companies.

#### Judging Criteria

- Task success(30%)

  Covers accuracy, cycle time and robustness to shifted or cluttered bricks

- Intel technology integration(30%)

  Covers deployment with OpenVINO Physical AI and the Robotics AI Suite and offloading to NPU and integrated GPU

- Dataset and pipeline quality(20%)

  Covers clean teleoperation data and fine-tuning in Physical AI Studio

- System efficiency(20%)

  Covers inference latency, thermal headroom and power consumption on Core Ultra

#### Prizes

- 1st Place

  €5,000

- 2nd Place

  €3,000

- 3rd Place

  €2,000

---

### The Robot Teleoperation Challenge

[Original challenge page](https://hackjunction.app/participate/45/challenges/326)

by Rokoko

#### The Challenge

Use professional motion capture suits and gloves to control robotic hands, arms and humanoid robots. Build something useful, unexpected, or downright unbelievable.

#### Introduction

Robots are getting smarter, but teaching them to interact with the physical world remains one of the biggest challenges in robotics. **Human teleoperation** is emerging as a powerful way to control robots, collect training data, and accelerate the development of intelligent machines. At Rokoko, we're building the motion capture technology that connects human movement with robotic action. Now we're putting that technology in your hands to see how far you can push it.

#### The challenge

Build an impressive application of **robotic teleoperation** using Rokoko's motion capture technology to control robotic hands, arms, or entire humanoid robots – **either physically or in simulation**.

What you build is entirely up to you. It could solve a real-world problem, demonstrate a new capability, or simply do something nobody has seen a robot do before.

You can work with the robotic hardware available at Junction, build your own simulated environment, or combine Rokoko's technology with other hardware and challenges at the event.

We're looking for projects that push the boundaries of what's possible when human movement meets robotics. **Surprise us.**

#### Insight

##### What interests us

- **Precise manipulation** – fragile objects, tools, liquids.

- **Collecting human demonstrations** through teleoperation to train autonomous robot policies.

- **Creative or entertainment applications** that explore unexpected uses of robotic technology.

These are just starting points. Whether your project prioritizes precision, usefulness, technical innovation, or sheer entertainment value, we want to see what you can achieve.

#### Why it matters

Robotic teleoperation is rapidly becoming one of the most important technologies in humanoid robotics. By capturing human movements and translating them into robotic actions, we can both control robots directly and generate the training data needed for increasingly autonomous systems. This challenge lets you experiment with the same technologies being developed for the next generation of intelligent robots.

#### Resources

#### What we'll bring

- **Rokoko Smartgloves II** for real-time finger tracking
- **Rokoko Smartsuit Pro II** for full-body motion capture
- **Rokoko Coil Pro** for precise hand positioning
- **Rokoko Device SDK** for accessing real-time motion capture data
- **Access to a Unitree G1 humanoid robot** with dexterous hands, in coordination with the team running the separate humanoid robotics challenge
- **Potential access to additional robotic hardware**, including a Booster T1, depending on availability
- **Technical support** from Rokoko and Aalto Robotics Club mentors

You can also develop teleoperation applications **in simulation**, using Rokoko's physical motion capture equipment to control virtual robots. Existing integrations and example implementations may be available to help you get started, including an **Inspire robotic hand integration** developed by Aalto Robotics Club.

How to access Rokoko platform:

1.  Create a Rokoko ID
2.  Provide email and ID to Rokoko representatives via this [form](https://docs.google.com/forms/d/e/1FAIpQLSdCZTfoFzWbZS8fuvpKjhhP8xvOAX_vhJhTKYMpuRB8JMIHIQ/viewform)
3.  Get accepted by Rokoko reps
4.  Get access to SDK License and activate via instructions on the SDK page.

#### Mentors

**Victoria Stein** will be on site representing Rokoko. Technical support comes from mentors of the **Aalto Robotics Club**, trained on Rokoko's technology ahead of the event.

Company Info

#### Rokoko

Website: <a href="https://www.rokoko.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.rokoko.com/</a>

#### Judging Criteria

- Technical execution(35%)

  Quality of the implementation – physical or simulated.

- Originality & creativity(25%)

  How fresh and surprising the idea and approach are.

- Usefulness & potential impact(25%)

  The real-world value or potential impact of the application.

- Demonstration of human-controlled robotics(15%)

  How effectively the project shows the potential of robotic teleoperation.

#### Prizes

- 1st place

  1x pair of Smartgloves II + 1x SDK license + featured post on Rokoko’s blog and extended support from Rokoko team (valued at €4,990)

- 2nd Place

  1x Smartsuit Pro II (valued at €2,295)

- 3rd place

  1x pair of Smartgloves I (1st gen gloves) + Rokoko merch (valued at €1,095)

---

### Aaltonomous Humanoid

[Original challenge page](https://hackjunction.app/participate/45/challenges/320)

by Aalto University

#### The Challenge

Our humanoid robot can do backflips but can't sort a few blocks into boxes. Give it a brain.

##### Introduction

Humanoid robot hardware has improved enormously in recent years. Robots can now do impressive things like backflips, dancing and kung fu. They are also becoming surprisingly affordable: the Unitree G1 costs around €50,000, and it won't be long before humanoids are within reach of ordinary people.

But there's a catch, known in robotics as Moravec's paradox. Hard-coded backflips are relatively easy for a robot, while something as simple as picking up a small block and putting it in the right box is much harder, even though a small child can do it without thinking. Our G1, Väiski, is physically very capable, but it's still pretty dumb: it has very little autonomy or onboard intelligence.

During this hackathon, your job is to give it a brain.

##### The task

Make the G1 sort objects into boxes on its own, without a human controlling it.

Väiski stands behind a counter with its legs and waist held stiff, working with two 7-DoF arms and two Dex3 three-fingered hands. In front of it, 3 to 5 printed objects lie at random positions and angles: cubes, cylinders and triangular prisms, about 4.5 cm in size, in red, yellow and blue.

Behind the objects are three identical orange boxes (21 cm wide) at fixed positions: **left, centre and right**, in a row, **5 cm apart** from each other and **40 cm from the robot's torso**. The boxes have no markings; they are told apart only by their position. The robot has to put every object into the right box within **2 minutes**.

1.  **Fixed sorting:** red objects go into the left box, yellow into the centre box, blue into the right box.
2.  **Sort by instruction:** a text instruction defines which box each object goes into, e.g. *"Sort the objects: red into right, blue into left, yellow into center."* Expect phrasings you haven't seen before.
3.  **Stretch goal:** put each object through the matching hole in a lid on one box.

Your policy sees the head camera (colour + depth), both wrist cameras, the joint states and the instruction, and sends back target positions for all arm and finger joints, 30 times a second.

##### How it works

- **Simulation first:** build and test your solution in a ready-made Isaac Sim simulation of the robot and our exact scene, with plenty of GPU power from Verda.
- **Real-world data during the event:** you don't need any data to get started. During the hackathon, the Aalto University team will publish datasets recorded with the real robot at the venue on Hugging Face, with links shared in the Junction Discord. You can use them for training and for tuning your solution to the real cameras and conditions.
- **Submit a Docker image:** your solution runs as a small policy server in a container. Our runner sends its commands to the simulator or the robot through our safety filter.
- **Finals:** we evaluate submissions in simulation, on a version of the scene you can't train on, and pick the finalists. They run on the real robot on Sunday. The best real-robot score wins.

#### Insight

##### Possible directions

Any approach is welcome: computer vision and classic programming, a VLM/LLM planner calling your own skills, imitation learning or VLA fine-tuning (LeRobot, π0, GR00T), reinforcement learning in Isaac Lab, making the simulation match reality, or something no one has tried yet. Combinations will probably work best.

##### What we'd love to see

- Solutions that still work when the real world doesn't match the simulation exactly.

- General ideas that could work beyond a single task, rather than ones tuned to one exact setup.

- Clever ways to do a lot with very little real-world data.

#### Resources

##### What we'll bring

- **A real humanoid robot:** the Unitree G1 with Dex3 three-fingered hands, live at the venue.
- **A simulator:** a ready-to-use Docker image with Isaac Sim, Isaac Lab and our challenge scene.
- **GPU power:** compute from Verda.
- **Real robot data:** datasets recorded with the real robot, published on Hugging Face during the hackathon (links in the Junction Discord).
- **Starter code:** the robot interface, the safety filter, a classical baseline, policy-server and Dockerfile templates, and an evaluator that scores your solution in simulation.
- **Expert mentors:** researchers who work with the robot every day, plus around 30 Aalto Robotics Club volunteers.

##### Starter repository

**<https://github.com/zupermiez/aaltonomous-humanoid>**

The step-by-step guide is in `aaltonomous/cloud/QUICKSTART.md`; rules, interface and submission details are in `aaltonomous/docs/participants/`.

##### Getting started in simulation

**GPU:** use an **RTX-class GPU** (RTX Pro 6000, L40S, A6000, RTX 4090/5090, ≥ 24 GB). The simulator renders the cameras with ray tracing, so **it will not render on A100 or H100** (they are fine for training). Use on-demand instances, not spot, and keep your work on a persistent volume.

**Start the simulator:**

``` bash
docker load -i aalto-sim-v1.tar.zst      # download location shared at kickoff
docker run -d --name aalto --gpus all --network host --ipc host \
    -v aalto-kitcache:/root/miniforge3/envs/isaac/lib/python3.12/site-packages/isaacsim/kit/cache \
    -v /data:/data aalto-sim:v1 sleep infinity
docker exec -it aalto bash

aalto sim        # start the simulator (first start ~5-10 min while shaders compile)
aalto check      # scene checks: 8 PASS / 0 FAIL
aalto baseline   # run a reference policy and print a score table
```

No Docker? Clone the repo and run `bash aaltonomous/cloud/setup_instance.sh` (about 30–40 minutes, no sudo needed).

**Then:** write your policy as a server from the template in `aaltonomous/deploy/`, score it in the simulator with `aalto eval --policy ws://localhost:8000`, and package it with `aaltonomous/docker/submission.Dockerfile`. To run on the real robot, a solution must pass our safety check in simulation: no crashes or safety stops, no commands over the joint and speed limits, and at least 27 commands per second.

##### Mentors

Erkka Lehtonen and Viktor Solianoi, on site throughout the event. Questions and announcements: the Junction Discord.

##### Safety

Teams never control the robot directly. Our runner executes your Docker image through our safety filter (joint and speed limits, workspace limits, a watchdog) while our team stands at the emergency stop. Code has to pass the safety checks in simulation before it runs on the real robot.

Company Info

#### Aalto University

Aalto University is where people who think differently bring out the best in each other — where imagination meets reality and challenges once thought impossible are solved. Born to unite science, arts, technology, and business, Aalto exists to create a better world by bringing diverse minds together — from quantum engineers to fashion designers. We accelerate curiosity and responsibility, reimagining how a university can operate. Driven by radical creativity and an entrepreneurial mindset, we turn theories into solutions and prototypes into breakthroughs. Our differences spark action and collaboration. Together, we build beyond the status quo and always find a way forward. The AR4U project at Aalto University explores how voice-based artificial intelligence can help older adults stay active, connected, and independent at home. The project develops and tests an AI companion and calling service that provides daily support, conversation, and well-being check-ins—making technology more personal, accessible, and engaging for everyone. AR4U is an Research-to-Business (R2B) project at Aalto University, funded by Business Finland, aiming to transform academic research into commercial solutions.

Website: <a href="https://aalto.fi/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://aalto.fi/</a>

#### Judging Criteria

- Real-world result(40%)

  How well it works on the real robot

- Generality(25%)

  Holds up when things change

- Originality(20%)

  Freshness of idea and approach

- Presentation(15%)

  Clarity of what you built and why it matters

#### Prizes

- Winning Team

  2,000€ + a visit to the Aalto robotics lab

- Top 5

  🤖 \*\*Top ~5 teams\*\* (chosen by performance in simulation) get to run their solution \*\*live on the real Unitree G1\*\*.

---


## Healthcare track

### Equal Care Across Finland

[Original challenge page](https://hackjunction.app/participate/45/challenges/344)

by AstraZeneca

#### The Challenge

### At AstraZeneca stand we will provide key insights to the challenge on Friday at 20:00

#### Help ensure equitable and effective cancer care for everyone in Finland.

Identify where the cancer care pathway can be strengthened – is it through earlier detection, smoother referrals between health centers and hospitals, or faster treatment initiation?

Develop a nationwide, AI-powered solution to support equal and effective cancer care across Finland.

#### Introduction

AstraZeneca is inviting you to explore where cancer care pathways can be strengthened and identify a solution that could improve equal cancer care across Finland.

#### The Challenge

The challenge is ensuring equal and effective cancer care in a rapidly changing environment. Ensure that time to diagnosis is optimal and patients start treatment within target timeframes, wherever they live in Finland.

**Build an AI-powered system that supports equal and effective cancer care across Finland.**

Your solution should:

1.  **Identify the gap.** Detect differences in access to cancer care or treatment outcomes.
2.  **Locate the gap in the care pathway.** Show where the difference emerges: detection, referral from primary to specialist care, diagnosis, or treatment initiation.
3.  **Recommend what to do.** This is the most important part. Provide concrete, evidence-based improvement proposals that could be implemented at national or account level across Finland. Diagnosing the problem is not enough. Show how it could be addressed.

##### Possible Solutions

The format is open. Possible solutions include:

- An AI analyst that explains indicator trends and proposes actions.
- A monitoring dashboard with recommendations.
- An early-warning system for emerging delays.
- A simulation showing the potential impact of an intervention.

##### Minimum Requirements

- **Use reliable evidence.** Base your findings on public data and/or insights gathered from AstraZeneca mentors. Clearly show the sources supporting every claim.
- **Address Goal 3.** Cover at least one indicator connected to Goal 3 of the national cancer strategy.
- **Provide actionable recommendations.** Deliver concrete improvement proposals, not just an analysis.
- **Demonstrate a working solution.** Submit a working demo. Slides alone are not sufficient.

#### Insight

#### Insights and Areas of Interest

Three known bottlenecks provide a useful starting point:

- **Late detection:** Cancer may not be identified early enough.

- **The transition from primary to specialist care:** Referrals may be delayed or not progress smoothly.

- **The time from diagnosis to treatment:** Patients may not start treatment within the recommended target timeframes.

##### A Note on Data

Data on cancer care in Finland is limited, and addressing this data gap is part of the challenge. Expect to combine publicly available sources with insights gathered through conversations with our experts.

**A strong solution should make a complex situation clear and actionable for a non-technical decision-maker in less than two minutes.**

##### Beyond Junction

AstraZeneca would like to explore promising solutions beyond Junction, ideally through a follow-up project in collaboration with a Finnish wellbeing services county.

#### Resources

#### Mentors and Contact Persons

AstraZeneca experts from oncology, medical affairs and diagnostics will be available to support participants.

##### Mentor Availability

**Friday, November 13 – from 18:00 onwards**

- Hanna Rusila – Marketing
- Hanna Toivola – Diagnostics
- Kaisa Kaitila – Medical Affairs
- Laura Aaltonen – Marketing
- Joanna Tuormaa – Business Excellence

**Saturday, November 14 – during the day**

- Kaisa Kaitila – Medical Affairs

**Sunday, November 15 – 14:00, judging**

- Hanna Rusila – Marketing
- Laura Aaltonen – Marketing
- Joanna Tuormaa – Business Excellence

##### Contacts

**Main contact:** Joanna Tuormaa, Innovation and Business Excellence Director, Nordics, AstraZeneca

**For questions:** Laura Aaltonen, +358 40 535 8447

#### Resources Provided

| Resource                                                                                                                           | Details                                                                                                  |
|------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| [Background pack](https://files.hackjunction.app/resources/Kansallinen_syopastrategia_2026_2035_FINAL.pdf)                         | An overview of how cancer care currently works in Finland. (In Finnish)                                  |
| [Source list](https://files.hackjunction.app/resources/Sy%C3%B6p%C3%A4strategiat%20ja%20sy%C3%B6p%C3%A4data_linkkikokoelma.pdf)    | A curated selection of reports, statistics, and articles on cancer care in Finland.                      |
| [Implementation roadmap](https://files.hackjunction.app/resources/Kansallinen_syopastrategia_toimeenpanon_tiekartta_2026_2031.pdf) | An indepth implementation roadmap for cancer care for 2026 -- 2031. (In Finnish)                         |
| Public data sources                                                                                                                | Publicly available data from the Finnish Cancer Registry and THL regional health indicators.             |
| Mentoring                                                                                                                          | AstraZeneca experts will be available on-site to answer questions and participate as interview partners. |

**Data note:** This challenge uses public, aggregate data only. No patient-level or personal data will be provided or required. <https://files.hackjunction.app/resources/Kansallinen_syopastrategia_2026_2035_FINAL.pdf> <https://files.hackjunction.app/resources/Kansallinen_syopastrategia_toimeenpanon_tiekartta_2026_2031.pdf> <https://files.hackjunction.app/resources/Sy%C3%B6p%C3%A4strategiat%20ja%20sy%C3%B6p%C3%A4data_linkkikokoelma.pdf>

Company Info

#### AstraZeneca

#### Judging Criteria

- Actionability(30%)

  Are the improvement proposals concrete enough for a health center or wellbeing services county to implement?

- Insight(25%)

  Does the solution reveal a real and meaningful gap, and show where it emerges in the care pathway?

- Data quality & transparency(20%)

  Are the sources clear, limitations acknowledged, and findings free from unsupported assumptions?

- Clarity(10%)

  Can a decision-maker understand the key message and proposed action within two minutes?

- Execution(15%)

  Does the solution work in a live demonstration in front of the judges?

#### Prizes

- Best Overall

  1000€

- 2nd Overall

  750€

- 3rd Overall

  250€

---

### Beyond the Clinic

[Original challenge page](https://hackjunction.app/participate/45/challenges/343)

by Aalto University

#### The Challenge

Build the product that helps people stay well at home after depression treatment, using anything from natural stimuli to a phone, music, games, light or AI.

#### Introduction

Transcranial magnetic stimulation (TMS) is used in hospitals and clinics to treat people with severe depression. The treatment usually requires multiple brief daily visits for brain stimulation. Even if the treatment is successful, there is a risk that depression returns. Therefore, we would like to have “maintenance” treatment at home.

#### The Challenge

In the hospital, you can obtain blood samples, get brain scans with fMRI, MEG or EEG, and be consulted by a psychiatrist. At home you don’t have these, except for an occasional remote psychotherapy meeting, and that is also difficult or expensive. But brain activity and mental condition at home can be measured in several ways. No good solution has yet been developed for maintenance treatment at home, and that is the challenge.

Home-based maintenance treatment could also be “closed-loop”, meaning that it is individualised based on how the brain of the patient reacts to the interventions. In other words, your product can work as a loop: sense how someone is doing, respond with something that helps, and learn what works best for that person.

#### Insight

##### Who You Can Design For

- **People after TMS treatment**, who want to keep feeling well once the daily hospital visits end.

- **Anyone at risk of depression**, who could benefit from early, everyday support.

- **Clinicians**, who want to follow how their patients are doing between visits without adding to their workload.

#### Ideas to Get You Started

You don’t need special hardware. A laptop and a phone are enough to build something great.

##### What Could Help People Stay Well

- Cleverly designed sensory stimulation (auditory, visual, touch, smell, taste), for example music or rhythmic lights or colours.

- Social interaction, meditation, yoga and physical exercise.

- Regular visits to forests or to the sea, or experiencing them in VR when going out is hard.

- Computer games, such as that of [Soihtu](https://soihtudtx.com).

##### How to Sense How Someone Is Doing at Home

- The mobile phone can measure sounds, voice, movement (acceleration), facial expressions, sleep and daily routines.

- Wearables such as smart rings can measure heart signals (HRV), sleep, activity and changes in the autonomic nervous system, a very important indicator of mental state.

- Many other sensors and technologies exist, or can be invented.

##### Product Directions We’d Love to See

- **Everyday companion:** a phone or AI check-in that notices changes over time and suggests the right thing at the right moment.

- **Sensory experience:** music, light or VR that adapts to how the person is doing that day.

- **Game:** something fun to play daily that also supports mood and wellbeing.

- **Smart home:** lights and sound that gently change through the day.

- **Social:** a way for friends or peers to stay close and reach out when it matters.

- **Clinician view:** a simple way for professionals to see who might need a call.

For inspiration, look at [Meru Health](https://meruhealth.com) and other companies developing ways to alleviate depression.

#### Mentors and Contact

Researchers from Prof. Risto Ilmoniemi and Prof. Pantelis Lioumis’ group (Department of Neuroscience and Biomedical Engineering), plus support from Aalto Innovation.

**Main contact:** Myungji (MJ) Suh

#### Resources

#### Resources and Support

- **Published research and open data:** pointers to published studies and openly available datasets you can build on.
- **Expert mentors:** researchers who know brain stimulation, depression treatment and how the brain can be measured.

##### Demos Subject to Confirmation With the Lab

- **A live brain stimulation demo:** see TMS in action and how a magnetic pulse can activate the brain.
- **Brainwaves in real time:** a portable EEG demo at the booth, so you can see what brain activity looks like.

Company Info

#### Aalto University

Aalto University is where people who think differently bring out the best in each other — where imagination meets reality and challenges once thought impossible are solved. Born to unite science, arts, technology, and business, Aalto exists to create a better world by bringing diverse minds together — from quantum engineers to fashion designers. We accelerate curiosity and responsibility, reimagining how a university can operate. Driven by radical creativity and an entrepreneurial mindset, we turn theories into solutions and prototypes into breakthroughs. Our differences spark action and collaboration. Together, we build beyond the status quo and always find a way forward. The AR4U project at Aalto University explores how voice-based artificial intelligence can help older adults stay active, connected, and independent at home. The project develops and tests an AI companion and calling service that provides daily support, conversation, and well-being check-ins—making technology more personal, accessible, and engaging for everyone. AR4U is an Research-to-Business (R2B) project at Aalto University, funded by Business Finland, aiming to transform academic research into commercial solutions.

Website: <a href="https://aalto.fi/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://aalto.fi/</a>

#### Judging Criteria

- Usefulness(25%)

  Could it really help people stay well at home?

- Ease of use(25%)

  Would someone recovering from depression actually use it every day?

- Smart sensing(25%)

  Does it make clever use of what can be measured at home, and learn what works for each person?

- Creativity(25%)

  How original and delightful is the idea?

#### Prizes

- 2000€ for the best team

  A prize for the winning team, a visit to the brain stimulation lab, and for the most promising idea, a change to keep developing it together with the researchers

---


## AI Infrastructure Track By Verda

### Make Blueprints Talk

[Original challenge page](https://hackjunction.app/participate/45/challenges/335)

by Stoa

#### The Challenge

##### Build a program that answers natural language questions about construction drawings and building information models accurately and verifiably.

Construction site engineers spend hours every day looking for information. General-purpose AI models frequently fail when analyzing complex technical drawings. This is one of the hardest unsolved problems in construction tech, and we want to see what a fresh approach can do with real data.

Create a program which answers natural language questions about construction drawings. You will get a dataset of real technical drawings in many formats and languages together with example questions. A great answer is correct and shows where in the drawing it came from so a human can verify it in seconds.

We are interested in solutions which next year’s frontier models won’t make obsolete. They can be, for example, hybrid solutions which combine frontier models, computer vision, 3D, geometry or small fine-tuned models.

#### About Stoa

Stoa is building the AI-native operating system for construction, a \$15 trillion industry, roughly 13% of the world’s GDP. We are a Helsinki-based team with backgrounds at Supercell, AWS, McKinsey, Slush, Wave Ventures, SRV and Sensofusion, already working with several of the largest construction companies in the Nordics. We are backed by Lifeline Ventures, the founders of Wolt, Supercell, and SiloAI alongside two former Y Combinator partners & others, Stoa recently raised Finland's largest-ever pre-seed round.

We are at Junction because we want to see how Europe’s best builders tackle the hardest challenges in the world’s largest industry.

#### Insight

Stoa’s founding tech team: engineers who work on construction AI daily, together with a construction engineer with years of experience from large building projects.

#### Resources

##### What data Stoa brings:

We provide a comprehensive dataset of real construction drawings and models.

preview (0,5 gb): <https://fwjydgxpttajiqpfmqtj.supabase.co/storage/v1/object/public/stoa-junction-2026/junction-dataset-preview.zip>

full dataset (10 gb): <https://fwjydgxpttajiqpfmqtj.supabase.co/storage/v1/object/public/stoa-junction-2026/junction-dataset.zip>

Company Info

#### Stoa

Website: <a href="https://stoabuild.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://stoabuild.com/</a>

#### Judging Criteria

- Accuracy of answers(25%)
- How well the solution visualizes its reasoning so a human can verify the answer(25%)
- Creativity(25%)
- Low inference cost(25%)

#### Prizes

- Best Overall

  1000€ + A work trial at Stoa

- 2nd Overall

  750€

- 3rd Overall

  250€

---


## Data Track

### The Web Is Your Real-Time Database

[Original challenge page](https://hackjunction.app/participate/45/challenges/332)

by Context.dev

#### The Challenge

Build a product that reacts to the live web.

#### Introduction

Most software runs on stale data and can't see the internet as it is right now. Context.dev turns any website, company, person or news story into clean, structured data with one API call.

You can combine train delays, live sneaker prices, GTA VI leaks and anything your heart imagines to combine them in novel ways.

#### The challenge

Every industry runs on information that sits on the open web, but it's spread across millions of pages in different formats, and it goes out of date overnight.

Analysts still copy-paste prices, check supplier websites by hand and read the news to catch risks. Fact-checkers can't keep up with what gets shared online. Software still greets every new customer with the same generic screen.

Build a product that turns live web data into decisions, actions or experiences that weren't possible before.

Some examples for inspiration:

- [GPU Rental Prices](https://gpurentalprices.com/): compare GPU rental prices across cloud providers.
- [Yapper Leaderboard](https://www.producthunt.com/products/yapper-leaderboard): rank founders and startups by their activity on X.
  - [See how Stan built a similar leaderboard using Context.dev.](https://www.context.dev/blog/stan-builds-an-internal-leaderboard-with-context-dev)
- [cve.now](https://cve.now/): monitor newly disclosed security vulnerabilities.
- [Ferndesk](https://www.context.dev/blog/ferndesk-achieved-personalized-onboarding-in-minutes-with-brand-dev): personalize onboarding with company data and brand assets.

#### Insight

Themes we'd love to see:

- *Scrape the Economy* (live indicators built from product prices or job listings)

- *The Web, Watched* (agents triggered by changes to websites or news)

- *Brand in a Box* (apps that brand themselves from a sign-up email)

- *Truth at Internet Speed* (fact-checking with sources).

- Wild ideas outside these themes are just as welcome.

#### Resources

#### Mentors

Engineers from Context.dev, with expertise in web data extraction, LLM agents, search and large-scale data pipelines: Beer van der Drift (CTO), Yahia Bakour (Founder & CEO) and Thomas Oomens (Engineer). Mentors are on site Friday until 23:00, Saturday from 09:00 until Sunday 02:00, and Sunday from 07:00 until the end.

**Main contact:** Beer van der Drift, CTO, <beer@context.dev>

#### Technologies

Every team gets 50,000 free Context.dev API credits that don't expire: sign up at [context.dev/signup](https://context.dev/signup) and redeem code JUNCTION26 at [context.dev/dashboard/redeem-credits](https://context.dev/dashboard/redeem-credits). Start with the Quickstart at [docs.context.dev/quickstart](https://docs.context.dev/quickstart) (full docs: [docs.context.dev](https://docs.context.dev)). Each team can run up to 50 concurrent requests.

- **Web:** search, scrape (markdown, HTML, screenshots, images), crawl, URL mapping, structured extraction, research answers
- **Entities:** brand data (logos, colors, fonts, style guides), company and people search and enrichment, NAICS/SIC classification
- **Signals:** news search, monitors with webhooks for change detection
- **Scale:** batch API for thousands of URLs, file parsing for PDFs and documents

Creative/ambitious ideas outside these themes are extremely welcome.

Our engineers will be on site all weekend to help with technical questions, prompt and agent design, and scaling.

**Extra details:** Context.dev is built by a small team that ships fast, much like a hackathon team does. We'd love to feature standout projects on our social channels.

Company Info

#### Context.dev

Context.dev provides the web-data layer for AI: APIs that turn websites, brands, companies, people and news into structured, real-time context for software and agents. Teams like Supermemory, Mintlify and Upstash build on it. We went through YC S26 and raised a \$9M seed led by General Catalyst, with investors like Paul Graham and Theo of T3. We're coming to Junction to see what the next generation of builders creates when the whole web is one API call away.

#### Judging Criteria

- Real-world impact(20%)

  Does this connect to a real business or consumer need?

- Creative use of live web data(20%)

  One scrape call or interesting combination of different sources?

- Completeness of demo(20%)

  How ready is it for production?

- Technical execution(20%)

  Latency and accuracy of data

- Real-timeness(20%)

  Does it react to change over time or take a one-off snapshot?

#### Prizes

- 1st Place

  €2,000 + swag

- 2nd Place

  €500 + swag

- 3rd Place

  Swag

---

### Rethinking Recruitment

[Original challenge page](https://hackjunction.app/participate/45/challenges/319)

by City of Espoo

#### The Challenge

How can recruitment and matchmaking events organized by City of Espoo help companies and talent relevantly find and connect with each other, despite AI-generated job search materials and AI-assisted recruitment processes are becoming common?

#### Insight

#### Introduction to the Challenge

Finding the right talent is becoming increasingly difficult, especially in fast-changing industries and international recruitment. At the same time, talented professionals often struggle to communicate what they can actually contribute, while companies struggle to articulate what they really need.

The City of Espoo works with companies and professionals by organizing recruitment and matchmaking events which are organized online and in person, sometimes also in hybrid format. Despite strong event organizing capabilities, challenges remain in facilitating the right kinds of matches between recruiting companies and jobseeking professionals participating in the events. We believe there is an opportunity to rethink how talent, skills, needs and opportunities are identified, described, communicated and matched.

#### The Challenge

Recruitment and matchmaking events often rely on incomplete information. Companies do not always know how to describe their talent or service needs and they provide this information to the event organizer too late, only just before the event day. Professionals do not always know how to communicate their strengths and potential. Traditional documents such as CVs, applications and on-line profiles may not provide an accurate picture of either side.

At the same time, AI-generated job search materials and AI-assisted recruitment processes are becoming common, creating situations where both sides are increasingly interacting through machine-generated interpretations rather than genuine understanding.

Your challenge is to imagine and prototype new ways to help companies and talent find more relevant, efficient and meaningful connections in recruitment and matchmaking events organized by the City of Espoo. The solution can focus on any stage of the journey before, during or after a matchmaking event or address the entire process, registering to, attending and following-up after an event.

#### Initial Insights and Analysis on the Challenge

Today's matchmaking and recruitment events face several recurring challenges:

- Companies are often difficult to engage and motivate to participate as they do not identify a public sector organization like the city to be a relevant source for building a pipeline: the city is the public sector employment service provider and companies assume there are no suitable candidates within the city’s pool of jobseeker customers. Also, since the city’s services are free of charge, the quality of the service is questioned.

- Participating companies may struggle to describe their actual talent and service needs clearly and early enough.

- Organisers receive a large number of applications but have limited ability to understand applicants' real capabilities and potential and how their profile matches with companies’ talent needs. This applies especially to skills and competences needed in technology sectors.

- Companies can become overwhelmed by large volumes of largely irrelevant candidate approaches during events.

- Many professionals find it difficult to describe their competencies, transferable skills and value proposition in a way that attracts the attention of recruiters.

- CVs, applications and messages are increasingly generated with AI, while employers are increasingly analysing them with AI, creating a risk that matching decisions are based on synthetic representations rather than genuine capabilities and needs.

- Functionalities of an on-line event platform with matching algorithms are perceived as cumbersome.

- On-line event platform may crash due to people logging in simultaneously at the beginning of an event.

- In the case of recruiting international professionals either from within Finland or from abroad, recruitment introduces additional complexity related to authority compliance, language, culture, relocation and onboarding support.

We are interested in solutions that help create stronger signal and less noise throughout the process of registering and attending an event, ie. help companies and talent focus on the most relevant opportunities and conversations during an event. Solutions should consider how to avoid reinforcing bias or systematically disadvantaging people based on nationality, language, educational background, career path or other characteristics unrelated to the actual opportunity.

#### Technologies and Support (What We'll Bring)

The City of Espoo will provide:

- Access to subject-matter experts working with companies, talent attraction and international recruitment and event organizing.

- Example scenarios and user journeys based on real matchmaking events.

- Feedback on solution concepts from the perspective of event organisers, companies and talent.

- Guidance on responsible AI, privacy and public-sector considerations where relevant.

Teams are free to use any suitable technologies, methodologies or approaches. Solutions may support matchmaking, communication, discovery and decision-making processes, but automated profiling or automated decision-making about individuals without human involvement should not be a part of the solution.

Teams should use synthetic data. Solutions should minimise personal data processing and demonstrate how privacy would be protected in a real-world deployment in compliance with the EU AI Act.

#### Mentors and contact persons

Who will be mentoring the challenge from your side?

**Mentors:** We will have mentors from the City of Espoo’s International Working Life Services team and Business Services team. They will be available on-site and on Discord to coach teams in different aspects of your ideas.

**Main contact person for the challenge:** Melissa Arni-Hardén, Client relations manager & International Working Life Services team lead, City of Espoo.

#### The Prize and How to Win it

##### Prize

The winning team will receive €1500 in cash, second runner up gets €1000 and the third team €500 The winner also gets an exclusive opportunity to present their solution to the City of Espoo’s business development and innovation leaders as well the national network of cities working on talent attraction and retention. (In other words, your idea won’t just win money; it could get real visibility with the people who can help make it happen!)

Runner-up teams will receive Espoo-themed swag bags and will be featured on the city’s communication channels (a nice boost for your project’s visibility and a presentation to the cities of Helsinki and Vantaa).

##### Judging Criteria

We welcome solutions that improve matching, discovery and communication between companies and talent. Teams should consider privacy, transparency, fairness and inclusion when designing their concepts. Solutions should avoid unnecessary personal data processing and should not rely on automated decision-making about individuals.

#### Resources

#### Available Open APIs and Public Data Sources

Teams are encouraged to identify and use relevant public data sources, open APIs and AI services that support their approach.

Examples may include:

##### Job search portals

- Duunitori - Uusi tapa löytää
- The Hub \| Find your next exciting startup job
- Open jobs - Work in Finland
- Henkilöasiakkaat - Job Market Finland

##### Event platform providers

- Connect with more people – Tavata
- Brella \| Event platform \| Event app \| Matchmaking & Networking

##### Other resources

- European Skills/Competences, Qualifications and Occupations (ESCO) - Employment, Social Affairs and Inclusion
- [National Forum for Skills Anticipation](https://tem.fi/documents/1410877/177691663/FRI+Packalen+National+Forum+for+Skills+Anticipation+2021-2024.pdf/daba07ab-5667-c10f-e122-ba54c8f3085b/FRI+Packalen+National+Forum+for+Skills+Anticipation+2021-2024.pdf?t=1698222758405)
- Suomi.fi service PTV Open Api Documentation - PROD
- [Business Espoo](https://www.businessespoo.com)
- Recruitment assistance \| Business Espoo - Helping companies thrive \| City of Espoo

Teams are not expected to use any specific technology, dataset or methodology. The focus should remain on solving the underlying problem rather than implementing a predefined technical solution.

Company Info

#### City of Espoo

The City of Espoo is one of Finland’s fastest growing and most innovative cities. We work actively to support entrepreneurship through the Business Espoo network, offering free advisory services, tools, and connections to help people start and grow their businesses. By participating in Junction 2025, we want to explore how technology and design can enhance the accessibility, quality and impact of these public services and ensure they are ready for the future. We’re excited to co-create with talented teams at Junction and are open to continuing collaboration beyond the hackathon. A great idea here could be the beginning of a real pilot in Espoo!

Website: <a href="https://www.espoo.fi/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.espoo.fi/</a>

#### Judging Criteria

- Impact & Relevance(45%)

  Does the solution solve a real matchmaking or recruitment challenge and create meaningful value for companies, talent or event organisers?

- Innovation & User Experience (35%)

  Does the solution challenge existing approaches and provide an engaging, intuitive and useful user experience?

- Responsible & Feasible Execution(20%)

  Is the solution technically credible, responsibly designed and realistic enough to be further developed for real-world use?

#### Prizes

- Best overall

  1500€

- 2nd Overall

  1000€

- 3rd Overall

  500€

---

### Wikipedia Through Time.

[Original challenge page](https://hackjunction.app/participate/45/challenges/307)

by MariaDB

#### The Challenge

#### Build the tools Wikipedia is missing, powered by MariaDB's vector search (RAG) and system-versioned tables.

##### INTRODUCTION

Every time you open a Wikipedia article, MariaDB is working behind the scenes: it is the open-source database that stores and serves the world's largest encyclopedia. Yet much of Wikipedia's potential remains untapped. Search is still largely keyword-based, and the full edit history behind every article, a record of how human knowledge evolves, is rarely explored. AI and modern database features now make it possible to ask Wikipedia questions in plain language and to travel back in time through its content. MariaDB is bringing this challenge to Junction to see what the next generation of builders can create when these capabilities meet real Wikipedia data.

##### CHALLENGE DESCRIPTION

Your mission: build a tool for Wikipedia that doesn't exist yet, or that exists but is badly underused, with MariaDB at the core of your stack. The challenge has two tracks, and you pick the one that matches your ambition.

###### RAG TRACK (recommended for most teams)

use MariaDB's native vector search to build retrieval-augmented generation (RAG) **functionality** that let people ask questions of Wikipedia and get grounded, source-cited answers, for example a research assistant for the history of Finland.

###### SVT TRACK (for advanced teams)

use MariaDB system-versioned tables (SVT) to build tools that query how knowledge changes over time, for example showing what an article said on any given date, surfacing edit wars, or tracing how the story of a historical event has been rewritten.

###### BOTH (for very advanced teams)

combine the two, for example a RAG assistant that can answer “what did Wikipedia say about this in 2015, and what has changed since?”

##### JUDGING CRITERIA

We're looking for the most useful and original tool for Wikipedia built on MariaDB. Judges will focus on effective and creative use of MariaDB RAG and/or system-versioned tables, technical execution and scalability across the provided datasets, real-world usefulness for Wikipedia readers or editors, and design and demo quality. Teams taking on the SVT track, or combining both tracks, will be recognised for the added technical ambition.

##### PRIZES

1st place — €1,000 in cash, €1,000 in UpCloud credits, and a MariaDB certification for every team member (5 vouchers at [learn.mariadb.com](learn.mariadb.com), value 750 USD).

2nd place — €500 in cash.

3rd place — €250 in cash.

All winning teams to be credited in blog on [mariadb.org](mariadb.org).

#### Insight

##### INSIGHTS AND FOCUS AREAS

LLMs in general have a particular world view based on their training data – and it may differ from Wikipedia’s world view, which strives for NPOV (Neutral Point of View).

There are two different user groups and perspectives: Wikipedia readers, or active Wikipedians that edit articles. You may choose either, or both.

We'd love to see tools that make Wikipedia's knowledge easier to digest, verify and trust, such as source-grounded Q&A, fact-checking assistants, or detecting gaps and weak spots in article coverage. Comparing the same article between languages can reveal surprising insights, too. On the SVT side, we're especially excited by “time-travel” tools that reveal how articles evolve: point-in-time views, change visualisations, edit wars or bias detection, and edit-history analytics.

##### EXTRA DETAILS

MariaDB was born in Finland, created by Michael “Monty” Widenius, the original author of MySQL, which makes Junction a natural home for this challenge. The source articles are in Finnish, so a multilingual embedding model is recommended for the RAG track, but no Finnish language skills are needed to compete. We offer three datasets of various sizes and characteristics.

#### Resources

##### WHAT WE'LL BRING

During the event, participants will build on MariaDB, the open-source database powering Wikipedia, using real Wikipedia data prepared especially for this challenge. We're providing preliminary datasets in three sizes (small, medium and large) drawn from Finnish Wikipedia articles on the history of Finland, so teams can prototype fast and then prove their tool scales. List of technologies and support we are bringing: – MariaDB Server (open source) with native vector search for the RAG track – MariaDB system-versioned tables for the SVT track – Small, medium and large Wikipedia datasets (Finnish Wikipedia, history of Finland) – Starter documentation and example – MariaDB mentors on site throughout the hackathon Teams are free to pair MariaDB with any LLM, embedding model or frontend framework of their choice.

##### STARTER DOCUMENTATION AND EXAMPLES

- <https://github.com/MariaDB/mariadb-wikipedia-datasets>
- <https://github.com/MariaDB/mariadb-vector-wikipedia-rag>
- [https://github.com/MariaDB/mariadb-system-versioning-wikipedia](https://github.com/MariaDB/mariadb-vector-wikipedia-rag)

##### MENTORS

Mentors from MariaDB with hands-on expertise in MariaDB Vector and RAG pipelines, system-versioned (temporal) tables, and working with large-scale Wikipedia data. They will be available throughout the hackathon to help teams with data modelling, query design and scaling.

- Kaj Arnö, MariaDB Foundation, Executive Chairman
- Robert Silén, MariaDB Foundation, AI Lead

Company Info

#### MariaDB

Website: <a href="https://mariadb.org/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://mariadb.org/</a>

#### Judging Criteria

- Effective and Creative use of MariaDB(20%)

  Effective and creative use of MariaDB RAG and/or system-versioned tables

- Implementation(20%)

  Technical execution and scalability across the provided datasets

- Usefulness(20%)

  Real-world usefulness for Wikipedia readers or editors

- Design and demo quality(20%)

  Design and demo quality

- Originality(20%)

  The most original and unique implementation of the project

- Bonus(0%)

  Added technical ambition for teams taking on the SVT track or combining both tracks

#### Prizes

- 1st Place

  €1,000 in cash, €1,000 in UpCloud credits, and a MariaDB certification for every team member (5 vouchers at learn.mariadb.com, value 750 USD).

- 2nd Place

  €500 in cash.

- 3rd Place

  €250 in cash.

- All Winners

  All winning teams to be credited in blog on mariadb.org.

---


## FinTech Track

### Personal Economic Trainer

[Original challenge page](https://hackjunction.app/participate/45/challenges/311)

by S-Pankki

#### The Challenge

Explore how AI can turn personal banking data into a trusted financial coach for everyday life.

S-Bank is Finland’s fourth-largest bank, with 3.5 million customers, and its S-mobiili app is used weekly by one in three Finnish adults. We want to reimagine personal finance by letting people talk with their own financial data through AI. Banking today often stops at statements and transaction lists. We want to make it conversational, insightful, and personalised. At Junction, we invite you to help us build the next generation of AI-driven personal economic trainers that make money matters simple and engaging for everyone.

Using a large synthetic transaction dataset modelled on real S-Bank data, build an AI experience that lets people chat with their own money, from simple questions like “How much did I spend on taxis last month?” to deeper ones like “What kind of spender am I?”, “What is safe for me to spend this week?” or “How much could I save if I reduced dining out by 20%?”.

We value a pedagogical angle: everyone’s spending falls into three baskets:

1.  mandatory and regular (e.g. rent)
2.  mandatory and irregular (e.g. a broken washing machine), and
3.  everyday spending that slips through your fingers (e.g. coffees) — and solutions that help people understand where their money really goes will go far with us.

Think in the spirit of MyData: let users explore their own data freely rather than showing fixed charts the bank has picked for them. You can enhance these insights with open data sources (e.g., Statistics Finland) to offer meaningful benchmarks.

**Recommended output:** a mobile app, or a web app that can be embedded in a mobile app — our customers are on mobile.

**Extra details:** To our knowledge, no Finnish bank yet lets customers chat with their own financial data, making this a first-of-its-kind opportunity in Finnish banking. The challenge ties directly to S- Bank’s strategy of serving customers increasingly digitally and to our vision for S-mobiili. One of the top-rated finance apps on both Google Play and the App Store, so a winning idea could reach millions of people. Money matters touch everyone, and we believe AI can play a key role in improving financial literacy — especially among young adults.

**About the Company** S-Bank is Finland’s fourth-largest bank, serving 3.5 million customers nationwide. Our mission is to make everyday banking simple, rewarding, and accessible to everyone. We believe in combining strong financial expertise with innovative technology to create solutions that genuinely improve people’s lives. Junction offers us a unique opportunity to co-create with some of the world’s brightest developers and to explore new ways AI can reshape personal finance.

#### Insight

We are especially interested in conversational AI that explains financial concepts in plain language, simulates “what if” scenarios, and guides users toward healthier money habits, for example through safe-to-spend and safe-to-save guidance. Benchmarking personal data against open population data is encouraged but not mandatory.

Optional bonus angle (not required, the challenge is fully solvable with the provided data and open data):

- Multi-bank view: under PSD2, customers can let their bank fetch account data from other banks. How could an AI coach use the customer’s full financial picture?

#### Resources

**Data**

Using a large synthetic transaction dataset modelled on the structure of S-Bank data

**Mentors**

- Carl-Edvard (Calle) Holmberg – Chief Innovation Officer
- Representative from S-Bank IT / AI development
- Data Scientist (transaction data expert)
- 1–2 business representatives who own the customer problem

Main contact: Carl-Edvard (Calle) Holmberg

You may find the data through [here](https://github.com/hackjunction/Junction-2026-S-pankki)

Company Info

#### S-Pankki

Website: <a href="https://www.s-pankki.fi/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.s-pankki.fi/</a>

#### Judging Criteria

- Impact on financial literacy (including the pedagogical angle)(20%)
- Originality of AI integration(20%)
- Clarity of the mobile user experience(20%)
- Feasibility(20%)
- Potential to integrate into S-mobiili(20%)

#### Prizes

- 1st Prize

  2000€ Airbnb Gift Card

- 2nd Prize

  1000€ Airbnb Gift Card

- 3rd Prize

  500€ Airbnb Gift Card

---


## Tech Challenges

### Verda Compute Track

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/56)

by Verda

#### The Challenge

##### INTRODUCTION

From electron to token, it takes decades of progress to run AI. Add scale, efficiency, and sustainability, and AI becomes a monumental achievement.

Verda brings everything together.

We make compute, storage, and networking work in unison to squeeze peak performance, hosted in European data centers and utilizing 100% renewable energy. We develop services for you to utilize computational power most efficiently, no matter your use case.

The end result is a cloud platform trusted by the world's leading AI labs and frontier researchers. The best thing is you get to use the same next-gen compute for free at Junction 2026.

##### BOUNTY: BEST USE OF VERDA

Pick any challenge at Junction and use Verda products to build something you couldn't build on a laptop. Then show us how far it goes.

- **Teach a humanoid to move**. Train locomotion or manipulation policies for Aalto's Unitree G1 in simulation, at scale, before your shot at the real robot.
- **Turn demonstrations into a brain**. Train imitation-learning or VLA policies from robot-arm demos in the Ignite × Intel challenge, or from Rokoko motion-capture teleoperation data.
- **Make an agent stronger than it was on Friday.** Run thousands of rollouts in your AfterQuery RL environment and fine-tune a smaller model on the experience.
- **Read the whole internet's encyclopedia.** Embed MariaDB's full Wikipedia dataset with batch jobs and serve a RAG assistant on top.
- **Keep sensitive data in Europe.** Run open-weight models for a banking coach or a recruitment tool on infrastructure you control, instead of sending data to someone else's API.

**Or surprise us.** Anything that needs serious compute counts. (Anything except crypto mining. We've seen it, and it gets you banned.)

**What we're looking for**

- An ambitious idea where compute is what makes it possible
- The right Verda product for the job, and a clear reason why you chose it
- Your path from first idea to working prototype
- Bonus points: show how your solution would scale from a hackathon demo to real users

**Minimum Requirements**

- Document your process
- Share a link to a summary → Post it in our Discord channel

**The Technology**

- Inference API for serving out-of-the-box open-weight models within your application.
- GPU instances or Instant clusters for training or fine-tuning tasks.
- CPU instances for hosting agentic applications.
- Auto-scaling containers for hosting models where scale and costs matter.
- Batch jobs for long-running tasks in the background.

**Prizes and Judging**

The winning team gets 10,000 USD in cloud credits and Verda hoodies. Runner-up teams in second and third places get 2,500 USD in cloud credits.

#### Resources

##### What we'll bring

- **Inference API:** serve open-weight models in your app with zero setup
- **GPU instances and Instant Clusters:** for training and fine-tuning when one GPU isn't enough
- **CPU instances:** to host your agents and backends
- **Auto-scaling containers:** deploy models where scale and cost matter
- **Batch jobs:** run long jobs in the background while you sleep (or don't)
- **NVIDIA Nemotron endpoint:** hosted by Verda together with NVIDIA
- **Free credits for every team:** scan the QR code on your table or go to [verda.com/blog/junction-2026](verda.com/blog/junction-2026)

**Mentors on-site during the entire weekend**, meet us on the third floor at Booth 6! Start with the **"Getting started with Verda"** workshop on Friday at 20:30, right after the opening ceremony: sign-up, credits, every product, and how to use them.

Ambition: how much did compute let you do that you otherwise couldn't? Fit: did you pick the right Verda services and use them well? Working prototype: does it run, and is the process documented? Path to scale: is there a credible way from demo to real users?

Company Info

#### Verda

Website: <a href="http://verda.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">http://verda.com/</a>

#### Judging Criteria

- Ambition(25%)

  How much did compute let you do that you otherwise couldn't?

- Fit(25%)

  Did you pick the right Verda services and use them well?

- Working prototype(25%)

  Does it run, and is the process documented?

- Path To Scale(25%)

  Is there a credible way from demo to real users?

#### Prizes

- 1st Place

  \$10,000 in Verda cloud credits + Verda hoodies

- 2nd Place

  \$2,500 in cloud credits

- 3rd Place

  \$2,500 in cloud credits

---

### Best Use of MongoDB Atlas

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/55)

by Major League Hacking

#### The Challenge

MongoDB Atlas takes the leading modern database and makes it accessible in the cloud! Get started with a \$50 credit for students or sign up for the Atlas free forever tier (no credit card required). Along with a suite of services and functionalities, you’ll have everything you need to manage all of your data, and you can get a headstart with free resources from MongoDB University! Build a hack using MongoDB Atlas for a chance to win a M5Stack IoT Kit for you and each member of your group.

#### Resources

Check how to build with MongoDB at <https://mlh.link/mongodb>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  M5Stack IoT Kit

---

### Best Use of Vultr

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/54)

by Major League Hacking

#### The Challenge

Vultr empowers hackers to bring their high-performance projects to life instantly; providing everything from the speed of one-click deployment and scalable cloud compute, to specialized Vultr Cloud GPUs that can power AI-driven applications. We want you to push the limits of what can be built when infrastructure is no longer the bottleneck!

Sign up for a Vultr account today and claim your free cloud credits! Take your next hack to the cloud with Vultr for a chance to win some awesome prizes for you and your team!

#### Resources

Check how to build with Vultr at <https://mlh.link/vultr>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  M5Stack mini programmable monitor

---

### Best Use of Tiger Data

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/53)

by Major League Hacking

#### The Challenge

Building high-performance apps under hackathon deadlines shouldn't mean spending half your weekend configuring complex databases or learning obscure query languages. Tiger Data extends PostgreSQL to give student developers an ultra-fast foundation for real-time data, time-series metrics, and complex analytics.

Why build with Tiger Data this weekend?

Standard SQL Power: Query massive datasets instantly using the SQL you already know, with no complex NoSQL aggregation pipelines required.

Unified Data Stack: Store relational user profiles and high-frequency metric streams side-by-side in a single database.

Instant Dashboards: Serve lag-free, real-time frontend charts using pre-computed Continuous Aggregates.

90%+ Data Compression: Store millions of events on free-tier cloud instances without running out of disk space.

Whether you’re building real-time IoT monitoring, AI-driven analytics dashboards, or financial prediction engines, show us how Tiger Data powers your project. The team that demonstrates the most innovative, impactful, and performance-driven use of Tiger Data will take home some great prizes!

#### Resources

Check how to build with Tiger Data at <https://mlh.link/tigerdata>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  Stream Deck Mini

---

### Best Use of Entire

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/51)

by Major League Hacking

#### The Challenge

Entire is the Git forge for agent-human collaboration. From syncing your sessions and prompts to your Git history, to hosting code and replacing the Pull Request with Trails, Entire are reimagining code hosting and collaboration for the agent era.

Ready to build faster with AI without burning through tokens or losing context? This challenge is all about building smarter AI workflows. To qualify, your project should leverage as many of Entire’s core capabilities (Sessions, Graph, and/or Brain) as possible.

Your project should lean on Sessions for context and memory and entire-graph for codebase mapping:

Sessions (Shared Memory): Save your AI agent sessions as instant checkpoints and push them to your team. Teammates or other agents can jump in instantly and pick up right where you left off with zero context loss. Graph (Codebase Mapping): Generate a visual map of how your codebase fits together. Using entire graph search instead of letting agents blindly search files to cut token usage by up to 71%! Brain (Persistent Reasoning): Combine your session data and Graph insights into persistent project knowledge. Agents can query past decisions and architectural lessons through the CLI or MCP so they don’t repeat mistakes or undo working code. Trails (Code review): Assign you or a teammate’s agent a task via Trail (Entire’s issue/PR combo primitive), the agent works on it, and then let your agent review the code change: does the code change match the intent? Should it merge? Let Entire Trails help you decide! We’re looking for teams that use Entire to create seamless human-AI collaboration, maintain clean code history, and show measurable token efficiency. Build something awesome, keep your agents on track, and show us how Entire powers your workflow!

#### Resources

Claim your code at <https://mlh.link/junction-26> and check how to build with Entire at <https://mlh.link/entire>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  Mini Portable Projector

---

### Best Use of Solana

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/52)

by Major League Hacking

#### The Challenge

The world of development is evolving fast and Solana is leading the charge with a network built to handle all of your infrastructure needs. Forget high fees and slow confirmations, it’s time to build applications that are fast, efficient, and scalable.

Harness Solana’s core advantages like blazing fast execution and near-zero transaction costs to make your hackathon ideas become real world projects. With Solana, the possibilities are endless.

Create a game, social app, or consumer product that relies on instant, high-frequency transactions. Design a sophisticated trading, lending, or decentralized exchange (DEX). Build a prototype for supply chain, identity, or payments that can handle massive, real-world volume. Show us how you can innovate with Solana for a chance to win Unruggable Hardware Wallets for you and each member of your team!

#### Resources

Check how to build with Solana at <https://mlh.link/solana>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  Unruggable Hardware Wallets

---

### Best Use of ElevenLabs

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/50)

by Major League Hacking

#### The Challenge

Deploy natural, human-sounding audio with ElevenLabs. Create realistic, dynamic, and emotionally expressive voices for any project, from interactive AI companions to narrated stories and voice-enabled apps. ElevenLabs will empower you to build rich, immersive experiences without the need for actors or complex audio production, using simply the power of AI.

Integrate fully autonomous audio experiences into your hack with ElevenLabs and give your project a voice, along with giving your team the chance to win some wireless earbuds!

#### Resources

Claim your code at <https://mlh.link/junction-26> and check how to build with ElevenLabs at <https://mlh.link/elevenlabs>

Company Info

#### Major League Hacking

Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

#### Prizes

- Best Overall

  Wireless Earbuds

---

### Best Use of Codex

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/49)

by OpenAI

#### The Challenge

OpenAI challenges you to push the boundaries of what's possible with AI-powered software development.

Use Codex as part of your development process to build, iterate, and ship an ambitious project during Junction 2026.

Whether you're building AI agents, complex applications, or entirely new products, show us how Codex can accelerate your development and help you achieve more in just 48 hours.

This is an open challenge: You can participate alongside any other Junction challenge. The key is demonstrating how you've meaningfully used Codex in building your solution.

#### Resources

OpenAI Codex: <https://developers.openai.com/codex>

Codex documentation: <https://developers.openai.com/codex/quickstart>

OpenAI developer platform: <https://platform.openai.com/docs>

Exclusive Junction 2026 offer: OpenAI is providing \$100 in credits per participant through unique redemption links distributed by Junction. The redemption links can be found [here](https://hackjunction.app/participate/45/hackerpacks).

Company Info

#### OpenAI

OpenAI is a leading artificial intelligence research and deployment company focused on building safe, powerful AI systems that expand human capabilities. The organization prioritizes alignment, reliability, and real-world impact, ensuring that advanced models benefit individuals, companies, and society at scale. With world-class research talent, robust compute infrastructure, and cutting-edge model APIs, OpenAI empowers developers to build transformative applications. OpenAI takes part in Junction to support frontier innovation, collaborate with ambitious builders, and accelerate the creation of practical, high-impact AI solutions.

Website: <a href="https://openai.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://openai.com/</a>

#### Prizes

- 1st Overall

  \$10 000 API Credits

- 2nd Overall

  \$5000 API Credits

- 3rd Overall

  \$2500 API Credits

---

### Best Use of Gemini API

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/48)

by Google DeepMind

#### The Challenge

Build something extraordinary with Google's Gemini API.

This is an open innovation challenge: there are no predefined problems or industries to focus on. Whether you're building an AI agent, a developer tool, a creative application, or something entirely new, we want to see what you can create with Gemini.

The challenge is to demonstrate a meaningful, innovative, and technically impressive use of Gemini. Show us why Gemini matters to your solution and what makes your project stand out.

#### Insight

We're looking for projects that go beyond simply adding an LLM to an application.

Think about how Gemini's capabilities can enable something genuinely new or significantly improve an existing solution.

Your submission should clearly explain:

- What problem you're solving and why it matters

- How you've integrated the Gemini API

- What makes your use of Gemini innovative or technically impressive

- Why Gemini is an important part of your solution

The challenge is open to all industries, use cases, and creative ideas.

#### Resources

**Getting started with Gemini**

- [Google AI Studio](https://aistudio.google.com/) – Get your Gemini API key and experiment with models.
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs) – Documentation, examples, and integration guides.
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart) – Build your first Gemini-powered application.

**Junction participant credits**

Google DeepMind is providing access to Gemini API credits for up to 400 participating teams.

**To receive credits your team will have to fill [this form](https://forms.gle/bByXvjGkW9WZuYwW9).**

Eligible teams will receive instructions for accessing their accounts during the event. API keys can be generated through Google AI Studio and used in your preferred development environment.

**Important:** Participation in this challenge and access to the Google-provided accounts are restricted to participants aged 18 or older.

**Technical support**

Visit the Google DeepMind booth during Junction for questions and guidance. Join the "Build with Google DeepMind" workshop on Friday to get started.

Company Info

#### Google DeepMind

Website: <a href="https://deepmind.google/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://deepmind.google/</a>

#### Prizes

- 1st Overall

  The winning team will receive 4000€, plus \$1,000 in Google Cloud credits per team member.

- 2nd Overall

  2000€

- 3rd Overall

  1000€

---

### Best Use of Gemma

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/47)

by Google DeepMind

#### The Challenge

Awarded to the team that demonstrates the most innovative and impactful use of Google's Gemma open models. We're looking for creative applications, strong technical execution, and solutions that showcase the potential of open AI models to solve real-world problems.

#### Resources

##### How to Access Gemma

Gemma is Google's family of open AI models, available for developers to build with.

You can access and run Gemma through several platforms, including our Junction 2026 partners:

- **[Featherless AI](https://featherless.ai/models?families=gemma)** – Access hosted Gemma models through an API.
- **[Modal](https://modal.com/)** – Deploy and run Gemma models on serverless GPU infrastructure.
- **[Verda](https://verda.com/)** – Use cloud GPU resources to deploy and run Gemma yourself.
- **[Google AI Studio](https://aistudio.google.com/)** – Experiment with Gemma in your browser.
- **[Hugging Face](https://huggingface.co/google)** – Download Gemma models and integrate them into your project.

For setup instructions and technical resources, check out the [official Gemma documentation](https://ai.google.dev/gemma/docs).

Be sure to check the partner resources available in the Junction Hackerpack for any event-specific credits or access instructions.

Company Info

#### Google DeepMind

Website: <a href="https://deepmind.google/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://deepmind.google/</a>

#### Prizes

- Top 3

  €1,000 per team for the top 3 teams, with no ranking between winners.

---

### Best Use of Nemotron

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/46)

by NVIDIA

#### The Challenge

Build a project powered by NVIDIA Nemotron that solves a real problem through reasoning, tool use, or coordinated workflows. Applies to: Any track.

##### INTRODUCTION

What can you build when AI moves beyond answering questions and starts getting things done? NVIDIA invites you to use Nemotron to build a project that tackles a real problem for a clear audience. Connect it to tools, ground it in useful data, or combine it with other models to turn an idea into a working solution. Show us what Nemotron enables and why it matters to the people using your project.

##### THE TECHNOLOGY

Meet Nemotron 3.5 Super VL, NVIDIA's newest open model, and it's yours to build with this weekend. It has 120B parameters but only wakes up 12B per token, so it runs fast for its size, and it can read text, images, documents and even video in a single workflow. That means your agent can look at a screenshot, read a PDF, watch a clip, call a tool and write the code to act on it, all with one model.

##### THE CHALLENGE

Build a project where Nemotron plays a meaningful role in doing real work. Use it on its own or alongside other models, tools, and data sources to solve a problem for a clear audience. Nemotron must contribute directly to the project's core functionality, and your demo should make that contribution visible. The solution is open-ended: choose the problem, design the workflow, and show what your approach enables.

**Minimum Requirements:**

- Use NVIDIA Nemotron 3.5 Super VL model in the working solution.
- Demonstrate its contribution to the project's core functionality.
- Submit a short explanation identifying the model used, what it does, why it matters, and how you improved its outputs.
  - This should be done as text input into the submission form.

##### GETTING STARTED

- **NVIDIA Build:** Free hosted APIs to explore, test, and prototype with NVIDIA and community AI models.
  - Note: The API is OpenAI-compatible with base URL <https://integrate.api.nvidia.com/v1> (for example, model `"nvidia/nemotron-3.5-lightning-30b-a3b"`). The free tier is rate-limited (developer forums report about 40 requests per minute per key), so agent loops should use retries with backoff and each teammate should use their own key.
- **OpenRouter API:** Serverless path with a unified API across providers.
  - Note: Free variants (ending in `:free`) are capped at 20 requests per minute and 50 requests per day, or 1,000 per day once the account has bought at least 10 credits.
- **Hugging Face:** Open weights for local runs, fine-tuning or deployment on Brev.

##### RESOURCES AND SUPPORT

- **Support Channel:** Nvidia Discord channel and at the NVIDIA table

##### PRIZES AND JUDGING

##### PRIZE

2 winners of 1x RTX 5080

##### JUDGING CRITERIA

- **Meaningful Nemotron Usage:** Nemotron is central to the project's value. The team clearly explains what it does and why it matters.
- **Technical Execution:** The demo works reliably and shows thoughtful implementation choices around architecture, data flow, tool use, latency, or error handling.
- **Quality of AI Output:** Outputs are useful, relevant, and grounded where appropriate. The team demonstrates efforts to improve quality through prompting, evaluation, or feedback loops.
- **Creativity and Differentiation:** The team uses Nemotron thoughtfully or inventively, with a distinct approach to the problem.

##### COMPANY AND CONTACTS

###### About NVIDIA

NVIDIA builds accelerated computing technologies and AI software that help developers turn ideas into applications. At Junction, we're inviting teams to explore NVIDIA Nemotron open models and build useful agents around real-world needs. Start with a problem you care about and show what you can do over the weekend.

###### Contacts

- **Main Contact:** Elliot Winch, Community Program Manager, EMEA, <ewinch@nvidia.com>
- **Technical Contact:**
- **Mentors Attending:** Maxime Pariente and Ryan Reese
- **Judges:** NVIDIA Team

Company Info

#### NVIDIA

Website: <a href="https://www.nvidia.com/en-us/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.nvidia.com/en-us/</a>

#### Judging Criteria

- Meaningful Nemotron Usage(25%)

  Nemotron is central to the project's value. The team clearly explains what it does and why it matters.

- Technical Execution(25%)

  The demo works reliably and shows thoughtful implementation choices around architecture, data flow, tool use, latency, or error handling.

- Quality of AI Output(25%)

  Outputs are useful, relevant, and grounded where appropriate. The team demonstrates efforts to improve quality through prompting, evaluation, or feedback loops.

- Creativity and Differentiation(25%)

  The team uses Nemotron thoughtfully or inventively, with a distinct approach to the problem.

#### Prizes

- Two best teams

  1x NVIDIA RTX 5080

---

### Best use of Arduino Uno Q

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/45)

by Arduino

#### The Challenge

##### Bring your idea to life in the physical world with Edge AI and the Arduino UNO Q.

Use the Arduino UNO Q and Modulino sensors in your hackathon project, whatever challenge you are solving. Bring Physical AI to life: run AI models directly on the device, sense the real world and make things move, light up or react.

This tech challenge is open to all teams, so you can combine it with any other Junction challenge or your own idea. Start by asking what problem you are solving and who it helps, then think about how hardware and Edge AI can make your solution tangible. The best projects combine a working physical prototype with a smart use of on-device AI.

##### Mentors:

You can find them from Arduino Hardware Lab and on Discord.

#### Insight

Arduino is also hosting the main challenge The Green European Renaissance, where teams use Edge AI and the Arduino UNO Q to create local solutions for a greener Europe. The Best Use of Arduino tech challenge is open to everyone, so teams working on any challenge can use Arduino to make their solution physical.

The award goes to the team that makes the best and most creative use of Arduino in their project, in any challenge. We focus on the following criteria: Use of Arduino hardware & Edge AI (50 %), Working prototype & demo (30 %), and Creativity (20 %).

##### Getting the hardware

Arduino UNO Q kits are available to borrow from the Arduino Hardware Lab. You’ll find the instructions for booking and picking up your kit here: <https://2026.hackjunction.com/hardware>

##### Submission: on Junction Platform and to Arduino Project Hub

To be eligible for prizes, you must publish your project on the Arduino Project Hub in addition to submitting it on the Junction platform, where peer review and judging take place.

- Log in at <https://projecthub.arduino.cc/>

- Click + NEW PROJECT

- Select the tag Junction Finland 2026

- Fill in the required parts

#### Resources

Participants can use Arduino hardware and software to build Physical AI prototypes for any Junction challenge, with Arduino mentors on-site to help with technical questions. You can find the Hardware from Arduino booth.

##### Hardware we are bringing:

- Arduino UNO Q (2 GB RAM, 16 GB eMMC)
- Arduino USB-C Cable
- Arduino USB-C Hub (8 in 1)
- USB-C Power Supply (45W)
- Arduino USB Camera
- Modulino Buzzer, Modulino Knob and Modulino Thermo sensors

Software: Arduino App Lab (<https://www.arduino.cc/en/software/#app-lab-section>)

What to bring: A laptop with the Arduino App Lab.

Company Info

#### Arduino

Website: <a href="https://www.arduino.cc/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://www.arduino.cc/</a>

#### Judging Criteria

- Use of Arduino hardware & Edge AI (50%)
- Working prototype & demo(30%)
- Creativity(20%)

#### Prizes

- Arduino UNO Q & Plug and Make kit for each team member

  Each member of the winning team receives an Arduino UNO Q and an Arduino Plug and Make Kit.

---

### Best Use of Context.dev: Fully Structured Web

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/44)

by Context.dev

#### The Challenge

Plug the Context.dev API into whatever you're building and give it the live web: pages, brands, companies, people and news as clean structured data in one API call.

#### The Challenge

Whatever you're building, use the **Context.dev API** to extract exactly what you need from the web and nothing more.

Live web data lets your project check facts against current sources, react when a page or news story changes, brand itself from a customer's email, or enrich a company or person in one call instead of relying on stale data.

To count, your project must call **at least one Context.dev endpoint in its core flow**, not just as a side feature.

##### Minimum requirements

- Use **at least one Context.dev API endpoint** in the submitted project.
- The data from Context.dev must **visibly drive something in the demo**.

##### What to submit

Submit a **GitHub repository and a demo of your project**, plus a short note on **which Context.dev endpoints you used and why**.

#### Resources

#### What we'll bring

Every team gets **50,000 Context.dev API credits that don't expire**, plus documentation, SDKs, an MCP server, live example projects and **Context.dev engineers on site** to help.

**No credit card needed.** There is no rate limit, with a maximum of **50 concurrent requests per organisation**. No special hardware is needed; the live web is your dataset.

#### The Technology

Context.dev is a **web data API**. You send it a URL, a domain, a company or a search query, and it returns clean, structured data — markdown, JSON, screenshots, logos, colours, company facts and news — that your app or model can use right away. No scrapers, proxies or parsers to maintain.

**Key capabilities:**

- **Search and scrape:** turn pages into markdown, HTML, screenshots or images, or crawl and map a whole site.
- **Structured extraction:** extract JSON with your own schema, or get researched answers to a question.
- **Brand data:** get logos, colours, fonts and a style guide from a domain or email.
- **Search and enrichment:** search and enrich companies, people and news.
- **Monitors and webhooks:** react when a page or topic changes.
- **Batch processing:** process thousands of URLs.
- **File parsing:** parse PDFs and documents.
- **Social media:** scrape feeds such as TikTok and Instagram.

#### Getting started

1.  **Create an account** at [context.dev/signup](https://context.dev/signup). Coding agents can use [context.dev/auth.md](https://context.dev/auth.md).
2.  **Redeem code `JUNCTION26`** at [Redeem credits](https://context.dev/dashboard/redeem-credits) to receive **50,000 API credits per team, with no expiry**.
3.  **Copy a secret key** from the [API keys page](https://context.dev/dashboard/api-keys).
4.  **Install the SDK:** `npm install context.dev` or `pip install context.dev`.
5.  **Scrape your first page** using the code in the [Quickstart](https://docs.context.dev/quickstart). You should see the Junction homepage printed as Markdown. Swap in any URL, or try brand, search, news or monitors. Start building!

**Using a coding agent?** Point it at the [Agent quickstart](https://docs.context.dev/agent-quickstart), or connect the MCP server at <https://mcp.context.dev/mcp> ([setup guide](https://docs.context.dev/install-mcp)).

**Example requests and responses:**

- **Scrape the Junction website to Markdown:** [request + response](https://gist.github.com/contextualbeer/c602446780d9270a4d817a4a677c6317).
- **Extract this event's details as JSON:** [request + response](https://gist.github.com/contextualbeer/d2a016dcd6c535e4eeffa4d6988bd403).

#### Recommended setup

Use **any language over HTTP**. SDKs are available for **TypeScript/Node, Python, Ruby and Go**. If you can call an API, you can use Context.dev, whether you're building a web app, backend or something else that can make an HTTP request.

Bring any laptop with **Node.js 20+ or Python 3.9+** (Ruby 3.2+ and Go 1.22+ are also supported), or just curl. **Internet access is required.**

Optional tools: the [context-dev CLI](https://docs.context.dev/install-cli), the [agent skill](https://docs.context.dev/install-skill), or the [MCP server](https://docs.context.dev/install-mcp). To try requests without code, use the [Playground](https://www.context.dev/playground/scrape).

#### Tips and common pitfalls

- **Check each output's `success` flag.** A 200 response can still contain a failed output.
- **Set `maxAgeMs: 0` when you need fresh data.** Results are cached for up to 3 days by default, and cached results cost the same credits as fresh ones. Store results in your own app to avoid paying for repeat calls.
- **Crawls, batches and monitors are asynchronous.** Poll the job or receive a webhook; use a service such as Cloudflare Tunnel for local webhooks.
- **Some sites block automated access.** Teams are responsible for respecting the terms of the sites they use.

#### Documentation and examples

- **Documentation:** [docs.context.dev](https://docs.context.dev)
- **Guides:** [Quickstart](https://docs.context.dev/quickstart), [Agent quickstart](https://docs.context.dev/agent-quickstart), [Recipes](https://docs.context.dev/use-cases/live-web-context-for-agents)
- **API reference:** [Web scraping API](https://docs.context.dev/api-reference/web-scraping/scrape)
- **Operation costs:** [Credits and pricing](https://docs.context.dev/account/credits)
- **Live examples:** [GPU rental price tracker](https://gpu.context.dev) ([source](https://github.com/context-dot-dev/gpu-terminal)) and [Yapper leaderboard](https://yappers.context.dev)
- **SDKs and integrations:** [github.com/context-dot-dev](https://github.com/context-dot-dev)

There is no starter repository; start with the **Quickstart guide**.

#### Mentors and support

Context.dev engineers will help with **web data extraction, search, LLM apps and large-scale data pipelines**:

- **Beer van der Drift** — CTO, challenge lead and lead judge
- **Yahia Bakour** — Founder & CEO
- **Thomas Oomens** — Engineer

**On-site availability:**

- **Friday:** until 23:00
- **Saturday:** from 09:00 until Sunday 02:00
- **Sunday:** from 07:00 until the end

Come visit the **Context.dev booth**. Main and technical contact: **Beer van der Drift**, CTO, **<beer@context.dev>**. Service status: [status.context.dev](https://status.context.dev).

Company Info

#### Context.dev

Context.dev provides the web-data layer for AI: APIs that turn websites, brands, companies, people and news into structured, real-time context for software and agents. Teams like Supermemory, Mintlify and Upstash build on it. We went through YC S26 and raised a \$9M seed led by General Catalyst, with investors like Paul Graham and Theo of T3. We're coming to Junction to see what the next generation of builders creates when the whole web is one API call away.

#### Judging Criteria

- Creative use of Context.dev(40%)

  Unusual sources, combining several endpoints.

- How central live web data is to the product(30%)

- Technical execution(30%)

  Accuracy, latency, handling of change over time.

#### Prizes

- 1st Place

  €750 + swag

- 2nd Place

  €250 + swag

- 3rd Place

  Swag

---

### Best Use of Aiven

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/43)

by Aiven

#### The Challenge

Great ideas need somewhere to run, data they can use and systems that work together. Whether you’re building an AI agent, an interactive game, a sustainability tool or something nobody has thought of yet, Aiven can help bring your project to life. We’re looking for the most impressive use of Aiven technology: a thoughtful implementation that makes a meaningful difference to your working solution.

#### Your Challenge

- Use at least one Aiven service as a meaningful part of your Junction project, and demonstrate what it enables.
- You can enter this tech challenge alongside your main challenge. Keep your chosen problem, industry and audience, and use Aiven where it helps your solution.
- Choose the services that fit your project. A well-executed use of one service can be just as impressive as a solution combining several.

You could host your app or agent on Aiven Runtime, store data in Aiven PostgreSQL, use Aiven Valkey for caching, process events with Aiven Kafka, observe your agent with Aiven ClickHouse or add search with Aiven OpenSearch.

#### Resources

#### Resources

- **Platform:** [Sign up to Aiven](https://console.aiven.io/signup) and receive \$50 in free credits.
- **Documentation:** [Aiven documentation](https://aiven.io/docs/)
- **Runtime templates:** [Popular open-source frameworks](https://templates.aiven.io/)

There will also be Aiven mentors onsite all days that can help you with any questions you have around the Aiven platform or how you should architect your project.

Company Info

#### Aiven

Website: <a href="https://aiven.io/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://aiven.io/</a>

#### Judging Criteria

- Meaningful use of Aiven technology(40%)
- Technical implementatation(30%)
- Impact on the Overall Solution(20%)
- Creativity(10%)

#### Prizes

- Best Use of Aiven

  1000€

- 2nd Overall

  750€

- 3rd Overall

  500€

---

### Best use of CRACI

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/42)

by Craci

#### The Challenge

#### Make every build your first line of defence.

##### Description

Build anything you can imagine at Junction 2026, even a project made mainly for another challenge: as long as its CI/CD runs on CRACI, you can submit it to this challenge too. Switch a GitHub Actions job to runs-on: craci and every build records exactly what goes into your software, exposes that data through the CRACI API, and can fix vulnerabilities automatically with AI grounded in that exact build data. Treat all of this as raw material, not a checklist: an agent that patches your app while you sleep, a live map of everything the internet ships into your code, a tool that catches a malicious package the moment a build pulls it in, or something we have never thought of. Attackers now exploit new vulnerabilities within about a day, so the boldest ideas for software that defends itself will win. Surprise us.

##### Mentors from CRACI's founding and engineering team

Juho Niemi (CEO), Dennis Marttinen (CTO), Petteri Pulkkinen (CISO), Veeti Poutsalo (Software Engineer) and Roope Ripatti (Forward Deployed Engineer). Between them they cover CI/CD and build systems, software supply chain security, vulnerability management, AI-driven automated fixing and the CRACI API.

Find the CRACI team at the CRACI booth throughout the event!

#### Insight

Severe vulnerabilities are exploding: 7,718 High or Critical CVEs were published in September 2026 alone, nearly five times as many as a year earlier. At the same time, the median time from disclosure to exploit has fallen to about a day and is projected to reach an hour by 2027. That is why CRACI runs the build itself: because it knows exactly what ships, it can stop attacks in real time and generate AI fixes grounded in exact build data.

Running your project's CI on CRACI is required to qualify.

#### Resources

Every team gets free access to the CRACI platform for the whole event, CI/CD build minutes included. CRACI runners are GitHub Actions compatible, so you can keep your existing workflows and switch a job over in one line. As your builds run, CRACI records every external dependency they pull in and produces verifiable CycloneDX SBOMs, including packages restored from caches, and AI fixes can patch vulnerabilities automatically based on that exact build data. Everything is open to you through the CRACI API, and our docs ship with agent skills so you can work with them in your AI coding tools. Our whole team is on site to help you get set up and to go deep on supply chain security.

##### List of technologies that we are bringing:

– Free access to the CRACI platform during the event (platform.craci.com) – CI/CD build minutes on CRACI's GitHub Actions-compatible runners – Build-time CycloneDX SBOMs with completeness data per job and per cache – AI fixes: automated vulnerability fixes grounded in exact build data – The CRACI API: SBOMs, OCI image and cache provenance, network traces, job logs and compute usage – Documentation, examples and agent skills: <https://docs.craci.com/> – Five mentors from the CRACI team on site all weekend

#### Claim your free compute

Every team gets 1000€ credits to the CRACI platform for the whole event. These can be used for CI/CD or any compute need you require. Setup takes about ten minutes.

##### 1. Get your invite code

You need the Junction invite code to create your team's organization on CRACI. Get it either way:

- **Discord:** Ask in the `#craci` channel on the Junction Discord.
- **CRACI booth:** Come say hi. We'll give you the code and help with setup on the spot.

Only one person per team needs to do steps 2 to 4. Invite your teammates afterwards.

##### 2. Sign up and create your organization

1.  Go to [platform.craci.com](https://platform.craci.com) and sign up.
2.  Create an organization for your team and enter the Junction invite code.

##### 3. Connect GitHub

1.  In CRACI, go to **Settings → Builds** and start the **Install GitHub** flow.
2.  CRACI walks you through creating its GitHub App and installing it on your GitHub organization or account.
3.  Grant the App access to the repositories you'll build: all repositories, or a selected set.
4.  Wait until the connection shows **configured**.

You can change repository access later on GitHub under **Settings → GitHub Apps → CRACI → Configure**.

##### 4. Run your first build on CRACI

After connecting the app, any workflow file with runs-on: craci will be running on the CRACI platform. The default runner size is 2 vCPUs and 6GB RAM.

``` yaml
jobs:
  build:
    runs-on: craci 
    steps:
      - uses: actions/checkout@v4
      - run: make build
```

Push, and the job runs on CRACI. Open the build in the platform to see what it pulled in.

Need a bigger machine? Add the setup step first:

``` yaml
    steps:
      - uses: cracicorp/setup@v1
        with:
          size: "8"   # 1–32 units; each unit is 1 vCPU and 3 GB RAM. Default is 2.
      - uses: actions/checkout@v4
```

You can also point your agent at our migration skill for migrating old workflows or when creating new ones: <https://docs.craci.com/skills/craci/SKILL.md>

##### 5. Get an API token

An organization admin can create a token under **Settings → API tokens**. The token is shown only once, so store it somewhere safe. Call the API at `https://api.craci.com` with `Authorization: Bearer $CRACI_API_TOKEN`. The full OpenAPI spec is at [api.craci.com/openapi.json](https://api.craci.com/openapi.json).

#### Resources

If you or your agent needs more info, check out [docs.craci.com](https://docs.craci.com/) or come yap with us at the booth! (3rd next to the stage)

Company Info

#### Craci

Website: <a href="https://craci.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://craci.com/</a>

#### Judging Criteria

- Technical depth(50%)

- How creatively you use CRACI's features(50%)

  SBOMs, AI fixes, provenance, network traces and the API. Original ideas we have not seen before score highest, so do not just add runs-on: Craci to a project and stop there.

#### Prizes

- 1st Team

  LEGO set for each team member

- 2nd Team

  24-pack of Red Bull for each team member

- 3rd Team

  invite to the CRACI x OpenAI lunch event during Slush.

- Top 5 Teams

  Each of the top 5 teams receives 50,000 CRACI CI/CD build minutes per team member, plus the opportunity to interview for a job at CRACI.

---

### Best Use of Cloudinary

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/41)

by Cloudinary

#### The Challenge

##### Build an innovative solution using one of our four tools listed on cld.media/hackathons that uses images and video to create a more engaging and intelligent digital experience.

##### Description

Images and video are central to how people discover, understand, and interact with products and services. Use Cloudinary to build a hackathon project that solves a real problem through visual content.

Your project could transform, optimize, personalize, organize, or deliver images and video in a creative way. Think about who your solution helps and how visual media can make the experience faster, smarter, or more engaging.

Check out the specific tools we’d like you to use for our challenge: <https://cld.media/hackathons>.

To submit your challenge, you must fill in this form: <https://cld.media/hackathon-survey>.

##### Mentors

Jen Looper - Director, Developer Relations

Balazs Kemenesi - Lead Program Manager

#### Insight

To be considered for the Cloudinary challenge, hackers must enter their project into cld.media/hackathon-survey.

You do not need to build a media platform from scratch. Cloudinary handles the complex parts of media upload, management, transformation, optimization, and delivery, allowing you to focus on your idea and the problem you want to solve.

Projects can be built with any programming language or framework, as long as Cloudinary plays a *meaningful* role in the solution, not just a CDN.

##### How solutions will be judged:

Projects will be judged based on the originality and usefulness of the idea, the quality of the user experience, and how effectively Cloudinary is integrated into the solution. Judges will also consider technical execution, creativity, and the potential real-world impact of the project.

#### Resources

Participants will use Cloudinary to upload, manage, transform, optimize, and deliver images and video within their hackathon projects. Cloudinary provides a generous free tier for developers to leverage our APIs and SDKs that make it easy to add powerful media capabilities to web and mobile applications.

Participants can use features such as image and video transformations, resizing, cropping, format and quality optimization, responsive delivery, and programmatic media management. Creative use of AI-powered media capabilities is also encouraged where relevant to the project.

Cloudinary mentors will be available to answer technical questions and help teams get started. Participants can explore the following resources:

Cloudinary documentation: <https://cloudinary.com/documentation>

Cloudinary Hackathon page: <https://cloudinary.com/pages/hackathons/>

Company Info

#### Cloudinary

Website: <a href="https://cloudinary.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://cloudinary.com/</a>

#### Judging Criteria

- Innovation(30%)
- Technical Implementation(20%)
- UX / Design(30%)
- Impact / Usefulness(20%)

#### Prizes

- 1st

  \$500 worth Amazon gift cards (for your local Amazon) / team member

---

### Best use of Modal

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/40)

by Modal

#### The Challenge

#### Take your Junction project from laptop to production AI on Modal.

##### Description

Every Junction team is building with AI, and most hit the same wall: the model runs on a laptop, but too slowly, not on a GPU, and not behind a URL the judges can open. Modal gets you past that wall. Use Modal to power the project you're already building for your main Junction challenge: serve an open model on a GPU, run your agent's code in secure Sandboxes, fine-tune a model on your own data, or fan out a big batch job, all in plain Python with no Dockerfiles, Kubernetes or YAML. We're looking for the most ambitious working AI system built on Modal, where Modal does the heavy lifting and the team spends its 48 hours on the problem. Inference, agents, sandboxes and training: your whole AI stack on one platform.

##### Mentors:

Engineers and Developer Relations from Modal with experience in inference, AI agents and code-execution sandboxes, fine-tuning and reinforcement learning, and real-time audio and video pipelines. We'll be at the Modal booth throughout the event and on the Junction Discord for debugging help.

Main contact person: Filip Makraduli, Developer Relations Engineer

#### Insight

Modal was built so that a single developer can do what used to take a platform team, which makes it a natural fit for a 48-hour hackathon. Best use of Modal is a tech challenge, so you compete in it on top of your main challenge: use Modal to power the project you're already building and you can enter. The same project can enter other tech challenges too.

##### What we’ll bring:

Every participant gets \$100 in Modal credits for CPUs and GPUs, up to the latest NVIDIA B300s, billed per second and scaling to zero when idle. Modal is Python-native: decorate a function, run modal run, and it executes in the cloud in seconds; modal deploy turns it into an autoscaling web endpoint with a public URL ready for your demo. Teams can serve open-weight LLMs, vision-language and speech models; run untrusted, LLM-generated code in isolated Sandboxes; fine-tune or RL post-train models on one GPU or a multi-node cluster with Modal Dojo, our open-source training library; and store weights and datasets in Volumes. We'll provide a Junction starter kit of ready-to-run examples. The kick-off workshop will be at the Modal booth and announced on Discord, and Modal engineers will be on site all weekend.

#### Resources

##### Access and list of technologies we are bringing:

• Modal compute credits (\$100 per participant) for CPUs and GPUs: T4, L4, A10, L40S, A100 (40 and 80 GB), RTX PRO 6000, H100, H200, B200 and B300 • Modal Python SDK and CLI (pip install modal), plus JavaScript and Go SDKs for Sandboxes • Modal Sandboxes: secure, on-demand containers for agents, code interpreters and evals • Web endpoints (FastAPI, WebSockets, WebRTC) with autoscaling and public URLs • Volumes, Dicts and Queues for model weights, datasets and shared state • Modal Dojo: open-source library for fine-tuning and RL post-training open models on Modal GPUs • Starter examples: LLM serving with vLLM and SGLang, speech-to-text, text-to-speech, vision, RAG, agents and RL • On-site mentors from Modal engineering and Developer Relations

To claim \$100 in Modal credits you need to sign up for a Modal account, then redeem the credits via the link (<https://modal.fillout.com/t/qMXCmRGseUus?code=VVX-2QX-8HW>) using the code VVX-2QX-8HW.

The credits are valid for one year from redemption, so everyone can keep building well after the hackathon wraps up.

Company Info

#### Modal

Website: <a href="https://modal.com/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://modal.com/</a>

#### Judging Criteria

- Effective use of Modal(40%)

  how central Modal is to the project and how well you use it, from GPU inference to Sandboxes, training and scaling out

- Technical ambition(25%)

  how hard the build is and how far you pushed it in 48 hours

- Impact(20%)

  how well it solves a real problem from your main challenge

- Demo(15%)

  a live, deployed app the judges can actually use

#### Prizes

- 1st team

  \$2000 in cash prize & \$3000 in Modal credits

---

### Best agentic usecase of Oxylabs Web API

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/32)

by Oxylabs

#### The Challenge

Design your project around the Oxylabs Web API: use live search and scraping to verify and inform your AI agent with what is true on the web right now.

#### Introduction

AI models are brilliant but can be out of date. The moment an agent needs today's price, this morning's regulation or a page hidden behind JavaScript and bot checks, it either guesses or fails. Reliable access to the live web is essential for an agent people can trust. We are bringing our new Web API to Junction so you can build agents that know what is true right now, and can show their sources.

#### The Challenge

**Challenge description:** Utilize the Oxylabs Web API in the AI agent or product you are building for your main challenge, and make it act on what is true on the web right now. Whatever problem your team tackles, live web data lets your solution check facts, track changes, compare offers and ground its answers in current, cited sources instead of stale training data. Your solution must use the Oxylabs Web API at runtime to find and read its information: search to find, scrape to read. The form is open, from a chat agent or monitoring tool to a voice assistant. Show us that it gets the answer right today and can prove where it came from.  
To submit, use the same GitHub repository and demo as your main challenge, and add a short note on which Web API endpoints you used and why.

**Inspiration:**  
Your solution may build on one of the ideas below, or you may come up with an entirely different use case depending on your choice of main challenge. Think of users whose decisions go wrong when information is stale: a shopper, a small business owner, a journalist, a compliance officer, a job seeker.

- **One market, different prices.** Compare the same product, service or offer across European countries using geo-targeted search and the commerce scrapers.
- **Fact-checker that reads the source.** Verify a claim by reading the full pages, not the snippets, and return a verdict with citations.
- **What does AI say about you?** Compare the answers ChatGPT, Gemini, Perplexity and Google AI Mode give on a topic with what the web says.
- **Watchers for small teams.** Track regulations, tenders, grants or competitor pages and explain what changed and why it matters.

**Minimum requirements:**

- The demo makes at least one live Web API call (/search or /scrape) at runtime. Pre-downloaded data alone does not count.
- The solution shows the source URLs behind what it states or decides.

#### Resources

#### The Technology

Oxylabs Web API is a REST API with two endpoints. /search finds the right pages on the live web, and /scrape reads any public page and returns it as Markdown, HTML, structured JSON or a screenshot. It handles JavaScript rendering, bot challenges, proxies and geo-targeting, so one HTTP call gives you clean data ready for your code or your LLM.

**Key capabilities:**

- Search the live web and get ranked results (title, snippet, URL), localised to any country
- Read any public page as clean Markdown, sized for an LLM context window
- Extract structured JSON from any page by describing the fields in a prompt (AI Parsing)
- Get parsed fields from 50+ dedicated scrapers: Search, Maps, Shopping and Trends, Amazon, YouTube subtitles and metadata, eBay, Walmart and more
- Query ChatGPT, Gemini, Perplexity and Google AI Mode and get their answers with cited sources
- Plug it into Claude Code, Cursor or your own agent with one command, via the MCP server or agent skills

#### Getting started

1.  Create a free account at dashboard.oxylabs.io.
2.  Buy the Flexible plan with a price of \$500. Use code JUNCTION2026 at checkout to get a full discount for the first month. **Remember to cancel your subscription once you've completed the challenge to avoid being charged monthly.**
3.  Click + Add product instance, choose Web API, create it and copy the API key.
4.  Export the key in your terminal: `export OXYLABS_WEB_API_KEY=your_api_key_here`
5.  Follow the Manual or AI Agent integration here: <https://developers.oxylabs.io/get-started/quick-start-web-api>

#### Recommended setup

Any OS with a terminal. Python 3.10+ with requests, or Node.js 18+ (built-in fetch); there is no SDK to install. Optional: uv for the MCP server and Node.js for the agent skills. Bring your own LLM key if your agent needs a model.

**Contacts:** Justas Kašėta (technical contact), <justas.kaseta@oxylabs.io>

Company Info

#### Oxylabs

Oxylabs builds the infrastructure companies and AI teams use to collect public web data at scale, from proxy networks to scraping APIs. We are headquartered in Vilnius, Lithuania. In July, Oxylabs reached a \$3.6 billion valuation, becoming Lithuania's newest tech unicorn. We are at Junction to put our new Web API in the hands of the people building the next generation of AI agents.

Website: <a href="https://oxylabs.io/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://oxylabs.io/</a>

#### Judging Criteria

- Use of the Web API(30%)

  How well and how creatively it is used: search-to-scrape, AI Parsing, dedicated scrapers, geo-targeting.

- Real-world value(25%)

  A clear user and a problem that live web data solves.

- Trust(20%)

  Answers are current, sourced and honest about failures.

- Execution(15%)

  It works live in front of the judges.

- Originality(10%)

  Something we have not seen before.

#### Prizes

- The winning team

  The winning team will receive a €1,000 Apple gift voucher, plus \$500 in Oxylabs product credits for each team member to use our web data collection products and explore their potential for future projects.

---

### Atech Real World Challenge

[Original challenge page](https://hackjunction.app/participate/45/tech-challenges/29)

by Atech

#### The Challenge

### The API for the physical world

#### Introduction

AI made software something anyone can build in an afternoon. Hardware is next. Wiring, drivers and firmware used to eat a whole hackathon before anything blinked; with Atech you describe what you want, snap the modules together and flash working firmware from your browser. At Junction we want to see what 2,000 builders do when the physical world becomes as easy to prototype as a web app.

#### The Challenge

Build a physical device that solves a real problem for a real person, using Atech modules as its body and AI as its brain. Pick someone (a farmer, a nurse, a cyclist, your grandmother, your flatmate) and give them a device that senses, reacts or connects in a way software alone can't. Use Atech to go from idea to a working prototype on the table, then spend your remaining hours on what makes it great. Using Atech hardware is required; how you combine it with other tools, APIs and models is up to you.

#### Minimum Requirements

- Atech modules used in the demo alongside a real-world solution
- Share a link to a summary / post about it in our [Discord](https://discord.gg/SkTkQW4De)

#### Inspiration

- Assistive devices: fall detection, posture coaching, smart reminders for people living alone
- Sustainability: sensing energy, water, air quality or food waste and acting on it
- Physical AI: put an LLM or vision model in a loop with real sensors and actuators
- Robotics: give a robot arm or rover new senses with distance, IMU or climate modules
- Tools for makers, labs and classrooms that make building hardware even easier

#### The Technology

**What it is?** Atech is a kit of snap-together ESP32-based electronic modules (sensors, motion, connectivity) plus an AI platform that writes the firmware for you. You describe the device in plain language; Atech plans it, generates the code, builds it and flashes it to your hardware straight from the browser. No breadboards, no soldering, no driver hunting.

**Key Capabilities**

- Snap modules together in seconds: distance, IMU, temperature & humidity, air quality, microphone, speakers, motors, and more
- Build directly from atech.dev and flash from the browser over USB
- Python library: `pip install atech` to use any coding agent
- Test in Atech's emulator before touching hardware
- Connect devices via Wi-Fi or Bluetooth, to create an API to your AI set-ups

#### Prizes and Judging

The winning team gets a special Pro Atech kit for the team to keep building. Runner-up teams get Atech kits and swag. Top teams are invited to show their project on Atech's channels and visit us in Copenhagen.

#### Tech Profile

- **Type:** Hardware + AI platform
- **Languages / frameworks:** Natural language; generated C/C++ firmware (PlatformIO / ESP32), editable by hand. Python library for coding agents
- **Platforms:** Web (Chromium browser) + Atech ESP32 modules
- **Skill level:** Beginner to advanced; no embedded experience needed
- **Offline / online:** Firmware generation needs internet; flashed devices run standalone
- **Known limitations:** Browser flashing needs Chrome or Edge (WebSerial); limited kits, hopefully 2–4 per participating team

#### Submission Requirements

- Live demo on the hardware
- Public GitHub repo or exported Atech project
- ~2-minute video / live demo

#### About the Company

Atech is a Copenhagen-based startup making hardware as easy to build as software. Our modular electronics and AI firmware platform are used by 250+ customers, from makerspaces to university labs at Stanford, UC Berkeley, and industry R&D teams. We come from the hackathon scene ourselves and are at Junction to find builders who want to bring AI into the physical world. Strong teams can keep building with Atech after the event, and we're hiring.

#### Extra Details

Atech has powered hackathons across the Nordics and the UK, including Lund AI Society, Zero to Demo and Oxford AI Society. Next on our roadmap: simulation of Atech modules in NVIDIA Isaac Sim, so teams can quickly prototype automated factory set-ups and simulate them.

#### Insight

**Quickstart**

1.  Pick up your team's kit at the Atech booth

2.  Create an account at atech.dev and redeem code: JUNCTION

3.  Snap a module onto the base board and plug it into your laptop with USB-C

4.  Open the platform in Chrome or Edge and describe a first device, e.g. "Light the LED red when something is closer than 20 cm"

5.  Click flash. You should see your device react in under a minute. Start building!

6.  Recommended: `pip install atech`, then use your preferred coding agent

**Recommended setup**

Any laptop (macOS, Windows or Linux) with Chrome or Edge, a USB-C port (or adapter) and internet. Nothing to install. Optional: use our Python library and/or our desktop app for an improved experience.

**Tips and common pitfalls**

- Use Chrome or Edge; Safari and Firefox don't support browser flashing

- Use a data USB cable, not a charge-only one (we'll have spares at the booth)

- Start with one module working, then add the next; describe changes step by step

- On Linux, add your user to the `dialout` group if the board doesn't show up

#### Resources

#### Access

- **Access method:** Hardware checkout at the Atech booth + free platform account at atech.dev using code: JUNCTION
- **Where to find the code:** Challenge page in the Junction app and the Atech Discord channel
- **What they get:** Depending on demand, 2–4 Atech boards + modules per team, plus free platform access
- **Hardware:** First come, first served at the Atech booth from opening; teams return everything after final demos. Winners receive prizes.

#### What we'll bring

Atech hardware kits for participating teams, free access to the Atech platform for the weekend, and the people who built it on site. Our engineers will help you from first flash to final demo, including at night.

#### Resources

- **Documentation:** [atech.dev/docs](atech.dev/docs)
- **Quickstart / tutorial:** Section E2 above + video walkthrough
- **Starter repo:** [github.com/atechdotdev](github.com/atechdotdev) with example projects
- **Pre-event workshop:** Join our [Discord](https://discord.gg/SkTkQW4De)

#### Support

- **Support channel:** \#atech on the Junction Discord + Atech booth, or our [Discord](https://discord.gg/SkTkQW4De)
- **Mentor availability:** Throughout the event, with a night shift
- **Technical escalation (software):** <julius@atech.dev>
- **Technical escalation (hardware):** <tomas@atech.dev>

#### Team background

Founders and engineers from the Atech team, including ex-Apple engineers, covering embedded hardware, AI firmware generation and product.

#### Contacts

- **Main contact:** Gustav Hugod, CCO, <gustav@atech.dev>
- **Technical contact:** Tomas Harmer, CTO, <tomas@atech.dev>

#### Where we show up

- **X:** @Atech_dev
- **Instagram:** @atech_development
- **LinkedIn:** /company/atech-dev
- **TikTok:** @atech.dev
- **YouTube:** @Atech_development

Company Info

#### Atech

Website: <a href="https://atech.dev/" class="inline-flex items-center gap-1" rel="noopener noreferrer" style="color:var(--participant-text-primary, #ffffffe6)" target="_blank">https://atech.dev/</a>

#### Judging Criteria

- Real-world validation of usefulness(25%)

  Evidence it's genuinely useful: tested with real users, experts or real-world data

- Real-world impact(25%)

  A real user and a real problem, solved convincingly

- Use of Atech(25%)

  How well and how creatively the hardware and AI platform were used

- Working demo & storytelling(25%)

  It runs live on the hardware in front of the judges, with a clear story and pitch

- BONUS(0%)

  Extra credit for combining several modules, or connecting the device to AI models and external APIs.

#### Prizes

- Best Overall

  The winning team gets a special Pro Atech kit for the team to keep building.

- Runner ups

  Runner-up teams get Atech kits and swag. Top teams are invited to show their project on Atech's channels and visit us in Copenhagen.
