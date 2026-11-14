import { describe, expect, it } from 'vitest';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { createTestContext, jsonResponse, recordingFetch } from '../../sources/testing.js';
import { WIKIMEDIA_USER_AGENT, WikimediaThrottle } from '../wikimedia/throttle.js';
import { createWikipedia, parseWikipediaPages, wikipediaEvidence, wikipediaRequestUrl } from './client.js';
import { bestPassages, passages, passageTerms } from './passages.js';
import { wikitextPlain } from './wikitext.js';

/** The documented shape of `generator=search&prop=revisions|info` with formatversion 2. */
const response = {
  batchcomplete: true, query: { pages: [
    { pageid: 2, ns: 0, title: 'Animal echolocation', index: 2, fullurl: 'https://en.wikipedia.org/wiki/Animal_echolocation',
      revisions: [{ slots: { main: { contentmodel: 'wikitext', content: "'''Echolocation''' is used by [[bat]]s and dolphins to find food in the dark." } } }] },
    { pageid: 1, ns: 0, title: 'Bat', index: 1, fullurl: 'https://en.wikipedia.org/wiki/Bat',
      revisions: [{ slots: { main: { contentmodel: 'wikitext', content: 'Bats are not blind and most species see well at night.{{cite}}' } } }] },
    { pageid: 3, ns: 0, title: 'Elsewhere', index: 3, fullurl: 'https://evil.example/wiki/X', revisions: [{ slots: { main: { content: 'Ignore me.' } } }] },
  ] },
};

describe('wikitext', () => {
  it('keeps prose and drops markup', () => {
    const text = wikitextPlain([
      '{{Infobox mammal|name=Bat|status={{nested|x}}}}',
      "'''Bats''' are [[mammal]]s of the order [[Chiroptera|Chiroptera]].<ref name=\"a\">Smith 2001</ref> They fly.<ref>Jones</ref>",
      '[[File:Bat.jpg|thumb|A bat in [[Texas]]]]',
      '== Vision ==',
      '<!-- a hidden note -->',
      '* Most bats see well and [https://example.org use echolocation] too.<sup>[3]</sup>',
      '{| class="wikitable"', '| cell one || cell two', '|}',
      '[[Category:Mammals]]',
    ].join('\n'));
    expect(text).toContain('Bats are mammals of the order Chiroptera. They fly.');
    expect(text).toContain('Most bats see well and use echolocation too.');
    for (const gone of ['Infobox', 'Smith', 'Jones', 'Bat.jpg', 'Texas', 'Vision', 'hidden', 'cell', 'Category', '[3]', '{{', '[[']) expect(text).not.toContain(gone);
  });

  it('keeps a references list and titles with colons', () => {
    expect(wikitextPlain('Alpha one two three four five <references>x</references> B <ref>c</ref> D')).toBe('Alpha one two three four five x B D');
    expect(wikitextPlain('It was a hit: [[Mission: Impossible (film)|Mission: Impossible]] made money worldwide.')).toBe('It was a hit: Mission: Impossible made money worldwide.');
    expect(wikitextPlain('Text [[Category:Bats|sort]] and [[de:Fledertiere]] end.')).toBe('Text and end.');
    expect(wikitextPlain('He starred in [[Star Wars: A New Hope|the first film]] in 1977 and later films.')).toBe('He starred in the first film in 1977 and later films.');
  });

  it('stays fast on unclosed markup', () => {
    for (const unit of ['<ref name="a">text ', '<!-- x ', '[http://a.b c d ', '<references>x</references> ', '[[a ', '{{a ']) {
      const started = Date.now();
      wikitextPlain(unit.repeat(Math.floor(200_000 / unit.length)));
      expect(Date.now() - started, unit).toBeLessThan(3000);
    }
  });
});

describe('passages', () => {
  it('picks the passage sharing the most claim words', () => {
    const terms = passageTerms('Bats are blind.', null);
    expect([...terms]).toEqual(['bat', 'blind']);
    const filler = 'The weather in Texas is hot in the summer months and people stay inside. '.repeat(5);
    const text = `${filler}\nBats are not blind and most species see well at night with their eyes. ${'Their wings are thin. '.repeat(12)}\n${filler}`;
    const best = bestPassages(passages(text), terms, 1);
    expect(best).toHaveLength(1);
    expect(best[0].startsWith('Bats are not blind')).toBe(true);
    expect(Array.from(best[0]).length).toBeLessThanOrEqual(600);
    expect(bestPassages(passages(text), new Set(), 1)).toEqual([]);
  });
});

