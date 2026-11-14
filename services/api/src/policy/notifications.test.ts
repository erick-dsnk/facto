import { describe, expect, it } from 'vitest';
import fixtures from '../../../../fixtures/actions/presentation-cases.json' with { type: 'json' };
import type { AdmissionMetadata, Preferences, PresentationState, Verdict } from '../../../../packages/contracts/src/index.js';
import { decidePresentation } from './notifications.js';

const state: PresentationState = { active: true, healthy: true, current: true, expired: false, duplicate: false, notificationCount: 0 };
const preferences: Preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };

describe('independent presentation policy', () => {
  for (const fixture of fixtures) it(fixture.id, () => {
    const admission: AdmissionMetadata = { assertionStatus: 'asserted', admissionAction: (fixture.admissionAction ?? 'check') as AdmissionMetadata['admissionAction'], reasonCode: 'public_claim', hasPracticalConsequence: fixture.priority ?? null, matchedSelectedTopic: fixture.topic ?? null };
    const actual = decidePresentation({ verdict: fixture.verdict as Verdict, admission }, fixture.intent as 'manual' | 'automatic' | 'repeat', { ...state, ...fixture.state }, { ...preferences, ...fixture.preferences });
    expect(actual).toEqual({ action: fixture.expected, reasonCode: fixture.reason });
  });
  it('fails closed without admission metadata and never mutates runtime state', () => {
    const before = structuredClone(state);
    expect(decidePresentation({ verdict: 'contradicted' }, 'automatic', state, preferences)).toEqual({ action: 'silent', reasonCode: 'unresolved_admission' });
    expect(state).toEqual(before);
  });
  it('ignores unbounded or non-finite model priority', () => {
    for (const priority of [NaN, Infinity, 5]) {
      expect(decidePresentation({ verdict: 'contradicted', admission: { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'public_claim', hasPracticalConsequence: priority, matchedSelectedTopic: null } }, 'automatic', state, preferences).action).toBe('silent');
    }
  });
});
