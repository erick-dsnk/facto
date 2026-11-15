import { describe, expect, it } from 'vitest';
import { claimFrame, type AcceptedClaim, type ClaimFrame, type Evidence, type SourceTraits, type Verdict } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from './assessment.js';
import { assessVerdict, decideVerdict } from './verdict.js';

const passage = (id: string, url: string, stance: Evidence['stance'], stanceProbability = 0.95, overrides: Partial<Evidence> = {}): Evidence => ({
  id, url, title: id, publisher: null, publishedAt: null, retrievedAt: '2026-11-14T12:00:00Z', contentBasis: 'highlight',
  excerpt: `Record ${id}.`, sourceGroup: new URL(url).hostname, echoGroup: null, sourceRole: 'unknown',
  directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance, stanceProbability, ...overrides,
});
function judgment(checkedText: string, label: Verdict, p: number, evidence: Evidence[], extra: Partial<AssessedJudgment> = {}): AssessedJudgment {
  return { checkedText, label, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 0, [label]: p }, evidence,
    selectedEvidenceIds: evidence.slice(0, 1).map(source => source.id), misleadingReason: null, misleadingEvidenceIds: [],
    sourceAssessments: Object.fromEntries(evidence.map(source => [source.id, { contentBasis: 'original_record', confidence: 0.99 }])),
    claimRisk: { level: 'ordinary', confidence: 0.99 }, originAssessments: [], ...extra };
}
const frame = (overrides: Partial<AcceptedClaim> = {}): ClaimFrame => claimFrame({ id: 'c', originalText: 'x', checkedText: 'x', sourceSpan: { start: 0, end: 1 },
  admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' }, ...overrides });
const traits = (evidence: Evidence[], trusted: string[] = []): SourceTraits[] => evidence.map(source => {
  const site = new URL(source.url).hostname.replace(/^www\./, '');
  return { site, trusted: trusted.includes(site) };
});

describe('decideVerdict with the ported rules and the strict gate', () => {
  it('V2: a health claim backed by two ordinary sites stays Can\'t verify', () => {
    const text = 'Vitamin C cures the common cold.';
    const evidence = [passage('a', 'https://wellness-a.example/vitamin', 'supports'), passage('b', 'https://wellness-b.example/c', 'supports')];
    const value = judgment(text, 'supported', 0.9, evidence, { claimRisk: { level: 'health_safety', confidence: 0.99 } });
    const assessed = assessVerdict(value, { traits: traits(evidence), frame: frame(), checkedText: text });
    expect(assessed.ruleLabel).toBe('supported');
    expect(assessed.decision).toEqual({ verdict: 'insufficient_evidence', reasonCode: 'insufficient_independent_evidence', selectedEvidenceIds: [], summary: 'I couldn’t verify that.' });
    // The lexical trigger alone also takes the strict route, whatever the typed risk says.
    expect(decideVerdict({ ...value, claimRisk: { level: 'ordinary', confidence: 0.99 } } as AssessedJudgment, { traits: traits(evidence), frame: frame(), checkedText: text }).verdict).toBe('insufficient_evidence');
  });

  it('V2: a reviewed expert anchor plus a distinct-origin corroborator settles a health claim', () => {
    const text = 'Asthma can cause wheezing.';
    const evidence = [passage('nhs', 'https://www.nhs.uk/conditions/asthma', 'supports'), passage('clinic', 'https://clinic.example/asthma', 'supports')];
    const value = judgment(text, 'supported', 0.9, evidence, { claimRisk: { level: 'health_safety', confidence: 0.99 },
      originAssessments: [{ evidenceIds: ['nhs', 'clinic'], relationship: 'distinct_origins', confidence: 0.95 }] });
    expect(decideVerdict(value, { traits: traits(evidence), frame: frame(), checkedText: text })).toMatchObject({ verdict: 'supported', reasonCode: 'qualifying_evidence', selectedEvidenceIds: ['nhs', 'clinic'] });
    // Without the disclosed distinct origin the anchor alone is not enough.
    expect(decideVerdict({ ...value, originAssessments: [] } as AssessedJudgment, { traits: traits(evidence), frame: frame(), checkedText: text }).verdict).toBe('insufficient_evidence');
  });

  it('treats a non-ordinary or missing risk assessment as the strict route, not a merely uncertain ordinary one', () => {
    const text = 'The bridge opened in 1889.';
    const evidence = [passage('a', 'https://a.example/x', 'supports'), passage('b', 'https://b.example/y', 'supports')];
    const context = { traits: traits(evidence), frame: frame(), checkedText: text };
    expect(decideVerdict(judgment(text, 'supported', 0.9, evidence), context).verdict).toBe('supported');
    expect(decideVerdict(judgment(text, 'supported', 0.9, evidence, { claimRisk: { level: 'unknown', confidence: 0.99 } }), context).verdict).toBe('insufficient_evidence');
    expect(decideVerdict(judgment(text, 'supported', 0.9, evidence, { claimRisk: { level: 'ordinary', confidence: 0.8 } }), context).verdict).toBe('supported');
    expect(decideVerdict(judgment(text, 'supported', 0.9, evidence, { claimRisk: { level: 'health_safety', confidence: 0.6 } }), context).verdict).toBe('insufficient_evidence');
    const { sourceAssessments: _s, claimRisk: _r, originAssessments: _o, ...bare } = judgment(text, 'supported', 0.9, evidence);
    expect(decideVerdict(bare, context).verdict).toBe('insufficient_evidence');
  });

  it('says False on a health claim when three sites contradict it, none support it and Jev is 90% sure', () => {
    const text = 'Vitamin C cures the common cold.';
    const three = [passage('a', 'https://a.example/x', 'contradicts'), passage('b', 'https://b.example/y', 'contradicts'), passage('c', 'https://c.example/z', 'contradicts')];
    const risky = { claimRisk: { level: 'health_safety' as const, confidence: 0.99 } };
    expect(decideVerdict(judgment(text, 'contradicted', 0.95, three, risky), { traits: traits(three), frame: frame(), checkedText: text }).verdict).toBe('contradicted');
    const two = three.slice(0, 2);
    expect(decideVerdict(judgment(text, 'contradicted', 0.95, two, risky), { traits: traits(two), frame: frame(), checkedText: text }).verdict).toBe('insufficient_evidence');
    const backed = [...three, passage('d', 'https://d.example/w', 'supports')];
    expect(decideVerdict(judgment(text, 'contradicted', 0.95, backed, risky), { traits: traits(backed), frame: frame(), checkedText: text }).verdict).not.toBe('contradicted');
  });

  it('V7: one news report settles an attributed claim, with the attribution label', () => {
    const text = 'According to Example Times, the Riverside Bridge reopened on Monday.';
    const attributed = frame({ route: 'recent_event', attribution: { source: 'Example Times', mode: 'reported' } });
    const report = [passage('report', 'https://www.example.com/city/bridge', 'supports', 0.94, { origin: 'news' })];
    // The sources seam marks a news report trusted for an attributed claim.
    const context = { traits: [{ site: 'example.com', trusted: true }], frame: attributed, checkedText: text };
    const supported = decideVerdict(judgment(text, 'supported', 0.8, report), context);
    expect(supported).toMatchObject({ verdict: 'supported', selectedEvidenceIds: ['report'], attribution: { label: 'reported', source: 'Example Times', mode: 'reported' } });
    const denied = [{ ...report[0], stance: 'contradicts' as const }];
    expect(decideVerdict(judgment(text, 'contradicted', 0.8, denied), context)).toMatchObject({ verdict: 'contradicted', attribution: { label: 'not_said', source: 'Example Times', mode: 'reported' } });
    // An untrusted single report does not settle it, and an abstention carries no attribution.
    const untrusted = decideVerdict(judgment(text, 'supported', 0.8, report), { ...context, traits: [{ site: 'example.com', trusted: false }] });
    expect(untrusted.verdict).toBe('insufficient_evidence');
    expect(untrusted.attribution).toBeUndefined();
  });

  it('V8: a future claim far outside estimates is False based on current estimates', () => {
    const text = 'Examplecorp will IPO at a 2.5 trillion dollar valuation.';
    const evidence = [passage('news', 'https://news.example.com/listing', 'contradicts', 0.91, { origin: 'news' }), passage('wire', 'https://wire.example.org/valuation', 'contradicts', 0.88, { origin: 'news' })];
    const future = frame({ future: true });
    const decision = decideVerdict(judgment(text, 'contradicted', 0.8, evidence, { basis: 'estimates' }), { traits: traits(evidence), frame: future, checkedText: text });
    expect(decision).toMatchObject({ verdict: 'contradicted', basis: 'estimates', selectedEvidenceIds: ['news', 'wire'] });
    expect(decideVerdict(judgment(text, 'contradicted', 0.8, evidence, { basis: 'announcement' }), { traits: traits(evidence), frame: future, checkedText: text }).basis).toBe('announcement');
    // Neither, an abstention, or a claim not about the future carries no basis.
    expect(decideVerdict(judgment(text, 'contradicted', 0.8, evidence, { basis: null }), { traits: traits(evidence), frame: future, checkedText: text }).basis).toBeUndefined();
    expect(decideVerdict(judgment(text, 'contradicted', 0.6, evidence, { basis: 'estimates' }), { traits: traits(evidence), frame: future, checkedText: text }).basis).toBeUndefined();
    expect(decideVerdict(judgment(text, 'contradicted', 0.8, evidence, { basis: 'estimates' }), { traits: traits(evidence), frame: frame(), checkedText: text }).basis).toBeUndefined();
  });

  it('names a misleading result by the defect Jev found, or by how the rules found it', () => {
    const text = 'The tower is 400 metres tall.';
    const evidence = [passage('a', 'https://a.example/x', 'supports'), passage('b', 'https://b.example/y', 'contradicts')];
    const context = { traits: traits(evidence), frame: frame(), checkedText: text };
    const mixed = judgment(text, 'misleading', 0.6, evidence);
    expect(decideVerdict(mixed, context)).toMatchObject({ verdict: 'misleading', reasonCode: 'mixed_evidence', selectedEvidenceIds: ['b'], summary: 'That needs context.' });
    expect(decideVerdict({ ...mixed, misleadingReason: 'exaggeration' }, context).reasonCode).toBe('exaggeration');
    const rated = [passage('fc', 'https://factcheck.example/claim', 'unrelated', 1, { origin: 'fact_check', rating: 'misleading' })];
    expect(decideVerdict(judgment(text, 'insufficient_evidence', 0.9, rated), { traits: [{ site: 'factcheck.example', trusted: true }], frame: frame(), checkedText: text }))
      .toMatchObject({ verdict: 'misleading', reasonCode: 'rated_misleading', selectedEvidenceIds: ['fc'] });
  });

  it('abstains with a reason and validates its inputs', () => {
    const text = 'Helsinki is the capital of Finland.';
    const evidence = [passage('a', 'https://a.example/x', 'supports')];
    expect(decideVerdict(judgment(text, 'supported', 0.9, evidence), { traits: traits(evidence), frame: frame(), checkedText: text }))
      .toEqual({ verdict: 'insufficient_evidence', reasonCode: 'insufficient_independent_evidence', selectedEvidenceIds: [], summary: 'I couldn’t verify that.' });
    expect(decideVerdict(judgment(text, 'insufficient_evidence', 1, []), { traits: [], frame: frame(), checkedText: text }).reasonCode).toBe('no_evidence');
    expect(() => decideVerdict(judgment(text, 'supported', 0.9, evidence), { traits: [], frame: frame(), checkedText: text })).toThrow('malformed_evidence');
    expect(() => decideVerdict({ ...judgment(text, 'supported', 0.9, evidence), selectedEvidenceIds: ['invented'] }, { traits: traits(evidence), frame: frame(), checkedText: text })).toThrow('invalid_citation');
    expect(() => decideVerdict({ ...judgment(text, 'supported', 0.9, evidence), probabilities: { supported: 2, contradicted: 0, misleading: 0, insufficient_evidence: 0 } }, { traits: traits(evidence), frame: frame(), checkedText: text })).toThrow('malformed_provider');
  });
});
