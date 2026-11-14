import { describe, expect, it } from 'vitest';
import type { Evidence, Judgment, Verdict } from '../../../../packages/contracts/src/index.js';
import { decideVerdict } from './verdict.js';
import { independentSourceCount } from './sources.js';

function passage(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return { id, url: `https://${id}.example.org/article`, title: 'Synthetic fixture', publisher: null, publishedAt: null, retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt: 'A synthetic direct source excerpt.', sourceGroup: id, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: 0.95, ...overrides };
}
function reading(label: Verdict = 'supported'): Judgment {
  const stance = label === 'contradicted' ? 'contradicts' : 'supports';
  return { label, probabilities: { supported: label === 'supported' ? 0.95 : 0.01, contradicted: label === 'contradicted' ? 0.95 : 0.01, misleading: label === 'misleading' ? 0.95 : 0.01, insufficient_evidence: label === 'insufficient_evidence' ? 0.95 : 0.01 }, evidence: [passage('a', { url: 'https://example.org/a', excerpt: 'The launch occurred in the year 1889.', stance }), passage('b', { url: 'https://example.net/b', excerpt: 'Historical archives record an opening date of March thirty-first, eighteen eighty-nine.', stance })], selectedEvidenceIds: ['a'], misleadingReason: null, checkedText: 'The tower opened in 1889.' };
}

describe('conservative deterministic verdict', () => {
  it.each(['supported', 'contradicted', 'insufficient_evidence'] as const)('returns %s from qualified reading', label => {
    expect(decideVerdict(reading(label)).verdict).toBe(label);
  });
  it('requires evidence for the actual misleading defect as well as the common source gate', () => {
    const judgment = reading('misleading');
    judgment.misleadingReason = 'outdated_fact';
    expect(decideVerdict(judgment).reasonCode).toBe('context_not_established');
    judgment.misleadingEvidenceIds = ['a'];
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    judgment.misleadingEvidenceIds = ['a', 'b'];
    expect(decideVerdict(judgment).verdict).toBe('misleading');
    judgment.evidence[1].stanceProbability = 0.79;
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('abstains on credible conflict before all definitive thresholds', () => {
    const judgment = reading('contradicted');
    judgment.evidence.push(passage('c', { url: 'https://example.edu/fact', excerpt: 'Direct evidence for the incompatible claim.' }));
    expect(decideVerdict(judgment).reasonCode).toBe('conflicting_sources');
  });
  it('does not count copied passages across domains independently', () => {
    const judgment = reading();
    judgment.evidence[1].excerpt = judgment.evidence[0].excerpt;
    expect(decideVerdict(judgment).reasonCode).toBe('insufficient_independent_evidence');
  });
  it('groups publisher, registrable domain and transitive echo chains', () => {
    const sources = [passage('a', { echoGroup: 'copy' }), passage('b', { url: 'https://example.net/a', echoGroup: 'copy', excerpt: 'Separate words' }), passage('c', { url: 'https://news.example.net/b', excerpt: 'Different words' })];
    expect(independentSourceCount(sources)).toBe(1);
  });
  it('does not grant authority based on company self-publication or primary role', () => {
    const judgment = reading();
    judgment.evidence = [passage('a', { url: 'https://company.example/product', sourceRole: 'primary' })];
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('uses scoped authority only for its exact fact and page, never blanket prestige', () => {
    const judgment = reading('contradicted');
    judgment.checkedText = 'Lightning never strikes the same place twice.';
    judgment.evidence = [passage('a', { url: 'https://www.weather.gov/safety/lightning-myths', excerpt: 'Lightning often strikes the same place repeatedly.', stance: 'contradicts' })];
    expect(decideVerdict(judgment).verdict).toBe('contradicted');
    judgment.checkedText = 'A new supplement cures disease.';
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    judgment.checkedText = 'Lightning never strikes the same place twice.';
    judgment.evidence[0].url = 'https://weather.gov.example.org/safety/lightning-myths';
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('does not turn attribution, topic-only evidence or a bare URL into support', () => {
    for (const override of [{ directlyAddressesClaim: false }, { matchesTimePlaceAndPopulation: false }, { excerpt: '' }, { stance: 'unrelated' as const }, { url: 'javascript:alert(1)' }]) {
      const judgment = reading();
      judgment.evidence = judgment.evidence.map(source => ({ ...source, ...override }));
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    }
  });
  it('never replaces missing citations with invented references', () => {
    const judgment = reading();
    judgment.selectedEvidenceIds = ['made-up'];
    expect(() => decideVerdict(judgment)).toThrow('invalid_citation');
    judgment.selectedEvidenceIds = [];
    expect(decideVerdict(judgment).reasonCode).toBe('no_agreeing_citation');
  });
  it('has separate malformed-provider errors and never accepts non-finite probabilities', () => {
    const judgment = reading();
    judgment.probabilities.supported = NaN;
    expect(() => decideVerdict(judgment)).toThrow('malformed_provider');
  });
  it('applies the higher contradiction threshold', () => {
    const judgment = reading('contradicted');
    judgment.probabilities.contradicted = 0.89;
    expect(decideVerdict(judgment).reasonCode).toBe('below_threshold');
  });
});
