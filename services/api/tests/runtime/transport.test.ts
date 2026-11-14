import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { buildServer, type ServerOptions } from '../../src/transport/server.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { PROVIDER_LIMITS, type EventEnvelope, type PipelineAdapters, type TextInput } from '../../../../packages/contracts/src/index.js';
import { claimResultSchema, eventEnvelopeSchema } from '../../../../packages/contracts/src/wire.js';
import { type AsrAdapter, type AsrTranscript } from '../../src/transport/audio.js';
import { DebugFeed } from '../../src/runtime/debug-feed.js';

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

  it('normalizes the HTTP authentication scheme while preserving token matching', async () => {
    const server = await setup(); const session = await join(server);
    const body = input(session);
    const accepted = await server.app.inject({ method: 'POST', url: `/v1/sessions/${session.sessionId}/checks`,
      headers: { authorization: `bEaReR ${session.token}` }, payload: body });
    expect(accepted.statusCode).toBe(202);
    const malformed = await server.app.inject({ method: 'POST', url: `/v1/sessions/${session.sessionId}/checks`,
      headers: { authorization: `Bearer  ${session.token}` }, payload: { ...body, requestId: 'malformed-auth' } });
    expect(malformed.statusCode).toBe(401);
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
    expect(record.input.capture).not.toHaveProperty('lowConfidenceWords');
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
  it('fills context from earlier final sentences and turns a spoken trigger into capture.request without a check', async () => {
    let publish!: (event: AsrTranscript) => void;
    const asr: AsrAdapter = { start: async (_config, onTranscript) => { publish = onTranscript; return { write: async () => {}, stop: async () => {} }; } };
    const server = await setup({ asr }); const session = await join(server); const { socket, events } = await stream(server, session);
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    await eventOf(events, 'audio.ready');
    const bytes = Buffer.alloc(3213); bytes.writeUInt8(1, 0); bytes.writeUInt32BE(1, 1); socket.send(bytes);
    const final = (segmentId: string, text: string, speaker: number | null) => publish({ text, final: true, segmentId, confidence: 0.9, captureOffsetMs: 0, speaker });
    const state = server.store.sessions.get(session.sessionId)!;
    const inputFor = (segmentId: string) => [...state.requests.values()].find(record => record.input.capture.segmentId === segmentId)?.input;
    await vi.waitFor(() => { final('s1', 'We met in Helsinki.', 0); expect(inputFor('s1')).toBeDefined(); });
    expect(inputFor('s1')!.context).toEqual([]);
    // A sentence the checker does not admit never starts the automatic cooldown, so the next sentence is checked at once.
    final('s2', 'It is a big city.', 1);
    await vi.waitFor(() => expect(inputFor('s2')).toBeDefined());
    expect(inputFor('s2')!.context).toEqual(['Speaker 1: We met in Helsinki.']);
    final('s3', 'Helsinki is the capital of Finland.', 0);
    await vi.waitFor(() => expect(inputFor('s3')).toBeDefined());
    expect(inputFor('s3')!.context).toEqual(['Speaker 1: We met in Helsinki.', 'Speaker 2: It is a big city.']);
    const requestsBefore = state.requests.size;
    final('s4', 'Can you check this?', 0);
    const capture = await eventOf(events, 'capture.request');
    expect(eventEnvelopeSchema.safeParse(capture).success).toBe(true);
    expect(capture.payload).toEqual({ reasonCode: 'voice_trigger' });
    final('s4', 'Can you check this?', 0);
    await new Promise<void>(done => setImmediate(done));
    expect(events.filter(event => event.type === 'capture.request')).toHaveLength(1);
    expect(state.requests.size).toBe(requestsBefore);
    final('s5', 'Lightning never strikes twice.', null);
    await vi.waitFor(() => expect(inputFor('s5')).toBeDefined());
    expect(inputFor('s5')!.context).toEqual(['Speaker 2: It is a big city.', 'Speaker 1: Helsinki is the capital of Finland.']);
    socket.send(JSON.stringify({ type: 'audio.stop', sessionEpoch: 1 }));
    await eventOf(events, 'audio.stopped');
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 2, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    await vi.waitFor(() => expect(events.filter(event => event.type === 'audio.ready')).toHaveLength(2));
    const second = Buffer.alloc(3213); second.writeUInt8(1, 0); second.writeUInt32BE(2, 1); socket.send(second);
    await vi.waitFor(() => { final('s6', 'Paris is in France.', 0); expect(inputFor('s6')).toBeDefined(); });
    expect(inputFor('s6')!.context).toEqual([]);
  });

  it('carries low-confidence words from the ASR transcript into the check, and a change to them is a new revision', async () => {
    let publish!: (event: AsrTranscript) => void;
    const adapters = fixtureAdapters(); const classify = vi.fn(adapters.classify);
    const asr: AsrAdapter = { start: async (_config, onTranscript) => { publish = onTranscript; return { write: async () => {}, stop: async () => {} }; } };
    const server = await setup({ asr, adapters: { ...adapters, classify } }); const session = await join(server); const { socket, events } = await stream(server, session);
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'recorded_fixture' }));
    await eventOf(events, 'audio.ready');
    const bytes = Buffer.alloc(3213); bytes.writeUInt8(1, 0); bytes.writeUInt32BE(1, 1); socket.send(bytes);
    const words = [{ text: 'on', confidence: 0.42 }, { text: 'Tropical', confidence: 0.38 }];
    const heard: AsrTranscript = { text: 'You heard that on Tropical IPO for $2,500,000,000,000?', final: true, segmentId: 'g1-4', confidence: 0.71, captureOffsetMs: 0, lowConfidenceWords: words };
    const state = server.store.sessions.get(session.sessionId)!;
    const record = () => [...state.requests.values()].find(entry => entry.input.capture.segmentId === 'g1-4');
    await vi.waitFor(() => { if (!record()) publish(heard); expect(record()).toBeDefined(); });
    expect(record()!.input.capture).toEqual({ source: 'recorded_fixture', segmentId: 'g1-4', confidence: 0.71, final: true, lowConfidenceWords: words });
    await vi.waitFor(() => expect(classify).toHaveBeenCalledWith(expect.objectContaining({ capture: expect.objectContaining({ lowConfidenceWords: words }) }), expect.anything()));
    publish(heard); await new Promise<void>(done => setImmediate(done));
    expect(record()!.input.revision).toBe(1);
    publish({ ...heard, lowConfidenceWords: [words[1]] });
    await vi.waitFor(() => expect(record()!.input.revision).toBe(2));
    expect(record()!.input.capture.lowConfidenceWords).toEqual([words[1]]);
    publish({ ...heard, lowConfidenceWords: [] });
    await vi.waitFor(() => expect(record()!.input.revision).toBe(3));
    expect(record()!.input.capture).not.toHaveProperty('lowConfidenceWords');
    const transcriptEvents = events.filter(event => event.type === 'transcript.final');
    expect(transcriptEvents.length).toBeGreaterThan(0);
    expect(transcriptEvents.every(event => !('lowConfidenceWords' in (event.payload as object)))).toBe(true);
  });

  it('reports the provider limits from the shared contract in the session budgets', async () => {
    const server = await setup();
    const response = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode } });
    expect(response.json().budgets).toEqual({ deadlineMs: 10_000, running: 2, queued: 3, jev: PROVIDER_LIMITS.jev, searchesPerClaim: PROVIDER_LIMITS.search });
  });

  it('re-checks a corrected trigger, asks for one photo per segment and per 2 s, and keeps listening past 128 sentences', async () => {
    let publish!: (event: AsrTranscript) => void;
    const asr: AsrAdapter = { start: async (_config, onTranscript) => { publish = onTranscript; return { write: async () => {}, stop: async () => {} }; } };
    const server = await setup({ asr }); const session = await join(server); const { socket, events } = await stream(server, session);
    socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    await eventOf(events, 'audio.ready');
    const bytes = Buffer.alloc(3213); bytes.writeUInt8(1, 0); bytes.writeUInt32BE(1, 1); socket.send(bytes);
    const final = (segmentId: string, text: string) => publish({ text, final: true, segmentId, confidence: 0.9, captureOffsetMs: 0, speaker: 0 });
    const settle = () => new Promise<void>(done => setImmediate(done));
    const state = server.store.sessions.get(session.sessionId)!;
    const inputFor = (segmentId: string) => [...state.requests.values()].find(record => record.input.capture.segmentId === segmentId)?.input;
    const captures = () => events.filter(event => event.type === 'capture.request').length;
    await vi.waitFor(() => { final('t1', 'Check this.'); expect(captures()).toBe(1); });
    final('t1', 'Helsinki is the capital of Finland.'); await settle();
    expect(inputFor('t1')).toMatchObject({ revision: 1, text: 'Helsinki is the capital of Finland.' });
    final('t1', 'Check this.'); await settle();
    expect(captures()).toBe(1); expect(events.some(event => event.type === 'check.cancelled')).toBe(true);
    final('t1', 'Helsinki is the capital of Finland.'); await settle();
    expect(inputFor('t1')).toMatchObject({ revision: 2 });
    final('t2', 'Is this true?'); await settle();
    expect(captures()).toBe(1);
    server.advance(2_000);
    final('t3', 'Check this one.'); await settle();
    expect(captures()).toBe(2);
    for (let index = 0; state.requests.size < 128; index++) { final(`n${index}`, `Sentence number ${index}.`); await settle(); }
    expect(events.some(event => event.type === 'audio.stopped')).toBe(false);
    final('over', 'One sentence too many.'); await settle();
    expect((await eventOf(events, 'audio.stopped')).payload).toMatchObject({ reasonCode: 'request_capacity' });
    expect(events.some(event => event.type === 'pipeline.error' && (event.payload as { reasonCode: string }).reasonCode === 'request_capacity')).toBe(true);
  });

  it('reads the client address from the trusted proxy hop so one client cannot lock every device out of joining', async () => {
    const server = await setup({ trustProxy: 1 });
    const attempt = (forwardedFor: string, code = 'incorrect-code') => server.app.inject({ method: 'POST', url: '/v1/sessions', headers: { 'x-forwarded-for': forwardedFor }, payload: { joinCode: code } });
    for (let index = 0; index < 10; index++) expect((await attempt('203.0.113.1')).statusCode).toBe(401);
    expect((await attempt('203.0.113.1', joinCode)).statusCode).toBe(429);
    // A forged left-most entry does not escape the bucket of the address the proxy saw.
    expect((await attempt('198.51.100.7, 203.0.113.1', joinCode)).statusCode).toBe(429);
    expect((await attempt('203.0.113.2', joinCode)).statusCode).toBe(201);
    const direct = await setup();
    for (let index = 0; index < 10; index++) await direct.app.inject({ method: 'POST', url: '/v1/sessions', headers: { 'x-forwarded-for': `203.0.113.${index}` }, payload: { joinCode: 'incorrect-code' } });
    expect((await direct.app.inject({ method: 'POST', url: '/v1/sessions', headers: { 'x-forwarded-for': '203.0.113.99' }, payload: { joinCode } })).statusCode).toBe(429);
  });

  it('resumes after a reconnect with a strictly higher stream generation', async () => {
    const asr: AsrAdapter = { start: async () => ({ write: async () => {}, stop: async () => {} }) };
    const server = await setup({ asr }); const session = await join(server); const first = await stream(server, session);
    const start = (epoch: number, generation: number) => JSON.stringify({ type: 'audio.start', sessionEpoch: epoch, streamGeneration: generation, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' });
    first.socket.send(start(1, 1)); await eventOf(first.events, 'audio.ready');
    first.socket.terminate();
    const state = server.store.sessions.get(session.sessionId)!;
    await vi.waitFor(() => expect(state.active).toBe(false));
    const second = await stream(server, session);
    expect((await eventOf(second.events, 'session.ready')).payload).toMatchObject({ active: false });
    second.socket.send(start(2, 2));
    await new Promise(done => setTimeout(done, 50));
    expect(second.events.some(event => event.type === 'audio.ready')).toBe(false);
    second.socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: 2 }));
    await vi.waitFor(() => expect(second.events.filter(event => event.type === 'session.ready')).toHaveLength(2));
    second.socket.send(start(2, 2));
    const ready = await eventOf(second.events, 'audio.ready');
    expect(ready.sessionEpoch).toBe(2); expect(ready.payload).toMatchObject({ streamGeneration: 2 });
    expect(second.events.some(event => event.type === 'pipeline.error')).toBe(false);
  });

  it('replaces a stale half-open stream with a newer authenticated connection', async () => {
    const stopped = vi.fn(async () => {});
    const asr: AsrAdapter = { start: async () => ({ write: async () => {}, stop: stopped }) };
    const server = await setup({ asr }); const session = await join(server); const first = await stream(server, session);
    first.socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    await eventOf(first.events, 'audio.ready');
    const closed = once(first.socket, 'close');
    const second = await stream(server, session);
    const [code] = await closed as [number];
    expect(code).toBe(4000); expect(stopped).toHaveBeenCalledTimes(1);
    expect(first.events.find(event => event.type === 'session.ended')?.payload).toMatchObject({ reasonCode: 'replaced' });
    const state = server.store.sessions.get(session.sessionId)!;
    expect(state.epoch).toBe(2); expect(state.listeners.size).toBe(1);
    second.socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: 2 }));
    await vi.waitFor(() => expect(state.active).toBe(true));
    second.socket.send(JSON.stringify({ type: 'audio.start', sessionEpoch: 2, streamGeneration: 2, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' }));
    await eventOf(second.events, 'audio.ready');
    expect(state.active).toBe(true); expect(state.epoch).toBe(2);
  });
});

