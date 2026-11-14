import { getDomain } from 'tldts';
import { PipelineError, type Evidence, type Judgment } from '../../../../packages/contracts/src/index.js';
import { groupEchoes, mergeRetainedEvidence, normalizeUrl } from '../evidence/normalize.js';
import { ASSESSMENT_THRESHOLD, readAssessment } from '../policy/assessment.js';
import { independentSourceCount, isDirectEvidence } from '../policy/sources.js';

/** Identity of the quoted material assessed by the first judgment. Retrieval
 * timestamps and semantic annotations cannot make changed material eligible. */
const material = (record: Evidence) => JSON.stringify([record.id, normalizeUrl(record.url), record.title, record.publisher,
  record.publishedAt, record.contentBasis, record.excerpt]);

/** Retry scheduling, not a verdict rule: retain up to two assessed old witnesses
 * and leave the other slots available to incoming evidence. Up to twelve inputs
 * still become at most six records; not every possible contrary passage can be
 * guaranteed a judgment within that bound. All semantic assessments must be
 * recomputed by the caller after selection. */
export function retainAlternateEvidence(existing: Evidence[], incoming: Evidence[], checkedText: string, judgment: Judgment): Evidence[] {
  if (existing.length > 6 || incoming.length > 6) throw new PipelineError('malformed_evidence');
  const assessment = readAssessment(judgment);
  const byId = new Map<string, Evidence>();
  const byUrl = new Map<string, string>();
  function canonicalize(records: Evidence[]): Evidence[] {
    const withinPass = new Map<string, Evidence>();
    for (const record of records) {
      const url = normalizeUrl(record.url);
      const domain = url ? getDomain(new URL(url).hostname, { allowPrivateDomains: true }) : null;
      if (!url || !domain) throw new PipelineError('malformed_evidence');
      const previous = byId.get(record.id);
      if ((previous && previous.url !== url) || (byUrl.has(url) && byUrl.get(url) !== record.id)) throw new PipelineError('invalid_citation');
      const canonical = { ...record, url, sourceGroup: domain };
      if (withinPass.has(record.id) && material(withinPass.get(record.id)!) !== material(canonical)) throw new PipelineError('invalid_citation');
      withinPass.set(record.id, canonical); byId.set(record.id, canonical); byUrl.set(url, record.id);
    }
    return [...withinPass.values()];
  }
  const original = canonicalize(existing);
  const additions = canonicalize(incoming);
  if (additions.every(record => original.some(previous => material(previous) === material(record)))) return original;
  // A later passage for the same URL replaces its old version. In particular,
  // the old stance/content assessment never attaches to a changed excerpt.
  const pool = groupEchoes([...byId.values()]);
  const candidates = new Map(pool.map(record => [record.id, record]));
  const originalById = new Map(original.map(record => [record.id, record]));
  const unchanged = new Set(original.filter(record => material(record) === material(candidates.get(record.id)!)).map(record => record.id));
  const judged = new Map(judgment.evidence.filter(record => unchanged.has(record.id)
    && material(record) === material(candidates.get(record.id)!)).map(record => [record.id, record]));
  const substantive = (id: string) => {
    if (!assessment || !Object.hasOwn(assessment.sourceAssessments, id)) return false;
    const source = assessment.sourceAssessments[id];
    return source.confidence >= ASSESSMENT_THRESHOLD && ['original_record', 'attributable_research', 'substantive_secondary'].includes(source.contentBasis);
  };
  const rank = (records: Evidence[]) => mergeRetainedEvidence([], records, checkedText).map(record => candidates.get(record.id)!);
  const rankedOld = rank(original.map(record => candidates.get(record.id)!));
  const directOld = rankedOld.filter(record => judged.has(record.id) && isDirectEvidence(judged.get(record.id)!));
  // Known dependence remains conservative selection context even when a quoted
  // window changes. It cannot confer positive semantic scores on the new text,
  // and none of these model-origin answers is stamped onto the next judgment.
  const origins = assessment?.originAssessments ?? [];
  const familyMap = () => {
    // Copy detection has its own conservative threshold. Run it over every
    // prior/current text version before projecting dependence back to IDs;
    // comparing current candidates alone would lose a changed copy bridge.
    // This pool has at most twelve versions and never supplies output fields.
    const versionsById = new Map<string, Evidence[]>();
    for (const version of groupEchoes([...original, ...additions])) {
      versionsById.set(version.id, [...(versionsById.get(version.id) ?? []), version]);
    }
    const families = pool.map((_, index) => index);
    const root = (index: number): number => families[index] === index ? index : root(families[index]);
    for (let left = 0; left < pool.length; left++) {
      for (let right = left + 1; right < pool.length; right++) {
        const previousLeft = originalById.get(pool[left].id), previousRight = originalById.get(pool[right].id);
        const linkedVersions = versionsById.get(pool[left].id)!.some(leftVersion => versionsById.get(pool[right].id)!
          .some(rightVersion => independentSourceCount([leftVersion, rightVersion]) === 1));
        if (linkedVersions
          || (previousLeft && previousRight && independentSourceCount([previousLeft, previousRight], origins) === 1)) families[root(right)] = root(left);
      }
    }
    return new Map(pool.map((record, index) => [record.id, root(index)]));
  };
  const family = familyMap();
  const freshFamilies = new Set(additions.filter(record => !originalById.has(record.id) || !unchanged.has(record.id)).map(record => family.get(record.id)!));
  // Fresh family material gets a slot before an unchanged old witness;
  // otherwise a positive sibling could hide the new contrary passage.
  const usefulOld = directOld.filter(record => substantive(record.id) && !freshFamilies.has(family.get(record.id)!));
  const protectedOld: Evidence[] = [];
  const supports = directOld.filter(record => judged.get(record.id)!.stance === 'supports');
  const contradicts = directOld.filter(record => judged.get(record.id)!.stance === 'contradicts');
  if (supports.length && contradicts.length) {
    // The existing conflict veto also covers direct bare assertions. Preserve
    // one witness on either side, preferring substance within each stance.
    for (const side of [supports, contradicts]) protectedOld.push(side.find(record => substantive(record.id)) ?? side[0]);
    const [support, contradiction] = protectedOld;
    if (family.get(support.id) === family.get(contradiction.id)
      && independentSourceCount([support, contradiction]) !== 1) {
      // A model-assessed origin bridge cannot be stamped onto new raw evidence.
      // Keep the initial conflict abstention when bounded representatives would
      // erase that bridge; do not freeze its old origin answers into a new verdict.
      return original;
    }
  } else {
    for (const record of usefulOld) {
      if (protectedOld.some(previous => family.get(previous.id) === family.get(record.id))) continue;
      protectedOld.push(record);
      if (protectedOld.length === 2) break;
    }
  }

  const selected: Evidence[] = [];
  const perDomain = new Map<string, number>();
  const seen = new Set<string>();
  const oldFamilies = new Set<number>();
  // A recurring unchanged result is still old material. It must not consume a
  // family's first slot ahead of a changed window or a genuinely new sibling.
  const fresh = rank(additions.filter(record => !unchanged.has(record.id)));
  const recurring = rank(additions.filter(record => unchanged.has(record.id)));
  for (const record of [...protectedOld, ...fresh, ...recurring, ...rankedOld]) {
    if (seen.has(record.id) || (perDomain.get(record.sourceGroup) ?? 0) >= 2) continue;
    if (originalById.has(record.id) && oldFamilies.has(family.get(record.id)!) && !protectedOld.includes(record)) continue;
    const relatives = selected.filter(previous => family.get(previous.id) === family.get(record.id));
    // This also covers genuinely new incoming records. A dependence path through
    // an omitted publisher/origin bridge cannot turn into two independent sources.
    // Multiple records remain possible when their dependence is visible in the
    // actually retained raw fields (for example shared full-pool echo identities).
    if (relatives.length && independentSourceCount([...relatives, record]) !== 1) continue;
    selected.push(record); seen.add(record.id);
    if (originalById.has(record.id)) oldFamilies.add(family.get(record.id)!);
    perDomain.set(record.sourceGroup, (perDomain.get(record.sourceGroup) ?? 0) + 1);
    if (selected.length === 6) break;
  }
  // Preserve deterministic full-pool echo identities. Recomputing them after
  // truncation could discard a bridge and falsely split one copying family.
  return selected;
}
