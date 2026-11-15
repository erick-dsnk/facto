import { CLAIM_LABELS, EVAL_LABELS, SKIP_LABELS, VERDICT_LABELS, type EvalLabel } from './labels.js';
import type { EvalRow } from './driver.js';
import { EVAL_SETS, type EvalSet } from './sets.js';

export type Ratio = { count: number; total: number; share: number | null };
export type SetMetrics = {
  set: EvalSet; cases: number;
  /** Rows expected true, false, misleading or Can't verify, scored on exact label. */
  fourLabel: Ratio;
  /** Every row, scored on exact label (speculation, not_a_claim and needs_confirmation included). */
  outcome: Ratio;
  /** True called false plus false called true. */
  wrongTrueFalse: number; trueCalledFalse: number; falseCalledTrue: number;
  /** Over rows where a claim was expected (the four labels and speculation). */
  cantVerify: Ratio;
  /** Skip, needs_confirmation, not_a_claim or error where a claim was expected. */
  skips: Ratio;
  errors: number;
  latencyMs: { median: number | null; p95: number | null; measured: number };
  /** Means over rows whose terminal event carried `usage`; null ("n/a") when none did. */
  exaSearchesPerCheck: number | null; jevCallsPerCheck: number | null; usageRows: number;
  fieldUnsupported: number;
  confusion: Partial<Record<EvalLabel, Partial<Record<EvalLabel, number>>>>;
};
export type RunMetrics = Partial<Record<EvalSet, SetMetrics>>;

const ratio = (count: number, total: number): Ratio => ({ count, total, share: total ? count / total : null });
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
/** Nearest-rank percentile. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length))) - 1];
}

export function computeMetrics(rows: EvalRow[], set: EvalSet): SetMetrics {
  const own = rows.filter(row => row.set === set);
  const verdictRows = own.filter(row => (VERDICT_LABELS as readonly EvalLabel[]).includes(row.expected));
  const claimRows = own.filter(row => CLAIM_LABELS.has(row.expected));
  const count = (expected: EvalLabel, predicted: EvalLabel) => own.filter(row => row.expected === expected && row.predicted === predicted).length;
  const latencies = own.flatMap(row => row.latencyMs === null ? [] : [row.latencyMs]);
  const usage = own.filter(row => row.jevCalls !== null && row.exaSearches !== null);
  const confusion: SetMetrics['confusion'] = {};
  for (const row of own) {
    const line = confusion[row.expected] ??= {};
    line[row.predicted] = (line[row.predicted] ?? 0) + 1;
  }
  const trueCalledFalse = count('true', 'false');
  const falseCalledTrue = count('false', 'true');
  return {
    set, cases: own.length,
    fourLabel: ratio(verdictRows.filter(row => row.predicted === row.expected).length, verdictRows.length),
    outcome: ratio(own.filter(row => row.predicted === row.expected).length, own.length),
    wrongTrueFalse: trueCalledFalse + falseCalledTrue, trueCalledFalse, falseCalledTrue,
    cantVerify: ratio(claimRows.filter(row => row.predicted === 'cant_verify').length, claimRows.length),
    skips: ratio(claimRows.filter(row => SKIP_LABELS.has(row.predicted)).length, claimRows.length),
    errors: own.filter(row => row.predicted === 'error').length,
    latencyMs: { median: median(latencies), p95: percentile(latencies, 0.95), measured: latencies.length },
    exaSearchesPerCheck: mean(usage.map(row => row.exaSearches!)), jevCallsPerCheck: mean(usage.map(row => row.jevCalls!)), usageRows: usage.length,
    fieldUnsupported: own.filter(row => row.fieldUnsupported).length,
    confusion,
  };
}

export function computeRunMetrics(rows: EvalRow[]): RunMetrics {
  const metrics: RunMetrics = {};
  for (const set of EVAL_SETS) if (rows.some(row => row.set === set)) metrics[set] = computeMetrics(rows, set);
  return metrics;
}

export const SHIP_LIMITS = { medianMs: 4_000, p95Ms: 10_000 } as const;
export type ShipCheck = { name: string; pass: boolean; detail: string };
const wrongRate = (metrics: SetMetrics) => metrics.cases ? metrics.wrongTrueFalse / metrics.cases : 0;
const abstain = (metrics: SetMetrics) => (metrics.cantVerify.share ?? 0) + (metrics.skips.share ?? 0);
const pct = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
const seconds = (ms: number | null) => ms === null ? 'n/a' : `${(ms / 1000).toFixed(2)} s`;

/**
 * The ship rule: wrong True/False not higher on either set (as a share of cases, which equals the count when the
 * sets match), Can't verify + skips lower on EVERYDAY, and the candidate's median under 4 s and P95 under 10 s.
 */
