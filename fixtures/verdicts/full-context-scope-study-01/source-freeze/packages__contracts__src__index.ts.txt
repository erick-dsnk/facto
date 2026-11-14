import { z } from 'zod';

export const POLICY_VERSION = 'glasses-p0.1';
export const MODEL_VERSION = 'jev-latest';
export const codePoints = (text: string) => Array.from(text);
export const sliceSpan = (text: string, span: SourceSpan) => codePoints(text).slice(span.start, span.end).join('');
const boundedText = (max: number) => z.string().refine(s => codePoints(s).length <= max, `Maximum ${max} Unicode code points`);
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const sourceSpanSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict().refine(s => s.end > s.start);
export type SourceSpan = z.infer<typeof sourceSpanSchema>;
export const textInputSchema = z.object({
  schemaVersion: z.literal(1), requestId: id, sessionId: id, sessionEpoch: z.number().int().positive(), revision: z.number().int().positive(),
  mode: z.enum(['ocr', 'audio', 'typed']), text: boundedText(800).refine(s => s.trim().length > 0), language: z.literal('en'),
  capturedAt: z.iso.datetime({ offset: true }),
  capture: z.object({ source: z.enum(['glasses_hfp','glasses_stream_audio','glasses_camera','phone_mic','phone_camera','typed_fixture','recorded_fixture']), segmentId: id, confidence: z.number().min(0).max(1).nullable(), final: z.boolean().optional() }).strict(),
  context: z.array(boundedText(1200)).max(2).refine(c => codePoints(c.join('')).length <= 1200), userInitiated: z.boolean()
}).strict();
export type TextInput = z.infer<typeof textInputSchema>;
export type AdmissionMetadata = {
  assertionStatus: 'asserted' | 'nonliteral_or_quoted' | 'unclear'; hasPracticalConsequence: number | null;
  matchedSelectedTopic: string | null; admissionAction: 'wait' | 'skip' | 'check'; reasonCode: string;
};
export type AcceptedClaim = { id: string; originalText: string; checkedText: string; sourceSpan: SourceSpan; admission: AdmissionMetadata };
export type AdmissionResult = { action: 'wait' | 'skip' | 'check' | 'needs_confirmation'; reasonCode: string; claims: AcceptedClaim[] };
export type ProviderKind = 'jev' | 'search' | 'contents';
export interface ProviderContext { signal: AbortSignal; consume(kind: ProviderKind, claimId?: string): void; now(): number; recordUsage?(usage: { inputTokens?: number }): void; }
export class PipelineError extends Error {
  constructor(public code: string, public retryable = false) { super(code); this.name = 'PipelineError'; }
}
export type Evidence = {
  id: string; url: string; title: string; publisher: string | null; publishedAt: string | null; retrievedAt: string;
  contentBasis: 'highlight' | 'page_text'; excerpt: string; sourceGroup: string; echoGroup: string | null;
  sourceRole: 'primary' | 'secondary' | 'unknown'; directlyAddressesClaim: boolean; matchesTimePlaceAndPopulation: boolean;
  stance: 'supports' | 'contradicts' | 'unrelated'; stanceProbability: number | null;
};
export type Verdict = 'supported' | 'contradicted' | 'misleading' | 'insufficient_evidence';
export type Judgment = {
  checkedText?: string; misleadingEvidenceIds?: string[];
  label: Verdict; probabilities: Record<Verdict, number>; evidence: Evidence[]; selectedEvidenceIds: string[];
  misleadingReason: 'omitted_condition' | 'outdated_fact' | 'exaggeration' | null;
};
export type VerdictDecision = { verdict: Verdict; reasonCode: string; selectedEvidenceIds: string[]; summary: string };
export type Presentation = { action: 'silent' | 'notify' | 'respond'; reasonCode: string };
export type PresentationState = {
  active: boolean; healthy: boolean; current: boolean; expired: boolean; duplicate: boolean; notificationCount: number;
};
export type Preferences = { muted: boolean; automaticNotifications: boolean; selectedTopics: string[] };
export type ClaimResult = VerdictDecision & {
  originalText: string; checkedText: string; sourceSpan: SourceSpan; evidence: Evidence[]; checkedAt: string; expiresAt: string;
  durationMs: number; cached: boolean; policyVersion: string; modelVersion: string; presentation: Presentation;
};
export type EventType = 'session.ready' | 'session.ended' | 'claim.detected' | 'claim.waiting' | 'claim.skipped' | 'claim.needs_confirmation' | 'claim.checking' | 'claim.result' | 'claim.superseded' | 'check.cancelled' | 'pipeline.error' | 'audio.ready' | 'audio.stopped' | 'transcript.partial' | 'transcript.final';
export type EventEnvelope = {
  schemaVersion: 1; eventId: string; eventSeq: number; sessionId: string; sessionEpoch: number; requestId?: string; claimId?: string; revision?: number;
  type: EventType; serverAt: string; payload: unknown;
};
export interface PipelineAdapters {
  classify(input: TextInput, context: ProviderContext): Promise<AdmissionResult>;
  retrieve(claim: AcceptedClaim, context: ProviderContext): Promise<Evidence[]>;
  judge(claim: AcceptedClaim, evidence: Evidence[], context: ProviderContext): Promise<Judgment>;
}
