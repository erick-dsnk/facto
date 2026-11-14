import { PipelineError, type Judgment } from '../../../../packages/contracts/src/index.js';

/** Server-only assessments of quoted content, never verified publisher provenance.
 * These fields are deliberately absent from the frozen app result contract. */
export const CONTENT_BASES = ['original_record', 'attributable_research', 'substantive_secondary', 'ordinary_reference', 'bare_assertion', 'attributed', 'promotional', 'unclear'] as const;
export const CLAIM_RISKS = ['ordinary', 'health_safety', 'disputed', 'unknown'] as const;
export const ORIGIN_RELATIONSHIPS = ['common_origin', 'distinct_origins', 'unclear'] as const;
export const ASSESSMENT_THRESHOLD = 0.85;
export type SourceAssessment = { contentBasis: typeof CONTENT_BASES[number]; confidence: number };
export type OriginAssessment = { evidenceIds: [string, string]; relationship: typeof ORIGIN_RELATIONSHIPS[number]; confidence: number };
export type JudgmentAssessment = {
  sourceAssessments: Record<string, SourceAssessment>;
  claimRisk: { level: typeof CLAIM_RISKS[number]; confidence: number };
  originAssessments: OriginAssessment[];
};
export type AssessedJudgment = Judgment & JudgmentAssessment;

const finiteProbability = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** A missing extension abstains. A supplied but malformed one is a provider error. */
export function readAssessment(judgment: Judgment): JudgmentAssessment | undefined {
  const candidate = judgment as Partial<AssessedJudgment>;
  if (candidate.sourceAssessments === undefined && candidate.claimRisk === undefined && candidate.originAssessments === undefined) return undefined;
  const { sourceAssessments, claimRisk, originAssessments } = candidate;
  if (!sourceAssessments || typeof sourceAssessments !== 'object' || Array.isArray(sourceAssessments)
    || !claimRisk || !CLAIM_RISKS.includes(claimRisk.level) || !finiteProbability(claimRisk.confidence)
    || !Array.isArray(originAssessments)) throw new PipelineError('malformed_provider');
  const ids = new Set(judgment.evidence.map(source => source.id));
  for (const [id, assessment] of Object.entries(sourceAssessments)) {
    if (!ids.has(id)) throw new PipelineError('invalid_citation');
    if (!assessment || !CONTENT_BASES.includes(assessment.contentBasis) || !finiteProbability(assessment.confidence)) throw new PipelineError('malformed_provider');
  }
  const seenPairs = new Set<string>();
  for (const pair of originAssessments) {
    if (!pair || !Array.isArray(pair.evidenceIds) || pair.evidenceIds.length !== 2
      || pair.evidenceIds[0] === pair.evidenceIds[1]
      || pair.evidenceIds.some(id => !ids.has(id))) throw new PipelineError('invalid_citation');
    const key = [...pair.evidenceIds].sort().join('\u0000');
    if (seenPairs.has(key) || !ORIGIN_RELATIONSHIPS.includes(pair.relationship) || !finiteProbability(pair.confidence)) throw new PipelineError('malformed_provider');
    seenPairs.add(key);
  }
  return { sourceAssessments, claimRisk, originAssessments };
}
