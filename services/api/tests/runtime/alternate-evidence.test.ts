import { describe, expect, it } from 'vitest';
import { type Evidence, type Judgment } from '../../../../packages/contracts/src/index.js';
import { type AssessedJudgment } from '../../src/policy/assessment.js';
import { independentSourceCount } from '../../src/policy/sources.js';
import { decideVerdict } from '../../src/policy/verdict.js';
import { retainAlternateEvidence } from '../../src/runtime/alternate-evidence.js';

const checkedText = 'Aster was founded in Belvar in 1890.';
const source = (id: string, overrides: Partial<Evidence> = {}): Evidence => ({ id, url: `https://${id}.example/record`, title: 'Archive', publisher: null,
  publishedAt: null, retrievedAt: '2026-11-14T12:00:00Z', contentBasis: 'highlight', excerpt: `Archive ${id} describes a municipal record.`,
  sourceGroup: id, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false,
  stance: 'unrelated', stanceProbability: null, ...overrides });
const noise = (id: string) => source(id, { title: checkedText, excerpt: `${checkedText} Aster Belvar founded 1890. A long topical repetition with no substantive underlying basis.` });
const judgment = (records: Evidence[]): AssessedJudgment => ({ checkedText, label: 'insufficient_evidence',
  probabilities: { supported: 0, contradicted: 0, misleading: 0, insufficient_evidence: 1 }, selectedEvidenceIds: [], misleadingReason: null,
  evidence: records.map(record => ({ ...record, directlyAddressesClaim: true, matchesTimePlaceAndPopulation: true, stance: 'supports', stanceProbability: .99 })),
  sourceAssessments: Object.fromEntries(records.map(record => [record.id, { contentBasis: 'original_record', confidence: .99 }])),
  claimRisk: { level: 'ordinary', confidence: .99 }, originAssessments: [] });

