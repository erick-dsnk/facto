import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import { decideVerdict } from '../policy/verdict.js';
import { retainAlternateEvidence } from './alternate-evidence.js';

const checkedText = 'Aster is the capital of Belvar.';
const source = (id: string, excerpt: string): Evidence => ({
  id, url: `https://${id}.org/record`, title: '', publisher: null, publishedAt: null,
  retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt,
  sourceGroup: `${id}.org`, echoGroup: null, sourceRole: 'unknown',
  directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false,
  stance: 'unrelated', stanceProbability: null,
});

function fixture() {
  const alpha = source('alpha', 'Aster is the capital of Belvar. Jurisdiction register Q-71 lists this city under its maintained national administrative record.');
  const charlie = source('charlie', 'Aster is the capital of Belvar. Constitutional gazette F-19 identifies the government seat through an enacted municipal designation.');
  const bridge = source('bridge', 'Gazette F-19 and register Q-71 repeat a single underlying observation, as their shared provenance appendix explicitly explains.');
  const existing = [alpha, bridge, charlie];
  const incoming = Array.from({ length: 4 }, (_, index) => source(`new-${index}`, `Aster Belvar gardening reference number ${index} covers orchard planting.`));
  return { alpha, bridge, charlie, existing, incoming };
}

function freshJudgment(evidence: Evidence[]): AssessedJudgment {
  const direct = (record: Evidence) => ['alpha', 'charlie'].includes(record.id);
  return {
    checkedText, label: 'supported', probabilities: { supported: .99, contradicted: .001, misleading: .001, insufficient_evidence: .008 },
    evidence: evidence.map(record => ({ ...record, directlyAddressesClaim: direct(record), matchesTimePlaceAndPopulation: direct(record),
      stance: direct(record) ? 'supports' : 'unrelated', stanceProbability: .99 })),
    selectedEvidenceIds: evidence.filter(direct).map(record => record.id), misleadingReason: null,
    sourceAssessments: Object.fromEntries(evidence.map(record => [record.id, { contentBasis: direct(record) ? 'original_record' : 'unclear', confidence: .99 }])),
    claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [],
  };
}

function initialJudgment(evidence: Evidence[]): AssessedJudgment {
  return { ...freshJudgment(evidence), originAssessments: [
    { evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 },
    { evidenceIds: ['charlie', 'bridge'], relationship: 'common_origin', confidence: .99 },
  ] };
}

