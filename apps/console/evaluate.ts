import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import WebSocket from 'ws';
import {
  MODEL_VERSION, POLICY_VERSION, PipelineError, sliceSpan, type AcceptedClaim, type AdmissionMetadata, type AdmissionResult, type Evidence,
  type EventEnvelope, type PipelineAdapters, type Presentation, type PresentationState, type ProviderContext, type TextInput, type Verdict,
} from '../../packages/contracts/src/index.js';
import { createClassifier } from '../../services/api/src/providers/jev/classification.js';
import { createJevClient, type JevAnswer, type JevRequest } from '../../services/api/src/providers/jev/client.js';
import { decideVerdict } from '../../services/api/src/policy/verdict.js';
import { decidePresentation } from '../../services/api/src/policy/notifications.js';
import type { AssessedJudgment } from '../../services/api/src/policy/assessment.js';
import { buildServer } from '../../services/api/src/transport/server.js';
import actionFixtures from '../../fixtures/actions/presentation-cases.json' with { type: 'json' };

type SemanticFixture = {
  kind: string; selfContained: number; privateData: number;
  assertionStatus: string; hasPracticalConsequence: number | null;
  claimStructure?: 'one_coherent' | 'multiple_propositions' | 'unclear';
};
export type EvaluationCase = {
  id: string; category: 'personal' | 'public' | 'mixed' | 'capture' | 'service'; split: 'development' | 'heldout';
  text: string; intent: 'manual' | 'automatic'; capture: { mode: 'typed' | 'ocr'; confidence: number; final: boolean };
  expected: { admission: AdmissionResult['action']; presentation: Presentation['action']; verdict: Verdict | null; checkedTexts?: string[]; errorCode?: string };
  modelFixture: SemanticFixture; candidateModelFixtures?: Record<string, SemanticFixture>;
  evidenceFixture: 'none' | 'support' | 'contradict' | 'conflict' | 'echo' | 'omitted_condition'; scenario: string;
};
type Observation = {
  id: string; category: string; status: 'pass' | 'fail' | 'not_run'; method?: 'scripted_policy_fixture' | 'injected_runtime_transport'; durationMs?: number;
  testedStages: string[]; mismatches: string[];
  admission?: AdmissionResult['action']; presentation?: Presentation['action']; verdict?: Verdict; errorCode?: string;
  expectedPresentation?: Presentation['action']; note?: string;
};
const FIXED_NOW = Date.parse('2026-11-14T12:00:00Z');
const manifestUrl = new URL('../../fixtures/evaluation/cases.json', import.meta.url);

type ManifestEntry = { id: string; category: EvaluationCase['category']; split: EvaluationCase['split'] };
type EvaluationManifest = { schemaVersion: 1; cases: ManifestEntry[] };
export async function loadManifest(): Promise<EvaluationManifest> {
  return JSON.parse(await readFile(manifestUrl, 'utf8')) as EvaluationManifest;
}

export async function loadCases(split: 'development' | 'heldout' = 'development'): Promise<EvaluationCase[]> {
  const manifest = await loadManifest();
  const selected = manifest.cases.filter(entry => entry.split === split);
  const filename = split === 'development' ? 'cases-development.json' : 'cases-heldout.json';
  const data = JSON.parse(await readFile(new URL(`../../fixtures/evaluation/${filename}`, import.meta.url), 'utf8')) as { cases: EvaluationCase[] };
  const selectedIds = new Set(selected.map(entry => entry.id));
  const cases = data.cases.filter(sample => selectedIds.has(sample.id));
  if (cases.length !== selected.length) throw new Error(`Evaluation manifest/body mismatch for ${split} split`);
  return cases;
}

/** The fixtures' kinds, mapped onto the classifier's SelectionKind. Completeness and privacy come from their own scripted answers. */
const SELECTION_KINDS: Record<string, string> = { public_fact: 'claim', personal_experience: 'claim', mixed: 'claim', incomplete_or_unclear: 'claim', opinion: 'opinion', prediction: 'prediction' };

