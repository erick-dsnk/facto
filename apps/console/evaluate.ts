import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  MODEL_VERSION, POLICY_VERSION, PipelineError, sliceSpan, type AdmissionMetadata, type AdmissionResult, type Evidence,
  type Judgment, type Presentation, type PresentationState, type ProviderContext, type TextInput, type Verdict,
} from '../../packages/contracts/src/index.js';
import { createClassifier } from '../../services/api/src/providers/jev/classification.js';
import { createJevClient, type JevAnswer, type JevRequest } from '../../services/api/src/providers/jev/client.js';
import { decideVerdict } from '../../services/api/src/policy/verdict.js';
import { decidePresentation } from '../../services/api/src/policy/notifications.js';
import actionFixtures from '../../fixtures/actions/presentation-cases.json' with { type: 'json' };

type SemanticFixture = {
  kind: string; selfContained: number; privateData: number;
  assertionStatus: string; hasPracticalConsequence: number | null;
};
export type EvaluationCase = {
  id: string; category: 'personal' | 'public' | 'mixed' | 'capture' | 'service'; split: 'development' | 'heldout';
  text: string; intent: 'manual' | 'automatic'; capture: { mode: 'typed' | 'ocr'; confidence: number; final: boolean };
  expected: { admission: AdmissionResult['action']; presentation: Presentation['action']; verdict: Verdict | null; checkedTexts?: string[]; errorCode?: string };
  modelFixture: SemanticFixture; candidateModelFixtures?: Record<string, SemanticFixture>;
  evidenceFixture: 'none' | 'support' | 'contradict' | 'conflict' | 'echo' | 'omitted_condition'; scenario: string;
};
type Observation = {
  id: string; category: string; status: 'pass' | 'fail' | 'not_run'; testedStages: string[]; mismatches: string[];
  admission?: AdmissionResult['action']; presentation?: Presentation['action']; verdict?: Verdict; errorCode?: string;
  expectedPresentation?: Presentation['action']; note?: string;
};
const FIXED_NOW = Date.parse('2026-11-14T12:00:00Z');
const datasetUrl = new URL('../../fixtures/evaluation/cases.json', import.meta.url);

export async function loadCases(): Promise<EvaluationCase[]> {
  const data = JSON.parse(await readFile(datasetUrl, 'utf8')) as { cases: EvaluationCase[] };
  return data.cases;
}

function fixtureAnswers(request: JevRequest, sample: EvaluationCase): Record<string, JevAnswer> {
  const state = request.state as { candidates: Array<{ id: string; text: string }> };
  const answers: Record<string, JevAnswer> = {};
  for (const candidate of state.candidates) {
    const semantic = sample.candidateModelFixtures?.[candidate.text] ?? sample.modelFixture;
    for (const suffix of ['kind', 'assertion_status', 'quote_use', 'claim_structure'] as const) {
      const key = `${candidate.id}_${suffix}`;
      const question = request.questions[key];
      if (!question) continue;
      if (question.type !== 'choice') throw new Error('Unexpected classifier question');
      const choice = suffix === 'kind' ? semantic.kind
        : suffix === 'assertion_status' ? semantic.assertionStatus
        : suffix === 'quote_use' ? 'name_or_title'
        : state.candidates.length > 1 ? 'multiple_propositions' : 'one_coherent';
      answers[key] = { choice, probabilities: Object.fromEntries(Object.keys(question.criteria).map(option => [option, Number(option === choice)])) };
    }
    answers[`${candidate.id}_self_contained`] = { noul: semantic.selfContained };
    answers[`${candidate.id}_private_data`] = { noul: semantic.privateData };
    answers[`${candidate.id}_has_practical_consequence`] = { noul: semantic.hasPracticalConsequence };
    if (request.questions[`${candidate.id}_preserves_scope`]) {
      answers[`${candidate.id}_preserves_scope`] = { noul: 1 };
    }
  }
  return answers;
}

