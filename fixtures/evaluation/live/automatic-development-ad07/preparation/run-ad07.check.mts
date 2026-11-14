import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AD07_LIMITS, scoreAD07 } from './run-ad07.mts';
const text = 'The Panama Canal opened to world trade in 1914.';
const report = () => ({ completed: true, cases: [{ status: 'observed', httpStatus: 202, terminalReceived: true, admittedPublic: [text], admission: { action: 'check' },
  events: [{ type: 'claim.result', verdict: 'supported', cached: false, checkedPublicText: text, presentation: { action: 'silent', reasonCode: 'automatic_noncontradiction' } }] }] });
test('requires actual cold supported silence and leaves citation verification pending', () => {
  assert.deepEqual(scoreAD07(report()), { outcome: 'passed', reason: 'actual_cold_supported_automatic_silence', factualSourceVerification: 'pending_independent_review' });
  assert.deepEqual(AD07_LIMITS, { requestBytes: 65536, totalRequestBytes: 300000, inputTokens: 80000, unknownInputTokensPerAttempt: 24000, calls: { jev: 6, search: 2, contents: 3 }, wallMs: 30000 });
});
test('silent abstention remains inconclusive, preserving the intended branch denominator', () => {
  const value = report(); value.cases[0].events[0].verdict = 'insufficient_evidence';
  assert.equal(scoreAD07(value).outcome, 'inconclusive');
  value.cases[0].events[0].presentation.action = 'notify';
  assert.equal(scoreAD07(value).outcome, 'failed');
});
test('rejects missing receipts, cached output, wrong verdict, wrong reason and extra claims', () => {
  const values = [report(), report(), report(), report(), report()];
  values[0].cases[0].terminalReceived = false; values[1].cases[0].events[0].cached = true; values[2].cases[0].events[0].verdict = 'contradicted';
  values[3].cases[0].events[0].presentation.reasonCode = 'notifications_disabled'; values[4].cases[0].events.push(values[4].cases[0].events[0]);
  for (const value of values) assert.equal(scoreAD07(value).outcome, 'failed');
});
