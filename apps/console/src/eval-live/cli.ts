import { parseArgs } from 'node:util';
import { z } from 'zod';
import { runEvaluation, type EvalTransport } from './driver.js';
import { formatShipRule, markdownTable, shipRule } from './metrics.js';
import { LIVE_RUNS_DIR, buildReport, readReport, serverKind, writeReport } from './report.js';
import { EVAL_SETS, loadSets, type EvalSet } from './sets.js';

export const USAGE = `Live eval: drives a running server over HTTP and its WebSocket stream.

  npm run evaluate:live -- [--server URL] [--sets everyday,hard] [--limit N] [--label NAME]
                           [--out-dir DIR] [--timeout-ms MS] [--baseline REPORT.json]
  npm run evaluate:live -- --baseline A.json --candidate B.json   (compare two saved runs, no checks)

The join code comes from DEMO_JOIN_CODE. --server defaults to EVAL_SERVER_URL or http://127.0.0.1:3000.
EVERYDAY reads FACTCHECK_REPO/test/claims.json plus fixtures/evaluation/device-phrases.json; HARD reads
FACTCHECK_REPO/.build/averitec/heldout.json in place. Reports go to fixtures/evaluation/live-runs/.`;

export type CliOptions = {
  server: string; sets: EvalSet[]; limit: number | null; label: string; outDir: string; timeoutMs: number;
  baseline: string | null; candidate: string | null; help: boolean;
};

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const { values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: {
    server: { type: 'string' }, sets: { type: 'string' }, limit: { type: 'string' }, label: { type: 'string' }, 'out-dir': { type: 'string' },
    'timeout-ms': { type: 'string' }, baseline: { type: 'string' }, candidate: { type: 'string' }, help: { type: 'boolean' },
  } });
  const server = (values.server ?? env.EVAL_SERVER_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(server)) throw new Error('--server must be an http(s) origin such as http://127.0.0.1:3311');
  const sets = z.array(z.enum(EVAL_SETS)).min(1).parse((values.sets ?? 'everyday,hard').split(',').map(set => set.trim()).filter(Boolean));
  const limit = values.limit === undefined ? null : z.coerce.number().int().positive().parse(values.limit);
  const timeoutMs = values['timeout-ms'] === undefined ? 15_000 : z.coerce.number().int().min(1_000).max(120_000).parse(values['timeout-ms']);
  if (values.candidate && !values.baseline) throw new Error('--candidate needs --baseline');
  return {
    server, sets: [...new Set(sets)], limit, label: values.label ?? 'run', outDir: values['out-dir'] ?? LIVE_RUNS_DIR, timeoutMs,
    baseline: values.baseline ?? null, candidate: values.candidate ?? null, help: values.help ?? false,
  };
}

async function healthMode(server: string, transport?: EvalTransport): Promise<string | null> {
  try {
    const response = await (transport?.fetch ?? fetch)(`${server}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const mode = ((await response.json()) as { mode?: unknown }).mode;
    return typeof mode === 'string' && /^[a-z]{1,16}$/.test(mode) ? mode : null;
  } catch { return null; }
}

/** Returns the process exit code. Prints ids, labels and metrics only: never claim text, the join code or a key. */
export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env, out: (line: string) => void = console.log, transport?: EvalTransport): Promise<number> {
  const options = parseCliArgs(argv, env);
  if (options.help) { out(USAGE); return 0; }
  if (options.baseline && options.candidate) {
    const [baseline, candidate] = await Promise.all([readReport(options.baseline), readReport(options.candidate)]);
    out(markdownTable([{ label: baseline.label, metrics: baseline.metrics }, { label: candidate.label, metrics: candidate.metrics }]));
    const result = shipRule(baseline.metrics, candidate.metrics);
    out(''); out(formatShipRule(result));
    return result.pass ? 0 : 1;
  }
  const joinCode = env.DEMO_JOIN_CODE ?? '';
  if (!joinCode) { out('Set DEMO_JOIN_CODE (the server\'s join code) in the environment or .env.'); return 2; }
  const mode = await healthMode(options.server, transport);
  if (mode === null) { out(`No healthy server at the ${serverKind(options.server)} address given. Start one or pass --server.`); return 2; }
  const cases = await loadSets(options.sets, { limit: options.limit ?? undefined, env });
  const counts = options.sets.map(set => `${set} ${cases.filter(sample => sample.set === set).length}`).join(', ');
  out(`Running ${cases.length} checks (${counts}) against a ${serverKind(options.server)} server in ${mode} mode.`);
  const startedAt = new Date().toISOString();
  const run = await runEvaluation(cases, { server: options.server, joinCode, transport, timeoutMs: options.timeoutMs, log: out });
  const report = buildReport({
    label: options.label, startedAt, finishedAt: new Date().toISOString(), stoppedReason: run.stopped, server: options.server, mode,
    sets: options.sets, limit: options.limit, joins: run.joins, rows: run.rows,
  });
  const files = await writeReport(report, options.outDir);
  out(''); out(markdownTable([{ label: report.label, metrics: report.metrics }]));
  out(''); out(`Report: ${files.json}`); out(`Table: ${files.markdown}`);
  if (run.stopped) out(`Stopped early: ${run.stopped}`);
  if (options.baseline) {
    const baseline = await readReport(options.baseline);
    out(''); out(markdownTable([{ label: baseline.label, metrics: baseline.metrics }, { label: report.label, metrics: report.metrics }]));
    out(''); out(formatShipRule(shipRule(baseline.metrics, report.metrics)));
  }
  return run.stopped ? 1 : 0;
}
