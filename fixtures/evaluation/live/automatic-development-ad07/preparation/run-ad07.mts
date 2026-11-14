import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { open, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_COMMIT = 'aefb9e7c5f0f3d0e332eea5d8748878b3f6cf75c';
const EXPECTED_SOURCE_SHA256 = '09c18944f1eba27dd09293a31511824014cbea0f92057c7c7e5b6445fcb70d42';
const EXPECTED_MANIFEST_SHA256 = 'cb3e436d23bc45afa11f8df188dc962a518432c4195aa3c2e6d4efba1c27fa68';
export const AD07_LIMITS = { requestBytes: 65_536, totalRequestBytes: 300_000, inputTokens: 80_000,
  unknownInputTokensPerAttempt: 24_000, calls: { jev: 6, search: 2, contents: 3 }, wallMs: 30_000 };

export function scoreAD07(report: { completed: boolean; cases: { status: string; httpStatus: number | null; terminalReceived: boolean;
  admittedPublic: string[]; admission?: { action: string }; events: { type: string; verdict?: string; cached?: boolean; checkedPublicText?: string;
    presentation?: { action: string; reasonCode: string } }[] }[] }) {
  const text = 'The Panama Canal opened to world trade in 1914.';
  const sample = report.cases[0];
  if (!report.completed || report.cases.length !== 1 || !sample?.terminalReceived || sample.status !== 'observed' || sample.httpStatus !== 202) {
    return { outcome: 'failed', reason: 'operational_or_terminal_failure', factualSourceVerification: 'not_reviewed' };
  }
  const results = sample.events.filter(event => event.type === 'claim.result');
  if (sample.admission?.action !== 'check' || sample.admittedPublic.length !== 1 || sample.admittedPublic[0] !== text
    || results.length !== 1 || results[0].checkedPublicText !== text || results[0].cached !== false) {
    return { outcome: 'failed', reason: 'admission_span_result_or_cold_state_mismatch', factualSourceVerification: 'not_reviewed' };
  }
  const result = results[0];
  if (result.presentation?.action !== 'silent' || result.presentation.reasonCode !== 'automatic_noncontradiction') {
    return { outcome: 'failed', reason: 'presentation_mismatch', factualSourceVerification: 'not_reviewed' };
  }
  if (result.verdict === 'insufficient_evidence') return { outcome: 'inconclusive', reason: 'abstention_prevents_supported_branch', factualSourceVerification: 'not_applicable' };
  if (result.verdict !== 'supported') {
    return { outcome: 'failed', reason: 'verdict_mismatch', factualSourceVerification: 'not_reviewed' };
  }
  return { outcome: 'passed', reason: 'actual_cold_supported_automatic_silence', factualSourceVerification: 'pending_independent_review' };
}

async function main() {
  const [sourceArg, manifestArg, outputArg, mode] = process.argv.slice(2);
  if (!sourceArg || !manifestArg || !outputArg || !['plan', 'live'].includes(mode)) throw new Error('Usage: SOURCE MANIFEST FRESH_OUTPUT plan|live');
  const source = resolve(sourceArg), output = resolve(outputArg);
  const git = (args: string[]) => execFileSync('git', args, { cwd: source, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const commit = git(['rev-parse', 'HEAD']).trim();
  if (commit !== EXPECTED_COMMIT || git(['status', '--porcelain', '--untracked-files=normal']).trim()) throw new Error('Frozen08 commit mismatch or dirty checkout');
  const paths = git(['ls-files', '-z', '--', 'apps/console', 'services/api', 'packages/contracts', 'package.json', 'package-lock.json']).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const path of paths) { hash.update(path); hash.update('\0'); hash.update(await readFile(resolve(source, path))); hash.update('\0'); }
  const sourceSHA256 = hash.digest('hex');
  if (sourceSHA256 !== EXPECTED_SOURCE_SHA256) throw new Error('Frozen08 source hash mismatch');
  const { loadDevelopmentManifest, publicCasePlan } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/cases.ts')).href);
  const { manifest, sha256: manifestSHA256 } = await loadDevelopmentManifest(resolve(manifestArg));
  if (manifestSHA256 !== EXPECTED_MANIFEST_SHA256 || manifest.cases.length !== 1) throw new Error('Predeclared AD07 manifest mismatch');
  const { runLiveCampaign } = await import(pathToFileURL(resolve(source, 'apps/console/src/live/run.ts')).href);
  const wrapperSHA256 = createHash('sha256').update(await readFile(process.argv[1])).digest('hex');
  const plan = { kind: 'automatic_supported_silence_followup_ad07', commit, sourceSHA256, manifestSHA256, wrapperSHA256,
    limits: AD07_LIMITS, freshSession: true, newFactualAccuracyFacts: 0, cases: manifest.cases.map(publicCasePlan) };
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
  const report = await runLiveCampaign({ cases: manifest.cases, limits: AD07_LIMITS,
    keys: { jev: process.env.JEV_API_KEY, exa: process.env.EXA_API_KEY },
    metadata: { commit, dirty: false, sourceSHA256, casesSHA256: manifestSHA256, campaignName: manifest.name },
    onProgress: (value: unknown) => checkpoint('attempt_checkpoint', value), onCase: (value: unknown) => checkpoint('case_checkpoint', value) });
  const actionEvaluation = scoreAD07(report);
  await persist({ ...report, followupPlan: plan, actionEvaluation });
  process.stdout.write(JSON.stringify({ output, completed: report.completed, counts: report.counts, totals: report.totals, actionEvaluation }) + '\n');
  if (!report.completed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
