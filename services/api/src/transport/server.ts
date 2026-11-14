import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PipelineError, textInputSchema, type PipelineAdapters } from '../../../../packages/contracts/src/index.js';
import { PipelineRuntime } from '../runtime/pipeline.js';
import { SessionStore, equalSecret, type Session } from '../runtime/session.js';
import { audioStartSchema, type AsrAdapter } from './audio.js';
import { AudioBridge } from './audio-bridge.js';
import { TranscriptContext, isVoiceTrigger } from './transcript-context.js';

export type ServerOptions = {
  adapters: PipelineAdapters; mode: 'fixture' | 'live'; joinCode: string; joinExpiresAt: number;
  allowedOrigins?: string[]; now?: () => number; tls?: { cert: Buffer; key: Buffer }; asr?: AsrAdapter;
};
export async function buildServer(options: ServerOptions) {
  if (options.joinCode.length < 8 || !Number.isFinite(options.joinExpiresAt)) throw new Error('Configure an 8+ character DEMO_JOIN_CODE and DEMO_JOIN_EXPIRES_AT.');
  const now = options.now ?? Date.now;
  const store = new SessionStore(now);
  const runtime = new PipelineRuntime(options.adapters, now, undefined, options.mode === 'fixture' ? 'fixture' : 'jev-latest');
  const audioBridges = new Map<string, AudioBridge>();
  // One stream per session. A newer authenticated connection replaces a stale one (half-open after a network blip).
  const connections = new Map<string, () => void>();
  const app = Fastify({ logger: false, bodyLimit: 16_384, ...(options.tls ? { https: options.tls } : {}) });
  await app.register(websocket, { options: { maxPayload: 16_384, handleProtocols: protocols => protocols.has('actually-v1') ? 'actually-v1' : false } });
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://localhost:3000', 'http://127.0.0.1:3000']);
  const joinAttempts = new Map<string, { count: number; until: number }>();
  const sweep = setInterval(() => { store.sweep(); for (const [ip, rate] of joinAttempts) if (rate.until <= now()) joinAttempts.delete(ip); }, 1000);
  sweep.unref();
  app.addHook('onClose', async () => {
    clearInterval(sweep);
    for (const id of store.sessions.keys()) {
      const stopping = audioBridges.get(id)?.stop(); store.delete(id); await stopping?.catch(() => undefined);
    }
    audioBridges.clear();
  });
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) return reply.code(403).send({ error: 'origin_denied' });
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });
  app.setErrorHandler((error, _request, reply) => {
    const code = error instanceof PipelineError ? error.code : error instanceof z.ZodError ? 'invalid_request' : 'invalid_request';
    const status = code === 'unauthorized' ? 401 : /capacity|queue_full|cooldown|rate_limit/.test(code) ? 429 : /conflict|old_epoch|old_revision|wrong_session/.test(code) ? 409 : 400;
    reply.code(status).send({ error: code });
  });
  const bearer = (value?: string) => value?.startsWith('Bearer ') ? value.slice(7) : undefined;
  const paramsSchema = z.object({ sessionId: z.string().min(1), requestId: z.string().optional() });
  function authenticated(params: unknown, authorization?: string) {
    const parsed = paramsSchema.parse(params); return store.authenticate(parsed.sessionId, bearer(authorization));
  }
  app.get('/health', async () => ({ status: 'ok', mode: options.mode, schemaVersion: 1, providers: { checking: options.mode === 'live' ? 'configured_unverified' : 'fixture', asr: options.asr ? 'configured_unverified' : 'not_configured' } }));
  app.get('/', async (_request, reply) => reply.type('text/html').send(await readFile(new URL('../../../../apps/console/index.html', import.meta.url), 'utf8')));
  app.post('/v1/sessions', async (request, reply) => {
    const rate = joinAttempts.get(request.ip);
    if (!rate || rate.until <= now()) {
      if (joinAttempts.size >= 1000 && !rate) throw new PipelineError('join_rate_limit');
      joinAttempts.set(request.ip, { count: 1, until: now() + 60_000 });
    } else { if (rate.count >= 10) throw new PipelineError('join_rate_limit'); rate.count++; }
    const { joinCode } = z.object({ joinCode: z.string().max(256) }).strict().parse(request.body);
    if (now() >= options.joinExpiresAt || !equalSecret(joinCode, options.joinCode)) throw new PipelineError('unauthorized');
    const session = store.create();
    return reply.code(201).send({ schemaVersion: 1, sessionId: session.id, token: session.token, sessionEpoch: session.epoch, expiresAt: new Date(session.expiresAt).toISOString(), capabilities: { mode: options.mode, text: true, audio: !!options.asr }, budgets: { deadlineMs: 10_000, running: 2, queued: 3, jev: 3, searchesPerClaim: 2 } });
  });
  app.post('/v1/sessions/:sessionId/checks', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const input = textInputSchema.parse(request.body);
    return reply.code(202).send(runtime.submit(session, input));
  });
  app.post('/v1/sessions/:sessionId/checks/:requestId/cancel', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    session.cancel(paramsSchema.parse(request.params).requestId!); return reply.code(204).send();
  });
  app.delete('/v1/sessions/:sessionId', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const stopping = audioBridges.get(session.id)?.stop(); store.delete(session.id);
    await stopping?.catch(() => undefined); return reply.code(204).send();
  });
  app.get('/v1/sessions/:sessionId/stream', {
    websocket: true,
    preValidation: async request => {
      const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
      const token = bearer(request.headers.authorization) ?? protocols.find(p => p.startsWith('bearer.'))?.slice(7);
      store.authenticate(paramsSchema.parse(request.params).sessionId, token);
    }
  }, (socket, request) => {
    const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
    const token = bearer(request.headers.authorization) ?? protocols.find(p => p.startsWith('bearer.'))?.slice(7);
    const session = store.authenticate(paramsSchema.parse(request.params).sessionId, token);
    connections.get(session.id)?.();
    const transcripts = new Map<string, { hash: string; revision: number; capturedAt: string; context: string[] }>();
    const triggered = new Set<string>();
    const recent = new TranscriptContext();
    const forget = () => { transcripts.clear(); triggered.clear(); };
    const fail = (error: unknown) => {
      if (error instanceof PipelineError && error.code === 'audio_cancelled') return;
      if (!session.active || !store.sessions.has(session.id)) return;
      session.emit('pipeline.error', { reasonCode: error instanceof PipelineError ? error.code : 'invalid_request', message: 'The request could not be completed.' });
    };
    const bridge = options.asr ? new AudioBridge(session, options.asr, (event, config, capturedAt) => {
      try {
        const segmentHash = createHash('sha256').update(event.segmentId).digest('hex').slice(0, 24);
        const requestId = `asr-${config.sessionEpoch}-${config.streamGeneration}-${segmentHash}`;
        const hash = createHash('sha256').update(JSON.stringify([event.text, event.confidence])).digest('hex');
        const previous = transcripts.get(requestId);
        if (triggered.has(requestId)) return;
        if (!previous && transcripts.size + triggered.size >= 128) throw new PipelineError('request_capacity');
        if (isVoiceTrigger(event.text)) {
          // A spoken "check this" asks the app for a photo. The command itself is never fact-checked.
          triggered.add(requestId);
          if (previous) { transcripts.delete(requestId); session.cancel(requestId); }
          session.emit('capture.request', { reasonCode: 'voice_trigger' });
          return;
        }
        const record = { hash, revision: previous ? previous.revision + Number(previous.hash !== hash) : 1, capturedAt: previous?.capturedAt ?? new Date(capturedAt).toISOString(),
          context: previous?.context ?? recent.contextFor(requestId, capturedAt) };
        const segmentId = /^[a-zA-Z0-9_-]{1,100}$/.test(event.segmentId) ? event.segmentId : `segment-${segmentHash}`;
        const input = textInputSchema.parse({ schemaVersion: 1, requestId, sessionId: session.id, sessionEpoch: config.sessionEpoch, revision: record.revision,
          mode: 'audio', text: event.text, language: 'en', capturedAt: record.capturedAt,
          capture: { source: config.source, segmentId, confidence: event.confidence, final: true }, context: record.context, userInitiated: false });
        // Context reflects the conversation, including sentences the runtime later declines to check.
        recent.record(requestId, event.text, event.speaker ?? null, Date.parse(record.capturedAt));
        runtime.submit(session, input); transcripts.set(requestId, record);
      } catch (error) { fail(error); }
    }) : undefined;
    if (bridge) audioBridges.set(session.id, bridge);
    const send: Session['listeners'] extends Set<infer T> ? T : never = event => {
      if (event.type === 'session.ended') { forget(); recent.clear(); void bridge?.stop().catch(() => undefined); }
      if (socket.readyState !== 1) return;
      if (socket.bufferedAmount > 65_536) { socket.close(1008, 'Slow consumer'); return; }
      socket.send(JSON.stringify(event));
      if (event.type === 'session.ended' && ['deleted', 'expired'].includes((event.payload as { reasonCode: string }).reasonCode)) socket.close(1000);
    };
    session.listeners.add(send);
    let closed = false;
    const disconnect = (reason = 'disconnected') => {
      if (closed) return;
      closed = true;
      const stopping = bridge?.stop(); forget(); recent.clear(); session.pause(reason); void stopping?.catch(() => undefined);
      session.listeners.delete(send);
      if (audioBridges.get(session.id) === bridge) audioBridges.delete(session.id);
      if (connections.get(session.id) === replace) connections.delete(session.id);
    };
    const replace = () => { disconnect('replaced'); socket.close(4000, 'Replaced by a newer connection'); };
    connections.set(session.id, replace);
    socket.on('error', () => disconnect());
    socket.on('close', () => { session.listeners.delete(send); disconnect(); });
    socket.on('message', async (data, binary) => {
      if (closed) return;
      try {
        store.authenticate(session.id, token);
        if (binary) {
          if (!bridge) throw new PipelineError('audio_not_started');
          await bridge.accept(Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data);
          return;
        }
        const control = z.object({ type: z.string(), sessionEpoch: z.number().int(), requestId: z.string().optional(), claimId: z.string().optional(),
          preferences: z.object({ muted: z.boolean(), automaticNotifications: z.boolean(), selectedTopics: z.array(z.string().max(80)).max(5) }).strict().optional()
        }).passthrough().parse(JSON.parse(data.toString()));
        if (control.sessionEpoch !== session.epoch) throw new PipelineError('old_epoch');
        switch (control.type) {
          case 'session.pause': { const stopping = bridge?.stop(); forget(); recent.clear(); session.pause(); await stopping; break; }
          case 'session.resume': session.active = true; ready(); break;
          case 'session.preferences': if (!control.preferences) throw new PipelineError('invalid_request'); session.preferences = control.preferences; break;
          case 'claim.cancel': if (!control.requestId) throw new PipelineError('invalid_request'); session.cancel(control.requestId); break;
          case 'claim.repeat': {
            if (!session.active || !control.requestId || !control.claimId) throw new PipelineError('no_current_result');
            const record = session.requests.get(control.requestId); const result = record?.results.get(control.claimId);
            if (!record || !result || Date.parse(result.expiresAt) <= now() || !session.current(record)) throw new PipelineError('no_current_result');
            session.emit('claim.result', { ...result, presentation: { action: session.preferences.muted ? 'silent' : 'respond', reasonCode: 'intentional_repeat' } }, record.input, control.claimId); break;
          }
          case 'audio.start': { const config = audioStartSchema.parse(control); if (!bridge) throw new PipelineError('asr_unavailable'); await bridge.start(config); break; }
          case 'audio.stop': forget(); recent.clear(); if (bridge) await bridge.stop(); else session.emit('audio.stopped', { reasonCode: 'stopped' }); break;
          case 'playback.started': forget(); await bridge?.playback(true); break;
          case 'playback.ended': await bridge?.playback(false); break;
          default: throw new PipelineError('unknown_control');
        }
      } catch (error) {
        fail(error);
      }
    });
    const ready = () => session.emit('session.ready', { active: session.active, expiresAt: new Date(session.expiresAt).toISOString(), mode: options.mode, audio: !!options.asr });
    ready();
  });
  return { app, store, runtime };
}
