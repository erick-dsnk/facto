import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import { retainAlternateEvidence, selectAlternateEvidenceWithContext } from './alternate-evidence.js';
import publicFixture from './alternate-evidence.public-bd05.fixture.json' with { type: 'json' };

const checkedText = 'The Meridian bridge opened in 1889.';
const source = (id: string, excerpt: string): Evidence => ({ id, url: `https://${id}.org/record`, title: 'Municipal register',
  publisher: null, publishedAt: '2026-11-14', retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt,
  sourceGroup: `${id}.org`, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false,
  matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null });
const judgment = (records: Evidence[]): AssessedJudgment => ({ checkedText, label: 'insufficient_evidence',
  probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 },
  evidence: records.map(record => ({ ...record, directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: .99 })),
  selectedEvidenceIds: [], misleadingReason: null,
  sourceAssessments: Object.fromEntries(records.map(record => [record.id, { contentBasis: 'original_record', confidence: .99 }])),
  claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [] });

describe('internal alternate-selection material context', () => {
  it('records the exact original page version selected over a contained incoming highlight', () => {
    const old = { ...source('alpha', `${checkedText} However, public access began in 1890. Keeper: Municipal Archive.`), contentBasis: 'page_text' as const };
    const next = { ...old, excerpt: checkedText, contentBasis: 'highlight' as const, retrievedAt: '2026-11-14T10:00:05Z' };
    const result = selectAlternateEvidenceWithContext([old], [next], checkedText, judgment([old]));
    expect(result.retainedVersionKeys).toEqual(['original:0']);
    expect(result.retained[0]).toMatchObject({ excerpt: old.excerpt, retrievedAt: old.retrievedAt });
    expect(result.inputVersions.map(version => version.record.excerpt)).toEqual([old.excerpt, next.excerpt]);
    expect(result.dependenceLinks).toEqual([{ leftKey: 'original:0', rightKey: 'incoming:0', reasons: ['same_evidence_id'] }]);
    expect(result.retained).toEqual(retainAlternateEvidence([old], [next], checkedText, judgment([old])));
  });

  it('records the actual incoming fallback without losing the richer old version or copying its assessment', () => {
    const fixture = publicFixture as unknown as { checkedText: string; initial: Evidence[]; incoming: Evidence[]; frozenSelected: Evidence[];
      priorSchedulingAssessment: { records: Evidence[]; sourceAssessments: AssessedJudgment['sourceAssessments']; claimRisk: AssessedJudgment['claimRisk']; originAssessments: AssessedJudgment['originAssessments'] } };
    const prior = { ...judgment(fixture.initial), checkedText: fixture.checkedText, evidence: fixture.priorSchedulingAssessment.records,
      sourceAssessments: fixture.priorSchedulingAssessment.sourceAssessments, claimRisk: fixture.priorSchedulingAssessment.claimRisk,
      originAssessments: fixture.priorSchedulingAssessment.originAssessments };
    const result = selectAlternateEvidenceWithContext(fixture.initial, fixture.incoming, fixture.checkedText, prior);
    const index = result.retained.findIndex(record => record.url.endsWith('/si-base-units/second'));
    expect(result.retainedVersionKeys[index]).toBe('incoming:0');
    expect(result.retained[index]).toMatchObject({ excerpt: fixture.incoming[0].excerpt, retrievedAt: fixture.incoming[0].retrievedAt,
      contentBasis: 'highlight', directlyAddressesClaim: false, stance: 'unrelated' });
    expect(result.inputVersions).toHaveLength(fixture.initial.length + fixture.incoming.length);
    expect(result.inputVersions.filter(version => version.record.id === fixture.incoming[0].id)).toHaveLength(2);
    expect(result).not.toHaveProperty('sourceAssessments');
    expect(result.priorOriginsAreSchedulingOnly).toBe(true);
  });

  it('records a correction as the incoming version while preserving both exact texts', () => {
    const old = source('alpha', checkedText);
    const next = { ...old, excerpt: 'Correction: public access began in 1890, not 1889.', contentBasis: 'page_text' as const,
      retrievedAt: '2026-11-14T10:00:05Z' };
    const result = selectAlternateEvidenceWithContext([old], [next], checkedText, judgment([old]));
    expect(result.retainedVersionKeys).toEqual(['incoming:0']);
    expect(result.retained[0].excerpt).toBe(next.excerpt);
    expect(result.inputVersions.map(version => version.record.excerpt)).toEqual([old.excerpt, next.excerpt]);
  });

  it('captures all versions on the unchanged early return and identifies the original timestamp without inference', () => {
    const old = source('alpha', checkedText), next = { ...old, retrievedAt: '2026-11-14T10:00:05Z' };
    const result = selectAlternateEvidenceWithContext([old], [next], checkedText, judgment([old]));
    expect(result.reason).toBe('unchanged');
    expect(result.retained).toEqual([old]);
    expect(result.retainedVersionKeys).toEqual(['original:0']);
    expect(result.inputVersions.map(version => version.usedForDependence)).toEqual([true, true]);
    expect(result.inputVersions[1].record.retrievedAt).toBe(next.retrievedAt);
    expect(result.familyById).toEqual([{ evidenceId: 'alpha', family: 0 }]);
  });

  it('captures original records and all incoming context on the preserved-conflict early return', () => {
    const old = [source('alpha', 'The register dates public access to 1889.'), source('bridge', 'The provenance appendix links the two records.'),
      source('charlie', 'The gazette dates public access to 1890.')];
    const prior = judgment(old);
    prior.evidence[1] = { ...old[1], stance: 'unrelated', stanceProbability: 0 };
    prior.evidence[2].stance = 'contradicts';
    prior.originAssessments = [
      { evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 },
      { evidenceIds: ['bridge', 'charlie'], relationship: 'common_origin', confidence: .99 },
    ];
    const incoming = [source('fresh', 'An independent engineering record describes the crossing.')];
    const result = selectAlternateEvidenceWithContext(old, incoming, checkedText, prior);
    expect(result.reason).toBe('conflict_preserved');
    expect(result.retained).toEqual(old);
    expect(result.retainedVersionKeys).toEqual(['original:0', 'original:1', 'original:2']);
    expect(result.inputVersions).toHaveLength(4);
    expect(result.dependenceLinks.filter(link => link.reasons.includes('prior_original_family'))).toHaveLength(2);
  });

  it('keeps omitted old copy-bridge text and its exact raw witness edges after a changed window', () => {
    const alpha = source('alpha', 'The administrative register Q-71 records the maintained designation.'),
      shared = Array.from({ length: 32 }, (_, i) => `shared${i}`).join(' ');
    const bridge = source('bridge', `${shared} ${Array.from({ length: 8 }, (_, i) => `prior${i}`).join(' ')}`);
    const witness = source('charlie', `${shared} ${Array.from({ length: 8 }, (_, i) => `fresh${i}`).join(' ')}`);
    const changed = { ...bridge, excerpt: 'A revised archive passage discusses orchard maintenance.' };
    const prior = judgment([alpha, bridge]);
    prior.originAssessments = [{ evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 }];
    const result = selectAlternateEvidenceWithContext([alpha, bridge], [changed, witness], checkedText, prior);
    expect(result.inputVersions.find(version => version.key === 'original:1')?.record.excerpt).toBe(bridge.excerpt);
    expect(result.inputVersions.find(version => version.key === 'incoming:0')?.record.excerpt).toBe(changed.excerpt);
    expect(result.retainedVersionKeys).not.toContain('original:1');
    expect(result.dependenceLinks).toEqual(expect.arrayContaining([
      { leftKey: 'original:0', rightKey: 'original:1', reasons: ['prior_original_family'] },
      { leftKey: 'original:1', rightKey: 'incoming:1', reasons: ['raw_family'] },
    ]));
    expect(new Set(result.familyById.map(row => row.family)).size).toBe(1);
  });

  it('keeps every duplicate occurrence but maps retained material and graph use to the existing last-per-pass version', () => {
    const first = source('alpha', checkedText), last = { ...first, retrievedAt: '2026-11-14T10:00:05Z' };
    const result = selectAlternateEvidenceWithContext([first, last], [], checkedText, judgment([last]));
    expect(result.retained).toEqual([last]);
    expect(result.retainedVersionKeys).toEqual(['original:1']);
    expect(result.inputVersions.map(version => version.usedForDependence)).toEqual([false, true]);
    expect(result.dependenceLinks).toEqual([{ leftKey: 'original:0', rightKey: 'original:1', reasons: ['same_evidence_id'] }]);
  });

  it('preserves supplied metadata separately from canonical and full-graph echo projections', () => {
    const old = { ...source('alpha', checkedText), url: 'https://alpha.org/record?utm_source=fixture#top', sourceGroup: 'supplied-group', echoGroup: 'supplied-echo' };
    const result = selectAlternateEvidenceWithContext([old], [], checkedText, judgment([old]));
    expect(result.inputVersions[0]).toMatchObject({ record: { url: 'https://alpha.org/record', sourceGroup: 'alpha.org', echoGroup: 'supplied-echo' },
      supplied: { url: old.url, sourceGroup: old.sourceGroup, echoGroup: old.echoGroup }, dependenceEchoGroup: null });
    expect(result.completeness).toEqual({ boundary: 'normalized_selector_inputs', upstreamProviderBodiesComplete: false });
  });

  it('detaches and freezes snapshot metadata without changing mutable legacy retained records', () => {
    const old = [source('alpha', 'A register.'), source('bravo', 'A gazette.')];
    const prior = judgment(old);
    prior.originAssessments = [{ evidenceIds: ['alpha', 'bravo'], relationship: 'common_origin', confidence: .99 }];
    const result = selectAlternateEvidenceWithContext(old, [], checkedText, prior);
    prior.originAssessments[0].confidence = .01; prior.originAssessments[0].evidenceIds[0] = 'changed'; old[0].excerpt = 'Caller mutation.';
    expect(result.priorOriginAssessments[0]).toEqual({ evidenceIds: ['alpha', 'bravo'], relationship: 'common_origin', confidence: .99 });
    expect(result.inputVersions[0].record.excerpt).toBe('A register.');
    expect(() => { (result.inputVersions[0].record as Evidence).excerpt = 'Changed snapshot.'; }).toThrow(TypeError);
    expect(Object.isFrozen(result.retained)).toBe(false);
    expect(Object.isFrozen(result.retained[0])).toBe(false);
    result.retained[0].excerpt = 'Legacy caller mutation.';
    expect(result.inputVersions[0].record.excerpt).toBe('A register.');
  });

  it('bounds twelve input occurrences and all sixty-six graph pairs without dropping nodes', () => {
    const old = Array.from({ length: 6 }, (_, i) => ({ ...source(`old-${i}`, 'A shared register.'), publisher: 'Shared keeper' }));
    const incoming = Array.from({ length: 6 }, (_, i) => ({ ...source(`fresh-${i}`, 'A shared register.'), publisher: 'Shared keeper' }));
    const result = selectAlternateEvidenceWithContext(old, incoming, checkedText, judgment(old));
    expect(result.inputVersions).toHaveLength(12);
    expect(result.dependenceLinks).toHaveLength(66);
    expect(result.familyById).toHaveLength(12);
    expect(new Set(result.familyById.map(row => row.family)).size).toBe(1);
    expect(result.retained.length).toBeLessThanOrEqual(6);
    expect(() => selectAlternateEvidenceWithContext(old, [...incoming, source('extra', 'Extra.')], checkedText, judgment(old))).toThrow('malformed_evidence');
  });

  it('preserves invalid-citation rejection before exposing an inconsistent inventory', () => {
    const old = source('alpha', checkedText);
    for (const invalid of [{ ...old, excerpt: 'Different material in the same pass.' }, { ...old, url: 'https://different.org/record' }]) {
      expect(() => selectAlternateEvidenceWithContext([old, invalid], [], checkedText, judgment([old]))).toThrow('invalid_citation');
      expect(() => retainAlternateEvidence([old, invalid], [], checkedText, judgment([old]))).toThrow('invalid_citation');
    }
  });
});
