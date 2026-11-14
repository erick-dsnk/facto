import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClaimResult, DisplaySnapshot, EventEnvelope } from '../../../packages/contracts/src/index.js';
import { clearDisplay, emptyLiveModel, expireDisplay, reduceDisplay } from './liveModel.js';
const fixtures = JSON.parse(readFileSync(new URL('../../../packages/contracts/fixtures/events.json', import.meta.url), 'utf8')) as EventEnvelope[];
const now = Date.parse('2026-11-14T10:00:00Z');
const result = fixtures[1].payload as ClaimResult;
const sessionId = 'session-fixture';
const snapshot = (state: DisplaySnapshot['state'] = null): DisplaySnapshot => ({ schemaVersion: 1, type: 'display.snapshot', sessionId, sessionEpoch: 1, eventSeq: 0, active: true, expiresAt: '2026-11-14T10:05:00Z', state });
const event = (type: EventEnvelope['type'], eventSeq: number, payload: unknown, overrides: Partial<EventEnvelope> = {}): EventEnvelope => ({ ...fixtures[0], type, eventSeq, payload, ...overrides });
const checking = (seq = 1, overrides: Partial<EventEnvelope> = {}, userInitiated = true) => event('claim.checking', seq, { admissionAction: 'check', reasonCode: 'eligible_public_claim', claimText: result.checkedText, mode: 'ocr', userInitiated }, overrides);
const ready = () => reduceDisplay(emptyLiveModel(), snapshot(), sessionId, now);
const source = { id: 'site-1', hostname: 'toureiffel.paris', title: 'Eiffel Tower', stage: 'found', provider: 'exa' };

describe('read-only display projection', () => {
  it('requires a validated snapshot before events and rejects wrong sessions/malformed frames', () => {
    const empty = emptyLiveModel();
    expect(reduceDisplay(empty, checking(), sessionId, now)).toBe(empty);
    expect(reduceDisplay(empty, { ...snapshot(), sessionId: 'other' }, sessionId, now)).toBe(empty);
    expect(reduceDisplay(empty, { ...snapshot(), state: { phase: 'result' } }, sessionId, now)).toBe(empty);
  });
  it('shows only manual checking and non-silent unexpired results', () => {
    const hidden = reduceDisplay(ready(), checking(1, {}, false), sessionId, now);
    expect(hidden.state).toBeNull();
    const pending = reduceDisplay(ready(), checking(), sessionId, now);
    expect(pending.state?.claimText).toBe(result.checkedText);
    expect(reduceDisplay(pending, event('claim.result', 2, { ...result, presentation: { action: 'silent', reasonCode: 'muted' } }), sessionId, now).state).toBeNull();
    expect(reduceDisplay(pending, event('claim.result', 2, result), sessionId, now).state?.result?.verdict).toBe('supported');
    expect(reduceDisplay(pending, event('claim.result', 2, result), sessionId, Date.parse(result.expiresAt)).state).toBeNull();
  });
  it('correlates source updates and results, and ignores duplicate sequence/stale revisions', () => {
    const pending = reduceDisplay(ready(), checking(1, { revision: 2 }), sessionId, now);
    const wrong = reduceDisplay(pending, event('claim.sources', 2, { sources: [source] }, { claimId: 'other', revision: 2 }), sessionId, now);
    expect(wrong.state?.sources).toEqual([]);
    const sources = reduceDisplay(wrong, event('claim.sources', 3, { sources: [source] }, { revision: 2 }), sessionId, now);
    expect(sources.state?.sources).toHaveLength(1);
    expect(reduceDisplay(sources, event('claim.sources', 3, { sources: [] }, { revision: 2 }), sessionId, now)).toBe(sources);
    expect(reduceDisplay(sources, event('claim.result', 4, result, { revision: 1 }), sessionId, now).state?.phase).toBe('checking');
    expect(reduceDisplay(sources, event('claim.result', 5, result, { claimId: 'other', revision: 2 }), sessionId, now).state?.phase).toBe('checking');
  });
  it('preserves current manual checking across a different request result, like the backend', () => {
    const first = reduceDisplay(ready(), checking(), sessionId, now);
    const second = reduceDisplay(first, checking(2, { requestId: 'request-b', claimId: 'claim-b' }), sessionId, now);
    const finishedFirst = reduceDisplay(second, event('claim.result', 3, result), sessionId, now);
    expect(finishedFirst.state?.requestId).toBe('request-b');
    expect(finishedFirst.state?.phase).toBe('checking');
    const currentSources = reduceDisplay(finishedFirst, event('claim.sources', 4, { sources: [source] }, { requestId: 'request-b', claimId: 'claim-b' }), sessionId, now);
    expect(currentSources.state?.sources).toHaveLength(1);
  });
  it('clears cancellation/supersession and prevents late results from returning', () => {
    for (const type of ['check.cancelled', 'claim.superseded', 'pipeline.error', 'claim.skipped'] as const) {
      const pending = reduceDisplay(ready(), checking(), sessionId, now);
      // claim.skipped always carries its admission fields (the envelope validates them); the others carry no required payload.
      const cleared = reduceDisplay(pending, event(type, 2, type === 'claim.skipped' ? { admissionAction: 'skip', reasonCode: 'stale_capture' } : {}), sessionId, now);
      expect(cleared.state).toBeNull();
      expect(reduceDisplay(cleared, event('claim.result', 3, result), sessionId, now).state).toBeNull();
      expect(reduceDisplay(cleared, checking(4, { revision: 2 }), sessionId, now).state?.revision).toBe(2);
    }
  });
  it('clears on newer epoch, pause, disconnect and expiry; reconnect replaces state without replay motion', () => {
    const pending = reduceDisplay(ready(), checking(), sessionId, now);
    expect(reduceDisplay(pending, checking(1, { sessionEpoch: 2 }), sessionId, now).state).toBeNull();
    const paused = reduceDisplay(pending, event('session.ready', 2, { active: false }), sessionId, now);
    expect(paused.state).toBeNull();
    const disconnected = clearDisplay(pending);
    expect(disconnected.state).toBeNull();
    expect(disconnected.ready).toBe(false);
    const restoredState = { ...pending.state!, phase: 'result' as const, result };
    const restored = reduceDisplay(disconnected, { ...snapshot(restoredState), eventSeq: 4 }, sessionId, now);
    expect(restored.state?.result).toEqual(result);
    expect(restored.restored).toBe(true);
    expect(expireDisplay(restored, Date.parse(result.expiresAt)).state).toBeNull();
    expect(expireDisplay(pending, Date.parse(snapshot().expiresAt)).active).toBe(false);
    expect(reduceDisplay(pending, event('session.ended', 2, {}), sessionId, now).state).toBeNull();
  });
});
