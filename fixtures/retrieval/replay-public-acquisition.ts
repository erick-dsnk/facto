/** Offline parity check against the authorized public diagnostic's raw bytes. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AcceptedClaim, Evidence, ProviderKind } from '../../packages/contracts/src/index.js';
import { mergeRetainedEvidence } from '../../services/api/src/evidence/normalize.js';
import { createRetriever } from '../../services/api/src/providers/exa/retrieval.js';

const directory = resolve(process.argv[2]);
const summary = JSON.parse(await readFile(`${directory}/summary.json`, 'utf8'));
const plan = JSON.parse(await readFile(`${directory}/plan.json`, 'utf8'));
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const canonical = (evidence: Evidence[]) => JSON.stringify(evidence.map(({ retrievedAt: _time, ...record }) => record));
const results = [];
for (const sample of summary.outcomes) {
  const pending = summary.attempts.filter((attempt: { label: string }) => attempt.label === sample.label);
  let next = 0;
  const counts = { search: 0, contents: 0 };
  const fetcher: typeof fetch = async (_url, init) => {
    const attempt = pending[next++];
    if (!attempt || hash(String(init?.body)) !== attempt.requestSHA256) throw new Error('offline_request_mismatch');
    const parent = attempt.ordinal === 1 && plan.resumePath ? resolve(directory, '../public-acquisition-01') : directory;
    const bytes = await readFile(`${parent}/${attempt.responseFile}`);
    if (hash(bytes) !== attempt.responseSHA256) throw new Error('offline_response_mismatch');
    return new Response(bytes, { status: attempt.httpStatus, headers: { 'content-type': 'application/json' } });
  };
  const context = { signal: new AbortController().signal, now: () => Date.parse('2026-11-14T00:00:00Z'),
    canConsume: (kind: 'contents') => counts[kind] < 3,
    consume: (kind: ProviderKind) => { if (kind === 'jev' || counts[kind] >= (kind === 'search' ? 2 : 3)) throw new Error('offline_budget'); counts[kind]++; } };
  const claim: AcceptedClaim = { id: sample.label, checkedText: sample.checkedText, originalText: sample.checkedText,
    sourceSpan: { start: 0, end: Array.from(sample.checkedText).length },
    admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'public_fact' } };
  const initial = await createRetriever({ apiKey: 'offline-only', fetch: fetcher })(claim, context);
  const alternate = await createRetriever({ apiKey: 'offline-only', fetch: fetcher, queryStrategy: 'balanced_evidence' })(claim, context);
  const retained = mergeRetainedEvidence(initial, alternate, sample.checkedText);
  const matches = next === pending.length && canonical(initial) === canonical(sample.initial)
    && canonical(alternate) === canonical(sample.alternate) && canonical(retained) === canonical(sample.retained);
  results.push({ label: sample.label, matches, replayedResponses: next });
}
const sourceHashes = Object.fromEntries(await Promise.all(Object.keys(plan.sourceHashes).map(async path => [path, hash(await readFile(path))])));
await writeFile(`${directory}/${process.argv[3] ?? 'offline-replay.json'}`, JSON.stringify({ networkCalls: 0, results, sourceHashes }, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ networkCalls: 0, results }));
if (results.some(result => !result.matches)) process.exitCode = 1;
