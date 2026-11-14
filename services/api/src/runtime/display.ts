import type { DisplayState, EventEnvelope } from '../../../../packages/contracts/src/index.js';
import { claimResultSchema, claimSourcesSchema } from '../../../../packages/contracts/src/wire.js';

/** One bounded HUD projection. No transcript/audio/capture events enter this state. */
export function projectDisplay(state: DisplayState | null, event: EventEnvelope): DisplayState | null {
  const matches = state && state.requestId === event.requestId && state.revision === event.revision && (!event.claimId || state.claimId === event.claimId);
  if (event.type === 'session.ended') return null;
  if (['claim.superseded', 'check.cancelled', 'pipeline.error', 'claim.skipped'].includes(event.type)) return matches ? null : state;
  if (event.type === 'claim.checking') {
    const payload = event.payload as { userInitiated?: boolean; claimText?: string; mode?: DisplayState['mode'] };
    if (!payload.userInitiated || !event.requestId || !event.claimId || !event.revision || !payload.claimText || !payload.mode) return state;
    return { requestId: event.requestId, claimId: event.claimId, revision: event.revision, claimText: Array.from(payload.claimText).slice(0, 800).join(''), mode: payload.mode, userInitiated: true, phase: 'checking', sources: [] };
  }
  if (event.type === 'claim.sources' && matches && state.claimId === event.claimId && state.phase === 'checking') {
    const parsed = claimSourcesSchema.safeParse(event.payload);
    return parsed.success ? { ...state, sources: parsed.data.sources } : state;
  }
  if (event.type === 'claim.result') {
    if (state?.phase === 'checking' && !matches) return state;
    const parsed = claimResultSchema.safeParse(event.payload);
    if (!parsed.success || parsed.data.presentation.action === 'silent' || !event.requestId || !event.claimId || !event.revision) return matches ? null : state;
    return { requestId: event.requestId, claimId: event.claimId, revision: event.revision, claimText: Array.from(parsed.data.checkedText).slice(0, 800).join(''), mode: matches ? state.mode : 'typed', userInitiated: matches ? state.userInitiated : false, phase: 'result', sources: matches ? state.sources : [], result: parsed.data };
  }
  return state;
}
export function displayEventVisible(event: EventEnvelope, state: DisplayState | null, previous: DisplayState | null): boolean {
  if (event.type === 'session.ended' || event.type === 'session.ready') return true;
  if (!['claim.checking', 'claim.sources', 'claim.result', 'claim.superseded', 'check.cancelled', 'pipeline.error', 'claim.skipped'].includes(event.type)) return false;
  if (event.type === 'claim.result') return !!state && state.requestId === event.requestId && state.revision === event.revision && state.phase === 'result' && (event.payload as { presentation?: { action: string } }).presentation?.action !== 'silent';
  return state !== previous;
}
