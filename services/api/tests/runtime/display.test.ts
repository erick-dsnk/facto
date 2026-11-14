import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { buildServer } from '../../src/transport/server.js';
import type { RuntimeAdapters } from '../../src/runtime/adapters.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import type { DisplayGrant, DisplaySnapshot, EventEnvelope, TextInput } from '../../../../packages/contracts/src/index.js';
import { displayGrantSchema, displaySnapshotSchema } from '../../../../packages/contracts/src/wire.js';

type Server = Awaited<ReturnType<typeof buildServer>>;
const servers: Server[] = []; const sockets: WebSocket[] = [];
const initial = Date.parse('2026-11-14T10:00:00Z');
afterEach(async () => { for (const socket of sockets.splice(0)) socket.terminate(); for (const server of servers.splice(0)) await server.app.close(); });
async function setup(adapters: RuntimeAdapters = fixtureAdapters()) {
  let clock = initial;
  const stopped = vi.fn(async () => {});
  const server = await buildServer({ adapters, mode: 'fixture', joinCode: 'display-test-code', joinExpiresAt: initial + 60_000, now: () => clock,
    asr: { start: async () => ({ write: async () => {}, stop: stopped }) } });
  servers.push(server); await server.app.ready();
  const credentials = (await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode: 'display-test-code' } })).json<{ sessionId: string; token: string; sessionEpoch: number }>();
  const ownerHeaders = { authorization: `Bearer ${credentials.token}` };
  const grant = async () => displayGrantSchema.parse((await server.app.inject({ method: 'POST', url: `/v1/sessions/${credentials.sessionId}/display-grant`, headers: ownerHeaders })).json());
  const observe = async (access: DisplayGrant) => {
    const events: (DisplaySnapshot | EventEnvelope)[] = [];
    const socket = await server.app.injectWS(access.streamPath, { headers: { origin: 'http://localhost:3030', 'sec-websocket-protocol': `actually-display-v1, display.${access.displayToken}` } }, { onInit: socket => socket.on('message', bytes => events.push(JSON.parse(bytes.toString()))) });
    sockets.push(socket); await vi.waitFor(() => expect(events.length).toBeGreaterThan(0)); return { socket, events };
  };
  const body: TextInput = { schemaVersion: 1, requestId: 'display-check', sessionId: credentials.sessionId, sessionEpoch: 1, revision: 1, mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en', capturedAt: new Date(initial).toISOString(), capture: { source: 'typed_fixture', segmentId: 'display-check', confidence: 1 }, context: [], userInitiated: true };
  const submit = async (input = body) => server.app.inject({ method: 'POST', url: `/v1/sessions/${credentials.sessionId}/checks`, headers: ownerHeaders, payload: input });
  return { server, credentials, ownerHeaders, grant, observe, submit, body, stopped, advance: (ms: number) => { clock += ms; } };
}
describe('read-only display observer', () => {
  it('coexists with owner audio without a ready broadcast, replacement, pause or transcript leak', async () => {
    const test = await setup(); const { server, credentials } = test;
    const ownerEvents: EventEnvelope[] = [];
    const owner = await server.app.injectWS(`/v1/sessions/${credentials.sessionId}/stream`, { headers: test.ownerHeaders }, { onInit: socket => socket.on('message', bytes => ownerEvents.push(JSON.parse(bytes.toString()))) }); sockets.push(owner);
    owner.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'recorded_fixture' }));
    await vi.waitFor(() => expect(ownerEvents.some(event => event.type === 'audio.ready')).toBe(true));
    const readyCount = ownerEvents.filter(event => event.type === 'session.ready').length;
    const observer = await test.observe(await test.grant());
    expect(displaySnapshotSchema.safeParse(observer.events[0]).success).toBe(true);
    expect(server.store.sessions.get(credentials.sessionId)!.epoch).toBe(1);
    expect(ownerEvents.filter(event => event.type === 'session.ready')).toHaveLength(readyCount);
    server.store.sessions.get(credentials.sessionId)!.emit('transcript.partial', { text: 'private conversation' });
    await test.submit(); await vi.waitFor(() => expect(observer.events.some(event => event.type === 'claim.result')).toBe(true));
    expect(observer.events.some(event => event.type === 'claim.checking')).toBe(true);
    expect(JSON.stringify(observer.events)).not.toContain('private conversation');
    observer.socket.terminate(); await new Promise<void>(done => setImmediate(done));
    expect(test.stopped).not.toHaveBeenCalled(); expect(server.store.sessions.get(credentials.sessionId)!.active).toBe(true); expect(owner.readyState).toBe(WebSocket.OPEN);
  });
  it('separates token scope, rotates observers only and rejects denied origins', async () => {
    const test = await setup(); const grant = await test.grant(); const observer = await test.observe(grant);
    const denied = await test.server.app.inject({ method: 'POST', url: `/v1/sessions/${grant.sessionId}/checks`, headers: { authorization: `Bearer ${grant.displayToken}` }, payload: test.body }); expect(denied.statusCode).toBe(401);
    await expect(test.server.app.injectWS(grant.streamPath, { headers: test.ownerHeaders })).rejects.toThrow();
    await expect(test.server.app.injectWS(grant.streamPath, { headers: { origin: 'https://evil.example', 'sec-websocket-protocol': `actually-display-v1, display.${grant.displayToken}` } })).rejects.toThrow();
    const closed = once(observer.socket, 'close'); const next = await test.grant(); await closed;
    expect(next.displayToken).not.toBe(grant.displayToken);
    await expect(test.observe(grant)).rejects.toThrow();
    expect(test.server.store.sessions.get(grant.sessionId)!.epoch).toBe(1);
    expect((await test.submit()).statusCode).toBe(202);
  });
  it.each([false, true])('closes forbidden display writes (binary=%s) without mutation', async binary => {
    const test = await setup(); const observer = await test.observe(await test.grant());
    const closed = once(observer.socket, 'close'); observer.socket.send(binary ? Buffer.alloc(32) : JSON.stringify({ type: 'session.pause', sessionEpoch: 1 })); await closed;
    expect(test.server.store.sessions.get(test.credentials.sessionId)!.active).toBe(true); expect(test.server.store.sessions.get(test.credentials.sessionId)!.epoch).toBe(1); expect(test.stopped).not.toHaveBeenCalled();
  });
  it('revokes the display grant idempotently and leaves the session usable', async () => {
    const test = await setup(); const grant = await test.grant(); const observer = await test.observe(grant);
    const closed = once(observer.socket, 'close');
    const response = await test.server.app.inject({ method: 'DELETE', url: `/v1/sessions/${grant.sessionId}/display-grant`, headers: test.ownerHeaders });
    expect(response.statusCode).toBe(204); expect((await closed)[0]).toBe(4003);
    await expect(test.observe(grant)).rejects.toThrow();
    expect((await test.server.app.inject({ method: 'DELETE', url: `/v1/sessions/${grant.sessionId}/display-grant`, headers: test.ownerHeaders })).statusCode).toBe(204);
    expect((await test.submit()).statusCode).toBe(202);
  });
  it('rejects missing and traversal static assets and redirects the mounted UI path', async () => {
    const test = await setup();
    const redirect = await test.server.app.inject('/display'); expect(redirect.statusCode).toBe(302); expect(redirect.headers.location).toBe('/display/');
    for (const path of ['/display/assets/missing.js', '/display/assets/%2e%2e%2fpackage.json', '/display/assets/%2e%2e%5cpackage.json', '/display/assets/server.ts', '/display/assets/package.json', '/display/anything']) {
      const response = await test.server.app.inject(path); expect([400, 404]).toContain(response.statusCode); expect(response.body).not.toContain('actually-glasses');
    }
  });
  it('clears a visible manual check when its result becomes silent without disclosing that result', async () => {
    const base = fixtureAdapters(); let release!: () => void;
    const test = await setup({ ...base, retrieve: async (claim, context) => { await new Promise<void>(resolve => { release = resolve; }); return base.retrieve(claim, context); } });
    const observer = await test.observe(await test.grant()); await test.submit();
    await vi.waitFor(() => expect(observer.events.some(event => event.type === 'claim.checking')).toBe(true));
    test.server.store.sessions.get(test.credentials.sessionId)!.preferences.muted = true; release();
    await vi.waitFor(() => expect(observer.events.some(event => event.type === 'check.cancelled')).toBe(true));
    expect(observer.events.some(event => event.type === 'claim.result')).toBe(false);
    expect(test.server.store.sessions.get(test.credentials.sessionId)!.displayState).toBeNull();
  });
  it('reconnects with current snapshot and clears cancellation and expired results', async () => {
    const test = await setup(); const grant = await test.grant(); await test.submit();
    await vi.waitFor(() => expect(test.server.store.sessions.get(grant.sessionId)!.displayState?.phase).toBe('result'));
    const observer = await test.observe(grant); expect((observer.events[0] as DisplaySnapshot).state?.phase).toBe('result');
    await test.server.app.inject({ method: 'POST', url: `/v1/sessions/${grant.sessionId}/checks/${test.body.requestId}/cancel`, headers: test.ownerHeaders });
    await vi.waitFor(() => expect(observer.events.some(event => event.type === 'check.cancelled')).toBe(true));
    expect((await test.observe(grant)).events[0]).toMatchObject({ state: null });
    await test.submit({ ...test.body, requestId: 'next' });
    await vi.waitFor(() => expect(test.server.store.sessions.get(grant.sessionId)!.displayState?.phase).toBe('result'));
    test.advance(60_001); expect((await test.observe(grant)).events[0]).toMatchObject({ state: null });
    test.advance(240_000); await expect(test.observe(grant)).rejects.toThrow();
  });
  it('keeps the latest manual check on screen when an older concurrent request completes', async () => {
    const base = fixtureAdapters(); const releases = new Map<string, () => void>();
    const test = await setup({ ...base, retrieve: async (claim, context) => { await new Promise<void>(resolve => { releases.set(claim.id, resolve); }); return base.retrieve(claim, context); } });
    const grant = await test.grant(); const observer = await test.observe(grant);
    await test.submit({ ...test.body, requestId: 'first' });
    await vi.waitFor(() => expect(releases.has('first-claim-0')).toBe(true));
    await test.submit({ ...test.body, requestId: 'second' });
    await vi.waitFor(() => expect(releases.has('second-claim-0')).toBe(true));
    releases.get('first-claim-0')!();
    await vi.waitFor(() => expect(test.server.store.sessions.get(grant.sessionId)!.requests.get('first')!.state).toBe('done'));
    expect(test.server.store.sessions.get(grant.sessionId)!.displayState).toMatchObject({ requestId: 'second', phase: 'checking' });
    expect(observer.events.some(event => event.type === 'claim.result' && event.requestId === 'first')).toBe(false);
    expect((await test.observe(grant)).events[0]).toMatchObject({ state: { requestId: 'second', phase: 'checking' } });
    releases.get('second-claim-0')!(); await vi.waitFor(() => expect(observer.events.some(event => event.type === 'claim.result')).toBe(true));
    expect(test.server.store.sessions.get(grant.sessionId)!.displayState).toMatchObject({ requestId: 'second', phase: 'result' });
  });
  it('correlates real retrieval callbacks and suppresses late progress/results after cancellation', async () => {
    const base = fixtureAdapters(); let release!: () => void; let late!: () => void;
    const source = { id: 'tower', hostname: 'tower.org', title: 'Tower', stage: 'found' as const, provider: 'exa' as const };
    const adapters: RuntimeAdapters = { ...base, retrieve: async (claim, context) => {
      context.reportSources?.([source]);
      late = () => context.reportSources?.([{ ...source, stage: 'ready' }]);
      await new Promise<void>(resolve => { release = resolve; });
      late(); return base.retrieve(claim, context);
    } };
    const test = await setup(adapters); const observer = await test.observe(await test.grant()); await test.submit();
    await vi.waitFor(() => expect(observer.events.some(event => event.type === 'claim.sources')).toBe(true));
    const progress = observer.events.find(event => event.type === 'claim.sources') as EventEnvelope;
    expect(progress).toMatchObject({ requestId: test.body.requestId, claimId: 'display-check-claim-0', revision: 1, sessionEpoch: 1, payload: { sources: [source] } });
    expect(observer.events.findIndex(event => event.type === 'claim.checking')).toBeLessThan(observer.events.findIndex(event => event.type === 'claim.sources'));
    await test.server.app.inject({ method: 'POST', url: `/v1/sessions/${test.credentials.sessionId}/checks/${test.body.requestId}/cancel`, headers: test.ownerHeaders });
    await vi.waitFor(() => expect(observer.events.some(event => event.type === 'check.cancelled')).toBe(true));
    const count = observer.events.length; late(); release(); await new Promise<void>(done => setImmediate(done));
    expect(observer.events).toHaveLength(count); expect(test.server.store.sessions.get(test.credentials.sessionId)!.displayState).toBeNull();
  });
  it('does not expose automatic silent checks or results and selects only the display subprotocol', async () => {
    const test = await setup(); const grant = await test.grant(); const address = await test.server.app.listen({ host: '127.0.0.1', port: 0 });
    const events: unknown[] = []; const socket = new WebSocket(`${address.replace('http:', 'ws:')}${grant.streamPath}`, ['actually-display-v1', `display.${grant.displayToken}`], { origin: 'http://localhost:3030' }); sockets.push(socket); socket.on('message', bytes => events.push(JSON.parse(bytes.toString()))); await once(socket, 'open');
    expect(socket.protocol).toBe('actually-display-v1'); await test.submit({ ...test.body, userInitiated: false });
    await vi.waitFor(() => expect(test.server.store.sessions.get(grant.sessionId)!.requests.get(test.body.requestId)?.state).toBe('done'));
    expect(events).toHaveLength(1); expect(JSON.stringify(events)).not.toContain(grant.displayToken); expect(JSON.stringify(events)).not.toContain(test.credentials.token);
  });
});
