import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import { z } from 'zod';
import { codePoints } from '../../../../packages/contracts/src/index.js';
import { labelTerminal, safeReasonCode, type EvalLabel, type Terminal } from './labels.js';
import type { EvalCase, EvalSet } from './sets.js';

/** The part of a WebSocket client the driver uses. Tests inject a fake. */
export interface EvalSocket {
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: unknown) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  send(data: string): void;
  close(): void;
}
export type EvalTransport = {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Opens the session stream with the token in the Authorization header, never in the URL. */
  openSocket: (url: string, token: string) => EvalSocket;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};
export const nodeTransport = (): EvalTransport => ({
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
  openSocket: (url, token) => new WebSocket(url, ['facto-v1'], { headers: { Authorization: `Bearer ${token}` }, handshakeTimeout: 10_000 }),
  now: Date.now,
  sleep: ms => delay(ms),
});

/** A stop that ends the whole run (bad join code, unreachable server). Never carries a secret. */
export class EvalStop extends Error {
  constructor(public code: string) { super(code); this.name = 'EvalStop'; }
}

/** One scored check. No input text, summary or checked text: HARD rows must hold ids and labels only. */
export type EvalRow = {
  set: EvalSet; id: string; expected: EvalLabel; predicted: EvalLabel; reasonCode: string | null; latencyMs: number | null;
  jevCalls: number | null; exaSearches: number | null; fieldUnsupported?: boolean;
};

type WireEvent = { type: string; requestId?: string; claimId?: string; revision?: number; sessionEpoch?: number; payload: unknown };
const wireEventSchema = z.object({
  type: z.string(), requestId: z.string().optional(), claimId: z.string().optional(), revision: z.number().optional(),
  sessionEpoch: z.number().optional(), payload: z.unknown()
}).passthrough();
const sessionResponseSchema = z.object({ sessionId: z.string().min(1), token: z.string().min(1), sessionEpoch: z.number().int().positive(), expiresAt: z.string() }).passthrough();
const usageSchema = z.object({ jevCalls: z.number().int().nonnegative(), exaSearches: z.number().int().nonnegative() }).passthrough();

const decode = (data: unknown): string | null => {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data) && data.every(part => Buffer.isBuffer(part))) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return null;
};
const errorCode = async (response: Response): Promise<string | null> => {
  try { return safeReasonCode(((await response.json()) as { error?: unknown }).error); } catch { return null; }
};

type LiveSession = {
  id: string; token: string; epoch: number; expiresAt: number; socket: EvalSocket; checks: number; closed: boolean;
  listeners: Set<(event: WireEvent | 'closed') => void>;
};
export type SessionPoolOptions = { checksPerSession?: number; maxJoinsPerMinute?: number; minRemainingMs?: number; readyTimeoutMs?: number };

/**
 * Sessions for the run: a new one every 40 checks, when fewer than 20 s remain, or after a 401. Joins stay
 * under the server's 10 per minute. The join code is only ever sent in the join request body.
 */
export class SessionPool {
  private session: LiveSession | undefined;
  private joinTimes: number[] = [];
  joins = 0;
  private readonly checksPerSession: number;
  private readonly maxJoinsPerMinute: number;
  private readonly minRemainingMs: number;
  private readonly readyTimeoutMs: number;

  constructor(readonly serverUrl: string, private joinCode: string, private transport: EvalTransport, options: SessionPoolOptions = {}) {
    this.checksPerSession = options.checksPerSession ?? 40;
    this.maxJoinsPerMinute = options.maxJoinsPerMinute ?? 9;
    this.minRemainingMs = options.minRemainingMs ?? 20_000;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 10_000;
  }

  async current(): Promise<LiveSession> {
    const session = this.session;
    if (session && !session.closed && session.checks < this.checksPerSession && session.expiresAt - this.transport.now() > this.minRemainingMs) return session;
    await this.rotate();
    return this.session!;
  }

