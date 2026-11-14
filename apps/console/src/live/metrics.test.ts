import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../../packages/contracts/src/index.js';
import { parseDevelopmentManifest, publicCasePlan, type LiveCase } from './cases.js';
import { excerptSHA256, summarizeCampaign, type CitationReview } from './metrics.js';

const text = 'The archive opened in 1901.';
const sample: LiveCase = { label: 'archive', text, allowedPublic: [text], expected: { claims: [{ id: 'opening', acceptedTexts: [text], verdict: 'supported', domain: 'history' }], admissionAction: 'check' } };
const manifest = () => ({ schemaVersion: 1, kind: 'open_development', name: 'public-study', cases: [structuredClone(sample)] });
const evidence: Evidence = { id: 'record-1', url: 'https://example.org/register', title: 'Register', excerpt: 'The register records an opening in 1901.',
  publisher: null, publishedAt: null, retrievedAt: '2026-11-14T00:00:00Z', contentBasis: 'page_text', sourceGroup: 'example.org', echoGroup: null,
  sourceRole: 'primary', directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: 1 };
const report = () => ({ label: sample.label, status: 'observed', terminalReceived: true, admittedPublic: [text], rejectedAdmissionCount: 0,
  admission: { action: 'check' }, events: [{ type: 'claim.result', claimId: 'runtime-claim', checkedPublicText: text, verdict: 'supported', cached: false,
    selectedEvidenceIds: [evidence.id], evidence: [evidence] }] });
const review = (): CitationReview => ({ caseLabel: sample.label, expectedClaimId: 'opening', evidenceId: evidence.id, url: evidence.url,
  excerptSHA256: excerptSHA256(evidence.excerpt), status: 'verified', reviewedAt: '2026-11-14T00:00:00Z', reviewer: 'independent_agent', note: 'Opened record and checked the stated date.' });

describe('explicit open development manifests', () => {
  it('requires expectations and rejects hidden configuration or duplicate/conflicting spans', () => {
    expect(parseDevelopmentManifest(manifest()).cases).toHaveLength(1);
    expect(() => parseDevelopmentManifest({ ...manifest(), limits: { calls: 999 } })).toThrow();
    const missing = manifest(); delete missing.cases[0].expected;
    expect(() => parseDevelopmentManifest(missing)).toThrow();
    const duplicate = manifest(); duplicate.cases.push(duplicate.cases[0]);
    expect(() => parseDevelopmentManifest(duplicate)).toThrow('Duplicate case labels');
    const conflict = manifest(); conflict.cases[0].expected!.claims.push({ ...conflict.cases[0].expected!.claims[0], id: 'different', verdict: 'contradicted' });
    expect(() => parseDevelopmentManifest(conflict)).toThrow('Conflicting');
  });

  it('requires exact input substrings and public literal selected topics', () => {
    const rewritten = manifest(); rewritten.cases[0].allowedPublic = ['The archive opened in 1902.'];
    expect(() => parseDevelopmentManifest(rewritten)).toThrow('exact input substrings');
    const privateTopic = manifest(); privateTopic.cases[0].preferences = { muted: false, automaticNotifications: true, selectedTopics: ['PRIVATE_MARKER'] };
    expect(() => parseDevelopmentManifest(privateTopic)).toThrow('declared public span');
    const privateControl: LiveCase = { label: 'private', text: 'PRIVATE_MARKER', allowedPublic: [], expected: { claims: [] } };
    expect(JSON.stringify(publicCasePlan(privateControl))).not.toContain('PRIVATE_MARKER');
  });

  it('keeps the 16-case ceiling and forbids non-check labels on eligible claims', () => {
    expect(() => parseDevelopmentManifest({ ...manifest(), cases: Array.from({ length: 17 }, (_, index) => ({ ...sample, label: `case-${index}` })) })).toThrow();
    const inconsistent = manifest(); inconsistent.cases[0].expected!.admissionAction = 'skip';
    expect(() => parseDevelopmentManifest(inconsistent)).toThrow('conflict');
  });
});

describe('honest factual and admission metrics', () => {
  it('counts one match per expected proposition, duplicate/unsafe admissions as false positives, and unobserved claims as misses', () => {
    const metrics = summarizeCampaign([sample, { ...sample, label: 'unobserved' }], [{ ...report(), admittedPublic: [text, text], rejectedAdmissionCount: 1 }]);
    expect(metrics.admission).toMatchObject({ truePositives: 1, falsePositives: 2, falseNegatives: 1, unobservedExpected: 1, precision: 1 / 3, recall: 0.5 });
    expect(metrics.factual).toMatchObject({ expected: 2, correctDefinitive: 1, notObserved: 1, definitiveCoverage: 0.5, sourceVerifiedCoverage: 0 });
    expect(metrics.claimOutcomes[0].sourceVerification).toBe('unreviewed');
  });

  it('distinguishes truth agreement from external source verification tied to exact returned evidence', () => {
    expect(summarizeCampaign([sample], [report()], [review()]).factual.sourceVerifiedCorrect).toBe(1);
    const failed = summarizeCampaign([sample], [report()], [{ ...review(), status: 'inaccessible' }]);
    expect(failed.factual).toMatchObject({ correctDefinitive: 1, sourceVerifiedCorrect: 0 });
    expect(failed.claimOutcomes[0].sourceVerification).toBe('failed');
    expect(() => summarizeCampaign([sample], [report()], [{ ...review(), excerptSHA256: '0'.repeat(64) }])).toThrow('retained source');
    expect(() => summarizeCampaign([sample], [report()], [{ ...review(), status: 'probably_verified' }])).toThrow();
    expect(() => summarizeCampaign([sample], [report()], [review(), review()])).toThrow('Duplicate citation reviews');
    expect(() => summarizeCampaign([sample], [report()], [{ ...review(), evidenceId: 'unselected' }])).toThrow('selected reference');
  });

  it('requires every selected source and separates wrong verdicts, abstentions, cached samples and missing results', () => {
    const second = { ...evidence, id: 'record-2', url: 'https://elsewhere.example/record' };
    const twoSources = report(); twoSources.events[0].selectedEvidenceIds.push(second.id); twoSources.events[0].evidence.push(second);
    expect(summarizeCampaign([sample], [twoSources], [review()]).factual.sourceVerifiedCorrect).toBe(0);
    const wrong = report(); wrong.events[0].verdict = 'contradicted'; wrong.events[0].cached = true;
    expect(summarizeCampaign([sample], [wrong]).factual).toMatchObject({ wrongDefinitive: 1, correctDefinitive: 0, cachedResults: 1, coldCorrect: 0 });
    const abstained = report(); abstained.events[0].verdict = 'insufficient_evidence';
    expect(summarizeCampaign([sample], [abstained]).factual.abstained).toBe(1);
    expect(summarizeCampaign([sample], [{ ...report(), events: [] }]).factual.noResult).toBe(1);
    const doubled = report(); doubled.events.push(doubled.events[0]);
    expect(summarizeCampaign([sample], [doubled]).factual.correctDefinitive).toBe(0);
  });

  it('does not convert unlabeled cases into factual or admission accuracy evidence', () => {
    const unlabeled = { ...sample, expected: undefined };
    const metrics = summarizeCampaign([unlabeled], [report()]);
    expect(metrics).toMatchObject({ labeledCases: 0, unlabeledCases: 1 });
    expect(metrics.admission.precision).toBeNull(); expect(metrics.admission.recall).toBeNull();
    expect(metrics.factual.expected).toBe(0);
  });
});
