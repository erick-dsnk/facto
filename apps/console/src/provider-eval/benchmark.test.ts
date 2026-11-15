import { describe, expect, it } from 'vitest';
import { replaySources, summarize, waitForRequestSettlement, settledOutcome, type FrozenCase, type Observation } from './benchmark.js';
import { sourceQuery } from '../../../../packages/contracts/src/index.js';
import { accepted } from './benchmark.js';
import { AttemptBudget } from '../../../../services/api/src/runtime/budget.js';

const frozen: FrozenCase = { id: 'capital', text: 'Canberra is the capital of Australia.', primary: [], alternate: [], acquisition: { primaryMs: 1, alternateMs: 2, attempts: 2, inputTokens: 0, knownCostUSD: null, unknownCostResponses: 2, errors: [] } };
describe('provider comparison evidence boundary', () => {
  it('rejects another proposition or a reconstructed subject before replay', async () => {
    const sources = replaySources(frozen); const query = sourceQuery(accepted(frozen.text, frozen.id), Date.now());
    await expect(sources.gatherFree({ ...query, text: 'Sydney is the capital of Australia.' })).rejects.toMatchObject({ code: 'unmatched_replay_proposition' });
    await expect(sources.searchPaid({ ...query, subject: 'Canberra' }, { purpose: 'primary' }, new AttemptBudget().context(new AbortController().signal, Date.now))).rejects.toMatchObject({ code: 'unmatched_replay_proposition' });
  });
  it('charges the production search allowance and never fabricates free evidence', async () => {
    const sources = replaySources(frozen); const query = sourceQuery(accepted(frozen.text, frozen.id), Date.now()); const budget = new AttemptBudget(); const context = budget.context(new AbortController().signal, Date.now);
    expect((await sources.gatherFree(query)).evidence).toEqual([]);
    await sources.searchPaid(query, { purpose: 'primary' }, context); await sources.searchPaid(query, { purpose: 'alternate' }, context);
    await expect(sources.searchPaid(query, { purpose: 'alternate' }, context)).rejects.toMatchObject({ code: 'search_budget_exhausted' });
  });
});
describe('provider comparison metrics', () => {
  it('keeps errors and abstentions in the total denominator and separates selective correctness', () => {
    const base = { provider: 'laya', mode: 'judge', repetition: 0, expected: 'true', reasonCode: null, durationMs: 10, asks: [] };
    const rows: Observation[] = [{ ...base, id: 'ok', predicted: 'true' }, { ...base, id: 'abstain', predicted: 'cant_verify' }, { ...base, id: 'timeout', predicted: 'error', error: 'timeout' }];
    expect(summarize(rows)[0]).toMatchObject({ n: 3, correct: 1, errors: 1, abstentions: 1, definitive: 1, definitiveCorrect: 1, durationMs: { p50: 10, p95: 10 } });
  });
});

describe('provider comparison request settlement', () => {
  it('does not score a partial correct result when the complete request has not settled', () => {
    expect(settledOutcome([{ type: 'claim.result', payload: { verdict: 'supported' } }], false)).toMatchObject({ predicted: 'error', error: 'runtime_not_settled' });
  });
  it('gives a later timeout precedence over an earlier result', () => {
    expect(settledOutcome([{ type: 'claim.result', payload: { verdict: 'supported' } }, { type: 'pipeline.error', payload: { reasonCode: 'timeout' } }], true)).toMatchObject({ predicted: 'error', error: 'timeout' });
  });
  it('waits beyond an early terminal until every admitted span has settled', async () => {
    const events: string[] = ['first_result']; let done = false;
    const timer = setTimeout(() => { events.push('second_result'); done = true; }, 20);
    expect(await waitForRequestSettlement(() => done, 200)).toBe(true);
    clearTimeout(timer); expect(events).toEqual(['first_result', 'second_result']);
  });
  it('bounds a runtime which never settles', async () => {
    expect(await waitForRequestSettlement(() => false, 10)).toBe(false);
  });
});
