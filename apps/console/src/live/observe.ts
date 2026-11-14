import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PipelineError, type Evidence, type ProviderContext } from '../../../../packages/contracts/src/index.js';
import { createJevClient, validateAnswers, type JevAnswer, type JevRequest } from '../../../../services/api/src/providers/jev/client.js';
import { createClassifier } from '../../../../services/api/src/providers/jev/classification.js';
import { createJudge } from '../../../../services/api/src/providers/jev/judgment.js';
import { createRetriever } from '../../../../services/api/src/providers/exa/retrieval.js';
import { buildAlternateQuery, buildHighlightQuery, normalizeUrl, RETRIEVAL_OBJECTIVE } from '../../../../services/api/src/evidence/normalize.js';
import { abortable } from '../../../../services/api/src/runtime/budget.js';
import type { RuntimeAdapters } from '../../../../services/api/src/runtime/adapters.js';
import type { AssessedJudgment } from '../../../../services/api/src/policy/assessment.js';
import { CampaignBudget, HarnessStop, type Attempt } from './budget.js';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const highlightsSchema = z.object({ query: z.string(), maxCharacters: z.literal(4000) }).strict();
const searchRequestSchema = z.object({ query: z.string(), type: z.literal('auto'), numResults: z.union([z.literal(5), z.literal(8)]),
  objective: z.literal(RETRIEVAL_OBJECTIVE), contents: z.object({ highlights: highlightsSchema }).strict() }).strict();
const contentsRequestSchema = z.object({ urls: z.array(z.string().max(4096).refine(url => normalizeUrl(url) !== null)).length(1),
  text: z.object({ maxCharacters: z.literal(12000) }).strict(), highlights: highlightsSchema,
  livecrawl: z.literal('preferred'), livecrawlTimeout: z.literal(1500) }).strict();

/** Every outbound retrieval string is constrained, including SDK nested fields.
 * A future provider option must be explicitly audited before it can dispatch. */
export function retrievalRequestIsPublic(kind: 'search' | 'contents', value: unknown, allowedPublic: string[]): boolean {
  if (allowedPublic.length !== 1) return false;
  const text = allowedPublic[0];
  if (kind === 'search') {
    const parsed = searchRequestSchema.safeParse(value);
    if (!parsed.success) return false;
    const request = parsed.data;
    return request.contents.highlights.query === buildHighlightQuery(text)
      && ((request.query === text && request.numResults === 5)
        || (request.query === buildAlternateQuery(text, 'balanced_evidence') && request.numResults === 8));
  }
  const parsed = contentsRequestSchema.safeParse(value);
  return parsed.success && parsed.data.highlights.query === buildHighlightQuery(text);
}

const contentErrorTags = ['CRAWL_NOT_FOUND', 'CRAWL_TIMEOUT', 'CRAWL_LIVECRAWL_TIMEOUT', 'CRAWL_UNKNOWN_ERROR', 'SOURCE_NOT_AVAILABLE', 'UNSUPPORTED_URL'] as const;
type ContentErrorTag = typeof contentErrorTags[number] | `CRAWL_HTTP_${number}` | 'other';
export type ContentStatusDiagnostic = {
  requestedURL: string; status: 'success' | 'error' | 'other'; source?: 'cached' | 'crawled' | 'other';
  errorTag?: ContentErrorTag; targetHttpStatus?: number | null;
  malformedFields: ('status' | 'source' | 'error' | 'tag' | 'httpStatusCode')[];
  inconsistentSuccessError?: boolean; inconsistentHttpStatus?: boolean;
};
export type ContentsDiagnostics = { statusList: 'absent' | 'present' | 'malformed'; records: ContentStatusDiagnostic[];
  malformedStatusCount: number; unmatchedStatusCount: number; duplicateStatusCount: number; omittedStatusCount: number };

/** Diagnostic projection only: never copies provider messages, unknown tags or
 * response IDs. URLs come from the already-validated outgoing request. */
