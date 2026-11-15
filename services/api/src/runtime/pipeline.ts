import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  claimFrame, MODEL_VERSION, POLICY_VERSION, PipelineError, PROVIDER_LIMITS, sourceQuery, sourceQueryText,
  type AcceptedClaim, type AdmissionPayload, type DisplaySource, type CheckUsage, type ClaimFrame, type ClaimResult, type Evidence, type Judgment, type ProviderContext, type ProviderKind,
  type ResultDecision, type TextInput, type VerdictDecision,
} from '../../../../packages/contracts/src/index.js';
import type { RuntimeAdapters } from './adapters.js';
import { retainAlternateEvidence } from './alternate-evidence.js';
import { assessVerdict, decideVerdict, type VerdictAssessment } from '../policy/verdict.js';
import { decidePresentation, matchSelectedTopic } from '../policy/notifications.js';
import { admissionOutcome, privateLifeDecision, subjectMissingDecision, VERDICT_SUMMARIES, wireName, withSpeculation } from '../policy/outcomes.js';
import { corroborationNeeded, mergeCorroboration, supportingSites } from '../policy/corroboration.js';
import { AttemptBudget, abortable, assertWithinDeadline } from './budget.js';
import { ClaimCache, type CachedDecision } from './claim-cache.js';
import { fingerprint, type RequestRecord, type Session } from './session.js';
import { claimResultSchema, claimSourcesSchema } from '../../../../packages/contracts/src/wire.js';
import { containsContactData } from '../input/claims/spans.js';

type Job = { session: Session; record: RequestRecord };

/** claim.sources progress: the sites Exa returned, one per hostname, at most four. Never the provider itself. */
export function sourceSites(records: Evidence[]): DisplaySource[] {
  const sites = new Map<string, DisplaySource>();
  for (const record of records) {
    let hostname: string;
    try { hostname = new URL(record.url).hostname.toLowerCase(); } catch { continue; }
    if (!/^[a-z0-9.-]{1,253}$/.test(hostname) || sites.has(hostname)) continue;
    sites.set(hostname, { id: createHash('sha256').update(hostname).digest('hex').slice(0, 24), hostname, title: (record.title.trim() || hostname).slice(0, 160), stage: 'ready', provider: 'exa' });
    if (sites.size === 4) break;
  }
  return [...sites.values()];
}
const reportedEvidence = new WeakMap<object, Evidence[]>();
/** After each Exa search of the sources flow returns: report every site found so far for this claim. */
function reportPaidSources(context: ProviderContext, found: Evidence[]) {
  if (!context.reportSources) return;
  const all = [...(reportedEvidence.get(context) ?? []), ...found];
  reportedEvidence.set(context, all);
  context.reportSources(sourceSites(all));
}
export type RuntimeMetric = {
  durationMs: number; stageMs: { admission: number; retrieval: number; judgment: number };
  state: RequestRecord['state']; jevAttempts: number; searchAttempts: number; contentAttempts: number; inputTokens: number;
};
type Stage = keyof RuntimeMetric['stageMs'];
type ClaimContext = ProviderContext & { canConsume(kind: ProviderKind, claimId?: string): boolean };
/** What a sources check hands back: the decision, the judged evidence and whether the shared cache may keep it. */
type SourcedOutcome = { decision: ResultDecision; evidence: Evidence[]; cacheable: boolean };
/** One judgment and what the ported rules made of it; `inputs` is the evidence as it was sent to Jev. */
type Round = { inputs: Evidence[]; judgment: Judgment; verdict: VerdictAssessment };

