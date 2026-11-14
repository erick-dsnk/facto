import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment, SourceAssessment } from './assessment.js';
import type { ReviewedSourceRule } from './sources.js';
import { decideVerdict } from './verdict.js';

const source = (id: string, excerpt: string): Evidence => ({
  id, url: `https://${id}.org/history`, title: 'Synthetic descriptive reference', publisher: null,
  publishedAt: null, retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt,
  sourceGroup: `${id}.org`, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: true,
  matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: .95,
});

function judgment(contrary = false): AssessedJudgment {
  const evidence = [
    source('archive-a', 'Synthetic reference: the Neral observatory opened in 1924. Its western wing originally housed the instruments, with public visits starting the following spring.'),
    source('history-b', 'Synthetic encyclopedia: Neral began operations during nineteen twenty-four. Early astronomers worked from a purpose-built west building before visitor programmes were introduced.'),
  ];
  if (contrary) evidence.forEach(item => { item.stance = 'contradicts'; });
  return {
    label: contrary ? 'contradicted' : 'supported',
    probabilities: { supported: contrary ? .01 : .95, contradicted: contrary ? .95 : .01, misleading: .01, insufficient_evidence: .03 },
    evidence, selectedEvidenceIds: ['archive-a'], misleadingReason: null,
    checkedText: `The Neral observatory opened in ${contrary ? '1934' : '1924'}.`,
    sourceAssessments: { 'archive-a': { contentBasis: 'ordinary_reference', confidence: .95 }, 'history-b': { contentBasis: 'ordinary_reference', confidence: .95 } },
    claimRisk: { level: 'ordinary', confidence: .99 },
    originAssessments: [{ evidenceIds: ['archive-a', 'history-b'], relationship: 'unclear', confidence: .99 }],
  };
}

const authority: ReviewedSourceRule[] = [{ host: 'archive-a.org', path: '/history', claim: /.*/, rationale: 'Synthetic test capability only.', expertForHighRisk: true }];

