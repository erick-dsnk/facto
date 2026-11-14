import { z } from 'zod';

export const POLICY_VERSION = 'glasses-p0.2';
export const MODEL_VERSION = 'jev-latest';
export const codePoints = (text: string) => Array.from(text);
export const sliceSpan = (text: string, span: SourceSpan) => codePoints(text).slice(span.start, span.end).join('');
const boundedText = (max: number) => z.string().refine(s => codePoints(s).length <= max, `Maximum ${max} Unicode code points`);
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const sourceSpanSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict().refine(s => s.end > s.start);
export type SourceSpan = z.infer<typeof sourceSpanSchema>;
/** One recognised word the ASR was unsure of, in sentence order. Version 1 addition, sent with audio input. */
export const lowConfidenceWordSchema = z.object({
  text: boundedText(64).refine(s => s.trim().length > 0), confidence: z.number().min(0).max(1)
}).strict();
export type LowConfidenceWord = z.infer<typeof lowConfidenceWordSchema>;
export const MAX_LOW_CONFIDENCE_WORDS = 12;
export const textInputSchema = z.object({
  schemaVersion: z.literal(1), requestId: id, sessionId: id, sessionEpoch: z.number().int().positive(), revision: z.number().int().positive(),
  mode: z.enum(['ocr', 'audio', 'typed']), text: boundedText(800).refine(s => s.trim().length > 0), language: z.literal('en'),
  capturedAt: z.iso.datetime({ offset: true }),
  capture: z.object({
    source: z.enum(['glasses_hfp','glasses_stream_audio','glasses_camera','phone_mic','phone_camera','typed_fixture','recorded_fixture']), segmentId: id,
    confidence: z.number().min(0).max(1).nullable(), final: z.boolean().optional(),
    lowConfidenceWords: z.array(lowConfidenceWordSchema).max(MAX_LOW_CONFIDENCE_WORDS).optional()
  }).strict(),
  context: z.array(boundedText(1200)).max(2).refine(c => codePoints(c.join('')).length <= 1200), userInitiated: z.boolean()
}).strict();
export type TextInput = z.infer<typeof textInputSchema>;

// What a selection is (ported from the reference app's SelectionKind). Only `claim` is searched.
export const SELECTION_KINDS = ['claim', 'opinion', 'prediction', 'question', 'instruction', 'other'] as const;
export type SelectionKind = typeof SELECTION_KINDS[number];
export const NON_CLAIM_KINDS = ['opinion', 'prediction', 'question', 'instruction', 'other'] as const;
export type NonClaimKind = typeof NON_CLAIM_KINDS[number];
/** Spoken and card text when the wearer asked about something that is not a checkable claim. */
export const NON_CLAIM_SUMMARIES: Readonly<Record<NonClaimKind, string>> = {
  prediction: "That's a prediction.", opinion: "That's an opinion.", question: "That's a question.",
  instruction: "That's an instruction.", other: 'Not a checkable fact.',
};
/** Spoken and card text for claim.needs_confirmation with reasonCode `possibly_misheard`. */
export const NEEDS_CONFIRMATION_SUMMARIES: Readonly<Record<TextInput['mode'], string>> = {
  audio: "I'm not sure what was said.", ocr: "I'm not sure what was read.", typed: "I'm not sure what you meant.",
};
// Which kind of source settles a claim (ported from the reference app's ClaimRoute).
export const CLAIM_ROUTES = ['recent_event', 'named_fact', 'weather', 'calculation', 'general'] as const;
export type ClaimRoute = typeof CLAIM_ROUTES[number];
/**
 * A named speaker or outlet whose statement is checked instead of its content: "Kushner said ..." about a
 * recent event (mode `said`) or "According to Politico, ..." (mode `reported`). `source` is a name taken
 * verbatim from the captured text by code; Jev only chooses among such names.
 */
export type AttributionFrame = { source: string; mode: 'said' | 'reported' };
/** Shared reason codes introduced by the fact-check port. Older codes stay valid. */
export const REASON_CODES = {
  notAClaim: 'not_a_claim', privateOrPersonal: 'private_or_personal', possiblyMisheard: 'possibly_misheard',
  subjectMissing: 'subject_missing', unconfirmedRumour: 'unconfirmed_rumour', privateLifeNotChecked: 'private_life_not_checked',
} as const;

