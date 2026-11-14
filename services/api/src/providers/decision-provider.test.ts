import { describe, expect, it, vi } from 'vitest';
import { ClaimCache } from '../runtime/claim-cache.js';
import { selectDecisionProvider } from './decision-provider.js';

describe('decision provider selection', () => {
  it('defaults to Jev and preserves the existing missing-key failure at live startup', () => {
    expect(selectDecisionProvider({ mode: 'fixture' }).provider).toBe('jev');
    expect(() => selectDecisionProvider({ mode: 'live' })).toThrow('Live Jev mode requires JEV_API_KEY.');
  });

  it('requires a local URL for live Laya and gives each Laya runtime an isolated cache', () => {
    expect(() => selectDecisionProvider({ mode: 'live', provider: 'laya' })).toThrow('Live Laya mode requires LAYA_URL.');
    const fetcher = vi.fn<typeof fetch>();
    const first = selectDecisionProvider({ mode: 'live', provider: 'laya', layaUrl: 'http://127.0.0.1:8765', fetch: fetcher });
    const second = selectDecisionProvider({ mode: 'live', provider: 'laya', layaUrl: 'http://127.0.0.1:8765', fetch: fetcher });
    expect(first.cache).toBeInstanceOf(ClaimCache);
    expect(first.cache).not.toBe(second.cache);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsupported provider names rather than silently choosing a backend', () => {
    expect(() => selectDecisionProvider({ mode: 'fixture', provider: 'unknown' })).toThrow('DECISION_PROVIDER must be jev or laya.');
  });
});
