import { describe, expect, it } from 'vitest';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { createTestContext, jsonResponse, recordingFetch, scriptedJev } from '../../sources/testing.js';
import { createFactCheckSearch, factCheckRequestUrl, parseFactChecks, type FactCheckReview } from './client.js';
import { factCheckCandidates, factCheckEvidence, factCheckQuestions, matchFactChecks, ratingLabel } from './match.js';

/** The documented `claims:search` response shape. */
const response = {
  claims: [{ text: 'Bats are blind', claimant: 'Facebook post', claimDate: '2024-03-01T00:00:00Z', claimReview: [
    { publisher: { name: 'PolitiFact', site: 'politifact.com' }, url: 'https://www.politifact.com/factchecks/2024/bats/', title: "No, bats aren't blind",
      reviewDate: '2024-03-05T10:00:00Z', textualRating: 'False', languageCode: 'en' },
    { publisher: { site: 'fullfact.org' }, url: 'https://fullfact.org/bats', textualRating: 'Incorrect', languageCode: 'en' },
    { publisher: { name: 'No link' }, textualRating: 'False' },
  ] }],
  nextPageToken: 'abc',
};
const review = (rating: string, url = 'https://www.politifact.com/factchecks/bats/', publisher = 'PolitiFact'): FactCheckReview =>
  ({ claim: 'Bats are blind', publisher, site: new URL(url).hostname.replace(/^www\./, ''), url, title: null, rating, date: '2023-11-14T22:13:20Z' });

describe('S1 Google Fact Check Tools', () => {
  it('parses each review with a site, an https link on it and a rating', () => {
    const reviews = parseFactChecks(response);
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toEqual({ claim: 'Bats are blind', publisher: 'PolitiFact', site: 'politifact.com', url: 'https://www.politifact.com/factchecks/2024/bats/',
      title: "No, bats aren't blind", rating: 'False', date: '2024-03-05T10:00:00Z' });
    expect(reviews[1].publisher).toBe('fullfact.org');
    expect(parseFactChecks({})).toEqual([]);
  });

  it('drops a link off the publisher site or not on https', () => {
    const body = { claims: [{ text: 'Bats are blind', claimReview: [
      { publisher: { name: 'PolitiFact', site: 'politifact.com' }, url: 'https://evil.example/fake', textualRating: 'False' },
      { publisher: { name: 'PolitiFact', site: 'politifact.com' }, url: 'http://www.politifact.com/x', textualRating: 'False' },
      { publisher: { name: 'PolitiFact', site: 'politifact.com' }, url: 'https://www.politifact.com/x', textualRating: 'False' },
    ] }] };
    expect(parseFactChecks(body).map(r => r.url)).toEqual(['https://www.politifact.com/x']);
  });

  it('malformed bodies throw', () => {
    for (const body of [null, 'x', [], { claims: 'x' }]) expect(() => parseFactChecks(body)).toThrow(PipelineError);
  });

  it('maps matched reviews to schema-valid fact_check evidence', () => {
    const candidates = factCheckCandidates([review('False')]);
    const [evidence] = factCheckEvidence(candidates, { same1: { noul: 0.9 } }, '2026-11-14T10:00:00.000Z');
    expect(evidenceSchema.parse(evidence)).toBeTruthy();
    expect(evidence).toMatchObject({ origin: 'fact_check', rating: 'contradicted', stance: 'contradicts', stanceProbability: 1, publisher: 'PolitiFact',
      excerpt: 'Rated “False” by PolitiFact. Claim checked: Bats are blind', title: 'PolitiFact fact check', publishedAt: '2023-11-14T22:13:20Z' });
    expect(evidence.id).toMatch(/^fact_check-[0-9a-f]{16}$/);
  });
});