export type AdmissionMetadata = {
  assertionStatus: 'asserted' | 'nonliteral_or_quoted' | 'unclear'; hasPracticalConsequence: number | null;
  matchedSelectedTopic: string | null; admissionAction: 'wait' | 'skip' | 'check'; reasonCode: string;
};
export type AcceptedClaim = {
  id: string; originalText: string; checkedText: string; sourceSpan: SourceSpan; admission: AdmissionMetadata;
  // Version 1 additions decided at admission. Absent fields read as claimFrame() defaults.
  route?: ClaimRoute;
  /** Who or what the claim is about, chosen by Jev among names from the context or the rest of the OCR text. */
  subject?: string | null;
  /** Set only when the check is whether the named source said or reported it. */
  attribution?: AttributionFrame | null;
  /** About something that has not happened yet: judged against current plans, announcements and estimates. */
  future?: boolean;
  /** Presented as, or known as, a rumour, allegation or speculation. */
  rumour?: boolean;
  /** An allegation about an identifiable person's private life: never sent to any source. */
  privateLife?: boolean;
  /** A needed subject is missing. Only admitted for an explicit request, which answers Can't verify. */
  subjectMissing?: boolean;
};
export type ClaimFrame = {
  route: ClaimRoute; subject: string | null; attribution: AttributionFrame | null;
  future: boolean; rumour: boolean; privateLife: boolean; subjectMissing: boolean;
};
export const claimFrame = (claim: AcceptedClaim): ClaimFrame => ({
  route: claim.route ?? 'general', subject: claim.subject ?? null, attribution: claim.attribution ?? null,
  future: claim.future ?? false, rumour: claim.rumour ?? false, privateLife: claim.privateLife ?? false, subjectMissing: claim.subjectMissing ?? false,
});
/** `kind` is set when the input was turned away because it is not a checkable claim (reasonCode `not_a_claim`). */
export type AdmissionResult = { action: 'wait' | 'skip' | 'check' | 'needs_confirmation'; reasonCode: string; claims: AcceptedClaim[]; kind?: NonClaimKind };

