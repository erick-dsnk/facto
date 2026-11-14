import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { open, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const COHORT_LIMITS = Object.freeze({ requestBytes: 65_536, totalRequestBytes: 1_000_000, inputTokens: 180_000,
  unknownInputTokensPerAttempt: 24_000, calls: { jev: 24, search: 12, contents: 18 }, wallMs: 90_000 });
export const EXPECTED_MANIFEST_SHA256 = '2c223938aa63f555bc4ae9e0c09fbd43381071ace2a13778cdbedea9cd2ca8d0';
type Limits = { requestBytes: number; totalRequestBytes: number; inputTokens: number; unknownInputTokensPerAttempt: number;
  calls: { jev: number; search: number; contents: number }; wallMs: number };
type Sample = { label: string; automatic?: boolean; [key: string]: unknown };
type Totals = { calls: Record<string, number>; requestBytes: number; measuredInputTokens: number; unknownInputTokenReservations: number;
  chargedInputTokens: number; knownCostUSD: number | null; attemptsWithUnknownCost: number; attempts: number; [key: string]: unknown };
type Report = { completed: boolean; totals: Totals; counts: { localStops: number; transportFailures: number; [key: string]: unknown }; [key: string]: unknown };
const kinds = ['jev', 'search', 'contents'] as const;
const sum = (reports: Report[], key: 'requestBytes' | 'chargedInputTokens') => reports.reduce((total, report) => total + report.totals[key], 0);

export function remainingLimits(reports: Report[], elapsedMs: number): Limits | null {
  const limits: Limits = { ...COHORT_LIMITS, calls: Object.fromEntries(kinds.map(kind => [kind,
    COHORT_LIMITS.calls[kind] - reports.reduce((total, report) => total + report.totals.calls[kind], 0)])) as Limits['calls'],
  inputTokens: COHORT_LIMITS.inputTokens - sum(reports, 'chargedInputTokens'),
  totalRequestBytes: COHORT_LIMITS.totalRequestBytes - sum(reports, 'requestBytes'), wallMs: Math.floor(COHORT_LIMITS.wallMs - elapsedMs) };
  // A budget exhausted in any dimension ends the cohort. Never reset or round
  // exhausted capacity up to make a later invocation's constructor accept it.
  return [...Object.values(limits.calls), limits.inputTokens, limits.totalRequestBytes, limits.wallMs].every(value => Number.isSafeInteger(value) && value > 0)
    && limits.inputTokens >= limits.unknownInputTokensPerAttempt ? limits : null;
}

function validateTotals(totals: Totals) {
  const values = [totals.requestBytes, totals.measuredInputTokens, totals.unknownInputTokenReservations, totals.chargedInputTokens,
    totals.attempts, totals.attemptsWithUnknownCost, ...kinds.map(kind => totals.calls[kind])];
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)
    || totals.chargedInputTokens !== totals.measuredInputTokens + totals.unknownInputTokenReservations
    || totals.attempts !== kinds.reduce((total, kind) => total + totals.calls[kind], 0)) throw new Error('Invalid saved accounting');
}

export async function runCohort(options: {
  cases: Sample[];
  runOne: (sample: Sample, limits: Limits, progress: (value: unknown) => Promise<void>) => Promise<Report>;
  onProgress?: (value: unknown) => Promise<void>;
  onCase?: (value: unknown) => Promise<void>;
  now?: () => number; sleep?: (milliseconds: number) => Promise<void>;
}) {
  if (options.cases.length !== 6 || new Set(options.cases.map(sample => sample.label)).size !== 6) throw new Error('Expected six distinct scenarios');
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const started = now(); const reports: Report[] = []; const scheduling: { label: string; delayMs: number }[] = [];
  let lastAutomaticFinished = -Infinity; let stopReason: string | null = null;
  for (const sample of options.cases) {
    const waitStarted = now();
    const delay = sample.automatic ? Math.max(0, 4_100 - (waitStarted - lastAutomaticFinished)) : 0;
    // Spacing from the preceding automatic completion is conservative: its
    // dispatch necessarily occurred earlier. The cohort wall includes this wait.
    if (delay) await sleep(Math.min(delay, Math.max(0, COHORT_LIMITS.wallMs - (now() - started))));
    scheduling.push({ label: sample.label, delayMs: Math.round(now() - waitStarted) });
    const limits = remainingLimits(reports, now() - started);
    if (!limits) { stopReason = 'cumulative_limit'; break; }
    const report = await options.runOne(sample, limits, async active => options.onProgress?.({ label: sample.label, completedReports: reports, active, elapsedMs: Math.round(now() - started), scheduling }));
    validateTotals(report.totals);
    reports.push(report);
    if (sample.automatic) lastAutomaticFinished = now();
    await options.onCase?.({ label: sample.label, completedReports: reports, elapsedMs: Math.round(now() - started), scheduling });
    if (report.counts.localStops || report.counts.transportFailures || !report.completed) { stopReason = 'case_incomplete_or_local_stop'; break; }
    if (report.totals.unknownInputTokenReservations > 0) { stopReason = 'unknown_completed_jev_usage'; break; }
    if (report.totals.chargedInputTokens > limits.inputTokens || report.totals.requestBytes > limits.totalRequestBytes
      || kinds.some(kind => report.totals.calls[kind] > limits.calls[kind])) { stopReason = 'actual_cumulative_overrun'; break; }
    if (now() - started > COHORT_LIMITS.wallMs) { stopReason = 'wall_limit'; break; }
  }
  const measuredInputTokens = reports.reduce((total, report) => total + report.totals.measuredInputTokens, 0);
  const unknownInputTokenReservations = reports.reduce((total, report) => total + report.totals.unknownInputTokenReservations, 0);
  return { completed: reports.length === 6 && !stopReason, stopReason, limits: COHORT_LIMITS, scheduling, reports,
    totals: { attempts: reports.reduce((total, report) => total + report.totals.attempts, 0),
      calls: Object.fromEntries(kinds.map(kind => [kind, reports.reduce((total, report) => total + report.totals.calls[kind], 0)])),
      requestBytes: sum(reports, 'requestBytes'), measuredInputTokens, unknownInputTokenReservations,
      chargedInputTokens: measuredInputTokens + unknownInputTokenReservations,
      knownCostUSD: reports.some(report => report.totals.knownCostUSD !== null) ? reports.reduce((total, report) => total + (report.totals.knownCostUSD ?? 0), 0) : null,
      attemptsWithUnknownCost: reports.reduce((total, report) => total + report.totals.attemptsWithUnknownCost, 0), elapsedMs: Math.round(now() - started) } };
}