/** Synthetic passages test policy mechanics; they are never presented as live evidence. */
function fixtureJudgment(sample: EvaluationCase, checkedText: string): Judgment & import('../../services/api/src/policy/assessment.js').JudgmentAssessment {
  // These predeclared development facts have substantive synthetic records.
  // Unknown fixture propositions do not inherit a positive quality assessment.
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
  const recipe = sample.evidenceFixture;
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
  const label: Verdict = recipe === 'none' ? 'insufficient_evidence' : recipe === 'contradict' ? 'contradicted' : recipe === 'omitted_condition' ? 'misleading' : 'supported';
  const evidence = recipe === 'none' ? [] : [source(1, label === 'contradicted' ? 'contradicts' : 'supports'), source(2, label === 'contradicted' ? 'contradicts' : 'supports')];
  if (recipe === 'conflict') evidence[1].stance = 'contradicts';
  if (recipe === 'echo') {
    evidence[0].echoGroup = 'shared-release'; evidence[1].echoGroup = 'shared-release';
    evidence[1].excerpt = evidence[0].excerpt;
  }
  return {
    checkedText, label, probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 0, [label]: 1 }, evidence,
    selectedEvidenceIds: evidence.map(record => record.id), misleadingReason: recipe === 'omitted_condition' ? 'omitted_condition' : null,
    misleadingEvidenceIds: recipe === 'omitted_condition' ? evidence.map(record => record.id) : [],
    sourceAssessments: Object.fromEntries(evidence.map(record => [record.id, {
      contentBasis: records || recipe === 'conflict' ? 'original_record' as const : recipe === 'echo' ? 'promotional' as const : 'unclear' as const,
      confidence: .99,
    }])),
    claimRisk: { level: records ? 'ordinary' : 'unknown', confidence: .99 },
    originAssessments: evidence.length === 2 ? [{ evidenceIds: [evidence[0].id, evidence[1].id], relationship: recipe === 'echo' ? 'common_origin' : records || recipe === 'conflict' ? 'distinct_origins' : 'unclear', confidence: .99 }] : [],
  };
}

export async function evaluateCase(sample: EvaluationCase): Promise<Observation> {
  const result: Observation = { id: sample.id, category: sample.category, status: 'pass', testedStages: [], mismatches: [] };
  // These need real scheduler/hardware orchestration; a pure policy result would not prove them.
  if (['revision_correction', 'provider_timeout', 'hardware_disconnect', 'hardware_tts_feedback'].includes(sample.scenario)) {
    return { ...result, status: 'not_run', note: 'Requires runtime or real-device scenario runner; not counted as a passing policy fixture.' };
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

export async function runEvaluation(cases: EvaluationCase[], split: 'development' | 'heldout' = 'development') {
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
    schemaVersion: 1, mode: 'deterministic_fixture', split, policyVersion: POLICY_VERSION, modelVersion: `${MODEL_VERSION}-scripted-answers`,
    counts: { selected: selected.length, passed: observations.filter(o => o.status === 'pass').length, failed: observations.filter(o => o.status === 'fail').length, notRun: observations.filter(o => o.status === 'not_run').length, heldoutReserved: cases.filter(c => c.split === 'heldout').length },
    coverage: { admission: observations.filter(o => o.testedStages.includes('admission')).length, verdict: observations.filter(o => o.testedStages.includes('verdict')).length, presentation: observations.filter(o => o.testedStages.includes('presentation')).length, providerErrors: observations.filter(o => o.testedStages.includes('provider_error_validation')).length },
    presentationConfusion: confusion,
    sharedPresentationFixtures: { passed: sharedActions.filter(result => result.passed).length, total: sharedActions.length, observations: sharedActions },
    metrics: { liveAdmissionPrecision: null, liveAdmissionRecall: null, privateQueryLeakage: null, wrongDefinitiveLiveLabels: null, inspectedLiveCitations: 0, liveLatencyMedianMs: null, liveLatencyP95Ms: null, providerCost: null, falseAlertsPerListeningMinute: null, actualDuplicateSpeech: null, actualStaleSpeech: null, deliberateSourceOpens: null },
    limitations: ['Scripted model answers test control flow, not model accuracy.', 'Synthetic evidence is not a checked live citation.', 'No provider network, wearable capture, listening duration or actual speech measurement.', 'Held-outs are excluded unless explicitly selected; do not tune thresholds on their outcomes.'],
    observations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--heldout')) throw new Error('Usage: npm run evaluate [-- --heldout]');
  const report = await runEvaluation(await loadCases(), args.includes('--heldout') ? 'heldout' : 'development');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.counts.failed || report.sharedPresentationFixtures.passed !== report.sharedPresentationFixtures.total) process.exitCode = 1;
}
