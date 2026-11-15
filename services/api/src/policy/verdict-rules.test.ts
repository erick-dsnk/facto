import { describe, expect, it } from 'vitest';
import { getDomain } from 'tldts';
import type { Evidence, Verdict } from '../../../../packages/contracts/src/index.js';
import { findEchoes, tallySources, type SourceTally } from './source-tally.js';
import { abstentionReason, decideLabel, rankedSources, RULES } from './verdict-rules.js';

type Row = [host: string, stance: Evidence['stance'], probability: number];
/** Ported from the reference app's RulesTests: one passage per row, each saying `text` unless given its own. */
function tally(rows: Row[], options: { claim?: string; trusted?: string[]; texts?: string[]; ratedMisleading?: string[]; commonOrigins?: [string, string][] } = {}): SourceTally {
  const trusted = new Set(options.trusted ?? []);
  const judgments = rows.map(([, stance, probability], index) => ({ evidenceId: `e${index}`, text: options.texts?.[index] ?? `Snippet number ${index} about something else entirely here.`, stance, probability }));
  const traits = rows.map(([host]) => { const site = getDomain(host) ?? host; return { site, trusted: trusted.has(site) }; });
  return tallySources(judgments, traits, options.claim ?? 'Octopuses have three hearts.', { ratedMisleading: options.ratedMisleading, commonOrigins: options.commonOrigins });
}
const probabilities = (joint: Verdict, p: number, misleading = 0): Record<Verdict, number> =>
  ({ supported: 0, contradicted: 0, misleading, insufficient_evidence: 0, [joint]: p });
const label = (joint: Verdict, p: number, t: SourceTally, misleading = 0) => decideLabel(joint, probabilities(joint, p, joint === 'misleading' ? p : misleading), t);
const sure = 0.95, pTrue = RULES.minProbabilityTrue + 0.05, pFalse = RULES.minProbabilityFalse + 0.05;

