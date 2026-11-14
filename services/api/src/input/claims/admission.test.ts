import { describe, expect, it, vi } from 'vitest';
import { type TextInput, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { createClassifier } from '../../providers/jev/classification.js';
import { createJevClient, type JevAnswer, type JevClient, type JevRequest, validateAnswers } from '../../providers/jev/client.js';
import { deterministicIssue, generateCandidates } from './spans.js';

function input(text: string, userInitiated = false): TextInput {
  return { schemaVersion: 1, requestId: 'request-1', sessionId: 'session-1', sessionEpoch: 1, revision: 1, mode: 'typed', text, language: 'en', capturedAt: '2026-11-14T12:00:00Z', capture: { source: 'typed_fixture', segmentId: 'segment-1', confidence: null }, context: [], userInitiated };
}
const context = (): ProviderContext => ({ signal: new AbortController().signal, consume: vi.fn(), now: () => Date.parse('2026-11-14T12:00:00Z') });
type Semantic = { kind?: string; private?: number; self?: number; assertion?: string; priority?: number | null };
function fixtureClient(resolve: (text: string) => Semantic): JevClient {
  return { ask: vi.fn(async (request: JevRequest) => {
    const state = request.state as { candidates: { id: string; text: string }[] };
    const answers: Record<string, JevAnswer> = {};
    for (const candidate of state.candidates) {
      const result = resolve(candidate.text);
      for (const [name, question] of Object.entries(request.questions)) {
        if (!name.startsWith(candidate.id + '_')) continue;
        if (question.type === 'choice') {
          const choice = name.endsWith('_kind') ? result.kind ?? 'public_fact' : result.assertion ?? 'asserted';
          answers[name] = { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === choice ? 0.97 : 0.03 / (Object.keys(question.criteria).length - 1)])) };
        } else answers[name] = { noul: name.endsWith('_private_data') ? result.private ?? 0.01 : name.endsWith('_self_contained') ? result.self ?? 0.99 : result.priority ?? null };
      }
    }
    return answers;
  }) };
}

describe('bounded exact public admission', () => {
  it('preserves Unicode code-point offsets, amounts and negation without normalization', () => {
    const text = '🧑🏽 My salary is €4,000 and Water does not boil at 10°C.';
    const candidates = generateCandidates(text);
    expect(candidates.length).toBeLessThanOrEqual(4);
    for (const candidate of candidates) expect(Array.from(text).slice(candidate.span.start, candidate.span.end).join('')).toBe(candidate.text);
    expect(candidates.some(c => c.text === 'Water does not boil at 10°C.')).toBe(true);
  });

  it('never detaches a conditional or quoted proposition at a conjunction', () => {
    expect(generateCandidates('If pressure is low, water boils early and water is not always 100°C.')).toHaveLength(1);
    expect(generateCandidates('She said "Earth is flat and the Moon is cheese."')).toHaveLength(1);
  });

  it('admits first-person framing of a public proposition', async () => {
    const text = 'I think Helsinki is the capital of Norway.';
    const result = await createClassifier(fixtureClient(() => ({})))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims[0].checkedText).toBe(text);
    expect(result.claims[0].admission.hasPracticalConsequence).toBeNull();
  });

  it('exports only the exact independent public span from private mixed input', async () => {
    const text = 'My salary is €4,000 and Helsinki is the capital of Finland.';
    const client = fixtureClient(candidate => candidate.includes('salary') ? { kind: candidate.includes('Helsinki') ? 'mixed' : 'personal_experience', private: 0.99 } : {});
    const result = await createClassifier(client)(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['Helsinki is the capital of Finland.']);
    expect(client.ask).toHaveBeenCalledTimes(1);
  });

  it('does not admit private text even if the model incorrectly calls it public', async () => {
    const result = await createClassifier(fixtureClient(() => ({})))(input('My salary is €4,000.'), context());
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', claims: [] });
  });

  it('vetoes an allegedly public whole span when a contained clause is known private', async () => {
    const text = 'I earn €4,000 and the Eiffel Tower opened in 1889.';
    const client = fixtureClient(candidate => candidate === 'I earn €4,000'
      ? { kind: 'personal_experience', private: 0.99 }
      : {});
    const result = await createClassifier(client)(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['the Eiffel Tower opened in 1889.']);
  });

  it.each(['I felt sick yesterday.', 'I love Helsinki.', 'Next year everyone will be rich.'])('returns no truth claims for %s', async text => {
    const result = await createClassifier(fixtureClient(() => ({ kind: text.includes('love') ? 'opinion' : text.includes('Next') ? 'prediction' : 'personal_experience' })))(input(text), context());
    expect(result.action).toBe('skip');
    expect(result.claims).toEqual([]);
  });

  it('waits for incomplete automatic input and clarifies manual input', async () => {
    const classify = createClassifier(fixtureClient(() => ({ kind: 'incomplete_or_unclear', self: 0.1 })));
    expect(await classify(input('Unemployment is 7%.'), context())).toMatchObject({ action: 'wait', claims: [] });
    expect(await classify(input('Unemployment is 7%.', true), context())).toMatchObject({ action: 'needs_confirmation', claims: [] });
  });

  it('rejects null or missing privacy/completeness evidence instead of searching', async () => {
    const good = fixtureClient(() => ({}));
    const bad: JevClient = { ask: async (request, ctx) => ({ ...await good.ask(request, ctx), span_0_private_data: { noul: null } }) };
    await expect(createClassifier(bad)(input('Water boils at 100 degrees Celsius at sea level.'), context())).rejects.toMatchObject({ code: 'malformed_provider' });
  });

  it('does not promote uncertain or nonliteral assertion into a check', async () => {
    const classify = createClassifier(fixtureClient(() => ({ assertion: 'nonliteral_or_quoted' })));
    expect(await classify(input('The Earth is flat.'), context())).toMatchObject({ action: 'skip', reasonCode: 'nonliteral_or_quoted', claims: [] });
  });

  it('does not call a provider for partial or low-confidence capture', async () => {
    const client = fixtureClient(() => ({}));
    const partial = input('Water boils at 100 degrees.'); partial.capture.final = false;
    expect((await createClassifier(client)(partial, context())).action).toBe('wait');
    const uncertain = input('Water boils at 10 degrees.'); uncertain.capture.confidence = 0.5;
    expect((await createClassifier(client)(uncertain, context())).action).toBe('needs_confirmation');
    expect(client.ask).not.toHaveBeenCalled();
  });

  it('limits selected claims to two non-overlapping spans', async () => {
    const text = 'I felt tired. Helsinki is in Finland. Oslo is in Norway. Paris is in France.';
    const result = await createClassifier(fixtureClient(candidate => candidate.includes('tired') ? { kind: 'personal_experience', private: 0.99 } : {}))(input(text), context());
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].sourceSpan.end).toBeLessThanOrEqual(result.claims[1].sourceSpan.start);
  });

  it('keeps simple completeness and privacy backstops distinct', () => {
    expect(deterministicIssue('She said it was safe.')).toBe('nonliteral');
    expect(deterministicIssue('They have three children.')).toBe('incomplete');
    expect(deterministicIssue('I think Earth is round.')).toBeNull();
  });
});

