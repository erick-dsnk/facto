import { performance } from 'node:perf_hooks';
import { MODEL_VERSION, POLICY_VERSION, PipelineError, type ClaimResult, type PipelineAdapters, type TextInput } from '../../../../packages/contracts/src/index.js';
import { decideVerdict } from '../policy/verdict.js';
import { decidePresentation, matchSelectedTopic } from '../policy/notifications.js';
import { AttemptBudget, abortable } from './budget.js';
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
  constructor(private adapters: PipelineAdapters, private now: () => number = Date.now, private monotonic: () => number = () => performance.now(), private modelVersion = MODEL_VERSION as string) {}

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
    const record: RequestRecord = { input, fingerprint: hash, budget: previous?.budget ?? new AttemptBudget(), controller: new AbortController(), acceptedAt,
      state: 'queued', continuationCount: (previous?.continuationCount ?? 0) + (continuing ? 1 : 0), results: new Map() };
    session.requests.set(input.requestId, record);
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

  private error(session: Session, record: RequestRecord, reasonCode: string) {
    if (session.current(record)) session.emit('pipeline.error', { reasonCode, message: 'The check didn’t finish.', presentation: { action: record.input.userInitiated && !session.preferences.muted ? 'respond' : 'silent', reasonCode: 'service_status' } }, record.input);
  }

  private async run({ session, record }: Job) {
    const { input } = record;
    const started = this.monotonic();
    const ctx = record.budget.context(record.controller.signal, this.now);
    const stageMs = { admission: 0, retrieval: 0, judgment: 0 };
    const timed = async <T>(stage: keyof typeof stageMs, call: () => Promise<T>): Promise<T> => {
      const start = this.monotonic();
      try { return await abortable(call(), ctx.signal); } finally { stageMs[stage] += this.monotonic() - start; }
    };
    try {
      if (!session.current(record)) return;
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
      // The automatic cooldown counts admitted claims (1 per 4 s), so filler or skipped sentences never block the next claim.
      if (!input.userInitiated) session.lastAutomaticAt = this.now();
      for (const [index, candidate] of admission.claims.entries()) {
        // A correction must not mint fresh provider allowances through a new ID.
        const claim = { ...candidate, id: `${input.requestId}-claim-${index}` };
        if (!session.current(record)) return;
        if (!input.userInitiated && this.now() - Date.parse(input.capturedAt) > 15_000) {
          session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, input, claim.id);
          record.state = 'done'; return;
        }
        session.emit('claim.checking', { admissionAction: 'check', reasonCode: 'eligible_public_claim' }, input, claim.id);
        const key = JSON.stringify([claim.checkedText.replace(/\s+/g, ' ').trim().toLowerCase(), input.context, input.language, input.mode, POLICY_VERSION, this.modelVersion]);
        const stored = session.cache.get(key);
        let result: ClaimResult;
        if (stored && stored.expiresAt > this.now()) {
          result = { ...stored.result, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, cached: true, durationMs: this.monotonic() - started };
        } else {
          const evidence = await timed('retrieval', () => this.adapters.retrieve(claim, ctx));
          if (!session.current(record)) return;
          const judgment = evidence.length ? await timed('judgment', () => this.adapters.judge(claim, evidence, ctx)) : {
            label: 'insufficient_evidence' as const, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 }, evidence: [], selectedEvidenceIds: [], misleadingReason: null
          };
          if (!session.current(record)) return;
          const decision = decideVerdict(judgment);
          result = { ...decision, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, evidence: judgment.evidence,
            checkedAt: new Date(this.now()).toISOString(), expiresAt: new Date(Math.min(this.now() + 60_000, session.expiresAt)).toISOString(), durationMs: this.monotonic() - started,
            cached: false, policyVersion: POLICY_VERSION, modelVersion: this.modelVersion, presentation: { action: 'silent', reasonCode: 'pending' } };
          result = claimResultSchema.parse(result);
          session.cache.set(key, { result, expiresAt: Date.parse(result.expiresAt) });
          if (session.cache.size > 64) session.cache.delete(session.cache.keys().next().value!);
        }
        session.notifications = session.notifications.filter(t => this.now() - t < 60_000);
        for (const [k, expires] of session.recentClaims) if (expires <= this.now()) session.recentClaims.delete(k);
        // Preferences may change while providers run or between factual cache hits.
        // Match only the admitted span at delivery time; never reuse topic metadata.
        const currentAdmission = { ...claim.admission, matchedSelectedTopic: matchSelectedTopic(claim.checkedText, session.preferences.selectedTopics) };
        result = { ...result, presentation: decidePresentation({ ...result, admission: currentAdmission }, input.userInitiated ? 'manual' : 'automatic', {
          active: session.active, healthy: true, current: session.current(record), expired: Date.parse(result.expiresAt) <= this.now(),
          duplicate: !input.userInitiated && session.recentClaims.has(key), notificationCount: session.notifications.length
        }, session.preferences) };
        if (!session.current(record)) return;
        if (result.presentation.action === 'notify') { session.notifications.push(this.now()); session.recentClaims.set(key, this.now() + 60_000); }
        record.results.set(claim.id, result); session.emit('claim.result', result, input, claim.id);
      }
      record.state = 'done';
    } catch (error) {
      if (session.current(record)) this.error(session, record, error instanceof PipelineError ? error.code : 'provider_unavailable');
      if (record.state !== 'cancelled') record.state = 'done';
    } finally {
      if (record.state !== 'waiting') clearTimeout(record.timer);
      this.metrics.push({ durationMs: this.monotonic() - started, stageMs, state: record.state, jevAttempts: record.budget.jev,
        searchAttempts: [...record.budget.searches.values()].reduce((a, b) => a + b, 0), contentAttempts: [...record.budget.contents.values()].reduce((a, b) => a + b, 0), inputTokens: record.budget.inputTokens });
      if (this.metrics.length > 128) this.metrics.shift();
    }
  }
}
