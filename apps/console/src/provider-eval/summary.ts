import type { Observation } from './benchmark.js';

const DEFINITIVE = ['true', 'false', 'misleading'];
const SKIPPED = ['skip', 'not_a_claim', 'needs_confirmation', 'wait'];
const quantile = (values: number[], q: number): number | null => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] : null;
};
const claimExpected = (label: string) => !['not_a_claim', 'needs_confirmation'].includes(label);

export type AdmissionSummary = { total: number; correct: number; eligibleTotal: number; eligibleRecalled: number; negativesTotal: number; falsePositives: number; p50: number | null; p95: number | null };
export type DecisionSummary = { total: number; correct: number; definitive: number; wrongDefinitive: number; cantVerify: number; errors: number; p50: number | null; p95: number | null };
export type PipelineSummary = DecisionSummary & { skipped: number };
export type ProviderSummary = { provider: string; dataset: 'dev' | 'holdout'; admission: AdmissionSummary; pipeline: PipelineSummary; judge: DecisionSummary; primary: number };

const timing = (rows: Observation[]) => ({ p50: quantile(rows.map(row => row.durationMs), 0.5), p95: quantile(rows.map(row => row.durationMs), 0.95) });
function decision(rows: Observation[]): DecisionSummary {
  // Strict scoring: every case counts, so an abstention, skip or error is simply not correct.
  const definitive = rows.filter(row => DEFINITIVE.includes(row.predicted));
  return { total: rows.length, correct: rows.filter(row => row.expected === row.predicted).length, definitive: definitive.length, wrongDefinitive: definitive.filter(row => row.predicted !== row.expected).length,
    cantVerify: rows.filter(row => row.predicted === 'cant_verify').length, errors: rows.filter(row => row.error).length, ...timing(rows) };
}

/** One object per provider with the headline numbers of each mode; durations are milliseconds. */
export function providerSummaries(rows: Observation[], providers: string[], dataset: 'dev' | 'holdout'): ProviderSummary[] {
  return providers.map(provider => {
    const mine = rows.filter(row => row.provider === provider);
    const admissionRows = mine.filter(row => row.mode === 'admission');
    const pipelineRows = mine.filter(row => row.mode === 'pipeline');
    const judgeRows = mine.filter(row => row.mode.startsWith('judge'));
    const eligible = admissionRows.filter(row => claimExpected(row.expected));
    const negatives = admissionRows.filter(row => !claimExpected(row.expected));
    const admission: AdmissionSummary = {
      total: admissionRows.length,
      correct: admissionRows.filter(row => !row.error && (row.admission?.action === 'check') === claimExpected(row.expected)).length,
      eligibleTotal: eligible.length, eligibleRecalled: eligible.filter(row => row.admission?.action === 'check').length,
      negativesTotal: negatives.length, falsePositives: negatives.filter(row => row.admission?.action === 'check').length, ...timing(admissionRows),
    };
    const pipeline: PipelineSummary = { ...decision(pipelineRows), skipped: pipelineRows.filter(row => SKIPPED.includes(row.predicted)).length };
    const judge = decision(judgeRows);
    return { provider, dataset, admission, pipeline, judge, primary: admission.correct + pipeline.correct + judge.correct };
  });
}
