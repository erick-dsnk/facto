import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

// OFFLINE ONLY. This imports the pure metric function and reads saved reports.
// It never imports run.ts, provider adapters, environment keys, or the live wrapper.
const directory = dirname(fileURLToPath(import.meta.url));
const base = resolve(directory, '..');
const readJson = async path => JSON.parse(await readFile(resolve(base, path), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const current = resolve(base, '../../../../apps/console/src/live/metrics.ts');
const snapshot = resolve(directory, 'metrics.snapshot.ts');
const currentHash = sha(await readFile(current));
const snapshotHash = sha(await readFile(snapshot));
const useSnapshot = process.argv.includes('--snapshot');
if (!useSnapshot) assert.equal(currentHash, snapshotHash, 'Current metrics changed; use --snapshot for archived recomputation');
const { summarizeCampaign } = await import(pathToFileURL(useSnapshot ? snapshot : current).href);
const manifest = await readJson('corpus/v2/live-manifest.json');
const rich = await readJson('corpus/v2/cases.json');
const reviews = await readJson('review/broader-baseline-citation-review.json');
const batches = await Promise.all([1, 2, 3, 4].map(i => readJson(`runs/broader-baseline-0${i}.json`)));
const reports = batches.flatMap(batch => batch.cases);
assert.equal(reports.length, 16);
assert.equal(new Set(reports.map(report => report.label)).size, 16);
const allOccurrences = summarizeCampaign(manifest.cases, reports, reviews);
const uniqueLabels = new Set(rich.cases.filter(sample => sample.caseType === 'factual').map(sample => sample.label));
const uniqueFacts = summarizeCampaign(manifest.cases.filter(sample => uniqueLabels.has(sample.label)), reports.filter(report => uniqueLabels.has(report.label)), reviews.filter(review => uniqueLabels.has(review.caseLabel)));
assert.deepEqual([allOccurrences.factual.expected, allOccurrences.factual.correctDefinitive, allOccurrences.factual.abstained, allOccurrences.factual.noResult, allOccurrences.factual.sourceVerifiedCorrect], [13, 4, 8, 1, 3]);
assert.deepEqual([uniqueFacts.factual.expected, uniqueFacts.factual.correctDefinitive, uniqueFacts.factual.abstained, uniqueFacts.factual.noResult, uniqueFacts.factual.sourceVerifiedCorrect], [12, 3, 8, 1, 2]);

const quantiles = values => {
  const ordered = [...values].sort((a, b) => a - b), n = ordered.length;
  return { n, min: n ? ordered[0] : null, median: n ? n % 2 ? ordered[(n - 1) / 2] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2 : null,
    p95NearestRank: n ? ordered[Math.ceil(0.95 * n) - 1] : null, max: n ? ordered[n - 1] : null };
};
const sum = (values, key) => values.reduce((total, value) => total + (value[key] ?? 0), 0);
const attempts = reports.flatMap(report => report.attempts);
const calls = Object.fromEntries(['jev', 'search', 'contents'].map(kind => [kind, attempts.filter(attempt => attempt.kind === kind && attempt.dispatched).length]));
const unknownCosts = attempts.filter(attempt => attempt.dispatched && attempt.costUSD === null);
const knownCosts = attempts.filter(attempt => attempt.dispatched && attempt.costUSD !== null);
const tokens = attempts.filter(attempt => attempt.kind === 'jev' && attempt.dispatched).reduce((total, attempt) => total + (attempt.inputTokens ?? 0), 0);
const usage = { dispatchedAttempts: attempts.filter(attempt => attempt.dispatched).length, calls, requestBytes: sum(attempts, 'requestBytes'),
  measuredJevInputTokens: tokens, chargedInputTokens: sum(batches.map(batch => batch.totals), 'chargedInputTokens'),
  unknownInputTokenReservationsAtEnd: sum(batches.map(batch => batch.totals), 'unknownInputTokenReservations'),
  knownCostUSD: knownCosts.reduce((total, attempt) => total + attempt.costUSD, 0), attemptsWithUnknownCost: unknownCosts.length,
  unknownCostByKind: Object.fromEntries(['jev', 'search', 'contents'].map(kind => [kind, unknownCosts.filter(attempt => attempt.kind === kind).length])),
  totalCostUSD: null, outputTokens: null, sumBatchElapsedMs: sum(batches.map(batch => batch.totals), 'elapsedMs'),
  costLimitation: 'Known cost is a partial returned amount; all Jev attempt costs and total cost are unknown. Output token counts are not retained. No price inferred.' };
assert.equal(attempts.length, 79);
assert.deepEqual(calls, { jev: 36, search: 20, contents: 23 });
assert.equal(tokens, 244053);
assert.equal(usage.requestBytes, 995358);
assert.equal(usage.attemptsWithUnknownCost, 36);
assert.ok(Math.abs(usage.knownCostUSD - 0.163) < 1e-12);
const batchReconciliation = [];
for (let index = 0; index < batches.length; index++) {
  const batch = batches[index], own = batch.cases.flatMap(report => report.attempts);
  assert.equal(own.length, batch.totals.attempts);
  assert.equal(sum(own, 'requestBytes'), batch.totals.requestBytes);
  assert.equal(own.filter(attempt => attempt.kind === 'jev').reduce((total, attempt) => total + (attempt.inputTokens ?? 0), 0), batch.totals.measuredInputTokens);
  assert.equal(batch.totals.chargedInputTokens, batch.totals.measuredInputTokens);
  assert.equal(batch.totals.unknownInputTokenReservations, 0);
  assert.ok(batch.totals.requestBytes <= batch.limits.totalRequestBytes);
  assert.ok(batch.totals.chargedInputTokens <= batch.limits.inputTokens);
  assert.ok(batch.totals.elapsedMs <= batch.limits.wallMs);
  assert.ok(own.every(attempt => attempt.dispatched && attempt.status === 200 && attempt.outcome === 'response' && attempt.requestBytes <= batch.limits.requestBytes));
  for (const kind of ['jev', 'search', 'contents']) {
    assert.equal(own.filter(attempt => attempt.kind === kind).length, batch.totals.calls[kind]);
    assert.ok(batch.totals.calls[kind] <= batch.limits.calls[kind]);
  }
  for (const report of batch.cases) {
    assert.equal(sum(report.attempts, 'requestBytes'), report.usage.requestBytes);
    assert.equal(report.attempts.filter(attempt => attempt.kind === 'jev').reduce((total, attempt) => total + (attempt.inputTokens ?? 0), 0), report.usage.measuredInputTokens);
    const sample = rich.cases.find(candidate => candidate.label === report.label);
    const searches = report.attempts.filter(attempt => attempt.kind === 'search');
    if (!sample.allowedPublic.length) assert.equal(searches.length, 0);
    for (const search of searches) {
      assert.ok(sample.allowedPublic.some(text => search.query.includes(text)));
      for (const privateSpan of sample.privateSpans) assert.ok(!search.query.includes(privateSpan.text));
    }
  }
  const journalName = `runs/broader-baseline-0${index + 1}.json.journal.jsonl`;
  const journal = (await readFile(resolve(base, journalName), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(journal.every(entry => entry.totals.chargedInputTokens <= batch.limits.inputTokens && entry.totals.requestBytes <= batch.limits.totalRequestBytes));
  const last = journal.at(-1);
  for (const key of ['attempts', 'requestBytes', 'measuredInputTokens', 'chargedInputTokens', 'attemptsWithUnknownCost']) assert.equal(last.totals[key], batch.totals[key]);
  assert.deepEqual(last.totals.calls, batch.totals.calls);
  const batchManifestBytes = await readFile(resolve(base, `corpus/v2/batches/batch-0${index + 1}.json`));
  assert.equal(sha(batchManifestBytes), batch.batchManifestSHA256);
  assert.equal(sha(await readFile(resolve(base, 'execution/run-open-development.mts'))), batch.wrapperSHA256);
  batchReconciliation.push({ batch: index + 1, reportCounts: batch.counts, totals: batch.totals, limits: batch.limits,
    journalRecords: journal.length, journalFirstPhase: journal[0].phase, reconcilesWithFinalJournalAndPerCaseAttempts: true,
    largestRequestBytes: Math.max(...own.map(attempt => attempt.requestBytes)), allRecordedLimitsRespected: true,
    peakJournalChargedInputTokens: Math.max(...journal.map(entry => entry.totals.chargedInputTokens)),
    batchManifestSHA256: batch.batchManifestSHA256, wrapperSHA256: batch.wrapperSHA256 });
}
const uniqueReports = reports.filter(report => uniqueLabels.has(report.label));
const eligibleLabels = new Set(manifest.cases.filter(sample => sample.expected.claims.length).map(sample => sample.label));
const factsWithResult = reports.filter(report => report.events.some(event => event.type === 'claim.result'));
const caseObservations = reports.map(report => ({ label: report.label, terminalReceived: report.terminalReceived, terminalType: report.terminalType,
  admission: report.admission, durationMs: report.durationMs, stageMs: report.stageMs, runtime: report.runtime, usage: report.usage,
  result: report.events.filter(event => event.type === 'claim.result').map(event => ({ checkedPublicText: event.checkedPublicText, verdict: event.verdict, cached: event.cached, selectedEvidenceIds: event.selectedEvidenceIds })),
  searchQueries: report.attempts.filter(attempt => attempt.kind === 'search').map(attempt => attempt.query), reportedMismatchCount: report.mismatch.length }));
const observations = { schemaVersion: 1, kind: 'offline_baseline_observations', createdAt: new Date().toISOString(), metricSourceSHA256: snapshotHash,
  totals: { declared: 16, observed: reports.length, terminals: reports.filter(report => report.terminalReceived).length,
    providerErrors: sum(batches.map(batch => batch.counts), 'providerErrors'), transportFailures: sum(batches.map(batch => batch.counts), 'transportFailures'),
    localStops: sum(batches.map(batch => batch.counts), 'localStops'), terminalTypes: Object.fromEntries([...new Set(reports.map(report => report.terminalType))].map(type => [type, reports.filter(report => report.terminalType === type).length])),
    definitiveOccurrences: factsWithResult.filter(report => report.events.some(event => event.verdict && event.verdict !== 'insufficient_evidence')).length,
    resultOccurrencesFlaggedCached: factsWithResult.filter(report => report.events.some(event => event.type === 'claim.result' && event.cached === true)).length },
  usage, latencyMs: { convention: 'Client-observed per-input durationMs; median uses average of middle pair; P95 uses nearest rank ceil(0.95*n), without interpolation.',
    allInputTerminals: quantiles(reports.map(report => report.durationMs)), uniqueExpectedFactsIncludingAdmissionMiss: quantiles(uniqueReports.map(report => report.durationMs)),
    allEligibleOccurrencesIncludingAdmissionMiss: quantiles(reports.filter(report => eligibleLabels.has(report.label)).map(report => report.durationMs)),
    claimResultOccurrences: quantiles(factsWithResult.map(report => report.durationMs)),
    measurementLimits: 'Typed authenticated HTTP/WebSocket inputs; no glasses/OCR/ASR/audio latency. cached:false means no reported application result-cache hit, not proof of uncached provider retrieval. Mixed repeat is not an independent factual or latency sample.' },
  batchReconciliation, caseObservations,
  limitations: ['The observed 100% terminal receipt rate is not an accuracy metric.', 'Known costs are partial; total cost and output tokens are unknown.',
    'Source-verified coverage requires every selected reference to be verified; BD09 fails this all-selected condition because its UNTC conclusion metadata does not explicitly establish adoption.',
    'Twelve unique facts are BD01–BD12; BDC04 repeats BD07 and adds no unique factual credit.'] };
await mkdir(resolve(base, 'computed'), { recursive: true });
for (const [name, value] of [['metrics-occurrences.json', allOccurrences], ['metrics-unique-facts.json', uniqueFacts], ['observations.json', observations]]) {
  await writeFile(resolve(base, 'computed', name), `${JSON.stringify(value, null, 2)}\n`);
}
if (!useSnapshot) assert.equal(sha(await readFile(current)), snapshotHash, 'Metrics changed during calculation');
console.log(JSON.stringify({ offlineOnly: true, currentMetricsMatchedSnapshot: currentHash === snapshotHash,
  occurrences: allOccurrences.factual, uniqueFacts: uniqueFacts.factual, admissionOccurrences: allOccurrences.admission, admissionUniqueFacts: uniqueFacts.admission,
  totals: observations.totals, usage, latencyMs: observations.latencyMs }, null, 2));