describe('bounded assessment-aware alternate evidence retention', () => {
  it('keeps two substantive old witnesses ahead of six more lexically similar incoming repetitions', () => {
    const old = [source('alpha'), source('bravo', { excerpt: 'A separate register documents civic establishment and the dated charter.' })];
    const retained = retainAlternateEvidence(old, Array.from({ length: 6 }, (_, index) => noise(`new-${index}`)), checkedText, judgment(old));
    expect(retained).toHaveLength(6);
    expect(retained.slice(0, 2).map(record => record.id)).toEqual(['bravo', 'alpha']);
    expect(retained.filter(record => record.id.startsWith('new-'))).toHaveLength(4);
  });

  it('leaves room for both incoming records, including a lower-lexical candidate, when all six old sources are useful', () => {
    const old = Array.from({ length: 6 }, (_, index) => source(`old-${index}`, { excerpt: `${index} distinct documentary catalogue with unique archival material ${'x'.repeat(index + 1)}.` }));
    const incoming = [noise('new-topical'), source('new-contrary', { excerpt: 'Contrary dated ledger.' })];
    const retained = retainAlternateEvidence(old, incoming, checkedText, judgment(old));
    expect(retained).toHaveLength(6);
    expect(retained.map(record => record.id)).toEqual(expect.arrayContaining(['new-topical', 'new-contrary']));
    expect(retained.filter(record => record.id.startsWith('old-')).length).toBeLessThan(6);
  });

  it('preserves one prior direct witness on each side of a conflict, preferring substantive witnesses', () => {
    const old = [noise('bare-support'), source('useful-support'), source('bare-contrary')];
    const assessed = judgment(old);
    assessed.sourceAssessments['bare-support'] = { contentBasis: 'bare_assertion', confidence: .99 };
    assessed.sourceAssessments['bare-contrary'] = { contentBasis: 'bare_assertion', confidence: .99 };
    assessed.evidence[2].stance = 'contradicts';
    const retained = retainAlternateEvidence(old, Array.from({ length: 6 }, (_, index) => noise(`new-${index}`)), checkedText, assessed);
    expect(retained.slice(0, 2).map(record => record.id)).toEqual(['useful-support', 'bare-contrary']);
  });

  it('reserves only two old substantive-category candidates by confidence while leaving four fresh slots', () => {
    const old = [noise('bare'), source('lower'), source('record'), source('strongest'), source('runner-up')];
    const assessed = judgment(old);
    assessed.sourceAssessments = {
      bare: { contentBasis: 'bare_assertion', confidence: 1 },
      lower: { contentBasis: 'substantive_secondary', confidence: .64 },
      record: { contentBasis: 'original_record', confidence: .78 },
      strongest: { contentBasis: 'substantive_secondary', confidence: .84 },
      'runner-up': { contentBasis: 'attributable_research', confidence: .83 },
    };
    const retained = retainAlternateEvidence(old, Array.from({ length: 6 }, (_, index) => noise(`new-${index}`)), checkedText, assessed);
    expect(retained.slice(0, 2).map(record => record.id)).toEqual(['strongest', 'runner-up']);
    expect(retained.filter(record => record.id.startsWith('new-'))).toHaveLength(4);
    expect(retained.some(record => ['bare', 'lower', 'record'].includes(record.id))).toBe(false);
    const fresh = judgment(retained);
    fresh.label = 'supported'; fresh.probabilities = { supported: .99, contradicted: 0, misleading: 0, insufficient_evidence: .01 };
    for (const record of retained) fresh.sourceAssessments[record.id] = assessed.sourceAssessments[record.id]
      ?? { contentBasis: 'bare_assertion', confidence: 1 };
    expect(decideVerdict(fresh)).toMatchObject({ verdict: 'insufficient_evidence', reasonCode: 'insufficient_independent_evidence' });
  });

  it('retains an identified old record below the verdict threshold rather than six incoming repetitions', () => {
    const old = [source('identified-record')];
    const assessed = judgment(old);
    assessed.sourceAssessments['identified-record'] = { contentBasis: 'original_record', confidence: .78 };
    const retained = retainAlternateEvidence(old, Array.from({ length: 6 }, (_, index) => noise(`new-${index}`)), checkedText, assessed);
    expect(retained).toHaveLength(6);
    expect(retained[0].id).toBe('identified-record');
    expect(retained[0]).toMatchObject({ directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null });
  });

  it.each(['missing', 'negative-category', 'inherited', 'scope'] as const)('does not pin ordinary evidence with %s assessment', mode => {
    const old = [source('old')];
    const assessed = judgment(old);
    let supplied: Judgment = assessed;
    if (mode === 'missing') supplied = { label: assessed.label, probabilities: assessed.probabilities, evidence: assessed.evidence, selectedEvidenceIds: [], misleadingReason: null };
    if (mode === 'negative-category') assessed.sourceAssessments.old = { contentBasis: 'bare_assertion', confidence: 1 };
    if (mode === 'inherited') assessed.sourceAssessments = Object.create(assessed.sourceAssessments) as AssessedJudgment['sourceAssessments'];
    if (mode === 'scope') assessed.evidence[0].matchesTimePlaceAndPopulation = false;
    const retained = retainAlternateEvidence(old, Array.from({ length: 6 }, (_, index) => noise(`new-${index}`)), checkedText, supplied);
    expect(retained.some(record => record.id === 'old')).toBe(false);
  });

  it('does not let unjudged duplicate metadata unpin identical old material, but replaces changed material', () => {
    const old = [source('alpha'), source('bravo', { excerpt: 'A separate register documents civic establishment and the dated charter.' })];
    const identical = [{ ...old[0], retrievedAt: '2026-11-14T12:01:00Z' }, ...Array.from({ length: 5 }, (_, index) => noise(`new-${index}`))];
    expect(retainAlternateEvidence(old, identical, checkedText, judgment(old)).some(record => record.id === 'alpha')).toBe(true);
    const updated = { ...old[0], title: 'Revised record', excerpt: 'Revised contrary archive.' };
    const retained = retainAlternateEvidence(old, [updated], checkedText, judgment(old));
    expect(retained.find(record => record.id === 'alpha')?.excerpt).toBe(updated.excerpt);
    expect(retained[0].id).toBe('bravo');
    expect(retained.find(record => record.id === 'alpha')?.stance).toBe('unrelated');
  });

  it('rederives domains and never exceeds six records or two per actual domain', () => {
    const old = [source('old-one', { sourceGroup: 'forged', url: 'https://one.same.example/a' }), source('old-two', { sourceGroup: 'other', url: 'https://two.same.example/b' })];
    const incoming = [source('new-one', { sourceGroup: 'unrelated', url: 'https://three.same.example/c' }), ...Array.from({ length: 5 }, (_, index) => noise(`different-${index}`))];
    const retained = retainAlternateEvidence(old, incoming, checkedText, judgment(old));
    expect(retained.length).toBeLessThanOrEqual(6);
    expect(retained.filter(record => record.sourceGroup === 'same.example').length).toBeLessThanOrEqual(2);
    expect(retained.every(record => !['forged', 'other', 'unrelated'].includes(record.sourceGroup))).toBe(true);
    expect(new Set(retained.map(record => record.id)).size).toBe(retained.length);
  });

  it.each(['id', 'url'] as const)('fails safely on an ambiguous %s identity collision', collision => {
    const old = [source('old')];
    const incoming = collision === 'id' ? [{ ...source('new'), id: 'old' }] : [{ ...source('new'), url: old[0].url }];
    expect(() => retainAlternateEvidence(old, incoming, checkedText, judgment(old))).toThrow('invalid_citation');
  });

  it('preserves deterministic copy-family identity when its old bridge is truncated', () => {
    const a = source('alpha', { contentBasis: 'page_text', excerpt: `${checkedText} red orange yellow green blue indigo violet apple pear plum peach apricot.` });
    const c = source('charlie', { contentBasis: 'page_text', excerpt: `${checkedText} eagle sparrow finch robin hawk owl heron crane ibis swan goose duck.` });
    const bridge = source('bridge', { excerpt: `${a.excerpt} ${c.excerpt}` });
    const assessed = judgment([a, bridge]); assessed.evidence[1].directlyAddressesClaim = false;
    const retained = retainAlternateEvidence([a, bridge], [c, ...Array.from({ length: 3 }, (_, index) => noise(`new-${index}`))], checkedText, assessed);
    expect(retained.some(record => record.id === 'bridge')).toBe(false);
    const pair = retained.filter(record => ['alpha', 'charlie'].includes(record.id));
    expect(pair).toHaveLength(2);
    expect(pair[0].echoGroup).not.toBeNull(); expect(pair[0].echoGroup).toBe(pair[1].echoGroup);
    expect(independentSourceCount(pair)).toBe(1);
  });

  it.each(['unchanged', 'changed-bridge', 'changed-witness'] as const)('does not mint independence after an assessed origin bridge is removed (%s)', mode => {
    const old = [source('alpha'), source('bridge'), source('charlie', { excerpt: 'A separate register documents civic establishment and the dated charter.' })];
    const assessed = judgment(old); assessed.evidence[1].directlyAddressesClaim = false;
    assessed.originAssessments = [
      { evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 },
      { evidenceIds: ['bridge', 'charlie'], relationship: 'common_origin', confidence: .99 },
    ];
    const changed = mode === 'unchanged' ? [] : [{ ...old[mode === 'changed-bridge' ? 1 : 0], excerpt: 'A revised contrary gardening reference.' }];
    const retained = retainAlternateEvidence(old, [...changed, ...Array.from({ length: 4 }, (_, index) => noise(`new-${index}`))], checkedText, assessed);
    expect(retained.filter(record => ['alpha', 'bridge', 'charlie'].includes(record.id))).toHaveLength(1);
    if (mode !== 'unchanged') expect(retained.some(record => record.id === changed[0].id && record.excerpt === changed[0].excerpt)).toBe(true);
  });

  it('keeps the initial conflict context when two opposite representatives depend on a model-assessed bridge', () => {
    const old = [source('alpha'), source('bridge'), source('charlie', { excerpt: 'A separate register documents civic establishment and the dated charter.' })];
    const assessed = judgment(old); assessed.evidence[1].directlyAddressesClaim = false; assessed.evidence[2].stance = 'contradicts';
    assessed.originAssessments = [
      { evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 },
      { evidenceIds: ['bridge', 'charlie'], relationship: 'common_origin', confidence: .99 },
    ];
    const retained = retainAlternateEvidence(old, Array.from({ length: 4 }, (_, index) => noise(`new-${index}`)), checkedText, assessed);
    expect(retained.map(record => record.id)).toEqual(old.map(record => record.id));
    expect(retained.every(record => record.echoGroup === null)).toBe(true);
  });

  it('does not let a recurring old result hide a fresh changed window from its known family', () => {
    const old = [noise('alpha'), source('bridge')];
    const assessed = judgment(old);
    assessed.evidence[1].directlyAddressesClaim = false;
    assessed.originAssessments = [{ evidenceIds: ['alpha', 'bridge'], relationship: 'common_origin', confidence: .99 }];
    const changed = { ...old[1], excerpt: 'Revised contrary ledger.' };
    const retained = retainAlternateEvidence(old, [old[0], changed, ...Array.from({ length: 4 }, (_, index) => source(`new-${index}`))], checkedText, assessed);
    expect(retained.find(record => record.id === 'bridge')).toMatchObject({ excerpt: changed.excerpt });
    expect(retained.some(record => record.id === 'alpha')).toBe(false);
  });
});
