import { describe, expect, it, vi } from 'vitest';
import { alignTargetQuote, createVisionTargetSelector, decodeProviderSelection, parseTargetSelectionRequest, validateTargetSelection, type TargetSelectionRequest } from './target-selection.js';

const imageBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const line = (id: string, text: string) => ({ id, text, confidence: 0.95, polygon: [[0.1, 0.1], [0.8, 0.1], [0.8, 0.2], [0.1, 0.2]] });
const input = (): TargetSelectionRequest => parseTargetSelectionRequest({ imageBase64, lines: [line('L1', 'One router took down flights'), line('L2', 'Soft paywall'), line('L3', 'Another news story')].map((value, index) => ({ ...value, polygon: value.polygon.map(([x, y]) => [x, y + index * 0.3]) })) });
const selected = () => ({ status: 'selected', selectedLineIds: ['L1'], contextLineIds: [], candidates: [{ id: 'post', role: 'post_title', lineIds: ['L1'] }], selectedCandidateId: 'post' });
const providerSelected = () => ({ items: [{ role: 'headline', quote: 'One router took down flights', incomplete: false }] });
const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));

describe('immutable OCR target selection', () => {
  it('reconstructs exact source words and excludes context from claim text', () => {
    expect(validateTargetSelection({ ...selected(), contextLineIds: ['L2'] }, input()).text).toBe('One router took down flights');
  });
  it('uses original geometry instead of reversing a wrapped claim in model order', () => {
    const source = input();
    source.lines[0].text = 'The government did not';
    source.lines[1].text = 'confirm the allegation';
    source.lines[1].polygon = [[0.1, 0.21], [0.8, 0.21], [0.8, 0.3], [0.1, 0.3]];
    const value = { ...selected(), selectedLineIds: ['L2', 'L1'], candidates: [{ id: 'post', role: 'post_title', lineIds: ['L2', 'L1'] }] };
    expect(validateTargetSelection(value, source).text).toBe('The government did not\nconfirm the allegation');
    expect(validateTargetSelection(value, source).selectedLineIds).toEqual(['L1', 'L2']);
  });
  it.each([
    { ...selected(), text: 'invented replacement' },
    { ...selected(), selectedLineIds: ['invented'] },
    { ...selected(), selectedLineIds: ['L1', 'L1'] },
    { ...selected(), contextLineIds: ['L1'] },
    { ...selected(), selectedLineIds: ['L1', 'L3'], candidates: [{ id: 'post', role: 'post', lineIds: ['L1'] }, { id: 'other', role: 'post', lineIds: ['L3'] }] },
    { ...selected(), candidates: [{ id: 'post', role: 'post', lineIds: ['L1'] }, { id: 'other', role: 'post', lineIds: ['L1'] }] },
    { ...selected(), status: 'no_text' },
    { ...selected(), selectedCandidateId: 'unknown' },
  ])('rejects generated text, hallucinated IDs, duplicate observations, and mixing items', value => {
    expect(() => validateTargetSelection(value, input())).toThrow();
  });
  it('returns competing items without a target and rejects false no_text', () => {
    const value = { status: 'needs_target', selectedLineIds: [], contextLineIds: [], candidates: [{ id: 'one', role: 'post', lineIds: ['L1'] }, { id: 'two', role: 'post', lineIds: ['L3'] }] };
    expect(validateTargetSelection(value, input()).text).toBe('');
    expect(() => validateTargetSelection({ ...value, status: 'no_text' }, input())).toThrow();
  });
  it.each(['President Putin is official Dea... View more', 'A collapsed claim…'])('blocks visible truncation: %s', text => {
    const source = input(); source.lines[0].text = text;
    expect(validateTargetSelection(selected(), source).status).toBe('incomplete');
  });
  it('does not confuse ordinary claim words with expansion controls', () => {
    const source = input(); source.lines[0].text = 'Children who read more score higher on tests';
    expect(validateTargetSelection(selected(), source).status).toBe('selected');
  });
  it('bounds image, intent, text, coordinate and duplicate-ID inputs', () => {
    expect(() => parseTargetSelectionRequest({ ...input(), imageBase64: 'invalid' })).toThrow();
    expect(() => parseTargetSelectionRequest({ ...input(), imageBase64: Buffer.from('not an image').toString('base64') })).toThrow();
    expect(() => parseTargetSelectionRequest({ ...input(), intent: 'x'.repeat(501) })).toThrow();
    expect(() => parseTargetSelectionRequest({ ...input(), lines: [line('L1', 'a'), line('L1', 'b')] })).toThrow();
    expect(() => parseTargetSelectionRequest({ ...input(), lines: [{ ...line('L1', 'a'), polygon: [[0, 0], [0, 0], [0, 0], [0, 0]] }] })).toThrow();
    expect(() => parseTargetSelectionRequest({ ...input(), lines: [{ ...line('L1', 'a'), confidence: 1.1 }] })).toThrow();
  });
});

