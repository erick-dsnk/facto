import { describe, expect, it } from 'vitest';
import { claimFrame, type AcceptedClaim } from '../../../../packages/contracts/src/index.js';
import { ClaimCache, type CachedDecision } from './claim-cache.js';

const decision = (overrides: Partial<CachedDecision> = {}): CachedDecision => ({
  verdict: 'supported', reasonCode: 'qualifying_evidence', selectedEvidenceIds: ['e1'], summary: 'Supported by the sources I found.',
  checkedText: 'Helsinki is the capital of Finland.', evidence: [], route: 'named_fact', subject: null, checkedAt: '2026-11-14T12:00:00.000Z', ...overrides,
});
const frame = (overrides: Partial<AcceptedClaim> = {}) => claimFrame({ id: 'c', originalText: 'x', checkedText: 'x', sourceSpan: { start: 0, end: 1 },
  admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' }, ...overrides });

describe('shared claim cache (Q9)', () => {
  it('keys on the normalised claim and subject plus policy and model versions', () => {
    const key = ClaimCache.key('Helsinki is  the capital\nof Finland.', 'Finland', 'p1', 'm1');
    expect(ClaimCache.key('helsinki IS the capital of finland.', ' finland ', 'p1', 'm1')).toBe(key);
    expect(ClaimCache.key('Helsinki is the capital of Finland.', null, 'p1', 'm1')).not.toBe(key);
    expect(ClaimCache.key('Helsinki is the capital of Finland.', 'Sweden', 'p1', 'm1')).not.toBe(key);
    expect(ClaimCache.key('Helsinki is the capital of Finland.', 'Finland', 'p2', 'm1')).not.toBe(key);
    expect(ClaimCache.key('Helsinki is the capital of Finland.', 'Finland', 'p1', 'm2')).not.toBe(key);
    expect(ClaimCache.key('Turku is the capital of Finland.', 'Finland', 'p1', 'm1')).not.toBe(key);
  });

  it('never keeps weather, attributed recent events, private-life or missing-subject claims', () => {
    expect(ClaimCache.cacheable(frame())).toBe(true);
    expect(ClaimCache.cacheable(frame({ route: 'weather' }))).toBe(false);
    expect(ClaimCache.cacheable(frame({ route: 'recent_event', attribution: { source: 'Kushner', mode: 'said' } }))).toBe(false);
    expect(ClaimCache.cacheable(frame({ route: 'recent_event' }))).toBe(true);
    expect(ClaimCache.cacheable(frame({ route: 'general', attribution: { source: 'NASA', mode: 'reported' } }))).toBe(true);
    expect(ClaimCache.cacheable(frame({ privateLife: true }))).toBe(false);
    expect(ClaimCache.cacheable(frame({ subjectMissing: true }))).toBe(false);
  });

  it('expires entries after 24 hours', () => {
    let now = 0;
    const cache = new ClaimCache(undefined, undefined, () => now);
    cache.set('k', decision());
    now = 86_400_000 - 1; expect(cache.get('k')?.verdict).toBe('supported');
    now = 86_400_000; expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('drops the oldest entry past its bound', () => {
    const cache = new ClaimCache(1_000, 2, () => 0);
    cache.set('a', decision()); cache.set('b', decision()); cache.set('c', decision());
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(cache.size).toBe(2);
  });

  it('stores claim-level fields only, never the captured text, and hands out copies', () => {
    const cache = new ClaimCache();
    const value = { ...decision({ basis: 'estimates', verdict: 'contradicted' }), originalText: 'My private words. Helsinki is the capital of Finland.', context: ['private'] } as CachedDecision;
    cache.set('k', value);
    const stored = cache.get('k')!;
    expect(stored).not.toHaveProperty('originalText');
    expect(stored).not.toHaveProperty('context');
    expect(JSON.stringify(stored)).not.toContain('private');
    expect(stored.basis).toBe('estimates');
    stored.selectedEvidenceIds.push('mutated');
    expect(cache.get('k')!.selectedEvidenceIds).toEqual(['e1']);
  });
});
