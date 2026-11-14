import { describe, expect, it } from 'vitest';
import { evaluateCase, loadCases, loadManifest, runEvaluation } from './evaluate.js';

describe('evaluation reporting', () => {
  it('reserves 12 of 48 cases before tuning with the required category mix', async () => {
    const manifest = await loadManifest();
    const cases = await loadCases();
    expect(manifest.cases).toHaveLength(48);
    expect(new Set(manifest.cases.map(sample => sample.id)).size).toBe(48);
    expect(manifest.cases.filter(sample => sample.split === 'heldout')).toHaveLength(12);
    expect(cases).toHaveLength(36);
    expect(cases.every(sample => sample.split === 'development')).toBe(true);
    const counts = Object.fromEntries(['personal', 'public', 'mixed', 'capture', 'service'].map(category => [category, manifest.cases.filter(sample => sample.category === category).length]));
    expect(counts).toEqual({ personal: 12, public: 12, mixed: 8, capture: 8, service: 8 });
  });
  it('runs real policy decisions and detects an incorrect independent expected action', async () => {
    const sample = (await loadCases()).find(sample => sample.id === 'E14')!;
    expect((await evaluateCase(sample)).presentation).toBe('silent');
    const mutated = { ...sample, expected: { ...sample.expected, presentation: 'notify' as const } };
    expect((await evaluateCase(mutated)).status).toBe('fail');
  });
  it('measures correction cancellation and a provider deadline through authenticated runtime transport', async () => {
    const cases = (await loadCases()).filter(sample => ['E33', 'E43'].includes(sample.id));
    const report = await runEvaluation(cases);
    expect(report.counts).toMatchObject({ selected: 2, passed: 2, failed: 0, notRun: 0, heldoutReserved: 12 });
    expect(report.coverage).toMatchObject({ runtimeTransport: 2, runtimeDeadline: 1, runtimeCorrections: 1 });
    expect(report.observations.map(sample => sample.method)).toEqual(['injected_runtime_transport', 'injected_runtime_transport']);
    expect(report.observations[0].testedStages).toContain('runtime_revision_cancellation');
    expect(report.observations[1].testedStages).toContain('runtime_provider_deadline');
    expect(report.observations[1].durationMs).toBeGreaterThanOrEqual(9_500);
    expect(report.metrics.liveLatencyMedianMs).toBeNull();
    expect(report.metrics.privateQueryLeakage).toBeNull();
  }, 15_000);
  it('does not execute held-out cases in its default run', async () => {
    const cases = (await loadCases()).filter(sample => ['E13', 'E22'].includes(sample.id));
    const report = await runEvaluation(cases);
    expect(report.observations.map(sample => sample.id)).toEqual(['E13']);
  });
});
