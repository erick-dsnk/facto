import { PipelineError, type Evidence, type Judgment, type Verdict, type VerdictDecision } from '../../../../packages/contracts/src/index.js';
import { isDirectEvidence, qualifyingSourceSet, SOURCE_REGISTRY, type ReviewedSourceRule } from './sources.js';
import { readAssessment } from './assessment.js';

const thresholds = { supported: 0.85, contradicted: 0.90, misleading: 0.85 };
const summaries: Record<Verdict, string> = {
  supported: 'Supported by the sources I found.',
  contradicted: 'The evidence I found contradicts that claim.',
  misleading: 'That needs context.',
  insufficient_evidence: 'I couldn’t verify that.',
};
const abstain = (reasonCode: string): VerdictDecision => ({ verdict: 'insufficient_evidence', reasonCode, selectedEvidenceIds: [], summary: summaries.insufficient_evidence });

/** The only function that assigns factual labels. Provider failures are not input. */
export function decideVerdict(judgment: Judgment, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY): VerdictDecision {
  const labels: Verdict[] = ['supported', 'contradicted', 'misleading', 'insufficient_evidence'];
  if (!labels.includes(judgment.label) || labels.some(label => !Number.isFinite(judgment.probabilities[label]) || judgment.probabilities[label] < 0 || judgment.probabilities[label] > 1)) {
    throw new PipelineError('malformed_provider');
  }
  const retained = new Map(judgment.evidence.map(source => [source.id, source]));
  if (retained.size !== judgment.evidence.length || judgment.selectedEvidenceIds.some(id => !retained.has(id))
    || judgment.misleadingEvidenceIds?.some(id => !retained.has(id))) throw new PipelineError('invalid_citation');
  const assessment = readAssessment(judgment);

  const direct = judgment.evidence.filter(isDirectEvidence);
  const support = direct.filter(source => source.stance === 'supports');
  const contradiction = direct.filter(source => source.stance === 'contradicts');
  // Even one direct, high-confidence opposing passage blocks a definitive label.
  if (support.length > 0 && contradiction.length > 0) return abstain('conflicting_sources');
  if (!direct.length) return abstain('no_direct_evidence');
  if (judgment.label === 'insufficient_evidence') return abstain('model_abstained');
  if (judgment.probabilities[judgment.label] < thresholds[judgment.label]) return abstain('below_threshold');

  let qualifying: Evidence[];
  if (judgment.label === 'misleading') {
    if (!judgment.misleadingReason || !judgment.misleadingEvidenceIds?.length) return abstain('context_not_established');
    qualifying = direct.filter(source => judgment.misleadingEvidenceIds?.includes(source.id));
  } else qualifying = judgment.label === 'supported' ? support : contradiction;

  const qualified = qualifyingSourceSet(qualifying, judgment.checkedText, assessment, registry, judgment.evidence);
  if (!qualified.length) return abstain('insufficient_independent_evidence');
  const chosen = judgment.selectedEvidenceIds.filter(id => qualified.some(source => source.id === id));
  if (!chosen.length) return abstain('no_agreeing_citation');
  return {
    verdict: judgment.label,
    reasonCode: judgment.label === 'misleading' ? judgment.misleadingReason! : 'qualifying_evidence',
    selectedEvidenceIds: [...new Set([...chosen, ...qualified.map(source => source.id)])],
    // Exact excerpts stay in evidence, not model-generated prose or corrected numbers.
    summary: summaries[judgment.label],
  };
}
