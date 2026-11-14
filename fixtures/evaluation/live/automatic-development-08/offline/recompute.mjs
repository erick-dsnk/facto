import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const { summarizeCampaign } = await import(pathToFileURL(resolve(root, 'offline/metrics.snapshot.ts')).href);
const [manifest, run, reviews] = await Promise.all([read('preparation/live-manifest.json'), read('runs/report.json'), read('review/reviews.json')]);
const reports = run.reports.flatMap(report => report.cases);
const metrics = summarizeCampaign(manifest.cases, reports, reviews);
if (reports.length !== 6 || metrics.factual.expected !== 5 || metrics.factual.sourceVerifiedCorrect !== 4) throw new Error('Saved campaign/review mismatch');
await writeFile(resolve(root, 'computed/metrics-scenario-occurrences.json'), JSON.stringify({
  warning: 'These are scenario occurrences, not independent factual samples. BD10 repeats three times; no new accuracy denominator is added. Generic presentationActions matching does not require the expected verdict, so it cannot replace the stricter five-pass/one-inconclusive action scoring.',
  ...metrics,
}, null, 2) + '\n');
process.stdout.write(JSON.stringify({ providerCalls: 0, scenarios: reports.length, sourceVerifiedOccurrences: metrics.factual.sourceVerifiedCorrect, newFactualAccuracyFacts: 0 }) + '\n');
