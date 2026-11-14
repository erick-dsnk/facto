import { describe, expect, it } from 'vitest';
import fixtures from '../../../../fixtures/actions/presentation-cases.json' with { type: 'json' };
import type { AdmissionMetadata, Preferences, PresentationState, Verdict } from '../../../../packages/contracts/src/index.js';
import { decidePresentation, matchSelectedTopic } from './notifications.js';

const state: PresentationState = { active: true, healthy: true, current: true, expired: false, duplicate: false, notificationCount: 0 };
const preferences: Preferences = { muted: false, automaticNotifications: true, selectedTopics: [] };

describe('literal selected-topic matching', () => {
  it('normalizes Unicode, case and whitespace while preserving the enabled preference value', () => {
    expect(matchSelectedTopic('CAFÉ\n prices rose.', [' Café '])).toBe(' Café ');
    expect(matchSelectedTopic('Cafe\u0301 prices rose.', ['café'])).toBe('café');
    expect(matchSelectedTopic('ＬＩＧＨＴＮＩＮＧ never strikes twice.', ['lightning'])).toBe('lightning');
    expect(matchSelectedTopic('The Eiffel\n Tower opened in 1889.', ['Eiffel Tower'])).toBe('Eiffel Tower');
  });

  it.each(['smart', 'artistic', 'art2', 'art\u0301', 'art_name', '𐐀art', 'art𐐀', 'артart', '2art'])('does not match part of a Unicode token: %s', text => {
    expect(matchSelectedTopic(text, ['art'])).toBeNull();
  });

  it('matches whole phrases with boundaries, checking later occurrences after a partial match', () => {
    expect(matchSelectedTopic('Earthquake, then Earth.', ['earth'])).toBe('earth');
    expect(matchSelectedTopic('(Climate change) is discussed.', ['climate change'])).toBe('climate change');
    expect(matchSelectedTopic('Climate, change and weather.', ['climate change'])).toBeNull();
  });

  it('requires an enabled nonempty textual phrase and does not infer semantic categories or topic IDs', () => {
    expect(matchSelectedTopic('Lightning strikes the same place twice.', [])).toBeNull();
    expect(matchSelectedTopic('Lightning strikes the same place twice.', ['weather', 'topic_123', '', '  ', '.', '⚡', '\u0301'])).toBeNull();
    expect(matchSelectedTopic('art is discussed.', ['art', 'discussed'])).toBe('art');
  });
});

/** Rows of the shared presentation fixture that the Q2 notification table supersedes: overheard Misleading now
 * alerts. The fixture file lives outside this builder's files; update it with this table at integration. */
const SUPERSEDED: Record<string, { action: string; reasonCode: string }> = {
  'automatic-misleading': { action: 'notify', reasonCode: 'automatic_misleading' },
};
const admitted: AdmissionMetadata = { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'public_claim', hasPracticalConsequence: null, matchedSelectedTopic: null };

describe('independent presentation policy', () => {
  for (const fixture of fixtures) it(fixture.id, () => {
    const admission: AdmissionMetadata = { assertionStatus: 'asserted', admissionAction: (fixture.admissionAction ?? 'check') as AdmissionMetadata['admissionAction'], reasonCode: 'public_claim', hasPracticalConsequence: fixture.priority ?? null, matchedSelectedTopic: fixture.topic ?? null };
    const actual = decidePresentation({ verdict: fixture.verdict as Verdict, admission }, fixture.intent as 'manual' | 'automatic' | 'repeat', { ...state, ...fixture.state }, { ...preferences, ...fixture.preferences });
    expect(actual).toEqual(SUPERSEDED[fixture.id] ?? { action: fixture.expected, reasonCode: fixture.reason });
  });
  it.each([
    // Q2: asked always answers; overheard only False, Misleading and Speculation alert.
    ['supported', 'manual', 'respond', 'explicit_request'],
    ['insufficient_evidence', 'manual', 'respond', 'explicit_request'],
    ['speculation', 'manual', 'respond', 'explicit_request'],
    ['contradicted', 'automatic', 'notify', 'automatic_contradiction'],
    ['misleading', 'automatic', 'notify', 'automatic_misleading'],
    ['speculation', 'automatic', 'notify', 'automatic_speculation'],
    ['supported', 'automatic', 'silent', 'automatic_noncontradiction'],
    ['insufficient_evidence', 'automatic', 'silent', 'automatic_noncontradiction'],
  ] as const)('follows the Q2 table: %s %s -> %s', (verdict, intent, action, reasonCode) => {
    expect(decidePresentation({ verdict, admission: admitted }, intent, state, preferences)).toEqual({ action, reasonCode });
  });
  it.each(['misleading', 'speculation'] as const)('keeps the opt-in, mute, duplicate and admission gates for overheard %s', verdict => {
    expect(decidePresentation({ verdict, admission: admitted }, 'automatic', state, { ...preferences, automaticNotifications: false })).toEqual({ action: 'silent', reasonCode: 'notifications_disabled' });
    expect(decidePresentation({ verdict, admission: admitted }, 'automatic', state, { ...preferences, muted: true })).toEqual({ action: 'silent', reasonCode: 'muted' });
    expect(decidePresentation({ verdict, admission: admitted }, 'automatic', { ...state, duplicate: true }, preferences)).toEqual({ action: 'silent', reasonCode: 'duplicate' });
    expect(decidePresentation({ verdict }, 'automatic', state, preferences)).toEqual({ action: 'silent', reasonCode: 'unresolved_admission' });
  });
  it('fails closed without admission metadata and never mutates runtime state', () => {
    const before = structuredClone(state);
    expect(decidePresentation({ verdict: 'contradicted' }, 'automatic', state, preferences)).toEqual({ action: 'silent', reasonCode: 'unresolved_admission' });
    expect(state).toEqual(before);
  });
  it('never labels unbounded or non-finite model priority as practical', () => {
    for (const priority of [NaN, Infinity, 5]) {
      expect(decidePresentation({ verdict: 'contradicted', admission: { assertionStatus: 'asserted', admissionAction: 'check', reasonCode: 'public_claim', hasPracticalConsequence: priority, matchedSelectedTopic: null } }, 'automatic', state, preferences)).toEqual({ action: 'notify', reasonCode: 'automatic_contradiction' });
    }
  });
});
