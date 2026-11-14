import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Evidence, Presentation } from '../../../../packages/contracts/src/index.js';
import type { LiveCase } from './cases.js';

type MetricReport = {
  label: string; terminalReceived: boolean; status: string; admittedPublic: string[]; rejectedAdmissionCount?: number;
  admission?: { action: string }; events: { type: string; claimId?: string; checkedPublicText?: string; verdict?: string; cached?: boolean;
    selectedEvidenceIds?: string[]; evidence?: Evidence[]; presentation?: Presentation }[];
};
const citationReviewSchema = z.object({
  caseLabel: z.string().min(1), expectedClaimId: z.string().min(1), evidenceId: z.string().min(1), url: z.url(),
  excerptSHA256: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(['verified', 'unsupported', 'inaccessible']),
  reviewedAt: z.iso.datetime({ offset: true }), reviewer: z.enum(['human', 'independent_agent']), note: z.string().min(1).max(2000),
}).strict();
export type CitationReview = z.infer<typeof citationReviewSchema>;
export const excerptSHA256 = (excerpt: string) => createHash('sha256').update(excerpt).digest('hex');
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;

/** External review is tied to the exact returned quote, never inferred from a verdict or host. */
export function summarizeCampaign(cases: LiveCase[], reports: MetricReport[], reviewInput: unknown = []) {
  const reviews = z.array(citationReviewSchema).parse(reviewInput);
  const reviewKey = (review: CitationReview) => JSON.stringify([review.caseLabel, review.expectedClaimId, review.evidenceId]);
  if (new Set(reviews.map(reviewKey)).size !== reviews.length) throw new Error('Duplicate citation reviews');
  if (new Set(reports.map(report => report.label)).size !== reports.length || reports.some(report => !cases.some(sample => sample.label === report.label))) throw new Error('Unexpected or duplicate case reports');
  const usedReviews = new Set<CitationReview>();
  let truePositives = 0; let falsePositives = 0; let falseNegatives = 0; let unobservedExpected = 0;
  const claimOutcomes: { caseLabel: string; expectedClaimId: string; domain: string; expectedVerdict: string; verdict: string | null;
    result: 'correct' | 'wrong' | 'abstained' | 'no_result' | 'not_observed'; cached: boolean | null;
    sourceVerification: 'verified' | 'failed' | 'unreviewed' | 'not_applicable'; selectedReferences: number }[] = [];
  let admissionActionChecks = 0; let admissionActionMatches = 0; let presentationChecks = 0; let presentationMatches = 0;
  for (const sample of cases) {
    if (!sample.expected) continue;
    const report = reports.find(report => report.label === sample.label);
    if (!report) unobservedExpected += sample.expected.claims.length;
    const unmatched = new Set(sample.expected.claims.map(claim => claim.id));
    falsePositives += report?.rejectedAdmissionCount ?? 0;
    for (const text of report?.admittedPublic ?? []) {
      const match = sample.expected.claims.find(claim => claim.acceptedTexts.includes(text) && unmatched.has(claim.id));
      if (match) { truePositives++; unmatched.delete(match.id); } else falsePositives++;
    }
    falseNegatives += unmatched.size;
    if (sample.expected.admissionAction) {
      admissionActionChecks++;
      if (report?.admission?.action === sample.expected.admissionAction) admissionActionMatches++;
    }
    if (sample.expected.presentationActions) {
      presentationChecks++;
      const presentations = report?.events.filter(event => event.presentation).map(event => event.presentation!.action) ?? [];
      if (report?.terminalReceived && presentations.length && presentations.every(action => sample.expected!.presentationActions!.includes(action))) presentationMatches++;
    }
    for (const claim of sample.expected.claims) {
      const results = report?.events.filter(event => event.type === 'claim.result' && event.checkedPublicText && claim.acceptedTexts.includes(event.checkedPublicText)) ?? [];
      // Multiple final outputs for one expected proposition cannot earn coverage credit.
      const event = results.length === 1 ? results[0] : undefined;
      const definitive = event?.verdict !== undefined && event.verdict !== 'insufficient_evidence';
      const result = !report ? 'not_observed' : !event ? 'no_result' : !definitive ? 'abstained' : event.verdict === claim.verdict ? 'correct' : 'wrong';
      const selected = event?.selectedEvidenceIds ?? [];
      const statuses = selected.map(id => {
        const evidence = event?.evidence?.find(record => record.id === id);
        const review = reviews.find(item => item.caseLabel === sample.label && item.expectedClaimId === claim.id && item.evidenceId === id);
        if (review) {
          if (!evidence || review.url !== evidence.url || review.excerptSHA256 !== excerptSHA256(evidence.excerpt)) throw new Error('Citation review does not match the retained source');
          usedReviews.add(review);
        }
        return review?.status ?? 'unreviewed';
      });
      const sourceVerification = !definitive ? 'not_applicable' : statuses.some(status => status === 'unsupported' || status === 'inaccessible') ? 'failed'
        : selected.length && new Set(selected).size === selected.length && statuses.every(status => status === 'verified') ? 'verified' : 'unreviewed';
      claimOutcomes.push({ caseLabel: sample.label, expectedClaimId: claim.id, domain: claim.domain, expectedVerdict: claim.verdict,
        verdict: event?.verdict ?? null, result, cached: event?.cached ?? null, sourceVerification, selectedReferences: selected.length });
    }
  }
  if (usedReviews.size !== reviews.length) throw new Error('Citation review does not identify an observed selected reference');
  const summarize = (outcomes: typeof claimOutcomes) => ({ expected: outcomes.length, correctDefinitive: outcomes.filter(item => item.result === 'correct').length,
    wrongDefinitive: outcomes.filter(item => item.result === 'wrong').length, abstained: outcomes.filter(item => item.result === 'abstained').length,
    noResult: outcomes.filter(item => item.result === 'no_result').length, notObserved: outcomes.filter(item => item.result === 'not_observed').length,
    sourceVerifiedCorrect: outcomes.filter(item => item.result === 'correct' && item.sourceVerification === 'verified').length,
    coldCorrect: outcomes.filter(item => item.result === 'correct' && item.cached === false).length,
    cachedResults: outcomes.filter(item => item.cached === true).length,
    definitiveCoverage: ratio(outcomes.filter(item => item.result === 'correct').length, outcomes.length),
    sourceVerifiedCoverage: ratio(outcomes.filter(item => item.result === 'correct' && item.sourceVerification === 'verified').length, outcomes.length) });
  // Binary truth errors use expected supported/contradicted labels only. A
  // missing, duplicated or invalid result is not an observed negative outcome.
  const binaryCounts = (outcomes: typeof claimOutcomes) => {
    const definitive = outcomes.filter(item => (item.result === 'correct' || item.result === 'wrong')
      && ['supported', 'contradicted', 'misleading'].includes(item.verdict ?? ''));
    const abstained = outcomes.filter(item => item.result === 'abstained' && item.verdict === 'insufficient_evidence').length;
    const notObserved = outcomes.filter(item => item.result === 'not_observed').length;
    return { declared: outcomes.length, completed: definitive.length + abstained, definitive: definitive.length, abstained,
      noResult: outcomes.length - definitive.length - abstained - notObserved, notObserved };
  };
  const trueGold = claimOutcomes.filter(item => item.expectedVerdict === 'supported');
  const falseGold = claimOutcomes.filter(item => item.expectedVerdict === 'contradicted');
  const trueGoldCounts = binaryCounts(trueGold), falseGoldCounts = binaryCounts(falseGold);
  const falseAlarms = trueGold.filter(item => item.result === 'wrong' && ['contradicted', 'misleading'].includes(item.verdict ?? '')).length;
  const falseSupports = falseGold.filter(item => item.result === 'wrong' && item.verdict === 'supported').length;
  const errorRates = (count: number, counts: ReturnType<typeof binaryCounts>) => ({ count,
    completedChecks: { numerator: count, denominator: counts.completed, rate: ratio(count, counts.completed) },
    definitiveOnly: { numerator: count, denominator: counts.definitive, rate: ratio(count, counts.definitive) } });
  const factualErrorRates = {
    unit: 'One expected proposition matched to exactly one valid factual result; completed checks include abstentions, definitive-only checks exclude them.',
    trueGold: trueGoldCounts, falseGold: falseGoldCounts,
    falseAlarm: { definition: 'Expected supported (true), predicted contradicted or misleading.', ...errorRates(falseAlarms, trueGoldCounts) },
    falseSupport: { definition: 'Expected contradicted (false), predicted supported.', ...errorRates(falseSupports, falseGoldCounts) },
    excludedGoldMisleading: binaryCounts(claimOutcomes.filter(item => item.expectedVerdict === 'misleading')),
    limitations: ['Gold misleading is not interpreted as a binary truth label; unlabeled cases are excluded.',
      'No-result, duplicate-result, malformed-verdict and not-observed outcomes are excluded from both observed denominators, never counted as true negatives.',
      'Abstentions remain visible and in completed-check denominators; lower error rates with more abstention do not establish useful coverage.',
      'These empirical finite-cohort rates do not estimate population accuracy or certify source verification.'],
  };
  return {
    labeledCases: cases.filter(sample => sample.expected).length, unlabeledCases: cases.filter(sample => !sample.expected).length,
    admission: { unit: 'final admitted exact proposition, matched once per expected claim; unsafe attempts counted without retaining their text', truePositives, falsePositives, falseNegatives, unobservedExpected,
      precision: ratio(truePositives, truePositives + falsePositives), recall: ratio(truePositives, truePositives + falseNegatives) },
    factual: summarize(claimOutcomes), byDomain: Object.fromEntries([...new Set(claimOutcomes.map(item => item.domain))].map(domain => [domain, summarize(claimOutcomes.filter(item => item.domain === domain))])),
    byExpectedVerdict: Object.fromEntries([...new Set(claimOutcomes.map(item => item.expectedVerdict))].map(verdict => [verdict, summarize(claimOutcomes.filter(item => item.expectedVerdict === verdict))])),
    actions: { admissionActionChecks, admissionActionMatches, presentationChecks, presentationMatches }, claimOutcomes, factualErrorRates,
    limitations: ['Admission metrics score final admitted propositions, not every overlapping internal candidate or model probability.',
      'Not-observed expected claims remain misses in declared-cohort recall and coverage; report unobservedExpected separately.',
      'Correct verdicts receive no source-verified coverage credit until every selected retained reference has explicit external review.',
      'Cache results and duplicate public propositions require separate cohort accounting; they are not independent cold factual samples.'],
  };
}
