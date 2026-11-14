import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { buildServer, type ServerOptions } from '../../src/transport/server.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { type EventEnvelope, type PipelineAdapters, type TextInput } from '../../../../packages/contracts/src/index.js';
import { claimResultSchema, eventEnvelopeSchema } from '../../../../packages/contracts/src/wire.js';
import { type AsrAdapter, type AsrTranscript } from '../../src/transport/audio.js';

type Server = Awaited<ReturnType<typeof buildServer>>;
type Credentials = { sessionId: string; token: string; sessionEpoch: number; expiresAt: string };
const joinCode = 'test-only-join-code';
const initialTime = Date.parse('2026-11-14T10:00:00Z');
const servers: Server[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const server of servers.splice(0)) await server.app.close();
});
async function setup(overrides: Partial<ServerOptions> = {}) {
  let clock = initialTime;
  const server = await buildServer({ adapters: fixtureAdapters(), mode: 'fixture', joinCode, joinExpiresAt: initialTime + 60_000, now: () => clock, ...overrides });
  servers.push(server); await server.app.ready();
  return { ...server, advance: (ms: number) => { clock += ms; } };
}
async function join(server: Server): Promise<Credentials> {
  const response = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode } });
  expect(response.statusCode).toBe(201);
  return response.json<Credentials>();
}
function input(session: Credentials, overrides: Partial<TextInput> = {}): TextInput {
  return { schemaVersion: 1, requestId: 'req-fixture', sessionId: session.sessionId, sessionEpoch: session.sessionEpoch, revision: 1,
    mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en', capturedAt: new Date(initialTime).toISOString(),
    capture: { source: 'typed_fixture', segmentId: 'segment-fixture', confidence: 1, final: true }, context: [], userInitiated: true, ...overrides };
}
const auth = (session: Credentials) => ({ authorization: `Bearer ${session.token}` });
const submit = (server: Server, session: Credentials, body = input(session)) => server.app.inject({ method: 'POST', url: `/v1/sessions/${session.sessionId}/checks`, headers: auth(session), payload: body });
async function stream(server: Server, session: Credentials) {
  const events: EventEnvelope[] = [];
  const socket = await server.app.injectWS(`/v1/sessions/${session.sessionId}/stream`, { headers: auth(session) }, {
    onInit: socket => { socket.on('message', bytes => events.push(JSON.parse(bytes.toString()) as EventEnvelope)); }
  });
  sockets.push(socket); return { socket, events };
}
async function eventOf(events: EventEnvelope[], type: EventEnvelope['type']) {
  await vi.waitFor(() => expect(events.some(event => event.type === type)).toBe(true), { timeout: 1500, interval: 10 });
  return events.find(event => event.type === type)!;
}