async function main() {
  const [sourceArg, expectedCommit, expectedSourceSHA256, manifestArg, outputArg, mode] = process.argv.slice(2);
  if (!sourceArg || !/^[a-f0-9]{40}$/.test(expectedCommit ?? '') || !/^[a-f0-9]{64}$/.test(expectedSourceSHA256 ?? '')
    || !manifestArg || !outputArg || !['plan', 'live'].includes(mode)) throw new Error('Usage: SOURCE COMMIT SOURCE_SHA256 MANIFEST FRESH_OUTPUT plan|live');
  const source = resolve(sourceArg), output = resolve(outputArg);
  const git = (args: string[]) => execFileSync('git', args, { cwd: source, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const commit = git(['rev-parse', 'HEAD']).trim();
  if (commit !== expectedCommit || git(['status', '--porcelain', '--untracked-files=normal']).trim()) throw new Error('Source freeze mismatch or dirty checkout');
  const paths = git(['ls-files', '-z', '--', 'apps/console', 'services/api', 'packages/contracts', 'package.json', 'package-lock.json']).split('\0').filter(Boolean).sort();
  const sourceHash = createHash('sha256');
  for (const path of paths) { sourceHash.update(path); sourceHash.update('\0'); sourceHash.update(await readFile(resolve(source, path))); sourceHash.update('\0'); }
  const sourceSHA256 = sourceHash.digest('hex');
  if (sourceSHA256 !== expectedSourceSHA256) throw new Error('Source SHA256 mismatch');
  const { loadDevelopmentManifest, publicCasePlan } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/cases.ts')).href);
  const { manifest, sha256: manifestSHA256 } = await loadDevelopmentManifest(resolve(manifestArg));
  if (manifestSHA256 !== EXPECTED_MANIFEST_SHA256) throw new Error('Predeclared manifest changed');
  const { runLiveCampaign } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/run.ts')).href);
  const wrapperSHA256 = createHash('sha256').update(await readFile(process.argv[1])).digest('hex');
  const plan = { kind: 'isolated_automatic_presentation_development', commit, sourceSHA256, manifestSHA256, wrapperSHA256,
    limits: COHORT_LIMITS, minimumAutomaticSpacingMs: 4100, freshSessionPerScenario: true, cases: manifest.cases.map(publicCasePlan) };
  if (mode === 'plan') { process.stdout.write(JSON.stringify(plan, null, 2) + '\n'); return; }
  if (!process.env.JEV_API_KEY || !process.env.EXA_API_KEY) throw new Error('Missing provider key');
  const reserved = await open(output, 'wx', 0o600);
  await reserved.writeFile(JSON.stringify({ ...plan, completed: false, phase: 'reserved_before_dispatch' }) + '\n'); await reserved.sync(); await reserved.close();
  const journalPath = output + '.journal.jsonl'; const journal = await open(journalPath, 'wx', 0o600); await journal.close();
  const persist = async (value: unknown) => {
    const temporary = output + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const handle = await open(temporary, 'r'); await handle.sync(); await handle.close(); await rename(temporary, output);
  };
  const checkpoint = async (phase: string, value: unknown) => {
    const handle = await open(journalPath, 'a'); await handle.writeFile(JSON.stringify({ phase, value }) + '\n'); await handle.sync(); await handle.close();
    await persist({ ...plan, completed: false, phase, progress: value });
  };
  const result = await runCohort({ cases: manifest.cases,
    runOne: (sample, limits, onProgress) => runLiveCampaign({ cases: [sample], limits, keys: { jev: process.env.JEV_API_KEY!, exa: process.env.EXA_API_KEY! },
      metadata: { commit, dirty: false, sourceSHA256, casesSHA256: manifestSHA256, campaignName: manifest.name }, onProgress }),
    onProgress: value => checkpoint('attempt_checkpoint', value), onCase: value => checkpoint('case_checkpoint', value) });
  await persist({ ...plan, ...result });
  process.stdout.write(JSON.stringify({ output, completed: result.completed, stopReason: result.stopReason, totals: result.totals }) + '\n');
  if (!result.completed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