describe('quote locators grounded to immutable observations', () => {
  it('matches only a unique complete spatial source span, preserving OCR spelling', () => {
    const source = input();
    source.lines[0].text = 'US avlation shutdown blamed on';
    source.lines[1].text = 'L3 Harris installed router';
    source.lines[1].polygon = [[0.1, 0.21], [0.8, 0.21], [0.8, 0.3], [0.1, 0.3]];
    const value = { items: [{ role: 'headline', quote: 'US aviation shutdown blamed on L3 Harris installed router', incomplete: false }] };
    expect(alignTargetQuote(value.items[0].quote, source)).toEqual(['L1', 'L2']);
    expect(decodeProviderSelection(value, source).text).toBe('US avlation shutdown blamed on\nL3 Harris installed router');
    expect(() => alignTargetQuote('US aviation shutdown', source)).toThrow();
  });
  it('rejects repeated content and ambiguity caused by i/l normalization', () => {
    const source = input(); source.lines[1].text = source.lines[0].text;
    expect(() => alignTargetQuote(source.lines[0].text, source)).toThrow('ambiguous');
    source.lines[0].text = 'The aviation claim is official'; source.lines[1].text = 'The avlation claim is official';
    expect(() => alignTargetQuote('The aviation claim is official', source)).toThrow('ambiguous');
  });
  it('rejects missing negation, changed numbers and different words, with no fuzzy repair', () => {
    const source = input(); source.lines[0].text = 'Iran did not spend 15 billion dollars';
    for (const quote of ['Iran did spend 15 billion dollars', 'Iran did not spend 50 billion dollars', 'Iraq did not spend 15 billion dollars', 'Iran did not spend l5 billion dollars']) {
      expect(() => alignTargetQuote(quote, source)).toThrow();
    }
  });
  it('rejects a quote assembled across separate columns or distant blocks', () => {
    const source = input(); source.lines[0].text = 'The official said'; source.lines[1].text = 'the claim was false';
    source.lines[1].polygon = [[0.85, 0.21], [0.99, 0.21], [0.99, 0.3], [0.85, 0.3]];
    expect(() => alignTargetQuote('The official said the claim was false', source)).toThrow();
    source.lines[1].polygon = [[0.1, 0.8], [0.8, 0.8], [0.8, 0.9], [0.1, 0.9]];
    expect(() => alignTargetQuote('The official said the claim was false', source)).toThrow();
  });
  it('coalesces equivalent mapped views while preserving original source IDs', () => {
    const source = input(); source.lines = [{ ...source.lines[0], id: 'original-0' }, { ...source.lines[0], id: 'screen-0' }];
    expect(alignTargetQuote('One router took down flights', source)).toEqual(['original-0']);
    expect(decodeProviderSelection(providerSelected(), source).text).toBe('One router took down flights');
  });
  it('keeps conflicting mapped words or numbers ambiguous instead of preferring a view', () => {
    const source = input(); source.lines = [line('original-0', 'The cost was 15 billion dollars'), line('screen-0', 'The cost was 50 billion dollars')] as TargetSelectionRequest['lines'];
    expect(() => alignTargetQuote('The cost was 15 billion dollars', source)).toThrow('conflicting');
    source.lines[0].text = 'The aviation claim is official'; source.lines[1].text = 'The avlation claim is official';
    expect(alignTargetQuote('The aviation claim is official', source)).toEqual(['original-0']);
    source.lines[0].text = 'Iran said the claim is official'; source.lines[1].text = 'Iraq said the claim is official';
    expect(() => alignTargetQuote('Iran said the claim is official', source)).toThrow('conflicting');
  });
  it('cannot skip an intervening negation or qualifier within a source column', () => {
    const source = input();
    source.lines = ['The claim was', 'not confirmed but merely', 'widely reported'].map((text, index) => ({ id: `L${index}`, text, confidence: 0.95, polygon: [[0.1, 0.1 + index * 0.05], [0.8, 0.1 + index * 0.05], [0.8, 0.14 + index * 0.05], [0.1, 0.14 + index * 0.05]] }));
    expect(() => alignTargetQuote('The claim was widely reported', source)).toThrow();
    expect(alignTargetQuote('The claim was not confirmed but merely widely reported', source)).toEqual(['L0', 'L1', 'L2']);
  });
  it('does not expose cut-off feed items to the native picker or auto-select the survivor', () => {
    const value = { items: [...providerSelected().items, { role: 'headline', quote: 'Another news story', incomplete: true }] };
    expect(decodeProviderSelection(value, input())).toMatchObject({ status: 'needs_target', selectedLineIds: [], candidates: [{ id: 'item1' }], reason: expect.stringContaining('incomplete') });
    expect(decodeProviderSelection({ items: value.items.map(item => ({ ...item, incomplete: true })) }, input())).toMatchObject({ status: 'unreadable', selectedLineIds: [], candidates: [], reason: expect.stringContaining('incomplete') });
  });
  it('retains incomplete status without completing collapsed or cut-off claims', () => {
    expect(decodeProviderSelection({ items: [{ ...providerSelected().items[0], incomplete: true }] }, input()).status).toBe('incomplete');
  });
});

