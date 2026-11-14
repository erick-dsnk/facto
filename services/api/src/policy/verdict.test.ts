import { describe, expect, it } from 'vitest';
import type { Evidence, Verdict } from '../../../../packages/contracts/src/index.js';
import { decideVerdict } from './verdict.js';
import { independentSourceCount, isAuthoritativeForClaim, SOURCE_REGISTRY, type ReviewedSourceRule } from './sources.js';
import type { AssessedJudgment } from './assessment.js';

function passage(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return { id, url: `https://${id}.example.org/article`, title: 'Synthetic fixture', publisher: null, publishedAt: null, retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt: 'A synthetic direct source excerpt.', sourceGroup: id, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: 0.95, ...overrides };
}
function reading(label: Verdict = 'supported'): AssessedJudgment {
  const stance = label === 'contradicted' ? 'contradicts' : 'supports';
  const judgment: AssessedJudgment = { label, probabilities: { supported: label === 'supported' ? 0.95 : 0.01, contradicted: label === 'contradicted' ? 0.95 : 0.01, misleading: label === 'misleading' ? 0.95 : 0.01, insufficient_evidence: label === 'insufficient_evidence' ? 0.95 : 0.01 }, evidence: [passage('a', { url: 'https://example.org/a', excerpt: 'Synthetic municipal opening register entry 1889/31 records the tower inauguration on March 31, 1889; it was opened to visitors that year.', stance }), passage('b', { url: 'https://example.net/b', excerpt: 'Synthetic engineering society visitor logs for April eighteen eighty-nine document public access to the completed tower and identify its opening ceremony in the preceding month.', stance })], selectedEvidenceIds: ['a'], misleadingReason: null, checkedText: label === 'contradicted' ? 'The tower opened in 1890.' : 'The tower opened in 1889.', sourceAssessments: { a: { contentBasis: 'original_record', confidence: .99 }, b: { contentBasis: 'attributable_research', confidence: .99 } }, claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [{ evidenceIds: ['a', 'b'], relationship: 'distinct_origins', confidence: .99 }] };
  if (label === 'misleading') {
    judgment.checkedText = 'The tower is open to visitors.';
    judgment.evidence[0].excerpt = 'Synthetic municipal access register dated November 14, 2026 states that the tower is open to visitors only with an advance reservation; walk-in access is suspended.';
    judgment.evidence[1].excerpt = 'Synthetic independent visitor-services inspection observed reservation checks at the tower entrance today and records that only advance ticket holders were admitted.';
  }
  return judgment;
}

function failedPreference(label: 'supported' | 'contradicted' | 'misleading' = 'supported'): AssessedJudgment {
  const judgment = reading(label);
  judgment.evidence.unshift(passage('preferred', { url: 'https://preferred.example.edu/summary', excerpt: 'SYNTHETIC short summary of the same proposition.', stance: judgment.evidence[0].stance }));
  judgment.sourceAssessments.preferred = { contentBasis: 'substantive_secondary', confidence: .84 };
  judgment.selectedEvidenceIds = ['preferred'];
  if (label === 'misleading') {
    judgment.misleadingReason = 'omitted_condition';
    judgment.misleadingEvidenceIds = ['preferred', 'a', 'b'];
  }
  return judgment;
}

