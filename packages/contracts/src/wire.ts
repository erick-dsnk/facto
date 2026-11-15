import { z } from 'zod';
import {
  CLAIM_ROUTES, EVIDENCE_ORIGINS, NON_CLAIM_KINDS, REASON_CODES, RESULT_BASES, RESULT_VERDICTS, SPECULATION_REASONS,
  sliceSpan, sourceSpanSchema, type AdmissionPayload, type ClaimResult, type Evidence
} from './index.js';

const timestamp = z.iso.datetime({ offset: true });
const nullableProbability = z.number().min(0).max(1).nullable();
const name = z.string().trim().min(1).max(120);
export const evidenceSchema: z.ZodType<Evidence> = z.object({
  id: z.string().min(1), url: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)),
  title: z.string(), publisher: z.string().nullable(), publishedAt: z.union([z.iso.date(), timestamp]).nullable(), retrievedAt: timestamp,
  contentBasis: z.enum(['highlight', 'page_text']), excerpt: z.string().refine(s => Array.from(s).length <= 2000),
  sourceGroup: z.string().min(1), echoGroup: z.string().nullable(), sourceRole: z.enum(['primary', 'secondary', 'unknown']),
  directlyAddressesClaim: z.boolean(), matchesTimePlaceAndPopulation: z.boolean(), stance: z.enum(['supports', 'contradicts', 'unrelated']), stanceProbability: nullableProbability,
  origin: z.enum(EVIDENCE_ORIGINS).optional(), rating: z.enum(['supported', 'contradicted', 'misleading']).optional()
}).strict().superRefine((evidence, ctx) => {
  if (evidence.rating !== undefined && evidence.origin !== 'fact_check') {
    ctx.addIssue({ code: 'custom', message: 'Only fact_check evidence carries a rating', path: ['rating'] });
  }
});
export const presentationSchema = z.object({ action: z.enum(['silent', 'notify', 'respond']), reasonCode: z.string().min(1) }).strict();
export const checkUsageSchema = z.object({ jevCalls: z.number().int().nonnegative(), exaSearches: z.number().int().nonnegative() }).strict();
export const resultAttributionSchema = z.object({ label: z.enum(['reported', 'not_said']), source: name, mode: z.enum(['said', 'reported']) }).strict();
const cited = new Set<string>(['supported', 'contradicted', 'misleading']);
const speculationReasons = new Set<string>(SPECULATION_REASONS);
export const claimResultSchema: z.ZodType<ClaimResult> = z.object({
  verdict: z.enum(RESULT_VERDICTS), reasonCode: z.string().min(1),
  selectedEvidenceIds: z.array(z.string()).max(6), summary: z.string(), originalText: z.string(), checkedText: z.string(),
  sourceSpan: sourceSpanSchema, evidence: z.array(evidenceSchema).max(6), checkedAt: timestamp, expiresAt: timestamp,
  durationMs: z.number().nonnegative(), cached: z.boolean(), policyVersion: z.string().min(1), modelVersion: z.string().min(1),
  presentation: presentationSchema,
  basis: z.enum(RESULT_BASES).optional(), attribution: resultAttributionSchema.optional(),
  route: z.enum(CLAIM_ROUTES).optional(), subject: name.nullable().optional(), usage: checkUsageSchema.optional()
}).strict().superRefine((result, ctx) => {
  if (result.sourceSpan.end > Array.from(result.originalText).length || sliceSpan(result.originalText, result.sourceSpan) !== result.checkedText) {
    ctx.addIssue({ code: 'custom', message: 'sourceSpan must exactly select checkedText in Unicode code points', path: ['sourceSpan'] });
  }
  const ids = new Set(result.evidence.map(e => e.id));
  if (ids.size !== result.evidence.length || result.selectedEvidenceIds.some(id => !ids.has(id))) {
    ctx.addIssue({ code: 'custom', message: 'Selected IDs must reference unique retained evidence', path: ['selectedEvidenceIds'] });
  }
  if (cited.has(result.verdict) && result.selectedEvidenceIds.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Definitive verdicts require retained citations', path: ['selectedEvidenceIds'] });
  }
  if ((result.verdict === 'speculation') !== speculationReasons.has(result.reasonCode)) {
    ctx.addIssue({ code: 'custom', message: 'Speculation and only speculation carries a speculation reason code', path: ['reasonCode'] });
  }
  if (result.reasonCode === REASON_CODES.privateLifeNotChecked && (result.evidence.length > 0 || result.selectedEvidenceIds.length > 0)) {
    ctx.addIssue({ code: 'custom', message: 'A private-life claim is never searched, so it retains no evidence', path: ['evidence'] });
  }
  if (result.basis !== undefined && !cited.has(result.verdict)) {
    ctx.addIssue({ code: 'custom', message: 'A basis label needs a definitive verdict', path: ['basis'] });
  }
  if (result.attribution && result.verdict !== (result.attribution.label === 'reported' ? 'supported' : 'contradicted')) {
    ctx.addIssue({ code: 'custom', message: 'Attribution reported goes with supported, not_said with contradicted', path: ['attribution'] });
  }
  if (Date.parse(result.expiresAt) < Date.parse(result.checkedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Result cannot expire before it was checked', path: ['expiresAt'] });
  }
});
/** claim.checking, claim.skipped and claim.needs_confirmation. Unknown extra keys pass, as before. */
export const admissionPayloadSchema: z.ZodType<AdmissionPayload> = z.object({
  admissionAction: z.enum(['wait', 'skip', 'check']), reasonCode: z.string().min(1), presentation: presentationSchema.optional(),
  kind: z.enum(NON_CLAIM_KINDS).optional(), summary: z.string().trim().min(1).max(200).optional(),
  route: z.enum(CLAIM_ROUTES).optional(), subject: name.nullable().optional(), usage: checkUsageSchema.optional(),
  claimText: z.string().refine(value => Array.from(value).length <= 800).optional(), mode: z.enum(['ocr', 'audio', 'typed']).optional(), userInitiated: z.boolean().optional()
}).passthrough();
export const displaySourceSchema = z.object({
  id: z.string().min(1).max(100), hostname: z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/i),
  title: z.string().max(160), stage: z.enum(['found', 'reading', 'ready']), provider: z.literal('exa')
}).strict();
export const claimSourcesSchema = z.object({ sources: z.array(displaySourceSchema).max(4) }).strict().superRefine(({ sources }, ctx) => {
  if (new Set(sources.map(source => source.id)).size !== sources.length || new Set(sources.map(source => source.hostname)).size !== sources.length) ctx.addIssue({ code: 'custom', message: 'Source sites must have unique IDs and hostnames' });
});
export const displayStateSchema = z.object({
  requestId: z.string().min(1), claimId: z.string().min(1), revision: z.number().int().positive(), claimText: z.string().refine(value => Array.from(value).length <= 800),
  mode: z.enum(['ocr', 'audio', 'typed']), userInitiated: z.boolean(), phase: z.enum(['checking', 'result']),
  sources: z.array(displaySourceSchema).max(4), result: claimResultSchema.optional()
}).strict().superRefine((state, ctx) => {
  if (state.phase === 'checking' ? !state.userInitiated || state.result !== undefined : !state.result || state.result.presentation.action === 'silent') ctx.addIssue({ code: 'custom', message: 'Display state must be a manual check or a visible result' });
});
export const displayGrantSchema = z.object({ schemaVersion: z.literal(1), sessionId: z.string().min(1), sessionEpoch: z.number().int().positive(), displayToken: z.string().min(32), expiresAt: timestamp, streamPath: z.string().startsWith('/v1/sessions/') }).strict();
export const displaySnapshotSchema = z.object({ schemaVersion: z.literal(1), type: z.literal('display.snapshot'), sessionId: z.string().min(1), sessionEpoch: z.number().int().positive(), eventSeq: z.number().int().nonnegative(), active: z.boolean(), expiresAt: timestamp, state: displayStateSchema.nullable() }).strict();
export const eventEnvelopeSchema = z.object({
  schemaVersion: z.literal(1), eventId: z.string().min(1), eventSeq: z.number().int().positive(),
  sessionId: z.string().min(1), sessionEpoch: z.number().int().positive(), requestId: z.string().optional(),
  claimId: z.string().optional(), revision: z.number().int().positive().optional(),
  type: z.enum(['session.ready', 'session.ended', 'claim.detected', 'claim.waiting', 'claim.skipped', 'claim.needs_confirmation',
    'claim.checking', 'claim.sources', 'claim.result', 'claim.superseded', 'check.cancelled', 'pipeline.error', 'audio.ready', 'audio.stopped', 'transcript.partial', 'transcript.final', 'capture.request']),
  serverAt: timestamp, payload: z.unknown()
}).strict().superRefine((event, ctx) => {
  if (event.type === 'claim.sources') {
    if (!claimSourcesSchema.safeParse(event.payload).success || !event.requestId || !event.claimId || !event.revision) ctx.addIssue({ code: 'custom', message: 'Invalid correlated claim.sources payload' });
  }
  if (event.type === 'claim.result') {
    const result = claimResultSchema.safeParse(event.payload);
    if (!result.success) ctx.addIssue({ code: 'custom', message: 'Invalid claim.result payload', path: ['payload'] });
    if (!event.requestId || !event.claimId || !event.revision) ctx.addIssue({ code: 'custom', message: 'Result requires request, claim and revision identity' });
  }
  if (event.type === 'claim.waiting') {
    const waiting = z.object({ admissionAction: z.literal('wait'), reasonCode: z.string().min(1), waitExpiresAt: timestamp }).passthrough();
    if (!waiting.safeParse(event.payload).success) ctx.addIssue({ code: 'custom', message: 'Invalid waiting payload', path: ['payload'] });
  }
  if (event.type === 'claim.checking' || event.type === 'claim.skipped' || event.type === 'claim.needs_confirmation') {
    const admission = admissionPayloadSchema.safeParse(event.payload);
    if (!admission.success) ctx.addIssue({ code: 'custom', message: `Invalid ${event.type} payload`, path: ['payload'] });
    else if (admission.data.kind !== undefined && event.type === 'claim.checking') {
      ctx.addIssue({ code: 'custom', message: 'An admitted claim has no non-claim kind', path: ['payload', 'kind'] });
    }
  }
  if (event.type === 'capture.request') {
    const capture = z.object({ reasonCode: z.string().min(1) }).passthrough();
    if (!capture.safeParse(event.payload).success) ctx.addIssue({ code: 'custom', message: 'Invalid capture.request payload', path: ['payload'] });
  }
});