/** `jev` counts per request; every other kind counts per claim. */
export type ProviderKind = 'jev' | 'search' | 'contents' | 'factcheck' | 'wikipedia' | 'wikidata' | 'weather';
/** Attempt allowances, retries included. `search` is Exa: news, web fallback, corroboration and alternate retrieval together. */
export const PROVIDER_LIMITS: Readonly<Record<ProviderKind, number>> = {
  jev: 8, search: 2, contents: 3, factcheck: 1, wikipedia: 1, wikidata: 3, weather: 2,
};
export interface ProviderContext {
  signal: AbortSignal; consume(kind: ProviderKind, claimId?: string): void; now(): number; recordUsage?(usage: { inputTokens?: number }): void;
  /** Runtime contexts report whether one more attempt fits the deadline and allowance. */
  canConsume?(kind: ProviderKind, claimId?: string): boolean;
  deadlineAt?: number;
}
export class PipelineError extends Error {
  constructor(public code: string, public retryable = false) { super(code); this.name = 'PipelineError'; }
}
/** Where a piece of evidence came from. `web` and `news` are Exa searches. */
export const EVIDENCE_ORIGINS = ['web', 'news', 'fact_check', 'wikipedia', 'wikidata', 'weather', 'calculation'] as const;
export type EvidenceOrigin = typeof EVIDENCE_ORIGINS[number];
/** Calculation evidence has no web page. Its url is this reserved placeholder (RFC 2606), which apps never open. */
export const CALCULATION_URL = 'https://facto.invalid/calculation';
export type Evidence = {
  id: string; url: string; title: string; publisher: string | null; publishedAt: string | null; retrievedAt: string;
  contentBasis: 'highlight' | 'page_text'; excerpt: string; sourceGroup: string; echoGroup: string | null;
  sourceRole: 'primary' | 'secondary' | 'unknown'; directlyAddressesClaim: boolean; matchesTimePlaceAndPopulation: boolean;
  stance: 'supports' | 'contradicts' | 'unrelated'; stanceProbability: number | null;
  /** Version 1 addition. Absent means an Exa web result (older servers). */
  origin?: EvidenceOrigin;
  /** A matched fact check's rating as a label. Only with origin `fact_check`; its stance is fixed by it. */
  rating?: 'supported' | 'contradicted' | 'misleading';
};
/** Jev's judgment labels. */
export type Verdict = 'supported' | 'contradicted' | 'misleading' | 'insufficient_evidence';
/** Labels a result can carry. `speculation` is decided by policy, never by a Jev judgment label. */
export const RESULT_VERDICTS = ['supported', 'contradicted', 'misleading', 'insufficient_evidence', 'speculation'] as const;
export type ResultVerdict = typeof RESULT_VERDICTS[number];
export const SPECULATION_REASONS = [REASON_CODES.unconfirmedRumour, REASON_CODES.privateLifeNotChecked] as const;
export type SpeculationReason = typeof SPECULATION_REASONS[number];
/** Spoken and card text for each speculation reason. */
export const SPECULATION_SUMMARIES: Readonly<Record<SpeculationReason, string>> = {
  unconfirmed_rumour: 'Speculation. No credible source confirms this.',
  private_life_not_checked: "Speculation. Claims about someone's private life aren't checked.",
};
/** What a future claim was judged against. */
export const RESULT_BASES = ['estimates', 'announcement'] as const;
export type ResultBasis = typeof RESULT_BASES[number];
export const BASIS_LABELS: Readonly<Record<ResultBasis, string>> = { estimates: 'Based on current estimates', announcement: 'Officially announced' };
/** Outcome of an attribution check: `reported` goes with supported, `not_said` with contradicted. */
export type ResultAttribution = { label: 'reported' | 'not_said'; source: string; mode: AttributionFrame['mode'] };
/** "Politico reported this", "Kushner said this", "Not what Politico reported", "Not what Kushner said". */
export const attributionLabel = (attribution: ResultAttribution): string => {
  const verb = attribution.mode === 'reported' ? 'reported' : 'said';
  return attribution.label === 'reported' ? `${attribution.source} ${verb} this` : `Not what ${attribution.source} ${verb}`;
};
export type Judgment = {
  checkedText?: string; misleadingEvidenceIds?: string[];
  label: Verdict; probabilities: Record<Verdict, number>; evidence: Evidence[]; selectedEvidenceIds: string[];
  misleadingReason: 'omitted_condition' | 'outdated_fact' | 'exaggeration' | null;
};
export type VerdictDecision = {
  verdict: Verdict; reasonCode: string; selectedEvidenceIds: string[]; summary: string;
  basis?: ResultBasis; attribution?: ResultAttribution;
};
/** A decision as delivered: a verdict decision, or speculation decided by policy. */
export type ResultDecision = Omit<VerdictDecision, 'verdict'> & { verdict: ResultVerdict };
/** Provider attempts spent so far: Jev for the whole request, Exa searches for this claim. */
export type CheckUsage = { jevCalls: number; exaSearches: number };
export type Presentation = { action: 'silent' | 'notify' | 'respond'; reasonCode: string };
export type PresentationState = {
  active: boolean; healthy: boolean; current: boolean; expired: boolean; duplicate: boolean; notificationCount: number;
};
export type Preferences = { muted: boolean; automaticNotifications: boolean; selectedTopics: string[] };
export type ClaimResult = ResultDecision & {
  originalText: string; checkedText: string; sourceSpan: SourceSpan; evidence: Evidence[]; checkedAt: string; expiresAt: string;
  durationMs: number; cached: boolean; policyVersion: string; modelVersion: string; presentation: Presentation;
  route?: ClaimRoute; subject?: string | null; usage?: CheckUsage;
};
export type EventType = 'session.ready' | 'session.ended' | 'claim.detected' | 'claim.waiting' | 'claim.skipped' | 'claim.needs_confirmation' | 'claim.checking' | 'claim.result' | 'claim.superseded' | 'check.cancelled' | 'pipeline.error' | 'audio.ready' | 'audio.stopped' | 'transcript.partial' | 'transcript.final' | 'capture.request';
export type EventEnvelope = {
  schemaVersion: 1; eventId: string; eventSeq: number; sessionId: string; sessionEpoch: number; requestId?: string; claimId?: string; revision?: number;
  type: EventType; serverAt: string; payload: unknown;
};
/** Payload of claim.checking, claim.skipped and claim.needs_confirmation. Not a factual verdict. */
export type AdmissionPayload = {
  admissionAction: AdmissionMetadata['admissionAction']; reasonCode: string; presentation?: Presentation;
  /** claim.skipped / claim.needs_confirmation: what the input is, when it is not a checkable claim. */
  kind?: NonClaimKind;
  /** Ready-to-speak line for a respond presentation, e.g. NON_CLAIM_SUMMARIES[kind]. */
  summary?: string;
  /** claim.checking: how the admitted claim is routed and what it is about. */
  route?: ClaimRoute; subject?: string | null;
  usage?: CheckUsage;
};
export interface PipelineAdapters {
  classify(input: TextInput, context: ProviderContext): Promise<AdmissionResult>;
  retrieve(claim: AcceptedClaim, context: ProviderContext): Promise<Evidence[]>;
  judge(claim: AcceptedClaim, evidence: Evidence[], context: ProviderContext): Promise<Judgment>;
}

