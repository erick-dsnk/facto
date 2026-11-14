import { appendFile, open, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Artifact wrapper around the already-tested authenticated harness. It never
// imports expected labels into a provider request and never changes the source.
const [sourceArg, manifestArg, outputArg, mode] = process.argv.slice(2);
if (!sourceArg || !manifestArg || !outputArg || !['plan', 'live'].includes(mode)) throw new Error('Usage: SOURCE MANIFEST FRESH_OUTPUT plan|live');
const source = resolve(sourceArg), manifestPath = resolve(manifestArg), output = resolve(outputArg);
const git = (args: string[]) => execFileSync('git', args, { cwd: source, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const commit = git(['rev-parse', 'HEAD']).trim();
if (git(['status', '--porcelain', '--untracked-files=normal']).trim()) throw new Error('Source freeze is dirty');
const paths = git(['ls-files', '-z', '--', 'apps/console', 'services/api', 'packages/contracts', 'package.json', 'package-lock.json']).split('\0').filter(Boolean).sort();
const hash = createHash('sha256');
for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(await readFile(resolve(source, path))); hash.update('\0'); }
const sourceSHA256 = hash.digest('hex');
const bytes = await readFile(manifestPath);
const manifestSHA256 = createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(bytes.toString());
if (manifest.kind !== 'open_development' || manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases) || !manifest.cases.length || manifest.cases.length > 4) throw new Error('Invalid four-case open-development batch');
const cases = manifest.cases.map((item: Record<string, unknown>) => {
  if (typeof item.label !== 'string' || typeof item.text !== 'string' || !Array.isArray(item.allowedPublic)
    || item.allowedPublic.some(value => typeof value !== 'string' || !item.text!.includes(value))) throw new Error('Invalid exact public spans');
  return { label: item.label, text: item.text, allowedPublic: item.allowedPublic, automatic: item.automatic === true, final: item.final !== false };
});
const { runLiveCampaign } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/run.ts')).href);
const { DEVELOPMENT_LIMITS } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/budget.ts')).href);
// The mixed control has a fourth eligible occurrence in its batch. Include it
// in all maxima instead of relying on a cache or silently excluding its cost.
const limits = { ...DEVELOPMENT_LIMITS, calls: { jev: 16, search: 8, contents: 12 }, inputTokens: 140_000, totalRequestBytes: 650_000, wallMs: 90_000 };
// Exact budget field names are checked below; no ineffective override is allowed.
for (const key of Object.keys(limits)) if (!(key in DEVELOPMENT_LIMITS)) throw new Error(`Unknown limit: ${key}`);
const plan = { kind: 'open_development_batch_plan', commit, sourceSHA256, manifestSHA256, limits, cases: cases.map(({ text: _text, ...item }: {text: string}) => item) };
if (mode === 'plan') { process.stdout.write(JSON.stringify(plan, null, 2) + '\n'); process.exit(0); }
if (!process.env.JEV_API_KEY || !process.env.EXA_API_KEY) throw new Error('Missing provider key');
const handle = await open(output, 'wx');
await handle.writeFile(JSON.stringify({ ...plan, status: 'reserved_not_dispatched' }, null, 2) + '\n'); await handle.sync(); await handle.close();
const journal = await open(output + '.journal.jsonl', 'wx'); await journal.close();
const completedCases: unknown[] = [];
async function checkpoint(value: unknown) {
  await writeFile(output + '.tmp', JSON.stringify(value, null, 2) + '\n');
  await rename(output + '.tmp', output);
}
const report = await runLiveCampaign({
  keys: { jev: process.env.JEV_API_KEY, exa: process.env.EXA_API_KEY }, cases, limits,
  metadata: { commit, dirty: false, sourceSHA256 },
  onProgress: async (progress: unknown) => {
    await appendFile(output + '.journal.jsonl', JSON.stringify(progress) + '\n');
    await checkpoint({ ...plan, status: 'running', completedCases, progress });
  },
  onCase: async (record: unknown) => { completedCases.push(record); await checkpoint({ ...plan, status: 'running', completedCases }); },
});
await checkpoint({ ...report, batchManifestSHA256: manifestSHA256, wrapperSHA256: createHash('sha256').update(await readFile(process.argv[1])).digest('hex') });
process.stdout.write(JSON.stringify({ output, completed: report.completed, counts: report.counts, totals: report.totals }) + '\n');
