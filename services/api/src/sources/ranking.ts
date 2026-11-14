import { getDomainWithoutSuffix } from 'tldts';
import type { AttributionFrame, Evidence, SourceTraits } from '../../../../packages/contracts/src/index.js';
import type { DomainLists } from './domain-lists.js';
import { hostOf, linkKey } from './evidence.js';

/** At most six pieces of evidence, two per site; free evidence takes at most three when paid results exist. */
export const RANKING = { limit: 6, perSite: 2, maxFreeWithPaid: 3 } as const;

const FREE_ORIGINS = new Set<Evidence['origin']>(['fact_check', 'wikipedia', 'wikidata', 'weather', 'calculation']);
/** Fact checks, Wikipedia, Wikidata, Open-Meteo and the calculation; Exa results are `web`, `news` or older without an origin. */
export const isFreeEvidence = (evidence: Evidence) => FREE_ORIGINS.has(evidence.origin);

/** The site that counts as one voice: `calculation`, `open-meteo.com`, else the list entry or registrable domain. */
export function evidenceSite(evidence: Evidence, lists: DomainLists): string {
  if (evidence.origin === 'calculation') return 'calculation';
  if (evidence.origin === 'weather') return 'open-meteo.com';
  const host = hostOf(evidence.url);
  return host ? lists.siteKey(host) : evidence.sourceGroup;
}

const letters = (text: string) => text.toLocaleLowerCase('en').normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Whether the evidence is on the named source's own site: the source's name, letters only, equals or sits
 * inside the site's registrable label, and has at least four letters (NASA and nasa.gov, Politico and politico.com).
 */
export function isOwnSite(evidence: Evidence, source: string): boolean {
  const name = letters(source);
  const host = hostOf(evidence.url);
  if (name.length < 4 || !host) return false;
  const label = letters(getDomainWithoutSuffix(host, { allowPrivateDomains: true }) ?? '');
  return label.length > 0 && (label === name || label.includes(name));
}

/**
 * Policy traits of one piece of evidence. Trusted: every free source, the trusted domains, and for an
 * attributed claim a news report or the named source's own site (one news report or the speaker's own
 * site settles whether they said it).
 */
export function sourceTraits(evidence: Evidence, attribution: AttributionFrame | null, lists: DomainLists): SourceTraits {
  const host = hostOf(evidence.url);
  const trusted = isFreeEvidence(evidence) || (host !== '' && lists.isTrusted(host))
    || (attribution !== null && (evidence.origin === 'news' || isOwnSite(evidence, attribution.source)));
  return { site: evidenceSite(evidence, lists), trusted };
}

/** Free sources and trusted domains rank first. Attribution trust is a policy trait and does not reorder evidence. */
const rankedTrusted = (evidence: Evidence, lists: DomainLists) => {
  const host = hostOf(evidence.url);
  return isFreeEvidence(evidence) || (host !== '' && lists.isTrusted(host));
};

const published = (evidence: Evidence) => {
  const time = evidence.publishedAt ? Date.parse(evidence.publishedAt.length === 10 ? `${evidence.publishedAt}T00:00:00Z` : evidence.publishedAt) : NaN;
  return Number.isNaN(time) ? -Infinity : time;
};

/** Newest first, undated last; the sort is stable, so equal dates keep their order. */
const newestFirst = (items: Evidence[]) => [...items].sort((a, b) => published(b) - published(a));

/** Drops blocked sites and evidence without a usable host, and duplicate pages (free evidence first). */
function usable(free: Evidence[], paid: Evidence[], lists: DomainLists): Evidence[] {
  const seen = new Set<string>();
  const kept: Evidence[] = [];
  for (const item of [...free, ...paid]) {
    const host = hostOf(item.url);
    if (!host || lists.isBlocked(host)) continue;
    const key = isFreeEvidence(item) && (item.origin === 'calculation' || item.origin === 'weather') ? `${item.origin}\n${item.url}` : linkKey(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }
  return kept;
}

/**
 * Port of the reference app's EvidenceRanking.pick: drop blocked and duplicate evidence, put trusted sources
 * first (free ones leading) and the rest in search order, at most two per site and six in all. When paid
 * results exist, free evidence takes at most three slots in a first pass and the slots paid results leave
 * in a second. For a claim about the future, newer evidence leads within each trust tier.
 */
export function rankEvidence(free: Evidence[], paid: Evidence[], lists: DomainLists, future = false): Evidence[] {
  const kept = usable(free, paid, lists);
  let trusted = kept.filter(item => rankedTrusted(item, lists));
  let rest = kept.filter(item => !rankedTrusted(item, lists));
  if (future) { trusted = newestFirst(trusted); rest = newestFirst(rest); }
  const ordered = [...trusted, ...rest];
  const maxFree = kept.some(item => !isFreeEvidence(item)) ? RANKING.maxFreeWithPaid : null;
  const perSite = new Map<string, number>();
  const picked = new Set<number>();
  let freeTaken = 0;
  for (let pass = 0; pass < (maxFree === null ? 1 : 2); pass++) {
    for (const [index, item] of ordered.entries()) {
      if (picked.size >= RANKING.limit) break;
      if (picked.has(index)) continue;
      const isFree = isFreeEvidence(item);
      if (pass === 0 && isFree && maxFree !== null && freeTaken >= maxFree) continue;
      const site = evidenceSite(item, lists);
      if ((perSite.get(site) ?? 0) >= RANKING.perSite) continue;
      perSite.set(site, (perSite.get(site) ?? 0) + 1);
      if (isFree) freeTaken++;
      picked.add(index);
    }
  }
  return [...picked].sort((a, b) => a - b).map(index => ordered[index]);
}

/** How many results a search returned that ranking would keep (the news search's "usable" count). */
export const usableCount = (paid: Evidence[], lists: DomainLists) => rankEvidence([], paid, lists).length;
