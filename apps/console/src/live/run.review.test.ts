import { describe, expect, it, vi } from 'vitest';
import { DEVELOPMENT_CASES, runLiveCampaign } from './run.js';

describe('independent authenticated campaign review', () => {
  it.each(['join', 'check'] as const)('refuses provider dispatch if the unauthorized %s probe is accepted', async probe => {
    const realFetch = globalThis.fetch;
    const providerFetch = vi.fn<typeof fetch>();
    const localHTTP = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const endpoint = String(url);
      if (probe === 'join' && endpoint.endsWith('/v1/sessions') && String(init?.body).includes('deliberately-invalid-join-code')) {
        return Response.json({}, { status: 201 });
      }
      if (probe === 'check' && endpoint.endsWith('/checks') && !new Headers(init?.headers).has('authorization')) {
        return Response.json({}, { status: 202 });
      }
      return realFetch(url, init);
    });
    try {
      const report = await runLiveCampaign({ keys: { jev: 'synthetic-key', exa: 'synthetic-key' }, cases: [DEVELOPMENT_CASES[0]], providerFetch });
      expect(report.completed).toBe(false);
      expect(report.transportFailure).toBe('authentication_boundary_failed');
      expect(report.counts.observed).toBe(0);
      expect(providerFetch).not.toHaveBeenCalled();
    } finally { localHTTP.mockRestore(); }
  });
});