describe('independent multimodal provider', () => {
  it('derives public candidate and selected IDs exactly once from provider items', () => {
    expect(decodeProviderSelection(providerSelected(), input())).toMatchObject({ status: 'selected', selectedLineIds: ['L1'], selectedCandidateId: 'item1', contextLineIds: [], text: 'One router took down flights' });
    expect(() => decodeProviderSelection({ items: [{ role: 'headline', quote: 'An invented unrelated claim', incomplete: false }] }, input())).toThrow();
    expect(() => decodeProviderSelection({ items: [...providerSelected().items, ...providerSelected().items] }, input())).toThrow();
    expect(decodeProviderSelection({ items: [...providerSelected().items, { role: 'headline', quote: 'Another news story', incomplete: false }] }, input())).toMatchObject({ status: 'needs_target', selectedLineIds: [], text: '', candidates: [{ id: 'item1' }, { id: 'item2' }] });
    expect(decodeProviderSelection({ items: [...providerSelected().items, { role: 'headline', quote: 'Unmatched visible story', incomplete: false }] }, input())).toMatchObject({ status: 'needs_target', selectedLineIds: [], reason: expect.stringContaining('could not') });
  });
  it('sends original image + immutable IDs and returns exact selected words', async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(response(providerSelected()));
    const select = createVisionTargetSelector({ baseURL: 'http://localhost:8080/v1', model: 'vision-test', apiKey: 'secret', fetch: provider });
    expect((await select(input())).text).toBe('One router took down flights');
    const [url, init] = provider.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/v1/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });
    const payload = JSON.parse(String(init?.body));
    expect(payload.response_format.type).toBe('json_schema');
    expect(payload.response_format.json_schema.schema.properties.items.items.properties.quote.type).toBe('string');
    expect(payload.messages[1].content[0].image_url.url).toBe(`data:image/jpeg;base64,${imageBase64}`);
    expect(payload.messages[1].content[1].text).toContain('Intent:');
    expect(JSON.stringify(payload.messages)).not.toContain('One router took down flights');
  });
  it('fails closed on hallucinated IDs, HTTP failure, non-JSON, and large responses', async () => {
    for (const result of [response({ items: [{ role: 'post', quote: 'Unknown invented words', incomplete: false }] }), new Response('secret provider error', { status: 500 }), new Response('<html>'), new Response('x'.repeat(65_537))]) {
      const select = createVisionTargetSelector({ baseURL: 'http://localhost/v1', model: 'test', fetch: vi.fn<typeof fetch>().mockResolvedValue(result) });
      expect(await select(input())).toMatchObject({ status: 'unavailable', selectedLineIds: [], text: '', reason: 'selection_provider_error' });
    }
  });
  it('bounds an unresponsive provider even when fetch ignores cancellation', async () => {
    const provider = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined));
    const select = createVisionTargetSelector({ baseURL: 'http://localhost/v1', model: 'test', timeoutMs: 100, fetch: provider });
    expect(await select(input())).toMatchObject({ status: 'unavailable', reason: 'selection_timeout' });
    expect(provider.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('does not call provider for no observations', async () => {
    const provider = vi.fn<typeof fetch>();
    const select = createVisionTargetSelector({ baseURL: 'http://localhost/v1', model: 'test', fetch: provider });
    expect(await select({ ...input(), lines: [] })).toMatchObject({ status: 'no_text' });
    expect(provider).not.toHaveBeenCalled();
  });
});