export function contentStatusDiagnostics(decoded: unknown, requestedURLs: string[]): ContentsDiagnostics {
  const result: ContentsDiagnostics = { statusList: 'malformed', records: [], malformedStatusCount: 0,
    unmatchedStatusCount: 0, duplicateStatusCount: 0, omittedStatusCount: 0 };
  if (!object(decoded)) return result;
  if (decoded.statuses === undefined) { result.statusList = 'absent'; return result; }
  if (!Array.isArray(decoded.statuses)) return result;
  result.statusList = 'present';
  // The actual harness request permits one URL. Bound this projection as well
  // so a malformed caller cannot amplify a provider response into a large log.
  const requested = new Map(requestedURLs.slice(0, 16).flatMap(url => {
    const normalized = url.length <= 4096 ? normalizeUrl(url) : null;
    return normalized ? [[normalized, url] as const] : [];
  }));
  const seen = new Map<string, number>();
  result.omittedStatusCount = Math.max(0, decoded.statuses.length - 100);
  for (const value of decoded.statuses.slice(0, 100)) {
    if (!object(value) || typeof value.id !== 'string' || value.id.length > 4096) { result.malformedStatusCount++; continue; }
    const normalized = normalizeUrl(value.id);
    if (!normalized) { result.malformedStatusCount++; continue; }
    const requestedURL = requested.get(normalized);
    if (!requestedURL) { result.unmatchedStatusCount++; continue; }
    const count = (seen.get(normalized) ?? 0) + 1; seen.set(normalized, count);
    if (count > 1) result.duplicateStatusCount++;
    if (count > 2) { result.omittedStatusCount++; continue; }
    const record: ContentStatusDiagnostic = { requestedURL, status: value.status === 'success' || value.status === 'error' ? value.status : 'other', malformedFields: [] };
    if (record.status === 'other') record.malformedFields.push('status');
    if (value.source !== undefined) {
      record.source = value.source === 'cached' || value.source === 'crawled' ? value.source : 'other';
      if (record.source === 'other') record.malformedFields.push('source');
    }
    if (value.error !== undefined && value.error !== null) {
      if (value.status === 'success') record.inconsistentSuccessError = true;
      if (!object(value.error)) record.malformedFields.push('error');
      else {
        const tag = value.error.tag;
        if (tag !== undefined) {
          record.errorTag = typeof tag === 'string' && tag.length <= 200 && (contentErrorTags.includes(tag as typeof contentErrorTags[number]) || /^CRAWL_HTTP_[45]\d\d$/.test(tag)) ? tag as ContentErrorTag : 'other';
          if (record.errorTag === 'other') record.malformedFields.push('tag');
        }
        const httpStatus = value.error.httpStatusCode;
        if (httpStatus !== undefined) {
          if (httpStatus === null || (typeof httpStatus === 'number' && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599)) record.targetHttpStatus = httpStatus;
          else record.malformedFields.push('httpStatusCode');
        }
        const embeddedStatus = record.errorTag?.match(/^CRAWL_HTTP_([45]\d\d)$/);
        const expectedStatus = record.errorTag === 'CRAWL_NOT_FOUND' ? 404 : embeddedStatus ? Number(embeddedStatus[1]) : undefined;
        if (expectedStatus !== undefined && typeof record.targetHttpStatus === 'number' && expectedStatus !== record.targetHttpStatus) record.inconsistentHttpStatus = true;
      }
    }
    result.records.push(record);
  }
  return result;
}

export type ObservedAttempt = Attempt & { query?: string; retrievalTextSHA256?: { objective?: string; highlightQuery: string }; contentURLs?: string[];
  contentStatusDiagnostics?: ContentsDiagnostics; answers?: Record<string, JevAnswer> };
export type RequestObservation = {
  label: string; attempts: ObservedAttempt[]; stageMs: { admission: number; retrieval: number; judgment: number };
  admission?: { action: string; reasonCode: string; claims: number }; admittedPublic: string[]; rejectedAdmissionCount: number;
  evidence: { stage: 'retrieval' | 'alternate' | 'judgment'; records: Evidence[]; selectedEvidenceIds?: string[];
    sourceAssessments?: AssessedJudgment['sourceAssessments']; claimRisk?: AssessedJudgment['claimRisk']; originAssessments?: AssessedJudgment['originAssessments'] }[];
  localStops: string[]; controller: AbortController;
};

export function freshObservation(label: string): RequestObservation {
  return { label, attempts: [], stageMs: { admission: 0, retrieval: 0, judgment: 0 }, admittedPublic: [], rejectedAdmissionCount: 0, evidence: [], localStops: [], controller: new AbortController() };
}

export function stopObservation(observation: RequestObservation, error: HarnessStop) {
  if (!observation.localStops.includes(error.code)) observation.localStops.push(error.code);
  if (!observation.controller.signal.aborted) observation.controller.abort(error);
}

