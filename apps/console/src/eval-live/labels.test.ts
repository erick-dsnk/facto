import { describe, expect, it } from 'vitest';
import { expectedLabel, labelTerminal, safeReasonCode } from './labels.js';

const result = (verdict: string, reasonCode = 'code') => labelTerminal({ type: 'claim.result', payload: { verdict, reasonCode } });

describe('live eval labels', () => {
  it('maps every result verdict', () => {
    expect(result('supported')).toEqual({ label: 'true', reasonCode: 'code' });
    expect(result('contradicted').label).toBe('false');
    expect(result('misleading').label).toBe('misleading');
    expect(result('insufficient_evidence').label).toBe('cant_verify');
    expect(result('speculation', 'unconfirmed_rumour')).toEqual({ label: 'speculation', reasonCode: 'unconfirmed_rumour' });
    expect(result('something_new')).toEqual({ label: 'error', reasonCode: 'unknown_verdict' });
  });

  it('maps skips: a kind or a not-a-claim code is not_a_claim, anything else is a skip', () => {
    const skipped = (payload: unknown) => labelTerminal({ type: 'claim.skipped', payload }).label;
    expect(skipped({ reasonCode: 'not_a_claim', kind: 'opinion' })).toBe('not_a_claim');
    expect(skipped({ reasonCode: 'anything', kind: 'question' })).toBe('not_a_claim');
    expect(skipped({ reasonCode: 'private_or_personal', kind: 'other' })).toBe('not_a_claim');
    expect(skipped({ reasonCode: 'not_eligible_public_fact' })).toBe('not_a_claim');
    expect(skipped({ reasonCode: 'subject_missing' })).toBe('skip');
    expect(skipped({ reasonCode: 'possibly_misheard' })).toBe('skip');
    expect(skipped({ reasonCode: 'wait_expired' })).toBe('skip');
  });

  it('maps confirmations, errors, cancellations and timeouts', () => {
    expect(labelTerminal({ type: 'claim.needs_confirmation', payload: { reasonCode: 'possibly_misheard' } })).toEqual({ label: 'needs_confirmation', reasonCode: 'possibly_misheard' });
    expect(labelTerminal({ type: 'pipeline.error', payload: { reasonCode: 'provider_timeout' } })).toEqual({ label: 'error', reasonCode: 'provider_timeout' });
    expect(labelTerminal({ type: 'check.cancelled', payload: {} })).toEqual({ label: 'error', reasonCode: null });
    expect(labelTerminal({ type: 'timeout', reasonCode: 'timeout' })).toEqual({ label: 'error', reasonCode: 'timeout' });
    expect(labelTerminal({ type: 'claim.result', payload: null }).label).toBe('error');
  });

  it('keeps only plain reason codes, never prose', () => {
    expect(safeReasonCode('eligible_public_claim')).toBe('eligible_public_claim');
    expect(safeReasonCode('The claim about Paris was wrong')).toBe('other');
    expect(safeReasonCode(undefined)).toBeNull();
    expect(result('supported', 'Some text from a page').reasonCode).toBe('other');
  });

  it('maps dataset labels, AVeriTeC included', () => {
    expect(['Supported', 'Refuted', 'Conflicting', 'Conflicting Evidence/Cherrypicking', 'Not Enough Evidence'].map(expectedLabel))
      .toEqual(['true', 'false', 'misleading', 'misleading', 'cant_verify']);
    expect(['true', 'false', 'misleading', 'unverifiable', 'not_a_claim', 'speculation', 'needs_confirmation'].map(expectedLabel))
      .toEqual(['true', 'false', 'misleading', 'cant_verify', 'not_a_claim', 'speculation', 'needs_confirmation']);
    expect(() => expectedLabel('maybe')).toThrow('Unknown expected label');
  });
});
