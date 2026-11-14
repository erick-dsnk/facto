import { afterEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';
import { type EventEnvelope, type TextInput } from '../../../../packages/contracts/src/index.js';
import { claimResultSchema } from '../../../../packages/contracts/src/wire.js';
import { fixtureAdapters } from '../../src/runtime/fixtures.js';
import { buildServer, type ServerOptions } from '../../src/transport/server.js';

type Server = Awaited<ReturnType<typeof buildServer>>;
type Credentials = { sessionId: string; token: string; sessionEpoch: number };
const servers: Server[] = [];
const sockets: WebSocket[] = [];
const initialTime = Date.parse('2026-11-14T10:00:00Z');
const joinCode = 'transport-edge-test-only';
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  for (const server of servers.splice(0)) await server.app.close();
});

async function setup(overrides: Partial<ServerOptions> = {}) {
  let now = initialTime;
  const server = await buildServer({ adapters: fixtureAdapters(), mode: 'fixture', joinCode,
    joinExpiresAt: initialTime + 60_000, now: () => now, ...overrides });
  servers.push(server);
  await server.app.ready();
  const response = await server.app.inject({ method: 'POST', url: '/v1/sessions', payload: { joinCode } });
  expect(response.statusCode).toBe(201);
  return { ...server, credentials: response.json<Credentials>(), advance: (ms: number) => { now += ms; } };
}

async function stream(server: Server, credentials: Credentials) {
  const events: EventEnvelope[] = [];
  const socket = await server.app.injectWS(`/v1/sessions/${credentials.sessionId}/stream`, {
    headers: { authorization: `Bearer ${credentials.token}` }
  }, { onInit: socket => socket.on('message', bytes => events.push(JSON.parse(bytes.toString()) as EventEnvelope)) });
  sockets.push(socket);
  return { socket, events };
}

async function submit(server: Server, credentials: Credentials) {
  const input: TextInput = { schemaVersion: 1, sessionId: credentials.sessionId, sessionEpoch: credentials.sessionEpoch,
    requestId: 'edge-request', revision: 1, mode: 'typed', text: 'Helsinki is the capital of Finland.', language: 'en',
    capturedAt: new Date(initialTime).toISOString(), capture: { source: 'typed_fixture', segmentId: 'edge-segment', confidence: 1, final: true },
    context: [], userInitiated: true };
  const response = await server.app.inject({ method: 'POST', url: `/v1/sessions/${credentials.sessionId}/checks`,
    headers: { authorization: `Bearer ${credentials.token}` }, payload: input });
  expect(response.statusCode).toBe(202);
  return input;
}

async function result(events: EventEnvelope[]) {
  await vi.waitFor(() => expect(events.some(event => event.type === 'claim.result')).toBe(true), { timeout: 1500, interval: 10 });
  return events.find(event => event.type === 'claim.result')!;
}

