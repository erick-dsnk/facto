import { describe, expect, it } from 'vitest';
import type { EvalRow } from './driver.js';
import type { EvalLabel } from './labels.js';
import { computeMetrics, computeRunMetrics, confusionTable, formatShipRule, markdownTable, median, percentile, shipRule, type RunMetrics } from './metrics.js';
import type { EvalSet } from './sets.js';

let next = 0;
const row = (expected: EvalLabel, predicted: EvalLabel, extra: Partial<EvalRow> = {}): EvalRow => ({
  set: 'everyday', id: `r${next++}`, expected, predicted, reasonCode: null, latencyMs: 1_000, jevCalls: null, exaSearches: null, ...extra,
});

describe('live eval metrics', () => {
  it('computes median and nearest-rank P95', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(percentile(Array.from({ length: 20 }, (_, index) => index + 1), 0.95)).toBe(19);
    expect(percentile([5], 0.95)).toBe(5);
    expect(percentile([], 0.95)).toBeNull();
  });

  it('scores accuracy, wrong True/False, Can\'t verify and skips per set', () => {
    const rows = [
      row('true', 'true', { latencyMs: 1_000, jevCalls: 2, exaSearches: 1 }),
      row('true', 'false', { latencyMs: 3_000, jevCalls: 3, exaSearches: 2 }),
      row('false', 'true', { latencyMs: 2_000 }),
      row('false', 'false', { latencyMs: 4_000 }),
      row('misleading', 'cant_verify', { latencyMs: 5_000 }),
      row('cant_verify', 'cant_verify', { latencyMs: 6_000 }),
      row('speculation', 'speculation', { latencyMs: 500 }),
      row('true', 'skip', { latencyMs: 700 }),
      row('false', 'error', { latencyMs: null, reasonCode: 'http_unreachable' }),
      row('not_a_claim', 'not_a_claim', { latencyMs: 300 }),
      row('needs_confirmation', 'true', { latencyMs: 800, fieldUnsupported: true }),
      row('true', 'true', { set: 'hard' }),
    ];
    const metrics = computeMetrics(rows, 'everyday');
    expect(metrics.cases).toBe(11);
    // Four-label rows: 2 true + 1 skip-true, 3 false, misleading, cant_verify = 8; right: true, false, cant_verify.
    expect(metrics.fourLabel).toEqual({ count: 3, total: 8, share: 3 / 8 });
    // Exact on every label: those three plus speculation and not_a_claim.
    expect(metrics.outcome).toEqual({ count: 5, total: 11, share: 5 / 11 });
    expect(metrics).toMatchObject({ wrongTrueFalse: 2, trueCalledFalse: 1, falseCalledTrue: 1, errors: 1, fieldUnsupported: 1 });
    // Claim rows add speculation: 9.
    expect(metrics.cantVerify).toEqual({ count: 2, total: 9, share: 2 / 9 });
    expect(metrics.skips).toEqual({ count: 2, total: 9, share: 2 / 9 });
    // Ten measured latencies (the error has none): 300 … 6,000, middle pair 1,000 and 2,000.
    expect(metrics.latencyMs).toEqual({ median: 1_500, p95: 6_000, measured: 10 });
    expect(metrics).toMatchObject({ exaSearchesPerCheck: 1.5, jevCallsPerCheck: 2.5, usageRows: 2 });
    expect(metrics.confusion.true).toEqual({ true: 1, false: 1, skip: 1 });
    expect(computeRunMetrics(rows).hard?.cases).toBe(1);
  });

  it('reports usage as n/a when no terminal carried it', () => {
    const metrics = computeMetrics([row('true', 'true')], 'everyday');
    expect(metrics.exaSearchesPerCheck).toBeNull();
    expect(markdownTable([{ label: 'old', metrics: { everyday: metrics } }])).toContain('| Exa searches per check | n/a |');
  });

  it('writes one column per run and set and a confusion matrix', () => {
    const base = computeRunMetrics([row('true', 'cant_verify'), row('false', 'false', { set: 'hard' })]);
    const cand = computeRunMetrics([row('true', 'true'), row('false', 'false', { set: 'hard' })]);
    const table = markdownTable([{ label: 'baseline', metrics: base }, { label: 'candidate', metrics: cand }]);
    expect(table.split('\n')[0]).toBe('| Metric | EVERYDAY: baseline | EVERYDAY: candidate | HARD: baseline | HARD: candidate |');
    expect(table).toContain('| Accuracy, 4 labels | 0/1 (0.0%) | 1/1 (100.0%) | 1/1 (100.0%) | 1/1 (100.0%) |');
    expect(confusionTable(base.everyday!)).toBe('| expected \\ predicted | cant_verify |\n|---|---|\n| true | 1 |');
  });
});

describe('ship rule', () => {
  const metrics = (spec: Partial<Record<EvalSet, EvalRow[]>>): RunMetrics => computeRunMetrics(Object.values(spec).flat());
  const everyday = (rows: [EvalLabel, EvalLabel, number?][]) => rows.map(([expected, predicted, latencyMs]) => row(expected, predicted, { latencyMs: latencyMs ?? 1_000 }));
  const hard = (rows: [EvalLabel, EvalLabel][]) => rows.map(([expected, predicted]) => row(expected, predicted, { set: 'hard' }));

  it('passes when wrong True/False holds, abstentions drop and latency fits', () => {
    const baseline = metrics({ everyday: everyday([['true', 'cant_verify'], ['false', 'skip'], ['true', 'true']]), hard: hard([['true', 'false']]) });
    const candidate = metrics({ everyday: everyday([['true', 'true'], ['false', 'false'], ['true', 'cant_verify']]), hard: hard([['true', 'false']]) });
    const result = shipRule(baseline, candidate);
    expect(result.pass).toBe(true);
    expect(formatShipRule(result)).toContain('Ship rule: PASS');
  });

  it('fails when wrong True/False rises on either set', () => {
    const baseline = metrics({ everyday: everyday([['true', 'cant_verify'], ['false', 'false']]), hard: hard([['true', 'true']]) });
    const candidate = metrics({ everyday: everyday([['true', 'true'], ['false', 'false']]), hard: hard([['true', 'false']]) });
    const result = shipRule(baseline, candidate);
    expect(result.pass).toBe(false);
    expect(result.checks.find(check => check.name === 'hard: wrong True/False not higher')).toMatchObject({ pass: false, detail: '0/1 -> 1/1' });
  });

  it('fails when Can\'t verify plus skips do not drop on EVERYDAY', () => {
    const same = everyday([['true', 'cant_verify'], ['false', 'false']]);
    expect(shipRule(metrics({ everyday: same }), metrics({ everyday: same })).checks.find(check => check.name.startsWith('everyday: Can'))?.pass).toBe(false);
    expect(shipRule(metrics({ hard: hard([['true', 'true']]) }), metrics({ hard: hard([['true', 'true']]) })).pass).toBe(false);
  });

  it('fails on a slow median or P95', () => {
    const baseline = metrics({ everyday: everyday([['true', 'cant_verify'], ['false', 'false']]) });
    const slowMedian = metrics({ everyday: everyday([['true', 'true', 4_000], ['false', 'false', 4_000]]) });
    expect(shipRule(baseline, slowMedian).checks.find(check => check.name === 'everyday: median < 4 s')).toMatchObject({ pass: false, detail: '4.00 s' });
    const slowTail = metrics({ everyday: everyday([['true', 'true', 1_000], ['false', 'false', 10_000]]) });
    expect(shipRule(baseline, slowTail).checks.find(check => check.name === 'everyday: P95 < 10 s')?.pass).toBe(false);
  });
});
