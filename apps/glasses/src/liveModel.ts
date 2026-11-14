import type { ClaimResult, DisplaySnapshot, DisplayState, EventEnvelope } from '../../../packages/contracts/src/index.js';
import { claimResultSchema, claimSourcesSchema, displaySnapshotSchema, eventEnvelopeSchema } from '../../../packages/contracts/src/wire.js';

export type LiveModel = {
  sessionEpoch: number; eventSeq: number; active: boolean; expiresAt: string | null;
  state: DisplayState | null; restored: boolean; ready: boolean; modeKnown: boolean;
  revisions: Record<string, number>; blocked: Record<string, number>;
};
export const emptyLiveModel = (): LiveModel => ({ sessionEpoch: 0, eventSeq: 0, active: false, expiresAt: null, state: null, restored: false, ready: false, modeKnown: false, revisions: {}, blocked: {} });
const visibleResult = (result: ClaimResult | undefined, now: number) => !!result && result.presentation.action !== 'silent' && Date.parse(result.expiresAt) > now;
function visibleState(state: DisplayState | null, now: number): DisplayState | null {
  if (!state) return null;
  if (state.phase === 'checking') return state.userInitiated ? state : null;
  return visibleResult(state.result, now) ? state : null;
}
const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const correlated = (event: EventEnvelope) => !!event.requestId && !!event.claimId && !!event.revision;
const matches = (state: DisplayState | null, event: EventEnvelope) => !!state && state.requestId === event.requestId && (!event.claimId || state.claimId === event.claimId) && state.revision === event.revision;

/** Read-only projection. Every frame is validated before it can reach the HUD. */
export function reduceDisplay(model: LiveModel, raw: unknown, sessionId: string, now = Date.now()): LiveModel {
  if (record(raw)?.type === 'display.snapshot') {
    const parsed = displaySnapshotSchema.safeParse(raw);
    if (!parsed.success) return model;
    const snapshot: DisplaySnapshot = parsed.data;
    if (snapshot.sessionId !== sessionId || snapshot.sessionEpoch < model.sessionEpoch || snapshot.sessionEpoch === model.sessionEpoch && snapshot.eventSeq < model.eventSeq) return model;
    const state = snapshot.active && Date.parse(snapshot.expiresAt) > now ? visibleState(snapshot.state, now) : null;
    return { sessionEpoch: snapshot.sessionEpoch, eventSeq: snapshot.eventSeq, active: snapshot.active && Date.parse(snapshot.expiresAt) > now, expiresAt: snapshot.expiresAt, state, restored: true, ready: true, modeKnown: true,
      revisions: state ? { [state.requestId]: state.revision } : {}, blocked: {} };
  }
  const parsed = eventEnvelopeSchema.safeParse(raw);
  if (!parsed.success || !model.ready) return model;
  const event = parsed.data;
  if (event.sessionId !== sessionId || event.sessionEpoch < model.sessionEpoch || event.sessionEpoch === model.sessionEpoch && event.eventSeq <= model.eventSeq) return model;
  const next: LiveModel = event.sessionEpoch > model.sessionEpoch
    ? { ...emptyLiveModel(), ready: true, sessionEpoch: event.sessionEpoch, eventSeq: event.eventSeq, expiresAt: model.expiresAt }
    : { ...model, eventSeq: event.eventSeq };
  if (event.type === 'session.ended') return { ...next, active: false, state: null };
  const payload = record(event.payload);
  if (event.type === 'session.ready') return { ...next, active: payload?.active === true, state: payload?.active === true ? next.state : null };
  if (!next.active || next.expiresAt && Date.parse(next.expiresAt) <= now) return { ...next, state: null };
  const requestId = event.requestId;
  const revision = event.revision;
  if (requestId && revision && (revision < (next.revisions[requestId] ?? 0) || revision <= (next.blocked[requestId] ?? 0))) return next;
  if (event.type === 'claim.checking' && correlated(event)) {
    if (typeof payload?.claimText !== 'string' || Array.from(payload.claimText).length > 800 || !['ocr', 'audio', 'typed'].includes(String(payload.mode)) || typeof payload.userInitiated !== 'boolean') return next;
    const state: DisplayState = { requestId: requestId!, claimId: event.claimId!, revision: revision!, claimText: payload.claimText, mode: payload.mode as DisplayState['mode'], userInitiated: payload.userInitiated, phase: 'checking', sources: [] };
    return { ...next, restored: false, modeKnown: true, state: visibleState(state, now), revisions: { ...next.revisions, [requestId!]: revision! } };
  }
  if (event.type === 'claim.sources' && matches(next.state, event) && next.state?.phase === 'checking') {
    const sources = claimSourcesSchema.safeParse(event.payload);
    return sources.success ? { ...next, state: { ...next.state, sources: sources.data.sources } } : next;
  }
  if (event.type === 'claim.result' && correlated(event)) {
    const result = claimResultSchema.safeParse(event.payload);
    if (!result.success || next.state?.phase === 'checking' && !matches(next.state, event)) return next;
    const prior = matches(next.state, event) ? next.state : null;
    const state: DisplayState = { requestId: requestId!, claimId: event.claimId!, revision: revision!, claimText: result.data.checkedText, mode: prior?.mode ?? 'typed', userInitiated: prior?.userInitiated ?? false, phase: 'result', sources: prior?.sources ?? [], result: result.data };
    return { ...next, restored: false, modeKnown: !!prior && next.modeKnown, state: visibleState(state, now), revisions: { ...next.revisions, [requestId!]: revision! } };
  }
  if (['claim.superseded', 'check.cancelled', 'claim.skipped', 'pipeline.error'].includes(event.type) && requestId && revision) {
    return { ...next, state: next.state?.requestId === requestId && next.state.revision <= revision ? null : next.state, blocked: { ...next.blocked, [requestId]: revision } };
  }
  return next;
}

export function clearDisplay(model: LiveModel): LiveModel { return { ...model, active: false, state: null, ready: false }; }
export function expireDisplay(model: LiveModel, now: number): LiveModel {
  if (model.expiresAt && Date.parse(model.expiresAt) <= now) return { ...model, active: false, state: null };
  return model.state?.phase === 'result' && !visibleResult(model.state.result, now) ? { ...model, state: null } : model;
}
