import { describe, expect, it, vi } from 'vitest';
import { type TextInput, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { createClassifier } from '../../providers/jev/classification.js';
import { createJevClient, type JevAnswer, type JevClient, type JevRequest, validateAnswers } from '../../providers/jev/client.js';
import { deterministicIssue, generateCandidates } from './spans.js';

function input(text: string, userInitiated = false): TextInput {
  return { schemaVersion: 1, requestId: 'request-1', sessionId: 'session-1', sessionEpoch: 1, revision: 1, mode: 'typed', text, language: 'en', capturedAt: '2026-11-14T12:00:00Z', capture: { source: 'typed_fixture', segmentId: 'segment-1', confidence: null }, context: [], userInitiated };
}
const context = (): ProviderContext => ({ signal: new AbortController().signal, consume: vi.fn(), now: () => Date.parse('2026-11-14T12:00:00Z') });
type Semantic = { kind?: string; private?: number; self?: number; assertion?: string; quoteUse?: string; structure?: string; scope?: number | null; priority?: number | null };
function fixtureClient(resolve: (text: string) => Semantic): JevClient {
  return { ask: vi.fn(async (request: JevRequest) => {
    const state = request.state as { candidates: { id: string; text: string }[] };
    const answers: Record<string, JevAnswer> = {};
    for (const candidate of state.candidates) {
      const result = resolve(candidate.text);
      for (const [name, question] of Object.entries(request.questions)) {
        if (!name.startsWith(candidate.id + '_')) continue;
        if (question.type === 'choice') {
          const choice = name.endsWith('_kind') ? result.kind ?? 'public_fact'
            : name.endsWith('_assertion_status') ? result.assertion ?? 'asserted'
              : name.endsWith('_quote_use') ? result.quoteUse ?? 'name_or_title'
                : name.endsWith('_claim_structure') ? result.structure ?? 'one_coherent'
                  : result.assertion ?? 'asserted';
          answers[name] = { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === choice ? 0.97 : 0.03 / (Object.keys(question.criteria).length - 1)])) };
        } else answers[name] = { noul: name.endsWith('_private_data') ? result.private ?? 0.01 : name.endsWith('_self_contained') ? result.self ?? 0.99 : name.endsWith('_preserves_scope') ? result.scope ?? 0.99 : result.priority ?? null };
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
    expect(generateCandidates('A fictional narrator says: “Mars is made of ice cream. Venus is made of cake. Mercury is made of candy.”')).toHaveLength(1);
    expect(generateCandidates('It is not true that antibiotics cure viruses and vaccines cause autism.')).toHaveLength(1);
    expect(generateCandidates('It is false that penicillin cures viral infections and the Moon is made of cheese.')).toHaveLength(1);
  });

  it.each([
    ['My salary is €4,000 AND Helsinki is the capital of Finland.', 'Helsinki is the capital of Finland.'],
    ['My salary is €4,000;Helsinki is the capital of Finland.', 'Helsinki is the capital of Finland.']
  ])('finds exact public subspans across formatting variants: %s', (text, expectedPublicSpan) => {
    const candidates = generateCandidates(text);
    expect(candidates.map(candidate => candidate.text)).toContain(expectedPublicSpan);
    for (const candidate of candidates) {
      expect(Array.from(text).slice(candidate.span.start, candidate.span.end).join('')).toBe(candidate.text);
    }
  });

  it('admits first-person framing of a public proposition', async () => {
    const text = 'I think Helsinki is the capital of Norway.';
    const result = await createClassifier(fixtureClient(() => ({})))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims[0].checkedText).toBe(text);
    expect(result.claims[0].admission.hasPracticalConsequence).toBeNull();
  });

  it('keeps the configured completeness boundary at 0.85', async () => {
    const text = 'The Colosseum is in Rome.';
    const below = await createClassifier(fixtureClient(() => ({ self: 0.84 })))(input(text), context());
    expect(below).toMatchObject({ action: 'wait', claims: [] });
    const atBoundary = await createClassifier(fixtureClient(() => ({ self: 0.85 })))(input(text), context());
    expect(atBoundary.action).toBe('check');
  });

  it.each([
    'All mammals lay eggs.',
    'No metal expands when heated.',
    'Water always boils at 100°C.'
  ])('admits the exact complete literal proposition without repairing its truth or scope: %s', async text => {
    const result = await createClassifier(fixtureClient(() => ({})))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual([text]);
  });

  it.each([
    'They always lay eggs.',
    'Unemployment is 7%.'
  ])('retains incomplete referent/statistic backstops despite generous semantic scores: %s', async text => {
    const result = await createClassifier(fixtureClient(() => ({})))(input(text), context());
    expect(result).toMatchObject({ action: 'wait', reasonCode: 'incomplete_or_unclear', claims: [] });
  });

  it('binds structural questions to exact candidate spans', async () => {
    const client = fixtureClient(() => ({}));
    await createClassifier(client)(input('The Eiffel Tower opened in 1889. Helsinki is in Finland.'), context());
    const request = vi.mocked(client.ask).mock.calls[0][0];
    const state = request.state as { candidates: { text: string; span: { start: number; end: number } }[] };
    expect(state.candidates[1].text).toBe('The Eiffel Tower opened in 1889.');
    expect(state.candidates[1].span).toEqual({ start: 0, end: 32 });
    expect(request.questions.span_1_preserves_scope?.type).toBe('noul');
    expect(request.questions.span_0_claim_structure?.type).toBe('choice');
  });

  it('allows a quoted title only when Jev separates the title from an asserted proposition', async () => {
    const text = 'The book “1984” was written by George Orwell.';
    const accepted = await createClassifier(fixtureClient(() => ({ quoteUse: 'name_or_title' })))(input(text), context());
    expect(accepted.action).toBe('check');
    expect(accepted.claims.map(claim => claim.checkedText)).toEqual([text]);

    const quoted = await createClassifier(fixtureClient(() => ({ quoteUse: 'quoted_proposition' })))(input(text), context());
    expect(quoted).toMatchObject({ action: 'skip', reasonCode: 'nonliteral_or_quoted', claims: [] });
  });

  it('retains a quoted-title sentence next to private text as an exact candidate', async () => {
    const text = 'My salary is €4,200. The novel “Dune” was written by Frank Herbert.';
    const result = await createClassifier(fixtureClient(candidate => candidate === text
      ? { kind: 'mixed', private: 0.99, structure: 'multiple_propositions' }
      : candidate.includes('salary') ? { kind: 'personal_experience', private: 0.99 } : {}))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['The novel “Dune” was written by Frank Herbert.']);
  });

  it('does not extract an unquoted middle sentence from a multi-sentence quotation', async () => {
    const text = 'A fictional narrator says: “Mars is made of ice cream. Venus is made of cake. Mercury is made of candy.” Helsinki is in Finland.';
    const candidates = generateCandidates(text);
    expect(candidates.map(candidate => candidate.text)).not.toContain('Venus is made of cake.');
    const result = await createClassifier(fixtureClient(candidate => candidate === text ? { structure: 'multiple_propositions' } : {}))(input(text), context());
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['Helsinki is in Finland.']);
  });

  it('does not merge separate title-bearing propositions when no safe split exists', async () => {
    const text = 'The novel “Dune” was written by Frank Herbert and the film “Titanic” was directed by James Cameron.';
    const result = await createClassifier(fixtureClient(candidate => candidate === text ? { structure: 'multiple_propositions' } : {}))(input(text), context());
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'not_eligible_public_fact', claims: [] });
  });

  it('does not admit a sentence subspan containing several unsplittable propositions', async () => {
    const text = 'My salary is €4,200. The novel “Dune” was written by Frank Herbert and the film “Titanic” was directed by James Cameron.';
    const client = fixtureClient(candidate => candidate.includes('salary')
      ? { kind: 'personal_experience', private: 0.99, structure: 'multiple_propositions' }
      : { structure: 'multiple_propositions' });
    const result = await createClassifier(client)(input(text), context());
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'private_or_personal', claims: [] });
    const request = vi.mocked(client.ask).mock.calls[0][0];
    expect(request.questions.span_2_claim_structure?.type).toBe('choice');
  });

  it.each([
    'There are eight planets in the Solar System.',
    'There’s one natural moon of Earth.',
    "There aren't six planets in the Solar System."
  ])('admits complete existential propositions while retaining unresolved-place backstops: %s', async text => {
    expect(deterministicIssue(text)).toBeNull();
    expect(deterministicIssue('There the water boils at 90 degrees.')).toBe('incomplete');
    const result = await createClassifier(fixtureClient(() => ({})))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual([text]);
  });

  it('requires a proper subspan to preserve the whole utterance scope', async () => {
    const text = 'My salary is €4,000 and Helsinki is the capital of Finland.';
    const result = await createClassifier(fixtureClient(candidate => candidate.includes('Helsinki') ? { scope: 0.2 } : { kind: 'personal_experience', private: 0.99 }))(input(text), context());
    expect(result.action).toBe('skip');
    expect(result.claims).toEqual([]);
  });

  it('uses complete exact sentence claims when the whole input contains several propositions', async () => {
    const text = 'The Eiffel Tower opened in 1889. The Moon is made of cheese.';
    const result = await createClassifier(fixtureClient(candidate => candidate === text ? { structure: 'multiple_propositions' } : {}))(input(text), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['The Eiffel Tower opened in 1889.', 'The Moon is made of cheese.']);
  });

  it('does not promote an imaginary-world sentence when its qualifier is in adjacent context', async () => {
    const text = 'Imagine an alternate world. The Moon is made of cheese. This is the imaginary world I mean.';
    const result = await createClassifier(fixtureClient(candidate => candidate.includes('The Moon') ? { scope: 0.2 } : { structure: 'multiple_propositions' }))(input(text), context());
    expect(result.action).toBe('skip');
    expect(result.claims).toEqual([]);
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

  it('skips a confidently classified complete whole-input preference on a manual request', async () => {
    const text = 'I prefer coffee to tea.';
    const result = await createClassifier(fixtureClient(() => ({ kind: 'opinion' })))(input(text, true), context());
    expect(result).toMatchObject({ action: 'skip', reasonCode: 'not_eligible_public_fact', claims: [] });
  });

  it('keeps clarification when an opinion is paired with an unresolved public claim', async () => {
    const text = 'I prefer coffee to tea. Unemployment is 7%.';
    const classify = createClassifier(fixtureClient(candidate => candidate.includes('Unemployment')
      ? { self: 0.5 }
      : candidate === text ? { kind: 'mixed', structure: 'multiple_propositions' } : { kind: 'opinion' }));
    expect(await classify(input(text, true), context())).toMatchObject({ action: 'needs_confirmation', reasonCode: 'incomplete_or_unclear', claims: [] });
  });

  it('admits an exact public claim beside an opinion', async () => {
    const text = 'I prefer coffee to tea. The Eiffel Tower opened in 1889.';
    const classify = createClassifier(fixtureClient(candidate => candidate === text
      ? { kind: 'mixed', structure: 'multiple_propositions' }
      : candidate.includes('Eiffel Tower') ? {} : { kind: 'opinion' }));
    const result = await classify(input(text, true), context());
    expect(result.action).toBe('check');
    expect(result.claims.map(claim => claim.checkedText)).toEqual(['The Eiffel Tower opened in 1889.']);
  });

  it('keeps clarification when opinion classification confidence is below the existing threshold', async () => {
    const base = fixtureClient(() => ({ kind: 'opinion' }));
    const uncertain: JevClient = { ask: async (request, ctx) => {
      const answers = await base.ask(request, ctx);
      for (const [name, question] of Object.entries(request.questions)) {
        if (!name.endsWith('_kind') || question.type !== 'choice') continue;
        const otherProbability = 0.21 / (Object.keys(question.criteria).length - 1);
        answers[name] = {
          choice: 'opinion',
          probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === 'opinion' ? 0.79 : otherProbability]))
        };
      }
      return answers;
    } };
    const result = await createClassifier(uncertain)(input('I prefer coffee to tea.', true), context());
    expect(result).toMatchObject({ action: 'needs_confirmation', reasonCode: 'not_eligible_public_fact', claims: [] });
  });

  it('keeps clarification for an incomplete preference', async () => {
    const result = await createClassifier(fixtureClient(() => ({ kind: 'opinion', self: 0.84 })))(input('I prefer coffee to tea.', true), context());
    expect(result).toMatchObject({ action: 'needs_confirmation', reasonCode: 'not_eligible_public_fact', claims: [] });
  });

  it('waits for incomplete automatic input and clarifies manual input', async () => {
    const classify = createClassifier(fixtureClient(() => ({ kind: 'incomplete_or_unclear', self: 0.1 })));
    expect(await classify(input('Unemployment is 7%.'), context())).toMatchObject({ action: 'wait', claims: [] });
    expect(await classify(input('Unemployment is 7%.', true), context())).toMatchObject({ action: 'needs_confirmation', claims: [] });
  });

  it('waits for an unfinished conditional instead of treating it as a completed hypothetical', async () => {
    const classify = createClassifier(fixtureClient(() => ({ kind: 'incomplete_or_unclear', self: 0.1, assertion: 'unclear' })));
    expect(await classify(input('If air pressure drops, water'), context())).toMatchObject({ action: 'wait', claims: [] });
  });

  it('skips a completed hypothetical without converting it into a literal assertion', async () => {
    const classify = createClassifier(fixtureClient(() => ({ assertion: 'nonliteral_or_quoted' })));
    expect(await classify(input('If pressure is low, water boils early.'), context())).toMatchObject({ action: 'skip', reasonCode: 'nonliteral_or_quoted', claims: [] });
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

  it.each([[401, 'jev_authentication', 1], [403, 'jev_authentication', 1], [429, 'jev_rate_limited', 2], [503, 'jev_unavailable', 2]] as const)('keeps HTTP %i operational with the bounded retry policy', async (status, code, attempts) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('provider body with secrets must never escape', { status }));
    await expect(createJevClient({ apiKey: 'test-only-key', fetch: fetcher }).ask(request, context())).rejects.toMatchObject({ code, message: code });
    expect(fetcher).toHaveBeenCalledTimes(attempts);
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
