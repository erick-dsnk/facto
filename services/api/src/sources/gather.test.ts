import { describe, expect, it } from 'vitest';
import { PipelineError, sourceQuery, type AcceptedClaim, type Evidence, type SourceQuery } from '../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../packages/contracts/src/wire.js';
import { createFactCheckSearch, createMockFactCheckSearch } from '../providers/googlefactcheck/client.js';
import { createMockEncyclopedia, createWikipedia, type WikiPage } from '../providers/wikipedia/client.js';
import { createMockFactDatabase, createWikidata } from '../providers/wikidata/client.js';
import { createMockWeather, createOpenMeteo } from '../providers/openmeteo/client.js';
import { createExaPaidSearch } from '../providers/exa/paid-search.js';
import { createExaSearcher } from '../providers/exa/search.js';
import { WikimediaThrottle } from '../providers/wikimedia/throttle.js';
import { createDomainLists, loadDomainLists } from './domain-lists.js';
import { freeEvidence } from './evidence.js';
import { createEvidenceSources, createLiveSources, type SourceDeps } from './index.js';
import { createMockSources, createTestContext, jsonResponse, recordingFetch, scriptedJev, type RecordedRequest } from './testing.js';
import type { PaidSearch } from './types.js';

const query = (extra: Partial<SourceQuery> = {}): SourceQuery => ({
  claimId: 'c1', text: 'Helsinki is the capital of Finland.', subject: null, route: 'general', attribution: null, future: false, rumour: false, asOf: '2026-11-13', ...extra,
});
const noPaid: PaidSearch = { search: async () => { throw new Error('no paid search in this test'); } };
const jev = scriptedJev(() => ({}));
const bat: WikiPage = { title: 'Helsinki', url: 'https://en.wikipedia.org/wiki/Helsinki', text: 'Helsinki is the capital and most populous city of Finland, on the Gulf of Finland.' };
const record = (origin: 'wikidata' | 'weather', url: string): Evidence =>
  freeEvidence({ origin, url, title: origin, publisher: origin, excerpt: `${origin} says Helsinki is the capital of Finland.`, retrievedAt: '2026-11-13T10:00:00.000Z' });
const deps = (extra: Partial<SourceDeps> = {}): SourceDeps => ({ jev, paid: noPaid, lists: createDomainLists(), ...extra });
const never = () => new Promise<never>(() => undefined);

