import type { AdmissionMetadata, Preferences, Presentation, PresentationState, ResultDecision } from '../../../../packages/contracts/src/index.js';

export type PresentationResult = Pick<ResultDecision, 'verdict'> & { admission?: AdmissionMetadata };
const silent = (reasonCode: string): Presentation => ({ action: 'silent', reasonCode });

const normalizedPhrase = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const tokenEnd = /[\p{L}\p{N}\p{M}\p{Pc}]$/u;
const tokenStart = /^[\p{L}\p{N}\p{M}\p{Pc}]/u;

/** Literal enabled phrases only; call with an admitted public span, never context or rejected text. */
export function matchSelectedTopic(checkedText: string, selectedTopics: readonly string[]): string | null {
  const text = normalizedPhrase(checkedText);
  for (const topic of selectedTopics) {
    const phrase = normalizedPhrase(topic);
    if (!/[\p{L}\p{N}]/u.test(phrase)) continue;
    let start = text.indexOf(phrase);
    while (start !== -1) {
      const end = start + phrase.length;
      if (!tokenEnd.test(text.slice(0, start)) && !tokenStart.test(text.slice(end))) return topic;
      start = text.indexOf(phrase, start + 1);
    }
  }
  return null;
}

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
  // Overheard, only False, Misleading and Speculation alert (chime and card); True and Can't verify stay in history.
  if (result.verdict !== 'contradicted' && result.verdict !== 'misleading' && result.verdict !== 'speculation') return silent('automatic_noncontradiction');
  if (result.admission?.admissionAction !== 'check' || result.admission.assertionStatus !== 'asserted') return silent('unresolved_admission');
  if (result.verdict === 'misleading') return { action: 'notify', reasonCode: 'automatic_misleading' };
  if (result.verdict === 'speculation') return { action: 'notify', reasonCode: 'automatic_speculation' };
  // Every admitted, asserted contradiction alerts. Priority and selected topic only label the
  // reason; neither gates the alert, and there is no per-session alert budget.
  const priority = result.admission.hasPracticalConsequence;
  const selectedTopic = result.admission.matchedSelectedTopic;
  if (selectedTopic !== null && preferences.selectedTopics.includes(selectedTopic)) return { action: 'notify', reasonCode: 'selected_topic_contradiction' };
  if (priority !== null && Number.isFinite(priority) && priority >= 0.8 && priority <= 1) return { action: 'notify', reasonCode: 'practical_contradiction' };
  return { action: 'notify', reasonCode: 'automatic_contradiction' };
}
