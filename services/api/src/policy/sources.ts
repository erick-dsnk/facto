import { getDomain } from 'tldts';
import type { Evidence } from '../../../../packages/contracts/src/index.js';

/** A deliberately small, auditable source rubric. Entries are scoped to a fact,
 * not a general endorsement of everything a publisher says. Expand after review. */
export const SOURCE_REGISTRY = [
  {
    host: 'weather.gov', path: '/safety/lightning-myths',
    claim: /\blightning\b.*\b(strik\w*|hit\w*)\b.*\b(same|twice)\b/i,
    rationale: 'The US National Weather Service directly documents lightning behavior.',
  },
  {
    host: 'science.nasa.gov', path: '/earth/facts',
    claim: /\bearth\b.*\b(flat|round|sphere|spherical|planet)\b/i,
    rationale: 'NASA Earth facts describe observed physical properties of Earth.',
  },
] as const;

export function safeSourceURL(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

export function isDirectEvidence(evidence: Evidence): boolean {
  return safeSourceURL(evidence.url) !== null && evidence.excerpt.trim().length > 0
    && evidence.directlyAddressesClaim && evidence.matchesTimePlaceAndPopulation
    && evidence.stance !== 'unrelated' && evidence.stanceProbability !== null
    && Number.isFinite(evidence.stanceProbability) && evidence.stanceProbability >= 0.8 && evidence.stanceProbability <= 1;
}

export function isAuthoritativeForClaim(evidence: Evidence, checkedText?: string): boolean {
  if (!checkedText || !isDirectEvidence(evidence)) return false;
  const url = safeSourceURL(evidence.url);
  return url !== null && SOURCE_REGISTRY.some(rule => {
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\/$/, '');
    return host === rule.host && path === rule.path && rule.claim.test(checkedText);
  });
}

const normalizedExcerpt = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (value: string) => new Set(normalizedExcerpt(value).split(' ').filter(Boolean));

function copiedPassage(a: Evidence, b: Evidence): boolean {
  const left = normalizedExcerpt(a.excerpt), right = normalizedExcerpt(b.excerpt);
  if (left === right) return true;
  const leftWords = words(left), rightWords = words(right);
  if (Math.min(leftWords.size, rightWords.size) < 8) return false;
  const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
  return overlap / Math.min(leftWords.size, rightWords.size) >= 0.85;
}

function sameFamily(a: Evidence, b: Evidence): boolean {
  const left = safeSourceURL(a.url), right = safeSourceURL(b.url);
  if (!left || !right) return true;
  const domain = (url: URL) => getDomain(url.hostname, { allowPrivateDomains: true }) ?? url.hostname;
  return domain(left) === domain(right)
    || a.sourceGroup === b.sourceGroup
    || (a.echoGroup !== null && a.echoGroup === b.echoGroup)
    || (a.publisher !== null && b.publisher !== null && a.publisher.trim().toLowerCase() === b.publisher.trim().toLowerCase())
    || copiedPassage(a, b);
}

/** Connected families make syndicated chains count once even across domains. */
export function independentSourceCount(evidence: Evidence[]): number {
  const groups = evidence.map((_, index) => index);
  const root = (index: number): number => groups[index] === index ? index : root(groups[index]);
  for (let a = 0; a < evidence.length; a++) {
    for (let b = a + 1; b < evidence.length; b++) {
      if (sameFamily(evidence[a], evidence[b])) groups[root(b)] = root(a);
    }
  }
  return new Set(groups.map((_, index) => root(index))).size;
}

export function qualifyingSources(evidence: Evidence[], checkedText?: string): boolean {
  const direct = evidence.filter(isDirectEvidence);
  // Health/safety/performance assertions always require independent corroboration.
  const strongerCorroboration = checkedText !== undefined && /\b(cure|treat|prevent|safe|risk|disease|health|performance|effective|cancer|virus|medicine)\w*\b/i.test(checkedText);
  return independentSourceCount(direct) >= 2
    || (!strongerCorroboration && direct.some(source => isAuthoritativeForClaim(source, checkedText)));
}