describe('WebSocket lifetime and intentional repeat boundaries', () => {
  it('keeps exactly one stream when authenticated upgrades start concurrently: the newer replaces the older', async () => {
    const server = await setup();
    const attempts = await Promise.all([stream(server, server.credentials), stream(server, server.credentials)]);
    const state = server.store.sessions.get(server.credentials.sessionId)!;
    await vi.waitFor(() => expect(attempts.filter(attempt => attempt.socket.readyState === 1)).toHaveLength(1), { timeout: 1500, interval: 10 });
    expect(state.listeners.size).toBe(1);
    const loser = attempts.find(attempt => attempt.socket.readyState !== 1)!;
    expect(loser.events.find(event => event.type === 'session.ended')?.payload).toMatchObject({ reasonCode: 'replaced' });
    // Replacement pauses the session; the surviving stream resumes explicitly and still gets its result.
    const winner = attempts.find(attempt => attempt.socket.readyState === 1)!;
    winner.socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: state.epoch }));
    await vi.waitFor(() => expect(state.active).toBe(true), { timeout: 1500, interval: 10 });
    await submit(server, { ...server.credentials, sessionEpoch: state.epoch });
    await result(winner.events);
    expect(winner.events.filter(event => event.type === 'claim.result')).toHaveLength(1);
    expect(loser.events.some(event => event.type === 'claim.result')).toBe(false);
  });

  it('does not reserve ownership after an authenticated upgrade fails its handshake', async () => {
    const server = await setup();
    // Authentication succeeds, then ws rejects this malformed protocol token
    // before invoking the route's socket handler.
    await expect(server.app.injectWS(`/v1/sessions/${server.credentials.sessionId}/stream`, {
      headers: { authorization: `Bearer ${server.credentials.token}`, 'sec-websocket-protocol': 'invalid protocol' }
    })).rejects.toThrow('400');
    const session = server.store.sessions.get(server.credentials.sessionId)!;
    expect(session.listeners.size).toBe(0);
    expect(session.active).toBe(true);
    expect(session.epoch).toBe(1);
    const { events } = await stream(server, server.credentials);
    await submit(server, server.credentials);
    await result(events);
    expect(session.listeners.size).toBe(1);
  });

  it('cancels checking immediately when a slow consumer cannot acknowledge the close handshake', async () => {
    const adapters = fixtureAdapters();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const classify = vi.fn(async (...args: Parameters<typeof adapters.classify>) => {
      const admitted = await adapters.classify(...args);
      await gate;
      return admitted;
    });
    const retrieve = vi.fn(adapters.retrieve);
    const server = await setup({ adapters: { ...adapters, classify, retrieve } });
    const { socket, events } = await stream(server, server.credentials);
    await submit(server, server.credentials);
    await vi.waitFor(() => expect(classify).toHaveBeenCalledTimes(1), { timeout: 1000, interval: 10 });
    const peer = [...server.app.websocketServer.clients][0];
    expect(peer).toBeDefined();
    // Keep the close handshake pending, as a stalled consumer would. Only the
    // server's documented buffered-byte observation is controlled by this test.
    socket.pause();
    Object.defineProperty(peer, 'bufferedAmount', { configurable: true, get: () => 65_537 });
    release();
    await turn();
    expect(peer.readyState).toBe(peer.CLOSING);
    const session = server.store.sessions.get(server.credentials.sessionId)!;
    expect(session.active).toBe(false);
    expect(session.requests.get('edge-request')!.controller.signal.aborted).toBe(true);
    expect(session.requests.get('edge-request')!.budget.searches.size).toBe(0);
    expect(events.some(event => event.type === 'claim.result')).toBe(false);
    expect(session.cache.size).toBe(0);
    // A peer can continue writing while it ignores incoming close frames.
    socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: 2 }));
    await turn();
    expect(session.active).toBe(false);
    expect(session.epoch).toBe(2);
    // Finish the deliberately stalled transport independently of the policy
    // transition, then verify its late events cannot advance the epoch again.
    socket.terminate();
    peer.terminate();
    await vi.waitFor(() => expect(peer.readyState).toBe(peer.CLOSED), { timeout: 1000, interval: 10 });
    peer.emit('error', new Error('late transport error'));
    expect(session.active).toBe(false);
    expect(session.epoch).toBe(2);
  });

  it('uses current mute preference for an intentional repeat without new provider work', async () => {
    const adapters = fixtureAdapters();
    const classify = vi.fn(adapters.classify);
    const retrieve = vi.fn(adapters.retrieve);
    const judge = vi.fn(adapters.judge);
    const server = await setup({ adapters: { classify, retrieve, judge } });
    const { socket, events } = await stream(server, server.credentials);
    await submit(server, server.credentials);
    const first = await result(events);
    socket.send(JSON.stringify({ type: 'session.preferences', sessionEpoch: 1,
      preferences: { muted: true, automaticNotifications: false, selectedTopics: [] } }));
    socket.send(JSON.stringify({ type: 'claim.repeat', sessionEpoch: 1, requestId: first.requestId, claimId: first.claimId }));
    await vi.waitFor(() => expect(events.filter(event => event.type === 'claim.result')).toHaveLength(2), { timeout: 1000, interval: 10 });
    const repeated = events.filter(event => event.type === 'claim.result')[1];
    expect(claimResultSchema.parse(repeated.payload).presentation).toEqual({ action: 'silent', reasonCode: 'intentional_repeat' });
    expect(repeated).toMatchObject({ requestId: first.requestId, claimId: first.claimId, revision: first.revision });
    expect(classify).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it.each(['expired', 'cancelled'] as const)('rejects intentional repeat of an %s result', async condition => {
    const server = await setup();
    const { socket, events } = await stream(server, server.credentials);
    const input = await submit(server, server.credentials);
    const first = await result(events);
    if (condition === 'expired') server.advance(60_001);
    else {
      const response = await server.app.inject({ method: 'POST', url: `/v1/sessions/${server.credentials.sessionId}/checks/${input.requestId}/cancel`,
        headers: { authorization: `Bearer ${server.credentials.token}` } });
      expect(response.statusCode).toBe(204);
    }
    socket.send(JSON.stringify({ type: 'claim.repeat', sessionEpoch: 1, requestId: first.requestId, claimId: first.claimId }));
    await vi.waitFor(() => expect(events.some(event => event.type === 'pipeline.error' && (event.payload as { reasonCode: string }).reasonCode === 'no_current_result')).toBe(true), { timeout: 1000, interval: 10 });
    expect(events.filter(event => event.type === 'claim.result')).toHaveLength(1);
  });
});
