import { describe, expect, it, vi } from 'vitest';
import type { AcceptedClaim, Evidence, ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { CONTENT_BASES } from '../../policy/assessment.js';
import { decideVerdict } from '../../policy/verdict.js';
import type { JevAnswer, JevRequest } from './client.js';
import { createJudge } from './judgment.js';

const checkedText = 'The Alara Observatory opened in 1908.';
const claim: AcceptedClaim = {
  id: 'synthetic-reference-claim', originalText: checkedText, checkedText,
  sourceSpan: { start: 0, end: Array.from(checkedText).length },
  admission: { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'public_fact', hasPracticalConsequence: null, matchedSelectedTopic: null },
};
const retained: Evidence[] = [
  { id: 'reference-a', url: 'https://reference-a.example/entry', title: 'Synthetic reference A', publisher: null, publishedAt: null, retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt: 'SYNTHETIC reference: Alara Observatory began operation in 1908 near the southern ridge; its domed main building overlooks the old port.', sourceGroup: 'reference-a.example', echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null },
  { id: 'reference-b', url: 'https://reference-b.example/entry', title: 'Synthetic reference B', publisher: null, publishedAt: null, retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'page_text', excerpt: 'SYNTHETIC descriptive account: the Alara astronomical facility opened in 1908. A timber access road connected its hillside site to the coastal settlement.', sourceGroup: 'reference-b.example', echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null },
];
const context: ProviderContext = { signal: new AbortController().signal, consume: vi.fn(), now: () => 0 };
function scripted(request: JevRequest, overrides: Record<string, string | number> = {}): Record<string, JevAnswer> {
  return Object.fromEntries(Object.entries(request.questions).map(([name, question]) => {
    if (question.type === 'noul') return [name, { noul: overrides[name] ?? (name.endsWith('_context_established') ? 0 : .99) }];
    const fallback = name === 'verdict' ? 'supported' : name === 'selected_evidence' ? 'e0'
      : name === 'claim_risk' ? 'ordinary' : name.endsWith('_content_basis') ? 'ordinary_reference'
        : name.endsWith('_stance') ? 'supports' : name.endsWith('_origin') ? 'unclear' : 'none';
    const selected = String(overrides[name] ?? fallback);
    return [name, { choice: selected, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, Number(key === selected)])) }];
  }));
}

describe('ordinary reference judgment boundary', () => {
  it('sends the ordinary reference rubric bound to the exact retained source without granting provenance', async () => {
    const ask = vi.fn(async (request: JevRequest) => scripted(request));
    const result = await createJudge({ ask })(claim, retained, context);
    const request = ask.mock.calls[0][0];
    const question = request.questions.e0_content_basis;
    expect(question.type).toBe('choice');
    if (question.type !== 'choice') throw new Error('unexpected_question_type');
    expect(Object.keys(question.criteria)).toEqual([...CONTENT_BASES]);
    expect(question.instructions).toContain('retained evidence reference-a');
    expect(question.instructions).toContain('without identifying an underlying primary record');
    expect(question.instructions).toContain('NOT verified publisher reliability');
    expect(question.criteria.ordinary_reference).toContain('explicit entity, factual relation and value');
    expect(question.criteria.ordinary_reference).toContain('ambiguous date role');
    expect(question.criteria.ordinary_reference).toContain('missing material qualifier');
    expect(question.criteria.ordinary_reference).toContain('medical, safety');
    expect(question.criteria.substantive_secondary).toContain('identifiable underlying record');
    expect(result.evidence.map(source => source.sourceRole)).toEqual(['unknown', 'unknown']);
    expect(result.sourceAssessments['reference-a']).toEqual({ contentBasis: 'ordinary_reference', confidence: 1 });
    expect(decideVerdict(result).verdict).toBe('supported');
    expect(decideVerdict(result).selectedEvidenceIds).toEqual(['reference-a', 'reference-b']);
    expect(ask).toHaveBeenCalledOnce();
  });

  it('explicitly permits selecting a contradicting reference for a false claim', async () => {
    const falseText = 'The Alara Observatory opened in 1918.';
    const falseClaim = { ...claim, checkedText: falseText, originalText: falseText, sourceSpan: { start: 0, end: Array.from(falseText).length } };
    const ask = vi.fn(async (request: JevRequest) => scripted(request, { verdict: 'contradicted', e0_stance: 'contradicts', e1_stance: 'contradicts', selected_evidence: 'e1' }));
    const result = await createJudge({ ask })(falseClaim, retained, context);
    expect(ask.mock.calls[0][0].questions.selected_evidence.instructions).toContain('directly supporting, refuting, or establishing a material qualification of the exact checked_proposition');
    expect(ask.mock.calls[0][0].questions.selected_evidence.instructions).not.toContain('verdict');
    expect(ask.mock.calls[0][0].questions.e0_scope.instructions).toContain('different asserted value, location or date can directly refute');
    expect(result.selectedEvidenceIds).toEqual(['reference-b']);
    expect(decideVerdict(result)).toMatchObject({ verdict: 'contradicted', selectedEvidenceIds: ['reference-b', 'reference-a'] });
  });

  // These are injected boundary assessments, not measurements of model semantics.
  it.each([
    ['claim echo', { e0_content_basis: 'bare_assertion', e1_content_basis: 'bare_assertion' }],
    ['advertising', { e0_content_basis: 'promotional', e1_content_basis: 'promotional' }],
    ['attributed belief', { e0_content_basis: 'attributed', e1_content_basis: 'attributed' }],
    ['unclear content', { e0_content_basis: 'unclear', e1_content_basis: 'unclear' }],
    ['missing material scope', { e0_scope: .84, e1_scope: .84 }],
    ['unrelated relation', { e0_relevant: .84, e1_relevant: .84 }],
    ['conflicting passages', { e1_stance: 'contradicts' }],
    ['medical stakes', { claim_risk: 'health_safety' }],
    ['unresolved dispute', { claim_risk: 'disputed' }],
    ['uncertain stakes', { claim_risk: 'unknown' }],
    ['known common origin', { e0_e1_origin: 'common_origin' }],
    ['no selected citation', { selected_evidence: 'none' }],
  ] as const)('does not let ordinary references bypass %s', async (_label, overrides) => {
    const result = await createJudge({ ask: async request => scripted(request, overrides) })(claim, retained, context);
    expect(decideVerdict(result).verdict).toBe('insufficient_evidence');
  });

  it('does not add ordinary-only probability mass to legacy substantive confidence', async () => {
    for (const selected of ['original_record', 'ordinary_reference'] as const) {
      const probabilities = { original_record: selected === 'original_record' ? .4 : .3, attributable_research: .15, substantive_secondary: .1, ordinary_reference: selected === 'ordinary_reference' ? .4 : .3, bare_assertion: .05, attributed: 0, promotional: 0, unclear: 0 };
      const result = await createJudge({ ask: async request => ({ ...scripted(request), e0_content_basis: { choice: selected, probabilities } }) })(claim, retained, context);
      expect(result.sourceAssessments['reference-a'].confidence).toBeCloseTo(selected === 'ordinary_reference' ? .95 : .65);
      expect(decideVerdict(result).verdict).toBe(selected === 'ordinary_reference' ? 'supported' : 'insufficient_evidence');
    }
  });

  it('never turns one ordinary reference into a single-source authority shortcut', async () => {
    const result = await createJudge({ ask: async request => scripted(request) })(claim, retained.slice(0, 1), context);
    expect(decideVerdict(result).verdict).toBe('insufficient_evidence');
  });
});