describe('S2 fact checks', () => {
  it('no key means no fetch: the live sources leave the source out', async () => {
    const recorded = recordingFetch(() => jsonResponse(response));
    const search = createFactCheckSearch({ apiKey: ' ', fetch: recorded.fetch });
    await expect(search.reviews('Bats are blind', createTestContext(), 'c1')).rejects.toMatchObject({ code: 'missing_factcheck_key' });
    expect(recorded.requests).toHaveLength(0);
  });

  it('sends the key only in the header, never in the URL', async () => {
    const recorded = recordingFetch(() => jsonResponse(response));
    const context = createTestContext();
    await createFactCheckSearch({ apiKey: 'secret-key', fetch: recorded.fetch }).reviews('Bats are blind', context, 'c1');
    const [request] = recorded.requests;
    const url = new URL(request.url);
    expect(url.host).toBe('factchecktools.googleapis.com');
    expect(url.pathname).toBe('/v1alpha1/claims:search');
    expect(request.url).not.toContain('secret-key');
    expect(request.headers['x-goog-api-key']).toBe('secret-key');
    expect(request.method).toBe('GET');
    expect(Object.fromEntries(url.searchParams)).toEqual({ query: 'Bats are blind', pageSize: '5', languageCode: 'en' });
    expect(factCheckRequestUrl('x'.repeat(400)).length).toBeLessThan(400);
    expect(context.used('factcheck', 'c1')).toBe(1);
  });

  it('a rejected key or an outage throws; the allowance is one request', async () => {
    const rejected = createFactCheckSearch({ apiKey: 'k', fetch: recordingFetch(() => jsonResponse({ error: {} }, 403)).fetch });
    await expect(rejected.reviews('x', createTestContext(), 'c')).rejects.toMatchObject({ code: 'factcheck_rejected' });
    const down = createFactCheckSearch({ apiKey: 'k', fetch: recordingFetch(() => jsonResponse('', 503)).fetch });
    await expect(down.reviews('x', createTestContext(), 'c')).rejects.toMatchObject({ code: 'factcheck_unavailable' });
    const context = createTestContext();
    const ok = createFactCheckSearch({ apiKey: 'k', fetch: recordingFetch(() => jsonResponse(response)).fetch });
    await ok.reviews('x', context, 'c');
    await expect(ok.reviews('x', context, 'c')).rejects.toMatchObject({ code: 'factcheck_budget_exhausted' });
  });

  it('same-claim 0.69 is dropped and 0.7 kept, in one Jev ask', async () => {
    const reviews = [review('False'), review('True', 'https://fullfact.org/c', 'Full Fact')];
    const jev = scriptedJev(() => ({ same1: { noul: 0.69 }, same2: { noul: 0.7 } }));
    const context = createTestContext();
    const evidence = await matchFactChecks(reviews, { text: 'Bats are blind.', subject: null }, jev, context);
    expect(evidence.map(e => e.url)).toEqual(['https://fullfact.org/c']);
    expect(evidence[0].rating).toBe('supported');
    expect(jev.requests).toHaveLength(1);
    expect(context.used('jev')).toBe(1);
    expect(jev.requests[0].state).toMatchObject({ 'selected claim': 'Bats are blind.' });
    expect(jev.requests[0].state).not.toHaveProperty('the claim is about');
    // Fact-checker text travels in the state; the questions name a fact check by number only.
    expect((jev.requests[0].state as { 'fact checks': { number: number; rating: string }[] })['fact checks'].map(check => [check.number, check.rating])).toEqual([[1, 'False'], [2, 'True']]);
    expect(Object.values(jev.requests[0].questions).map(question => question.instructions).join(' ')).not.toContain(reviews[0].claim);
  });

  it('"Pants on Fire" is contradicted; misleading takes neither side; unknown ratings go to Jev', async () => {
    expect(ratingLabel('Pants on Fire!')).toBe('contradicted');
    expect(ratingLabel('Mostly true: the figure is from 2019')).toBe('supported');
    expect(ratingLabel('Half-True')).toBe('misleading');
    expect(ratingLabel('Fehlender Kontext')).toBe('misleading');
    expect(ratingLabel('Unproven')).toBe('unverifiable');
    expect(ratingLabel('Misattributed')).toBeNull();
    expect(ratingLabel('Satire')).toBeNull();
    const candidates = factCheckCandidates([review('False'), review('Misattributed', 'https://www.snopes.com/x', 'Snopes'), review('False'),
      review('Unproven', 'https://leadstories.com/b'), review('Missing context', 'https://fullfact.org/m')]);
    expect(candidates).toHaveLength(4);
    expect(Object.keys(factCheckQuestions(candidates)).sort()).toEqual(['rating2', 'same1', 'same2', 'same3', 'same4']);
    const jev = scriptedJev(() => ({ same1: { noul: 0.9 }, same2: { noul: 0.8 }, rating2: { choice: 'false', probabilities: { supported: 0, false: 0.9, misleading: 0.1, unverifiable: 0 } },
      same3: { noul: 0.95 }, same4: { noul: 0.9 } }));
    const evidence = await matchFactChecks(candidates.map(c => c.review), { text: 'Bats are blind.', subject: 'Bats' }, jev, createTestContext());
    expect(evidence.map(e => [e.publisher, e.rating, e.stance])).toEqual([
      ['PolitiFact', 'contradicted', 'contradicts'], ['Snopes', 'contradicted', 'contradicts'], ['PolitiFact', 'misleading', 'unrelated']]);
    expect(jev.requests[0].state).toMatchObject({ 'selected claim': 'Bats are blind.', 'the claim is about': 'Bats' });
    expect(Object.values(jev.requests[0].questions).map(question => question.instructions).join(' ')).not.toContain('Misattributed');
  });

  it('no candidates means no Jev request; a missing answer is malformed', async () => {
    const jev = scriptedJev(() => ({}));
    expect(await matchFactChecks([], { text: 'x', subject: null }, jev, createTestContext())).toEqual([]);
    expect(jev.requests).toHaveLength(0);
    await expect(matchFactChecks([review('False')], { text: 'x', subject: null }, jev, createTestContext())).rejects.toMatchObject({ code: 'malformed_provider' });
  });
});