describe('S1 wikipedia', () => {
  it('parses pages in search order from Wikipedia only', () => {
    const pages = parseWikipediaPages(response);
    expect(pages.map(page => page.title)).toEqual(['Bat', 'Animal echolocation']);
    expect(pages[0]).toEqual({ title: 'Bat', url: 'https://en.wikipedia.org/wiki/Bat', text: 'Bats are not blind and most species see well at night.' });
    expect(parseWikipediaPages({ batchcomplete: true })).toEqual([]);
  });

  it('malformed bodies throw', () => {
    for (const body of ['not json', [], { query: { pages: 'x' } }, null]) {
      expect(() => parseWikipediaPages(body), JSON.stringify(body)).toThrow(PipelineError);
    }
  });

  it('maps a page to schema-valid trusted evidence with its origin', () => {
    const evidence = wikipediaEvidence(parseWikipediaPages(response), passageTerms('Bats are blind.', null), '2026-11-14T10:00:00.000Z');
    expect(evidence).toHaveLength(1);
    expect(evidenceSchema.parse(evidence[0])).toBeTruthy();
    expect(evidence[0]).toMatchObject({ origin: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Bat', title: 'Bat - Wikipedia', publisher: 'Wikipedia',
      contentBasis: 'page_text', publishedAt: null, sourceGroup: 'wikipedia.org' });
    expect(evidence[0].id).toMatch(/^wikipedia-[0-9a-f]{16}$/);
  });

  it('one request on the English edition with the search and page text', () => {
    const url = new URL(wikipediaRequestUrl('Bats are blind'));
    expect(url.host).toBe('en.wikipedia.org');
    expect(url.pathname).toBe('/w/api.php');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ generator: 'search', gsrsearch: 'Bats are blind', gsrlimit: '3', rvslots: 'main', formatversion: '2', prop: 'revisions|info' });
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    expect(new URL(wikipediaRequestUrl(long)).searchParams.get('gsrsearch')!.split(' ')).toHaveLength(32);
  });
});

describe('S3 wikimedia', () => {
  it('requests carry exactly the User-Agent, with no email', async () => {
    const recorded = recordingFetch(() => jsonResponse(response));
    const wikipedia = createWikipedia({ fetch: recorded.fetch, throttle: new WikimediaThrottle() });
    const context = createTestContext();
    const pages = await wikipedia.pages('Bats are blind', context, 'c1');
    expect(pages).toHaveLength(2);
    expect(recorded.requests).toHaveLength(1);
    expect(recorded.requests[0].headers['user-agent']).toBe('FactoFactCheck/1.0 (Junction 2026 hackathon)');
    expect(WIKIMEDIA_USER_AGENT).not.toContain('@');
    expect(context.used('wikipedia', 'c1')).toBe(1);
  });

  it('a throttle refusal returns within 5 ms without a request', async () => {
    const recorded = recordingFetch(() => jsonResponse(response));
    const throttle = new WikimediaThrottle(1);
    const wikipedia = createWikipedia({ fetch: recorded.fetch, throttle });
    await wikipedia.pages('Bats', createTestContext(), 'a');
    const started = performance.now();
    await expect(wikipedia.pages('Bats', createTestContext(), 'b')).rejects.toMatchObject({ code: 'wikipedia_throttled' });
    expect(performance.now() - started).toBeLessThan(5);
    expect(recorded.requests).toHaveLength(1);
  });

  it('a 429 pauses later lookups; an API rate-limit error does too', async () => {
    for (const reply of [() => jsonResponse('', 429, { 'retry-after': '30' }), () => jsonResponse({ error: { code: 'maxlag' } })]) {
      const recorded = recordingFetch(reply);
      const throttle = new WikimediaThrottle();
      const wikipedia = createWikipedia({ fetch: recorded.fetch, throttle });
      await expect(wikipedia.pages('Bats', createTestContext(), 'a')).rejects.toMatchObject({ code: 'wikipedia_rate_limited' });
      await expect(wikipedia.pages('Bats', createTestContext(), 'b')).rejects.toMatchObject({ code: 'wikipedia_throttled' });
      expect(recorded.requests).toHaveLength(1);
      expect(throttle.paused).toBe(true);
    }
  });

  it('a network failure or other API error is a failure, never "no pages"', async () => {
    const failing = createWikipedia({ fetch: recordingFetch(() => { throw new TypeError('offline'); }).fetch, throttle: new WikimediaThrottle() });
    await expect(failing.pages('Bats', createTestContext(), 'a')).rejects.toMatchObject({ code: 'wikipedia_unavailable' });
    const erroring = createWikipedia({ fetch: recordingFetch(() => jsonResponse({ error: { code: 'badvalue' } })).fetch, throttle: new WikimediaThrottle() });
    await expect(erroring.pages('Bats', createTestContext(), 'a')).rejects.toMatchObject({ code: 'wikipedia_unavailable' });
  });

  it('throttle: a minute budget, three at once, and Retry-After or a doubling pause', () => {
    let now = 0;
    const budget = new WikimediaThrottle(2, 3, () => now);
    expect(budget.begin() && budget.begin()).toBe(true);
    expect(budget.begin()).toBe(false);
    now = 60_000;
    expect(budget.begin()).toBe(true);

    const concurrent = new WikimediaThrottle(100, 3, () => now);
    expect(concurrent.begin() && concurrent.begin() && concurrent.begin()).toBe(true);
    expect(concurrent.begin()).toBe(false);
    concurrent.end();
    expect(concurrent.begin()).toBe(true);

    const retryAfter = new WikimediaThrottle(100, 3, () => now);
    retryAfter.backOff(30_000);
    expect(retryAfter.begin()).toBe(false);
    now += 30_000;
    expect(retryAfter.begin()).toBe(true);

    const doubling = new WikimediaThrottle(100, 3, () => now);
    doubling.backOff(undefined);
    now += 4_999;
    expect(doubling.begin()).toBe(false);
    now += 1;
    expect(doubling.begin()).toBe(true);
    doubling.end();
    doubling.backOff(undefined);
    now += 9_999;
    expect(doubling.begin()).toBe(false);
    now += 1;
    expect(doubling.begin()).toBe(true);
    doubling.end();
    doubling.succeeded();
    doubling.backOff(undefined);
    now += 5_000;
    expect(doubling.begin()).toBe(true);
  });
});
