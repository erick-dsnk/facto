import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
// Offline only: pure metrics snapshot plus saved public reports/review rows.
// No provider adapters, wrapper, keys, network, or runtime entrypoint imported.
const base=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read=async path=>JSON.parse(await readFile(resolve(base,path),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reference=await read('references.json');
for(const entry of reference.files)assert.equal(sha(await readFile(resolve(base,entry.path))),entry.sha256);
const modulePath=resolve(base,'execution/reference-code/metrics.snapshot.ts');
assert.equal(sha(await readFile(modulePath)),reference.metricsModuleSHA256);
const {summarizeCampaign}=await import(pathToFileURL(modulePath).href);
const manifest=await read('../broader-development-01/corpus/v2/live-manifest.json');
const batches=await Promise.all([1,2,3,4].map(n=>read(`execution/runs/batch-0${n}/report.json`)));
const reports=batches.flatMap(batch=>batch.cases);
assert.equal(reports.length,16);assert.equal(new Set(reports.map(report=>report.label)).size,16);
const reviews=await read('citations/review-v2.json');
const unique=x=>/^BD\d\d$/.test(x.label??x.caseLabel??'');
const all=summarizeCampaign(manifest.cases,reports,reviews);
const facts=summarizeCampaign(manifest.cases.filter(unique),reports.filter(unique),reviews.filter(unique));
const mixed=summarizeCampaign(manifest.cases.filter(x=>x.label==='BDC04'),reports.filter(x=>x.label==='BDC04'),reviews.filter(x=>x.caseLabel==='BDC04'));
const archived=await read('citations/offline-metrics-v2.json');
assert.deepEqual(all,archived.occurrences);assert.deepEqual(facts,archived.uniqueFacts);assert.deepEqual(mixed,archived.mixedRepeat);
assert.deepEqual([facts.factual.expected,facts.factual.correctDefinitive,facts.factual.sourceVerifiedCorrect,facts.factual.abstained],[12,4,3,8]);
assert.deepEqual([all.factual.expected,all.factual.correctDefinitive,all.factual.sourceVerifiedCorrect,all.factual.abstained],[13,4,3,9]);
const attempts=reports.flatMap(report=>report.attempts);
const calls=Object.fromEntries(['jev','search','contents'].map(kind=>[kind,attempts.filter(a=>a.dispatched&&a.kind===kind).length]));
assert.deepEqual(calls,{jev:41,search:25,contents:36});assert.equal(attempts.length,102);
assert.equal(attempts.reduce((sum,a)=>sum+a.requestBytes,0),1381736);
assert.equal(attempts.reduce((sum,a)=>sum+(a.inputTokens??0),0),329197);
assert.equal(attempts.filter(a=>a.costUSD===null).length,41);
for(const batch of batches){
 assert.equal(batch.completed,true);assert.equal(batch.metadata.commit,'9a5e80d88bd1d93e4a1c194d23bc1a59662af135');
 assert.equal(batch.metadata.sourceSHA256,'9de0531baa85af7bac2d1940b28c91136dce6c455bcafe24e3cf7b1d8739f9ad');
 for(const kind of ['jev','search','contents'])assert.ok(batch.totals.calls[kind]<=batch.limits.calls[kind]);
 assert.ok(batch.totals.chargedInputTokens<=batch.limits.inputTokens);assert.ok(batch.totals.requestBytes<=batch.limits.totalRequestBytes);assert.ok(batch.totals.elapsedMs<=batch.limits.wallMs);
 assert.equal(batch.totals.unknownInputTokenReservations,0);assert.equal(batch.totals.pendingDispatchReservations,0);
 for(const report of batch.cases){assert.ok(report.terminalReceived);assert.deepEqual(report.mismatch,[]);assert.deepEqual(report.localStops,[]);assert.ok(report.deterministicPublicIssues.every(row=>Object.hasOwn(row,'issue')&&row.issue===null));}
}
const result={kind:'reproduced_offline_candidate09_metrics',providerCalls:0,allOccurrences:all,uniqueFacts:facts,mixedRepeat:mixed};
if(process.argv[2]){await mkdir(process.argv[2],{recursive:true});await writeFile(resolve(process.argv[2],'metrics.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({providerCalls:0,strictRowsAccepted:reviews.length,occurrences:all.factual,uniqueFacts:facts.factual,mixedRepeat:mixed.factual},null,2));
