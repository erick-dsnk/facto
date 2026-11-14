import type { Verdict } from '../../../../packages/contracts/src/index.js';
import { rankedByStance, TALLY_DEFAULTS, type SourceTally } from './source-tally.js';

/** Ported from the reference app's VerdictRules.swift and Config.swift. A wrong True or False costs more than a
 * missing answer, so anything short of these conditions is Can't verify. */
export const RULES = {
  minProbabilityTrue: 0.6, minProbabilityFalse: 0.7, minProbabilityMisleading: 0.7, minProbabilityMixed: 0.55,
  stanceMinProbability: TALLY_DEFAULTS.stanceMinProbability, echoOverlap: TALLY_DEFAULTS.echoOverlap, echoMinTrigrams: TALLY_DEFAULTS.echoMinTrigrams,
} as const;

/** The label decided in code from Jev's joint verdict and the sources counted one voice per site. */
export function decideLabel(joint: Verdict, probabilities: Record<Verdict, number>, tally: SourceTally): Verdict {
  const c = tally.counts;
  const p = (label: Verdict) => Number.isFinite(probabilities[label]) ? probabilities[label] : 0;
  // True: Jev says supported, and two sites back it (an echo alone never does) or one trusted site does,
  // with no trusted site against it.
  if (joint === 'supported' && p('supported') >= RULES.minProbabilityTrue && c.trustedContradicting === 0
    && ((c.supporting >= 2 && tally.plainSupporting >= 1) || c.trustedSupporting >= 1)) return 'supported';
  // False: Jev says false, and two sites contradict it or one trusted site does. A trusted page that only
  // describes a myth often reads as backing it, so it doesn't block False.
  if (joint === 'contradicted' && p('contradicted') >= RULES.minProbabilityFalse
    && (c.contradicting >= 2 || c.trustedContradicting >= 1)) return 'contradicted';
  // Misleading: a fact-checker who checked this very claim rated it so, and Jev doesn't read it as true.
  if (tally.ratedMisleading.length > 0 && joint !== 'supported') return 'misleading';
  // Misleading: independent sites back it and contradict it, or Jev is sure it misleads and a source
  // contradicts part of it. Jev's "misleading" alone is never shown.
  if (tally.plainSupporting >= 1 && tally.plainContradicting >= 1 && p('misleading') >= RULES.minProbabilityMixed) return 'misleading';
  if (joint === 'misleading' && p('misleading') >= RULES.minProbabilityMisleading && c.contradicting >= 1) return 'misleading';
  return 'insufficient_evidence';
}

/** The evidence that agrees with `label`, best first. Misleading leads with a fact check rated so, then the sources
 * that contradict part of the claim, never one that backs it. An abstention cites nothing. */
export function rankedSources(label: Verdict, tally: SourceTally): string[] {
  switch (label) {
    case 'supported': return rankedByStance(tally, 'supports');
    case 'contradicted': return rankedByStance(tally, 'contradicts');
    case 'misleading': return [...tally.ratedMisleading, ...rankedByStance(tally, 'contradicts').filter(id => !tally.ratedMisleading.includes(id))];
    case 'insufficient_evidence': return [];
  }
}

/** Why the rules abstained, for the result's reason code. */
export function abstentionReason(joint: Verdict, probabilities: Record<Verdict, number>, tally: SourceTally): string {
  const c = tally.counts;
  if (c.supporting === 0 && c.contradicting === 0 && tally.ratedMisleading.length === 0) return 'no_direct_evidence';
  if (joint === 'insufficient_evidence') return 'model_abstained';
  if (joint === 'supported' && c.trustedContradicting > 0) return 'conflicting_sources';
  const minimum = joint === 'supported' ? RULES.minProbabilityTrue : joint === 'contradicted' ? RULES.minProbabilityFalse : RULES.minProbabilityMisleading;
  if (!(probabilities[joint] >= minimum)) return 'below_threshold';
  return 'insufficient_independent_evidence';
}