describe('Jev wire validation', () => {
  const request: JevRequest = { state: { captured: 'untrusted text' }, questions: { eligible: { type: 'choice', instructions: 'Classify.', criteria: { yes: 'Eligible.', no: 'Not eligible.' } } } };
  const valid = { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9, no: 0.1 } } } };
  it.each([
    {}, { answers: {} }, { answers: { eligible: { choice: 'invented', probabilities: { yes: 0.9, no: 0.1 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: Number.NaN, no: 0.1 } } } },
    { answers: { eligible: { choice: 'yes', probabilities: { yes: 0.9, no: 0.9 } } } }
  ])('rejects malformed answers %#', malformed => {
    expect(() => validateAnswers(malformed, request.questions)).toThrow('malformed_provider');
  });

  it('uses the fixed endpoint, injected fetch, abort signal and a single metered call', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(valid), { status: 200 }));
    const ctx = context();
    const client = createJevClient({ apiKey: 'test-only-key', fetch: fetcher });
    expect(await client.ask(request, ctx)).toEqual(valid.answers);
    expect(ctx.consume).toHaveBeenCalledExactlyOnceWith('jev');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.typesafe.ai/v1/systemone', expect.objectContaining({ method: 'POST', signal: ctx.signal }));
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ model: 'jev-latest', ...request });
  });

  it.each([[401, 'jev_authentication'], [403, 'jev_authentication'], [429, 'jev_rate_limited'], [503, 'jev_unavailable']] as const)('keeps HTTP %i operational and does not retry automatically', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('provider body with secrets must never escape', { status }));
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, context())).rejects.toMatchObject({ code, message: code });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([0, 125])('reports only validated input-token usage (%i) through the optional meter', async inputTokens => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...valid, usage: { input_tokens: inputTokens, raw_transcript: 'must not reach telemetry' } }), { status: 200 }));
    const recordUsage = vi.fn();
    const ctx: ProviderContext = { ...context(), recordUsage };
    expect(await createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, ctx)).toEqual(valid.answers);
    expect(recordUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens });
  });

  it.each([-1, 1.5, '125', null, Number.MAX_SAFE_INTEGER + 1])('ignores malformed usage %j without changing valid answers', async inputTokens => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...valid, usage: { input_tokens: inputTokens } }), { status: 200 }));
    const recordUsage = vi.fn();
    const ctx: ProviderContext = { ...context(), recordUsage };
    expect(await createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, ctx)).toEqual(valid.answers);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it('meters valid provider usage even when its factual answers are malformed', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ answers: {}, usage: { input_tokens: 42 } }), { status: 200 }));
    const recordUsage = vi.fn();
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, { ...context(), recordUsage })).rejects.toMatchObject({ code: 'malformed_provider' });
    expect(recordUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens: 42 });
  });

  it('does not call or consume budget when already cancelled or missing a key', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const ctx = context();
    await expect(createJevClient({ apiKey: '', fetch: fetcher }).ask(request, ctx)).rejects.toMatchObject({ code: 'missing_jev_key' });
    expect(ctx.consume).not.toHaveBeenCalled();
    const cancelled = { ...ctx, signal: AbortSignal.abort() };
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, cancelled)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
