import { describe, expect, it } from 'vitest';
import { codePoints } from '../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../packages/contracts/src/wire.js';
import { normalizeEvidence, normalizeUrl, parseExaResponse, selectExcerpt } from './normalize.js';

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

  it('bare URLs and synthesized answers cannot become evidence', () => {
    expect(normalizeEvidence([{ url: 'https://example.org/', title: 'Unsubstantiated' }], 'Eiffel Tower', now)).toEqual([]);
    expect(parseExaResponse({ results: [], answer: 'This claim is definitely true.' })).toEqual([]);
    expect(() => parseExaResponse({ answer: 'True' })).toThrow('malformed_exa_response');
    expect(() => parseExaResponse({ results: [], statuses: [{ status: 'error', id: 'url' }] })).toThrow('exa_content_failed');
  });
});