describe('debug feed', () => {
  it('does not exist unless the server enables it', async () => {
    const server = await setup();
    const response = await server.app.inject({ method: 'GET', url: '/v1/debug/feed', headers: { 'x-debug-key': joinCode } });
    expect(response.statusCode).toBe(404);
  });

  it('records the check text and every session event, readable only with the join code', async () => {
    const feed = new DebugFeed();
    const server = await setup({ debugFeed: feed });
    const session = await join(server);
    expect((await submit(server, session)).statusCode).toBe(202);
    await vi.waitFor(() => expect(feed.after(0).some(entry => entry.kind === 'claim.result')).toBe(true));
    expect((await server.app.inject({ method: 'GET', url: '/v1/debug/feed', headers: { 'x-debug-key': 'wrong-key-123' } })).statusCode).toBe(401);
    expect((await server.app.inject({ method: 'GET', url: '/v1/debug/feed' })).statusCode).toBe(401);
    const response = await server.app.inject({ method: 'GET', url: '/v1/debug/feed?after=0', headers: { 'x-debug-key': joinCode } });
    const entries = response.json<{ entries: { seq: number; kind: string; sessionId?: string; data: { text?: string } }[] }>().entries;
    expect(entries[0]).toMatchObject({ kind: 'session.created', sessionId: session.sessionId });
    expect(entries.find(entry => entry.kind === 'check.request')?.data.text).toBe('Helsinki is the capital of Finland.');
    expect(entries.map(entry => entry.kind)).toContain('claim.result');
    const last = entries.at(-1)!.seq;
    const later = await server.app.inject({ method: 'GET', url: `/v1/debug/feed?after=${last}`, headers: { 'x-debug-key': joinCode } });
    expect(later.json<{ entries: unknown[] }>().entries).toEqual([]);
  });

  it('keeps only the newest entries', () => {
    const feed = new DebugFeed(3);
    for (let i = 0; i < 5; i++) feed.push('n', i);
    expect(feed.after(0).map(entry => entry.data)).toEqual([2, 3, 4]);
  });
});
