import { performance } from 'node:perf_hooks';
import { MODEL_VERSION, POLICY_VERSION, PipelineError, type ClaimResult, type TextInput } from '../../../../packages/contracts/src/index.js';
import type { RuntimeAdapters } from './adapters.js';
import { retainAlternateEvidence } from './alternate-evidence.js';
import { decideVerdict } from '../policy/verdict.js';
import { decidePresentation, matchSelectedTopic } from '../policy/notifications.js';
import { AttemptBudget, abortable, assertWithinDeadline } from './budget.js';
import { fingerprint, type RequestRecord, type Session } from './session.js';
import { claimResultSchema } from '../../../../packages/contracts/src/wire.js';

type Job = { session: Session; record: RequestRecord };
export type RuntimeMetric = {
  durationMs: number; stageMs: { admission: number; retrieval: number; judgment: number };
  state: RequestRecord['state']; jevAttempts: number; searchAttempts: number; contentAttempts: number; inputTokens: number;
};
export class PipelineRuntime {
  private queue: Job[] = [];
  private running = 0;
  /** Bounded sanitized diagnostics; deliberately excludes input, queries, tokens and IDs. */
  readonly metrics: RuntimeMetric[] = [];
  constructor(private adapters: RuntimeAdapters, private now: () => number = Date.now, private monotonic: () => number = () => performance.now(), private modelVersion = MODEL_VERSION as string) {}