describe('conservative deterministic verdict', () => {
  it.each(['supported', 'contradicted', 'insufficient_evidence'] as const)('returns %s from qualified reading', label => {
    expect(decideVerdict(reading(label)).verdict).toBe(label);
  });
  it('requires evidence for the actual misleading defect as well as the common source gate', () => {
    const judgment = reading('misleading');
    judgment.misleadingReason = 'omitted_condition';
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
  it('does not treat blank publisher metadata as a disclosed shared publisher', () => {
    const judgment = reading();
    judgment.evidence[0].publisher = '';
    judgment.evidence[1].publisher = '   ';
    expect(independentSourceCount(judgment.evidence)).toBe(2);
    expect(decideVerdict(judgment).verdict).toBe('supported');
    judgment.evidence[0].publisher = ' Shared Publisher ';
    judgment.evidence[1].publisher = 'shared publisher';
    expect(independentSourceCount(judgment.evidence)).toBe(1);
  });
  it('does not grant authority based on company self-publication or primary role', () => {
    const judgment = reading();
    judgment.evidence = [passage('a', { url: 'https://company.example/product', sourceRole: 'primary' })];
    delete judgment.sourceAssessments.b;
    judgment.originAssessments = [];
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('uses scoped authority only for its exact fact and page, never blanket prestige', () => {
    const judgment = reading('contradicted');
    judgment.checkedText = 'Lightning never strikes the same place twice.';
    judgment.evidence = [passage('a', { url: 'https://www.weather.gov/safety/lightning-myths', excerpt: 'Lightning often strikes the same place repeatedly.', stance: 'contradicts' })];
    delete judgment.sourceAssessments.b;
    judgment.originAssessments = [];
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
  it.each(['supported', 'contradicted', 'misleading'] as const)('uses only the fully qualifying pair when the preferred citation fails substance for %s', label => {
    const judgment = failedPreference(label);
    const result = decideVerdict(judgment);
    expect(result.verdict).toBe(label);
    expect(result.selectedEvidenceIds).toEqual(['a', 'b']);
    expect(result.selectedEvidenceIds.every(id => judgment.evidence.some(source => source.id === id))).toBe(true);
  });
  it('keeps misleading fallback restricted to sources establishing the specific context defect', () => {
    const judgment = failedPreference('misleading');
    judgment.misleadingEvidenceIds = ['preferred'];
    expect(decideVerdict(judgment).reasonCode).toBe('insufficient_independent_evidence');
    judgment.misleadingEvidenceIds = ['preferred', 'a'];
    expect(decideVerdict(judgment).reasonCode).toBe('insufficient_independent_evidence');
    judgment.misleadingEvidenceIds = ['preferred', 'a', 'b'];
    expect(decideVerdict(judgment).selectedEvidenceIds).toEqual(['a', 'b']);
    judgment.misleadingReason = null;
    expect(decideVerdict(judgment).reasonCode).toBe('context_not_established');
  });
  it.each([{ stance: 'unrelated' as const }, { matchesTimePlaceAndPopulation: false }])('uses qualifying citations even when a valid retained preference is unrelated or out of scope', override => {
    const judgment = failedPreference();
    Object.assign(judgment.evidence[0], override);
    expect(decideVerdict(judgment).selectedEvidenceIds).toEqual(['a', 'b']);
  });
  it('keeps a nonqualifying preferred passage in the full dependence graph', () => {
    const judgment = failedPreference();
    judgment.originAssessments.push(
      { evidenceIds: ['a', 'preferred'], relationship: 'common_origin', confidence: .99 },
      { evidenceIds: ['b', 'preferred'], relationship: 'common_origin', confidence: .99 },
    );
    expect(decideVerdict(judgment).reasonCode).toBe('insufficient_independent_evidence');
  });
  it('does not fall back when all sources are weak, scope mismatches or credible sources conflict', () => {
    const weak = failedPreference();
    weak.sourceAssessments.a.confidence = .84;
    weak.sourceAssessments.b.confidence = .84;
    expect(decideVerdict(weak).reasonCode).toBe('insufficient_independent_evidence');
    const scope = failedPreference();
    scope.evidence.forEach(source => { source.matchesTimePlaceAndPopulation = false; });
    expect(decideVerdict(scope).reasonCode).toBe('no_direct_evidence');
    const conflict = failedPreference();
    conflict.evidence.push(passage('opposing', { url: 'https://opposing.example.net/record', stance: 'contradicts' }));
    expect(decideVerdict(conflict).reasonCode).toBe('conflicting_sources');
  });
  it('does not fall back below the verdict threshold or without required high-risk provenance', () => {
    const lowVerdict = failedPreference('contradicted');
    lowVerdict.probabilities.contradicted = .89;
    expect(decideVerdict(lowVerdict).reasonCode).toBe('below_threshold');
    const highRisk = failedPreference();
    highRisk.claimRisk = { level: 'health_safety', confidence: .99 };
    expect(decideVerdict(highRisk).reasonCode).toBe('insufficient_independent_evidence');
  });
  it('preserves an explicit no-citation choice and rejects invalid or malformed preference lists', () => {
    const judgment = failedPreference();
    judgment.selectedEvidenceIds = [];
    expect(decideVerdict(judgment).reasonCode).toBe('no_agreeing_citation');
    judgment.selectedEvidenceIds = ['invented'];
    expect(() => decideVerdict(judgment)).toThrow('invalid_citation');
    judgment.selectedEvidenceIds = ['preferred'];
    judgment.evidence.push({ ...judgment.evidence[0] });
    expect(() => decideVerdict(judgment)).toThrow('invalid_citation');
    judgment.evidence.pop();
    judgment.selectedEvidenceIds = null as unknown as string[];
    expect(() => decideVerdict(judgment)).toThrow('malformed_provider');
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
  it('preserves the full corroborating citation set with the selected best passage first', () => {
    const judgment = reading();
    judgment.selectedEvidenceIds = ['b'];
    expect(decideVerdict(judgment).selectedEvidenceIds).toEqual(['b', 'a']);
  });
  it('retains the reviewed authority when the selected best passage is a substantive corroborator', () => {
    const judgment = reading('contradicted');
    judgment.checkedText = 'Lightning never strikes the same place twice.';
    judgment.evidence[0].url = 'https://weather.gov/safety/lightning-myths';
    judgment.evidence[0].excerpt = 'Lightning often strikes the same place repeatedly.';
    judgment.evidence[1].excerpt = 'Synthetic independent field log L-2 records repeated lightning strikes on one marked tower during the observed storm.';
    judgment.selectedEvidenceIds = ['b'];
    expect(decideVerdict(judgment).selectedEvidenceIds).toEqual(['b', 'a']);
  });
  it.each(['supported', 'contradicted', 'misleading'] as const)('requires substantive quality for %s, including the exact misleading defect', label => {
    const judgment = reading(label);
    if (label === 'misleading') {
      judgment.misleadingReason = 'omitted_condition';
      judgment.misleadingEvidenceIds = ['a', 'b'];
    }
    for (const contentBasis of ['bare_assertion', 'attributed', 'promotional', 'unclear'] as const) {
      judgment.sourceAssessments.a.contentBasis = contentBasis;
      judgment.sourceAssessments.b.contentBasis = contentBasis;
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    }
  });
  it('rejects confident bare assertions on unrelated domains and an unidentifiable research claim', () => {
    const judgment = reading();
    judgment.evidence[0].excerpt = 'The tower definitely opened in 1889. Everybody knows it.';
    judgment.evidence[1].excerpt = 'Scientists proved that the tower opening was in eighteen eighty-nine.';
    judgment.sourceAssessments.a.contentBasis = 'bare_assertion';
    judgment.sourceAssessments.b.contentBasis = 'unclear';
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('fails closed for absent, missing-ID or low-confidence source assessments', () => {
    const { sourceAssessments: _sources, claimRisk: _risk, originAssessments: _origins, ...legacy } = reading();
    expect(decideVerdict(legacy).verdict).toBe('insufficient_evidence');
    const judgment = reading();
    delete judgment.sourceAssessments.b;
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    judgment.sourceAssessments.b = { contentBasis: 'original_record', confidence: .84 };
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('does not accept inherited assessment entries as retained source assessments', () => {
    const judgment = reading();
    judgment.sourceAssessments = Object.create(judgment.sourceAssessments);
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('rejects invalid internal assessment confidence, IDs and contradictory duplicate origin pairs', () => {
    const judgment = reading();
    judgment.sourceAssessments.a.confidence = NaN;
    expect(() => decideVerdict(judgment)).toThrow('malformed_provider');
    judgment.sourceAssessments.a.confidence = .99;
    judgment.sourceAssessments.invented = { contentBasis: 'original_record', confidence: .99 };
    expect(() => decideVerdict(judgment)).toThrow('invalid_citation');
    delete judgment.sourceAssessments.invented;
    judgment.originAssessments.push({ evidenceIds: ['b', 'a'], relationship: 'common_origin', confidence: .99 });
    expect(() => decideVerdict(judgment)).toThrow('malformed_provider');
  });
  it('groups differently worded reports of the same study or press release', () => {
    const judgment = reading();
    judgment.evidence[0].excerpt = 'Synthetic study Tower-1889 used a photographed city ledger to identify the public opening date.';
    judgment.evidence[1].excerpt = 'According to synthetic research Tower-1889, the civic register fixes the inauguration to the last day of March.';
    judgment.originAssessments = [{ evidenceIds: ['a', 'b'], relationship: 'common_origin', confidence: .99 }];
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('preserves transitive origin grouping through a nonqualifying retained passage', () => {
    const judgment = reading();
    judgment.evidence.push(passage('c', { url: 'https://example.edu/c', directlyAddressesClaim: false, excerpt: 'Synthetic attribution-only bridge between the municipal record and the society report.' }));
    judgment.originAssessments = [
      { evidenceIds: ['a', 'c'], relationship: 'common_origin', confidence: .99 },
      { evidenceIds: ['b', 'c'], relationship: 'common_origin', confidence: .99 },
    ];
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it.each(['health_safety', 'disputed', 'unknown'] as const)('requires a reviewed expert anchor for %s even with three confident unknown publishers', level => {
    const judgment = reading();
    judgment.claimRisk = { level, confidence: .99 };
    judgment.evidence.push(passage('c', { url: 'https://example.edu/c', excerpt: 'A separate synthetic chronicle recounts its own examination of the inaugural ticket register and building access notices.' }));
    judgment.sourceAssessments.c = { contentBasis: 'original_record', confidence: .99 };
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('takes the stronger route for uncertain ordinary risk and dangerous-mixture or pregnancy wording', () => {
    const judgment = reading();
    judgment.claimRisk.confidence = .84;
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    judgment.claimRisk.confidence = .99;
    for (const text of ['Mixing bleach with vinegar is harmless.', 'This supplement improves pregnancy outcomes.', 'The product improves athletic performance.']) {
      judgment.checkedText = text;
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    }
  });
  it.each([
    ['The treaty entered into force in 1889.', 'Synthetic foreign-office register T-1 records treaty ratification and entry into force on March 31, 1889.', 'Synthetic independent parliamentary minutes of April 1889 record implementation after the treaty entered into force the preceding month.'],
    ['The agreement has an effective date of March 31, 1889.', 'Synthetic contract archive item C-1 reproduces the signed agreement whose effective-date clause states March 31, 1889.', 'Synthetic independent court registry item J-2 quotes the agreement effective-date clause as the thirty-first day of March, eighteen eighty-nine.'],
    ['CPU performance doubled in this benchmark.', 'Synthetic lab run A recorded 100 seconds for the old CPU and 50 seconds for the new CPU on identical benchmark inputs and compiler flags.', 'Synthetic university experiment B independently executed the same workload on both processors, recording two completed tasks per second versus one under the controlled protocol.'],
    ['The report measures financial risk using daily returns.', 'Synthetic report methods section R-1 defines financial risk as standard deviation computed from daily closing-price returns.', 'Synthetic independent code audit A-2 executed the report analysis and confirmed that the financial-risk calculation consumes one-day price-return observations.'],
  ])('preserves ordinary assessed corroboration for %s', (text, first, second) => {
    const judgment = reading();
    judgment.checkedText = text;
    judgment.evidence[0].excerpt = first;
    judgment.evidence[1].excerpt = second;
    expect(decideVerdict(judgment).verdict).toBe('supported');
  });
  it.each(['The medicine treats the infection.', 'Treatment prevents disease.', 'The vaccine reduces infection rates.', 'This dosage causes poisoning.'])('escalates explicit medical language even when the model misclassifies %s as ordinary', text => {
    const judgment = reading();
    judgment.checkedText = text;
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('does not let scope-matched poor-quality opposition disappear from the conflict veto', () => {
    const judgment = reading();
    judgment.evidence[1].stance = 'contradicts';
    judgment.sourceAssessments.b.contentBasis = 'bare_assertion';
    expect(decideVerdict(judgment).reasonCode).toBe('conflicting_sources');
  });
  it('does not let an authority URL bypass unknown or promotional retained content', () => {
    const judgment = reading('contradicted');
    judgment.checkedText = 'Lightning never strikes the same place twice.';
    judgment.evidence = [passage('a', { url: 'https://weather.gov/safety/lightning-myths', stance: 'contradicts' })];
    delete judgment.sourceAssessments.b;
    judgment.originAssessments = [];
    judgment.sourceAssessments.a.contentBasis = 'unclear';
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
  });
  it('separates a company announcement record from its advertised effectiveness claim', () => {
    const registry: ReviewedSourceRule[] = [{ host: 'synthetic-maker.example', path: '/announcement', claim: /^Synthetic Maker announced Device A\.$/, rationale: 'TEST ONLY: the company record establishes its own announcement, not device benefits.' }];
    const judgment = reading();
    judgment.checkedText = 'Synthetic Maker announced Device A.';
    judgment.evidence = [passage('a', { url: 'https://synthetic-maker.example/announcement', excerpt: 'SYNTHETIC announcement record: Synthetic Maker announced Device A on November 14, 2026, with sales planned for December.' })];
    delete judgment.sourceAssessments.b;
    judgment.originAssessments = [];
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('supported');
    judgment.checkedText = 'Device A prevents disease.';
    judgment.sourceAssessments.a.contentBasis = 'promotional';
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
  });
});

describe('reviewed high-risk provenance with explicit test-only capabilities', () => {
  const registry: ReviewedSourceRule[] = [{ host: 'test-clinic.example', path: '/trial-17', claim: /^Synthetic treatment reduces disease incidence\.$/, rationale: 'TEST ONLY: independently reviewed synthetic trial capability for this exact proposition.', expertForHighRisk: true }];
  function highRisk(): AssessedJudgment {
    const judgment = reading();
    judgment.checkedText = 'Synthetic treatment reduces disease incidence.';
    judgment.claimRisk = { level: 'health_safety', confidence: .99 };
    judgment.evidence[0] = passage('a', { url: 'https://test-clinic.example/trial-17', excerpt: 'Synthetic randomized trial 17 recorded 11 cases among 100 treated participants and 24 among 100 controls over one year, with the prespecified disease endpoint.' });
    judgment.evidence[1] = passage('b', { url: 'https://test-university.example/trial-28', excerpt: 'Synthetic university trial 28 prospectively followed separately recruited cohorts for twelve months. Its registered outcome table recorded fewer disease events in the treatment arm than in the placebo group.' });
    return judgment;
  }
  it('allows a scoped reviewed expert anchor plus substantive independently originating corroborator', () => {
    const judgment = highRisk();
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('supported');
    expect(decideVerdict(judgment, undefined, registry).selectedEvidenceIds).toEqual(['a', 'b']);
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    expect(SOURCE_REGISTRY.some(rule => rule.host === registry[0].host)).toBe(false);
  });
  it('allows a failed preference only while the full reviewed expert and distinct-origin pair remains qualified', () => {
    const judgment = highRisk();
    judgment.evidence.unshift(passage('preferred', { url: 'https://summary.example/claim', excerpt: 'SYNTHETIC brief summary of treatment observations.' }));
    judgment.sourceAssessments.preferred = { contentBasis: 'substantive_secondary', confidence: .84 };
    judgment.selectedEvidenceIds = ['preferred'];
    expect(decideVerdict(judgment, undefined, registry).selectedEvidenceIds).toEqual(['a', 'b']);
    judgment.originAssessments[0].relationship = 'unclear';
    expect(decideVerdict(judgment, undefined, registry).reasonCode).toBe('insufficient_independent_evidence');
    judgment.originAssessments[0].relationship = 'distinct_origins';
    judgment.evidence[0].stance = 'contradicts';
    expect(decideVerdict(judgment, undefined, registry).reasonCode).toBe('conflicting_sources');
  });
  it('requires positively established distinct origins, not different domains or absence of a same-origin flag', () => {
    const judgment = highRisk();
    for (const originAssessments of [[], [{ evidenceIds: ['a', 'b'] as [string, string], relationship: 'unclear' as const, confidence: .99 }], [{ evidenceIds: ['a', 'b'] as [string, string], relationship: 'distinct_origins' as const, confidence: .84 }]]) {
      judgment.originAssessments = originAssessments;
      expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
    }
  });
  it('rejects an expert outside its exact capability, a single anchor, advertising, and a transitive shared origin', () => {
    const judgment = highRisk();
    judgment.checkedText = 'Synthetic treatment cures cancer.';
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
    judgment.checkedText = 'Synthetic treatment reduces disease incidence.';
    judgment.sourceAssessments.b.contentBasis = 'promotional';
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
    judgment.sourceAssessments.b.contentBasis = 'attributable_research';
    judgment.evidence.push(passage('c', { url: 'https://test-news.example/release', directlyAddressesClaim: false, excerpt: 'The two synthetic trial reports both repeat synthetic sponsor release SR-1.' }));
    judgment.originAssessments.push({ evidenceIds: ['a', 'c'], relationship: 'common_origin', confidence: .99 }, { evidenceIds: ['b', 'c'], relationship: 'common_origin', confidence: .99 });
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
    judgment.evidence = [judgment.evidence[0]];
    delete judgment.sourceAssessments.b;
    judgment.originAssessments = [];
    expect(decideVerdict(judgment, undefined, registry).verdict).toBe('insufficient_evidence');
  });
});

describe('bounded production expert capabilities', () => {
  const weatherURL = 'https://www.weather.gov/safety/lightning-myths';
  const asthmaURL = 'https://www.nhs.uk/conditions/asthma/';
  it.each([
    'Lightning never strikes the same place twice.',
    'Lightning can strike the same place more than once',
    'lightning cannot strike same place twice.',
    'Lightning does not strike the same place more than once.',
  ])('recognizes the reviewed lightning recurrence family regardless of polarity: %s', text => {
    expect(isAuthoritativeForClaim(passage('a', { url: weatherURL }), text, SOURCE_REGISTRY, true)).toBe(true);
  });
  it.each([
    'Asthma can cause wheezing.', 'Asthma cannot cause coughing.',
    'Asthma does not cause shortness of breath', 'asthma never causes chest tightness.',
  ])('recognizes the reviewed possible-symptom family regardless of polarity: %s', text => {
    expect(isAuthoritativeForClaim(passage('a', { url: asthmaURL }), text, SOURCE_REGISTRY, true)).toBe(true);
  });
  it.each([
    [weatherURL, 'Lightning never strikes the same place twice, so standing there is safe.'],
    [weatherURL, 'Lightning can strike the same place twice in Helsinki tonight.'],
    [weatherURL, 'Lightning cannot injure people inside a car.'],
    [weatherURL, 'Lightning always strikes the same place twice.'],
    [weatherURL, 'Lightning never strikes the same place twice. Shelter under a tree.'],
    [asthmaURL, 'Asthma always causes wheezing.'],
    [asthmaURL, 'Asthma can cause wheezing in newborns.'],
    [asthmaURL, 'My wheezing proves I have asthma.'],
    [asthmaURL, 'Asthma can cause wheezing, so I should change my medicine.'],
    [asthmaURL, 'Inhalers cure asthma.'],
    [asthmaURL, 'Asthma can cause cancer.'],
  ])('does not extend a reviewed page to adjacent or appended claims: %s %s', (url, text) => {
    expect(isAuthoritativeForClaim(passage('a', { url }), text, SOURCE_REGISTRY, true)).toBe(false);
  });
  it.each([
    ['https://weather.gov.example.org/safety/lightning-myths', 'Lightning never strikes the same place twice.'],
    ['https://weather.gov/safety/lightning-myths-extra', 'Lightning never strikes the same place twice.'],
    ['https://api.weather.gov/safety/lightning-myths', 'Lightning never strikes the same place twice.'],
    ['https://nhs.uk.example.org/conditions/asthma/', 'Asthma can cause wheezing.'],
    ['https://nhs.uk/conditions/asthma/treatment/', 'Asthma can cause wheezing.'],
    ['https://www.nhs.uk/conditions/copd/', 'Asthma can cause wheezing.'],
    ['https://nhs.uk@attacker.example/conditions/asthma/', 'Asthma can cause wheezing.'],
  ])('does not extend capability to a different host or path: %s', (url, text) => {
    expect(isAuthoritativeForClaim(passage('a', { url }), text, SOURCE_REGISTRY, true)).toBe(false);
  });
  function expertReading(topic: 'weather' | 'asthma', label: 'supported' | 'contradicted' = 'supported'): AssessedJudgment {
    const judgment = reading(label);
    judgment.checkedText = topic === 'weather' ? label === 'contradicted' ? 'Lightning never strikes the same place twice.' : 'Lightning can strike the same place twice.' : label === 'contradicted' ? 'Asthma cannot cause wheezing.' : 'Asthma can cause wheezing.';
    judgment.claimRisk = { level: 'health_safety', confidence: .99 };
    judgment.evidence[0].url = topic === 'weather' ? weatherURL : asthmaURL;
    judgment.evidence[0].excerpt = topic === 'weather' ? 'Lightning often strikes the same place repeatedly.' : 'The main symptoms of asthma include wheezing, coughing, shortness of breath and a tight feeling in the chest; symptoms can come and go.';
    judgment.evidence[1].excerpt = topic === 'weather' ? 'SYNTHETIC independent field experiment U-2 records two lightning impacts at the same marked tower during a single storm, using tower-mounted sensors.' : 'SYNTHETIC independent clinical cohort C-2 separately recruited participants with confirmed asthma. Its symptom diary table records wheezing episodes during monitored follow-up.';
    return judgment;
  }
  it.each(['weather', 'asthma'] as const)('allows %s only with all strict pair gates, with complete citations and unchanged conflict veto', topic => {
    for (const label of ['supported', 'contradicted'] as const) {
      const judgment = expertReading(topic, label);
      expect(decideVerdict(judgment).verdict).toBe(label);
      expect(decideVerdict(judgment).selectedEvidenceIds).toEqual(['a', 'b']);
      judgment.originAssessments[0].relationship = 'unclear';
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
      judgment.originAssessments[0].relationship = 'common_origin';
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
      judgment.originAssessments[0].relationship = 'distinct_origins';
      judgment.evidence[1].stanceProbability = .79;
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
      judgment.evidence[1].stanceProbability = .99;
      judgment.evidence[1].matchesTimePlaceAndPopulation = false;
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
      judgment.evidence[1].matchesTimePlaceAndPopulation = true;
      judgment.sourceAssessments.b.confidence = .84;
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
      judgment.sourceAssessments.b.confidence = .99;
      judgment.evidence[1].stance = label === 'supported' ? 'contradicts' : 'supports';
      expect(decideVerdict(judgment).reasonCode).toBe('conflicting_sources');
    }
  });
  it.each(['weather', 'asthma'] as const)('never treats a lone %s expert as enough for a high-risk claim', topic => {
    const judgment = expertReading(topic);
    judgment.evidence = [judgment.evidence[0]];
    judgment.originAssessments = [];
    delete judgment.sourceAssessments.b;
    expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    if (topic === 'asthma') {
      judgment.claimRisk.level = 'ordinary';
      expect(decideVerdict(judgment).verdict).toBe('insufficient_evidence');
    }
  });
});
