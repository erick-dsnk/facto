import { type PipelineAdapters, codePoints, PipelineError } from '../../../../packages/contracts/src/index.js';
import type { AssessedJudgment } from '../policy/assessment.js';

/** Deliberately synthetic. Never used when PIPELINE_MODE=live. */
export function fixtureAdapters(): PipelineAdapters {
  return {
    async classify(input, ctx) {
      ctx.consume('jev');
      if (!['typed_fixture', 'recorded_fixture'].includes(input.capture.source)) throw new PipelineError('fixture_input_required');
      if (input.text === 'I felt tired after lunch.') return { action: 'skip', reasonCode: 'personal_experience', claims: [] };
      if (input.text.endsWith('...')) return { action: input.userInitiated ? 'needs_confirmation' : 'wait', reasonCode: 'incomplete', claims: [] };
      if (!['Helsinki is the capital of Finland.', 'Lightning never strikes the same place twice.', 'There is not enough fixture evidence.'].includes(input.text)) return { action: 'needs_confirmation', reasonCode: 'unknown_fixture', claims: [] };
      return { action: 'check', reasonCode: 'fixture', claims: [{ id: `${input.requestId}-1`, originalText: input.text, checkedText: input.text, sourceSpan: { start: 0, end: codePoints(input.text).length }, admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'fixture' } }] };
    },
    async retrieve(claim, ctx) {
      ctx.consume('search', claim.id);
      if (claim.checkedText.startsWith('There is not')) return [];
      return ['one', 'two'].map((name, i) => ({ id: `fixture-${name}`, url: `https://fixture-${name}.example/evidence`, title: `Synthetic fixture ${name}`, publisher: null, publishedAt: null, retrievedAt: new Date(ctx.now()).toISOString(), contentBasis: 'highlight' as const,
        excerpt: claim.checkedText.startsWith('Helsinki')
          ? i ? 'SYNTHETIC TEST RECORD: an independent geographic directory lists Finland with Helsinki as its national capital and seat of central government.' : 'SYNTHETIC TEST RECORD: a fictional parliamentary location register identifies Helsinki as Finland’s capital and records the national government there.'
          : i ? 'SYNTHETIC TEST RECORD: a fictional university field-study log records two separate lightning impacts on the same marked tower during a single storm.' : 'SYNTHETIC TEST RECORD: a fictional meteorological observation table documents repeated lightning strikes at identical tower coordinates on several dates.', sourceGroup: `fixture-${name}.example`, echoGroup: null, sourceRole: 'secondary' as const,
        directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: claim.checkedText.startsWith('Helsinki') ? 'supports' as const : 'contradicts' as const, stanceProbability: .99 }));
    },
    async judge(claim, evidence, ctx): Promise<AssessedJudgment> {
      ctx.consume('jev');
      const supported = claim.checkedText.startsWith('Helsinki');
      return { checkedText: claim.checkedText, label: supported ? 'supported' : 'contradicted', probabilities: { supported: supported ? .99 : .001, contradicted: supported ? .001 : .99, misleading: .001, insufficient_evidence: .008 }, evidence, selectedEvidenceIds: evidence.map(e => e.id), misleadingReason: null,
        sourceAssessments: Object.fromEntries(evidence.map(source => [source.id, { contentBasis: 'original_record', confidence: .99 }])),
        claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: evidence.length === 2 ? [{ evidenceIds: [evidence[0].id, evidence[1].id], relationship: 'distinct_origins', confidence: .99 }] : [] };
    }
  };
}
