import { describe, expect, it } from 'vitest';
import { evaluateCase, loadCases, runEvaluation } from './evaluate.js';

describe('evaluation reporting', () => {
  it('reserves 12 of 48 cases before tuning with the required category mix', async () => {
    const cases = await loadCases();
    expect(cases).toHaveLength(48);
    expect(new Set(cases.map(sample => sample.id)).size).toBe(48);
    expect(cases.filter(sample => sample.split === 'heldout')).toHaveLength(12);
    const counts = Object.fromEntries(['personal', 'public', 'mixed', 'capture', 'service'].map(category => [category, cases.filter(sample => sample.category === category).length]));
    expect(counts).toEqual({ personal: 12, public: 12, mixed: 8, capture: 8, service: 8 });
  });
  it('runs real policy decisions and detects an incorrect independent expected action', async () => {
    const sample = (await loadCases()).find(sample => sample.id === 'E14')!;
    expect((await evaluateCase(sample)).presentation).toBe('silent');
    const mutated = { ...sample, expected: { ...sample.expected, presentation: 'notify' as const } };
    expect((await evaluateCase(mutated)).status).toBe('fail');
  });
  it('counts unavailable runtime checks separately from executed policy probes', async () => {
    const cases = (await loadCases()).filter(sample => ['E13', 'E43'].includes(sample.id));
    const report = await runEvaluation(cases);
    expect(report.counts).toMatchObject({ selected: 2, passed: 1, notRun: 1 });
    expect(report.metrics.liveLatencyMedianMs).toBeNull();
    expect(report.metrics.privateQueryLeakage).toBeNull();
  });
  it('does not execute held-out cases in its default run', async () => {
    const cases = (await loadCases()).filter(sample => ['E13', 'E22'].includes(sample.id));
    const report = await runEvaluation(cases);
    expect(report.observations.map(sample => sample.id)).toEqual(['E13']);
  });
});