/**
 * Scripted answers to the classifier's questions. Each candidate is stated in the speaker's own voice, names its own subject and
 * is no rumour, future claim or private-life allegation. The classifier no longer asks for assertion status, so it is not scripted.
 */
function fixtureAnswers(request: JevRequest, sample: EvaluationCase): Record<string, JevAnswer> {
  const state = request.state as { candidates: Array<{ id: string; text: string }> };
  const answers: Record<string, JevAnswer> = {};
  for (const [name, question] of Object.entries(request.questions)) {
    // The scripted model reads a low OCR confidence as a likely misreading.
    if (name === 'misheard') { answers[name] = { noul: sample.capture.confidence < 0.5 ? 0.9 : 0.05 }; continue; }
    const candidate = state.candidates.find(entry => name.startsWith(`${entry.id}_`));
    if (!candidate) throw new Error('Unexpected classifier question');
    const semantic = sample.candidateModelFixtures?.[candidate.text] ?? sample.modelFixture;
    const field = name.slice(candidate.id.length + 1);
    if (question.type === 'choice') {
      const choice = field === 'kind' ? semantic.kind === 'question_or_instruction' ? candidate.text.trim().endsWith('?') ? 'question' : 'instruction' : SELECTION_KINDS[semantic.kind]
        : field === 'route' ? 'general'
        : field === 'claim_structure' ? semantic.claimStructure ?? (candidate.id === 'span_0' && state.candidates.length > 1 ? 'multiple_propositions' : 'one_coherent')
        : field === 'attribution' || field === 'source' || field === 'subject' ? 'none' : undefined;
      if (choice === undefined) throw new Error('Unexpected classifier question');
      answers[name] = { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(option => [option, Number(option === choice)])) };
      continue;
    }
    const scripted: Record<string, number | null> = { self_contained: semantic.selfContained, private_data: semantic.privateData, practical: semantic.hasPracticalConsequence,
      preserves_scope: 1, private_life: 0, rumour: 0, future: 0, subject_private: 0 };
    if (!Object.hasOwn(scripted, field)) throw new Error('Unexpected classifier question');
    answers[name] = { noul: scripted[field] };
  }
  return answers;
}

