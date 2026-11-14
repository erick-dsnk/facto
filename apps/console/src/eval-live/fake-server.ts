// Test double for the eval driver: an in-memory server behind EvalTransport. No network, fake clock.
import type { EvalSocket, EvalTransport } from './driver.js';

type Listener = (...args: never[]) => void;
export class FakeSocket implements EvalSocket {
  private listeners = new Map<string, Listener[]>();
  sent: string[] = [];
  closed = false;
  constructor(public url: string, public token: string) {}
  on(event: string, listener: Listener) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  emit(event: string, ...args: unknown[]) { for (const listener of this.listeners.get(event) ?? []) (listener as (...values: unknown[]) => void)(...args); }
  send(data: string) { this.sent.push(data); }
  close() { if (this.closed) return; this.closed = true; this.emit('close'); }
  /** Delivers an event envelope on a later tick, like a real socket. */
  push(type: string, payload: unknown, extra: Record<string, unknown> = {}) {
    setImmediate(() => { if (!this.closed) this.emit('message', Buffer.from(JSON.stringify({ schemaVersion: 1, type, payload, sessionEpoch: 1, ...extra }))); });
  }
}

export type CheckBody = {
  requestId: string; sessionId: string; sessionEpoch: number; mode: string; text: string; context: string[]; userInitiated: boolean;
  capture: { source: string; confidence: number | null; lowConfidenceWords?: unknown[] };
};
export type FakeSession = { id: string; token: string; socket?: FakeSocket; checks: CheckBody[]; expiresAt: number; deleted: boolean };
export type CheckHandler = (body: CheckBody, session: FakeSession, server: FakeServer) => { status: number; error?: string } | void;
export type Call = { method: string; path: string; headers: Record<string, string>; body: string | null };

const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

/** Answers each check with a supported result for `-claim-0` unless a handler says otherwise. */
export const supportedResult: CheckHandler = (body, session) => {
  session.socket!.push('claim.result', { verdict: 'supported', reasonCode: 'supported_by_sources', summary: `Echo: ${body.text}`, checkedText: body.text },
    { requestId: body.requestId, claimId: `${body.requestId}-claim-0`, revision: 1 });
};

export class FakeServer {
  clock = 1_000_000;
  sessions = new Map<string, FakeSession>();
  calls: Call[] = [];
  sleeps: number[] = [];
  joinTimes: number[] = [];
  lifetimeMs = 300_000;
  joinStatus: number | null = null;
  constructor(public joinCode = 'join-code-123', public onCheck: CheckHandler = supportedResult) {}

  transport(): EvalTransport {
    return {
      fetch: (url, init) => this.handle(url, init),
      openSocket: (url, token) => {
        const id = /\/v1\/sessions\/([^/]+)\/stream$/.exec(new URL(url).pathname)?.[1] ?? '';
        const session = this.sessions.get(decodeURIComponent(id));
        const socket = new FakeSocket(url, token);
        if (session && session.token === token) { session.socket = socket; socket.push('session.ready', { active: true }); }
        else setImmediate(() => socket.close());
        return socket;
      },
      now: () => this.clock,
      sleep: async ms => { this.sleeps.push(ms); this.clock += ms; },
    };
  }

  private async handle(url: string, init: RequestInit): Promise<Response> {
    const { pathname } = new URL(url);
    const method = init.method ?? 'GET';
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]));
    const body = typeof init.body === 'string' ? init.body : null;
    this.calls.push({ method, path: pathname, headers, body });
    if (method === 'GET' && pathname === '/health') return json(200, { status: 'ok', mode: 'fixture' });
    if (method === 'POST' && pathname === '/v1/sessions') {
      this.joinTimes.push(this.clock);
      if (this.joinStatus) return json(this.joinStatus, { error: 'join_rate_limit' });
      if (JSON.parse(body ?? '{}').joinCode !== this.joinCode) return json(401, { error: 'unauthorized' });
      const id = `s${this.sessions.size + 1}`;
      const session: FakeSession = { id, token: `token-${id}`, checks: [], expiresAt: this.clock + this.lifetimeMs, deleted: false };
      this.sessions.set(id, session);
      return json(201, { schemaVersion: 1, sessionId: id, token: session.token, sessionEpoch: 1, expiresAt: new Date(session.expiresAt).toISOString() });
    }
    const match = /^\/v1\/sessions\/([^/]+)(\/checks(?:\/([^/]+)\/cancel)?)?$/.exec(pathname);
    const session = match ? this.sessions.get(match[1]) : undefined;
    if (!session || session.deleted || headers.authorization !== `Bearer ${session.token}` || session.expiresAt <= this.clock) return json(401, { error: 'unauthorized' });
    if (method === 'DELETE' && !match![2]) { session.deleted = true; return new Response(null, { status: 204 }); }
    if (method === 'POST' && match![3]) return new Response(null, { status: 204 });
    if (method === 'POST' && match![2]) {
      const check = JSON.parse(body ?? '{}') as CheckBody;
      const answer = this.onCheck(check, session, this);
      if (answer && answer.status !== 202) return json(answer.status, { error: answer.error ?? 'invalid_request' });
      session.checks.push(check);
      return json(202, { requestId: check.requestId, state: 'queued' });
    }
    return json(404, { error: 'not_found' });
  }
}
