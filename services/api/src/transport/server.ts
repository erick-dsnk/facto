import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { PROVIDER_LIMITS, PipelineError, textInputSchema, type LowConfidenceWord } from '../../../../packages/contracts/src/index.js';
import type { RuntimeAdapters } from '../runtime/adapters.js';
import { PipelineRuntime } from '../runtime/pipeline.js';
import { SessionStore, equalSecret, type Session } from '../runtime/session.js';
import type { DebugFeed } from '../runtime/debug-feed.js';
import { audioStartSchema, type AsrAdapter, type AudioStart } from './audio.js';
import { AudioBridge } from './audio-bridge.js';
import { displayEventVisible } from '../runtime/display.js';
import { TranscriptContext, isVoiceTrigger } from './transcript-context.js';
import { type VoiceConfig } from './voice-level.js';
import { SentenceStitcher } from './stitch.js';
import { OCR_SELECTION_BODY_LIMIT, parseTargetSelectionRequest, unavailableSelection, type TargetSelector } from '../input/ocr/target-selection.js';

export type ServerOptions = {
  adapters: RuntimeAdapters; mode: 'fixture' | 'live'; joinCode: string; joinExpiresAt: number;
  allowedOrigins?: string[]; now?: () => number; tls?: { cert: Buffer; key: Buffer }; asr?: AsrAdapter;
  /**
   * Proxy hops in front of every request (1 behind Railway's edge proxy). The client address then comes from the entry that hop
   * appended to X-Forwarded-For, so a forged left-most entry is ignored. Leave unset when clients can connect directly.
   */
  trustProxy?: number;
  /** Debug only: records every session event and check request, readable at GET /v1/debug/feed with debugFeedKey. */
  debugFeed?: DebugFeed;
  /** Operator credential for the debug feed, at least 16 characters. Without it the feed is off and nothing is recorded. The join code never opens the feed. */
  debugFeedKey?: string;
  /**
   * Voice dimming and spoken-answer echo (ASR_DIM_DB, ASR_DIM_FLOOR_DBFS, ASR_ECHO_MS). Absent: neither. With the debug feed on,
   * every final sentence's level decision is recorded as an `asr.level` entry.
   */
  voice?: VoiceConfig;
  /** Optional explicit image upload path; image/OCR never enter the debug feed. */
  targetSelector?: TargetSelector;
};
/** Spoken segments remembered per stream for corrections. The oldest is forgotten first, so listening never stops on a count. */
const SEGMENT_MEMORY = 64;
/** Repeated "check this" within this window asks the app for one photo, not several. */
const CAPTURE_REQUEST_INTERVAL_MS = 2_000;
const remember = <T>(map: Map<string, T>, key: string, value: T) => {
  map.delete(key); map.set(key, value);
  if (map.size > SEGMENT_MEMORY) map.delete(map.keys().next().value!);
};
export async function buildServer(options: ServerOptions) {
  if (options.joinCode.length < 8 || !Number.isFinite(options.joinExpiresAt)) throw new Error('Configure an 8+ character DEMO_JOIN_CODE and DEMO_JOIN_EXPIRES_AT.');
  const now = options.now ?? Date.now;
  const debugFeed = options.debugFeed && (options.debugFeedKey?.length ?? 0) >= 16 ? options.debugFeed : undefined;
  const store = new SessionStore(now, id => debugFeed?.purgeSession(id));
  const runtime = new PipelineRuntime(options.adapters, now, undefined, options.mode === 'fixture' ? 'fixture' : 'jev-latest');
  const audioBridges = new Map<string, AudioBridge>();
  const selecting = new Set<string>();
  const selectionRates = new Map<string, { count: number; until: number }>();
  // One stream per session. A newer authenticated connection replaces a stale one (half-open after a network blip).
  const displayGrants = new Map<string, { token: string; expiresAt: number; observers: Set<(code?: number) => void> }>();
  const connections = new Map<string, () => void>();
  const app = Fastify({ logger: false, bodyLimit: 16_384, ...(options.trustProxy ? { trustProxy: (_address: string, hop: number) => hop < options.trustProxy! } : {}), ...(options.tls ? { https: options.tls } : {}) });
  await app.register(websocket, { options: { maxPayload: 16_384, handleProtocols: protocols => protocols.has('actually-display-v1') ? 'actually-display-v1' : protocols.has('actually-v1') ? 'actually-v1' : false } });
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3030', 'http://127.0.0.1:3030']);
  const joinAttempts = new Map<string, { count: number; until: number }>();
  const sweep = setInterval(() => { store.sweep(); for (const [id, grant] of displayGrants) if (grant.expiresAt <= now() || !store.sessions.has(id)) { for (const close of grant.observers) close(); displayGrants.delete(id); } for (const [ip, rate] of joinAttempts) if (rate.until <= now()) joinAttempts.delete(ip); }, 1000);
  sweep.unref();
  app.addHook('onClose', async () => {
    clearInterval(sweep);
    for (const id of store.sessions.keys()) {
      const stopping = audioBridges.get(id)?.stop(); store.delete(id); await stopping?.catch(() => undefined);
    }
    audioBridges.clear();
    for (const grant of displayGrants.values()) for (const close of grant.observers) close();
    displayGrants.clear();
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
  // RFC 6750 inherits HTTP's case-insensitive auth-scheme token. Keep the
  // credential itself exact so malformed headers never get silently repaired.
  const bearer = (value?: string) => /^Bearer ([^\s]+)$/i.exec(value ?? '')?.[1];
  const paramsSchema = z.object({ sessionId: z.string().min(1), requestId: z.string().optional() });
  function authenticated(params: unknown, authorization?: string) {
    const parsed = paramsSchema.parse(params); return store.authenticate(parsed.sessionId, bearer(authorization));
  }
  app.get('/health', async () => ({ status: 'ok', mode: options.mode, schemaVersion: 1, providers: { checking: options.mode === 'live' ? 'configured_unverified' : 'fixture', asr: options.asr ? 'configured_unverified' : 'not_configured' } }));
  app.get('/', async (_request, reply) => reply.type('text/html').send(await readFile(new URL('../../../../apps/console/index.html', import.meta.url), 'utf8')));
  // Serve the built observer on the API origin. Only generated asset basenames
  // are accepted; no general filesystem path or SPA fallback is exposed.
  app.get('/display', async (_request, reply) => reply.redirect('/display/'));
  app.get('/display/', async (_request, reply) => {
    try { return reply.type('text/html').send(await readFile(new URL('../../../../dist/glasses/index.html', import.meta.url), 'utf8')); }
    catch { return reply.code(503).send({ error: 'display_not_built' }); }
  });
  app.get('/display/favicon.png', async (_request, reply) => {
    try { return reply.type('image/png').send(await readFile(new URL('../../../../dist/glasses/favicon.png', import.meta.url))); }
    catch { return reply.code(404).send({ error: 'not_found' }); }
  });
  app.get('/display/assets/:file', async (request, reply) => {
    const file = (request.params as { file: string }).file;
    const extension = /^[A-Za-z0-9_-]+\.(js|css|png|svg|webp|woff2)$/.exec(file)?.[1];
    if (!extension) return reply.code(404).send({ error: 'not_found' });
    const types: Record<string, string> = { js: 'text/javascript', css: 'text/css', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2' };
    try { return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(types[extension]).send(await readFile(new URL(`../../../../dist/glasses/assets/${file}`, import.meta.url))); }
    catch { return reply.code(404).send({ error: 'not_found' }); }
  });
  app.post('/v1/sessions', async (request, reply) => {
    const rate = joinAttempts.get(request.ip);
    if (!rate || rate.until <= now()) {
      if (joinAttempts.size >= 1000 && !rate) throw new PipelineError('join_rate_limit');
      joinAttempts.set(request.ip, { count: 1, until: now() + 60_000 });
    } else { if (rate.count >= 10) throw new PipelineError('join_rate_limit'); rate.count++; }
    const { joinCode } = z.object({ joinCode: z.string().max(256) }).strict().parse(request.body);
    if (now() >= options.joinExpiresAt || !equalSecret(joinCode, options.joinCode)) throw new PipelineError('unauthorized');
    const session = store.create();
    const feed = debugFeed;
    if (feed) {
      feed.push('session.created', { expiresAt: new Date(session.expiresAt).toISOString() }, session.id);
      session.listeners.add(event => feed.push(event.type, { requestId: event.requestId, revision: event.revision, claimId: event.claimId, payload: event.payload }, session.id));
    }
    return reply.code(201).send({ schemaVersion: 1, sessionId: session.id, token: session.token, sessionEpoch: session.epoch, expiresAt: new Date(session.expiresAt).toISOString(), capabilities: { mode: options.mode, text: true, audio: !!options.asr }, budgets: { deadlineMs: 10_000, running: 2, queued: 3, jev: PROVIDER_LIMITS.jev, searchesPerClaim: PROVIDER_LIMITS.search } });
  });
  app.post('/v1/sessions/:sessionId/display-grant', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const previous = displayGrants.get(session.id);
    if (previous) for (const close of previous.observers) close(4002);
    const grant = { token: randomBytes(32).toString('base64url'), expiresAt: Math.min(now() + 300_000, session.expiresAt), observers: new Set<(code?: number) => void>() };
    displayGrants.set(session.id, grant);
    return reply.code(201).send({ schemaVersion: 1, sessionId: session.id, sessionEpoch: session.epoch, displayToken: grant.token, expiresAt: new Date(grant.expiresAt).toISOString(), streamPath: `/v1/sessions/${session.id}/display-stream` });
  });
  app.delete('/v1/sessions/:sessionId/display-grant', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const grant = displayGrants.get(session.id);
    if (grant) { for (const close of grant.observers) close(4003); displayGrants.delete(session.id); }
    return reply.code(204).send();
  });
  const displayAccess = (sessionId: string, protocols: string[]) => {
    const session = store.sessions.get(sessionId);
    const grant = displayGrants.get(sessionId);
    const token = protocols.find(value => value.startsWith('display.'))?.slice(8);
    if (!protocols.includes('actually-display-v1') || !session || session.expiresAt <= now() || !grant || grant.expiresAt <= now() || !token || !equalSecret(token, grant.token)) throw new PipelineError('unauthorized');
    return { session, grant };
  };
  app.get('/v1/sessions/:sessionId/display-stream', {
    websocket: true,
    preValidation: (request, _reply, done) => {
      displayAccess(paramsSchema.parse(request.params).sessionId, String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(value => value.trim())); done();
    }
  }, (socket, request) => {
    const { session, grant } = displayAccess(paramsSchema.parse(request.params).sessionId, String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(value => value.trim()));
    if (grant.observers.size >= 4) { socket.close(1008, 'Display capacity'); return; }
    let closed = false;
    const cleanup = () => { if (closed) return; closed = true; session.displayListeners.delete(send); grant.observers.delete(close); };
    const close = (code = 4001) => { cleanup(); socket.close(code, code === 4002 ? 'Display grant replaced' : code === 4003 ? 'Display grant revoked' : 'Display grant ended'); };
    const send: Session['displayListeners'] extends Set<infer T> ? T : never = (event, state, previous) => {
      if (closed || socket.readyState !== 1) return;
      if (grant.expiresAt <= now() || session.expiresAt <= now() || displayGrants.get(session.id) !== grant) { close(); return; }
      const clearedSilent = event.type === 'claim.result' && previous !== null && state === null;
      if (!clearedSilent && !displayEventVisible(event, state, previous)) return;
      if (socket.bufferedAmount > 65_536) { cleanup(); socket.close(1008, 'Slow consumer'); return; }
      socket.send(JSON.stringify(clearedSilent ? { ...event, type: 'check.cancelled', payload: { reasonCode: 'not_presented' } } : event));
      if (event.type === 'session.ended' && ['deleted', 'expired'].includes((event.payload as { reasonCode: string }).reasonCode)) close(1000);
    };
    grant.observers.add(close); session.displayListeners.add(send);
    const state = session.displayState;
    // The snapshot is per observer, never emitted onto the owner/audio stream.
    socket.send(JSON.stringify({ schemaVersion: 1, type: 'display.snapshot', sessionId: session.id, sessionEpoch: session.epoch, eventSeq: session.sequence,
      active: session.active, expiresAt: new Date(grant.expiresAt).toISOString(), state: session.active && (!state?.result || Date.parse(state.result.expiresAt) > now()) ? state : null }));
    socket.on('close', cleanup); socket.on('error', cleanup);
    // Read only: neither JSON controls nor binary audio can reach the session.
    socket.on('message', () => { cleanup(); socket.close(1008, 'Read-only display'); });
  });
  app.post('/v1/sessions/:sessionId/checks', async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const input = textInputSchema.parse(request.body);
    debugFeed?.push('check.request', { requestId: input.requestId, revision: input.revision, mode: input.mode, text: input.text, capture: input.capture, context: input.context, userInitiated: input.userInitiated }, session.id);
    return reply.code(202).send(runtime.submit(session, input));
  });
  app.post('/v1/sessions/:sessionId/ocr/select-target', {
    bodyLimit: OCR_SELECTION_BODY_LIMIT,
    onRequest: async request => { authenticated(request.params, request.headers.authorization); },
  }, async (request, reply) => {
    const session = authenticated(request.params, request.headers.authorization);
    const input = parseTargetSelectionRequest(request.body);
    if (!options.targetSelector) return unavailableSelection('selection_not_configured');
    for (const [id, rate] of selectionRates) if (rate.until <= now() || !store.sessions.has(id)) selectionRates.delete(id);
    const previous = selectionRates.get(session.id);
    if (selecting.has(session.id) || selecting.size >= 4 || (previous && previous.count >= 10)) return reply.code(429).send({ error: 'selection_rate_limit' });
    selectionRates.set(session.id, { count: (previous?.count ?? 0) + 1, until: previous?.until ?? now() + 60_000 });
    selecting.add(session.id);
    try {
      const result = await options.targetSelector(input);
      // A deleted/expired session must not receive a late result.
      authenticated(request.params, request.headers.authorization);
      return result;
    } finally { selecting.delete(session.id); }
  });
  if (debugFeed) {
    const feed = debugFeed;
    app.get('/v1/debug/feed', async (request, reply) => {
      const key = request.headers['x-debug-key'];
      if (typeof key !== 'string' || !equalSecret(key, options.debugFeedKey!)) throw new PipelineError('unauthorized');
      const after = Number((request.query as { after?: string }).after ?? 0);
      return reply.send({ entries: feed.after(Number.isFinite(after) ? after : 0) });
    });
  }
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
    // Authenticate synchronously before the upgrade. A second authenticated stream is
    // not rejected: the handler closes the older one (4000) so a client can reconnect
    // after a half-open drop.
    preValidation: (request, _reply, done) => {
      const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
      const token = bearer(request.headers.authorization) ?? protocols.find(p => p.startsWith('bearer.'))?.slice(7);
      store.authenticate(paramsSchema.parse(request.params).sessionId, token);
      done();
    }
  }, (socket, request) => {
    const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
    const token = bearer(request.headers.authorization) ?? protocols.find(p => p.startsWith('bearer.'))?.slice(7);
    const session = store.authenticate(paramsSchema.parse(request.params).sessionId, token);
    connections.get(session.id)?.();
    const transcripts = new Map<string, { hash: string; revision: number; capturedAt: string; context: string[] }>();
    // Segments that already asked for a photo: capture.request goes out at most once per segment.
    const triggered = new Map<string, true>();
    let lastCaptureRequestAt = -Infinity;
    const recent = new TranscriptContext();
    // Joins hesitation-split claims and keeps fragments from being checked (part of the voice options; absent, every sentence is checked).
    const stitcher = options.voice ? new SentenceStitcher(options.voice.stitchMs) : undefined;
    // A held sentence that trails off is checked on its own once nothing continues it within the stitch window.
    const releaseTimers = new Set<ReturnType<typeof setTimeout>>();
    let lastConfig: AudioStart | undefined;
    const forget = () => { transcripts.clear(); triggered.clear(); stitcher?.clear(); for (const timer of releaseTimers) clearTimeout(timer); releaseTimers.clear(); };
    const fail = (error: unknown) => {
      if (error instanceof PipelineError && error.code === 'audio_cancelled') return;
      if (!session.active || !store.sessions.has(session.id)) return;
      session.emit('pipeline.error', { reasonCode: error instanceof PipelineError ? error.code : 'invalid_request', message: 'The request could not be completed.' });
    };
    type CheckStep = { requestId: string; segmentId: string; text: string; speaker: number | null; atMs: number };
    /** Submits one sentence (or stitched claim) for checking. Every revision is re-evaluated: a correction that is no longer a trigger is checked like any sentence. */
    const submitCheck = (step: CheckStep, config: AudioStart, confidence: number | null, lowConfidenceWords?: LowConfidenceWord[]) => {
      const target = step.requestId;
      // A correction that only changes which words were uncertain is a new revision too.
      const hash = createHash('sha256').update(JSON.stringify(lowConfidenceWords ? [step.text, confidence, lowConfidenceWords] : [step.text, confidence])).digest('hex');
      const previous = transcripts.get(target);
      const record = { hash, revision: previous ? previous.revision + Number(previous.hash !== hash) : 1, capturedAt: previous?.capturedAt ?? new Date(step.atMs).toISOString(),
        context: previous?.context ?? recent.contextFor(target, step.atMs) };
      const segmentId = /^[a-zA-Z0-9_-]{1,100}$/.test(step.segmentId) ? step.segmentId : `segment-${createHash('sha256').update(step.segmentId).digest('hex').slice(0, 24)}`;
      const input = textInputSchema.parse({ schemaVersion: 1, requestId: target, sessionId: session.id, sessionEpoch: config.sessionEpoch, revision: record.revision,
        mode: 'audio', text: step.text, language: 'en', capturedAt: record.capturedAt,
        capture: { source: config.source, segmentId, confidence, final: true, ...(lowConfidenceWords ? { lowConfidenceWords } : {}) },
        context: record.context, userInitiated: false });
      // Context reflects the conversation, including sentences the runtime later declines to check.
      recent.record(target, step.text, step.speaker, Date.parse(record.capturedAt));
      runtime.submit(session, input); remember(transcripts, target, record);
    };
    const scheduleRelease = () => {
      if (!stitcher || !options.voice) return;
      const timer = setTimeout(() => {
        releaseTimers.delete(timer);
        if (!lastConfig || !session.active) return;
        for (const step of stitcher.release(now())) {
          try {
            debugFeed?.push('asr.stitch', { action: 'release', requestId: step.requestId, text: step.text }, session.id);
            submitCheck(step, lastConfig, null);
          } catch (error) { fail(error); }
        }
      }, options.voice.stitchMs + 250);
      timer.unref?.();
      releaseTimers.add(timer);
    };
    const bridge: AudioBridge | undefined = options.asr ? new AudioBridge(session, options.asr, (event, config, capturedAt) => {
      try {
        const segmentHash = createHash('sha256').update(event.segmentId).digest('hex').slice(0, 24);
        const requestId = `asr-${config.sessionEpoch}-${config.streamGeneration}-${segmentHash}`;
        const lowConfidenceWords = event.lowConfidenceWords?.length ? event.lowConfidenceWords : undefined;
        // A correction that only changes which words were uncertain is a new revision too.
        const hashOf = (text: string) => createHash('sha256').update(JSON.stringify(lowConfidenceWords ? [text, event.confidence, lowConfidenceWords] : [text, event.confidence])).digest('hex');
        lastConfig = config;
        if (isVoiceTrigger(event.text)) {
          // A spoken "check this" asks the app for a photo. The command itself is never fact-checked.
          // Keep the segment's revision so a later correction back to a claim is checked as a newer revision.
          stitcher?.interrupt();
          const previous = transcripts.get(requestId);
          if (previous) { remember(transcripts, requestId, { ...previous, hash: hashOf(event.text) }); session.cancel(requestId); }
          if (triggered.has(requestId)) return;
          remember(triggered, requestId, true);
          if (now() - lastCaptureRequestAt < CAPTURE_REQUEST_INTERVAL_MS) return;
          lastCaptureRequestAt = now();
          session.emit('capture.request', { reasonCode: 'voice_trigger' });
          return;
        }
        // A fragment waits for its continuation and is never checked alone; a stitched claim is a revision of its first fragment's
        // request, so it supersedes whatever that fragment started.
        const step = stitcher?.add({ requestId, segmentId: event.segmentId, text: event.text, speaker: event.speaker ?? null, atMs: capturedAt })
          ?? { action: 'check' as const, requestId, segmentId: event.segmentId, text: event.text, speaker: event.speaker ?? null, atMs: capturedAt };
        if (step.action === 'skip') return;
        if (step.action === 'hold' || step.requestId !== requestId || step.text !== event.text) {
          debugFeed?.push('asr.stitch', { action: step.action, requestId: step.requestId, text: step.text, ...(step.action === 'hold' && step.cancel ? { cancelled: step.cancel } : {}) }, session.id);
        }
        if (step.action === 'hold') {
          if (step.cancel) session.cancel(step.cancel);
          recent.record(step.requestId, step.text, step.speaker, step.atMs);
          scheduleRelease();
          return;
        }
        submitCheck(step, config, event.confidence, lowConfidenceWords);
      } catch (error) {
        // The session's request budget is spent. Stop listening with a distinct reason instead of dropping every later sentence.
        if (error instanceof PipelineError && error.code === 'request_capacity') void bridge?.stop('request_capacity').catch(() => undefined);
        fail(error);
      }
    }, { dim: options.voice ? { dimDb: options.voice.dimDb, floorDbfs: options.voice.floorDbfs } : undefined, echoMs: options.voice?.echoMs,
      onLevel: debugFeed ? record => debugFeed.push('asr.level', record, session.id) : undefined }) : undefined;
    if (bridge) audioBridges.set(session.id, bridge);
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
    const send: Session['listeners'] extends Set<infer T> ? T : never = event => {
      if (event.type === 'session.ended') { forget(); recent.clear(); void bridge?.stop().catch(() => undefined); }
      if (socket.readyState !== 1) return;
      if (socket.bufferedAmount > 65_536) { socket.close(1008, 'Slow consumer'); disconnect(); return; }
      socket.send(JSON.stringify(event));
      if (event.type === 'session.ended' && ['deleted', 'expired'].includes((event.payload as { reasonCode: string }).reasonCode)) socket.close(1000);
    };
    session.listeners.add(send);
    socket.on('error', () => disconnect());
    socket.on('close', () => { session.listeners.delete(send); disconnect(); });
    socket.on('message', async (data, binary) => {
      if (closed || socket.readyState !== 1) return;
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
