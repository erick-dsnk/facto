import { getDomain } from 'tldts';
import { PipelineError, type Evidence, type Judgment } from '../../../../packages/contracts/src/index.js';
import { groupEchoes, mergeRetainedEvidence, normalizeUrl } from '../evidence/normalize.js';
import { ASSESSMENT_THRESHOLD, readAssessment } from '../policy/assessment.js';
import { independentSourceCount, isDirectEvidence } from '../policy/sources.js';

/** Identity of the quoted material assessed by the first judgment. Retrieval
 * timestamps and semantic annotations cannot make changed material eligible. */
const material = (record: Evidence) => JSON.stringify([record.id, normalizeUrl(record.url), record.title, record.publisher,
  record.publishedAt, record.contentBasis, record.excerpt]);

export type SelectorInputVersion = {
  readonly key: string; readonly phase: 'original' | 'incoming'; readonly ordinal: number;
  readonly record: Readonly<Evidence>;
  readonly supplied: Readonly<Pick<Evidence, 'url' | 'sourceGroup' | 'echoGroup'>>;
  readonly usedForDependence: boolean; readonly dependenceEchoGroup: string | null;
};
type DependenceReason = 'same_evidence_id' | 'raw_family' | 'prior_original_family';
export type SelectorDependenceLink = {
  readonly leftKey: string; readonly rightKey: string; readonly reasons: readonly DependenceReason[];
};
export type AlternateEvidenceSelection = {
  /** Legacy output remains mutable; snapshot metadata below is detached/frozen. */
  readonly retained: Evidence[];
  readonly retainedVersionKeys: readonly string[];
  readonly inputVersions: readonly SelectorInputVersion[];
  readonly dependenceLinks: readonly SelectorDependenceLink[];
  readonly familyById: readonly Readonly<{ evidenceId: string; family: number }>[];
  readonly priorOriginAssessments: readonly Readonly<{
    evidenceIds: readonly [string, string]; relationship: 'common_origin' | 'distinct_origins' | 'unclear'; confidence: number;
  }>[];
  readonly priorOriginsAreSchedulingOnly: true;
  readonly reason: 'unchanged' | 'conflict_preserved' | 'selected';
  readonly completeness: Readonly<{ boundary: 'normalized_selector_inputs'; upstreamProviderBodiesComplete: false }>;
};

/** Retry scheduling, not a verdict rule: retain up to two assessed old witnesses
 * and leave the other slots available to incoming evidence. Up to twelve inputs
 * still become at most six records; not every possible contrary passage can be
 * guaranteed a judgment within that bound. All semantic assessments must be
 * recomputed by the caller after selection. */
export function retainAlternateEvidence(existing: Evidence[], incoming: Evidence[], checkedText: string, judgment: Judgment): Evidence[] {
  return selectAlternateEvidenceWithContext(existing, incoming, checkedText, judgment).retained;
}

/** Server-only material/dependence context from the selection computation.
 * This is neither source authority nor a completed semantic assessment. */
