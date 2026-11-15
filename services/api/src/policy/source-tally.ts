import type { Evidence, SourceTraits } from '../../../../packages/contracts/src/index.js';

/** Ported from the reference app's SourceStance.swift. Jev only says what each passage says;
 * sites, echoes and counting are decided here, in code. */
export const TALLY_DEFAULTS = { stanceMinProbability: 0.6, echoOverlap: 0.6, echoMinTrigrams: 3 } as const;

/** One passage as Jev judged it, read on its own. */
export type StanceJudgment = { evidenceId: string; text: string; stance: Evidence['stance']; probability: number };
export type SourceCounts = { supporting: number; contradicting: number; notAddressing: number; trustedSupporting: number; trustedContradicting: number };
export type TalliedSource = { evidenceId: string; site: string; trusted: boolean; echo: boolean; stance: Evidence['stance']; probability: number };
export type SourceTally = {
  /** Every judgment as counted: a stance under the minimum probability counts as not addressing. */
  sources: TalliedSource[];
  counts: SourceCounts;
  /** Supporting and contradicting sites that are not echoes. */
  plainSupporting: number; plainContradicting: number;
  /** Matched fact checks rated misleading, in evidence order. */
  ratedMisleading: string[];
};

/** Lowercased words of letters and digits, as the reference app splits them. */
const words = (text: string): string[] => text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export function trigrams(text: string): Set<string> {
  const list = words(text);
  if (list.length < 3) return new Set();
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= list.length; i++) grams.add(list.slice(i, i + 3).join(' '));
  return grams;
}

/** Shared trigrams over the smaller set's size, so a snippet cut short still counts as a copy. */
export function overlap(a: Set<string>, b: Set<string>): number {
  const smaller = Math.min(a.size, b.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / smaller;
}

/** Indices of `texts` that repeat the claim instead of testing it: a near-copy of the claim, or the same text on
 * another site. Trusted text is never an echo: a reference work stating a fact in the claim's words still checked it. */
export function findEchoes(claim: string, texts: string[], sites: string[], trusted: boolean[], threshold: number = TALLY_DEFAULTS.echoOverlap): Set<number> {
  const claimGrams = trigrams(claim);
  const grams = texts.map(trigrams);
  const echoes = new Set<number>();
  for (let i = 0; i < texts.length; i++) {
    if (trusted[i]) continue;
    if (claimGrams.size >= TALLY_DEFAULTS.echoMinTrigrams && overlap(claimGrams, grams[i]) >= threshold) { echoes.add(i); continue; }
    for (let j = 0; j < texts.length; j++) {
      if (j === i || sites[j] === sites[i]) continue;
      if (grams[i].size >= TALLY_DEFAULTS.echoMinTrigrams && overlap(grams[i], grams[j]) >= threshold) { echoes.add(i); break; }
    }
  }
  return echoes;
}

/** Sites joined by a common-origin pair count as one site: the first member's site names the group. */
function mergedSites(judgments: StanceJudgment[], sites: string[], pairs: [string, string][]): string[] {
  const parent = sites.map((_, index) => index);
  const root = (index: number): number => parent[index] === index ? index : (parent[index] = root(parent[index]));
  const indexOf = new Map<string, number[]>();
  judgments.forEach((judgment, index) => indexOf.set(judgment.evidenceId, [...(indexOf.get(judgment.evidenceId) ?? []), index]));
  for (const [left, right] of pairs) {
    for (const a of indexOf.get(left) ?? []) for (const b of indexOf.get(right) ?? []) {
      const [ra, rb] = [root(a), root(b)];
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    }
  }
  return sites.map((_, index) => sites[root(index)]);
}

/** Jev's stance answers turned into counted voices: one voice per site (the side its surest judgment takes),
 * all echoes on one side as one voice, and a stance under `minProbability` as not addressing. */
export function tallySources(judgments: StanceJudgment[], traits: SourceTraits[], claimText: string,
  options: { ratedMisleading?: string[]; commonOrigins?: [string, string][]; minProbability?: number } = {}): SourceTally {
  if (traits.length !== judgments.length) throw new RangeError('Each judgment needs its source traits');
  const minProbability = options.minProbability ?? TALLY_DEFAULTS.stanceMinProbability;
  const sites = mergedSites(judgments, traits.map(trait => trait.site), options.commonOrigins ?? []);
  const trusted = traits.map(trait => trait.trusted);
  const echoes = findEchoes(claimText, judgments.map(judgment => judgment.text), sites, trusted);
  const sources: TalliedSource[] = judgments.map((judgment, index) => ({
    evidenceId: judgment.evidenceId, site: sites[index], trusted: trusted[index], echo: echoes.has(index),
    stance: Number.isFinite(judgment.probability) && judgment.probability >= minProbability ? judgment.stance : 'unrelated',
    probability: Number.isFinite(judgment.probability) ? judgment.probability : 0,
  }));
  const bySite = new Map<string, TalliedSource>();
  for (const source of sources) {
    const known = bySite.get(source.site);
    if (!known) { bySite.set(source.site, source); continue; }
    const side = source.stance !== 'unrelated';
    if (side && (known.stance === 'unrelated' || source.probability > known.probability)) bySite.set(source.site, source);
  }
  const voices = [...bySite.values()];
  const plain = (stance: Evidence['stance']) => voices.filter(voice => voice.stance === stance && !voice.echo).length;
  const echo = (stance: Evidence['stance']) => voices.some(voice => voice.stance === stance && voice.echo) ? 1 : 0;
  const ids = new Set(judgments.map(judgment => judgment.evidenceId));
  const ratedMisleading = [...new Set(options.ratedMisleading ?? [])].filter(id => ids.has(id));
  const plainSupporting = plain('supports'), plainContradicting = plain('contradicts');
  return {
    sources, plainSupporting, plainContradicting, ratedMisleading,
    counts: {
      supporting: plainSupporting + echo('supports'), contradicting: plainContradicting + echo('contradicts'),
      notAddressing: voices.filter(voice => voice.stance === 'unrelated').length,
      trustedSupporting: voices.filter(voice => voice.stance === 'supports' && voice.trusted).length,
      trustedContradicting: voices.filter(voice => voice.stance === 'contradicts' && voice.trusted).length,
    },
  };
}

/** Evidence ids taking `stance`, best first: trusted sites, then non-echoes, then the surer judgment, then evidence order. */
export function rankedByStance(tally: SourceTally, stance: Evidence['stance']): string[] {
  const order = tally.sources.map((source, index) => ({ source, index })).filter(item => item.source.stance === stance).sort((a, b) =>
    Number(b.source.trusted) - Number(a.source.trusted) || Number(a.source.echo) - Number(b.source.echo)
    || b.source.probability - a.source.probability || a.index - b.index);
  return [...new Set(order.map(item => item.source.evidenceId))];
}