  submit(session: Session, input: TextInput) {
    if (!session.active || input.sessionEpoch !== session.epoch) throw new PipelineError('old_epoch');
    if (input.sessionId !== session.id) throw new PipelineError('wrong_session');
    const found = session.requests.get(input.requestId);
    const previous = found?.input.sessionEpoch === input.sessionEpoch ? found : undefined;
    const hash = fingerprint(input);
    if (previous && input.revision === previous.input.revision) {
      if (previous.fingerprint !== hash) throw new PipelineError('idempotency_conflict');
      return { requestId: input.requestId, duplicate: true };
    }
    if (previous && input.revision < previous.input.revision) throw new PipelineError('old_revision');
    if (!previous && session.requests.size >= 128) throw new PipelineError('request_capacity');
    if (!input.userInitiated && this.now() - Date.parse(input.capturedAt) > 15_000) throw new PipelineError('stale_capture');
    if (Date.parse(input.capturedAt) > this.now() + 5_000) throw new PipelineError('invalid_capture_time');
    if (!input.userInitiated && !previous && this.now() - session.lastAutomaticAt < 4_000) throw new PipelineError('automatic_cooldown');
    this.queue = this.queue.filter(job => job.session.current(job.record));
    if (this.queue.filter(job => job.session === session && job.record !== previous).length >= 3) throw new PipelineError('queue_full');
    const continuing = previous?.state === 'waiting';
    if (previous) {
      previous.controller.abort(new PipelineError('superseded')); clearTimeout(previous.timer);
      previous.state = 'cancelled';
      const presented = [...previous.results.values()].some(result => result.presentation.action !== 'silent');
      if (previous.results.size) session.emit('claim.superseded', { reasonCode: 'corrected', presentation: { action: presented && !session.preferences.muted && (previous.input.userInitiated || session.preferences.automaticNotifications) ? 'respond' : 'silent', reasonCode: 'correction_status' } }, previous.input);
      previous.results.clear();
    }
    // Revisions and continuations share the original deadline and attempt budget.
    const acceptedAt = previous?.acceptedAt ?? this.now();
    const acceptedMonotonic = previous?.acceptedMonotonic ?? this.monotonic();
    const record: RequestRecord = { input, fingerprint: hash, budget: previous?.budget ?? new AttemptBudget(), controller: new AbortController(), acceptedAt,
      acceptedMonotonic, state: 'queued', continuationCount: (previous?.continuationCount ?? 0) + (continuing ? 1 : 0), results: new Map() };
    session.requests.set(input.requestId, record);
    if (!input.userInitiated) session.lastAutomaticAt = this.now();
    record.timer = setTimeout(() => {
      if (!session.current(record) || record.state === 'done' || record.state === 'cancelled') return;
      if (record.state === 'waiting') {
        session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'wait_expired' }, input);
      } else this.error(session, record, 'timeout');
      record.state = 'done'; record.controller.abort(new PipelineError('timeout')); this.pump();
    }, Math.max(0, 10_000 - (this.now() - acceptedAt)));
    record.timer.unref();
    this.queue.push({ session, record }); this.pump();
    return { requestId: input.requestId, duplicate: false };
  }

  private pump() {
    this.queue = this.queue.filter(job => job.session.current(job.record) && job.record.state === 'queued');
    while (this.running < 4) {
      const index = this.queue.findIndex(job => job.session.running < 2);
      if (index < 0) return;
      const job = this.queue.splice(index, 1)[0];
      this.running++; job.session.running++; job.record.state = 'running';
      void this.run(job).finally(() => { this.running--; job.session.running--; this.pump(); });
    }
  }

  private error(session: Session, record: RequestRecord, reasonCode: string, claimId?: string) {
    if (session.current(record)) session.emit('pipeline.error', { reasonCode, message: 'The check didn’t finish.', presentation: { action: record.input.userInitiated && !session.preferences.muted ? 'respond' : 'silent', reasonCode: 'service_status' } }, record.input, claimId);
  }

  private async run({ session, record }: Job) {
    const { input } = record;
    const started = record.acceptedMonotonic;
    const ctx = record.budget.context(record.controller.signal, this.now, record.acceptedAt + 10_000);
    const stageMs = { admission: 0, retrieval: 0, judgment: 0 };
    const timed = async <T>(stage: keyof typeof stageMs, call: () => Promise<T>): Promise<T> => {
      const start = this.monotonic();
      try {
        assertWithinDeadline(ctx);
        const result = await abortable(call(), ctx.signal);
        assertWithinDeadline(ctx);
        return result;
      } catch (error) {
        assertWithinDeadline(ctx);
        throw error;
      } finally { stageMs[stage] += this.monotonic() - start; }
    };
    let currentClaimId: string | undefined;
    const stopIfStale = () => {
      if (input.userInitiated || this.now() - Date.parse(input.capturedAt) <= 15_000) return false;
      session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, input, currentClaimId);
      record.state = 'done'; return true;
    };
    try {
      if (!session.current(record)) return;
      assertWithinDeadline(ctx);
      if (!input.userInitiated && this.now() - Date.parse(input.capturedAt) > 15_000) {
        session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, input);
        record.state = 'done'; return;
      }
      session.emit('claim.detected', { mode: input.mode }, input);
      const admission = await timed('admission', () => this.adapters.classify(input, ctx));
      if (!session.current(record)) return;
      if (admission.action !== 'check') {
        if (admission.action === 'wait' && !input.userInitiated && record.continuationCount < 1) {
          record.state = 'waiting'; clearTimeout(record.timer);
          const remaining = Math.min(8_000, 10_000 - (this.now() - record.acceptedAt));
          session.emit('claim.waiting', { admissionAction: 'wait', reasonCode: admission.reasonCode, waitExpiresAt: new Date(this.now() + remaining).toISOString() }, input);
          record.timer = setTimeout(() => {
            if (!session.current(record)) return;
            record.state = 'done'; session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'wait_expired' }, input);
          }, Math.max(0, remaining)); record.timer.unref();
          return;
        }
        session.emit(admission.action === 'needs_confirmation' || (admission.action === 'wait' && input.userInitiated) ? 'claim.needs_confirmation' : 'claim.skipped',
          { admissionAction: 'skip', reasonCode: admission.reasonCode, presentation: { action: input.userInitiated && !session.preferences.muted ? 'respond' : 'silent', reasonCode: admission.reasonCode } }, input);
        record.state = 'done'; return;
      }
      if (admission.claims.length < 1 || admission.claims.length > 2) throw new PipelineError('malformed_admission');
      // Case and whitespace can change an admitted proposition (MW/mW, quoted identifiers).
      const cacheKey = (text: string) => JSON.stringify([text, input.context, input.language, input.mode, POLICY_VERSION, this.modelVersion]);
      for (const [index, candidate] of admission.claims.entries()) {
        // A correction must not mint fresh provider allowances through a new ID.
        const claim = { ...candidate, id: `${input.requestId}-claim-${index}` };
        currentClaimId = claim.id;
        if (!session.current(record)) return;
        if (!input.userInitiated && this.now() - Date.parse(input.capturedAt) > 15_000) {
          session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, input, claim.id);
          record.state = 'done'; return;
        }
        session.emit('claim.checking', { admissionAction: 'check', reasonCode: 'eligible_public_claim' }, input, claim.id);
        const key = cacheKey(claim.checkedText);
        // Notification identity is the complete admitted proposition, independent of
        // capture mode/context. Keep factual cache identity context-sensitive above.
        const notificationKey = claim.checkedText;
        const stored = session.cache.get(key);
        let result: ClaimResult;
        let freshResult: ClaimResult | undefined;
        if (stored && stored.expiresAt > this.now()) {
          result = { ...stored.result, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, cached: true, durationMs: this.monotonic() - started };
        } else {
          // Spend remaining capacity on useful current work, while protecting a
          // later span's first judgment whenever there is capacity for both.
          if (!ctx.canConsume('jev')) throw new PipelineError('jev_budget_exhausted');
          const laterUncached = admission.claims.slice(index + 1).filter(later => {
            const cached = session.cache.get(cacheKey(later.checkedText));
            // A near-expiry cache entry may disappear while this claim runs.
            return !cached || cached.expiresAt <= record.acceptedAt + 10_000;
          }).length;
          const reserved = Math.min(laterUncached, Math.max(0, 3 - record.budget.jev - 1));
          const claimContext = record.budget.context(record.controller.signal, this.now, record.acceptedAt + 10_000, reserved);
          const evidence = await timed('retrieval', () => this.adapters.retrieve(claim, claimContext));
          if (!session.current(record) || stopIfStale()) return;
          let judgment = evidence.length ? await timed('judgment', () => this.adapters.judge(claim, evidence, claimContext)) : {
            label: 'insufficient_evidence' as const, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 }, evidence: [], selectedEvidenceIds: [], misleadingReason: null
          };
          if (!session.current(record) || stopIfStale()) return;
          let decision = decideVerdict(judgment);
          if (decision.verdict === 'insufficient_evidence' && this.adapters.retrieveAlternate && !laterUncached
            && claimContext.canConsume('jev') && claimContext.canConsume('search', claim.id)
            && record.acceptedAt + 10_000 - this.now() >= 3_000) {
            const additional = await timed('retrieval', () => this.adapters.retrieveAlternate!(claim, claimContext));
            if (!session.current(record) || stopIfStale()) return;
            const combined = retainAlternateEvidence(evidence, additional, claim.checkedText, judgment);
            const identity = (records: typeof evidence) => JSON.stringify(records.map(source => [source.id, source.url, source.title, source.publisher, source.excerpt, source.publishedAt, source.contentBasis, source.sourceGroup, source.echoGroup]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
            if (combined.length && identity(combined) !== identity(evidence)) {
              // Never carry first-pass model assessments into a new evidence set.
              const raw = combined.map(source => ({ ...source, sourceRole: 'unknown' as const, directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated' as const, stanceProbability: 0 }));
              judgment = await timed('judgment', () => this.adapters.judge(claim, raw, claimContext));
              if (!session.current(record)) return;
              decision = decideVerdict(judgment);
            }
          }
          if (stopIfStale()) return;
          result = { ...decision, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, evidence: judgment.evidence,
            checkedAt: new Date(this.now()).toISOString(), expiresAt: new Date(Math.min(this.now() + 60_000, session.expiresAt)).toISOString(), durationMs: this.monotonic() - started,
            cached: false, policyVersion: POLICY_VERSION, modelVersion: this.modelVersion, presentation: { action: 'silent', reasonCode: 'pending' } };
          result = claimResultSchema.parse(result);
          freshResult = result;
        }
        session.notifications = session.notifications.filter(t => this.now() - t < 60_000);
        for (const [k, expires] of session.recentClaims) if (expires <= this.now()) session.recentClaims.delete(k);
        // Preferences may change while providers run or between factual cache hits.
        // Match only the admitted span at delivery time; never reuse topic metadata.
        const currentAdmission = { ...claim.admission, matchedSelectedTopic: matchSelectedTopic(claim.checkedText, session.preferences.selectedTopics) };
        result = { ...result, presentation: decidePresentation({ ...result, admission: currentAdmission }, input.userInitiated ? 'manual' : 'automatic', {
          active: session.active, healthy: true, current: session.current(record), expired: Date.parse(result.expiresAt) <= this.now(),
          duplicate: !input.userInitiated && session.recentClaims.has(notificationKey), notificationCount: session.notifications.length
        }, session.preferences) };
        if (!session.current(record)) return;
        assertWithinDeadline(ctx);
        if (freshResult) {
          session.cache.set(key, { result: freshResult, expiresAt: Date.parse(freshResult.expiresAt) });
          if (session.cache.size > 64) session.cache.delete(session.cache.keys().next().value!);
        }
        if (result.presentation.action === 'notify') { session.notifications.push(this.now()); session.recentClaims.set(notificationKey, this.now() + 60_000); }
        record.results.set(claim.id, result); session.emit('claim.result', result, input, claim.id);
      }
      record.state = 'done';
    } catch (error) {
      let failure = error;
      if (session.current(record)) {
        try { assertWithinDeadline(ctx); } catch (currentError) { failure = currentError; }
        this.error(session, record, failure instanceof PipelineError ? failure.code : 'provider_unavailable', currentClaimId);
      }
      if (record.state !== 'cancelled') record.state = 'done';
      if (failure instanceof PipelineError && failure.code === 'timeout') record.controller.abort(failure);
    } finally {
      if (record.state !== 'waiting') clearTimeout(record.timer);
      this.metrics.push({ durationMs: this.monotonic() - started, stageMs, state: record.state, jevAttempts: record.budget.jev,
        searchAttempts: [...record.budget.searches.values()].reduce((a, b) => a + b, 0), contentAttempts: [...record.budget.contents.values()].reduce((a, b) => a + b, 0), inputTokens: record.budget.inputTokens });
      if (this.metrics.length > 128) this.metrics.shift();
    }
  }
}
