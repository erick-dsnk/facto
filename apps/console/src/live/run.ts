import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { MODEL_VERSION, POLICY_VERSION, type ClaimResult, type EventEnvelope } from '../../../../packages/contracts/src/index.js';
import { eventEnvelopeSchema, presentationSchema } from '../../../../packages/contracts/src/wire.js';
import { deterministicIssue } from '../../../../services/api/src/input/claims/spans.js';
import { buildServer } from '../../../../services/api/src/transport/server.js';
import { CampaignBudget, DEVELOPMENT_LIMITS, HarnessStop, type LiveLimits } from './budget.js';
import { freshObservation, observedProviders, stopObservation, type RequestObservation } from './observe.js';

const controlFetch = (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(2_500) });

export type LiveCase = { label: string; text: string; allowedPublic: string[]; automatic?: boolean; final?: boolean; cancelAfterDetected?: boolean };

/** Independent public development examples; never load the evaluation corpus. */
export const DEVELOPMENT_CASES: LiveCase[] = [
  { label: 'L1-opera', text: 'The Sydney Opera House opened in 1973.', allowedPublic: ['The Sydney Opera House opened in 1973.'] },
  { label: 'L2-lightning', text: 'Lightning never strikes the same place twice.', allowedPublic: ['Lightning never strikes the same place twice.'] },
  { label: 'L3-personal', text: 'I felt tired after lunch.', allowedPublic: [] },
  { label: 'L4-mixed', text: 'I paid 900 euros in rent, but Oslo is the capital of Norway.', allowedPublic: ['Oslo is the capital of Norway.'] },
  { label: 'L5-cache-repeat', text: 'The Sydney Opera House opened in 1973.', allowedPublic: ['The Sydney Opera House opened in 1973.'] },
  { label: 'L6-existential', text: 'There are eight planets in the Solar System.', allowedPublic: ['There are eight planets in the Solar System.'] },
  { label: 'L7-wait-expiry', text: 'The population is', allowedPublic: [], automatic: true, final: false },
  { label: 'L8-first-person', text: 'I think Helsinki is the capital of Norway.', allowedPublic: ['I think Helsinki is the capital of Norway.', 'Helsinki is the capital of Norway.'] },
  { label: 'L9-opinion', text: 'I prefer tea to coffee.', allowedPublic: [] },
];

type WireObservation = {
  type: EventEnvelope['type']; eventSeq: number; revision?: number; claimId?: string; receivedMs: number;
  reasonCode?: string; admissionAction?: string; waitExpiresAt?: string; cached?: boolean;
  verdict?: string; checkedPublicText?: string; selectedEvidenceIds?: string[]; evidence?: ClaimResult['evidence'];
  presentation?: ClaimResult['presentation']; durationMs?: number;
};
type CaseReport = {
  label: string; status: 'observed' | 'local_stop' | 'transport_failure'; httpStatus: number | null;
  terminalReceived: boolean; terminalType: string | null; durationMs: number; mismatch: string[];
  events: WireObservation[]; admission?: RequestObservation['admission']; attempts: RequestObservation['attempts'];
  stageMs: RequestObservation['stageMs']; evidence: RequestObservation['evidence']; admittedPublic: string[];
  deterministicPublicIssues: { text: string; issue: ReturnType<typeof deterministicIssue> }[];
  localStops: string[]; runtime?: { state: string; jevConsumed: number; searchConsumed: number; contentsConsumed: number; inputTokens: number };
  usage: { measuredInputTokens: number; unknownInputTokenReservations: number; requestBytes: number; knownCostUSD: number | null; attemptsWithUnknownCost: number };
};

export function sanitizeEvent(event: EventEnvelope, sample: LiveCase, receivedMs: number): WireObservation {
  const payload = event.payload as Record<string, unknown>;
  const record: WireObservation = { type: event.type, eventSeq: event.eventSeq, revision: event.revision, claimId: event.claimId, receivedMs };
  for (const key of ['reasonCode', 'admissionAction', 'waitExpiresAt'] as const) if (typeof payload[key] === 'string') record[key] = payload[key] as string;
  if (event.type === 'claim.result') {
    const result = event.payload as ClaimResult;
    if (!sample.allowedPublic.includes(result.checkedText)) throw new HarnessStop('result_span_not_public');
    Object.assign(record, { verdict: result.verdict, checkedPublicText: result.checkedText, cached: result.cached,
      selectedEvidenceIds: result.selectedEvidenceIds, evidence: result.evidence, presentation: result.presentation, durationMs: result.durationMs });
  } else if (typeof payload.presentation === 'object' && payload.presentation !== null && !Array.isArray(payload.presentation)) {
    const presentation = payload.presentation as Record<string, unknown>;
    const parsed = presentationSchema.safeParse({ action: presentation.action, reasonCode: presentation.reasonCode });
    if (parsed.success) record.presentation = parsed.data;
  }
  return record;
}

