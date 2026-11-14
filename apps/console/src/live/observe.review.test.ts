import { describe, expect, it, vi } from 'vitest';
import type { TextInput } from '../../../../packages/contracts/src/index.js';
import { AttemptBudget } from '../../../../services/api/src/runtime/budget.js';
import type { JevQuestion } from '../../../../services/api/src/providers/jev/client.js';
import { AbortableExa } from '../../../../services/api/src/providers/exa/client.js';
import { buildAlternateQuery, buildHighlightQuery, RETRIEVAL_OBJECTIVE } from '../../../../services/api/src/evidence/normalize.js';
import { CampaignBudget, DEVELOPMENT_LIMITS } from './budget.js';
import { freshObservation, observedProviders, retrievalRequestIsPublic } from './observe.js';

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

  it('counts rejected admission without retaining its text and blocks all retrieval before dispatch', async () => {
    const state = setup(vi.fn<typeof fetch>(async (_url, init) => admissionResponse(init)));
    const privateInput = { ...input(), text: 'The museum opened in 1800.' };
    await expect(state.providers.adapters.classify(privateInput, state.context)).rejects.toMatchObject({ code: 'harness_admitted_span_not_public' });
    expect(state.observation.rejectedAdmissionCount).toBe(1);
    expect(state.observation.admittedPublic).toEqual([]);
    expect(state.budget.summary().calls).toEqual({ jev: 1, search: 0, contents: 0 });
    expect(JSON.stringify(state.observation)).not.toContain(privateInput.text);
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

  it.each(['search', 'contents'] as const)('blocks private text hidden in %s highlight options before the actual dispatch', async kind => {
    const actualRequest = AbortableExa.prototype.request;
    const patched = vi.spyOn(AbortableExa.prototype, 'request').mockImplementation(function<T>(this: AbortableExa, endpoint: string, method: string, body?: unknown): Promise<T> {
      const changed = structuredClone(body) as Record<string, unknown>;
      if (endpoint === `/${kind}`) {
        if (kind === 'search') changed.contents = { highlights: { query: secretMarker, maxCharacters: 4000 } };
        else changed.highlights = { query: secretMarker, maxCharacters: 4000 };
      }
      return actualRequest.call(this, endpoint, method, changed) as Promise<T>;
    });
    const fetcher = vi.fn<typeof fetch>(async (url, init) => String(url).includes('typesafe.ai') ? admissionResponse(init)
      : Response.json({ results: [{ url: 'https://reference.example.org/capital', title: 'Capital record', highlights: ['Helsinki'] }] }));
    try {
      const state = setup(fetcher);
      const admission = await state.providers.adapters.classify(input(), state.context);
      await expect(state.providers.adapters.retrieve({ ...admission.claims[0], id: 'review-claim-0' }, state.context)).rejects.toMatchObject({ code: 'harness_retrieval_request_not_public' });
      expect(state.budget.summary().calls).toEqual({ jev: 1, search: kind === 'search' ? 0 : 1, contents: 0 });
      expect(fetcher).toHaveBeenCalledTimes(kind === 'search' ? 1 : 2);
      expect(JSON.stringify(state.observation)).not.toContain(secretMarker);
    } finally { patched.mockRestore(); }
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

describe('all outbound retrieval text is constrained to the current public proposition', () => {
  const search = () => ({ query: publicText, type: 'auto', numResults: 5, objective: RETRIEVAL_OBJECTIVE,
    contents: { highlights: { query: buildHighlightQuery(publicText), maxCharacters: 4000 } } });
  const contents = () => ({ urls: ['https://reference.example.org/capital'], text: { maxCharacters: 12000 },
    highlights: { query: buildHighlightQuery(publicText), maxCharacters: 4000 }, livecrawl: 'preferred', livecrawlTimeout: 1500 });

  it('accepts only the installed SDK shape, bounded options and exact same-span query helpers', () => {
    expect(retrievalRequestIsPublic('search', search(), [publicText])).toBe(true);
    expect(retrievalRequestIsPublic('search', { ...search(), query: buildAlternateQuery(publicText, 'balanced_evidence'), numResults: 8 }, [publicText])).toBe(true);
    expect(retrievalRequestIsPublic('contents', contents(), [publicText])).toBe(true);
    expect(retrievalRequestIsPublic('search', search(), [publicText, otherPublic])).toBe(false);
    expect(retrievalRequestIsPublic('search', { ...search(), numResults: 8 }, [publicText])).toBe(false);
    expect(retrievalRequestIsPublic('contents', { ...contents(), ids: contents().urls }, [publicText])).toBe(false);
  });

  it('rejects hidden objective, nested query, extra free text, credential URLs and widened bounds', () => {
    for (const request of [
      { ...search(), objective: secretMarker }, { ...search(), query: otherPublic }, { ...search(), userLocation: secretMarker },
      { ...search(), contents: { ...search().contents, summary: { query: secretMarker } } },
      { ...search(), contents: { highlights: { query: buildHighlightQuery(otherPublic), maxCharacters: 4000 } } },
      { ...search(), contents: { highlights: { ...search().contents.highlights, maxCharacters: 40_000 } } },
    ]) expect(retrievalRequestIsPublic('search', request, [publicText])).toBe(false);
    for (const request of [
      { ...contents(), highlights: { ...contents().highlights, query: secretMarker } },
      { ...contents(), text: { maxCharacters: 12000, query: secretMarker } },
      { ...contents(), urls: ['https://user:secret@example.org/capital'] },
      { ...contents(), urls: ['http://127.0.0.1/private'] }, { ...contents(), text: { maxCharacters: 12001 } },
    ]) expect(retrievalRequestIsPublic('contents', request, [publicText])).toBe(false);
  });
});
