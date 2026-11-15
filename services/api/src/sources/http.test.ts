import { describe, expect, it } from 'vitest';
import { getJson } from './http.js';
import { publicationDate } from './evidence.js';
import { jsonResponse, recordingFetch } from './testing.js';

const options = (signal = new AbortController().signal) => ({ service: 'demo', signal, maxBytes: 64 });

describe('getJson', () => {
  it('parses a bounded body and passes non-2xx statuses back without reading them', async () => {
    expect(await getJson(recordingFetch(() => jsonResponse({ ok: true })).fetch, 'https://a.example/x', options())).toEqual({ status: 200, retryAfter: null, body: { ok: true } });
    expect(await getJson(recordingFetch(() => jsonResponse('secret', 429, { 'retry-after': '3' })).fetch, 'https://a.example/x', options()))
      .toEqual({ status: 429, retryAfter: '3', body: undefined });
  });

  it('an oversize or unreadable body is malformed; a network failure is unavailable and retryable', async () => {
    await expect(getJson(recordingFetch(() => jsonResponse({ text: 'x'.repeat(100) })).fetch, 'https://a.example/x', options())).rejects.toMatchObject({ code: 'malformed_demo_response' });
    await expect(getJson(recordingFetch(() => new Response('not json')).fetch, 'https://a.example/x', options())).rejects.toMatchObject({ code: 'malformed_demo_response' });
    await expect(getJson(recordingFetch(() => { throw new TypeError('offline'); }).fetch, 'https://a.example/x', options())).rejects.toMatchObject({ code: 'demo_unavailable', retryable: true });
  });

  it('cancellation wins over a provider failure', async () => {
    const controller = new AbortController();
    const pending = getJson(recordingFetch(() => new Promise<Response>(() => undefined)).fetch, 'https://a.example/x', options(controller.signal));
    controller.abort(new Error('cancelled by test'));
    await expect(pending).rejects.toThrow('cancelled by test');
  });
});

describe('publicationDate', () => {
  it('keeps provider precision and drops anything unclear', () => {
    expect(publicationDate('2024-03-05')).toBe('2024-03-05');
    expect(publicationDate('2024-03-05T10:00:00Z')).toBe('2024-03-05T10:00:00Z');
    expect(publicationDate('2024-03-05T10:00:00.123+02:00')).toBe('2024-03-05T10:00:00.123+02:00');
    for (const value of ['3 days ago', '2024-13-45', '2023-02-29', 'Mar 5, 2024', null, 7]) expect(publicationDate(value), String(value)).toBeNull();
  });
});