/** Explicitly assessed synthetic passages exercise policy mechanics; none is live evidence. */
function fixtureJudgment(sample: EvaluationCase, checkedText: string): AssessedJudgment {
  const recipe = sample.evidenceFixture;
  const label: Verdict = recipe === 'none' ? 'insufficient_evidence' : recipe === 'contradict' ? 'contradicted' : recipe === 'omitted_condition' ? 'misleading' : 'supported';
  // Only propositions with concrete, predeclared synthetic records receive
  // substantive assessments. Unknown fixture propositions fail closed.
  const records: [string, string] | undefined = checkedText === 'Helsinki is the capital of Finland.' ? [
    'SYNTHETIC municipal register F-1 lists Helsinki as Finland’s national capital and records the national parliament and central government there.',
    'SYNTHETIC independent geographic directory G-2 identifies the capital of Finland as Helsinki and describes its administrative role.',
  ] : /^(?:I think )?Helsinki is the capital of Norway\.$/.test(checkedText) ? [
    'SYNTHETIC national register N-1 lists Oslo as Norway’s sole national capital and identifies Helsinki as the capital of Finland.',
    'SYNTHETIC independent diplomatic directory D-2 records Norway’s central government in Oslo and Finland’s capital in Helsinki.',
  ] : checkedText === 'Lightning never strikes the same place twice.' ? [
    'SYNTHETIC meteorological observation log L-1 records repeated lightning strikes at the same marked tower coordinates during separate storms.',
    'SYNTHETIC independent university field experiment U-2 used tower-mounted sensors to record two lightning impacts at the identical location in one storm.',
  ] : undefined;
  const source = (index: number, stance: Evidence['stance']): Evidence => ({
    id: `synthetic-${index}`, url: index === 1 ? 'https://example.org/fixture' : 'https://example.net/fixture',
    title: `Synthetic policy passage ${index}`, publisher: null, publishedAt: null,
    retrievedAt: new Date(FIXED_NOW).toISOString(), contentBasis: 'page_text',
    excerpt: records?.[index - 1] ?? (recipe === 'conflict'
      ? index === 1 ? 'SYNTHETIC lab record T-1 reports successful device operation in every tested temperature range under its stated protocol.' : 'SYNTHETIC independent freezer experiment F-2 records failure of the device below minus ten degrees, contradicting operation in every range.'
      : recipe === 'echo' ? 'SYNTHETIC manufacturer advertisement PR-1 asserts that its battery accessory doubles battery life without disclosing independently measured results.'
      : 'SYNTHETIC unreviewed fixture assertion with no established substantive basis for this proposition.'),
    sourceGroup: index === 1 ? 'example.org' : 'example.net', echoGroup: null, sourceRole: 'secondary',
    directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance, stanceProbability: 0.95,
  });
  const evidence = recipe === 'none' ? [] : [source(1, label === 'contradicted' ? 'contradicts' : 'supports'), source(2, label === 'contradicted' ? 'contradicts' : 'supports')];
  if (recipe === 'conflict') evidence[1].stance = 'contradicts';
  if (recipe === 'echo') {
    evidence[0].echoGroup = 'shared-release'; evidence[1].echoGroup = 'shared-release';
    evidence[1].excerpt = evidence[0].excerpt;
  }
  // Fixture-only source quality describes the invented passages, not publisher
  // provenance. Promotions, unknown claims and unclear origins stay inadequate.
  const basis = records || recipe === 'conflict' ? 'original_record' as const : recipe === 'echo' ? 'promotional' as const : 'unclear' as const;
  const relationship = recipe === 'echo' ? 'common_origin' as const : records || recipe === 'conflict' ? 'distinct_origins' as const : 'unclear' as const;
  return {
    checkedText, label, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 0, [label]: 1 }, evidence,
    selectedEvidenceIds: evidence.map(record => record.id), misleadingReason: recipe === 'omitted_condition' ? 'omitted_condition' : null,
    misleadingEvidenceIds: recipe === 'omitted_condition' ? evidence.map(record => record.id) : [],
    sourceAssessments: Object.fromEntries(evidence.map(record => [record.id, {
      contentBasis: basis,
      confidence: 0.99,
    }])),
    claimRisk: { level: records ? 'ordinary' : 'unknown', confidence: 0.99 },
    originAssessments: evidence.length === 2 ? [{ evidenceIds: [evidence[0].id, evidence[1].id], relationship, confidence: 0.99 }] : [],
  };
}

