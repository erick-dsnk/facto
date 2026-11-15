import { afterEach, expect, it, vi } from 'vitest';
import { buildServer } from '../../src/transport/server.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { createVisionTargetSelector, type TargetSelector } from '../../src/input/ocr/target-selection.js';
import { DebugFeed } from '../../src/runtime/debug-feed.js';

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.app.close())); });
const payload = { imageBase64: Buffer.from([255, 216, 255, 217]).toString('base64'), lines: [{ id: 'L1', text: 'A news claim about flights', confidence: 0.9, polygon: [[0.1, 0.1], [0.8, 0.1], [0.8, 0.2], [0.1, 0.2]] }] };
async function setup(targetSelector?: TargetSelector) {
  const debugFeed = new DebugFeed();
  const server = await buildServer({ adapters: fixtureAdapters(), mode: 'fixture', joinCode: 'ocr-test-join', joinExpiresAt: Date.now() + 60_000, targetSelector, debugFeed, debugFeedKey: 'ocr-test-debug-secret' });
  servers.push(server);
  const joined = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode: 'ocr-test-join' } });
  const session = joined.json<{ sessionId: string; token: string }>();
  return { ...server, session, url: `/v1/sessions/${session.sessionId}/ocr/select-target`, headers: { authorization: `Bearer ${session.token}` }, debugFeed };
}
it('authenticates the upload before calling any selector and explicitly reports unconfigured', async () => {
  const server = await setup();
  expect((await server.app.inject({ method: 'POST', url: server.url, payload })).statusCode).toBe(401);
  expect((await server.app.inject({ method: 'POST', url: server.url, headers: { authorization: 'Bearer wrong' }, payload })).statusCode).toBe(401);
  const result = await server.app.inject({ method: 'POST', url: server.url, headers: server.headers, payload });
  expect(result.json()).toMatchObject({ status: 'unavailable', reason: 'selection_not_configured', text: '' });
});
it('runs authenticated production adapter without storing image/OCR in debug feed', async () => {
  const provider = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ role: 'headline', quote: payload.lines[0].text, incomplete: false }] }) } }] })));
  const server = await setup(createVisionTargetSelector({ baseURL: 'http://localhost/v1', model: 'test', fetch: provider }));
  const result = await server.app.inject({ method: 'POST', url: server.url, headers: server.headers, payload });
  expect(result.statusCode).toBe(200); expect(result.json().text).toBe(payload.lines[0].text);
  expect(JSON.stringify(server.debugFeed.after(0))).not.toContain(payload.lines[0].text);
  expect(JSON.stringify(server.debugFeed.after(0))).not.toContain(payload.imageBase64);
});
it('rejects malformed inputs before provider and limits concurrent requests per session', async () => {
  let finish!: (value: Awaited<ReturnType<TargetSelector>>) => void;
  const selector = vi.fn<TargetSelector>().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const server = await setup(selector);
  expect((await server.app.inject({ method: 'POST', url: server.url, headers: server.headers, payload: { ...payload, lines: [payload.lines[0], payload.lines[0]] } })).statusCode).toBe(400);
  expect(selector).not.toHaveBeenCalled();
  const first = server.app.inject({ method: 'POST', url: server.url, headers: server.headers, payload });
  // inject is lazy; invoking then starts the request.
  const completed = first.then(result => result);
  await vi.waitFor(() => expect(selector).toHaveBeenCalledOnce());
  expect((await server.app.inject({ method: 'POST', url: server.url, headers: server.headers, payload })).statusCode).toBe(429);
  finish({ status: 'unavailable', selectedLineIds: [], contextLineIds: [], candidates: [], text: '', reason: 'test' });
  expect((await completed).statusCode).toBe(200);
});
