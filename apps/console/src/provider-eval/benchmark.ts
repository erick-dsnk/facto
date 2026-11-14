import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { claimFrame, lowConfidenceWordSchema, MAX_LOW_CONFIDENCE_WORDS, sourceQuery, MODEL_VERSION, POLICY_VERSION, PipelineError, type AcceptedClaim, type AdmissionResult, type Evidence, type EventEnvelope, type ProviderContext, type TextInput } from '../../../../packages/contracts/src/index.js';
import { createClassifier } from '../../../../services/api/src/providers/jev/classification.js';
import { createJevClient, type JevClient, type JevAnswer } from '../../../../services/api/src/providers/jev/client.js';
import { createLayaClient } from '../../../../services/api/src/providers/laya/client.js';
import { createJudge } from '../../../../services/api/src/providers/jev/judgment.js';
import { createExaPaidSearch } from '../../../../services/api/src/providers/exa/paid-search.js';
import { createExaSearcher } from '../../../../services/api/src/providers/exa/search.js';
import { PipelineRuntime } from '../../../../services/api/src/runtime/pipeline.js';
import { ClaimCache } from '../../../../services/api/src/runtime/claim-cache.js';
import { Session } from '../../../../services/api/src/runtime/session.js';
import { AttemptBudget } from '../../../../services/api/src/runtime/budget.js';
import { assessVerdict } from '../../../../services/api/src/policy/verdict.js';
import { loadDomainLists, rankEvidence, sourceTraits } from '../../../../services/api/src/sources/index.js';
import { loadSets, fitContext, type EvalCase } from '../eval-live/sets.js';
import { labelTerminal, expectedLabel, type EvalLabel } from '../eval-live/labels.js';
import { z } from 'zod';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PromptPack } from '../../../../services/api/src/providers/prompt-pack.js';
import { acquireLock } from './lock.js';
import { providerSummaries } from './summary.js';

export type CohortCase = { id: string; text: string; expected: 'true' | 'false' | 'misleading' | 'cant_verify'; category: string; rationale: string; sources: string[]; ambiguousLabel?: boolean; alternativeExpected?: string[] };
export type FrozenCase = { id: string; text: string; primary: Evidence[]; alternate: Evidence[]; acquisition: { primaryMs: number; alternateMs: number; attempts: number; inputTokens: number; knownCostUSD: number | null; unknownCostResponses: number; errors: string[] } };
export type AskObservation = { stage: string; durationMs: number; questions: number; stateBytes: number; inputTokens: number; outcome: string; verdict?: string; verdictProbability?: number; truncated?: boolean; stateTokensDropped?: number; truncatedQuestions?: number; serverInferenceMs?: number; answers?: Record<string, JevAnswer>; knownCostUSD?: number | null };
export type Observation = { provider: string; mode: string; id: string; repetition: number; expected: string; predicted: string; reasonCode: string | null; durationMs: number; admission?: { action: string; claims: number; checkedTexts?: string[] }; asks: AskObservation[]; error?: string; stageMs?: { admission: number; retrieval: number; judgment: number }; events?: string[]; judgment?: { modelLabel: string; ruleLabel: string; selected: string[] }; evidenceCount?: number; ambiguousLabel?: boolean; alternativeExpected?: string[]; acquisitionErrors?: string[]; admissionMismatch?: boolean; terminalCount?: number; postDeadlineDrainMs?: number; dataset?: string };
const root = new URL('../../../../fixtures/evaluation/provider-comparison/', import.meta.url);
const lists = loadDomainLists();
const code = (error: unknown) => error instanceof PipelineError ? error.code : error instanceof Error && /^[a-z0-9_]{1,80}$/i.test(error.message) ? error.message : 'unexpected_error';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function jsonFile<T>(path: string | URL): Promise<T> { return JSON.parse(await readFile(path, 'utf8')) as T; }
export async function save(path: string | URL, data: unknown) { await mkdir(dirname(path instanceof URL ? path.pathname : path), { recursive: true }); await writeFile(path, `${JSON.stringify(data, null, 2)}\n`); }
export const cohortPath = new URL('cohort.json', root);
export const frozenPath = new URL('frozen-evidence.json', root);
export async function loadCohort(path: string | URL = cohortPath) { const loaded = await jsonFile<{ cases: CohortCase[] }>(path); if (!loaded.cases?.length) throw new Error('cohort_missing'); return loaded.cases; }
const admissionFileSchema = z.array(z.object({ id: z.string().min(1), text: z.string().min(1), context: z.array(z.string()).max(2).default([]), mode: z.enum(['typed', 'audio']).default('typed'),
  confidence: z.number().min(0).max(1).nullable().optional(), lowConfidenceWords: z.array(lowConfidenceWordSchema).max(MAX_LOW_CONFIDENCE_WORDS).optional(), expected: z.string() }).passthrough());