export async function evaluateCase(sample: EvaluationCase): Promise<Observation> {
  if (sample.scenario === 'revision_correction' || sample.scenario === 'provider_timeout') return evaluateRuntimeCase(sample);
  const result: Observation = { id: sample.id, category: sample.category, status: 'pass', method: 'scripted_policy_fixture', testedStages: [], mismatches: [] };
  // These require physical input/output paths and remain unrun in this backend harness.
  if (['hardware_disconnect', 'hardware_tts_feedback'].includes(sample.scenario)) {
    return { ...result, status: 'not_run', note: 'Requires real-device execution; not counted as a passing fixture.' };
  }
  const context: ProviderContext = { signal: new AbortController().signal, consume: () => undefined, now: () => FIXED_NOW };
  const client = createJevClient({ apiKey: 'fixture-only-not-a-secret', fetch: async (_url, init) => {
    if (sample.scenario === 'malformed_provider') return Response.json({ answers: {} });
    const request = JSON.parse(String(init?.body)) as JevRequest;
    return Response.json({ answers: fixtureAnswers(request, sample) });
  } });
  const input: TextInput = {
    schemaVersion: 1, requestId: sample.id, sessionId: 'evaluation', sessionEpoch: 1, revision: 1,
    mode: sample.scenario === 'ocr_low_confidence' ? 'ocr' : 'typed', text: sample.text, language: 'en',
    capturedAt: new Date(FIXED_NOW).toISOString(), capture: { source: 'typed_fixture', segmentId: sample.id, confidence: sample.capture.confidence, final: sample.capture.final },
    context: [], userInitiated: sample.intent === 'manual',
  };
  try {
    const admission = await createClassifier(client)(input, context);
    result.testedStages.push('admission'); result.admission = admission.action;
    if (admission.action !== sample.expected.admission) result.mismatches.push(`admission: expected ${sample.expected.admission}, received ${admission.action}`);
    if (sample.expected.checkedTexts && JSON.stringify(admission.claims.map(claim => claim.checkedText)) !== JSON.stringify(sample.expected.checkedTexts)) result.mismatches.push('checked spans differ from independently labeled public spans');
    for (const claim of admission.claims) {
      if (sliceSpan(input.text, claim.sourceSpan) !== claim.checkedText) result.mismatches.push('sourceSpan does not preserve the exact Unicode code-point slice');
      const decision = decideVerdict(fixtureJudgment(sample, claim.checkedText));
      result.testedStages.push('verdict'); result.verdict = decision.verdict;
      if (sample.expected.verdict !== decision.verdict) result.mismatches.push(`verdict: expected ${sample.expected.verdict}, received ${decision.verdict}`);
      const state: PresentationState = {
        active: sample.scenario !== 'stop', healthy: true, current: true, expired: sample.scenario === 'expired',
        duplicate: sample.scenario === 'duplicate' || sample.scenario === 'repeat', notificationCount: sample.scenario === 'budget_exhausted' ? 3 : 0,
      };
      const presentation = decidePresentation({ ...decision, admission: claim.admission }, sample.scenario === 'repeat' ? 'repeat' : sample.intent, state,
        { muted: sample.scenario === 'muted', automaticNotifications: true, selectedTopics: [] });
      result.testedStages.push('presentation'); result.presentation = presentation.action; result.expectedPresentation = sample.expected.presentation;
      if (presentation.action !== sample.expected.presentation) result.mismatches.push(`presentation: expected ${sample.expected.presentation}, received ${presentation.action}`);
    }
    if (sample.expected.errorCode) result.mismatches.push(`expected operational error ${sample.expected.errorCode}`);
    if (!admission.claims.length) result.note = 'Admission only; no evidence verdict or transport-delivered response was tested.';
    else if (['stop', 'expired', 'duplicate', 'budget_exhausted', 'muted'].includes(sample.scenario)) result.note = 'Pure presentation suppression tested with injected state; runtime lifecycle and actual speech were not exercised.';
  } catch (error) {
    result.errorCode = error instanceof PipelineError ? error.code : 'unexpected_error';
    if (result.errorCode === sample.expected.errorCode) result.testedStages.push('provider_error_validation');
    else result.mismatches.push(`unexpected error: ${result.errorCode}`);
  }
  result.status = result.mismatches.length ? 'fail' : 'pass';
  return result;
}

function runtimeClaim(input: TextInput): AcceptedClaim {
  return {
    id: `${input.requestId}-r${input.revision}-candidate-1`, originalText: input.text, checkedText: input.text,
    sourceSpan: { start: 0, end: Array.from(input.text).length },
    admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' },
  };
}

function waitForEvent(events: EventEnvelope[], predicate: (event: EventEnvelope) => boolean, timeoutMs: number): Promise<EventEnvelope> {
  const existing = events.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => {
      const found = events.find(predicate);
      if (found) { resolve(found); return; }
      if (performance.now() - started >= timeoutMs) { reject(new Error('Timed out waiting for evaluation event')); return; }
      setTimeout(poll, 5).unref();
    };
    poll();
  });
}

