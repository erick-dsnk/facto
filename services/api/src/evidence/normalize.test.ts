import { describe, expect, it } from 'vitest';
import { codePoints } from '../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../packages/contracts/src/wire.js';
import { buildAlternateQuery, mergeRetainedEvidence, needsPageText, normalizeEvidence, normalizeUrl, parseExaResponse, selectExcerpt } from './normalize.js';

const now = '2026-11-14T10:00:00.000Z';
const quote = 'The Eiffel Tower officially opened in 1889. This historical statement is retained exactly as the provider returned it.';

describe('evidence normalization', () => {
  it('normalizes tracking and fragments without losing substantive query parameters', () => {
    expect(normalizeUrl('https://Example.COM/fact?year=1889&utm_source=ad#section')).toBe('https://example.com/fact?year=1889');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('https://user:secret@example.com/fact')).toBeNull();
    expect(normalizeUrl('http://localhost/internal')).toBeNull();
  });

  it('uses public suffix grouping, caps domains and total records, deduplicates URLs', () => {
    const pages = Array.from({ length: 9 }, (_, i) => ({ url: `https://${i < 4 ? `${i}.news.co.uk` : `news${i}.co.uk`}/fact`, highlights: [quote] }));
    pages.push({ url: 'https://0.news.co.uk/fact?utm_source=x', highlights: [quote] });
    const result = normalizeEvidence(pages, 'The Eiffel Tower opened in 1889.', now);
    expect(result).toHaveLength(6);
    expect(result.filter(item => item.sourceGroup === 'news.co.uk')).toHaveLength(2);
    expect(new Set(result.map(item => item.url)).size).toBe(6);
  });

  it('keeps independently operated private-suffix hosts separate', () => {
    const result = normalizeEvidence(['alice.github.io', 'bob.github.io'].map(host => ({ url: `https://${host}/post`, highlights: [quote] })), 'Eiffel Tower', now);
    expect(result.map(item => item.sourceGroup)).toEqual(['alice.github.io', 'bob.github.io']);
  });

  it('groups copied/syndicated passages across domains', () => {
    const result = normalizeEvidence([
      { url: 'https://a.com/fact', highlights: [quote] },
      { url: 'https://b.com/fact', highlights: [`Publisher introduction. ${quote}`] },
      { url: 'https://c.com/fact', highlights: ['A separate investigation into the architecture and engineering of the tower describes the construction process.'] },
    ], 'Eiffel Tower', now);
    const first = result.find(item => item.url.startsWith('https://a.com'))!;
    const second = result.find(item => item.url.startsWith('https://b.com'))!;
    expect(first.echoGroup).toBeTruthy();
    expect(first.echoGroup).toBe(second.echoGroup);
    expect(result.find(item => item.url.startsWith('https://c.com'))!.echoGroup).toBeNull();
  });

  it('preserves exact passages, unknown dates, provenance and unjudged source status', () => {
    const result = normalizeEvidence([{ url: 'https://museum.example.org/history', title: 'History', highlights: [quote], publishedDate: 'unknown' }], 'Eiffel Tower', now)[0];
    expect(result).toMatchObject({ excerpt: quote, publishedAt: null, publisher: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null, contentBasis: 'highlight', retrievedAt: now });
  });

  it('preserves publication date precision and rejects ambiguous dates at the wire boundary', () => {
    for (const publishedDate of ['2020-01-01', '2020-01-01T10:00:00+02:00']) {
      const result = normalizeEvidence([{ url: 'https://museum.org/history', highlights: [quote], publishedDate }], 'Eiffel Tower', now)[0];
      expect(result.publishedAt).toBe(publishedDate);
      expect(evidenceSchema.safeParse(result).success).toBe(true);
    }
    for (const publishedDate of ['01/02/2020', '2020-01-01T10:00:00', '2020-02-30', '123']) {
      expect(normalizeEvidence([{ url: 'https://museum.org/history', highlights: [quote], publishedDate }], 'Eiffel Tower', now)[0].publishedAt).toBeNull();
    }
  });

  it('selects a relevant bounded exact Unicode window, not an arbitrary page prefix', () => {
    const text = `${'🦉 unrelated '.repeat(300)}${quote}${' remaining text'.repeat(200)}`;
    const selected = selectExcerpt({ url: 'https://museum.org/fact', text }, 'The Eiffel Tower opened in 1889.')!;
    expect(selected.contentBasis).toBe('page_text');
    expect(codePoints(selected.excerpt).length).toBeLessThanOrEqual(2000);
    expect(text.includes(selected.excerpt)).toBe(true);
    expect(selected.excerpt).toContain('Eiffel Tower');
  });

  it('keeps a relevant highlight when bounded fetched text omits its passage', () => {
    const selected = selectExcerpt({
      url: 'https://museum.org/history', highlights: [quote],
      text: 'Museum navigation. Exhibitions, tickets, accessibility and visitor information.',
    }, 'The Eiffel Tower opened in 1889.');
    expect(selected).toEqual({ excerpt: quote, contentBasis: 'highlight' });
  });

  it('prefers matching fetched page context over an equally relevant highlight', () => {
    const text = `${quote} However, that is the date of the ceremony; public access began later.`;
    expect(selectExcerpt({ url: 'https://museum.org/history', highlights: [quote], text }, 'The Eiffel Tower opened in 1889.'))
      .toEqual({ excerpt: text, contentBasis: 'page_text' });
  });

  it('keeps fetched subject context that refutes the highlight using different words and dates', () => {
    const text = 'The Eiffel Tower began welcoming the public several years later; the early ceremony date is often confused with public access.';
    expect(selectExcerpt({ url: 'https://museum.org/history', highlights: [quote], text }, 'The Eiffel Tower opened in 1889.'))
      .toEqual({ excerpt: text, contentBasis: 'page_text' });
  });

  it('prefers a later contiguous passage carrying a claim negation over an earlier matching positive statement', () => {
    const checked = 'The Eiffel Tower did not open in 1889.';
    const before = 'The Eiffel Tower opened in 1889. ';
    const after = 'Historical records confirm the Eiffel Tower did not open in 1889; the date refers to a different event.';
    const text = `${'Unrelated garden and soil history. '.repeat(80)}${before}${'Other unrelated archive details. '.repeat(90)}${after}`;
    const selected = selectExcerpt({ url: 'https://museum.org/history', text }, checked)!;
    expect(text.includes(selected.excerpt)).toBe(true);
    expect(selected.excerpt).toContain('did not open in 1889');
  });

  it('selectively fetches promising pages when long highlights omit claim-critical details', () => {
    const long = 'A detailed account describes the Eiffel Tower opening and the visitors who attended the public ceremony.';
    expect(needsPageText({ url: 'https://a.org/page', highlights: [long] }, 'The Eiffel Tower opened in 1889.')).toBe(true);
    expect(needsPageText({ url: 'https://a.org/page', highlights: [long] }, 'The Eiffel Tower did not open in 1889.')).toBe(true);
    expect(needsPageText({ url: 'https://a.org/page', highlights: [long] }, 'According to researchers, the Eiffel Tower opened in 1889.')).toBe(true);
    expect(needsPageText({ url: 'https://a.org/page', highlights: [long] }, 'The Eiffel Tower was the only tower opened in 1889.')).toBe(true);
    expect(needsPageText({ url: 'https://a.org/page', highlights: ['A detailed report covers gardening, soil, local parks, seasonal planting and greenhouse conditions.'] }, 'The Eiffel Tower opened in 1889.')).toBe(false);
  });

  it('keeps subject relevance ahead of qualifiers and does not borrow details from an unrelated highlight', () => {
    const checked = 'The Eiffel Tower did not open in 1889.';
    const relevant = 'The Eiffel Tower opened during a ceremony in Paris, and historical archives describe its original visitors and construction.';
    const unrelated = 'A separate account of gardens notes that roses did not bloom in 1889 and discusses local planting for several seasons.';
    const page = { url: 'https://museum.org/history', highlights: [relevant, unrelated] };
    expect(needsPageText(page, checked)).toBe(true);
    expect(selectExcerpt(page, checked)?.excerpt).toBe(relevant);

    const longRelevant = `${relevant} ${' x'.repeat(1400)} In 1889 gardeners did not plant roses in this orchard.`;
    const selected = selectExcerpt({ url: page.url, text: longRelevant }, checked)!;
    expect(selected.excerpt).toContain('The Eiffel Tower');
  });

  it('merges later evidence with relevance ranking, URL/id deduplication, source caps and echo regrouping', () => {
    const checked = 'The Eiffel Tower opened in 1889.';
    const irrelevant = normalizeEvidence([{ url: 'https://unrelated.example.org/story', highlights: ['A long description of local gardens, soil and greenhouse planting during spring.'] }], checked, now);
    const existing = normalizeEvidence([{ url: 'https://a.example.com/fact', highlights: [quote] }], checked, now);
    const incoming = normalizeEvidence([
      { url: 'https://a.example.com/fact?utm_source=copy', highlights: [quote] },
      { url: 'https://b.example.net/fact', highlights: [`Publisher introduction. ${quote}`] },
      ...Array.from({ length: 7 }, (_, index) => ({ url: `https://source${index}.org/fact`, highlights: [quote] })),
    ], checked, now);
    const result = mergeRetainedEvidence([...irrelevant, ...existing], incoming, checked);
    expect(result).toHaveLength(6);
    expect(result[0].excerpt).toContain('Eiffel Tower');
    expect(result.some(item => item.url.includes('unrelated'))).toBe(false);
    expect(new Set(result.map(item => normalizeUrl(item.url))).size).toBe(result.length);
    expect(result.every(item => result.filter(other => other.sourceGroup === item.sourceGroup).length <= 2)).toBe(true);
    expect(result.filter(item => item.echoGroup === result.find(other => other.url.includes('b.example.net'))?.echoGroup).length).toBeGreaterThan(1);
    expect(result.every(item => item.id && normalizeUrl(item.url))).toBe(true);
  });

  it('ranks old and incoming evidence by unjudged text quality and prefers fuller page text for the same URL', () => {
    const checked = 'The Eiffel Tower opened in 1889.';
    const old = normalizeEvidence([{ url: 'https://museum.org/history', highlights: [quote] }], checked, now)[0];
    const previouslyJudged = { ...old, directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports' as const };
    const expandedText = `${quote} Primary records describe the exact opening date, ceremony, location and public archive reference in further detail.`;
    const incoming = normalizeEvidence([{ url: old.url, text: expandedText }], checked, now);
    const merged = mergeRetainedEvidence([previouslyJudged], incoming, checked);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(old.id);
    expect(merged[0].contentBasis).toBe('page_text');
    expect(merged[0].excerpt).toBe(expandedText);
    expect(merged[0].directlyAddressesClaim).toBe(false);
  });

  it('keeps alternate-query claim and neutral retrieval objective separate', () => {
    const checked = 'According to the 2024 report, the bridge did not open before May.';
    const query = buildAlternateQuery(checked, 'balanced_evidence');
    expect(query).toContain(JSON.stringify(checked));
    expect(query).toContain('Retrieval objective:');
    expect(query).toContain('supports, challenges, or qualifies');
    expect(query).not.toContain('private salary');
  });

  it('bare URLs and synthesized answers cannot become evidence', () => {
    expect(normalizeEvidence([{ url: 'https://example.org/', title: 'Unsubstantiated' }], 'Eiffel Tower', now)).toEqual([]);
    expect(parseExaResponse({ results: [], answer: 'This claim is definitely true.' })).toEqual([]);
    expect(() => parseExaResponse({ answer: 'True' })).toThrow('malformed_exa_response');
    expect(() => parseExaResponse({ results: [], statuses: [{ status: 'error', id: 'url' }] })).toThrow('exa_content_failed');
  });
});
