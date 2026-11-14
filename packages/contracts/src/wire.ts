import { z } from 'zod';
import { sliceSpan, sourceSpanSchema, type ClaimResult, type Evidence } from './index.js';

const timestamp = z.iso.datetime({ offset: true });
const nullableProbability = z.number().min(0).max(1).nullable();
export const evidenceSchema: z.ZodType<Evidence> = z.object({
  id: z.string().min(1), url: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)),
  title: z.string(), publisher: z.string().nullable(), publishedAt: z.union([z.iso.date(), timestamp]).nullable(), retrievedAt: timestamp,
  contentBasis: z.enum(['highlight', 'page_text']), excerpt: z.string().refine(s => Array.from(s).length <= 2000),
  sourceGroup: z.string().min(1), echoGroup: z.string().nullable(), sourceRole: z.enum(['primary', 'secondary', 'unknown']),
  directlyAddressesClaim: z.boolean(), matchesTimePlaceAndPopulation: z.boolean(), stance: z.enum(['supports', 'contradicts', 'unrelated']), stanceProbability: nullableProbability
}).strict();
export const presentationSchema = z.object({ action: z.enum(['silent', 'notify', 'respond']), reasonCode: z.string().min(1) }).strict();
export const claimResultSchema: z.ZodType<ClaimResult> = z.object({
  verdict: z.enum(['supported', 'contradicted', 'misleading', 'insufficient_evidence']), reasonCode: z.string().min(1),
  selectedEvidenceIds: z.array(z.string()).max(6), summary: z.string(), originalText: z.string(), checkedText: z.string(),
  sourceSpan: sourceSpanSchema, evidence: z.array(evidenceSchema).max(6), checkedAt: timestamp, expiresAt: timestamp,
  durationMs: z.number().nonnegative(), cached: z.boolean(), policyVersion: z.string().min(1), modelVersion: z.string().min(1),
  presentation: presentationSchema
}).strict().superRefine((result, ctx) => {
  if (result.sourceSpan.end > Array.from(result.originalText).length || sliceSpan(result.originalText, result.sourceSpan) !== result.checkedText) {
    ctx.addIssue({ code: 'custom', message: 'sourceSpan must exactly select checkedText in Unicode code points', path: ['sourceSpan'] });
  }
  const ids = new Set(result.evidence.map(e => e.id));
  if (ids.size !== result.evidence.length || result.selectedEvidenceIds.some(id => !ids.has(id))) {
    ctx.addIssue({ code: 'custom', message: 'Selected IDs must reference unique retained evidence', path: ['selectedEvidenceIds'] });
  }
  if (result.verdict !== 'insufficient_evidence' && result.selectedEvidenceIds.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'Definitive verdicts require retained citations', path: ['selectedEvidenceIds'] });
  }
  if (Date.parse(result.expiresAt) < Date.parse(result.checkedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Result cannot expire before it was checked', path: ['expiresAt'] });
  }
});
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
  if (event.type === 'capture.request') {
    const capture = z.object({ reasonCode: z.string().min(1) }).passthrough();
    if (!capture.safeParse(event.payload).success) ctx.addIssue({ code: 'custom', message: 'Invalid capture.request payload', path: ['payload'] });
  }
});