class Inbox {
  readonly events: EventEnvelope[] = [];
  readonly receivedAt = new Map<EventEnvelope, number>();
  private listeners = new Set<() => void>();
  constructor(readonly socket: WebSocket) {
    socket.on('message', data => {
      try {
        const event = eventEnvelopeSchema.parse(JSON.parse(data.toString())) as EventEnvelope;
        this.events.push(event); this.receivedAt.set(event, performance.now());
      }
      catch { this.failure = 'invalid_websocket_event'; }
      for (const listener of this.listeners) listener();
    });
    socket.on('error', () => { this.failure = 'websocket_error'; for (const listener of this.listeners) listener(); });
    socket.on('close', () => { this.failure ??= 'websocket_closed'; for (const listener of this.listeners) listener(); });
  }
  failure?: string;
  wait(predicate: (events: EventEnvelope[]) => EventEnvelope | undefined, timeoutMs: number): Promise<EventEnvelope> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(undefined, 'terminal_receipt_timeout'), timeoutMs);
      const check = () => {
        const found = predicate(this.events);
        if (found) finish(found);
        else if (this.failure) finish(undefined, this.failure);
      };
      const finish = (event?: EventEnvelope, error?: string) => {
        clearTimeout(timer); this.listeners.delete(check);
        if (event) resolve(event); else reject(new Error(error));
      };
      this.listeners.add(check); check();
    });
  }
}

/** A waiting event is intermediate. A two-claim request needs both result receipts. */
export function terminalEvent(events: EventEnvelope[], requestId: string, expectedClaims: number): EventEnvelope | undefined {
  const correlated = events.filter(event => event.requestId === requestId && event.revision === 1);
  const terminal = correlated.find(event => ['pipeline.error', 'claim.skipped', 'claim.needs_confirmation', 'check.cancelled'].includes(event.type));
  if (terminal) return terminal;
  const results = correlated.filter(event => event.type === 'claim.result');
  return new Set(results.map(event => event.claimId)).size >= Math.max(1, expectedClaims) ? results.at(-1) : undefined;
}