describe('session HTTP and WebSocket boundary', () => {
  it('serves the fixture console and safe readiness without credentials', async () => {
    const server = await setup();
    const health = await server.app.inject('/health');
    expect(health.statusCode).toBe(200); expect(health.json().mode).toBe('fixture');
    expect(health.body).not.toContain(joinCode); expect(health.body).not.toContain('API_KEY');
    const page = await server.app.inject('/');
    expect(page.statusCode).toBe(200); expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('Actually pipeline console');
  });

  it('rejects wrong/expired join codes and bounds attempts per address', async () => {
    const server = await setup();
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode: 'incorrect-code' } });
      expect(response.statusCode).toBe(401);
    }
    const limited = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode } });
    expect(limited.statusCode).toBe(429); expect(limited.json().error).toBe('join_rate_limit');
    server.advance(60_001);
    const expired = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode } });
    expect(expired.statusCode).toBe(401);
    expect(server.store.sessions.size).toBe(0);
  });

  it('isolates tokens across sessions and validates browser Origin on HTTP and WS', async () => {
    const server = await setup(); const a = await join(server); const b = await join(server);
    const url = `/v1/sessions/${a.sessionId}/checks`;
    expect((await server.app.inject({ method: 'POST', url, payload: input(a) })).statusCode).toBe(401);
    expect((await server.app.inject({ method: 'POST', url, headers: auth(b), payload: input(a) })).statusCode).toBe(401);
    expect((await server.app.inject({ method: 'POST', url, headers: { ...auth(a), origin: 'https://attacker.example' }, payload: input(a) })).statusCode).toBe(403);
    await expect(server.app.injectWS(`/v1/sessions/${a.sessionId}/stream`, { headers: auth(b) })).rejects.toThrow('401');
    await expect(server.app.injectWS(`/v1/sessions/${a.sessionId}/stream`, { headers: { ...auth(a), origin: 'https://attacker.example' } })).rejects.toThrow('403');
    expect((await submit(server, a, input(b))).statusCode).toBe(409);
  });

  it('rejects Unicode oversize, stale epochs and conflicting idempotency while exact retries do no extra work', async () => {
    const adapters = fixtureAdapters(); const classify = vi.fn(adapters.classify);
    const server = await setup({ adapters: { ...adapters, classify } }); const session = await join(server);
    const body = input(session);
    expect((await submit(server, session, { ...body, text: '🙂'.repeat(801) })).statusCode).toBe(400);
    expect((await submit(server, session, { ...body, context: ['🙂'.repeat(601), 'b'.repeat(600)] })).statusCode).toBe(400);
    expect((await submit(server, session, { ...body, sessionEpoch: 2 })).statusCode).toBe(409);
    expect((await submit(server, session, body)).statusCode).toBe(202);
    const duplicate = await submit(server, session, body);
    expect(duplicate.statusCode).toBe(202); expect(duplicate.json().duplicate).toBe(true);
    const conflict = await submit(server, session, { ...body, text: 'Lightning never strikes the same place twice.' });
    expect(conflict.statusCode).toBe(409); expect(conflict.json().error).toBe('idempotency_conflict');
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it('streams ordered progress and a valid cited result for native bearer authentication', async () => {
    const server = await setup(); const session = await join(server); const { events } = await stream(server, session);
    await eventOf(events, 'session.ready'); expect((await submit(server, session)).statusCode).toBe(202);
    const resultEvent = await eventOf(events, 'claim.result');
    expect(events.map(event => event.type)).toEqual(['session.ready', 'claim.detected', 'claim.checking', 'claim.result']);
    expect(events.every(event => eventEnvelopeSchema.safeParse(event).success)).toBe(true);
    expect(events.map(event => event.eventSeq)).toEqual([1, 2, 3, 4]);
    const result = claimResultSchema.parse(resultEvent.payload);
    expect(result.verdict).toBe('supported'); expect(result.presentation.action).toBe('respond');
    expect(result.selectedEvidenceIds.length).toBeGreaterThan(0);
    expect(resultEvent.sessionId).toBe(session.sessionId); expect(resultEvent.claimId).toBeDefined();
  });

  it('keeps manual insufficient evidence responsive and automatic supported results silent', async () => {
    const server = await setup(); const session = await join(server); const { events } = await stream(server, session);
    await submit(server, session, input(session, { text: 'There is not enough fixture evidence.' }));
    const result = claimResultSchema.parse((await eventOf(events, 'claim.result')).payload);
    expect(result.verdict).toBe('insufficient_evidence'); expect(result.presentation.action).toBe('respond');
    await submit(server, session, input(session, { requestId: 'req-automatic', userInitiated: false }));
    await vi.waitFor(() => expect(events.filter(event => event.type === 'claim.result')).toHaveLength(2));
    const automatic = claimResultSchema.parse(events.filter(event => event.type === 'claim.result')[1].payload);
    expect(automatic.verdict).toBe('supported'); expect(automatic.presentation.action).toBe('silent');
  });

  it('cancels idempotently and suppresses provider completion after cancellation', async () => {
    const fixture = fixtureAdapters(); let resolve!: (value: Awaited<ReturnType<PipelineAdapters['classify']>>) => void;
    const waiting = new Promise<Awaited<ReturnType<PipelineAdapters['classify']>>>(done => { resolve = done; });
    const server = await setup({ adapters: { ...fixture, classify: () => waiting } });
    const session = await join(server); const { events } = await stream(server, session);
    const body = input(session); await submit(server, session, body);
    for (let n = 0; n < 2; n++) expect((await server.app.inject({ method: 'POST', url: `/v1/sessions/${session.sessionId}/checks/${body.requestId}/cancel`, headers: auth(session) })).statusCode).toBe(204);
    await eventOf(events, 'check.cancelled');
    resolve(await fixture.classify(body, { signal: new AbortController().signal, consume: () => {}, now: () => initialTime }));
    await new Promise<void>(done => setImmediate(done));
    expect(events.filter(event => event.type === 'check.cancelled')).toHaveLength(1);
    expect(events.some(event => event.type === 'claim.result')).toBe(false);
    expect(server.store.sessions.get(session.sessionId)!.requests.get(body.requestId)!.results.size).toBe(0);
  });

  it('deletes app-owned data and invalidates session tokens, including on expiry', async () => {
    const server = await setup(); const session = await join(server);
    await submit(server, session);
    expect((await server.app.inject({ method: 'DELETE', url: `/v1/sessions/${session.sessionId}`, headers: auth(session) })).statusCode).toBe(204);
    expect(server.store.sessions.has(session.sessionId)).toBe(false);
    expect((await submit(server, session)).statusCode).toBe(401);
    const expiring = await join(server); server.advance(300_001);
    expect((await submit(server, expiring)).statusCode).toBe(401);
    expect(server.store.sessions.has(expiring.sessionId)).toBe(false);
  });

  it('disconnect advances the epoch, clears results and requires an explicit resume', async () => {
    const server = await setup(); const session = await join(server); const { socket, events } = await stream(server, session);
    await submit(server, session); await eventOf(events, 'claim.result');
    socket.terminate();
    const state = server.store.sessions.get(session.sessionId)!;
    await vi.waitFor(() => expect(state.active).toBe(false));
    expect(state.epoch).toBe(2); expect(state.cache.size).toBe(0);
    expect((await submit(server, session)).statusCode).toBe(409);
    const reconnected = await stream(server, session); const ready = await eventOf(reconnected.events, 'session.ready');
    expect(ready.sessionEpoch).toBe(2); expect(ready.payload).toMatchObject({ active: false });
    reconnected.socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: 2 }));
    await vi.waitFor(() => expect(state.active).toBe(true));
    expect((await submit(server, session, input(session, { requestId: 'after-resume', sessionEpoch: 2 }))).statusCode).toBe(202);
  });

  it('reports unsupported ASR distinctly without acknowledging audio capture', async () => {
    const server = await setup(); const session = await join(server); const { socket, events } = await stream(server, session);
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    expect((await eventOf(events, 'pipeline.error')).payload).toMatchObject({ reasonCode: 'asr_unavailable' });
    expect(events.some(event => event.type === 'audio.ready')).toBe(false);
  });

  it('deleting an already paused session closes its stream and invalidates access', async () => {
    const server = await setup(); const session = await join(server); const { socket, events } = await stream(server, session);
    socket.send(JSON.stringify({ type: 'session.pause', sessionEpoch: 1 }));
    await eventOf(events, 'session.ended');
    expect(server.store.sessions.get(session.sessionId)!.active).toBe(false);
    const closed = once(socket, 'close');
    const response = await server.app.inject({ method: 'DELETE', url: `/v1/sessions/${session.sessionId}`, headers: auth(session) });
    expect(response.statusCode).toBe(204); await closed;
    expect(socket.readyState).toBe(WebSocket.CLOSED);
    expect(server.store.sessions.has(session.sessionId)).toBe(false);
    expect((await submit(server, session)).statusCode).toBe(401);
  });

  it('accepts the browser console subprotocol bearer over a real WebSocket upgrade', async () => {
    const server = await setup(); const session = await join(server);
    const address = await server.app.listen({ host: '127.0.0.1', port: 0 });
    const events: EventEnvelope[] = [];
    const socket = new WebSocket(`${address.replace('http:', 'ws:')}/v1/sessions/${session.sessionId}/stream`, ['actually-v1', `bearer.${session.token}`], { origin: 'http://localhost:3000' });
    sockets.push(socket); socket.on('message', bytes => events.push(JSON.parse(bytes.toString()) as EventEnvelope));
    await once(socket, 'open'); expect(socket.protocol).toBe('actually-v1');
    await eventOf(events, 'session.ready'); await submit(server, session); await eventOf(events, 'claim.result');
    expect(JSON.stringify(events)).not.toContain(session.token);
  });

  it('connects an injected ASR frame to a final text check and suppresses late transcripts after stop', async () => {
    let publish!: (event: AsrTranscript) => void;
    let abort!: AbortSignal;
    const transcript: AsrTranscript = { text: 'Helsinki is the capital of Finland.', final: true, segmentId: 'vendor/segment:1', confidence: 0.95, captureOffsetMs: 100 };
    const stopped = vi.fn(async () => {});
    const write = vi.fn(async () => { publish(transcript); });
    const asr: AsrAdapter = { start: async (_config, onTranscript, signal) => { publish = onTranscript; abort = signal; return { write, stop: stopped }; } };
    const server = await setup({ asr }); const session = await join(server); const { socket, events } = await stream(server, session);
    expect((await server.app.inject('/health')).json().providers.asr).toBe('configured_unverified');
    expect((await eventOf(events, 'session.ready')).payload).toMatchObject({ audio: true });
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'recorded_fixture' }));
    await eventOf(events, 'audio.ready');
    const bytes = Buffer.alloc(3213); bytes.writeUInt8(1, 0); bytes.writeUInt32BE(1, 1);
    socket.send(bytes);
    const resultEvent = await eventOf(events, 'claim.result');
    expect(write).toHaveBeenCalledTimes(1); expect(resultEvent.requestId).toMatch(/^asr-1-1-[a-f0-9]{24}$/);
    expect(claimResultSchema.parse(resultEvent.payload).modelVersion).toBe('fixture');
    const record = server.store.sessions.get(session.sessionId)!.requests.get(resultEvent.requestId!)!;
    expect(record.input).toMatchObject({ mode: 'audio', capture: { source: 'recorded_fixture', final: true }, userInitiated: false });
    expect(record.input.capture.segmentId).toMatch(/^segment-[a-f0-9]{24}$/);
    publish(transcript); await new Promise<void>(done => setImmediate(done));
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    expect(record.budget.jev).toBe(2);
    socket.send(JSON.stringify({ type: 'audio.stop', sessionEpoch: 1 }));
    await eventOf(events, 'audio.stopped'); expect(abort.aborted).toBe(true); expect(stopped).toHaveBeenCalledTimes(1);
    const finalsBefore = events.filter(event => event.type === 'transcript.final').length;
    publish({ ...transcript, segmentId: 'late', text: 'Lightning never strikes the same place twice.' });
    await new Promise<void>(done => setImmediate(done));
    expect(events.filter(event => event.type === 'transcript.final')).toHaveLength(finalsBefore);
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
  });
});
