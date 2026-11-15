import type { ClaimFrame, ClaimRoute, Evidence, ResultDecision } from '../../../../packages/contracts/src/index.js';

/** A finished check as the shared cache keeps it: claim-level fields only, never the captured `originalText`,
 * its context or the session it came from. */
export type CachedDecision = ResultDecision & {
  checkedText: string; evidence: Evidence[]; route: ClaimRoute; subject: string | null; checkedAt: string;
};

const DAY_MS = 86_400_000;
const normalized = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();

/** Q9: one in-memory cache shared by every session, entries kept 24 hours, oldest dropped first past `max`. */
export class ClaimCache {
  private entries = new Map<string, { value: CachedDecision; expiresAt: number }>();
  constructor(private ttlMs = DAY_MS, private max = 2000, private now: () => number = Date.now) {}

  /** Lowercased and whitespace-collapsed claim, plus subject and the policy and model versions that decided it. */
  static key(checkedText: string, subject: string | null, policyVersion: string, modelVersion: string): string {
    return JSON.stringify([normalized(checkedText), subject === null ? null : normalized(subject), policyVersion, modelVersion]);
  }
  /** Weather answers change with the day and the forecast, and whether someone said something recently can change
   * within hours, so neither is kept. Private-life and missing-subject answers never needed a provider call. */
  static cacheable(frame: ClaimFrame): boolean {
    return frame.route !== 'weather' && !(frame.attribution && frame.route === 'recent_event') && !frame.privateLife && !frame.subjectMissing;
  }
  get size() { return this.entries.size; }
  get(key: string): CachedDecision | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) { this.entries.delete(key); return undefined; }
    return structuredClone(entry.value);
  }
  set(key: string, value: CachedDecision): void {
    // Copy the known claim-level fields so nothing else a caller passed (such as originalText) is retained.
    const kept: CachedDecision = {
      verdict: value.verdict, reasonCode: value.reasonCode, selectedEvidenceIds: [...value.selectedEvidenceIds], summary: value.summary,
      ...(value.basis ? { basis: value.basis } : {}), ...(value.attribution ? { attribution: { ...value.attribution } } : {}),
      checkedText: value.checkedText, evidence: structuredClone(value.evidence), route: value.route, subject: value.subject, checkedAt: value.checkedAt,
    };
    this.entries.delete(key);
    this.entries.set(key, { value: kept, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
  }
  clear() { this.entries.clear(); }
}
