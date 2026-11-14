import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CALCULATION_URL, type Evidence, type EvidenceOrigin } from '../../../../packages/contracts/src/index.js';
import { createDomainLists, DATA_DIRECTORY, loadDomainLists, parseDomainList, parsePublishers } from './domain-lists.js';
import { isOwnSite, rankEvidence, sourceTraits } from './ranking.js';

const item = (url: string, origin?: EvidenceOrigin, extra: Partial<Evidence> = {}): Evidence => ({
  id: `ev-${Math.abs([...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`, url, title: url, publisher: null, publishedAt: null,
  retrievedAt: '2026-11-14T10:00:00Z', contentBasis: 'highlight', excerpt: `About ${url}`, sourceGroup: 'x', echoGroup: null, sourceRole: 'unknown',
  directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null, ...(origin ? { origin } : {}), ...extra,
});
const host = (evidence: Evidence) => new URL(evidence.url).hostname.replace(/^www\./, '');
const lists = createDomainLists({
  unreliable: ['fakenews.example'], lowSignal: ['facebook.com', 'scribd.com', 'youtube.com'],
  trusted: ['wikipedia.org', 'snopes.com', 'reuters.com', 'nasa.gov'], publishers: { 'nasa.gov': 'NASA' },
});

describe('domain lists', () => {
  it('S10: the shipped lists hold 40 trusted, 1,726 unreliable and 97 low-signal domains, with their README', () => {
    const read = (name: string) => readFileSync(new URL(name, DATA_DIRECTORY), 'utf8');
    expect(parseDomainList(read('trusted-domains.txt')).domains).toHaveLength(40);
    expect(parseDomainList(read('trusted-domains.txt')).query).toHaveLength(8);
    expect(parseDomainList(read('unreliable-domains.txt')).domains).toHaveLength(1726);
    expect(parseDomainList(read('low-signal-domains.txt')).domains).toHaveLength(97);
    expect(existsSync(new URL('README.md', DATA_DIRECTORY))).toBe(true);
    expect(read('README.md')).toContain('CRED-1');
    expect(read('README.md')).toContain('GeoNames');
    expect(read('README.md')).toContain('CC BY 4.0');
  });

  it('the shipped lists block, trust and name sites; the held-back outlets are neither', () => {
    const shipped = loadDomainLists();
    expect(shipped.isBlocked('www.scribd.com') && shipped.isBlocked('m.youtube.com') && shipped.isBlocked('facebook.com')).toBe(true);
    expect(shipped.isTrusted('en.wikipedia.org')).toBe(true);
    for (const held of ['breitbart.com', 'gbnews.com', 'newsmax.com', 'oann.com']) expect(shipped.isBlocked(held) || shipped.isTrusted(held)).toBe(false);
    expect(shipped.publisher('www.nasa.gov')).toBe('NASA');
    expect(shipped.publisher('unknown.example')).toBeNull();
    const publishers = parsePublishers(readFileSync(new URL('publisher-names.txt', DATA_DIRECTORY), 'utf8'));
    for (const domain of parseDomainList(readFileSync(new URL('trusted-domains.txt', DATA_DIRECTORY), 'utf8')).domains) {
      expect(shipped.publisher(domain), domain).not.toBeNull();
    }
    expect(publishers.size).toBeGreaterThan(40);
  });

  it('site keys group subdomains like the reference app', () => {
    expect(lists.siteKey('en.wikipedia.org')).toBe('wikipedia.org');
    expect(lists.siteKey('a.b.example.com')).toBe('example.com');
    expect(lists.siteKey('www.bbc.co.uk')).toBe('bbc.co.uk');
    expect(lists.siteKey('localhost')).toBe('localhost');
  });
});