describe('ported verdict rules', () => {
  it('needs two sites or one trusted site for True', () => {
    expect(label('supported', pTrue, tally([['a.org', 'supports', sure], ['b.com', 'supports', sure]]))).toBe('supported');
    expect(label('supported', pTrue, tally([['a.org', 'supports', sure], ['b.com', 'unrelated', sure]]))).toBe('insufficient_evidence');
    expect(label('supported', pTrue, tally([['en.wikipedia.org', 'supports', sure]], { trusted: ['wikipedia.org'] }))).toBe('supported');
  });

  it('counts sources by site, not by snippet', () => {
    const sameSite = tally([['news.a.org', 'supports', sure], ['www.a.org', 'supports', sure]]);
    expect(sameSite.counts.supporting).toBe(1);
    expect(label('supported', pTrue, sameSite)).toBe('insufficient_evidence');
    expect(tally([['a.org', 'contradicts', sure], ['a.org', 'contradicts', sure], ['b.org', 'contradicts', sure]]).counts.contradicting).toBe(2);
  });

  it('keeps the side of a site\'s surest judgment', () => {
    const t = tally([['a.org', 'unrelated', 0.99], ['a.org', 'supports', 0.7], ['a.org', 'contradicts', 0.9]]);
    expect(t.counts).toMatchObject({ supporting: 0, contradicting: 1, notAddressing: 0 });
  });

  it('lets a trusted site against it block True', () => {
    const t = tally([['a.org', 'supports', sure], ['b.com', 'supports', sure], ['snopes.com', 'contradicts', sure]], { trusted: ['snopes.com'] });
    expect(label('supported', sure, t)).not.toBe('supported');
    expect(t.counts.trustedContradicting).toBe(1);
    expect(abstentionReason('supported', probabilities('supported', sure), t)).toBe('conflicting_sources');
  });

  it('does not let a trusted page describing a myth block False', () => {
    const t = tally([['a.org', 'contradicts', sure], ['b.com', 'contradicts', sure], ['en.wikipedia.org', 'supports', sure]], { trusted: ['wikipedia.org'] });
    expect(label('contradicted', sure, t)).toBe('contradicted');
  });

  it('needs two contradicting sites or one trusted site for False', () => {
    expect(label('contradicted', pFalse, tally([['a.org', 'contradicts', sure], ['b.com', 'contradicts', sure]]))).toBe('contradicted');
    expect(label('contradicted', pFalse, tally([['a.org', 'contradicts', sure]]))).toBe('insufficient_evidence');
    expect(label('contradicted', pFalse, tally([['politifact.com', 'contradicts', sure]], { trusted: ['politifact.com'] }))).toBe('contradicted');
  });

  it('says False on one contradicting site when Jev is at least 90% sure and no site backs the claim', () => {
    const one = tally([['a.org', 'contradicts', sure]]);
    expect(label('contradicted', RULES.minProbabilityConfidentFalse, one)).toBe('contradicted');
    expect(label('contradicted', RULES.minProbabilityConfidentFalse - 0.01, one)).toBe('insufficient_evidence');
    const backed = tally([['a.org', 'contradicts', sure], ['b.com', 'supports', sure]]);
    expect(label('contradicted', sure, backed)).not.toBe('contradicted');
    expect(label('contradicted', sure, tally([['a.org', 'unrelated', sure]]))).toBe('insufficient_evidence');
  });

  it('gives each label its own minimum probability', () => {
    const support = tally([['a.org', 'supports', sure], ['b.com', 'supports', sure]]);
    expect(label('supported', RULES.minProbabilityTrue, support)).toBe('supported');
    expect(label('supported', RULES.minProbabilityTrue - 0.01, support)).toBe('insufficient_evidence');
    expect(abstentionReason('supported', probabilities('supported', RULES.minProbabilityTrue - 0.01), support)).toBe('below_threshold');
    const contra = tally([['a.org', 'contradicts', sure], ['b.com', 'contradicts', sure]]);
    expect(label('contradicted', RULES.minProbabilityFalse, contra)).toBe('contradicted');
    expect(label('contradicted', RULES.minProbabilityFalse - 0.01, contra)).toBe('insufficient_evidence');
    expect(RULES.minProbabilityFalse).toBeGreaterThan(RULES.minProbabilityTrue);
    expect(RULES.minProbabilityMisleading).toBeGreaterThan(RULES.minProbabilityTrue);
  });

  it('ignores a stance under 0.6', () => {
    const t = tally([['a.org', 'supports', sure], ['b.com', 'supports', RULES.stanceMinProbability - 0.01]]);
    expect(t.counts).toMatchObject({ supporting: 1, notAddressing: 1 });
    expect(label('supported', sure, t)).toBe('insufficient_evidence');
    expect(tally([['a.org', 'supports', 0.6]]).counts.supporting).toBe(1);
  });

  it('counts echoes on one side once and never lets them make a True alone', () => {
    const claim = 'The new vaccine changes your DNA permanently within two weeks of the first dose.';
    const copy = 'Experts warn the new vaccine changes your DNA permanently within two weeks of the first dose, a post says.';
    const echoes = tally([['blog-a.com', 'supports', sure], ['blog-b.net', 'supports', sure], ['blog-c.org', 'supports', sure]], { claim, texts: [copy, copy + ' Share.', 'Read: ' + copy] });
    expect(echoes.sources.every(source => source.echo)).toBe(true);
    expect(echoes.counts.supporting).toBe(1);
    expect(label('supported', sure, echoes)).toBe('insufficient_evidence');
    const mixed = tally([['blog-a.com', 'supports', sure], ['agency.gov', 'supports', sure]], { claim, texts: [copy, 'A health agency says vaccines do not alter human genetic material.'] });
    expect(mixed.counts.supporting).toBe(2);
    expect(mixed.plainSupporting).toBe(1);
    expect(label('supported', sure, mixed)).toBe('supported');
  });

  it('treats the same text on several sites as an echo, but never trusted text', () => {
    const wire = 'Officials said the bridge would reopen to traffic on Monday after three weeks of repairs.';
    expect([...findEchoes('The bridge reopened.', [wire, wire, 'Unrelated text about a festival in town this week.'], ['a.com', 'b.com', 'c.com'], [false, false, false])]).toEqual([0, 1]);
    const claim = 'Canberra is the capital city of Australia and was purpose built.';
    expect(findEchoes(claim, [claim], ['wikipedia.org'], [true]).size).toBe(0);
    expect([...findEchoes(claim, [claim], ['blog.com'], [false])]).toEqual([0]);
    // The same text twice on one site is not an echo of itself.
    expect(findEchoes('Short.', [wire, wire], ['a.com', 'a.com'], [false, false]).size).toBe(0);
  });

  it('needs sources on both sides, or a sure Jev and a contradiction, for Misleading', () => {
    const both = tally([['a.org', 'supports', sure], ['b.com', 'contradicts', sure]]);
    expect(label('supported', 0.5, both, RULES.minProbabilityMixed)).toBe('misleading');
    expect(label('supported', 0.5, both, RULES.minProbabilityMixed - 0.01)).toBe('insufficient_evidence');
    const contra = tally([['a.org', 'contradicts', sure], ['b.com', 'unrelated', sure]]);
    expect(label('misleading', RULES.minProbabilityMisleading, contra)).toBe('misleading');
    // Jev's misleading alone, or a weak one, is never shown.
    expect(label('misleading', RULES.minProbabilityMisleading - 0.01, contra)).toBe('insufficient_evidence');
    expect(label('misleading', 0.99, tally([['a.org', 'unrelated', sure], ['b.com', 'supports', sure]]))).toBe('insufficient_evidence');
  });

  it('shows Misleading for a fact check rated so unless Jev reads the claim as true', () => {
    const rated = tally([['factcheck.org', 'unrelated', 1]], { ratedMisleading: ['e0', 'missing'] });
    expect(rated.ratedMisleading).toEqual(['e0']);
    expect(label('insufficient_evidence', 0.9, rated)).toBe('misleading');
    expect(label('supported', 0.9, rated)).toBe('insufficient_evidence');
    expect(rankedSources('misleading', rated)).toEqual(['e0']);
  });

  it('counts passages with a disclosed common origin as one site', () => {
    const rows: Row[] = [['a.org', 'supports', sure], ['b.com', 'supports', sure]];
    expect(tally(rows).counts.supporting).toBe(2);
    const joined = tally(rows, { commonOrigins: [['e0', 'e1']] });
    expect(joined.counts.supporting).toBe(1);
    expect(label('supported', sure, joined)).toBe('insufficient_evidence');
  });

  it('cites only sources that agree with the label, trusted first', () => {
    const t = tally([['a.org', 'supports', 0.99], ['b.com', 'contradicts', sure], ['en.wikipedia.org', 'supports', 0.7]], { trusted: ['wikipedia.org'] });
    expect(rankedSources('supported', t)).toEqual(['e2', 'e0']);
    expect(rankedSources('contradicted', t)).toEqual(['e1']);
    // Misleading never offers a source that backs the claim; an abstention cites nothing.
    expect(rankedSources('misleading', t)).toEqual(['e1']);
    expect(rankedSources('insufficient_evidence', t)).toEqual([]);
  });

  it('keeps the counts behind a decision', () => {
    const t = tally([['a.org', 'supports', sure], ['snopes.com', 'supports', sure], ['c.net', 'contradicts', sure], ['d.net', 'unrelated', sure]], { trusted: ['snopes.com'] });
    expect(decideLabel('supported', probabilities('supported', sure), t)).toBe('supported');
    expect(t.counts).toEqual({ supporting: 2, contradicting: 1, notAddressing: 1, trustedSupporting: 1, trustedContradicting: 0 });
    expect(rankedSources('supported', t)[0]).toBe('e1');
  });

  it('names why it abstained', () => {
    expect(abstentionReason('supported', probabilities('supported', sure), tally([['a.org', 'unrelated', sure]]))).toBe('no_direct_evidence');
    expect(abstentionReason('insufficient_evidence', probabilities('insufficient_evidence', sure), tally([['a.org', 'supports', sure]]))).toBe('model_abstained');
    expect(abstentionReason('supported', probabilities('supported', sure), tally([['a.org', 'supports', sure]]))).toBe('insufficient_independent_evidence');
  });

  it('requires a trait for every judgment', () => {
    expect(() => tallySources([{ evidenceId: 'e0', text: 'x', stance: 'supports', probability: 1 }], [], 'claim')).toThrow(RangeError);
  });
});