/** Retain only fixed question names and validated numeric/enum answers. */
function answerDiagnostics(decoded: unknown, request: JevRequest): Record<string, JevAnswer> | undefined {
  try {
    const answers = validateAnswers(decoded, request.questions);
    if (Object.entries(request.questions).some(([name, question]) => !/^(span_\d+_[a-z_]+|verdict|selected_evidence|misleading_reason|claim_risk|e\d+_[a-z_]+|e\d+_e\d+_origin)$/.test(name)
      || (question.type === 'choice' && Object.keys(question.criteria).some(option => !/^[a-z][a-z0-9_]*$/.test(option))))) return undefined;
    return answers;
  } catch { return undefined; }
}

async function responseBody(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 262_144) throw new HarnessStop('response_byte_limit');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
}

/** The HTTP seam counts every actual wire attempt, including retry and content calls. */
export function observedProviders(options: {
  budget: CampaignBudget; requests: Map<string, { observation: RequestObservation; allowedPublic: string[] }>;
  keys: { jev: string; exa: string }; fetch?: typeof fetch;
  onBeforeDispatch?: (observation: RequestObservation) => void | Promise<void>;
  onAttemptFinished?: (observation: RequestObservation) => void | Promise<void>;
}) {
  const scope = new AsyncLocalStorage<{ observation: RequestObservation; allowedPublic: string[]; signal: AbortSignal }>();
  const active = new Set<Promise<unknown>>();
  const trackedFetch: typeof fetch = async (url, init) => {
    const current = scope.getStore();
    if (!current) throw new PipelineError('harness_missing_request_scope');
    const { observation, signal, allowedPublic } = current;
    signal.throwIfAborted();
    const endpoint = String(url);
    const kind = endpoint === 'https://api.typesafe.ai/v1/systemone' ? 'jev' : endpoint === 'https://api.exa.ai/search' ? 'search' : endpoint === 'https://api.exa.ai/contents' ? 'contents' : undefined;
    if (!kind) { const error = new HarnessStop('unexpected_provider_endpoint'); stopObservation(observation, error); throw error; }
    const body = typeof init?.body === 'string' ? init.body : '';
    let decodedRequest: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(body);
      if (!object(parsed)) throw new Error('Outbound body must be an object');
      decodedRequest = parsed;
    }
    catch { const error = new HarnessStop('invalid_outbound_json'); stopObservation(observation, error); throw error; }
    let attempt: ObservedAttempt;
    try {
      if (kind === 'search' && (typeof decodedRequest.query !== 'string' || !allowedPublic.some(text => decodedRequest.query === text || decodedRequest.query === buildAlternateQuery(text, 'balanced_evidence')))) throw new HarnessStop('query_not_public');
      if (kind !== 'jev' && !retrievalRequestIsPublic(kind, decodedRequest, allowedPublic)) throw new HarnessStop('retrieval_request_not_public');
      attempt = options.budget.begin(kind, Buffer.byteLength(body));
    } catch (error) { if (error instanceof HarnessStop) stopObservation(observation, error); throw error; }
    if (kind === 'search') {
      attempt.query = decodedRequest.query as string;
      attempt.retrievalTextSHA256 = {
        objective: createHash('sha256').update(decodedRequest.objective as string).digest('hex'),
        highlightQuery: createHash('sha256').update(((decodedRequest.contents as Record<string, unknown>).highlights as Record<string, unknown>).query as string).digest('hex'),
      };
    }
    if (kind === 'contents') {
      attempt.contentURLs = decodedRequest.urls as string[];
      attempt.retrievalTextSHA256 = { highlightQuery: createHash('sha256').update((decodedRequest.highlights as Record<string, unknown>).query as string).digest('hex') };
    }
    observation.attempts.push(attempt);
    try { await options.onBeforeDispatch?.(observation); }
    catch {
      options.budget.withdraw(attempt); observation.attempts.splice(observation.attempts.indexOf(attempt), 1);
      const error = new HarnessStop('checkpoint_failure'); stopObservation(observation, error); throw error;
    }
    if (signal.aborted) {
      options.budget.withdraw(attempt); observation.attempts.splice(observation.attempts.indexOf(attempt), 1); signal.throwIfAborted();
    }
    const operation = (async () => {
      try {
        attempt.dispatched = true;
        const response = await abortable((options.fetch ?? globalThis.fetch)(url, { ...init, signal }), signal);
        attempt.status = response.status;
        const bytes = await responseBody(response, signal);
        attempt.outcome = 'response';
        let decoded: unknown;
        try { decoded = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* Provider parser reports malformed payloads. */ }
        if (kind === 'contents') attempt.contentStatusDiagnostics = contentStatusDiagnostics(decoded, attempt.contentURLs ?? []);
        if (object(decoded)) {
          if (kind === 'jev') {
            attempt.answers = answerDiagnostics(decoded, decodedRequest as unknown as JevRequest);
          }
          const cost = object(decoded.costDollars) ? decoded.costDollars.total : decoded.costDollars;
          if (safeNumber(cost)) attempt.costUSD = cost;
          if (kind === 'jev' && object(decoded.usage)) options.budget.usage(attempt, decoded.usage.input_tokens);
        }
        attempt.outcome = 'response';
        return new Response(bytes as BodyInit, { status: response.status, statusText: response.statusText, headers: response.headers });
      } catch (error) {
        if (attempt.outcome !== 'response') attempt.outcome = error instanceof HarnessStop && error.limit === 'response_byte_limit' ? 'response_limit' : signal.aborted ? 'aborted' : 'network_error';
        if (error instanceof HarnessStop) stopObservation(observation, error);
        throw error;
      } finally { options.budget.finish(attempt); }
    })();
    const checkpoint = async () => {
      try { await options.onAttemptFinished?.(observation); }
      catch { const error = new HarnessStop('checkpoint_failure'); stopObservation(observation, error); throw error; }
    };
    const checkpointed = operation.then(async response => { await checkpoint(); return response; }, async error => { await checkpoint(); throw error; });
    active.add(checkpointed);
    try { return await checkpointed; } finally { active.delete(checkpointed); }
  };
  const client = createJevClient({ apiKey: options.keys.jev, fetch: trackedFetch });
  const raw: RuntimeAdapters = { classify: createClassifier(client), judge: createJudge(client),
    retrieve: createRetriever({ apiKey: options.keys.exa, fetch: trackedFetch }),
    retrieveAlternate: createRetriever({ apiKey: options.keys.exa, fetch: trackedFetch, queryStrategy: 'balanced_evidence' }) };
  const claims = new Map<string, { observation: RequestObservation; allowedPublic: string[] }>();
  async function timed<T>(entry: { observation: RequestObservation; allowedPublic: string[] } | undefined, context: ProviderContext, stage: keyof RequestObservation['stageMs'], fn: (context: ProviderContext) => Promise<T>): Promise<T> {
    if (!entry) throw new PipelineError('harness_missing_request_scope');
    const signal = AbortSignal.any([context.signal, entry.observation.controller.signal]);
    const started = performance.now();
    try { return await scope.run({ ...entry, signal }, () => fn({ ...context, signal })); }
    finally { entry.observation.stageMs[stage] += performance.now() - started; }
  }
  const adapters: RuntimeAdapters = {
    classify: async (input, context) => {
      const entry = options.requests.get(input.requestId);
      return timed(entry, context, 'admission', async ctx => {
        const admission = await raw.classify(input, ctx);
        entry!.observation.admission = { action: admission.action, reasonCode: admission.reasonCode, claims: admission.claims.length };
        entry!.observation.rejectedAdmissionCount = admission.claims.filter(claim => !entry!.allowedPublic.includes(claim.checkedText)).length;
        entry!.observation.admittedPublic = admission.claims.filter(claim => entry!.allowedPublic.includes(claim.checkedText)).map(claim => claim.checkedText);
        if (entry!.observation.rejectedAdmissionCount) { const error = new HarnessStop('admitted_span_not_public'); stopObservation(entry!.observation, error); throw error; }
        for (const [index, claim] of admission.claims.entries()) {
          claims.set(`${input.requestId}-claim-${index}`, { ...entry!, allowedPublic: [claim.checkedText] });
        }
        return admission;
      });
    },
    retrieve: async (claim, context) => timed(claims.get(claim.id), context, 'retrieval', async ctx => {
      const records = await raw.retrieve(claim, ctx);
      claims.get(claim.id)!.observation.evidence.push({ stage: 'retrieval', records }); return records;
    }),
    retrieveAlternate: async (claim, context) => timed(claims.get(claim.id), context, 'retrieval', async ctx => {
      const records = await raw.retrieveAlternate!(claim, ctx);
      claims.get(claim.id)!.observation.evidence.push({ stage: 'alternate', records }); return records;
    }),
    judge: async (claim, evidence, context) => timed(claims.get(claim.id), context, 'judgment', async ctx => {
      const result = await raw.judge(claim, evidence, ctx);
      const assessed = result as AssessedJudgment;
      claims.get(claim.id)!.observation.evidence.push({ stage: 'judgment', records: result.evidence, selectedEvidenceIds: result.selectedEvidenceIds,
        sourceAssessments: assessed.sourceAssessments, claimRisk: assessed.claimRisk, originAssessments: assessed.originAssessments }); return result;
    }),
  };
  return { adapters, drain: async () => { await Promise.allSettled([...active]); } };
}