  async rotate(): Promise<void> {
    await this.end();
    this.session = await this.join();
  }

  /** Closes the stream and deletes the session. Failures are ignored: the server expires it anyway. */
  async end(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    if (!session) return;
    session.closed = true;
    try { session.socket.close(); } catch { /* already closed */ }
    try {
      const response = await this.transport.fetch(`${this.serverUrl}/v1/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${session.token}` } });
      await response.body?.cancel();
    } catch { /* best effort */ }
  }

  private async throttleJoin() {
    for (;;) {
      const now = this.transport.now();
      this.joinTimes = this.joinTimes.filter(time => now - time < 60_000);
      if (this.joinTimes.length < this.maxJoinsPerMinute) { this.joinTimes.push(now); return; }
      await this.transport.sleep(this.joinTimes[0] + 60_000 - now + 50);
    }
  }

  private async join(): Promise<LiveSession> {
    for (let attempt = 0; ; attempt++) {
      await this.throttleJoin();
      let response: Response;
      try {
        response = await this.transport.fetch(`${this.serverUrl}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode: this.joinCode }) });
      } catch { throw new EvalStop('server_unreachable'); }
      if (response.status === 429 && attempt < 2) { await response.body?.cancel(); await this.transport.sleep(61_000); continue; }
      if (response.status === 401) { await response.body?.cancel(); throw new EvalStop('join_unauthorized'); }
      if (response.status !== 201) throw new EvalStop(`join_failed_${response.status}`);
      const created = sessionResponseSchema.safeParse(await response.json());
      if (!created.success) throw new EvalStop('join_malformed');
      this.joins++;
      return this.open(created.data);
    }
  }

  private async open(created: z.infer<typeof sessionResponseSchema>): Promise<LiveSession> {
    const url = `${this.serverUrl.replace(/^http/, 'ws')}/v1/sessions/${encodeURIComponent(created.sessionId)}/stream`;
    const socket = this.transport.openSocket(url, created.token);
    const session: LiveSession = {
      id: created.sessionId, token: created.token, epoch: created.sessionEpoch, expiresAt: Date.parse(created.expiresAt) || this.transport.now() + 300_000,
      socket, checks: 0, closed: false, listeners: new Set(),
    };
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new EvalStop('stream_not_ready')), this.readyTimeoutMs);
      timer.unref?.();
      const done = (error?: EvalStop) => { clearTimeout(timer); session.listeners.delete(onEvent); if (error) reject(error); else resolve(); };
      const onEvent = (event: WireEvent | 'closed') => {
        if (event === 'closed') { done(new EvalStop('stream_closed')); return; }
        if (event.type !== 'session.ready') return;
        const active = (event.payload as { active?: unknown } | null)?.active;
        if (active === false) { socket.send(JSON.stringify({ type: 'session.resume', sessionEpoch: session.epoch })); return; }
        done();
      };
      session.listeners.add(onEvent);
    });
    socket.on('message', data => {
      const text = decode(data);
      if (text === null) return;
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return; }
      const event = wireEventSchema.safeParse(parsed);
      if (!event.success) return;
      if (event.data.type === 'session.ready' && typeof event.data.sessionEpoch === 'number') session.epoch = event.data.sessionEpoch;
      for (const listener of [...session.listeners]) listener(event.data);
    });
    const closed = () => {
      if (session.closed && session.listeners.size === 0) return;
      session.closed = true;
      for (const listener of [...session.listeners]) listener('closed');
    };
    socket.on('close', closed);
    socket.on('error', closed);
    try { await ready; } catch (error) { session.closed = true; try { socket.close(); } catch { /* ignore */ } throw error; }
    return session;
  }
}

/** The text-input body for a case, exactly as the contract's textInputSchema expects. */
export function checkInput(sample: EvalCase, session: { id: string; epoch: number }, requestId: string, capturedAt: string, withLowConfidenceWords = true) {
  const words = withLowConfidenceWords && sample.lowConfidenceWords?.length ? { lowConfidenceWords: sample.lowConfidenceWords } : {};
  return {
    schemaVersion: 1, requestId, sessionId: session.id, sessionEpoch: session.epoch, revision: 1, mode: sample.mode, text: sample.text,
    language: 'en', capturedAt,
    capture: { source: sample.mode === 'audio' ? 'recorded_fixture' : 'typed_fixture', segmentId: requestId, confidence: sample.confidence, final: true, ...words },
    context: sample.context, userInitiated: true,
  };
}

type Waiter = { promise: Promise<{ terminal: Terminal; at: number }>; cancel(): void };
/**
 * Resolves on the request's first terminal event: a claim.result (the first claim's, `…-claim-0`, when there are
 * two), claim.skipped, claim.needs_confirmation, pipeline.error or check.cancelled; or on timeout or a closed stream.
 */
function waitForTerminal(session: LiveSession, requestId: string, timeoutMs: number, now: () => number): Waiter {
  let cancel = () => {};
  const promise = new Promise<{ terminal: Terminal; at: number }>(resolve => {
    // A later claim's result, kept in case the first claim never answers.
    let fallback: { terminal: Terminal; at: number } | undefined;
    const finish = (terminal: Terminal) => {
      cancel();
      resolve(fallback && terminal.type !== 'claim.result' ? fallback : { terminal, at: now() });
    };
    const isFirstClaim = (claimId?: string) => claimId === undefined || claimId.endsWith('-claim-0');
    const onEvent = (event: WireEvent | 'closed') => {
      if (event === 'closed') { finish({ type: 'transport_error', reasonCode: 'stream_closed' }); return; }
      if (event.requestId !== requestId || (event.revision !== undefined && event.revision !== 1)) return;
      if (event.type === 'claim.result') {
        if (isFirstClaim(event.claimId)) finish({ type: 'claim.result', payload: event.payload });
        else fallback ??= { terminal: { type: 'claim.result', payload: event.payload }, at: now() };
      } else if (event.type === 'claim.skipped' || event.type === 'claim.needs_confirmation' || event.type === 'pipeline.error') {
        // A later claim's own skip or error does not end the request; the first claim's, or the request's, does.
        if (isFirstClaim(event.claimId)) finish({ type: event.type, payload: event.payload });
      } else if (event.type === 'check.cancelled') {
        finish({ type: 'check.cancelled', payload: event.payload });
      }
    };
    // Events and the timer can only fire after this executor returns, so `timer` is set before cancel runs.
    cancel = () => { clearTimeout(timer); session.listeners.delete(onEvent); };
    const timer = setTimeout(() => finish({ type: 'timeout', reasonCode: 'timeout' }), timeoutMs);
    timer.unref?.();
    session.listeners.add(onEvent);
  });
  return { promise, cancel: () => cancel() };
}

const usageOf = (terminal: Terminal) => {
  if (!('payload' in terminal)) return { jevCalls: null, exaSearches: null };
  const usage = usageSchema.safeParse((terminal.payload as { usage?: unknown } | null)?.usage);
  return usage.success ? { jevCalls: usage.data.jevCalls, exaSearches: usage.data.exaSearches } : { jevCalls: null, exaSearches: null };
};

export type RunOptions = { timeoutMs?: number; runId?: string };
/** Sends one case as an explicit request and scores how it ended. Latency is measured here, on the client. */
export async function runCheck(pool: SessionPool, transport: EvalTransport, sample: EvalCase, index: number, options: RunOptions = {}): Promise<EvalRow> {
  const base = { set: sample.set, id: sample.id, expected: sample.expected };
  const failed = (reasonCode: string): EvalRow => ({ ...base, predicted: 'error', reasonCode, latencyMs: null, jevCalls: null, exaSearches: null });
  const length = codePoints(sample.text).length;
  if (length === 0 || length > 800) return failed('input_too_long');
  const timeoutMs = options.timeoutMs ?? 15_000;
  const requestId = `${options.runId ?? 'eval'}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await pool.current();
    const waiter = waitForTerminal(session, requestId, timeoutMs, transport.now);
    const started = transport.now();
    const post = (withWords: boolean) => transport.fetch(`${pool.serverUrl}/v1/sessions/${encodeURIComponent(session.id)}/checks`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
      body: JSON.stringify(checkInput(sample, session, requestId, new Date(transport.now()).toISOString(), withWords)),
    });
    let response: Response;
    let fieldUnsupported = false;
    try {
      response = await post(true);
      // A server from before lowConfidenceWords rejects the field: send the case once more without it.
      if (response.status === 400 && sample.lowConfidenceWords?.length && await errorCode(response) === 'invalid_request') {
        fieldUnsupported = true;
        response = await post(false);
      }
    } catch { waiter.cancel(); return failed('http_unreachable'); }
    if (response.status === 401) { waiter.cancel(); await response.body?.cancel(); await pool.rotate(); continue; }
    session.checks++;
    if (response.status !== 202) {
      waiter.cancel();
      const code = await errorCode(response);
      return { ...failed(`http_${response.status}${code ? `_${code}` : ''}`.slice(0, 64)), ...(fieldUnsupported ? { fieldUnsupported } : {}) };
    }
    await response.body?.cancel();
    const { terminal, at } = await waiter.promise;
    if (terminal.type === 'timeout') {
      // Free the session's slot: a late result is ignored anyway.
      try {
        const cancelled = await transport.fetch(`${pool.serverUrl}/v1/sessions/${encodeURIComponent(session.id)}/checks/${encodeURIComponent(requestId)}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${session.token}` } });
        await cancelled.body?.cancel();
      } catch { /* best effort */ }
    }
    const { label, reasonCode } = labelTerminal(terminal);
    return {
      ...base, predicted: label, reasonCode, latencyMs: terminal.type === 'transport_error' ? null : Math.max(0, at - started), ...usageOf(terminal),
      ...(fieldUnsupported ? { fieldUnsupported } : {}),
    };
  }
  return failed('unauthorized');
}

