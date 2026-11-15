import { describe, expect, it } from 'vitest';
import type { Evidence, Verdict } from '../../../../packages/contracts/src/index.js';
import { CORROBORATION_RESULTS, corroborationNeeded, mergeCorroboration, supportingSites } from './corroboration.js';
import { tallySources, type SourceCounts } from './source-tally.js';

const counts = (overrides: Partial<SourceCounts> = {}): SourceCounts => ({ supporting: 1, contradicting: 0, notAddressing: 1, trustedSupporting: 0, trustedContradicting: 0, ...overrides });
const p = (supported: number): Record<Verdict, number> => ({ supported, contradicted: 0, misleading: 0, insufficient_evidence: 1 - supported });
const record = (id: string, host: string, stance: Evidence['stance'] = 'unrelated', stanceProbability: number | null = null): Evidence => ({
  id, url: `https://${host}/${id}`, title: id, publisher: null, publishedAt: null, retrievedAt: '2026-11-14T12:00:00Z', contentBasis: 'highlight',
  excerpt: `Passage ${id}.`, sourceGroup: host, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance, stanceProbability,
});
const site = (evidence: Evidence) => new URL(evidence.url).hostname;

describe('corroboration (ported from Corroboration.swift)', () => {
  it('runs only when exactly one untrusted site backs a claim Jev reads as true', () => {
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.9), counts())).toBe(true);
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.59), counts())).toBe(false);
    expect(corroborationNeeded('supported', 'supported', p(0.9), counts())).toBe(false);
    expect(corroborationNeeded('insufficient_evidence', 'contradicted', p(0.9), counts())).toBe(false);
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.9), counts({ supporting: 2 }))).toBe(false);
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.9), counts({ contradicting: 1 }))).toBe(false);
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.9), counts({ trustedSupporting: 1 }))).toBe(false);
    expect(corroborationNeeded('insufficient_evidence', 'supported', p(0.9), counts({ trustedContradicting: 1 }))).toBe(false);
  });

  it('names the sites already backing the claim', () => {
    const tally = tallySources([
      { evidenceId: 'a', text: 'one', stance: 'supports', probability: 0.9 }, { evidenceId: 'b', text: 'two', stance: 'supports', probability: 0.9 },
      { evidenceId: 'c', text: 'three', stance: 'unrelated', probability: 0.9 },
    ], [{ site: 'localnews.example', trusted: false }, { site: 'localnews.example', trusted: false }, { site: 'parking.example', trusted: false }], 'claim');
    expect(supportingSites(tally)).toEqual(['localnews.example']);
  });

  it('adds only new pages from other sites, one per site, keeping the supporting passage first', () => {
    const judged = [record('unrelated', 'parking.example', 'unrelated', 0.9), record('one', 'localnews.example', 'supports', 0.9)];
    const incoming = [
      record('one', 'localnews.example'), record('again', 'localnews.example'), record('two', 'othertown.example'),
      record('two-b', 'othertown.example'), record('three', 'third.example'), record('four', 'fourth.example'), record('five', 'fifth.example'),
    ];
    const merged = mergeCorroboration(judged, incoming, ['localnews.example'], site);
    expect(merged.map(item => item.id)).toEqual(['one', 'two', 'three', 'four', 'unrelated']);
    expect(merged.filter(item => !judged.includes(item))).toHaveLength(CORROBORATION_RESULTS);
  });

  it('returns nothing when the search brought nothing new, so no second judgment is spent', () => {
    const judged = [record('one', 'localnews.example', 'supports', 0.9)];
    expect(mergeCorroboration(judged, [record('one', 'localnews.example'), { ...record('copy', 'localnews.example'), url: 'https://localnews.example/one' }], ['localnews.example'], site)).toEqual([]);
    expect(mergeCorroboration(judged, [], [], site)).toEqual([]);
  });

  it('stays within six passages', () => {
    const judged = Array.from({ length: 6 }, (_, index) => record(`old-${index}`, `old-${index}.example`, index === 0 ? 'supports' : 'unrelated', 0.9));
    const merged = mergeCorroboration(judged, [record('new', 'new.example')], [], site);
    expect(merged).toHaveLength(6);
    expect(merged.slice(0, 2).map(item => item.id)).toEqual(['old-0', 'new']);
  });
});