/** Admission cases from a file: a JSON array (or `{cases}`) of {id, text, expected, context?, mode?, confidence?, lowConfidenceWords?}. `expected` takes the usual labels; not_a_claim and needs_confirmation are the negatives. */
export async function loadAdmissionCases(path: string): Promise<EvalCase[]> {
  const raw = await jsonFile<unknown>(path); const list = Array.isArray(raw) ? raw : (raw as { cases?: unknown })?.cases;
  const parsed = admissionFileSchema.safeParse(list);
  if (!parsed.success || !parsed.data.length) throw new Error(`admission_cases_invalid: ${parsed.success ? 'empty' : parsed.error.issues[0]?.path.join('.')}`);
  const ids = new Set<string>();
  return parsed.data.map(item => { if (ids.has(item.id)) throw new Error(`admission_cases_duplicate_id: ${item.id}`); ids.add(item.id);
    return { set: 'everyday' as const, id: item.id, text: item.text, context: fitContext(item.context), mode: item.mode, confidence: item.confidence ?? (item.mode === 'audio' ? null : 1), ...(item.lowConfidenceWords?.length ? { lowConfidenceWords: item.lowConfidenceWords } : {}), expected: expectedLabel(item.expected) }; });
}
export function accepted(text: string, id: string): AcceptedClaim { return { id, originalText: text, checkedText: text, sourceSpan: { start: 0, end: Array.from(text).length }, admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' } }; }
export function makeInput(sample: Pick<EvalCase, 'text' | 'context' | 'mode' | 'confidence' | 'lowConfidenceWords'>, sessionId: string, requestId: string): TextInput {
  return { schemaVersion: 1, requestId, sessionId, sessionEpoch: 1, revision: 1, mode: sample.mode, text: sample.text, language: 'en', capturedAt: new Date().toISOString(), capture: { source: 'typed_fixture', segmentId: requestId, confidence: sample.confidence ?? 1, final: true, ...(sample.lowConfidenceWords ? { lowConfidenceWords: sample.lowConfidenceWords } : {}) }, context: sample.context, userInitiated: true };
}
/** The original frozen evidence is the published baseline; acquisition always writes somewhere else. */
export function assertNotFrozenBaseline(output: string | URL) {
  const target = resolvePath(output instanceof URL ? fileURLToPath(output) : output);
  if (target === resolvePath(fileURLToPath(frozenPath))) throw new Error('refusing_to_overwrite_frozen_evidence');
}
export async function acquire(cases: CohortCase[], output: string | URL) {
  assertNotFrozenBaseline(output);
  if (!process.env.EXA_API_KEY) throw new Error('missing_exa_key');
  const frozen: FrozenCase[] = [];
  let knownCostUSD = 0, unknownCostResponses = 0;
  const fetcher: typeof fetch = async (url, init) => { const response = await fetch(url, init); const body = await response.clone().json().catch(() => null) as { costDollars?: { total?: number } } | null; const cost = body?.costDollars?.total; if (typeof cost === 'number') knownCostUSD += cost; else unknownCostResponses++; return response; };
  const paid = createExaPaidSearch({ exa: createExaSearcher({ apiKey: process.env.EXA_API_KEY, fetch: fetcher }), lists });
  for (const sample of cases) {
    const previousCost = knownCostUSD, previousUnknown = unknownCostResponses;
    const budget = new AttemptBudget(); const context = budget.context(AbortSignal.timeout(30_000), Date.now, Date.now() + 30_000);
    const query = sourceQuery(accepted(sample.text, sample.id), Date.now()); const errors: string[] = [];
    let primary: Evidence[] = [], alternate: Evidence[] = [];
    let start = performance.now();
    try { primary = (await paid.search(query, { purpose: 'primary' }, context)).evidence; } catch (error) { errors.push(`primary:${code(error)}`); }
    const primaryMs = performance.now() - start; start = performance.now();
    try { alternate = (await paid.search(query, { purpose: 'alternate' }, context)).evidence; } catch (error) { errors.push(`alternate:${code(error)}`); }
    const alternateMs = performance.now() - start;
    frozen.push({ id: sample.id, text: sample.text, primary, alternate, acquisition: { primaryMs, alternateMs, attempts: budget.used('search', sample.id), inputTokens: budget.inputTokens, knownCostUSD: knownCostUSD - previousCost, unknownCostResponses: unknownCostResponses - previousUnknown, errors } });
    await save(output, { schemaVersion: 1, acquiredAt: new Date().toISOString(), method: 'live Exa primary and balanced alternate; official normalization; unchanged retained excerpts', cohortSHA256: digest(cases), cases: frozen });
    console.log(JSON.stringify({ acquired: sample.id, primary: primary.length, alternate: alternate.length, errors }));
  }
}
export type LayaLimits = { maxLen: number; headMaxLen: number };
export function instrument(provider: string, asks: AskObservation[], limits?: LayaLimits): JevClient {
  let active: AskObservation | undefined;
  const inner = provider === 'jev' ? createJevClient({ apiKey: process.env.JEV_API_KEY ?? '', fetch: async (url, init) => { const response = await fetch(url, init); const decoded = await response.clone().json().catch(() => null) as { usage?: { cost?: number; cost_usd?: number } } | null; if (active) active.knownCostUSD = decoded?.usage?.cost_usd ?? decoded?.usage?.cost ?? null; return response; } }) : createLayaClient({ url: process.env.LAYA_URL ?? 'http://127.0.0.1:8765', ...(limits ? { fetch: (url, init) => fetch(url, { ...init, body: JSON.stringify({ ...JSON.parse(String(init?.body)), max_len: limits.maxLen, head_max_len: limits.headMaxLen }) }) } : {}), diagnostic: (event, fields) => { if (active) Object.assign(active, { truncated: event === 'truncated', stateTokensDropped: fields.stateTokensDropped, truncatedQuestions: fields.truncatedQuestions, serverInferenceMs: fields.inferenceMs }); } });
  return { async ask(request, context) {
    const entry: AskObservation = { stage: Object.hasOwn(request.questions, 'verdict') ? 'judgment' : 'admission', durationMs: 0, questions: Object.keys(request.questions).length, stateBytes: Buffer.byteLength(JSON.stringify(request.state)), inputTokens: 0, outcome: 'pending' };
    asks.push(entry); active = entry; const start = performance.now();
    try { const answers = await inner.ask(request, { ...context, recordUsage: usage => { entry.inputTokens += usage.inputTokens ?? 0; context.recordUsage?.(usage); } }); entry.outcome = 'success'; entry.answers = answers; entry.verdict = answers.verdict?.choice; entry.verdictProbability = entry.verdict ? answers.verdict?.probabilities?.[entry.verdict] : undefined; return answers; }
    catch (error) { entry.outcome = code(error); throw error; }
    finally { entry.durationMs = performance.now() - start; active = undefined; }
  } };
}
export function replaySources(frozen: FrozenCase) {
  const validate = (text: string, subject: string | null) => { if (text !== frozen.text || subject !== null) throw new PipelineError('unmatched_replay_proposition'); };
  return {
    async gatherFree(query: Parameters<import('../../../../packages/contracts/src/index.js').EvidenceSources['gatherFree']>[0]) { validate(query.text, query.subject); return { evidence: [], answered: { fact_check: null, wikipedia: null, wikidata: null, weather: null, calculation: null } }; },
    async searchPaid(query: Parameters<import('../../../../packages/contracts/src/index.js').EvidenceSources['searchPaid']>[0], request: Parameters<import('../../../../packages/contracts/src/index.js').EvidenceSources['searchPaid']>[1], context: ProviderContext) {
      validate(query.text, query.subject); context.consume('search', query.claimId);
      const evidence = structuredClone(request.purpose === 'primary' ? frozen.primary : frozen.alternate).filter(record => !request.excludeSites?.includes(sourceTraits(record, null, lists).site));
      return { evidence, categories: ['web' as const] };
    },
    rank: (free: Evidence[], paid: Evidence[], future = false) => rankEvidence(free, paid, lists, future),
    traits: (evidence: Evidence, attribution: Parameters<typeof sourceTraits>[1]) => sourceTraits(evidence, attribution, lists),
  };
}
export async function waitForRequestSettlement(settled: () => boolean, deadlineMs = 10_500): Promise<boolean> {
  const started = performance.now();
  while (!settled()) { if (performance.now() - started >= deadlineMs) return false; await new Promise(resolve => setTimeout(resolve, 5)); }
  return true;
}
export function settledOutcome(terminals: Pick<EventEnvelope, 'type' | 'payload'>[], settled: boolean): Pick<Observation, 'predicted' | 'reasonCode' | 'error'> {
  if (!settled) return { predicted: 'error', reasonCode: 'runtime_not_settled', error: 'runtime_not_settled' };
  const terminal = terminals.find(event => event.type === 'pipeline.error') ?? terminals.at(-1);
  if (!terminal) return { predicted: 'error', reasonCode: 'missing_runtime_terminal', error: 'missing_runtime_terminal' };
  const mapped = labelTerminal({ type: terminal.type as 'claim.result', payload: terminal.payload });
  return { predicted: mapped.label, reasonCode: mapped.reasonCode, ...(terminal.type === 'pipeline.error' ? { error: mapped.reasonCode ?? 'pipeline_error' } : {}) };
}
export async function pipelineCase(provider: string, sample: CohortCase, frozen: FrozenCase, repetition: number, pack?: PromptPack, deadlineMs = 10_000): Promise<Observation> {
  const asks: AskObservation[] = []; const client = instrument(provider, asks); const classifier = createClassifier(client, pack);
  const observation: Observation = { provider, mode: 'pipeline', id: sample.id, repetition, expected: sample.expected, ambiguousLabel: 'ambiguousLabel' in sample ? sample.ambiguousLabel : undefined, alternativeExpected: 'alternativeExpected' in sample ? sample.alternativeExpected : undefined, predicted: 'error', reasonCode: null, durationMs: 0, asks, events: [] };
  const runtime = new PipelineRuntime({ classify: async (input, context) => { const result = await classifier(input, context); observation.admission = { action: result.action, claims: result.claims.length, checkedTexts: result.claims.map(claim => claim.checkedText) }; return result; }, judge: createJudge(client, pack), ...(pack ? { verdictRules: pack.judge.policy } : {}), retrieve: async () => { throw new PipelineError('unexpected_legacy_retrieval'); }, sources: replaySources(frozen), cache: new ClaimCache() }, Date.now, () => performance.now(), provider === 'jev' ? MODEL_VERSION : 'laya-20260512', deadlineMs);
  const session = new Session(Date.now); const requestId = randomUUID(); const input = makeInput({ text: sample.text, context: [], mode: 'typed', confidence: 1 }, session.id, requestId); const start = performance.now();
  const terminals: EventEnvelope[] = [];
  session.listeners.add(event => { if (event.requestId !== requestId) return; observation.events!.push(event.type); if (['claim.result', 'pipeline.error', 'claim.skipped', 'claim.needs_confirmation', 'check.cancelled'].includes(event.type)) terminals.push(event); });
  runtime.submit(session, input);
  // A request can emit a result for one admitted span and continue with another.
  // Wait until the complete runtime request settles before mapping its outcome.
  const settled = await waitForRequestSettlement(() => session.requests.get(requestId)?.state === 'done' && session.running === 0);
  observation.durationMs = performance.now() - start;
  observation.terminalCount = terminals.length;
  Object.assign(observation, settledOutcome(terminals, settled));
  observation.stageMs = runtime.metrics.at(-1)?.stageMs;
  if (observation.admission?.action === 'check' && (observation.admission.claims !== 1 || observation.admission.checkedTexts?.[0] !== sample.text)) { observation.admissionMismatch = true; observation.predicted = 'error'; observation.error = 'admission_proposition_mismatch'; }
  session.pause('benchmark_complete'); return observation;
}
export async function judgeCase(provider: string, sample: CohortCase, frozen: FrozenCase, repetition: number, deadlineMs = 10_000, limits?: LayaLimits, pack?: PromptPack): Promise<Observation> {
  const asks: AskObservation[] = []; const client = instrument(provider, asks, limits); const evidence = rankEvidence([], frozen.primary, lists); const start = performance.now();
  const observation: Observation = { provider, mode: limits ? 'judge_context_diagnostic' : deadlineMs === 10_000 ? 'judge' : 'judge_extended', id: sample.id, repetition, expected: sample.expected, ambiguousLabel: 'ambiguousLabel' in sample ? sample.ambiguousLabel : undefined, alternativeExpected: 'alternativeExpected' in sample ? sample.alternativeExpected : undefined, predicted: 'error', reasonCode: null, durationMs: 0, asks, evidenceCount: evidence.length };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new PipelineError('timeout')), deadlineMs); const context = new AttemptBudget().context(controller.signal, Date.now, Date.now() + deadlineMs);
  try { const claim = accepted(sample.text, sample.id); const judgment = await createJudge(client, pack)(claim, structuredClone(evidence), context); const assessment = assessVerdict(judgment, { checkedText: sample.text, frame: claimFrame(claim), traits: judgment.evidence.map(record => sourceTraits(record, null, lists)) }, undefined, pack?.judge.policy); observation.predicted = ({ supported: 'true', contradicted: 'false', misleading: 'misleading', insufficient_evidence: 'cant_verify', speculation: 'speculation' })[assessment.decision.verdict]; observation.reasonCode = assessment.decision.reasonCode; observation.judgment = { modelLabel: judgment.label, ruleLabel: assessment.ruleLabel, selected: assessment.decision.selectedEvidenceIds }; }
  catch (error) { observation.error = code(error); observation.reasonCode = observation.error; }
  finally { clearTimeout(timer); observation.durationMs = performance.now() - start; }
  return observation;
}
export async function admissionCase(provider: string, sample: EvalCase, repetition: number, deadlineMs = 10_000, pack?: PromptPack): Promise<Observation> {
  const asks: AskObservation[] = []; const client = instrument(provider, asks); const start = performance.now(); const observation: Observation = { provider, mode: 'admission', id: sample.id, repetition, expected: sample.expected, predicted: 'error', reasonCode: null, durationMs: 0, asks };
  observation.dataset = sample.id.startsWith('dev-') ? 'synthetic_device' : 'reference_everyday';
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new PipelineError('timeout')), deadlineMs);
  try { const result: AdmissionResult = await createClassifier(client, pack)(makeInput(sample, 'benchmark', sample.id), new AttemptBudget().context(controller.signal, Date.now, Date.now() + deadlineMs)); observation.admission = { action: result.action, claims: result.claims.length }; observation.predicted = result.action === 'check' ? 'check' : result.kind ? 'not_a_claim' : result.action; observation.reasonCode = result.reasonCode; }
  catch (error) { observation.error = code(error); observation.reasonCode = observation.error; }
  finally { clearTimeout(timer); observation.durationMs = performance.now() - start; }
  return observation;
}
const quantile = (values: number[], q: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] : null; };
export function summarize(rows: Observation[]) {
  return [...new Set(rows.map(row => `${row.provider}/${row.mode}`))].map(group => {
    const data = rows.filter(row => `${row.provider}/${row.mode}` === group); const asks = data.flatMap(row => row.asks); const claimExpected = (label: string) => !['not_a_claim', 'needs_confirmation'].includes(label);
    const truePositive = data.filter(row => row.admission?.action === 'check' && claimExpected(row.expected)).length;
    const falsePositive = data.filter(row => row.admission?.action === 'check' && !claimExpected(row.expected)).length;
    const positives = data.filter(row => claimExpected(row.expected)).length;
    const definitive = data.filter(row => ['true', 'false', 'misleading'].includes(row.predicted));
    return { group, n: data.length, correct: data.filter(row => row.mode === 'admission' ? !row.error && (row.admission?.action === 'check') === claimExpected(row.expected) : row.expected === row.predicted).length, sensitivityCorrect: data.filter(row => row.expected === row.predicted || row.alternativeExpected?.includes(row.predicted)).length, unambiguous: { n: data.filter(row => !row.ambiguousLabel).length, correct: data.filter(row => !row.ambiguousLabel && row.expected === row.predicted).length }, errors: data.filter(row => row.error).length, abstentions: data.filter(row => row.predicted === 'cant_verify').length, skipped: data.filter(row => ['skip', 'not_a_claim', 'needs_confirmation', 'wait'].includes(row.predicted)).length, definitive: definitive.length, definitiveCorrect: definitive.filter(row => row.predicted === row.expected).length, admission: { truePositive, falsePositive, expectedPositive: positives, precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null, recall: positives ? truePositive / positives : null }, durationMs: { p50: quantile(data.map(row => row.durationMs), .5), p95: quantile(data.map(row => row.durationMs), .95) }, askMs: { n: asks.length, p50: quantile(asks.map(ask => ask.durationMs), .5), p95: quantile(asks.map(ask => ask.durationMs), .95) }, truncatedAsks: asks.filter(ask => ask.truncated).length, inputTokens: asks.reduce((sum, ask) => sum + ask.inputTokens, 0), errorCodes: Object.fromEntries([...new Set(data.flatMap(row => row.error ? [row.error] : []))].map(error => [error, data.filter(row => row.error === error).length])) };
  });
}
export async function waitForLayaIdle(): Promise<number> {
  const start = performance.now();
  for (;;) {
    // Routing shares the server admission slot and worker but performs no inference.
    // With LAYA_MAX_CONCURRENT=1, success proves a timed-out forward has drained.
    const response = await fetch(`${(process.env.LAYA_URL ?? 'http://127.0.0.1:8765').replace(/\/+$/, '')}/v1/route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'english', state: '', questions: {} }), signal: AbortSignal.timeout(5000) });
    await response.arrayBuffer();
    if (response.ok) return performance.now() - start;
    if (response.status !== 503 || performance.now() - start > 60_000) throw new Error('laya_drain_failed');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
export type RunOptions = {
  providers: string[]; modes: string[]; limit?: number; repetitions: number; output: string; deadlineMs?: number; layaLimits?: LayaLimits;
  /** Prompt pack per provider; a provider without one uses the built-in pack. */
  packs?: Record<string, PromptPack>; packFiles?: Record<string, string>;
  admissionCasesPath?: string; casesPath?: string; evidencePath?: string;
  /** Eval only: the per-request deadline for Laya admission and judgment calls. Pipeline mode passes it to the runtime for Laya only; Jev keeps 10 s. */
  layaDeadlineMs?: number;
  /** A cross-process lock directory held for every Laya case (the deadline starts after it is acquired). */
  lockPath?: string; summaryPath?: string; dataset?: 'dev' | 'holdout';
};
export async function run(options: RunOptions) {
  const needsEvidence = options.modes.some(mode => mode !== 'admission');
  const cases = needsEvidence ? await loadCohort(options.casesPath ?? cohortPath) : [];
  const frozen = needsEvidence ? await jsonFile<{ cases: FrozenCase[]; cohortSHA256: string }>(options.evidencePath ?? frozenPath) : { cases: [], cohortSHA256: digest([]) };
  if (frozen.cohortSHA256 !== digest(cases)) throw new Error('frozen_cohort_hash_mismatch');
  const everyday = options.modes.includes('admission') ? options.admissionCasesPath ? await loadAdmissionCases(options.admissionCasesPath) : await loadSets(['everyday']) : [];
  const dataset = options.dataset ?? 'dev';
  const { packs, ...recorded } = options;
  const rows: Observation[] = []; const flush = async () => { await save(options.output, { schemaVersion: 1, startedAt, updatedAt: new Date().toISOString(), modelVersion: MODEL_VERSION, policyVersion: POLICY_VERSION, cohortSHA256: digest(cases), evidenceSHA256: digest(frozen), options: { ...recorded, promptPacks: Object.fromEntries(Object.entries(packs ?? {}).map(([name, pack]) => [name, { name: pack.name, sha256: digest(pack) }])) }, summary: summarize(rows), providerSummaries: providerSummaries(rows, options.providers, dataset), observations: rows }); if (options.summaryPath) await save(options.summaryPath, providerSummaries(rows, options.providers, dataset)); }; const startedAt = new Date().toISOString();
  const layaDeadline = options.layaDeadlineMs ?? 10_000;
  for (let repetition = 0; repetition < options.repetitions; repetition++) for (const mode of options.modes) {
    const selected = (mode === 'admission' ? everyday : cases).slice(0, options.limit);
    for (const sample of selected) for (const provider of repetition % 2 ? [...options.providers].reverse() : options.providers) {
      const evidence = frozen.cases.find(entry => entry.id === sample.id);
      const pack = packs?.[provider]; const isLaya = provider === 'laya';
      const deadline = isLaya ? layaDeadline : options.deadlineMs;
      // Serialise Laya inference across harness processes. The case's own clock only starts once the lock is ours.
      const release = isLaya && options.lockPath ? await acquireLock(options.lockPath) : undefined;
      let row: Observation;
      try {
        row = mode === 'admission' ? await admissionCase(provider, sample as EvalCase, repetition, isLaya ? layaDeadline : 10_000, pack) : !evidence ? (() => { throw new Error('missing_frozen_case'); })() : mode === 'pipeline' ? await pipelineCase(provider, sample as CohortCase, evidence, repetition, pack, isLaya ? layaDeadline : 10_000) : await judgeCase(provider, sample as CohortCase, evidence, repetition, deadline, options.layaLimits, pack);
        if (evidence?.acquisition.errors.length && mode !== 'admission') { row.acquisitionErrors = evidence.acquisition.errors; row.predicted = 'error'; row.error = 'acquisition_failure'; }
        rows.push(row); await flush(); if (isLaya && row.error === 'timeout') { row.postDeadlineDrainMs = await waitForLayaIdle(); await flush(); }
      } finally { await release?.(); }
      console.log(JSON.stringify({ provider, mode: row.mode, id: sample.id, predicted: row.predicted, ms: Math.round(row.durationMs), error: row.error }));
    }
  }
  return { observations: rows, summary: summarize(rows), providers: providerSummaries(rows, options.providers, dataset) };
}
export type { EvalLabel };