export type EvaluationOptions = {
  server: string; joinCode: string; transport?: EvalTransport; delayMs?: number; timeoutMs?: number; pool?: SessionPoolOptions;
  /** One progress line per check: ids and labels only, never input text. */
  log?: (line: string) => void;
};
/** Runs the cases one after another, 250 ms apart. Returns completed rows; an EvalStop carries the rows so far. */
export async function runEvaluation(cases: EvalCase[], options: EvaluationOptions): Promise<{ rows: EvalRow[]; stopped: string | null; joins: number }> {
  const transport = options.transport ?? nodeTransport();
  const server = options.server.replace(/\/+$/, '');
  const pool = new SessionPool(server, options.joinCode, transport, options.pool);
  const runId = `ev${randomBytes(3).toString('hex')}`;
  const rows: EvalRow[] = [];
  let stopped: string | null = null;
  try {
    for (const [index, sample] of cases.entries()) {
      if (index > 0) await transport.sleep(options.delayMs ?? 250);
      const row = await runCheck(pool, transport, sample, index, { timeoutMs: options.timeoutMs, runId });
      rows.push(row);
      options.log?.(`[${sample.set} ${index + 1}/${cases.length}] ${sample.id} expected ${row.expected} got ${row.predicted}${row.reasonCode ? ` (${row.reasonCode})` : ''} ${row.latencyMs ?? '-'}ms`);
    }
  } catch (error) {
    if (!(error instanceof EvalStop)) throw error;
    stopped = error.code;
  } finally {
    await pool.end();
  }
  return { rows, stopped, joins: pool.joins };
}
