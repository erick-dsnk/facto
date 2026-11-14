import { getDomain } from 'tldts';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import { ASSESSMENT_THRESHOLD, type JudgmentAssessment, type OriginAssessment } from './assessment.js';

export type ReviewedSourceRule = { host: string; path: string; claim: RegExp; rationale: string; expertForHighRisk?: boolean };

/** A deliberately small, auditable source rubric. Entries are scoped to a fact,
 * not a general endorsement of everything a publisher says. Expand after review. */
export const SOURCE_REGISTRY: readonly ReviewedSourceRule[] = [
  {
    host: 'weather.gov', path: '/safety/lightning-myths',
    claim: /^Lightning (?:(?:can|cannot|does not) strike|never strikes) (?:the )?same place (?:twice|more than once)\.?$/i,
    rationale: 'Reviewed 2026-11-14: NWS lightning-myths page directly addresses repeated strikes; the NWS weather-hazard mandate supports only this bounded recurrence capability, not medical care, shelter or local alerts. See fixtures/verdicts/source-capability-proposal.md.',
    expertForHighRisk: true,
  },
  {
    host: 'nhs.uk', path: '/conditions/asthma',
    claim: /^Asthma (?:(?:can|cannot|does not) cause|never causes) (?:wheezing|coughing|shortness of breath|chest tightness)\.?$/i,
    rationale: 'Reviewed 2026-11-14: NHS asthma page lists these possible symptoms; the NHS content policy requires clinical approval and evidence-based information. Limited to general symptom possibilities, not individual diagnosis, therapy or guaranteed outcomes. See fixtures/verdicts/source-capability-proposal.md.',
    expertForHighRisk: true,
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

export function isAuthoritativeForClaim(evidence: Evidence, checkedText?: string, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY, expertOnly = false): boolean {
  if (!checkedText || !isDirectEvidence(evidence)) return false;
  const url = safeSourceURL(evidence.url);
  return url !== null && registry.some(rule => {
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\/$/, '');
    return host === rule.host && path === rule.path && (!expertOnly || rule.expertForHighRisk === true)
      && new RegExp(rule.claim.source, rule.claim.flags.replace(/[gy]/g, '')).test(checkedText);
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
  const publisher = a.publisher?.trim().toLowerCase();
  return domain(left) === domain(right)
    || a.sourceGroup === b.sourceGroup
    || (a.echoGroup !== null && a.echoGroup === b.echoGroup)
    || (Boolean(publisher) && publisher === b.publisher?.trim().toLowerCase())
    || copiedPassage(a, b);
}

/** Connected families make syndicated chains count once even across domains. */
function sourceFamilies(evidence: Evidence[], origins: OriginAssessment[] = []): Map<string, number> {
  const groups = evidence.map((_, index) => index);
  const root = (index: number): number => groups[index] === index ? index : root(groups[index]);
  for (let a = 0; a < evidence.length; a++) {
    for (let b = a + 1; b < evidence.length; b++) {
      if (sameFamily(evidence[a], evidence[b]) || origins.some(pair => pair.relationship === 'common_origin'
        && pair.confidence >= ASSESSMENT_THRESHOLD && pair.evidenceIds.includes(evidence[a].id) && pair.evidenceIds.includes(evidence[b].id))) groups[root(b)] = root(a);
    }
  }
  return new Map(evidence.map((source, index) => [source.id, root(index)]));
}

export function independentSourceCount(evidence: Evidence[], origins: OriginAssessment[] = []): number {
  return new Set(sourceFamilies(evidence, origins).values()).size;
}

// Typed risk assessment supplements these fail-safe triggers. Absence of a
// trigger never overrides a disputed, health/safety or uncertain assessment.
// Do not turn "treaty", an "effective date", CPU performance or financial risk
// into a medical assertion through broad prefix matching. The typed assessment
// still escalates safety implications that these bounded lexical rules miss.
const highRiskLanguage = /\b(cure[sd]?|curing|treat(?:s|ed|ing|ments?)?|prevent(?:s|ed|ing|ion)?|disease\w*|health\w*|cancer\w*|asthma|virus(?:es)?|medicin\w*|medical|pregnan\w*|vaccin\w*|toxic\w*|poison\w*|bleach|vinegar|ammonia|dos(?:e|es|age)|suicid\w*|overdos\w*|flammab\w*|explosiv\w*)\b|\b(athletic|physical|cognitive|cardiac|immune|lung|brain|bodily|clinical)\s+(performance|effectiveness|benefits?|risks?|safety)\b/i;
const substantive = (assessment: JudgmentAssessment, id: string): boolean => {
  if (!Object.hasOwn(assessment.sourceAssessments, id)) return false;
  const source = assessment.sourceAssessments[id];
  return source !== undefined && source.confidence >= ASSESSMENT_THRESHOLD
    && ['original_record', 'attributable_research', 'substantive_secondary'].includes(source.contentBasis);
};

/** Return the full qualifying set so both corroborators stay in the citation record.
 * Distinct domains + assessed substance are an open-world ordinary-claim rubric,
 * not independently verified provenance. High-risk pairs need disclosed distinct
 * underlying origins as well as an independently reviewed expert anchor. */
export function qualifyingSourceSet(evidence: Evidence[], checkedText: string | undefined, assessment: JudgmentAssessment | undefined, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY, retainedEvidence: Evidence[] = evidence): Evidence[] {
  if (!assessment || !checkedText) return [];
  const direct = evidence.filter(isDirectEvidence);
  const families = sourceFamilies(retainedEvidence, assessment.originAssessments);
  const strong = assessment.claimRisk.level !== 'ordinary' || assessment.claimRisk.confidence < ASSESSMENT_THRESHOLD || highRiskLanguage.test(checkedText);
  if (!strong) {
    // A developed descriptive reference account need not name an underlying
    // primary record for ordinary facts. It still needs corroboration; the new
    // category never inherits a registry's single-source authority exception.
    const assessed = direct.filter(source => substantive(assessment, source.id)
      || (Object.hasOwn(assessment.sourceAssessments, source.id)
        && assessment.sourceAssessments[source.id].contentBasis === 'ordinary_reference'
        && assessment.sourceAssessments[source.id].confidence >= ASSESSMENT_THRESHOLD));
    if (assessed.some(source => substantive(assessment, source.id) && isAuthoritativeForClaim(source, checkedText, registry))) return assessed;
    return new Set(assessed.map(source => families.get(source.id))).size >= 2 ? assessed : [];
  }
  const assessed = direct.filter(source => substantive(assessment, source.id));
  // Include all retained passages in the dependence graph, even a low-quality
  // intermediate passage can disclose that otherwise distinct articles echo it.
  const qualified = new Set<Evidence>();
  for (const anchor of assessed.filter(source => isAuthoritativeForClaim(source, checkedText, registry, true))) {
    for (const corroborator of assessed) {
      if (anchor.id === corroborator.id || families.get(anchor.id) === families.get(corroborator.id)) continue;
      const distinct = assessment.originAssessments.some(pair => pair.relationship === 'distinct_origins'
        && pair.confidence >= ASSESSMENT_THRESHOLD && pair.evidenceIds.includes(anchor.id) && pair.evidenceIds.includes(corroborator.id));
      // Check the full graph: an intermediate same-origin passage can connect
      // these two even if their own pair assessment claims distinct origins.
      if (distinct) { qualified.add(anchor); qualified.add(corroborator); }
    }
  }
  return [...qualified];
}

export function qualifyingSources(evidence: Evidence[], checkedText?: string, assessment?: JudgmentAssessment, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY): boolean {
  return qualifyingSourceSet(evidence, checkedText, assessment, registry).length > 0;
}