/** One cache for every session and runtime in this process unless the adapters bring their own (Q9). */
const sharedClaimCache = new ClaimCache();
const SECOND_SEARCH_MIN_REMAINING_MS = 3_000;
const definitive = (verdict: string) => verdict === 'supported' || verdict === 'contradicted' || verdict === 'misleading';
/** Never carry earlier model assessments into a new evidence set. */
const raw = (records: Evidence[]) => records.map(source => ({ ...source, sourceRole: 'unknown' as const, directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated' as const, stanceProbability: 0 }));
const sameIds = (a: Evidence[], b: Evidence[]) => JSON.stringify(a.map(source => source.id).sort()) === JSON.stringify(b.map(source => source.id).sort());
const noEvidence: VerdictDecision = { verdict: 'insufficient_evidence', reasonCode: 'no_evidence', selectedEvidenceIds: [], summary: VERDICT_SUMMARIES.insufficient_evidence };

export class PipelineRuntime {
  private queue: Job[] = [];
  private running = 0;
  /** Bounded sanitized diagnostics; deliberately excludes input, queries, tokens and IDs. */
  readonly metrics: RuntimeMetric[] = [];
  private readonly cache: ClaimCache;
  constructor(private adapters: RuntimeAdapters, private now: () => number = Date.now, private monotonic: () => number = () => performance.now(), private modelVersion = MODEL_VERSION as string, /** Per-request deadline. Production keeps 10 s; only a Laya evaluation run raises it. */ private readonly deadlineMs = 10_000, /** Cap on one continuation wait. Production keeps 8 s; only a raised evaluation deadline changes it. */ private readonly waitCapMs = 8_000) {
    this.cache = adapters.cache ?? sharedClaimCache;
  }

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
      session.emit('claim.superseded', { reasonCode: 'corrected', presentation: { action: presented && !session.preferences.muted && (previous.input.userInitiated || session.preferences.automaticNotifications) ? 'respond' : 'silent', reasonCode: 'correction_status' } }, previous.input);
      previous.results.clear();
    }
    // Revisions and continuations share the original deadline and attempt budget.
    const acceptedAt = previous?.acceptedAt ?? this.now();
    const acceptedMonotonic = previous?.acceptedMonotonic ?? this.monotonic();
    const record: RequestRecord = { input, fingerprint: hash, budget: previous?.budget ?? new AttemptBudget(), controller: new AbortController(), acceptedAt,
      acceptedMonotonic, state: 'queued', continuationCount: (previous?.continuationCount ?? 0) + (continuing ? 1 : 0), results: new Map() };
    session.requests.set(input.requestId, record);
    record.timer = setTimeout(() => {
      if (!session.current(record) || record.state === 'done' || record.state === 'cancelled') return;
      if (record.state === 'waiting') {
        session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'wait_expired' }, input);
      } else this.error(session, record, 'timeout');
      record.state = 'done'; record.controller.abort(new PipelineError('timeout')); this.pump();
    }, Math.max(0, this.deadlineMs - (this.now() - acceptedAt)));
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

  /** Jev calls for the whole request so far and Exa searches for this claim. */
  private usage(record: RequestRecord, claimId?: string): CheckUsage {
    return { jevCalls: record.budget.jev, exaSearches: claimId ? record.budget.used('search', claimId) : 0 };
  }

  private async run({ session, record }: Job) {
    const { input } = record;
    const started = record.acceptedMonotonic;
    const ctx = record.budget.context(record.controller.signal, this.now, record.acceptedAt + this.deadlineMs);
    const stageMs = { admission: 0, retrieval: 0, judgment: 0 };
    const timed = async <T>(stage: Stage, call: () => Promise<T>): Promise<T> => {
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
    /** True when the request no longer owns its output: superseded, cancelled, expired or stale. */
    const halted = () => !session.current(record) || stopIfStale();
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
          const remaining = Math.min(this.waitCapMs, this.deadlineMs - (this.now() - record.acceptedAt));
          session.emit('claim.waiting', { admissionAction: 'wait', reasonCode: admission.reasonCode, waitExpiresAt: new Date(this.now() + remaining).toISOString() }, input);
          record.timer = setTimeout(() => {
            if (!session.current(record)) return;
            record.state = 'done'; session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'wait_expired' }, input);
          }, Math.max(0, remaining)); record.timer.unref();
          return;
        }
        const outcome = admissionOutcome(admission, input, session.preferences.muted, this.usage(record));
        session.emit(outcome.type, outcome.payload, input);
        record.state = 'done'; return;
      }
      if (admission.claims.length < 1 || admission.claims.length > 2) throw new PipelineError('malformed_admission');
      // The automatic cooldown counts admitted claims (1 per 4 s), so filler or skipped sentences never block the next claim.
      if (!input.userInitiated) session.lastAutomaticAt = this.now();
      const sources = this.adapters.sources;
      // Legacy session cache: case and whitespace can change an admitted proposition (MW/mW, quoted identifiers).
      const sessionKey = (text: string) => JSON.stringify([text, input.context, input.language, input.mode, POLICY_VERSION, this.modelVersion]);
      const sharedKey = (claim: AcceptedClaim) => ClaimCache.key(claim.checkedText, claimFrame(claim).subject, POLICY_VERSION, this.modelVersion);
      /** A later claim still needs provider work within this request's allowance. */
      const needsProviders = (later: AcceptedClaim) => {
        const frame = claimFrame(later);
        if (frame.privateLife || frame.subjectMissing) return false;
        if (sources) return !ClaimCache.cacheable(frame) || this.cache.get(sharedKey(later)) === undefined;
        const cached = session.cache.get(sessionKey(later.checkedText));
        // A near-expiry cache entry may disappear while this claim runs.
        return !cached || cached.expiresAt <= record.acceptedAt + this.deadlineMs;
      };
      for (const [index, candidate] of admission.claims.entries()) {
        // A correction must not mint fresh provider allowances through a new ID.
        const claim = { ...candidate, id: `${input.requestId}-claim-${index}` };
        const frame = claimFrame(claim);
        const subject = wireName(frame.subject);
        currentClaimId = claim.id;
        if (!session.current(record)) return;
        if (!input.userInitiated && this.now() - Date.parse(input.capturedAt) > 15_000) {
          session.emit('claim.skipped', { admissionAction: 'skip', reasonCode: 'stale_capture' }, input, claim.id);
          record.state = 'done'; return;
        }
        const checking: AdmissionPayload = {
          admissionAction: 'check', reasonCode: 'eligible_public_claim', claimText: claim.checkedText, mode: input.mode, userInitiated: input.userInitiated,
          ...(sources ? { route: frame.route, subject } : {}),
        };
        session.emit('claim.checking', checking, input, claim.id);
        // claim.sources: up to four source sites for the display, only while this request still owns its output.
        const reportSources = (progressSources: DisplaySource[]) => {
          const progress = claimSourcesSchema.safeParse({ sources: progressSources });
          if (progress.success && session.current(record) && this.now() < record.acceptedAt + this.deadlineMs) session.emit('claim.sources', progress.data, input, claim.id);
        };
        // Notification identity is the complete admitted proposition, independent of
        // capture mode/context. Keep factual cache identity separate.
        const notificationKey = claim.checkedText;
        const build = (decision: ResultDecision, evidence: Evidence[], cached = false, checkedAt = new Date(this.now()).toISOString()): ClaimResult => claimResultSchema.parse({
          ...decision, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, evidence, checkedAt,
          expiresAt: new Date(Math.min(this.now() + 60_000, session.expiresAt)).toISOString(), durationMs: this.monotonic() - started,
          cached, policyVersion: POLICY_VERSION, modelVersion: this.modelVersion, presentation: { action: 'silent', reasonCode: 'pending' },
          ...(sources ? { route: frame.route, subject, usage: this.usage(record, claim.id) } : {}),
        });
        let result: ClaimResult;
        let commit: (() => void) | undefined;
        const special = frame.privateLife ? privateLifeDecision() : frame.subjectMissing ? subjectMissingDecision() : null;
        if (special) {
          // Never searched and never judged: no provider sees a private-life allegation or a claim missing its subject.
          result = build(special, []);
        } else if (sources) {
          const key = sharedKey(claim);
          const hit = ClaimCache.cacheable(frame) ? this.cache.get(key) : undefined;
          if (hit) {
            const { checkedText: _text, evidence, route: _route, subject: _subject, checkedAt, ...decision } = hit;
            result = build(decision, evidence, true, checkedAt);
          } else {
            if (!ctx.canConsume('jev')) throw new PipelineError('jev_budget_exhausted');
            const laterUncached = admission.claims.slice(index + 1).filter(needsProviders).length;
            const reserved = Math.min(laterUncached, Math.max(0, PROVIDER_LIMITS.jev - record.budget.jev - 1));
            const claimContext = record.budget.context(record.controller.signal, this.now, record.acceptedAt + this.deadlineMs, reserved);
            claimContext.reportSources = reportSources;
            const outcome = await this.checkWithSources({ claim, frame, claimContext, timed, halted, acceptedAt: record.acceptedAt, laterUncached });
            if (!outcome) return;
            result = build(outcome.decision, outcome.evidence);
            if (outcome.cacheable) {
              const stored: CachedDecision = { ...outcome.decision, checkedText: claim.checkedText, evidence: result.evidence, route: frame.route, subject: frame.subject, checkedAt: result.checkedAt };
              commit = () => this.cache.set(key, stored);
            }
          }
        } else {
          const key = sessionKey(claim.checkedText);
          const stored = session.cache.get(key);
          if (stored && stored.expiresAt > this.now()) {
            result = { ...stored.result, originalText: input.text, checkedText: claim.checkedText, sourceSpan: claim.sourceSpan, cached: true, durationMs: this.monotonic() - started };
          } else {
            // Spend remaining capacity on useful current work, while protecting a
            // later span's first judgment whenever there is capacity for both.
            if (!ctx.canConsume('jev')) throw new PipelineError('jev_budget_exhausted');
            const laterUncached = admission.claims.slice(index + 1).filter(needsProviders).length;
            const reserved = Math.min(laterUncached, Math.max(0, PROVIDER_LIMITS.jev - record.budget.jev - 1));
            const claimContext = record.budget.context(record.controller.signal, this.now, record.acceptedAt + this.deadlineMs, reserved);
            claimContext.reportSources = reportSources;
            const evidence = await timed('retrieval', () => this.adapters.retrieve(claim, claimContext));
            if (halted()) return;
            let judgment = evidence.length ? await timed('judgment', () => this.adapters.judge(claim, evidence, claimContext)) : {
              label: 'insufficient_evidence' as const, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 }, evidence: [], selectedEvidenceIds: [], misleadingReason: null
            };
            if (halted()) return;
            let decision = decideVerdict(judgment);
            if (decision.verdict === 'insufficient_evidence' && this.adapters.retrieveAlternate && !laterUncached
              && claimContext.canConsume('jev') && claimContext.canConsume('search', claim.id)
              && record.acceptedAt + this.deadlineMs - this.now() >= SECOND_SEARCH_MIN_REMAINING_MS) {
              const additional = await timed('retrieval', () => this.adapters.retrieveAlternate!(claim, claimContext));
              if (halted()) return;
              const combined = retainAlternateEvidence(evidence, additional, claim.checkedText, judgment);
              const identity = (records: typeof evidence) => JSON.stringify(records.map(source => [source.id, source.url, source.title, source.publisher, source.excerpt, source.publishedAt, source.contentBasis, source.sourceGroup, source.echoGroup]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
              if (combined.length && identity(combined) !== identity(evidence)) {
                judgment = await timed('judgment', () => this.adapters.judge(claim, raw(combined), claimContext));
                if (!session.current(record)) return;
                decision = decideVerdict(judgment);
              }
            }
            if (stopIfStale()) return;
            result = build(decision, judgment.evidence);
            const fresh = result;
            commit = () => {
              session.cache.set(key, { result: fresh, expiresAt: Date.parse(fresh.expiresAt) });
              if (session.cache.size > 64) session.cache.delete(session.cache.keys().next().value!);
            };
          }
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
        commit?.();
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

  /**
   * Q5/Q6: free sources first; a True or False from them ends the check with no Exa search. Otherwise the primary
   * Exa search, then at most one more (corroboration or alternate), never a third. Returns undefined when the
   * request stopped owning its output.
   *
   * Can't verify and Speculation say a full look found nothing. A run that hit the deadline throws `timeout`; one
   * where a source failed, the primary search was never sent or an extra search broke keeps any definitive label,
   * never becomes Speculation and is never cached. With no primary search and a failed free source there is
   * nothing to answer from, so it throws `sources_unavailable`.
   */
  private async checkWithSources(job: {
    claim: AcceptedClaim; frame: ClaimFrame; claimContext: ClaimContext; acceptedAt: number; laterUncached: number;
    timed: <T>(stage: Stage, call: () => Promise<T>) => Promise<T>; halted: () => boolean;
  }): Promise<SourcedOutcome | undefined> {
    const { claim, frame, claimContext, timed, halted } = job;
    const sources = this.adapters.sources!;
    // A source sees only the checked text and subject: never context, private spans or originalText.
    const query = sourceQuery(claim, this.now());
    // Admission screens both; this backstop keeps contact data from every outbound request whatever happened there.
    if (containsContactData(sourceQueryText(query))) throw new PipelineError('private_or_personal');
    const traitsOf = (records: Evidence[]) => records.map(record => sources.traits(record, frame.attribution));
    const judgeRound = async (inputs: Evidence[]): Promise<Round> => {
      const judgment = await timed('judgment', () => this.adapters.judge(claim, inputs, claimContext));
      return { inputs, judgment, verdict: assessVerdict(judgment, { traits: traitsOf(judgment.evidence), frame, checkedText: claim.checkedText }, undefined, this.adapters.verdictRules) };
    };
    /** `complete`: every applicable source answered and the evidence found was judged. `cacheable`: nothing was cut short or failed;
     * a definitive label is kept even after a free source failed, an abstention only after a complete look. */
    const finish = (round: Round | undefined, complete: boolean, cacheable: boolean): SourcedOutcome => {
      const decision = round?.verdict.decision ?? noEvidence;
      const settled = definitive(decision.verdict);
      return {
        decision: complete ? withSpeculation(decision, round?.verdict.ruleLabel ?? null, frame, round?.verdict.tally.counts ?? null) : decision,
        evidence: round?.judgment.evidence ?? [], cacheable: cacheable && (settled || complete) && ClaimCache.cacheable(frame),
      };
    };

    const free = await timed('retrieval', () => sources.gatherFree(query, claimContext));
    if (halted()) return undefined;
    // A source that failed or ran out of time may answer next time.
    const degraded = Object.values(free.answered ?? {}).some(answered => answered === false);
    let round: Round | undefined;
    const freeRanked = sources.rank(free.evidence, [], frame.future);
    if (freeRanked.length && claimContext.canConsume('jev')) {
      round = await judgeRound(freeRanked);
      if (halted()) return undefined;
      const label = round.verdict.decision.verdict;
      if (label === 'supported' || label === 'contradicted') return finish(round, true, true);
    }

    // canConsume is also false once the deadline has passed: that is a timeout, never "nothing more to do".
    assertWithinDeadline(claimContext);
    let searched = false;
    if (claimContext.canConsume('search', claim.id)) {
      let paid;
      try {
        paid = await timed('retrieval', () => sources.searchPaid(query, { purpose: 'primary' }, claimContext));
        reportPaidSources(claimContext, paid.evidence);
      } catch (error) {
        assertWithinDeadline(claimContext);
        // A definitive answer from the free sources stands without the search, but is not kept. A provider error is
        // never presented as Can't verify or Speculation.
        if (round && definitive(round.verdict.decision.verdict)) return finish(round, false, false);
        throw error;
      }
      if (halted()) return undefined;
      searched = true;
      const ranked = sources.rank(free.evidence, paid.evidence, frame.future);
      if (ranked.length && !(round && sameIds(ranked, round.inputs))) {
        if (claimContext.canConsume('jev')) {
          round = await judgeRound(round ? raw(ranked) : ranked);
          if (halted()) return undefined;
        } else if (!round) throw new PipelineError('jev_budget_exhausted');
        // The search found evidence that could not be judged: the free round stands, but it is no full look.
        else searched = false;
      }
    }
    if (!round && freeRanked.length) throw new PipelineError('jev_budget_exhausted');
    if (!searched && degraded && !definitive(round?.verdict.decision.verdict ?? 'insufficient_evidence')) throw new PipelineError('sources_unavailable', true);
    let complete = searched && !degraded;
    let cacheable = true;

    // At most one more Exa search, only with time and allowance left, and never at a later claim's expense.
    assertWithinDeadline(claimContext);
    const decided = round?.verdict.decision.verdict ?? 'insufficient_evidence';
    if (decided === 'insufficient_evidence' && !job.laterUncached && claimContext.canConsume('search', claim.id) && claimContext.canConsume('jev')) {
      if (job.acceptedAt + this.deadlineMs - this.now() < SECOND_SEARCH_MIN_REMAINING_MS) {
        // No time for one more search: the abstention stands, but more time might have settled it.
        cacheable = false;
      } else {
        try {
          const second = await this.secondPass({ claim, frame, query, sources, round, judgeRound, timed, halted, claimContext });
          if (second === 'halted' || halted()) return undefined;
          round = second;
        } catch {
          // Past the deadline or cancelled, this throws. An optional search or judgment that broke otherwise leaves the
          // first answer standing: not kept and never Speculation.
          assertWithinDeadline(claimContext);
          complete = false;
        }
      }
    }
    return finish(round, complete, cacheable);
  }

  /** The one extra Exa search: once more without the only supporting site (corroboration), else an alternate search. */
  private async secondPass(job: {
    claim: AcceptedClaim; frame: ClaimFrame; query: ReturnType<typeof sourceQuery>; sources: NonNullable<RuntimeAdapters['sources']>; round: Round | undefined;
    judgeRound: (inputs: Evidence[]) => Promise<Round>; timed: <T>(stage: Stage, call: () => Promise<T>) => Promise<T>; halted: () => boolean; claimContext: ClaimContext;
  }): Promise<Round | undefined | 'halted'> {
    const { claim, frame, query, sources, round, judgeRound, timed, halted, claimContext } = job;
    if (round && corroborationNeeded(round.verdict.ruleLabel, round.judgment.label, round.judgment.probabilities, round.verdict.tally.counts)) {
      // One site alone backs it: search once more without that site.
      const excludeSites = supportingSites(round.verdict.tally);
      const extra = await timed('retrieval', () => sources.searchPaid(query, { purpose: 'corroboration', excludeSites }, claimContext));
      reportPaidSources(claimContext, extra.evidence);
      if (halted()) return 'halted';
      const merged = mergeCorroboration(round.judgment.evidence, extra.evidence, excludeSites, record => sources.traits(record, frame.attribution).site);
      return merged.length ? judgeRound(raw(merged)) : round;
    }
    const extra = await timed('retrieval', () => sources.searchPaid(query, { purpose: 'alternate' }, claimContext));
    reportPaidSources(claimContext, extra.evidence);
    if (halted()) return 'halted';
    const incoming = sources.rank([], extra.evidence, frame.future);
    const combined = round ? retainAlternateEvidence(round.inputs, incoming, claim.checkedText, round.judgment) : incoming;
    return combined.length && !(round && sameIds(combined, round.inputs)) ? judgeRound(raw(combined)) : round;
  }
}
