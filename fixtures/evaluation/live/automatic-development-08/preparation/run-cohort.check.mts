import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COHORT_LIMITS, remainingLimits, runCohort } from './run-cohort.mts';

const cases = Array.from({ length: 6 }, (_, index) => ({ label: `case-${index}`, automatic: index < 5 }));
const report = () => ({ completed: true, counts: { localStops: 0, transportFailures: 0 }, totals: {
  calls: { jev: 1, search: 1, contents: 1 }, requestBytes: 1000, measuredInputTokens: 1000, unknownInputTokenReservations: 0,
  chargedInputTokens: 1000, knownCostUSD: 0.01, attemptsWithUnknownCost: 1, attempts: 3,
} });

test('each isolated invocation receives only remaining cumulative allowances and spacing is outside result latency', async () => {
  let clock = 0; let runs = 0; const delays: number[] = [];
  const result = await runCohort({ cases, now: () => clock, sleep: async milliseconds => { delays.push(milliseconds); clock += milliseconds; },
    runOne: async (sample, limits) => {
      assert.equal(sample.label, `case-${runs}`); assert.equal(limits.calls.jev, 24 - runs); assert.equal(limits.calls.search, 12 - runs);
      assert.equal(limits.totalRequestBytes, 1_000_000 - runs * 1000); assert.equal(limits.inputTokens, 180_000 - runs * 1000);
      assert.equal(limits.wallMs, 90_000 - clock); runs++; clock += 1000; return report();
    } });
  assert.equal(result.completed, true); assert.deepEqual(delays, [4100, 4100, 4100, 4100]);
  assert.deepEqual(result.totals.calls, { jev: 6, search: 6, contents: 6 }); assert.equal(result.totals.chargedInputTokens, 6000);
  assert.equal(result.totals.elapsedMs, 22_400); assert.equal(result.totals.attemptsWithUnknownCost, 6);
});

test('unknown finalized Jev usage and local stop prevent the next invocation without resetting budget', async () => {
  for (const kind of ['unknown', 'local'] as const) {
    let runs = 0;
    const result = await runCohort({ cases, runOne: async () => {
      runs++; const value = report();
      if (kind === 'unknown') { value.totals.unknownInputTokenReservations = 24_000; value.totals.chargedInputTokens = 25_000; }
      else { value.counts.localStops = 1; value.completed = false; }
      return value;
    } });
    assert.equal(runs, 1); assert.equal(result.completed, false);
    assert.equal(result.stopReason, kind === 'unknown' ? 'unknown_completed_jev_usage' : 'case_incomplete_or_local_stop');
  }
});

test('exhausted caps are never rounded up and no-case allowance stops before dispatch', async () => {
  const exhausted = report(); exhausted.totals.calls.search = 12; exhausted.totals.attempts = 14;
  assert.equal(remainingLimits([exhausted], 0), null);
  assert.equal(remainingLimits([], COHORT_LIMITS.wallMs), null);
  const tokenExhausted = report(); tokenExhausted.totals.measuredInputTokens = 160_000; tokenExhausted.totals.chargedInputTokens = 160_000;
  assert.equal(remainingLimits([tokenExhausted], 0), null);
  let clock = 0; let runs = 0;
  const result = await runCohort({ cases, now: () => clock, sleep: async ms => { clock += ms; }, runOne: async () => { runs++; clock += 89_500; return report(); } });
  assert.equal(runs, 1); assert.equal(clock, 90_000); assert.equal(result.stopReason, 'cumulative_limit');
});

test('actual overruns remain charged and stop further calls', async () => {
  let runs = 0;
  const result = await runCohort({ cases, runOne: async () => {
    runs++; const value = report(); value.totals.measuredInputTokens = 180_001; value.totals.chargedInputTokens = 180_001; return value;
  } });
  assert.equal(runs, 1); assert.equal(result.stopReason, 'actual_cumulative_overrun'); assert.equal(result.totals.chargedInputTokens, 180_001);
});

test('checkpoint failure cannot silently continue into another paid scenario', async () => {
  let runs = 0;
  await assert.rejects(() => runCohort({ cases, runOne: async () => { runs++; return report(); }, onCase: async () => { throw new Error('disk failure'); } }), /disk failure/);
  assert.equal(runs, 1);
});

test('late completion is recorded but does not claim compliance with the cohort wall limit', async () => {
  let clock = 0;
  const result = await runCohort({ cases, now: () => clock, runOne: async () => { clock = 90_001; return report(); } });
  assert.equal(result.stopReason, 'wall_limit'); assert.equal(result.completed, false); assert.equal(result.reports.length, 1);
});
