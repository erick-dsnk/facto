import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Preferences } from '../../../../packages/contracts/src/index.js';

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const publicText = z.string().min(1).refine(text => Array.from(text).length <= 800);
const expectedClaimSchema = z.object({
  id: identifier, acceptedTexts: z.array(publicText).min(1).max(4),
  verdict: z.enum(['supported', 'contradicted', 'misleading']), domain: identifier,
}).strict();
const expectationSchema = z.object({
  claims: z.array(expectedClaimSchema).max(2),
  admissionAction: z.enum(['check', 'skip', 'wait', 'needs_confirmation']).optional(),
  presentationActions: z.array(z.enum(['silent', 'notify', 'respond'])).min(1).max(3).optional(),
}).strict();
const preferencesSchema = z.object({ muted: z.boolean(), automaticNotifications: z.boolean(), selectedTopics: z.array(z.string().min(1).max(80)).max(5) }).strict();
const caseSchema = z.object({
  label: identifier, text: publicText, allowedPublic: z.array(publicText).max(8),
  automatic: z.boolean().optional(), final: z.boolean().optional(), cancelAfterDetected: z.boolean().optional(),
  preferences: preferencesSchema.optional(), expected: expectationSchema.optional(),
}).strict();

export type CaseExpectation = z.infer<typeof expectationSchema>;
export type LiveCase = {
  label: string; text: string; allowedPublic: string[]; automatic?: boolean; final?: boolean; cancelAfterDetected?: boolean;
  preferences?: Preferences; expected?: CaseExpectation;
};
export const DEFAULT_PREFERENCES: Preferences = { muted: false, automaticNotifications: false, selectedTopics: [] };

export function validateLiveCases(value: unknown): LiveCase[] {
  const cases = z.array(caseSchema).min(1).max(16).parse(value);
  if (new Set(cases.map(sample => sample.label)).size !== cases.length) throw new Error('Duplicate case labels');
  for (const sample of cases) {
    if (new Set(sample.allowedPublic).size !== sample.allowedPublic.length || sample.allowedPublic.some(text => !sample.text.includes(text))) throw new Error('Public spans must be unique exact input substrings');
    const claims = sample.expected?.claims ?? [];
    const accepted = claims.flatMap(claim => claim.acceptedTexts);
    if (new Set(claims.map(claim => claim.id)).size !== claims.length || new Set(accepted).size !== accepted.length) throw new Error('Conflicting expected claim identifiers or spans');
    if (accepted.some(text => !sample.allowedPublic.includes(text))) throw new Error('Expected spans must be in the public allowlist');
    if (sample.preferences?.selectedTopics.some(topic => !sample.allowedPublic.some(text => text.includes(topic)))) throw new Error('Selected topics must occur in a declared public span');
    if (sample.expected?.admissionAction === 'check' && !claims.length) throw new Error('Check expectation requires an eligible claim');
    if (sample.expected?.admissionAction && sample.expected.admissionAction !== 'check' && claims.length) throw new Error('Eligible claims conflict with non-check expectation');
  }
  return cases;
}

/** Explicit development-only input; no corpus discovery or held-out loading. */
export function parseDevelopmentManifest(value: unknown) {
  const manifest = z.object({ schemaVersion: z.literal(1), kind: z.literal('open_development'), name: identifier, cases: z.array(caseSchema.extend({ expected: expectationSchema })).min(1).max(16) }).strict().parse(value);
  validateLiveCases(manifest.cases);
  return manifest;
}

export async function loadDevelopmentManifest(path: string) {
  const bytes = await readFile(path);
  if (bytes.byteLength > 131_072) throw new Error('Development manifest exceeds byte limit');
  return { manifest: parseDevelopmentManifest(JSON.parse(bytes.toString('utf8'))), sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Report/plan projection intentionally omits raw input, including synthetic controls. */
export function publicCasePlan(sample: LiveCase) {
  return { label: sample.label, allowedPublic: sample.allowedPublic, automatic: !!sample.automatic, final: sample.final ?? true,
    cancellation: !!sample.cancelAfterDetected, preferences: sample.preferences ?? DEFAULT_PREFERENCES, expected: sample.expected };
}