export function selectAlternateEvidenceWithContext(existing: Evidence[], incoming: Evidence[], checkedText: string, judgment: Judgment): AlternateEvidenceSelection {
  if (existing.length > 6 || incoming.length > 6) throw new PipelineError('malformed_evidence');
  const assessment = readAssessment(judgment);
  const byId = new Map<string, Evidence>();
  const byUrl = new Map<string, string>();
  const versions: { key: string; phase: 'original' | 'incoming'; ordinal: number; record: Evidence;
    supplied: Pick<Evidence, 'url' | 'sourceGroup' | 'echoGroup'>; usedForDependence: boolean; dependenceEchoGroup: string | null }[] = [];
  const latestVersion = new Map<string, string>();
  const candidateVersion = new Map<string, string>();
  const versionKey = (phase: 'original' | 'incoming', id: string) => latestVersion.get(JSON.stringify([phase, id]))!;
  function canonicalize(records: Evidence[], phase: 'original' | 'incoming'): Evidence[] {
    const withinPass = new Map<string, Evidence>();
    for (const [ordinal, record] of records.entries()) {
      const url = normalizeUrl(record.url);
      const domain = url ? getDomain(new URL(url).hostname, { allowPrivateDomains: true }) : null;
      if (!url || !domain) throw new PipelineError('malformed_evidence');
      const previous = byId.get(record.id);
      if ((previous && previous.url !== url) || (byUrl.has(url) && byUrl.get(url) !== record.id)) throw new PipelineError('invalid_citation');
      const canonical = { ...record, url, sourceGroup: domain };
      if (withinPass.has(record.id) && material(withinPass.get(record.id)!) !== material(canonical)) throw new PipelineError('invalid_citation');
      const key = `${phase}:${ordinal}`;
      versions.push({ key, phase, ordinal, record: canonical, supplied: { url: record.url, sourceGroup: record.sourceGroup, echoGroup: record.echoGroup },
        usedForDependence: false, dependenceEchoGroup: null });
      latestVersion.set(JSON.stringify([phase, record.id]), key); candidateVersion.set(record.id, key);
      withinPass.set(record.id, canonical); byId.set(record.id, canonical); byUrl.set(url, record.id);
    }
    return [...withinPass.values()];
  }
  const original = canonicalize(existing, 'original');
  const additions = canonicalize(incoming, 'incoming');
  const originalById = new Map(original.map(record => [record.id, record]));
  const suppliedOriginal = new Map(existing.map(record => [record.id, record]));
  const suppliedIncoming = new Map(incoming.map(record => [record.id, record]));
  const containedFallbacks = new Map<string, Evidence>();
  for (const addition of additions) {
    const previous = originalById.get(addition.id);
    // A shorter indexed highlight cannot supersede the surrounding page text
    // when it is literally contained in that same unchanged source record.
    // Preserve the old retrieval timestamp: this is not a new page fetch.
    // Exact string containment deliberately does no whitespace/Unicode folding.
    if (previous?.contentBasis === 'page_text' && addition.contentBasis === 'highlight'
      && addition.excerpt.length > 0 && previous.excerpt.length > addition.excerpt.length
      && previous.excerpt.includes(addition.excerpt) && previous.url === addition.url
      && previous.title === addition.title && previous.publisher === addition.publisher
      && previous.publishedAt === addition.publishedAt
      && suppliedOriginal.get(addition.id)?.sourceGroup === suppliedIncoming.get(addition.id)?.sourceGroup) {
      byId.set(addition.id, previous);
      candidateVersion.set(addition.id, versionKey('original', addition.id));
      containedFallbacks.set(addition.id, addition);
    }
  }
  // Other later passages replace their old version. Both raw versions below
  // remain dependence evidence even when the richer old quote is selected.
  // Old stance/content assessments never attach to changed material.
  const pool = groupEchoes([...byId.values()]);
  // Known dependence remains conservative selection context even when a quoted
  // window changes. It cannot confer positive semantic scores on the new text,
  // and none of these model-origin answers is stamped onto the next judgment.
  const origins = assessment?.originAssessments ?? [];
  const links = new Map<string, { leftKey: string; rightKey: string; reasons: DependenceReason[] }>();
  const positions = new Map(versions.map((version, index) => [version.key, index]));
  const link = (leftKey: string, rightKey: string, reason: DependenceReason) => {
    if (positions.get(leftKey)! > positions.get(rightKey)!) [leftKey, rightKey] = [rightKey, leftKey];
    const key = JSON.stringify([leftKey, rightKey]);
    const value = links.get(key) ?? { leftKey, rightKey, reasons: [] };
    if (!value.reasons.includes(reason)) value.reasons.push(reason);
    links.set(key, value);
  };
  for (let left = 0; left < versions.length; left++) for (let right = left + 1; right < versions.length; right++) {
    if (versions[left].record.id === versions[right].record.id) link(versions[left].key, versions[right].key, 'same_evidence_id');
  }
  const familyMap = () => {
    // Copy detection has its own conservative threshold. Run it over every
    // prior/current text version before projecting dependence back to IDs;
    // comparing current candidates alone would lose a changed copy bridge.
    // This pool has at most twelve versions and never supplies output fields.
    const versionsById = new Map<string, { key: string; record: Evidence }[]>();
    for (const [index, version] of groupEchoes([...original, ...additions]).entries()) {
      const key = versionKey(index < original.length ? 'original' : 'incoming', version.id);
      const captured = versions[positions.get(key)!];
      captured.usedForDependence = true; captured.dependenceEchoGroup = version.echoGroup;
      versionsById.set(version.id, [...(versionsById.get(version.id) ?? []), { key, record: version }]);
    }
    const families = pool.map((_, index) => index);
    const root = (index: number): number => families[index] === index ? index : root(families[index]);
    for (let left = 0; left < pool.length; left++) {
      for (let right = left + 1; right < pool.length; right++) {
        const previousLeft = originalById.get(pool[left].id), previousRight = originalById.get(pool[right].id);
        let linkedVersions = false;
        for (const leftVersion of versionsById.get(pool[left].id)!) for (const rightVersion of versionsById.get(pool[right].id)!) {
          if (independentSourceCount([leftVersion.record, rightVersion.record]) !== 1) continue;
          linkedVersions = true; link(leftVersion.key, rightVersion.key, 'raw_family');
        }
        const priorLinked = previousLeft && previousRight && independentSourceCount([previousLeft, previousRight], origins) === 1;
        if (priorLinked) link(versionKey('original', previousLeft.id), versionKey('original', previousRight.id), 'prior_original_family');
        if (linkedVersions || priorLinked) families[root(right)] = root(left);
      }
    }
    return new Map(pool.map((record, index) => [record.id, root(index)]));
  };
  const family = familyMap();
  const finish = (retained: Evidence[], retainedVersionKeys: string[], reason: AlternateEvidenceSelection['reason']): AlternateEvidenceSelection => Object.freeze({
    retained, retainedVersionKeys: Object.freeze(retainedVersionKeys), reason,
    inputVersions: Object.freeze(versions.map(version => Object.freeze({ ...version, record: Object.freeze({ ...version.record }), supplied: Object.freeze({ ...version.supplied }) }))),
    dependenceLinks: Object.freeze([...links.values()].map(value => Object.freeze({ ...value, reasons: Object.freeze([...value.reasons]) }))),
    familyById: Object.freeze([...family].map(([evidenceId, family]) => Object.freeze({ evidenceId, family }))),
    priorOriginAssessments: Object.freeze(origins.map(origin => Object.freeze({ ...origin, evidenceIds: Object.freeze([...origin.evidenceIds] as [string, string]) }))),
    priorOriginsAreSchedulingOnly: true,
    completeness: Object.freeze({ boundary: 'normalized_selector_inputs', upstreamProviderBodiesComplete: false }),
  });
  if (additions.every(record => original.some(previous => material(previous) === material(record)))) {
    return finish(original, original.map(record => versionKey('original', record.id)), 'unchanged');
  }
  const candidates = new Map(pool.map(record => [record.id, record]));
  const unchanged = new Set(original.filter(record => material(record) === material(candidates.get(record.id)!)).map(record => record.id));
  const judged = new Map(judgment.evidence.filter(record => unchanged.has(record.id)
    && material(record) === material(candidates.get(record.id)!)).map(record => [record.id, record]));
  const substantiveConfidence = (id: string): number | undefined => {
    if (!assessment || !Object.hasOwn(assessment.sourceAssessments, id)) return undefined;
    const source = assessment.sourceAssessments[id];
    return ['original_record', 'attributable_research', 'substantive_secondary'].includes(source.contentBasis)
      ? source.confidence : undefined;
  };
  const substantive = (id: string) => (substantiveConfidence(id) ?? -1) >= ASSESSMENT_THRESHOLD;
  const rank = (records: Evidence[]) => mergeRetainedEvidence([], records.map(record => candidates.get(record.id)!), checkedText).map(record => candidates.get(record.id)!);
  const rankedOld = rank(original.map(record => candidates.get(record.id)!));
  const directOld = rankedOld.filter(record => judged.has(record.id) && isDirectEvidence(judged.get(record.id)!));
  const freshFamilies = new Set(additions.filter(record => !originalById.has(record.id) || !unchanged.has(record.id)).map(record => family.get(record.id)!));
  // Fresh family material gets a slot before an unchanged old witness;
  // otherwise a positive sibling could hide the new contrary passage.
  // A promising old record can merit another reading even below the verdict's
  // substance threshold. Rank that scheduling preference by confidence rather
  // than discarding it in favor of unassessed topical repetitions. The same two
  // reserved slots and all family/material guards still apply; qualification is
  // decided only from the fresh judgment, never from this selection preference.
  const usefulOld = directOld.filter(record => substantiveConfidence(record.id) !== undefined && !freshFamilies.has(family.get(record.id)!))
    .sort((left, right) => substantiveConfidence(right.id)! - substantiveConfidence(left.id)!);
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
      return finish(original, original.map(record => versionKey('original', record.id)), 'conflict_preserved');
    }
  } else {
    for (const record of usefulOld) {
      if (protectedOld.some(previous => family.get(previous.id) === family.get(record.id))) continue;
      protectedOld.push(record);
      if (protectedOld.length === 2) break;
    }
  }

  const selected: Evidence[] = [];
  const selectedVersionKeys: string[] = [];
  const perDomain = new Map<string, number>();
  const seen = new Set<string>();
  const oldFamilies = new Set<number>();
  // A recurring unchanged result is still old material. It must not consume a
  // family's first slot ahead of a changed window or a genuinely new sibling.
  const fresh = rank(additions.filter(record => !unchanged.has(record.id)));
  const recurring = rank(additions.filter(record => unchanged.has(record.id)));
  for (const scheduled of [...protectedOld, ...fresh, ...recurring, ...rankedOld]) {
    // Richer context can hide a deterministic copy relation visible in the
    // short indexed passage. Try the actual incoming variant through the same
    // guards before dropping the ID; never weaken the known-family check.
    const fallback = containedFallbacks.get(scheduled.id);
    for (const record of fallback ? [scheduled, fallback] : [scheduled]) {
      if (seen.has(record.id) || (perDomain.get(record.sourceGroup) ?? 0) >= 2) continue;
      if (originalById.has(record.id) && oldFamilies.has(family.get(record.id)!) && !protectedOld.includes(scheduled)) continue;
      const relatives = selected.filter(previous => family.get(previous.id) === family.get(record.id));
      // This also covers genuinely new incoming records. A dependence path through
      // an omitted publisher/origin bridge cannot turn into two independent sources.
      // Multiple records remain possible when their dependence is visible in the
      // actually retained raw fields (for example shared full-pool echo identities).
      if (relatives.length && independentSourceCount([...relatives, record]) !== 1) continue;
      selected.push(record); seen.add(record.id);
      selectedVersionKeys.push(record === fallback ? versionKey('incoming', record.id) : candidateVersion.get(record.id)!);
      if (originalById.has(record.id)) oldFamilies.add(family.get(record.id)!);
      perDomain.set(record.sourceGroup, (perDomain.get(record.sourceGroup) ?? 0) + 1);
      break;
    }
    if (selected.length === 6) break;
  }
  // Preserve deterministic full-pool echo identities. Recomputing them after
  // truncation could discard a bridge and falsely split one copying family.
  return finish(selected, selectedVersionKeys, 'selected');
}
