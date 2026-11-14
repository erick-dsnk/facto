import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PipelineError, type ClaimResult, type EventEnvelope, type EventType, type Preferences, type TextInput } from '../../../../packages/contracts/src/index.js';
import { AttemptBudget } from './budget.js';

export type RequestRecord = {
  input: TextInput; fingerprint: string; budget: AttemptBudget; controller: AbortController; acceptedAt: number; acceptedMonotonic: number;
  state: 'queued' | 'running' | 'waiting' | 'done' | 'cancelled'; continuationCount: number;
  results: Map<string, ClaimResult>; timer?: ReturnType<typeof setTimeout>;
};
export class Session {
  id = randomUUID();
  token = randomBytes(32).toString('base64url');
  epoch = 1;
  sequence = 0;
  active = true;
  running = 0;
  expiresAt: number;
  lastAutomaticAt = -Infinity;
  requests = new Map<string, RequestRecord>();
  notifications: number[] = [];
  recentClaims = new Map<string, number>();
  cache = new Map<string, { result: ClaimResult; expiresAt: number }>();
  preferences: Preferences = { muted: false, automaticNotifications: false, selectedTopics: [] };
  listeners = new Set<(event: EventEnvelope) => void>();
  constructor(public now: () => number, lifetimeMs = 300_000) { this.expiresAt = now() + lifetimeMs; }
  emit(type: EventType, payload: unknown, input?: TextInput, claimId?: string) {
    const event: EventEnvelope = { schemaVersion: 1, eventId: randomUUID(), eventSeq: ++this.sequence, sessionId: this.id, sessionEpoch: this.epoch, type, serverAt: new Date(this.now()).toISOString(), payload };
    if (input) { event.requestId = input.requestId; event.revision = input.revision; }
    if (claimId) event.claimId = claimId;
    for (const listener of this.listeners) listener(event);
  }
  current(record: RequestRecord) {
    return this.active && this.now() < this.expiresAt && record.input.sessionEpoch === this.epoch && this.requests.get(record.input.requestId) === record && !record.controller.signal.aborted;
  }
  cancel(requestId: string) {
    const record = this.requests.get(requestId);
    if (!record || record.state === 'cancelled' || record.controller.signal.aborted) return;
    clearTimeout(record.timer); record.state = 'cancelled'; record.controller.abort(new PipelineError('cancelled'));
    record.results.clear();
    this.emit('check.cancelled', { reasonCode: 'cancelled' }, record.input);
  }
  pause(reason = 'paused') {
    if (!this.active) return;
    this.active = false;
    for (const record of this.requests.values()) { clearTimeout(record.timer); record.controller.abort(new PipelineError('cancelled')); record.results.clear(); }
    // Keep only bounded request budgets/tombstones, so revisions cannot reset attempts.
    for (const record of this.requests.values()) { record.state = 'cancelled'; record.input = { ...record.input, text: '', context: [] }; }
    this.cache.clear(); this.recentClaims.clear(); this.notifications = [];
    this.epoch++; this.sequence = 0;
    this.emit('session.ended', { reasonCode: reason, active: false });
  }
}
export class SessionStore {
  sessions = new Map<string, Session>();
  constructor(public now: () => number = Date.now) {}
  create() {
    this.sweep();
    if (this.sessions.size >= 100) throw new PipelineError('session_capacity');
    const session = new Session(this.now); this.sessions.set(session.id, session); return session;
  }
  authenticate(id: string, token: string | undefined) {
    const session = this.sessions.get(id);
    if (session && session.expiresAt <= this.now()) this.delete(id);
    if (!session || session.expiresAt <= this.now() || !token || !equalSecret(token, session.token)) throw new PipelineError('unauthorized');
    return session;
  }
  delete(id: string) {
    const session = this.sessions.get(id); if (!session) return;
    if (session.active) session.pause('deleted');
    else session.emit('session.ended', { reasonCode: 'deleted', active: false });
    session.token = ''; session.requests.clear(); session.listeners.clear(); this.sessions.delete(id);
  }
  sweep() { for (const [id, session] of this.sessions) if (session.expiresAt <= this.now()) this.delete(id); }
}
export function equalSecret(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export const fingerprint = (input: TextInput) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
