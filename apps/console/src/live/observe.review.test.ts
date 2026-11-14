import { describe, expect, it, vi } from 'vitest';
import type { TextInput } from '../../../../packages/contracts/src/index.js';
import { AttemptBudget } from '../../../../services/api/src/runtime/budget.js';
import type { JevQuestion } from '../../../../services/api/src/providers/jev/client.js';
import { CampaignBudget, DEVELOPMENT_LIMITS } from './budget.js';
import { freshObservation, observedProviders } from './observe.js';

const publicText = 'Helsinki is the capital of Finland.';
const otherPublic = 'Oslo is the capital of Norway.';
const secretMarker = 'SYNTHETIC_PRIVATE_DIAGNOSTIC_MARKER';
const input = (requestId = 'review'): TextInput => ({ schemaVersion: 1, requestId, sessionId: 'review-session', sessionEpoch: 1,
  revision: 1, mode: 'typed', text: publicText, language: 'en', capturedAt: new Date().toISOString(),
  capture: { source: 'typed_fixture', segmentId: 'review', confidence: null, final: true }, context: [], userInitiated: true });

function admissionResponse(init?: RequestInit, usage: unknown = 17) {
  const request = JSON.parse(String(init?.body)) as { questions: Record<string, JevQuestion> };
  const answers = Object.fromEntries(Object.entries(request.questions).map(([name, question]) => {
    if (question.type === 'noul') return [name, { noul: name.endsWith('_private_data') ? 0 : 1, ignored: secretMarker }];
    const selected = name.endsWith('_kind') ? 'public_fact' : name.endsWith('_assertion_status') ? 'asserted' : 'one_coherent';
    return [name, { choice: selected, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, Number(key === selected)])), ignored: secretMarker }];
  }));
  return Response.json({ answers, usage: { input_tokens: usage }, costDollars: { total: 0.002 }, ignored: secretMarker });
}

function setup(fetcher: typeof fetch, budget = new CampaignBudget(), onAttemptFinished?: () => void | Promise<void>, onBeforeDispatch?: () => void | Promise<void>) {
  const observation = freshObservation('review');
  const requests = new Map([['review', { observation, allowedPublic: [publicText, otherPublic] }]]);
  const providers = observedProviders({ budget, requests, fetch: fetcher, keys: { jev: secretMarker, exa: secretMarker }, onAttemptFinished, onBeforeDispatch });
  const runtimeBudget = new AttemptBudget();
  const context = runtimeBudget.context(new AbortController().signal, Date.now);
  return { observation, budget, providers, runtimeBudget, context };
}