async function evaluateRuntimeCase(sample: EvaluationCase): Promise<Observation> {
  const started = performance.now();
  const observation: Observation = { id: sample.id, category: sample.category, status: 'pass', method: 'injected_runtime_transport', testedStages: [], mismatches: [] };
  let retrievalAborted = false;
  let providerSignal: AbortSignal | undefined;
  const adapters: PipelineAdapters = {
    classify: async (input: TextInput, context: ProviderContext): Promise<AdmissionResult> => {
      if (sample.scenario === 'provider_timeout') return new Promise((_resolve, reject) => {
        providerSignal = context.signal;
        context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true });
      });
      if (input.revision === 2) return { action: 'needs_confirmation', reasonCode: 'incomplete_or_unclear', claims: [] };
      return { action: 'check', reasonCode: 'eligible_public_claim', claims: [runtimeClaim(input)] };
    },
    retrieve: async (_claim: AcceptedClaim, context: ProviderContext): Promise<Evidence[]> => {
      if (sample.scenario === 'revision_correction') return new Promise((_resolve, reject) => {
        context.signal.addEventListener('abort', () => { retrievalAborted = true; reject(context.signal.reason); }, { once: true });
      });
      return [];
    },
    judge: async (_claim: AcceptedClaim, _evidence: Evidence[], _context: ProviderContext): Promise<AssessedJudgment> => ({
      label: 'insufficient_evidence', probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 },
      evidence: [], selectedEvidenceIds: [], misleadingReason: null,
      sourceAssessments: {}, claimRisk: { level: 'ordinary', confidence: 0.99 }, originAssessments: [],
    }),
  };
  const server = await buildServer({ adapters, mode: 'fixture', joinCode: 'evaluation-only-code', joinExpiresAt: FIXED_NOW + 60_000, now: () => FIXED_NOW });
  let socket: WebSocket | undefined;
  try {
    const address = await server.app.listen({ port: 0, host: '127.0.0.1' });
    observation.testedStages.push('fastify_http');
    const wsOrigin = address.replace('http://', 'ws://');
    const health = await fetch(`${address}/health`).then(response => response.json()) as { status: string; mode: string };
    if (health.status !== 'ok' || health.mode !== 'fixture') observation.mismatches.push('health route did not report fixture mode');
    const wrongJoin = await fetch(`${address}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode: 'wrong-evaluation-code' }) });
    if (wrongJoin.status !== 401) observation.mismatches.push(`unauthorized join expected HTTP 401, received ${wrongJoin.status}`);
    const created = await fetch(`${address}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ joinCode: 'evaluation-only-code' }) });
    if (created.status !== 201) throw new Error(`Evaluation session creation failed: ${created.status}`);
    const session = await created.json() as { sessionId: string; token: string; sessionEpoch: number };
    const events: EventEnvelope[] = [];
    socket = new WebSocket(`${wsOrigin}/v1/sessions/${session.sessionId}/stream`, ['actually-v1', `bearer.${session.token}`]);
    socket.on('message', data => { try { events.push(JSON.parse(data.toString()) as EventEnvelope); } catch { /* malformed wire events are detected by missing expected events */ } });
    await new Promise<void>((resolve, reject) => { socket!.once('open', resolve); socket!.once('error', reject); });
    await waitForEvent(events, event => event.type === 'session.ready', 2_000);
    observation.testedStages.push('authenticated_websocket');
    const headers = { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' };
    const makeInput = (revision: number, text: string) => ({ schemaVersion: 1, requestId: sample.id, sessionId: session.sessionId, sessionEpoch: session.sessionEpoch, revision,
      mode: 'typed', text, language: 'en', capturedAt: new Date(FIXED_NOW).toISOString(), capture: { source: 'typed_fixture', segmentId: sample.id, confidence: 1, final: true }, context: [], userInitiated: true });
    if (sample.scenario === 'revision_correction') {
      const first = await fetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers, body: JSON.stringify(makeInput(1, 'The rate was 70 percent.')) });
      if (first.status !== 202) observation.mismatches.push(`revision 1 expected HTTP 202, received ${first.status}`);
      await waitForEvent(events, event => event.type === 'claim.checking' && event.revision === 1, 2_000);
      const corrected = await fetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers, body: JSON.stringify(makeInput(2, sample.text)) });
      if (corrected.status !== 202) observation.mismatches.push(`revision 2 expected HTTP 202, received ${corrected.status}`);
      await waitForEvent(events, event => event.type === 'claim.needs_confirmation' && event.revision === 2, 2_000);
      observation.testedStages.push('runtime_revision_cancellation', 'correction_confirmation');
      if (!retrievalAborted) observation.mismatches.push('revision 1 provider was not cancelled when revision 2 arrived');
      if (events.some(event => event.type === 'claim.result' && event.revision === 1)) observation.mismatches.push('stale revision 1 result was delivered after correction');
      const checked = events.find(event => event.type === 'claim.checking' && event.revision === 1);
      const confirmation = events.find(event => event.type === 'claim.needs_confirmation' && event.revision === 2);
      if (!checked || !confirmation || checked.eventSeq >= confirmation.eventSeq) observation.mismatches.push('event sequence did not preserve the old check before corrected confirmation');
      if (events.some(event => event.revision && event.revision > 2)) observation.mismatches.push('unexpected revision greater than 2 was emitted');
    } else {
      const response = await fetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers, body: JSON.stringify(makeInput(1, sample.text)) });
      if (response.status !== 202) observation.mismatches.push(`deadline request expected HTTP 202, received ${response.status}`);
      const error = await waitForEvent(events, event => event.type === 'pipeline.error' && event.requestId === sample.id, 12_000);
      observation.testedStages.push('runtime_provider_deadline', 'deadline_cancellation');
      const payload = error.payload as { reasonCode?: string; presentation?: { action?: string } };
      if (payload.reasonCode !== sample.expected.errorCode) observation.mismatches.push(`expected ${sample.expected.errorCode}, received ${payload.reasonCode}`);
      if (payload.presentation?.action !== sample.expected.presentation) observation.mismatches.push(`deadline presentation expected ${sample.expected.presentation}, received ${payload.presentation?.action}`);
      if (!providerSignal?.aborted) observation.mismatches.push('runtime did not abort the hung provider at its deadline');
      if (events.some(event => event.type === 'claim.result' && event.requestId === sample.id)) observation.mismatches.push('deadline produced a factual result instead of an operational error');
    }
    const unauthed = await fetch(`${address}/v1/sessions/${session.sessionId}/checks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(makeInput(1, sample.text)) });
    if (unauthed.status !== 401) observation.mismatches.push(`unauthenticated check expected HTTP 401, received ${unauthed.status}`);
    observation.testedStages.push('auth_and_operational_error_boundary');
  } catch (error) {
    observation.mismatches.push(error instanceof Error ? error.message : 'runtime evaluation failed');
  } finally {
    socket?.close();
    await server.app.close();
  }
  observation.durationMs = Math.round(performance.now() - started);
  observation.status = observation.mismatches.length ? 'fail' : 'pass';
  return observation;
}

export async function runEvaluation(cases: EvaluationCase[], split: 'development' | 'heldout' = 'development', heldoutReserved = 12) {
  const selected = cases.filter(sample => sample.split === split);
  const observations: Observation[] = [];
  for (const sample of selected) observations.push(await evaluateCase(sample));
  const confusion: Record<string, Record<string, number>> = {};
  for (const result of observations) {
    if (!result.expectedPresentation || !result.presentation) continue;
    const row = confusion[result.expectedPresentation] ??= {};
    row[result.presentation] = (row[result.presentation] ?? 0) + 1;
  }
  const sharedActions = actionFixtures.map(fixture => {
    const actual = decidePresentation({ verdict: fixture.verdict as Verdict, admission: {
      assertionStatus: 'asserted', admissionAction: (fixture.admissionAction ?? 'check') as AdmissionMetadata['admissionAction'],
      reasonCode: 'fixture_public_claim', hasPracticalConsequence: fixture.priority ?? null, matchedSelectedTopic: fixture.topic ?? null,
    } }, fixture.intent as 'manual' | 'automatic' | 'repeat',
    { active: true, healthy: true, current: true, expired: false, duplicate: false, notificationCount: 0, ...fixture.state },
    { muted: false, automaticNotifications: true, selectedTopics: [], ...fixture.preferences });
    return { id: fixture.id, passed: actual.action === fixture.expected && actual.reasonCode === fixture.reason, actual };
  });
  return {
    schemaVersion: 1, mode: 'scripted_fixtures_plus_injected_runtime', split, policyVersion: POLICY_VERSION, modelVersion: `${MODEL_VERSION}-scripted-answers`,
    counts: { selected: selected.length, passed: observations.filter(o => o.status === 'pass').length, failed: observations.filter(o => o.status === 'fail').length, notRun: observations.filter(o => o.status === 'not_run').length, heldoutReserved },
    coverage: { admission: observations.filter(o => o.testedStages.includes('admission')).length, verdict: observations.filter(o => o.testedStages.includes('verdict')).length, presentation: observations.filter(o => o.testedStages.includes('presentation')).length, providerErrors: observations.filter(o => o.testedStages.includes('provider_error_validation')).length,
      runtimeTransport: observations.filter(o => o.method === 'injected_runtime_transport').length, runtimeDeadline: observations.filter(o => o.testedStages.includes('runtime_provider_deadline')).length, runtimeCorrections: observations.filter(o => o.testedStages.includes('runtime_revision_cancellation')).length },
    measurement: { scriptedFixtures: observations.filter(o => o.method === 'scripted_policy_fixture').length, injectedRuntimeTransport: observations.filter(o => o.method === 'injected_runtime_transport').length,
      runtimeDurationsMs: Object.fromEntries(observations.filter(o => o.method === 'injected_runtime_transport').map(o => [o.id, o.durationMs ?? null])) },
    presentationConfusion: confusion,
    sharedPresentationFixtures: { passed: sharedActions.filter(result => result.passed).length, total: sharedActions.length, observations: sharedActions },
    metrics: { liveAdmissionPrecision: null, liveAdmissionRecall: null, privateQueryLeakage: null, wrongDefinitiveLiveLabels: null, inspectedLiveCitations: 0, liveLatencyMedianMs: null, liveLatencyP95Ms: null, providerCost: null, falseAlertsPerListeningMinute: null, actualDuplicateSpeech: null, actualStaleSpeech: null, deliberateSourceOpens: null },
    limitations: ['Scripted model answers test control flow, not model accuracy.', 'Injected runtime providers exercise composed authenticated HTTP/WebSocket transport, revision cancellation and deadlines, not provider semantics or reliability.', 'Synthetic evidence is not a checked live citation.', 'No real provider network, wearable capture, listening duration or actual speech measurement.', 'The 12 held-out cases remain excluded unless explicitly selected; do not tune thresholds on their outcomes.'],
    observations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--heldout')) throw new Error('Usage: npm run evaluate [-- --heldout]');
  const split = args.includes('--heldout') ? 'heldout' : 'development';
  const manifest = await loadManifest();
  const report = await runEvaluation(await loadCases(split), split, manifest.cases.filter(entry => entry.split === 'heldout').length);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.counts.failed || report.sharedPresentationFixtures.passed !== report.sharedPresentationFixtures.total) process.exitCode = 1;
}
