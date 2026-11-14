import { describe, expect, it } from 'vitest';
import type { Observation } from './benchmark.js';
import { providerSummaries } from './summary.js';

const row = (provider: string, mode: string, id: string, expected: string, predicted: string, extra: Partial<Observation> = {}): Observation =>
  ({ provider, mode, id, repetition: 0, expected, predicted, reasonCode: null, durationMs: 100, asks: [], ...extra });
describe('provider summaries', () => {
  it('counts every case in the denominator and reports the primary score', () => {
    const rows: Observation[] = [
      row('jev', 'admission', 'a1', 'true', 'check', { admission: { action: 'check', claims: 1 }, durationMs: 10 }),
      row('jev', 'admission', 'a2', 'true', 'skip', { admission: { action: 'skip', claims: 0 }, durationMs: 30 }),
      row('jev', 'admission', 'a3', 'not_a_claim', 'check', { admission: { action: 'check', claims: 1 }, durationMs: 20 }),
      row('jev', 'admission', 'a4', 'not_a_claim', 'not_a_claim', { admission: { action: 'skip', claims: 0 } }),
      row('jev', 'pipeline', 'p1', 'true', 'true'), row('jev', 'pipeline', 'p2', 'false', 'true'), row('jev', 'pipeline', 'p3', 'cant_verify', 'cant_verify'),
      row('jev', 'pipeline', 'p4', 'true', 'skip'), row('jev', 'pipeline', 'p5', 'true', 'error', { error: 'timeout' }),
      row('jev', 'judge', 'p1', 'true', 'true'), row('jev', 'judge', 'p2', 'false', 'cant_verify'),
      row('laya', 'judge_extended', 'p1', 'true', 'error', { error: 'timeout' }),
    ];
    const [jev, laya] = providerSummaries(rows, ['jev', 'laya'], 'holdout');
    expect(jev.admission).toEqual({ total: 4, correct: 2, eligibleTotal: 2, eligibleRecalled: 1, negativesTotal: 2, falsePositives: 1, p50: 20, p95: 100 });
    expect(jev.pipeline).toEqual({ total: 5, correct: 2, definitive: 2, wrongDefinitive: 1, cantVerify: 1, skipped: 1, errors: 1, p50: 100, p95: 100 });
    expect(jev.judge).toMatchObject({ total: 2, correct: 1, definitive: 1, wrongDefinitive: 0, cantVerify: 1, errors: 0 });
    expect(jev).toMatchObject({ provider: 'jev', dataset: 'holdout', primary: 2 + 2 + 1 });
    expect(laya.judge).toMatchObject({ total: 1, correct: 0, errors: 1 }); expect(laya.admission.total).toBe(0); expect(laya.admission.p50).toBeNull();
  });
});
