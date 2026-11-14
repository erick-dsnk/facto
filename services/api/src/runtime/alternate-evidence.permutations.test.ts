import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';
import { independentSourceCount } from '../policy/sources.js';
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
  const incoming = Array.from({ length: 4 }, (_, index) => source(`new-${index}`, `Aster Belvar gardening reference number ${index} covers orchard planting.`));
  return { alpha, bridge, charlie, incoming };
}

function initialJudgment(evidence: Evidence[]): AssessedJudgment {
  return {
    checkedText, label: 'insufficient_evidence',
    probabilities: { supported: .001, contradicted: .001, misleading: .001, insufficient_evidence: .997 },
    evidence: evidence.map(record => ({ ...record })), selectedEvidenceIds: [], misleadingReason: null,
    sourceAssessments: Object.fromEntries(evidence.map(record => [record.id, { contentBasis: 'original_record', confidence: .99 }])),
    claimRisk: { level: 'ordinary', confidence: .99 },
    originAssessments: [{ evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 }],
  };
}

function freshJudgment(evidence: Evidence[]): AssessedJudgment {
  return {
    ...initialJudgment(evidence), originAssessments: [],
  };
}

const permutations = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
] as const;

const orderCases = ['publisher', 'copied excerpt'].flatMap(linkType => permutations.flatMap((order, permutationIndex) =>
  [false, true].map(reverseOld => ({ linkType, order, permutationIndex, reverseOld }))));

describe('alternate retention order permutations', () => {
  it.each(orderCases)('keeps the old family connected for $linkType ordering $permutationIndex/$reverseOld',
    ({ linkType, order, permutationIndex, reverseOld }) => {
      const { alpha, bridge, charlie, incoming } = fixture();
      const oldBridge = linkType === 'publisher'
        ? { ...bridge, publisher: 'Synthetic syndicate' }
        : { ...bridge, excerpt: charlie.excerpt };
      const revisedBridge = linkType === 'publisher'
        ? { ...oldBridge, publisher: 'Revised publisher' }
        : { ...oldBridge, excerpt: 'The revised window discusses orchard maintenance and planting schedules.' };
      const newWitness = linkType === 'publisher'
        ? { ...charlie, publisher: 'Synthetic syndicate' }
        : charlie;
      const old = [alpha, oldBridge];
      const oldByOrder = reverseOld ? [...old].reverse() : old;
      const groups = [[revisedBridge], [newWitness], permutationIndex % 2 === 0 ? incoming : [...incoming].reverse()];
      const reordered = [groups[order[0]], groups[order[1]], groups[order[2]]].flat();
      const initial = initialJudgment(old);
      const retained = retainAlternateEvidence(oldByOrder, reordered, checkedText, initial);
      const retainedBridge = retained.find(record => record.id === 'bridge');
      if (retainedBridge) {
        // A returned bridge must be the new URL version, never the assessed old window.
        expect(retainedBridge.excerpt).toBe(revisedBridge.excerpt);
        expect(retainedBridge.publisher).toBe(revisedBridge.publisher);
      }

      expect(retained.length).toBeLessThanOrEqual(6);
      expect(new Set(retained.map(record => record.id)).size).toBe(retained.length);
      for (const domain of new Set(retained.map(record => record.sourceGroup))) {
        expect(retained.filter(record => record.sourceGroup === domain).length).toBeLessThanOrEqual(2);
      }

      const originalUnchanged = retained.length === old.length
        && old.every(previous => retained.some(record => record.id === previous.id && record.excerpt === previous.excerpt && record.publisher === previous.publisher));
      if (originalUnchanged) {
        // Keeping the original assessment context preserves its disclosed abstention.
        expect(decideVerdict(initial).verdict).toBe('insufficient_evidence');
      } else {
        const familyMembers = retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id));
        // A retry may retain multiple family members only when their returned raw
        // fields still reveal one connected source family without old model labels.
        expect(independentSourceCount(familyMembers), `${linkType} ordering ${permutationIndex}/${reverseOld}: ${familyMembers.map(record => `${record.id}:${record.publisher}:${record.excerpt}`).join(' | ')}`).toBeLessThanOrEqual(1);
        expect(decideVerdict(freshJudgment(retained)).verdict).toBe('insufficient_evidence');
      }
    },
  );
});
