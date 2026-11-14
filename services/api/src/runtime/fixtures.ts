import { type PipelineAdapters, codePoints, PipelineError } from '../../../../packages/contracts/src/index.js';

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
        excerpt: i ? 'This is separate synthetic evidence for testing the app event contract.' : 'This fabricated test passage is not live evidence or a source for a real-world claim.', sourceGroup: `fixture-${name}.example`, echoGroup: null, sourceRole: 'secondary' as const,
        directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: claim.checkedText.startsWith('Helsinki') ? 'supports' as const : 'contradicts' as const, stanceProbability: .99 }));
    },
    async judge(claim, evidence, ctx) {
      ctx.consume('jev');
      const supported = claim.checkedText.startsWith('Helsinki');
      return { checkedText: claim.checkedText, label: supported ? 'supported' : 'contradicted', probabilities: { supported: supported ? .99 : .001, contradicted: supported ? .001 : .99, misleading: .001, insufficient_evidence: .008 }, evidence, selectedEvidenceIds: evidence.map(e => e.id), misleadingReason: null };
    }
  };
}