export function shipRule(baseline: RunMetrics, candidate: RunMetrics): { pass: boolean; checks: ShipCheck[] } {
  const checks: ShipCheck[] = [];
  const shared = EVAL_SETS.filter(set => baseline[set] && candidate[set]);
  if (!shared.length) checks.push({ name: 'comparable sets', pass: false, detail: 'baseline and candidate share no set' });
  for (const set of shared) {
    const before = baseline[set]!; const after = candidate[set]!;
    checks.push({ name: `${set}: wrong True/False not higher`, pass: wrongRate(after) <= wrongRate(before),
      detail: `${before.wrongTrueFalse}/${before.cases} -> ${after.wrongTrueFalse}/${after.cases}` });
  }
  const before = baseline.everyday; const after = candidate.everyday;
  checks.push(before && after
    ? { name: "everyday: Can't verify + skips lower", pass: abstain(after) < abstain(before), detail: `${pct(abstain(before))} -> ${pct(abstain(after))}` }
    : { name: "everyday: Can't verify + skips lower", pass: false, detail: 'EVERYDAY missing from a run' });
  for (const set of EVAL_SETS) {
    const metrics = candidate[set];
    if (!metrics) continue;
    const { median: mid, p95 } = metrics.latencyMs;
    checks.push({ name: `${set}: median < 4 s`, pass: mid !== null && mid < SHIP_LIMITS.medianMs, detail: seconds(mid) });
    checks.push({ name: `${set}: P95 < 10 s`, pass: p95 !== null && p95 < SHIP_LIMITS.p95Ms, detail: seconds(p95) });
  }
  return { pass: checks.every(check => check.pass), checks };
}

export const formatShipRule = (result: ReturnType<typeof shipRule>) =>
  [...result.checks.map(check => `${check.pass ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`), `Ship rule: ${result.pass ? 'PASS' : 'FAIL'}`].join('\n');

const fraction = (value: Ratio) => value.total ? `${value.count}/${value.total} (${pct(value.share)})` : 'n/a';
const perCheck = (value: number | null, rows: number) => value === null ? 'n/a' : `${value.toFixed(2)} (${rows} rows)`;
const METRIC_ROWS: [string, (metrics: SetMetrics) => string][] = [
  ['Cases', metrics => String(metrics.cases)],
  ['Accuracy, 4 labels', metrics => fraction(metrics.fourLabel)],
  ['Outcome accuracy, all labels', metrics => fraction(metrics.outcome)],
  ['Wrong True/False', metrics => `${metrics.wrongTrueFalse} (${metrics.trueCalledFalse} true called false, ${metrics.falseCalledTrue} false called true)`],
  ["Can't verify share", metrics => fraction(metrics.cantVerify)],
  ['Skip share', metrics => fraction(metrics.skips)],
  ['Errors and timeouts', metrics => String(metrics.errors)],
  ['Latency median / P95', metrics => `${seconds(metrics.latencyMs.median)} / ${seconds(metrics.latencyMs.p95)}`],
  ['Exa searches per check', metrics => perCheck(metrics.exaSearchesPerCheck, metrics.usageRows)],
  ['Jev calls per check', metrics => perCheck(metrics.jevCallsPerCheck, metrics.usageRows)],
];

/** One column per run and set, e.g. "everyday: baseline | everyday: candidate | hard: baseline | hard: candidate". */
export function markdownTable(runs: { label: string; metrics: RunMetrics }[]): string {
  const columns = EVAL_SETS.flatMap(set => runs.filter(run => run.metrics[set]).map(run => ({ title: `${set.toUpperCase()}: ${run.label}`, metrics: run.metrics[set]! })));
  const lines = [`| Metric | ${columns.map(column => column.title).join(' | ')} |`, `|---|${columns.map(() => '---').join('|')}|`];
  for (const [name, cell] of METRIC_ROWS) lines.push(`| ${name} | ${columns.map(column => cell(column.metrics)).join(' | ')} |`);
  return lines.join('\n');
}

/** Expected labels down, predicted across; only labels that occur. */
export function confusionTable(metrics: SetMetrics): string {
  const expected = EVAL_LABELS.filter(label => metrics.confusion[label]);
  const predicted = EVAL_LABELS.filter(label => expected.some(row => metrics.confusion[row]?.[label]));
  const lines = [`| expected \\ predicted | ${predicted.join(' | ')} |`, `|---|${predicted.map(() => '---').join('|')}|`];
  for (const row of expected) lines.push(`| ${row} | ${predicted.map(label => metrics.confusion[row]?.[label] ?? 0).join(' | ')} |`);
  return lines.join('\n');
}