export async function runLiveCampaign(options: {
  keys: { jev: string; exa: string }; cases?: LiveCase[]; limits?: LiveLimits; providerFetch?: typeof fetch;
  receiptTimeoutMs?: number; metadata?: { commit?: string; dirty?: boolean; sourceSHA256?: string; authProbe?: 'jev' | 'exa' }; onCase?: (report: CaseReport) => void | Promise<void>;
  onProgress?: (progress: { phase: 'dispatch_reserved' | 'attempt_finished'; label: string; attempts: RequestObservation['attempts']; localStops: string[]; totals: ReturnType<CampaignBudget['summary']> }) => void | Promise<void>;
}) {
  const cases = options.cases ?? DEVELOPMENT_CASES;
  if (!cases.length || cases.length > 16 || new Set(cases.map(sample => sample.label)).size !== cases.length
    || cases.some(sample => !/^[a-zA-Z0-9_-]{1,80}$/.test(sample.label))) throw new Error('Invalid predeclared campaign');
  const budget = new CampaignBudget(options.limits ?? DEVELOPMENT_LIMITS);
  const requests = new Map<string, { observation: RequestObservation; allowedPublic: string[] }>();
  const providers = observedProviders({ budget, requests, keys: options.keys, fetch: options.providerFetch,
    onBeforeDispatch: observation => options.onProgress?.({ phase: 'dispatch_reserved', label: observation.label, attempts: observation.attempts, localStops: observation.localStops, totals: budget.summary() }),
    onAttemptFinished: observation => options.onProgress?.({ phase: 'attempt_finished', label: observation.label, attempts: observation.attempts, localStops: observation.localStops, totals: budget.summary() }) });
  const joinCode = randomUUID();
  const server = await buildServer({ adapters: providers.adapters, mode: 'live', joinCode, joinExpiresAt: Date.now() + 600_000 });
  const reports: CaseReport[] = [];
  let socket: WebSocket | undefined;
  let inbox: Inbox | undefined;
  let session: { sessionId: string; token: string; sessionEpoch: number } | undefined;
  let address: string | undefined;
  let transportFailure: string | null = null;
  const auth = { unauthorizedJoinStatus: null as number | null, unauthorizedCheckStatus: null as number | null, unauthorizedWebsocketStatus: null as number | null };
  try {
    address = await server.app.listen({ port: 0, host: '127.0.0.1' });
    auth.unauthorizedJoinStatus = (await controlFetch(`${address}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode: 'deliberately-invalid-join-code' }) })).status;
    const created = await controlFetch(`${address}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode }) });
    if (created.status !== 201) throw new Error('session_creation_failed');
    session = await created.json() as typeof session;
    if (!session) throw new Error('session_creation_failed');
    const wsURL = `${address.replace('http:', 'ws:')}/v1/sessions/${session.sessionId}/stream`;
    auth.unauthorizedWebsocketStatus = await new Promise<number>((resolve, reject) => {
      const unauthenticated = new WebSocket(wsURL, ['actually-v1', 'bearer.deliberately-invalid-token']);
      const timer = setTimeout(() => { unauthenticated.terminate(); reject(new Error('auth_probe_timeout')); }, 2_000);
      unauthenticated.on('error', () => undefined);
      unauthenticated.once('unexpected-response', (_request, response) => { clearTimeout(timer); response.resume(); unauthenticated.terminate(); resolve(response.statusCode ?? 0); });
      unauthenticated.once('open', () => { clearTimeout(timer); unauthenticated.close(); resolve(101); });
    });
    socket = new WebSocket(wsURL, ['actually-v1', `bearer.${session.token}`]);
    inbox = new Inbox(socket);
    await inbox.wait(events => events.find(event => event.type === 'session.ready'), 2_000);
    const headers = { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' };
    auth.unauthorizedCheckStatus = (await controlFetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status;
    if (Object.values(auth).some(status => status !== 401)) { transportFailure = 'authentication_boundary_failed'; throw new Error('authentication_boundary_failed'); }
    for (const sample of cases) {
      if (budget.elapsedMs >= budget.limits.wallMs || reports.some(report => report.status === 'local_stop' || report.status === 'transport_failure')) break;
      const observation = freshObservation(sample.label);
      const requestId = `${sample.label}-${randomUUID().slice(0, 8)}`;
      requests.set(requestId, { observation, allowedPublic: sample.allowedPublic });
      const started = performance.now();
      let httpStatus: number | null = null; let terminal: EventEnvelope | undefined; const mismatch: string[] = [];
      const cancel = async () => {
        const cancelled = await controlFetch(`${address}/v1/sessions/${session!.sessionId}/checks/${requestId}/cancel`, { method: 'POST', headers: { authorization: headers.authorization } });
        if (cancelled.status !== 204) mismatch.push('cancel_http_failed');
      };
      const wallTimer = setTimeout(() => {
        stopObservation(observation, new HarnessStop('wall_limit'));
        void cancel().catch(() => mismatch.push('cancel_transport_failed'));
      }, Math.max(1, budget.limits.wallMs - budget.elapsedMs));
      try {
        const input = { schemaVersion: 1, requestId, sessionId: session.sessionId, sessionEpoch: session.sessionEpoch, revision: 1,
          mode: 'typed', text: sample.text, language: 'en', capturedAt: new Date().toISOString(),
          capture: { source: 'typed_fixture', segmentId: requestId, confidence: 1, final: sample.final ?? true }, context: [], userInitiated: !sample.automatic };
        httpStatus = (await controlFetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers, body: JSON.stringify(input) })).status;
        if (httpStatus !== 202) mismatch.push('check_not_accepted');
        else {
          if (sample.cancelAfterDetected) {
            await inbox.wait(events => events.find(event => event.requestId === requestId && event.type === 'claim.detected'), 2_000);
            await cancel();
          }
          // This is deliberately independent of internal done state, local budget
          // stop signals and provider completion. Drain the correlated WS receipt.
          terminal = await inbox.wait(events => terminalEvent(events, requestId, observation.admission?.claims ?? 1), options.receiptTimeoutMs ?? 12_500);
        }
      } catch { mismatch.push('terminal_receipt_missing'); }
      finally { clearTimeout(wallTimer); }
      await providers.drain();
      const correlated = inbox.events.filter(event => event.requestId === requestId && event.revision === 1);
      const events: WireObservation[] = [];
      for (const event of correlated) {
        try { events.push(sanitizeEvent(event, sample, Math.round((inbox.receivedAt.get(event) ?? performance.now()) - started))); }
        catch (error) { if (error instanceof HarnessStop) stopObservation(observation, error); mismatch.push('unsafe_result_rejected'); }
      }
      if (options.metadata?.authProbe) {
        const expected = options.metadata.authProbe === 'jev' ? 'jev_authentication' : 'exa_authentication_failed';
        if (!events.some(event => event.type === 'pipeline.error' && event.reasonCode === expected)
          || !observation.attempts.some(attempt => attempt.kind === (options.metadata!.authProbe === 'jev' ? 'jev' : 'search') && attempt.status === 401)) mismatch.push('provider_auth_probe_not_observed');
      }
      // Raw wire payloads can contain originalText. Discard them immediately
      // after extracting the public-only report; credentials never enter it.
      inbox.events.splice(0, inbox.events.length);
      inbox.receivedAt.clear();
      const record = server.store.sessions.get(session.sessionId)?.requests.get(requestId);
      const knownCosts = observation.attempts.filter(attempt => attempt.costUSD !== null);
      const report: CaseReport = { label: sample.label, status: observation.localStops.length ? 'local_stop' : mismatch.length ? 'transport_failure' : 'observed',
        httpStatus, terminalReceived: !!terminal, terminalType: terminal?.type ?? null, durationMs: Math.round(performance.now() - started), mismatch,
        events, admission: observation.admission, attempts: observation.attempts, stageMs: observation.stageMs, evidence: observation.evidence,
        admittedPublic: observation.admittedPublic, deterministicPublicIssues: sample.allowedPublic.map(text => ({ text, issue: deterministicIssue(text) })), localStops: observation.localStops,
        runtime: record ? { state: record.state, jevConsumed: record.budget.jev, searchConsumed: [...record.budget.searches.values()].reduce((a, b) => a + b, 0),
          contentsConsumed: [...record.budget.contents.values()].reduce((a, b) => a + b, 0), inputTokens: record.budget.inputTokens } : undefined,
        usage: { measuredInputTokens: observation.attempts.reduce((sum, attempt) => sum + (attempt.inputTokens ?? 0), 0),
          unknownInputTokenReservations: observation.attempts.reduce((sum, attempt) => sum + attempt.unknownInputTokenReservation, 0),
          requestBytes: observation.attempts.reduce((sum, attempt) => sum + attempt.requestBytes, 0),
          knownCostUSD: knownCosts.length ? knownCosts.reduce((sum, attempt) => sum + attempt.costUSD!, 0) : null,
          attemptsWithUnknownCost: observation.attempts.length - knownCosts.length } };
      reports.push(report); await options.onCase?.(report);
    }
  } catch { transportFailure ??= 'campaign_transport_failure'; }
  finally {
    if (address && session) await controlFetch(`${address}/v1/sessions/${session.sessionId}`, { method: 'DELETE', headers: { authorization: `Bearer ${session.token}` } }).catch(() => undefined);
    socket?.close();
    await server.app.close();
    await providers.drain();
  }
  return {
    schemaVersion: 1, kind: 'authenticated_http_websocket_live_development', startedAt: new Date(Date.now() - budget.elapsedMs).toISOString(),
    modelVersion: MODEL_VERSION, policyVersion: POLICY_VERSION, metadata: options.metadata ?? {}, limits: budget.limits,
    predeclaredCases: cases.map(sample => ({ label: sample.label, allowedPublic: sample.allowedPublic, automatic: !!sample.automatic, final: sample.final ?? true, cancellation: !!sample.cancelAfterDetected })),
    counts: { declared: cases.length, observed: reports.length, terminalReceipts: reports.filter(report => report.terminalReceived).length, localStops: reports.filter(report => report.status === 'local_stop').length,
      transportFailures: reports.filter(report => report.status === 'transport_failure').length, providerErrors: reports.filter(report => report.events.some(event => event.type === 'pipeline.error') && report.status !== 'local_stop').length },
    completed: reports.length === cases.length && reports.every(report => report.terminalReceived && report.status === 'observed') && !transportFailure,
    auth, transportFailure, totals: budget.summary(), cases: reports,
    limitations: ['Observed terminal delivery is not a factual-accuracy pass; review every abstention and definitive citation.',
      '24,000 tokens per pending/unknown Jev attempt is an uncertainty allowance, not a tokenizer-derived upper bound. Any unknown completed Jev usage blocks subsequent provider dispatch. Actual usage can exceed a reservation before the harness can stop.',
      'A dispatch_reserved checkpoint records an allowance before fetch is called; interruption leaves dispatch uncertain. Final actual attempt counts include only dispatched attempts.',
      'Known costs are partial when any attempt has unknown cost. No prices are invented.',
      'No held-out bodies, raw private text, provider prompts, session credentials or keys are retained. Native/iOS/ASR paths are untested.'],
  };
}

