import { acquire, loadCohort, run } from './src/provider-eval/benchmark.js';
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const index = args.indexOf(`--${name}`); return index < 0 ? fallback : args[index + 1]; };
async function main() {
  if (args.includes('--help')) { console.log('evaluate:providers --acquire | --providers jev,laya --modes admission,pipeline,judge --limit N --repetitions N --output PATH [--deadline-ms 10000] [--laya-max-len 1024 --laya-head-max-len 512 (Laya judge diagnostic only)]'); return; }
  const limit = flag('limit', '') ? Number(flag('limit', '')) : undefined;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error('invalid_limit');
  if (args.includes('--acquire')) { await acquire((await loadCohort()).slice(0, limit)); return; }
  const providers = flag('providers', 'jev,laya').split(','); const modes = flag('modes', 'pipeline,judge').split(',');
  if (providers.some(value => !['jev', 'laya'].includes(value)) || modes.some(value => !['admission', 'pipeline', 'judge'].includes(value))) throw new Error('invalid_mode_or_provider');
  const repetitions = Number(flag('repetitions', '1')); if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 5) throw new Error('invalid_repetitions');
  const deadlineMs = Number(flag('deadline-ms', '10000')); if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1000 || deadlineMs > 120000) throw new Error('invalid_deadline');
  if (deadlineMs !== 10000 && modes.some(mode => mode !== 'judge')) throw new Error('extended_deadline_judge_only');
  const layaLimits = args.includes('--laya-max-len') ? { maxLen: Number(flag('laya-max-len', '1024')), headMaxLen: Number(flag('laya-head-max-len', '512')) } : undefined;
  if (args.includes('--laya-head-max-len') && !layaLimits) throw new Error('missing_laya_max_len');
  if (layaLimits && (providers.some(value => value !== 'laya') || modes.some(value => value !== 'judge') || !Number.isSafeInteger(layaLimits.maxLen) || !Number.isSafeInteger(layaLimits.headMaxLen) || layaLimits.maxLen < 512 || layaLimits.maxLen > 8192 || layaLimits.headMaxLen < 32 || layaLimits.headMaxLen >= layaLimits.maxLen)) throw new Error('invalid_context_diagnostic');
  const result = await run({ providers, modes, limit, repetitions, deadlineMs, layaLimits, output: flag('output', 'fixtures/evaluation/provider-comparison/results/latest.json') }); console.log(JSON.stringify(result.summary, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'evaluation_failed'); process.exitCode = 1; });