describe('ordinary descriptive reference corroboration', () => {
  it.each([false, true])('accepts two developed reference accounts without a named underlying record (contrary=%s)', contrary => {
    const value = judgment(contrary);
    const result = decideVerdict(value);
    expect(result.verdict).toBe(contrary ? 'contradicted' : 'supported');
    expect(result.selectedEvidenceIds).toEqual(['archive-a', 'history-b']);
  });

  it('allows a misleading reference result only with the specific omitted condition established by both families', () => {
    const value = judgment();
    value.label = 'misleading';
    value.probabilities = { supported: .01, contradicted: .01, misleading: .95, insufficient_evidence: .03 };
    value.checkedText = 'Entry to the Neral observatory was free for all visitors in 1924.';
    value.evidence[0].excerpt = 'Synthetic reference account: in 1924 Neral observatory admitted local residents free, while other visitors purchased tickets at its western entrance.';
    value.evidence[1].excerpt = 'Synthetic encyclopedia: Neral charged visiting tourists during nineteen twenty-four. Only people living in the municipality received the admission exemption.';
    value.evidence.forEach(item => { item.stance = 'contradicts'; });
    value.misleadingReason = 'omitted_condition';
    value.misleadingEvidenceIds = ['archive-a', 'history-b'];
    expect(decideVerdict(value).verdict).toBe('misleading');
    expect(decideVerdict(value).selectedEvidenceIds).toEqual(['archive-a', 'history-b']);
    value.misleadingEvidenceIds = ['archive-a'];
    expect(decideVerdict(value).reasonCode).toBe('insufficient_independent_evidence');
    value.misleadingEvidenceIds = [];
    expect(decideVerdict(value).reasonCode).toBe('context_not_established');
  });

  it('can corroborate a substantive record with a descriptive reference', () => {
    const value = judgment();
    value.sourceAssessments['archive-a'].contentBasis = 'original_record';
    expect(decideVerdict(value).verdict).toBe('supported');
  });

  it('never grants a single reference account registry authority', () => {
    const value = judgment();
    value.evidence.pop();
    delete value.sourceAssessments['history-b'];
    value.originAssessments = [];
    expect(decideVerdict(value, undefined, authority).reasonCode).toBe('insufficient_independent_evidence');
  });

  it.each(['common_origin', 'same_domain', 'same_publisher', 'echo', 'copy', 'bridge'] as const)('does not count dependent references twice (%s)', kind => {
    const value = judgment();
    const [a, b] = value.evidence;
    if (kind === 'common_origin') value.originAssessments[0].relationship = 'common_origin';
    if (kind === 'same_domain') b.url = 'https://archive-a.org/another';
    if (kind === 'same_publisher') { a.publisher = 'Shared publisher'; b.publisher = ' shared PUBLISHER '; }
    if (kind === 'echo') { a.echoGroup = 'syndicated'; b.echoGroup = 'syndicated'; }
    if (kind === 'copy') b.excerpt = a.excerpt;
    if (kind === 'bridge') {
      value.evidence.push({ ...source('bridge', 'Synthetic attribution bridge.'), directlyAddressesClaim: false });
      value.sourceAssessments.bridge = { contentBasis: 'attributed', confidence: .99 };
      value.originAssessments = [
        { evidenceIds: [a.id, 'bridge'], relationship: 'common_origin', confidence: .99 },
        { evidenceIds: [b.id, 'bridge'], relationship: 'common_origin', confidence: .99 },
      ];
    }
    expect(decideVerdict(value).reasonCode).toBe('insufficient_independent_evidence');
  });

  it.each(['bare_assertion', 'attributed', 'promotional', 'unclear'] as const)('does not treat %s content as a developed reference', contentBasis => {
    const value = judgment();
    value.evidence[1].excerpt = 'Neral 1924 archive index. Browse tags. The observatory opened in 1924. Buy our guide.';
    value.sourceAssessments['history-b'] = { contentBasis, confidence: .99 };
    expect(decideVerdict(value).reasonCode).toBe('insufficient_independent_evidence');
  });

  it.each(['health_safety', 'disputed', 'unknown', 'uncertain_ordinary', 'lexical_health'] as const)('does not expand the stronger-risk source rubric (%s)', risk => {
    const value = judgment();
    // Even an otherwise valid expert anchor and disclosed distinct origin cannot
    // turn the new ordinary-only reference category into a high-risk corroborator.
    value.sourceAssessments['archive-a'].contentBasis = 'original_record';
    value.originAssessments[0].relationship = 'distinct_origins';
    if (risk === 'uncertain_ordinary') value.claimRisk.confidence = .84;
    else if (risk === 'lexical_health') value.checkedText = 'The observatory prevents disease.';
    else value.claimRisk.level = risk;
    expect(decideVerdict(value, undefined, authority).reasonCode).toBe('insufficient_independent_evidence');
  });

  it('preserves the old expert-plus-substantive-corroborator route', () => {
    const value = judgment();
    value.claimRisk.level = 'health_safety';
    value.originAssessments[0].relationship = 'distinct_origins';
    value.sourceAssessments['archive-a'].contentBasis = 'original_record';
    value.sourceAssessments['history-b'].contentBasis = 'substantive_secondary';
    expect(decideVerdict(value, undefined, authority).verdict).toBe('supported');
  });

  it.each(['scope', 'relevance', 'stance', 'quality', 'verdict', 'no_citation', 'conflict'] as const)('preserves the existing %s gate', gate => {
    const value = judgment();
    const source = value.evidence[1];
    if (gate === 'scope') source.matchesTimePlaceAndPopulation = false;
    if (gate === 'relevance') source.directlyAddressesClaim = false;
    if (gate === 'stance') source.stanceProbability = .79;
    if (gate === 'quality') value.sourceAssessments[source.id].confidence = .84;
    if (gate === 'verdict') value.probabilities.supported = .84;
    if (gate === 'no_citation') value.selectedEvidenceIds = [];
    if (gate === 'conflict') source.stance = 'contradicts';
    expect(decideVerdict(value).verdict).toBe('insufficient_evidence');
  });

  it('uses unchanged inclusive quality and contradiction thresholds', () => {
    const value = judgment(true);
    Object.values(value.sourceAssessments).forEach((assessment: SourceAssessment) => { assessment.confidence = .85; });
    value.probabilities.contradicted = .90;
    expect(decideVerdict(value).verdict).toBe('contradicted');
    value.probabilities.contradicted = .89;
    expect(decideVerdict(value).reasonCode).toBe('below_threshold');
  });
});
