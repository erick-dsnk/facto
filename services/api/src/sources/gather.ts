import {
  PipelineError, sourceQueryText, type Evidence, type FreeEvidence, type FreeSourceName, type ProviderContext, type SourceQuery,
} from '../../../../packages/contracts/src/index.js';
import { calculationEvidence } from '../providers/calculation/calculation.js';
import { matchFactChecks } from '../providers/googlefactcheck/match.js';
import { passageTerms } from '../providers/wikipedia/passages.js';
import { wikipediaEvidence } from '../providers/wikipedia/client.js';
import type { SourceDeps } from './index.js';

/** The free sources together get 1.5 s; a check never waits longer on them. */
export const FREE_DEADLINE_MS = 1_500;

type FreeTask = { name: FreeSourceName; run(context: ProviderContext): Promise<Evidence[]> };
/** Evidence order within the free set: fact checks, then the special sources, then Wikipedia (as in the reference app). */
const ORDER: FreeSourceName[] = ['fact_check', 'calculation', 'wikidata', 'weather', 'wikipedia'];

/**
 * The free sources that apply to a claim: the calculation always runs (on the server, no network); a claim
 * routed as a calculation that it settles asks nothing else. A weather claim with a readable place and date asks Open-Meteo; any other
 * claim asks the fact checks (with a key), Wikipedia, and Wikidata for a fact about a named thing.
 */
function freeTasks(deps: SourceDeps, query: SourceQuery, now: () => number): FreeTask[] {
  const text = sourceQueryText(query);
  if (query.route === 'weather' && deps.weather) {
    const weather = deps.weather;
    let asked;
    try { asked = weather.query(text, query.asOf); }
    catch (error) { return [{ name: 'weather', run: async () => { throw error; } }]; }
    if (asked) return [{ name: 'weather', run: context => weather.evidence(asked, context, query.claimId) }];
  }
  const tasks: FreeTask[] = [];
  const { factChecks, encyclopedia, wikidata } = deps;
  if (factChecks) tasks.push({ name: 'fact_check', run: async context => matchFactChecks(await factChecks.reviews(text, context, query.claimId), query, deps.jev, context) });
  if (encyclopedia) {
    tasks.push({ name: 'wikipedia', run: async context =>
      wikipediaEvidence(await encyclopedia.pages(text, context, query.claimId), passageTerms(query.text, query.subject), new Date(now()).toISOString()) });
  }
  if (query.route === 'named_fact' && wikidata) {
    tasks.push({ name: 'wikidata', run: context => wikidata.evidence({ claimId: query.claimId, text: query.text, subject: query.subject }, context) });
  }
  return tasks;
}

/**
 * The applicable free sources in parallel, stopped hard at `freeDeadlineMs` (1.5 s) or the check's deadline,
 * whichever is first. Each source is wrapped, so one failure or hang never blocks the rest: it reads as
 * `answered: false`, never as "nothing found". Sources see only the SourceQuery (checked text and subject).
 */
export async function gatherFree(deps: SourceDeps, query: SourceQuery, context: ProviderContext): Promise<FreeEvidence> {
  context.signal.throwIfAborted();
  const now = deps.now ?? (() => context.now());
  const answered: FreeEvidence['answered'] = { fact_check: null, wikipedia: null, wikidata: null, weather: null, calculation: null };
  const found = new Map<FreeSourceName, Evidence[]>();
  let calculated = null;
  try {
    calculated = calculationEvidence(query.text, new Date(now()), new Date(now()).toISOString());
    answered.calculation = true;
  } catch { answered.calculation = false; }
  if (calculated) found.set('calculation', [calculated]);
  // Only a calculation claim stops at the calculation; any other claim that happens to parse as one still asks the rest.
  const tasks = calculated && query.route === 'calculation' ? [] : freeTasks(deps, query, now);

  if (tasks.length) {
    const controller = new AbortController();
    let closed = false;
    let stop: () => void = () => undefined;
    const stopped = new Promise<void>(resolve => { stop = resolve; });
    const onParentAbort = () => { controller.abort(context.signal.reason); stop(); };
    context.signal.addEventListener('abort', onParentAbort, { once: true });
    const deadlineAt = Math.min(context.now() + (deps.freeDeadlineMs ?? FREE_DEADLINE_MS), context.deadlineAt ?? Infinity);
    const timer = setTimeout(stop, Math.max(0, deadlineAt - context.now()));
    const child: ProviderContext = {
      signal: controller.signal, deadlineAt, now: () => context.now(),
      consume: (kind, claimId) => {
        if (controller.signal.aborted || context.now() >= deadlineAt) throw new PipelineError('timeout');
        context.consume(kind, claimId);
      },
      canConsume: (kind, claimId) => !controller.signal.aborted && context.now() < deadlineAt && (context.canConsume?.(kind, claimId) ?? true),
      recordUsage: usage => context.recordUsage?.(usage),
    };
    const settled = Promise.all(tasks.map(async task => {
      try {
        const evidence = await task.run(child);
        if (closed) return;
        found.set(task.name, evidence);
        answered[task.name] = true;
      } catch {
        if (!closed) answered[task.name] = false;
      }
    }));
    try {
      await Promise.race([settled, stopped]);
    } finally {
      closed = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', onParentAbort);
      controller.abort(new PipelineError('free_sources_timeout'));
    }
    context.signal.throwIfAborted();
    // A source still running when time ran out did not answer.
    for (const task of tasks) if (answered[task.name] === null) answered[task.name] = false;
  }
  return { evidence: ORDER.flatMap(name => found.get(name) ?? []), answered };
}
