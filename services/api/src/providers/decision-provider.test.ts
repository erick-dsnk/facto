import { describe, expect, it, vi } from 'vitest';
import type { ProviderContext } from '../../../../packages/contracts/src/index.js';
import { createClassifier } from './jev/classification.js';
import { createJudge } from './jev/judgment.js';
import type { JevRequest } from './jev/client.js';
import { createLiveSources } from '../sources/index.js';
import { ClaimCache } from '../runtime/claim-cache.js';
import { createGatedAdmissionClient, selectDecisionProvider } from './decision-provider.js';

describe('decision provider selection', () => {
  it('defaults to Jev and preserves the existing missing-key failure at live startup', () => {
    const selected = selectDecisionProvider({ mode: 'fixture' });
    expect(selected.provider).toBe('jev');
    expect(selected.admissionProvider).toBe('jev');
    expect(selected.admissionClient).toBe(selected.client);
    expect(selected.cache).toBeUndefined();
    expect(() => selectDecisionProvider({ mode: 'live' })).toThrow('Live Jev mode requires JEV_API_KEY.');
  });

  it('requires a local URL for live Laya and gives each Laya runtime an isolated cache', () => {
    expect(() => selectDecisionProvider({ mode: 'live', provider: 'laya' })).toThrow('Live Laya mode requires LAYA_URL.');
    const fetcher = vi.fn<typeof fetch>();
    const first = selectDecisionProvider({ mode: 'live', provider: 'laya', layaUrl: 'http://127.0.0.1:8765', fetch: fetcher });
    const second = selectDecisionProvider({ mode: 'live', provider: 'laya', layaUrl: 'http://127.0.0.1:8765', fetch: fetcher });
    expect(first.cache).toBeInstanceOf(ClaimCache);
    expect(first.cache).not.toBe(second.cache);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('treats an empty or blank provider as unset and selects jev', () => {
    expect(selectDecisionProvider({ mode: 'fixture', provider: '' }).provider).toBe('jev');
    expect(selectDecisionProvider({ mode: 'fixture', provider: '  ' }).provider).toBe('jev');
  });

  it('laya_gate sends only the fine-tuned questions to Laya, the rest to Jev, Laya first, and requires both at live startup', async () => {
    expect(() => selectDecisionProvider({ mode: 'live', admissionProvider: 'laya_gate', jevApiKey: 'jev-key' })).toThrow('Live Laya mode requires LAYA_URL.');
    expect(() => selectDecisionProvider({ mode: 'live', admissionProvider: 'laya_gate', layaUrl: 'http://localhost:8765' })).toThrow('Live Jev mode requires JEV_API_KEY.');
    const order: string[] = [];
    const answer = (name: string) => async (request: JevRequest) => { order.push(name); return Object.fromEntries(Object.keys(request.questions).map(key => [key, { noul: name === 'laya' ? 0.9 : 0.1 }])); };
    const laya = { ask: vi.fn(answer('laya')) }; const jev = { ask: vi.fn(answer('jev')) };
    const ctx: ProviderContext = { signal: new AbortController().signal, consume: vi.fn(), now: () => 0 };
    const q = { type: 'noul' as const, instructions: 'x' };
    const answers = await createGatedAdmissionClient(laya, jev).ask({ state: {}, questions: { c0_kind: q, c0_private_data: q, c0_private_life: q, c0_self_contained: q, c0_subject_private: q, misheard: q } }, ctx);
    expect(order).toEqual(['laya', 'jev']);
    expect(Object.keys(laya.ask.mock.calls[0][0].questions).sort()).toEqual(['c0_kind', 'c0_private_data', 'c0_private_life']);
    expect(Object.keys(jev.ask.mock.calls[0][0].questions).sort()).toEqual(['c0_self_contained', 'c0_subject_private', 'misheard']);
    expect(answers.c0_private_data).toEqual({ noul: 0.9 });
    expect(answers.c0_self_contained).toEqual({ noul: 0.1 });
    const selected = selectDecisionProvider({ mode: 'fixture', admissionProvider: 'laya_gate' });
    expect(selected.admissionProvider).toBe('laya_gate');
    expect(selected.cache).toBeInstanceOf(ClaimCache);
  });

  it('rejects unsupported provider names rather than silently choosing a backend', () => {
    expect(() => selectDecisionProvider({ mode: 'fixture', provider: 'unknown' })).toThrow('DECISION_PROVIDER must be jev or laya.');
  });

  it('validates both roles at live startup and treats an empty override as inheritance', () => {
    expect(() => selectDecisionProvider({ mode: 'live', provider: 'jev', admissionProvider: 'laya', jevApiKey: 'jev-key' })).toThrow('Live Laya mode requires LAYA_URL.');
    expect(() => selectDecisionProvider({ mode: 'live', provider: 'jev', admissionProvider: 'laya', layaUrl: 'http://localhost:8765' })).toThrow('Live Jev mode requires JEV_API_KEY.');
    expect(() => selectDecisionProvider({ mode: 'live', provider: 'laya', admissionProvider: 'jev', layaUrl: 'http://localhost:8765' })).toThrow('Live Jev mode requires JEV_API_KEY.');
    expect(() => selectDecisionProvider({ mode: 'fixture', admissionProvider: 'unknown' })).toThrow('ADMISSION_PROVIDER must be jev, laya or laya_gate.');
    const inherited = selectDecisionProvider({ mode: 'fixture', provider: 'laya', admissionProvider: '  ' });
    expect(inherited.admissionClient).toBe(inherited.client);
    expect(inherited.admissionProvider).toBe('laya');
  });

  it('routes the real classifier to Laya and real judgment and source matching to Jev with separate credentials', async () => {
    const text = 'Helsinki is the capital of Finland.';
    const ctx = (): ProviderContext => ({ signal: new AbortController().signal, consume: vi.fn(), now: () => Date.parse('2026-11-15T12:00:00Z') });
    const calls: { url: string; request: JevRequest; auth: string | null }[] = [];
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      const address = String(url);
      if (address.startsWith('https://factchecktools.googleapis.com/')) return new Response(JSON.stringify({ claims: [{ text, claimReview: [{ publisher: { name: 'PolitiFact', site: 'politifact.com' }, url: 'https://www.politifact.com/test', textualRating: 'True' }] }] }));
      // Other free services are irrelevant to this routing assertion.
      if (!address.endsWith('/v1/systemone')) return new Response('{}', { status: 503 });
      const request = JSON.parse(String(init?.body)) as JevRequest;
      calls.push({ url: address, request, auth: new Headers(init?.headers).get('Authorization') });
      const answers = Object.fromEntries(Object.entries(request.questions).map(([name, question]) => {
        if (question.type === 'noul') return [name, { noul: /private|rumour|future|practical|misleading/.test(name) ? 0 : 1 }];
        const preferred = name.endsWith('_kind') ? 'claim' : name.endsWith('_route') ? 'named_fact'
          : name.endsWith('_claim_structure') ? 'one_coherent' : name === 'verdict' ? 'supported'
            : name === 'selected_evidence' ? 'e0' : name === 'claim_risk' ? 'ordinary'
              : name.endsWith('_content_basis') ? 'ordinary_reference' : name.endsWith('_stance') ? 'supports' : 'none';
        const choice = Object.hasOwn(question.criteria, preferred) ? preferred : Object.keys(question.criteria)[0];
        return [name, { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(option => [option, Number(option === choice)])) }];
      }));
      return new Response(JSON.stringify({ answers }));
    });
    const selected = selectDecisionProvider({ mode: 'live', provider: 'jev', admissionProvider: 'laya',
      jevApiKey: 'hosted-jev-key', layaApiKey: 'local-laya-key', layaUrl: 'http://localhost:8765', fetch: fetcher });
    expect(selected.cache).toBeInstanceOf(ClaimCache);
    const admission = await createClassifier(selected.admissionClient)({ schemaVersion: 1, requestId: 'r1', sessionId: 's1', sessionEpoch: 1, revision: 1,
      mode: 'typed', text, language: 'en', capturedAt: '2026-11-15T12:00:00Z', capture: { source: 'typed_fixture', segmentId: 'seg1', confidence: null }, context: [], userInitiated: true }, ctx());
    expect(admission.claims).toHaveLength(1);
    const claim = admission.claims[0];
    const sources = createLiveSources({ jev: selected.client, exaApiKey: 'unused-exa-key', googleFactCheckApiKey: 'google-key', fetch: fetcher });
    const free = await sources.gatherFree({ claimId: claim.id, text, subject: null, route: 'general', attribution: null, future: false, rumour: false, asOf: '2026-11-15' }, ctx());
    expect(free.evidence).toHaveLength(1);
    await createJudge(selected.client)(claim, free.evidence, ctx());
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ url: 'http://localhost:8765/v1/systemone', auth: 'Bearer local-laya-key' });
    expect(calls[0].request.questions).toHaveProperty('span_0_kind');
    expect(calls[1]).toMatchObject({ url: 'https://api.typesafe.ai/v1/systemone', auth: 'Bearer hosted-jev-key' });
    expect(calls[1].request.questions).toHaveProperty('same1');
    expect(calls[2]).toMatchObject({ url: 'https://api.typesafe.ai/v1/systemone', auth: 'Bearer hosted-jev-key' });
    expect(calls[2].request.questions).toHaveProperty('verdict');
  });

});
