import { describe, expect, it, vi } from 'vitest';
import type { ProviderContext } from '../../packages/contracts/src/index.js';
import type { JevAnswer, JevClient, JevRequest } from '../../services/api/src/providers/jev/client.js';
import { buildSourceAssessmentExperimentRequest, createSourceAssessmentExperiment, type SourceAssessmentExperimentUnit } from './source-assessment-experiment.js';

const unit: SourceAssessmentExperimentUnit = {
  id: 'record-1', proposition: 'The port opened in 1902.', title: 'Port record', url: 'https://records.example/port',
  excerpt: 'SYNTHETIC municipal opening register, entry P-24: the port opened on 6 May 1902; the register records the inaugural vessel and ceremony.',
};
const context: ProviderContext = { signal: new AbortController().signal, consume: vi.fn(), now: () => 0 };
const oneHot = (request: JevRequest, name: string, selected: string): JevAnswer => {
  const question = request.questions[name];
  if (question.type !== 'choice') throw new Error('Expected a choice question');
  return { choice: selected, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === selected ? 1 : 0])) };
};
const positive = (request: JevRequest): Record<string, JevAnswer> => Object.fromEntries(Object.keys(request.questions).map(name => [name, oneHot(request, name, name.endsWith('_genre') ? 'original_record' : 'substantive')]));

describe('unwired source assessment experiment', () => {
  it('separates substantive decision from diagnostic genre without returning a verdict', async () => {
    const ask = vi.fn(async (request: JevRequest) => ({ ...positive(request), u0_genre: oneHot(request, 'u0_genre', 'unclear') }));
    const result = await createSourceAssessmentExperiment({ ask })([unit], context);
    expect(result[unit.id]).toEqual({ decision: 'substantive', confidence: 1, passesContentBasis: true, diagnosticGenre: 'unclear' });
    expect(result[unit.id]).not.toHaveProperty('verdict');
    expect(ask).toHaveBeenCalledOnce();
  });

  it.each([[.84, false], [.85, true]] as const)('preserves the content threshold at %s', async (probability, passes) => {
    const client: JevClient = { ask: async request => ({
      ...positive(request), u0_substantive_basis: { choice: 'substantive', probabilities: { substantive: probability, non_substantive: 1 - probability, insufficient: 0 } },
    }) };
    expect((await createSourceAssessmentExperiment(client)([unit], context))[unit.id].passesContentBasis).toBe(passes);
  });

  it.each([
    ['promotional effectiveness', 'SYNTHETIC advertisement: our supplement improves memory for everyone. Buy now.', 'non_substantive'],
    ['attributed belief', 'SYNTHETIC interview: the mayor says she believes the port opened in 1902; no record is supplied.', 'non_substantive'],
    ['generic assertion', 'The port opened in 1902. Everyone knows this.', 'non_substantive'],
    ['citation title only', 'References: Port Opening Register, 1902 edition. The contents are not reproduced.', 'non_substantive'],
    ['missing contents', 'The following table is unavailable in this excerpt.', 'insufficient'],
  ] as const)('keeps scripted %s decisions closed despite a record genre and impressive metadata', async (_name, excerpt, decision) => {
    const retained = { ...unit, title: 'Official authoritative research register', url: 'https://www.weather.gov/safety/lightning-myths', excerpt };
    const client: JevClient = { ask: async request => ({ ...positive(request), u0_substantive_basis: oneHot(request, 'u0_substantive_basis', decision) }) };
    const result = (await createSourceAssessmentExperiment(client)([retained], context))[unit.id];
    expect(result.diagnosticGenre).toBe('original_record');
    expect(result.passesContentBasis).toBe(false);
    expect(result.confidence).toBe(0);
    // Scripted answers verify the adapter boundary; public labelled calibration
    // must establish whether the provider actually recognizes these negatives.
  });

  it('does not convert substantive content or copied records into an independence decision', async () => {
    const copied = [unit, { ...unit, id: 'copy', url: 'https://mirror.example/record' }];
    const result = await createSourceAssessmentExperiment({ ask: async request => positive(request) })(copied, context);
    expect(Object.values(result).every(value => value.passesContentBasis)).toBe(true);
    expect(result).not.toHaveProperty('originAssessments');
    expect(result.copy).not.toHaveProperty('independent');
  });

  it('sends only bounded untrusted inputs, excluding independent labels and provenance notes', () => {
    const labelled = { ...unit, title: '🦉'.repeat(301), expectedBasis: 'substantive', provenanceNotes: 'SECRET LABEL', supportingSpan: 'answer' };
    const request = buildSourceAssessmentExperimentRequest([labelled]);
    expect(request.state).toEqual({ units: [{ id: unit.id, proposition: unit.proposition, retained: { url: unit.url, title: '🦉'.repeat(300), excerpt: unit.excerpt } }] });
    const decision = request.questions.u0_substantive_basis;
    expect(decision.instructions).toContain('cannot waive those gates');
    if (decision.type !== 'choice') throw new Error('Expected a choice question');
    expect(decision.criteria.substantive).toContain('title cannot supply missing evidence');
    expect(decision.criteria.non_substantive).toContain('official-looking URL');
    expect(decision.criteria.insufficient).toContain('another unit');
  });

  it('rejects malformed, unknown or missing decisions instead of promoting a genre answer', async () => {
    for (const mutate of [
      (request: JevRequest) => ({ ...positive(request), u0_substantive_basis: undefined }),
      (request: JevRequest) => ({ ...positive(request), u0_substantive_basis: { choice: 'official', probabilities: { official: 1 } } }),
      (request: JevRequest) => ({ ...positive(request), u0_substantive_basis: { choice: 'substantive', probabilities: { substantive: NaN, non_substantive: 0, insufficient: 0 } } }),
    ]) {
      const client: JevClient = { ask: async request => mutate(request) as Record<string, JevAnswer> };
      await expect(createSourceAssessmentExperiment(client)([unit], context)).rejects.toThrow('malformed_provider');
    }
  });

  it('validates batch boundaries before any provider call', async () => {
    const ask = vi.fn(async (request: JevRequest) => positive(request));
    const run = createSourceAssessmentExperiment({ ask });
    for (const batch of [[], [unit, unit], [{ ...unit, url: 'file:///etc/passwd' }], [{ ...unit, excerpt: '🦉'.repeat(2001) }], Array.from({ length: 7 }, (_, i) => ({ ...unit, id: `${i}` }))]) {
      await expect(run(batch, context)).rejects.toThrow('malformed_evidence');
    }
    expect(ask).not.toHaveBeenCalled();
    const allowed = Array.from({ length: 6 }, (_, i) => ({ ...unit, id: `${i}`, excerpt: '🦉'.repeat(2000) }));
    expect(Object.keys(await run(allowed, context))).toHaveLength(6);
    expect(Object.keys(ask.mock.calls[0][0].questions)).toHaveLength(12);
  });
});