describe('gatherFree', () => {
  it('asks the applicable sources in parallel and orders fact checks, specials, then Wikipedia', async () => {
    const sources = createEvidenceSources(deps({
      encyclopedia: createMockEncyclopedia([bat]),
      factChecks: createMockFactCheckSearch([{ claim: 'Helsinki is the capital of Finland', publisher: 'PolitiFact', site: 'politifact.com',
        url: 'https://www.politifact.com/x', title: null, rating: 'True', date: null }]),
      wikidata: createMockFactDatabase([record('wikidata', 'https://www.wikidata.org/wiki/Q1757')]),
      jev: scriptedJev(() => ({ same1: { noul: 0.9 } })),
    }));
    const free = await sources.gatherFree(query({ route: 'named_fact' }), createTestContext());
    expect(free.evidence.map(e => e.origin)).toEqual(['fact_check', 'wikidata', 'wikipedia']);
    expect(free.answered).toEqual({ fact_check: true, wikipedia: true, wikidata: true, weather: null, calculation: true });
    for (const evidence of free.evidence) expect(evidenceSchema.parse(evidence)).toBeTruthy();
    expect(new Set(free.evidence.map(e => e.id)).size).toBe(3);
  });

  it('S4: one hung and one throwing source; the rest come back by 1.5 s', async () => {
    const sources = createEvidenceSources(deps({
      encyclopedia: createMockEncyclopedia(never),
      factChecks: createMockFactCheckSearch(new PipelineError('factcheck_unavailable', true)),
      wikidata: createMockFactDatabase([record('wikidata', 'https://www.wikidata.org/wiki/Q1757')]),
    }));
    const started = performance.now();
    const free = await sources.gatherFree(query({ route: 'named_fact' }), createTestContext());
    const elapsed = performance.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(1_400);
    expect(elapsed).toBeLessThan(1_700);
    expect(free.answered).toEqual({ fact_check: false, wikipedia: false, wikidata: true, weather: null, calculation: true });
    expect(free.evidence.map(e => e.origin)).toEqual(['wikidata']);
  });

  it('stops at the check deadline when it comes first, and does not wait when everything answered', async () => {
    let now = 1_000;
    const early = createEvidenceSources(deps({ encyclopedia: createMockEncyclopedia(never) }));
    const started = performance.now();
    const free = await early.gatherFree(query(), createTestContext({ now: () => now, deadlineAt: 1_050 }));
    expect(performance.now() - started).toBeLessThan(400);
    expect(free.answered.wikipedia).toBe(false);
    now = 0;
    const quick = createEvidenceSources(deps({ encyclopedia: createMockEncyclopedia([bat]) }));
    const fast = performance.now();
    await quick.gatherFree(query(), createTestContext());
    expect(performance.now() - fast).toBeLessThan(200);
  });

  it('a late answer after time ran out never changes the result', async () => {
    let release: (pages: WikiPage[]) => void = () => undefined;
    const slow = createMockEncyclopedia(() => new Promise<WikiPage[]>(resolve => { release = resolve; }));
    const free = await createEvidenceSources(deps({ encyclopedia: slow, freeDeadlineMs: 20 })).gatherFree(query(), createTestContext());
    release([bat]);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(free.answered.wikipedia).toBe(false);
    expect(free.evidence).toEqual([]);
  });

  it('cancellation rejects instead of returning partial evidence', async () => {
    const context = createTestContext();
    const pending = createEvidenceSources(deps({ encyclopedia: createMockEncyclopedia(never) })).gatherFree(query(), context);
    setTimeout(() => context.abort(new PipelineError('cancelled')), 10);
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('a calculation settles the free step on its own: no other source is asked', async () => {
    const encyclopedia = createMockEncyclopedia([bat]);
    const factChecks = createMockFactCheckSearch([]);
    const free = await createEvidenceSources(deps({ encyclopedia, factChecks })).gatherFree(query({ text: '7 times 8 is 54.', route: 'calculation' }), createTestContext());
    expect(free.evidence.map(e => e.excerpt)).toEqual(['7 × 8 = 56 (calculated)']);
    expect(free.answered).toEqual({ fact_check: null, wikipedia: null, wikidata: null, weather: null, calculation: true });
    expect(encyclopedia.queries).toEqual([]);
    expect(factChecks.queries).toEqual([]);
    // Routed elsewhere, a claim that happens to parse as a calculation still asks the other sources.
    const general = await createEvidenceSources(deps({ encyclopedia, factChecks })).gatherFree(query({ text: '7 times 8 is 54.', route: 'general' }), createTestContext());
    expect(general.answered).toMatchObject({ fact_check: true, wikipedia: true, calculation: true });
    expect(encyclopedia.queries).toHaveLength(1);
  });

  it('S7: a weather claim sends one forecast request; other routes make no weather or Wikidata call', async () => {
    const recorded = recordingFetch(() => jsonResponse({ daily: { time: ['2026-11-14'], temperature_2m_max: [1], temperature_2m_min: [-3], snowfall_sum: [3.2], rain_sum: [0], showers_sum: [0] } }));
    const encyclopedia = createMockEncyclopedia([bat]);
    const wikidata = createMockFactDatabase([]);
    const sources = createEvidenceSources(deps({ encyclopedia, wikidata, weather: createOpenMeteo({ fetch: recorded.fetch }) }));
    const context = createTestContext();
    const free = await sources.gatherFree(query({ text: 'It will snow in Helsinki tomorrow.', route: 'weather' }), context);
    expect(recorded.requests).toHaveLength(1);
    expect(new URL(recorded.requests[0].url).pathname).toBe('/v1/forecast');
    expect(free.answered).toMatchObject({ weather: true, wikipedia: null, wikidata: null });
    expect(free.evidence[0].excerpt).toContain('snowfall in Helsinki (3.2 cm)');
    expect(encyclopedia.queries).toEqual([]);

    const weather = createMockWeather([]);
    for (const route of ['general', 'recent_event', 'named_fact', 'calculation'] as const) {
      await createEvidenceSources(deps({ encyclopedia, wikidata, weather })).gatherFree(query({ text: 'It will snow in Helsinki tomorrow.', route }), createTestContext());
    }
    expect(weather.calls).toHaveLength(0);
    expect(wikidata.queries.map(q => q.claimId)).toEqual(['c1']); // only the named_fact route
  });

  it('a weather claim without a readable place or date falls back to the general free sources', async () => {
    const encyclopedia = createMockEncyclopedia([bat]);
    const weather = createMockWeather([]);
    const free = await createEvidenceSources(deps({ encyclopedia, weather })).gatherFree(query({ text: 'Helsinki has snowy winters.', route: 'weather' }), createTestContext());
    expect(weather.calls).toHaveLength(0);
    expect(free.answered).toMatchObject({ weather: null, wikipedia: true });
  });

  it('a weather reader that throws reads as an unanswered source, not a failed check', async () => {
    const weather = { ...createMockWeather([]), query: () => { throw new Error('cities missing'); } };
    const free = await createEvidenceSources(deps({ weather })).gatherFree(query({ text: 'It will snow in Helsinki tomorrow.', route: 'weather' }), createTestContext());
    expect(free.answered).toMatchObject({ weather: false, calculation: true });
  });

  it('spends each source from its own allowance and the fact-check Jev ask from the request', async () => {
    const recorded = recordingFetch(request => {
      if (request.url.includes('factchecktools')) return jsonResponse({ claims: [{ text: 'Helsinki is the capital of Finland', claimReview: [
        { publisher: { name: 'Full Fact', site: 'fullfact.org' }, url: 'https://fullfact.org/x', textualRating: 'Correct' }] }] });
      return jsonResponse({ query: { pages: [{ title: 'Helsinki', index: 1, fullurl: bat.url, revisions: [{ slots: { main: { content: bat.text } } }] }] } });
    });
    const context = createTestContext();
    const free = await createEvidenceSources(deps({
      jev: scriptedJev(() => ({ same1: { noul: 0.95 } })),
      factChecks: createFactCheckSearch({ apiKey: 'k', fetch: recorded.fetch }),
      encyclopedia: createWikipedia({ fetch: recorded.fetch, throttle: new WikimediaThrottle() }),
    })).gatherFree(query(), context);
    expect(free.evidence.map(e => e.origin)).toEqual(['fact_check', 'wikipedia']);
    expect(context.used('factcheck', 'c1')).toBe(1);
    expect(context.used('wikipedia', 'c1')).toBe(1);
    expect(context.used('jev')).toBe(1);
  });
});

describe('live sources', () => {
  const claim: AcceptedClaim = {
    id: 'c1', originalText: 'Call me at ada@example.com or +1 415 555 0100. Helsinki is the capital of Finland.',
    checkedText: 'Helsinki is the capital of Finland.', sourceSpan: { start: 47, end: 82 }, route: 'named_fact', subject: null,
    admission: { assertionStatus: 'asserted', hasPracticalConsequence: 0, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' },
  };

  it('S2: without a Google key nothing goes to Fact Check Tools and the source reads as not asked', async () => {
    const recorded = recordingFetch(() => jsonResponse({}));
    const sources = createLiveSources({ jev, exaApiKey: 'exa-key', fetch: recorded.fetch });
    const free = await sources.gatherFree(query(), createTestContext());
    expect(free.answered.fact_check).toBeNull();
    expect(recorded.requests.some(request => request.url.includes('factchecktools'))).toBe(false);
    expect(recorded.requests.some(request => request.url.includes('wikipedia.org'))).toBe(true);
  });

  it('S5: no request URL or body holds context, contact data or other parts of the original text', async () => {
    expect(claim.originalText.slice(47, 82)).toBe(claim.checkedText);
    const context = ['Speaker 1: My sister Maria lives at 12 Elm Street.', 'Speaker 2: Her doctor says she is pregnant.'];
    const requests: RecordedRequest[] = [];
    const recorded = recordingFetch(request => {
      requests.push(request);
      if (request.url.includes('api.exa.ai')) return jsonResponse({ results: [{ url: 'https://news.example.org/helsinki', title: 'Helsinki', highlights: ['Helsinki is the capital of Finland.'] }] });
      if (request.url.includes('factchecktools')) return jsonResponse({ claims: [] });
      if (request.url.includes('wikidata')) return jsonResponse({ search: [] });
      return jsonResponse({ query: { pages: [] } });
    });
    const asked = scriptedJev(() => ({}));
    const sources = createEvidenceSources({
      jev: asked, lists: loadDomainLists(),
      paid: createExaPaidSearch({ exa: createExaSearcher({ apiKey: 'exa-key', fetch: recorded.fetch }), lists: loadDomainLists() }),
      factChecks: createFactCheckSearch({ apiKey: 'google-key', fetch: recorded.fetch }),
      encyclopedia: createWikipedia({ fetch: recorded.fetch, throttle: new WikimediaThrottle() }),
      wikidata: createWikidata({ fetch: recorded.fetch, throttle: new WikimediaThrottle() }),
      weather: createOpenMeteo({ fetch: recorded.fetch }),
    });
    const source = sourceQuery(claim, Date.parse('2026-11-13T10:00:00Z'));
    const providerContext = createTestContext();
    await sources.gatherFree(source, providerContext);
    await sources.searchPaid({ ...source, route: 'recent_event' }, { purpose: 'primary' }, providerContext);
    await sources.searchPaid(source, { purpose: 'alternate' }, createTestContext());
    await sources.searchPaid(source, { purpose: 'corroboration', excludeSites: ['example.org'] }, createTestContext());
    expect(requests.length).toBeGreaterThanOrEqual(5);
    const forbidden = ['ada@example.com', '415', '555', 'Call me', 'Maria', 'Elm', 'pregnant', 'sister', ...context];
    for (const request of requests) {
      const sent = decodeURIComponent(`${request.url} ${request.body ?? ''}`);
      for (const text of forbidden) expect(sent, request.url).not.toContain(text);
    }
    for (const request of asked.requests) expect(JSON.stringify(request)).not.toContain('ada@example.com');
  });
});

describe('createMockSources', () => {
  it('scripts free and paid evidence and spends the search allowance like the live layer', async () => {
    const free = [record('wikidata', 'https://www.wikidata.org/wiki/Q1757')];
    const paid = [[record('weather', 'https://api.open-meteo.com/v1/forecast?a=1')], []];
    const sources = createMockSources({ free, paid, trusted: ['reuters.com'] });
    const context = createTestContext();
    expect((await sources.gatherFree(query(), context)).evidence).toEqual(free);
    expect((await sources.searchPaid(query({ route: 'recent_event' }), { purpose: 'primary' }, context)).categories).toEqual(['news']);
    expect((await sources.searchPaid(query(), { purpose: 'alternate' }, context)).categories).toEqual(['web']);
    expect(await sources.searchPaid(query(), { purpose: 'corroboration' }, context)).toEqual({ evidence: [], categories: [] });
    expect(sources.calls).toEqual({ free: 1, paid: [{ purpose: 'primary' }, { purpose: 'alternate' }] });
    expect(sources.traits(freeEvidence({ origin: 'web', url: 'https://www.reuters.com/a', title: 'a', publisher: null, excerpt: 'a', retrievedAt: '2026-11-13T10:00:00.000Z' }), null))
      .toEqual({ site: 'reuters.com', trusted: true });
  });
});