describe('independent live observer accounting review', () => {
  it('keeps request bytes independent from measured tokens and refuses dispatch without recording a wire attempt', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init));
    const state = setup(fetcher, new CampaignBudget({ ...DEVELOPMENT_LIMITS, requestBytes: 1 }));
    await expect(state.providers.adapters.classify(input(), state.context)).rejects.toMatchObject({ code: 'harness_request_byte_limit' });
    expect(state.runtimeBudget.jev).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.budget.summary()).toMatchObject({ attempts: 0, requestBytes: 0, measuredInputTokens: 0 });
  });

  it('charges actual usage and returned numeric cost, while retaining only fixed answer fields', async () => {
    const state = setup(vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init)));
    const admission = await state.providers.adapters.classify(input(), state.context);
    expect(admission.action).toBe('check');
    expect(state.budget.summary()).toMatchObject({ attempts: 1, measuredInputTokens: 17, unknownInputTokenReservations: 0, knownCostUSD: 0.002 });
    expect(state.budget.summary().requestBytes).toBeGreaterThan(17);
    const serialized = JSON.stringify({ attempts: state.observation.attempts, admission: state.observation.admission });
    expect(serialized).not.toContain(secretMarker);
    expect(state.observation.attempts[0].answers).toBeDefined();
  });

  it('keeps failed unknown usage reserved and blocks a retry before its network dispatch', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ error: secretMarker }, { status: 503, headers: { 'retry-after': '0' } }));
    const state = setup(fetcher);
    await expect(state.providers.adapters.classify(input(), state.context)).rejects.toMatchObject({ code: 'harness_unknown_input_usage' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.runtimeBudget.jev).toBe(2);
    expect(state.budget.summary()).toMatchObject({ attempts: 1, measuredInputTokens: 0, unknownInputTokenReservations: 24_000 });
    expect(state.observation.localStops).toEqual(['harness_unknown_input_usage']);
    expect(JSON.stringify(state.observation.attempts)).not.toContain(secretMarker);
  });

  it('blocks all later provider dispatch after invalid returned usage rather than treating it as measured zero', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init, '17'));
    const state = setup(fetcher);
    const admission = await state.providers.adapters.classify(input(), state.context);
    const claim = { ...admission.claims[0], id: 'review-claim-0' };
    await expect(state.providers.adapters.retrieve(claim, state.context)).rejects.toMatchObject({ code: 'harness_unknown_input_usage' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.budget.chargedInputTokens).toBe(24_000);
    expect(state.observation.attempts[0].inputTokens).toBeNull();
  });

  it('requires the exact current admitted proposition even when another public proposition was predeclared', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init));
    const state = setup(fetcher);
    const admission = await state.providers.adapters.classify(input(), state.context);
    const claim = { ...admission.claims[0], id: 'review-claim-0', originalText: otherPublic, checkedText: otherPublic,
      sourceSpan: { start: 0, end: otherPublic.length } };
    await expect(state.providers.adapters.retrieve(claim, state.context)).rejects.toMatchObject({ code: 'harness_query_not_public' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.observation.localStops).toEqual(['harness_query_not_public']);
  });

  it('retains actual overrun usage and blocks future calls after a provider exceeds its reservation', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init, 25_001));
    const state = setup(fetcher, new CampaignBudget({ ...DEVELOPMENT_LIMITS, inputTokens: 24_000 }));
    await expect(state.providers.adapters.classify(input(), state.context)).rejects.toMatchObject({ code: 'harness_actual_input_token_overrun' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.budget.summary()).toMatchObject({ attempts: 1, measuredInputTokens: 25_001, unknownInputTokenReservations: 0, chargedInputTokens: 25_001 });
    expect(state.observation.attempts[0]).toMatchObject({ status: 200, outcome: 'response', costUSD: 0.002 });
    expect(() => state.budget.begin('search', 1)).toThrow('harness_input_token_limit');
  });

  it('stops dispatch when durable checkpoint persistence fails instead of converting disk failure into a paid retry', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init));
    const state = setup(fetcher, undefined, () => { throw new Error(secretMarker); });
    await expect(state.providers.adapters.classify(input(), state.context)).rejects.toMatchObject({ code: 'harness_checkpoint_failure' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(state.observation.localStops).toEqual(['harness_checkpoint_failure']);
    expect(JSON.stringify(state.observation.attempts)).not.toContain(secretMarker);
  });

  it('checkpoints a pending reservation before dispatch and withdraws it if that checkpoint fails', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init));
    const state = setup(fetcher, undefined, undefined, () => {
      expect(fetcher).not.toHaveBeenCalled();
      expect(state.budget.summary()).toMatchObject({ attempts: 0, pendingDispatchReservations: 1, unknownInputTokenReservations: 24_000 });
      expect(state.observation.attempts[0].dispatched).toBe(false);
      throw new Error(secretMarker);
    });
    await expect(state.providers.adapters.classify(input(), state.context)).rejects.toMatchObject({ code: 'harness_checkpoint_failure' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.budget.summary()).toMatchObject({ attempts: 0, pendingDispatchReservations: 0, unknownInputTokenReservations: 0 });
    expect(state.observation.localStops).toEqual(['harness_checkpoint_failure']);
  });
});
