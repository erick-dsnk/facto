import {
  PipelineError, RESULT_BASES, type ClaimFrame, type Evidence, type Judgment, type ResultAttribution, type SourceTraits, type Verdict, type VerdictDecision,
} from '../../../../packages/contracts/src/index.js';
import { isDirectEvidence, needsStrongEvidence, qualifyingSourceSet, SOURCE_REGISTRY, type ReviewedSourceRule } from './sources.js';
import { ASSESSMENT_THRESHOLD, readAssessment, type AssessedJudgment } from './assessment.js';
import { tallySources, type SourceTally } from './source-tally.js';
import { abstentionReason, decideLabel, rankedSources, type VerdictRules } from './verdict-rules.js';
import { VERDICT_SUMMARIES, wireName } from './outcomes.js';

const thresholds = { supported: 0.85, contradicted: 0.90, misleading: 0.85 };
const abstain = (reasonCode: string): VerdictDecision => ({ verdict: 'insufficient_evidence', reasonCode, selectedEvidenceIds: [], summary: VERDICT_SUMMARIES.insufficient_evidence });
const LABELS: Verdict[] = ['supported', 'contradicted', 'misleading', 'insufficient_evidence'];

/** What the ported rules need beyond the judgment: each retained passage's site and trust, in evidence order,
 * the admitted claim frame and the exact checked text. */
export type VerdictContext = { traits: SourceTraits[]; frame: ClaimFrame; checkedText: string };
/** A decision with the counted sources behind it and the label the ported rules chose before the strict gate. */
export type VerdictAssessment = { decision: VerdictDecision; tally: SourceTally; ruleLabel: Verdict };

function validate(judgment: Judgment): Map<string, Evidence> {
  if (!LABELS.includes(judgment.label) || LABELS.some(label => !Number.isFinite(judgment.probabilities[label]) || judgment.probabilities[label] < 0 || judgment.probabilities[label] > 1)) {
    throw new PipelineError('malformed_provider');
  }
  if (!Array.isArray(judgment.selectedEvidenceIds)) throw new PipelineError('malformed_provider');
  const retained = new Map(judgment.evidence.map(source => [source.id, source]));
  if (retained.size !== judgment.evidence.length || judgment.selectedEvidenceIds.some(id => !retained.has(id))
    || judgment.misleadingEvidenceIds?.some(id => !retained.has(id))) throw new PipelineError('invalid_citation');
  return retained;
}

/**
 * The only function that assigns factual labels. Provider failures are not input.
 * With `context` (the evidence-sources pipeline) the ported reference rules decide the label, then the strict
 * health/safety/disputed gate applies. Without it (fixture mode and the console) the original rubric decides.
 */
export function decideVerdict(judgment: Judgment, context?: VerdictContext, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY): VerdictDecision {
  return context ? assessVerdict(judgment, context, registry).decision : legacyDecision(judgment, registry);
}

export function assessVerdict(judgment: Judgment, context: VerdictContext, registry: readonly ReviewedSourceRule[] = SOURCE_REGISTRY, rules?: VerdictRules): VerdictAssessment {
  validate(judgment);
  if (context.traits.length !== judgment.evidence.length) throw new PipelineError('malformed_evidence');
  const assessment = readAssessment(judgment);
  const commonOrigins = (assessment?.originAssessments ?? [])
    .filter(pair => pair.relationship === 'common_origin' && pair.confidence >= ASSESSMENT_THRESHOLD)
    .map(pair => pair.evidenceIds);
  const tally = tallySources(
    judgment.evidence.map(source => ({ evidenceId: source.id, text: source.excerpt, stance: source.stance, probability: source.stanceProbability ?? 0 })),
    context.traits, context.checkedText,
    { ratedMisleading: judgment.evidence.filter(source => source.origin === 'fact_check' && source.rating === 'misleading').map(source => source.id), commonOrigins },
  );
  const ruleLabel = decideLabel(judgment.label, judgment.probabilities, tally, rules);
  const done = (decision: VerdictDecision): VerdictAssessment => ({ decision, tally, ruleLabel });
  if (ruleLabel === 'insufficient_evidence') return done(abstain(judgment.evidence.length ? abstentionReason(judgment.label, judgment.probabilities, tally, rules) : 'no_evidence'));

  // Eric's stricter route: a True or False on a health/safety, disputed or uncertain-stakes claim also needs a
  // reviewed expert anchor plus an independently corroborating passage with a disclosed distinct origin.
  if ((ruleLabel === 'supported' || ruleLabel === 'contradicted') && needsStrongEvidence(context.checkedText, assessment)) {
    const agreeing = judgment.evidence.filter(source => source.stance === (ruleLabel === 'supported' ? 'supports' : 'contradicts'));
    if (!qualifyingSourceSet(agreeing, context.checkedText, assessment, registry, judgment.evidence).length) return done(abstain('insufficient_independent_evidence'));
  }
  const cited = rankedSources(ruleLabel, tally).slice(0, 6);
  if (!cited.length) return done(abstain('no_agreeing_citation'));
  const decision: VerdictDecision = {
    verdict: ruleLabel,
    reasonCode: ruleLabel === 'misleading' ? judgment.misleadingReason ?? (tally.ratedMisleading.length ? 'rated_misleading' : 'mixed_evidence') : 'qualifying_evidence',
    selectedEvidenceIds: cited,
    summary: VERDICT_SUMMARIES[ruleLabel],
  };
  const basis = (judgment as AssessedJudgment).basis;
  if (context.frame.future && basis && RESULT_BASES.includes(basis)) decision.basis = basis;
  const attribution = attributionFor(ruleLabel, context.frame);
  if (attribution) decision.attribution = attribution;
  return done(decision);
}

/** "Politico reported this" goes with supported and "Not what Kushner said" with contradicted. */
function attributionFor(label: Verdict, frame: ClaimFrame): ResultAttribution | undefined {
  const source = frame.attribution ? wireName(frame.attribution.source) : null;
  if (!frame.attribution || !source || (label !== 'supported' && label !== 'contradicted')) return undefined;
  return { label: label === 'supported' ? 'reported' : 'not_said', source, mode: frame.attribution.mode };
}

function legacyDecision(judgment: Judgment, registry: readonly ReviewedSourceRule[]): VerdictDecision {
  validate(judgment);
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
  // An explicit provider choice of none remains an abstention. A valid retained
  // preference is otherwise an ordering hint: only the fully qualified set may
  // replace it, after every factual, context and risk-specific gate above passes.
  if (!judgment.selectedEvidenceIds.length) return abstain('no_agreeing_citation');
  return {
    verdict: judgment.label,
    reasonCode: judgment.label === 'misleading' ? judgment.misleadingReason! : 'qualifying_evidence',
    selectedEvidenceIds: [...new Set([...chosen, ...qualified.map(source => source.id)])],
    // Exact excerpts stay in evidence, not model-generated prose or corrected numbers.
    summary: VERDICT_SUMMARIES[judgment.label],
  };
}
