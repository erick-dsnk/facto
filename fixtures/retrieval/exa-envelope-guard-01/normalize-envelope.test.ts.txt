import { describe, expect, it } from 'vitest';
import { parseExaContentsResponse, parseExaResponse } from './normalize.js';

const url = 'https://archive.example.org/register';
const page = { url, title: 'Register', text: 'The Aster bridge opened in 1890.' };
const failures = [{ error: 'upstream unavailable' }, { tag: 'SERVICE_OVERLOADED' },
  { status: 'error' }, { status: 'success', error: { message: 'failed' } }, { status: 'pending' }];
const parsers = [
  ['search', (body: unknown) => parseExaResponse(body)],
  ['contents', (body: unknown) => parseExaContentsResponse(body, [url]).pages],
] as const;

describe('Exa operational envelope validation before metadata stripping', () => {
  for (const [name, parse] of parsers) {
    it.each(failures)(`${name} rejects failed root metadata accompanying plausible text: %j`, metadata => {
      expect(() => parse({ results: [page], ...metadata })).toThrow('exa_content_failed');
    });
    it.each(failures)(`${name} rejects failed result metadata accompanying plausible text: %j`, metadata => {
      expect(() => parse({ results: [{ ...page, ...metadata }] })).toThrow('exa_content_failed');
    });
    it.each([null, 200, {}, true])(`${name} rejects a nonstring root or result status: %j`, status => {
      expect(() => parse({ status, results: [page] })).toThrow('malformed_exa_response');
      expect(() => parse({ results: [{ ...page, status }] })).toThrow('malformed_exa_response');
    });
    it(`${name} retains successful unknown extensions while returning only the existing page shape`, () => {
      for (const status of [undefined, 'success']) expect(parse({ status, error: null, tag: null,
        requestId: 'extension', future: { enabled: true }, results: [{ ...page, status, error: null, tag: null,
          future: { arbitrary: 'metadata' } }] })).toEqual([page]);
    });
  }
  it('search rejects contradictory success statuses and non-success status entries', () => {
    for (const metadata of [{ status: 'success', error: { tag: 'CRAWL_TIMEOUT' } },
      { status: 'success', tag: 'SERVICE_OVERLOADED' }, { status: 'pending' }]) {
      expect(() => parseExaResponse({ results: [page], statuses: [{ id: url, ...metadata }] })).toThrow('exa_content_failed');
    }
  });
  it('contents excludes an explicitly failed target before validating its unusable result metadata', () => {
    expect(parseExaContentsResponse({ status: 'success', results: [{ ...page, status: 'error', error: { tag: 'CRAWL_HTTP_403' } }],
      statuses: [{ id: url, status: 'error', error: { tag: 'CRAWL_HTTP_403', httpStatusCode: 403 } }] }, [url]))
      .toEqual({ pages: [], pageFailures: [{ url, tag: 'CRAWL_HTTP_403', targetHttpStatus: 403 }] });
  });
  it('known per-target contents failure cannot erase a failed root or separately eligible failed result', () => {
    const other = 'https://other.example.org/register';
    const base = { results: [{ ...page, status: 'error' }, { ...page, url: other, status: 'error' }],
      statuses: [{ id: url, status: 'error', error: { tag: 'CRAWL_NOT_FOUND', httpStatusCode: 404 } }] };
    expect(() => parseExaContentsResponse(base, [url, other])).toThrow('exa_content_failed');
    expect(() => parseExaContentsResponse({ ...base, results: [page], error: 'service failed' }, [url])).toThrow('exa_content_failed');
  });
});