// Evidence sources seam (fact-check port): free sources first, then at most PROVIDER_LIMITS.search Exa searches.
/** All a source may see: the checked claim and its subject. Never context, never rejected or private spans. */
export type SourceQuery = {
  claimId: string; text: string; subject: string | null; route: ClaimRoute;
  attribution: AttributionFrame | null; future: boolean; rumour: boolean;
  /** Check date, YYYY-MM-DD (UTC), for relative dates and recency. */
  asOf: string;
};
export const sourceQuery = (claim: AcceptedClaim, now: number): SourceQuery => {
  const frame = claimFrame(claim);
  return { claimId: claim.id, text: claim.checkedText, subject: frame.subject, route: frame.route, attribution: frame.attribution,
    future: frame.future, rumour: frame.rumour, asOf: new Date(now).toISOString().slice(0, 10) };
};
/** The query text sources search for: the subject in front of the claim when there is one. */
export const sourceQueryText = (query: Pick<SourceQuery, 'text' | 'subject'>): string => query.subject ? `${query.subject} ${query.text}` : query.text;
export const FREE_SOURCES = ['fact_check', 'wikipedia', 'wikidata', 'weather', 'calculation'] as const;
export type FreeSourceName = typeof FREE_SOURCES[number];
/** `answered`: true answered (maybe with nothing), false failed or ran out of time (never "nothing found"), null not asked. */
export type FreeEvidence = { evidence: Evidence[]; answered: Record<FreeSourceName, boolean | null> };
export type PaidSearchPurpose = 'primary' | 'corroboration' | 'alternate';
/** `excludeSites` are site keys (SourceTraits.site) kept out of a corroboration search. */
export type PaidSearchRequest = { purpose: PaidSearchPurpose; excludeSites?: string[] };
/** `categories`: the Exa searches actually sent, in order, e.g. ['news', 'web'] after a news search found too little. */
export type PaidEvidence = { evidence: Evidence[]; categories: ('news' | 'web')[] };
/** One voice per `site`. `trusted` follows policy: fact checks, Wikipedia, Wikidata, calculation, Open-Meteo,
 * trusted domains, and for an attributed claim a news report or the named source's own site. */
export type SourceTraits = { site: string; trusted: boolean };
export interface EvidenceSources {
  gatherFree(query: SourceQuery, context: ProviderContext): Promise<FreeEvidence>;
  searchPaid(query: SourceQuery, request: PaidSearchRequest, context: ProviderContext): Promise<PaidEvidence>;
  /** Drops unreliable and low-signal sites, puts trusted first, at most 2 per site and 6 in all; free evidence takes at most 3 slots when paid results exist. */
  rank(free: Evidence[], paid: Evidence[]): Evidence[];
  traits(evidence: Evidence, attribution: AttributionFrame | null): SourceTraits;
}