async function sourceSnapshot(expectedCommit?: string) {
  const git = (args: string[]) => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const commit = git(['rev-parse', 'HEAD']).trim();
  if (expectedCommit && expectedCommit !== commit) throw new Error('--commit does not match the current checkout.');
  const dirty = !!git(['status', '--porcelain', '--untracked-files=normal']).trim();
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps/console', 'services/api', 'packages/contracts', 'package.json', 'package-lock.json']).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(await readFile(path)); hash.update('\0'); }
  return { commit, dirty, sourceSHA256: hash.digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const allowed = new Set(['--live', '--plan', '--output', '--commit', '--auth-probe']);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!allowed.has(arg)) throw new Error('Usage: live [--plan | --live --output PATH] [--commit SHA] [--auth-probe jev|exa]');
    if (['--output', '--commit', '--auth-probe'].includes(arg)) { if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing argument'); values[arg] = args[++index]; }
  }
  if (args.includes('--plan') || !args.includes('--live')) {
    process.stdout.write(`${JSON.stringify({ mode: 'plan_only_no_provider_calls', limits: DEVELOPMENT_LIMITS, cases: DEVELOPMENT_CASES.map(sample => ({ label: sample.label, allowedPublic: sample.allowedPublic, automatic: !!sample.automatic, final: sample.final ?? true })) }, null, 2)}\n`);
  } else {
    if (!values['--output']) throw new Error('A durable --output path is required for live execution.');
    const probeValue = values['--auth-probe'];
    if (probeValue !== undefined && probeValue !== 'jev' && probeValue !== 'exa') throw new Error('Invalid auth probe provider');
    const authProbe = probeValue === 'jev' ? 'jev' as const : probeValue === 'exa' ? 'exa' as const : undefined;
    if ((authProbe !== 'jev' && !process.env.JEV_API_KEY) || (!authProbe && !process.env.EXA_API_KEY)) throw new Error('Configure server-side JEV_API_KEY and EXA_API_KEY through the environment.');
    const keys = { jev: authProbe === 'jev' ? 'deliberately-invalid-jev-key' : process.env.JEV_API_KEY!, exa: authProbe === 'exa' ? 'deliberately-invalid-exa-key' : process.env.EXA_API_KEY ?? 'unused' };
    const metadata = { ...await sourceSnapshot(values['--commit']), authProbe };
    const output = values['--output'];
    await mkdir(dirname(output), { recursive: true });
    // Reserve before any provider call, then atomically replace our own report
    // with each checkpoint. A rerun must choose a fresh path.
    const reserved = await open(output, 'wx', 0o600);
    await reserved.writeFile(`${JSON.stringify({ schemaVersion: 1, completed: false, phase: 'reserved_before_dispatch', metadata, limits: DEVELOPMENT_LIMITS })}\n`);
    await reserved.sync(); await reserved.close();
    const checkpointCases: CaseReport[] = [];
    const persist = async (value: unknown) => {
      const temporary = `${output}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      const written = await open(temporary, 'r'); await written.sync(); await written.close();
      await rename(temporary, output);
    };
    const report = await runLiveCampaign({ keys, cases: authProbe ? [DEVELOPMENT_CASES[0]] : undefined, metadata,
      onProgress: async active => { await persist({ schemaVersion: 1, completed: false, phase: 'attempt_checkpoint', metadata, limits: DEVELOPMENT_LIMITS, cases: checkpointCases, active }); },
      onCase: async report => { checkpointCases.push(report); await persist({ schemaVersion: 1, completed: false, phase: 'case_checkpoint', metadata, limits: DEVELOPMENT_LIMITS, cases: checkpointCases }); } });
    await persist(report);
    process.stdout.write(`${JSON.stringify({ output, completed: report.completed, counts: report.counts, totals: report.totals }, null, 2)}\n`);
    if (!report.completed) process.exitCode = 1;
  }
}
