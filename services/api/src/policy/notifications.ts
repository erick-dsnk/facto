import type { AdmissionMetadata, Preferences, Presentation, PresentationState, VerdictDecision } from '../../../../packages/contracts/src/index.js';

export type PresentationResult = Pick<VerdictDecision, 'verdict'> & { admission?: AdmissionMetadata };
const silent = (reasonCode: string): Presentation => ({ action: 'silent', reasonCode });

/** State comes from the runtime. This policy never mutates counters or history. */
export function decidePresentation(
  result: PresentationResult,
  intent: 'manual' | 'automatic' | 'repeat',
  state: PresentationState,
  preferences: Preferences,
): Presentation {
  if (!state.active) return silent('session_inactive');
  if (!state.current) return silent('superseded');
  if (state.expired) return silent('expired');
  if (preferences.muted) return silent('muted');
  // An intentional Repeat is a fresh delivery request. Transport retry suppression
  // belongs to runtime event IDs, not to this claim-text duplicate flag.
  if (state.duplicate && intent !== 'repeat') return silent('duplicate');
  if (intent === 'manual' || intent === 'repeat') return { action: 'respond', reasonCode: intent === 'repeat' ? 'explicit_repeat' : 'explicit_request' };
  if (!state.healthy) return silent('service_unhealthy');
  if (!preferences.automaticNotifications) return silent('notifications_disabled');
  if (result.verdict !== 'contradicted') return silent('automatic_noncontradiction');
  if (result.admission?.admissionAction !== 'check' || result.admission.assertionStatus !== 'asserted') return silent('unresolved_admission');
  const priority = result.admission.hasPracticalConsequence;
  const selectedTopic = result.admission.matchedSelectedTopic;
  const relevant = (priority !== null && Number.isFinite(priority) && priority >= 0.8 && priority <= 1)
    || (selectedTopic !== null && preferences.selectedTopics.includes(selectedTopic));
  if (!relevant) return silent('insufficient_priority');
  if (!Number.isFinite(state.notificationCount) || state.notificationCount < 0 || state.notificationCount >= 3) return silent('notification_budget');
  return { action: 'notify', reasonCode: selectedTopic !== null && preferences.selectedTopics.includes(selectedTopic) ? 'selected_topic_contradiction' : 'practical_contradiction' };
}
