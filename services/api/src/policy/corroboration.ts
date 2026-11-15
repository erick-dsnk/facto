import type { Evidence, Verdict } from '../../../../packages/contracts/src/index.js';
import type { SourceCounts, SourceTally } from './source-tally.js';
import { RULES } from './verdict-rules.js';

/** Ported from the reference app's Corroboration.swift: one more search before giving up, only in the case a second
 * source would settle. Jev reads the claim as true, sure enough for True, and exactly one site that isn't trusted
 * backs it while none contradicts it. */
export function corroborationNeeded(label: Verdict, joint: Verdict, probabilities: Record<Verdict, number>, counts: SourceCounts): boolean {
  return label === 'insufficient_evidence' && joint === 'supported' && probabilities.supported >= RULES.minProbabilityTrue
    && counts.supporting === 1 && counts.contradicting === 0 && counts.trustedSupporting === 0 && counts.trustedContradicting === 0;
}

/** Site keys that already back the claim, kept out of the corroboration search. */
export function supportingSites(tally: SourceTally): string[] {
  return [...new Set(tally.sources.filter(source => source.stance === 'supports').map(source => source.site))].sort();
}

/** At most this many new passages join from a corroboration search (the reference app's corroborationResults). */
export const CORROBORATION_RESULTS = 3;

const linkKey = (url: string) => url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '');

/**
 * Evidence for the corroborating judgment: what already took a side first (so the one supporting site still
 * counts), then new passages that are not a page already judged and not from a site already backing the claim,
 * one per site and at most CORROBORATION_RESULTS, then the rest of the earlier evidence. Empty when nothing new
 * arrived, so no second judgment is spent.
 */
export function mergeCorroboration(judged: Evidence[], incoming: Evidence[], excludeSites: readonly string[],
  siteOf: (evidence: Evidence) => string, limit = 6): Evidence[] {
  const seen = new Set(judged.flatMap(evidence => [evidence.id, linkKey(evidence.url)]));
  const excluded = new Set(excludeSites);
  const fresh: Evidence[] = [];
  const freshSites = new Set<string>();
  for (const evidence of incoming) {
    const site = siteOf(evidence);
    if (seen.has(evidence.id) || seen.has(linkKey(evidence.url)) || excluded.has(site) || freshSites.has(site)) continue;
    fresh.push(evidence); freshSites.add(site);
    if (fresh.length >= CORROBORATION_RESULTS) break;
  }
  if (!fresh.length) return [];
  const sided = judged.filter(evidence => evidence.stance !== 'unrelated' && (evidence.stanceProbability ?? 0) >= RULES.stanceMinProbability);
  const rest = judged.filter(evidence => !sided.includes(evidence));
  return [...sided, ...fresh, ...rest].slice(0, limit);
}
