import { loadPromptPack } from '../../../../services/api/src/providers/prompt-pack.js';
import type { PromptPack } from '../../../../services/api/src/providers/prompt-pack.js';
import type { LayaLimits, RunOptions } from './benchmark.js';

export const HELP = `evaluate:providers --acquire --evidence-out PATH [--cases PATH] | --providers jev,laya --modes admission,pipeline,judge [--limit N] [--repetitions N] --output PATH
  [--deadline-ms 10000] [--laya-max-len 1024 --laya-head-max-len 512 (Laya judge diagnostic only)]
  [--prompt-pack jev=PATH,laya=PATH] [--admission-cases PATH] [--cases PATH] [--evidence PATH]
  [--laya-deadline-ms N (Laya only)] [--lock PATH] [--summary PATH] [--dataset dev|holdout]`;

export type Cli = { kind: 'help' } | { kind: 'acquire'; limit?: number; casesPath?: string; evidenceOut: string } | { kind: 'run'; options: RunOptions; packFiles: Record<string, string> };

const KNOWN = new Set(['help', 'acquire', 'providers', 'modes', 'limit', 'repetitions', 'output', 'deadline-ms', 'laya-max-len', 'laya-head-max-len', 'prompt-pack', 'admission-cases', 'cases', 'evidence', 'evidence-out', 'laya-deadline-ms', 'lock', 'summary', 'dataset']);
const BOOLEAN = new Set(['help', 'acquire']);

/** Pure argument parsing and validation; pack files are loaded separately by `loadPacks`. */
export function parseCli(args: string[]): Cli {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith('--') || !KNOWN.has(token.slice(2))) throw new Error(`unknown_argument: ${token.slice(0, 40)}`);
    const name = token.slice(2);
    if (BOOLEAN.has(name)) { values.set(name, true); continue; }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing_value: --${name}`);
    values.set(name, value); index++;
  }
  const str = (name: string) => { const value = values.get(name); return typeof value === 'string' ? value : undefined; };
  const integer = (name: string, fallback: number | undefined, min: number, max: number, error: string) => {
    const raw = str(name); if (raw === undefined) return fallback;
    const value = Number(raw); if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(error); return value;
  };
  if (values.has('help')) return { kind: 'help' };
  const limit = integer('limit', undefined, 1, Number.MAX_SAFE_INTEGER, 'invalid_limit');
  if (values.has('acquire')) {
    const evidenceOut = str('evidence-out');
    if (!evidenceOut) throw new Error('acquire_requires_evidence_out');
    return { kind: 'acquire', limit, casesPath: str('cases'), evidenceOut };
  }
  if (values.has('evidence-out')) throw new Error('evidence_out_requires_acquire');
  const providers = (str('providers') ?? 'jev,laya').split(','); const modes = (str('modes') ?? 'pipeline,judge').split(',');
  if (providers.some(value => !['jev', 'laya'].includes(value)) || modes.some(value => !['admission', 'pipeline', 'judge'].includes(value))) throw new Error('invalid_mode_or_provider');
  const repetitions = integer('repetitions', 1, 1, 5, 'invalid_repetitions')!;
  const deadlineMs = integer('deadline-ms', 10000, 1000, 120000, 'invalid_deadline')!;
  if (deadlineMs !== 10000 && modes.some(mode => mode !== 'judge')) throw new Error('extended_deadline_judge_only');
  const layaDeadlineMs = integer('laya-deadline-ms', undefined, 1000, 120000, 'invalid_laya_deadline');
  const layaLimits: LayaLimits | undefined = values.has('laya-max-len') ? { maxLen: Number(str('laya-max-len')), headMaxLen: Number(str('laya-head-max-len') ?? '512') } : undefined;
  if (values.has('laya-head-max-len') && !layaLimits) throw new Error('missing_laya_max_len');
  if (layaLimits && (providers.some(value => value !== 'laya') || modes.some(value => value !== 'judge') || !Number.isSafeInteger(layaLimits.maxLen) || !Number.isSafeInteger(layaLimits.headMaxLen) || layaLimits.maxLen < 512 || layaLimits.maxLen > 8192 || layaLimits.headMaxLen < 32 || layaLimits.headMaxLen >= layaLimits.maxLen)) throw new Error('invalid_context_diagnostic');
  const dataset = str('dataset') ?? 'dev';
  if (dataset !== 'dev' && dataset !== 'holdout') throw new Error('invalid_dataset');
  const packFiles = parsePackFlag(str('prompt-pack'), providers);
  return { kind: 'run', packFiles, options: {
    providers, modes, limit, repetitions, deadlineMs, layaLimits, layaDeadlineMs, dataset, packFiles,
    output: str('output') ?? 'fixtures/evaluation/provider-comparison/results/latest.json',
    admissionCasesPath: str('admission-cases'), casesPath: str('cases'), evidencePath: str('evidence'), lockPath: str('lock'), summaryPath: str('summary'),
  } };
}

/** `jev=a.json,laya=b.json`; each provider at most once, and only providers being run. */
export function parsePackFlag(value: string | undefined, providers: string[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of value ? value.split(',') : []) {
    const cut = entry.indexOf('=');
    const provider = entry.slice(0, cut), path = entry.slice(cut + 1);
    if (cut < 1 || !path || !['jev', 'laya'].includes(provider) || files[provider]) throw new Error('invalid_prompt_pack_flag');
    if (!providers.includes(provider)) throw new Error(`prompt_pack_for_unused_provider: ${provider}`);
    files[provider] = path;
  }
  return files;
}

export async function loadPacks(files: Record<string, string>): Promise<Record<string, PromptPack>> {
  return Object.fromEntries(await Promise.all(Object.entries(files).map(async ([provider, path]) => [provider, await loadPromptPack(path)] as const)));
}