describe('independent adversarial review of alternate retention', () => {
  it('cannot turn removal of a model-assessed provenance bridge into corroboration', () => {
    const { existing, incoming } = fixture();
    const initial = initialJudgment(existing);
    expect(decideVerdict(initial)).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'insufficient_independent_evidence' });
    const retained = retainAlternateEvidence(existing, incoming, checkedText, initial);
    // The final judge may find the origin relation unclear after context is
    // removed. Selection must not manufacture the second independent witness.
    expect(retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id))).toHaveLength(1);
    expect(retained.some(record => record.id.startsWith('new-'))).toBe(true);
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it('applies the prior-family bound when old witnesses recur as incoming results', () => {
    const { alpha, charlie, existing, incoming } = fixture();
    const retained = retainAlternateEvidence(existing, [alpha, charlie, ...incoming], checkedText, initialJudgment(existing));
    expect(retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id))).toHaveLength(1);
    expect(new Set(retained.map(record => record.id)).size).toBe(retained.length);
    expect(retained.length).toBeLessThanOrEqual(6);
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it('does not count a new incoming member of an old assessed family as independent after dropping its bridge', () => {
    const { alpha, bridge, charlie, incoming } = fixture();
    const oldBridge = { ...bridge, publisher: 'Synthetic syndicate' };
    const newWitness = { ...charlie, publisher: 'Synthetic syndicate' };
    const existing = [alpha, oldBridge];
    const initial = { ...freshJudgment(existing), originAssessments: [
      { evidenceIds: ['alpha', 'bridge'] as [string, string], relationship: 'common_origin' as const, confidence: .99 },
    ] };
    expect(decideVerdict(initial).verdict).toBe('insufficient_evidence');
    const retained = retainAlternateEvidence(existing, [newWitness, ...incoming], checkedText, initial);
    // The incoming record is linked to alpha through the publisher bridge.
    // Keeping the bridge with its directly linked new witness is also safe;
    // the old and new witnesses cannot become independent corroborators.
    expect(retained.filter(record => ['alpha', 'charlie'].includes(record.id)).length).toBeLessThanOrEqual(1);
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it('preserves a deterministic domain-publisher bridge when old conflict representatives have no direct family link', () => {
    const { alpha, bridge, charlie, incoming } = fixture();
    const oldBridge = { ...bridge, url: 'https://bridge.alpha.org/record', sourceGroup: 'alpha.org', publisher: 'Synthetic syndicate' };
    const oldCharlie = { ...charlie, publisher: 'Synthetic syndicate' };
    const existing = [alpha, oldBridge, oldCharlie];
    const initial = freshJudgment(existing);
    initial.evidence.find(record => record.id === 'charlie')!.stance = 'contradicts';
    expect(decideVerdict(initial).reasonCode).toBe('conflicting_sources');
    const retained = retainAlternateEvidence(existing, incoming, checkedText, initial);
    // A new judgment may change an old stance. Removing the domain/publisher
    // intermediary must not make those same dependent sources independent.
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it.each(['publisher', 'excerpt'] as const)('preserves prior-to-current dependence when a same-URL bridge changes its %s', changedField => {
    const { alpha, bridge, charlie, incoming } = fixture();
    const oldBridge = changedField === 'publisher'
      ? { ...bridge, publisher: 'Synthetic syndicate' }
      : { ...bridge, excerpt: charlie.excerpt };
    const changedBridge = changedField === 'publisher'
      ? { ...oldBridge, publisher: 'Revised publisher' }
      : { ...oldBridge, excerpt: 'The revised window discusses orchard maintenance and planting schedules.' };
    const newWitness = changedField === 'publisher' ? { ...charlie, publisher: 'Synthetic syndicate' } : charlie;
    const existing = [alpha, oldBridge];
    const initial = { ...freshJudgment(existing), originAssessments: [
      { evidenceIds: ['alpha', 'bridge'] as [string, string], relationship: 'common_origin' as const, confidence: .99 },
    ] };
    expect(decideVerdict(initial).verdict).toBe('insufficient_evidence');
    const retained = retainAlternateEvidence(existing, [alpha, changedBridge, newWitness, ...incoming.slice(0, 3)], checkedText, initial);
    // The old bridge version links alpha to a genuinely new current record.
    // Replacing that window cannot erase the already disclosed dependency.
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it.each(['bridge', 'alpha'] as const)('does not mint independence when the same URL receives a changed %s window', changedId => {
    const { existing, incoming } = fixture();
    const previous = existing.find(record => record.id === changedId)!;
    const changed = { ...previous, contentBasis: 'page_text' as const,
      excerpt: 'A revised archive passage describes a different administrative relation and contradicts the earlier summary.' };
    const retained = retainAlternateEvidence(existing, [changed, ...incoming], checkedText, initialJudgment(existing));
    expect(retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id))).toHaveLength(1);
    expect(retained.find(record => record.id === changedId)).toMatchObject({ excerpt: changed.excerpt, contentBasis: 'page_text',
      directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null });
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });

  it('preserves a prior partial-copy bridge after its current window changes without stamping historical echo fields', () => {
    const { alpha, bridge, charlie, incoming } = fixture();
    const shared = Array.from({ length: 32 }, (_, index) => `shared${index}`).join(' ');
    const oldBridge = { ...bridge, excerpt: `${shared} ${Array.from({ length: 8 }, (_, index) => `prior${index}`).join(' ')}` };
    const newWitness = { ...charlie, excerpt: `${shared} ${Array.from({ length: 8 }, (_, index) => `fresh${index}`).join(' ')}` };
    const changedBridge = { ...bridge, excerpt: 'Aster Belvar revised administrative context describes orchard maintenance and planting schedules.' };
    const existing = [alpha, oldBridge];
    const initial = { ...freshJudgment(existing), originAssessments: [
      { evidenceIds: ['alpha', 'bridge'] as [string, string], relationship: 'common_origin' as const, confidence: .99 },
    ] };
    const retained = retainAlternateEvidence(existing, [changedBridge, newWitness, ...incoming.slice(0, 3)], checkedText, initial);
    // Their common passage exceeds the echo shingle threshold, but the two
    // forty-word windows share only 80% of words. The prior version is needed
    // to connect the new witness to alpha after the bridge changes.
    expect(retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id))).toHaveLength(1);
    expect(retained.find(record => record.id === 'bridge')).toMatchObject({ excerpt: changedBridge.excerpt, echoGroup: null });
    expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
  });
});