describe('S8 ranking', () => {
  it('drops blocked sites', () => {
    const picked = rankEvidence([], [item('https://www.facebook.com/post/1'), item('https://fakenews.example/a'), item('https://www.scribd.com/doc/1'),
      item('https://news.example.org/b')], lists);
    expect(picked.map(host)).toEqual(['news.example.org']);
  });

  it('puts trusted first, then search order', () => {
    const picked = rankEvidence([], [item('https://one.example/a', 'web'), item('https://en.wikipedia.org/wiki/A', 'web'), item('https://two.example/b', 'web'),
      item('https://www.snopes.com/x', 'web')], lists);
    expect(picked.map(host)).toEqual(['en.wikipedia.org', 'snopes.com', 'one.example', 'two.example']);
  });

  it('keeps at most two per site and six in all', () => {
    const paid = [1, 2, 3, 4].map(n => item(`https://en.wikipedia.org/wiki/${n}`, 'web'))
      .concat([1, 2, 3].map(n => item(`https://news.example.co.uk/${n}`, 'web')), [1, 2, 3, 4, 5].map(n => item(`https://site${n}.example/a`, 'web')));
    const picked = rankEvidence([], paid, lists);
    expect(picked).toHaveLength(6);
    expect(picked.filter(e => host(e).endsWith('wikipedia.org'))).toHaveLength(2);
    expect(picked.filter(e => host(e).endsWith('example.co.uk'))).toHaveLength(2);
    expect(picked.slice(0, 2).map(e => e.url)).toEqual(['https://en.wikipedia.org/wiki/1', 'https://en.wikipedia.org/wiki/2']);
  });

  it('counts the same page reached two ways once', () => {
    const picked = rankEvidence([], [item('https://en.wikipedia.org/wiki/Bat'), item('http://en.wikipedia.org/wiki/Bat/'),
      item('https://en.wikipedia.org/wiki/Bat#Eyes'), item('https://www.snopes.com/x')], lists);
    expect(picked.map(e => e.url)).toEqual(['https://en.wikipedia.org/wiki/Bat', 'https://www.snopes.com/x']);
  });

  const paid = [1, 2, 3].map(n => item(`https://paid${n}.example/bats`, 'web'));
  const free = ['politifact.com', 'fullfact.org', 'snopes.com', 'leadstories.com'].map(site => item(`https://${site}/bats`, 'fact_check', { rating: 'misleading' }))
    .concat(['Bat', 'Bat_vision'].map(title => item(`https://en.wikipedia.org/wiki/${title}`, 'wikipedia')));

  it('gives free evidence at most three slots when paid results exist', () => {
    const picked = rankEvidence(free, paid, lists);
    expect(picked).toHaveLength(6);
    expect(picked.filter(e => e.origin === 'web')).toHaveLength(3);
    expect(picked.slice(0, 3).every(e => e.origin === 'fact_check')).toBe(true);
  });

  it('lets free evidence fill the slots paid results leave, and all six when paid is empty', () => {
    const one = rankEvidence(free, paid.slice(0, 1), lists);
    expect(one).toHaveLength(6);
    expect(one.filter(e => e.origin === 'web')).toHaveLength(1);
    const none = rankEvidence(free, [], lists);
    expect(none).toHaveLength(6);
    expect(none.every(e => e.origin !== 'web')).toBe(true);
  });

  it('a blocked paid result does not cost free evidence its slots', () => {
    const picked = rankEvidence(free, [item('https://www.facebook.com/post', 'web')], lists);
    expect(picked).toHaveLength(6);
    expect(picked.every(e => e.origin !== 'web')).toBe(true);
  });

  it('puts newer evidence first within a trust tier for a future claim', () => {
    const old = item('https://old.example/a', 'news', { publishedAt: '2025-01-01' });
    const fresh = item('https://fresh.example/a', 'news', { publishedAt: '2026-11-10T08:00:00Z' });
    const undated = item('https://undated.example/a', 'news');
    const trustedOld = item('https://www.reuters.com/a', 'news', { publishedAt: '2024-05-01' });
    expect(rankEvidence([], [old, undated, fresh, trustedOld], lists, true).map(host)).toEqual(['reuters.com', 'fresh.example', 'old.example', 'undated.example']);
    expect(rankEvidence([], [old, undated, fresh, trustedOld], lists).map(host)).toEqual(['reuters.com', 'old.example', 'undated.example', 'fresh.example']);
  });

  it('keeps one calculation and one weather report', () => {
    const calc = item(CALCULATION_URL, 'calculation');
    expect(rankEvidence([calc, { ...calc, id: 'other' }], [], lists)).toHaveLength(1);
  });
});

describe('S10 traits', () => {
  const frame = (source: string, mode: 'said' | 'reported' = 'reported') => ({ source, mode });

  it('trusts free sources and trusted domains, and names calculation and weather sites', () => {
    expect(sourceTraits(item(CALCULATION_URL, 'calculation'), null, lists)).toEqual({ site: 'calculation', trusted: true });
    expect(sourceTraits(item('https://api.open-meteo.com/v1/forecast?x=1', 'weather'), null, lists)).toEqual({ site: 'open-meteo.com', trusted: true });
    expect(sourceTraits(item('https://en.wikipedia.org/wiki/Moon', 'wikipedia'), null, lists)).toEqual({ site: 'wikipedia.org', trusted: true });
    expect(sourceTraits(item('https://www.reuters.com/x', 'web'), null, lists)).toEqual({ site: 'reuters.com', trusted: true });
    expect(sourceTraits(item('https://blog.example.com/x', 'web'), null, lists)).toEqual({ site: 'example.com', trusted: false });
  });

  it('NASA and nasa.gov: the named source own site is trusted for an attributed claim', () => {
    const own = item('https://science.nasa.gov/moon/shrinking', 'web');
    expect(isOwnSite(own, 'NASA')).toBe(true);
    expect(sourceTraits(item('https://www.politico.com/news/x', 'web'), frame('Politico'), lists).trusted).toBe(true);
    expect(sourceTraits(item('https://www.politico.com/news/x', 'web'), null, lists).trusted).toBe(false);
    expect(isOwnSite(item('https://www.exampletimes.com/a', 'web'), 'Example Times')).toBe(true);
    // Too short to match safely, and a name that is not in the label.
    expect(isOwnSite(item('https://www.bbc.co.uk/a', 'web'), 'BBC')).toBe(false);
    expect(isOwnSite(item('https://www.nytimes.com/a', 'web'), 'Politico')).toBe(false);
    // A label that only contains the name, and pages on shared hosting, are not the source's own site.
    expect(isOwnSite(item('https://www.nasaspaceflight.com/a', 'web'), 'NASA')).toBe(false);
    expect(isOwnSite(item('https://bignasaleaks.com/a', 'web'), 'NASA')).toBe(false);
    expect(isOwnSite(item('https://nasa.github.io/a', 'web'), 'NASA')).toBe(false);
    expect(isOwnSite(item('https://politico.blogspot.com/a', 'web'), 'Politico')).toBe(false);
    expect(isOwnSite(item('https://kushner.substack.com/p/a', 'web'), 'Kushner')).toBe(false);
    expect(sourceTraits(item('https://nasa.github.io/a', 'web'), frame('NASA'), lists).trusted).toBe(false);
  });

  it('attributed news is trusted; unattributed news is not', () => {
    const news = item('https://news.example.org/kushner-talks', 'news');
    expect(sourceTraits(news, frame('Kushner', 'said'), lists).trusted).toBe(true);
    expect(sourceTraits(news, null, lists).trusted).toBe(false);
    expect(sourceTraits(item('https://blog.example.org/kushner', 'web'), frame('Kushner', 'said'), lists).trusted).toBe(false);
  });
});
