import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { EVAL_LABELS } from './labels.js';
import type { EvalRow } from './driver.js';
import { computeRunMetrics, confusionTable, markdownTable, type RunMetrics } from './metrics.js';
import { EVAL_SETS, type EvalSet } from './sets.js';

export const LIVE_RUNS_DIR = fileURLToPath(new URL('../../../../fixtures/evaluation/live-runs/', import.meta.url));
export const LICENCE_NOTE = 'HARD is the AVeriTeC held-out sample (CC BY-NC 4.0), read in place from the reference app checkout. '
  + 'Reports keep only ids, labels and metrics; no claim text, context, checked text or summary is stored.';

/** What a report row may hold: ids, labels, codes and numbers. Nothing a server or dataset wrote as prose. */
export const reportRowSchema = z.object({
  set: z.enum(EVAL_SETS), id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/), expected: z.enum(EVAL_LABELS), predicted: z.enum(EVAL_LABELS),
  reasonCode: z.string().regex(/^[a-z0-9_]{1,64}$/).nullable(), latencyMs: z.number().nonnegative().nullable(),
  jevCalls: z.number().int().nonnegative().nullable(), exaSearches: z.number().int().nonnegative().nullable(), fieldUnsupported: z.literal(true).optional(),
}).strict();
export const reportSchema = z.object({
  schemaVersion: z.literal(1), label: z.string(), startedAt: z.string(), finishedAt: z.string(), completed: z.boolean(), stoppedReason: z.string().nullable(),
  server: z.object({ kind: z.enum(['loopback', 'remote']), mode: z.string().nullable() }).strict(),
  sets: z.array(z.enum(EVAL_SETS)), limit: z.number().int().positive().nullable(), joins: z.number().int().nonnegative(), licence: z.string(),
  metrics: z.record(z.string(), z.unknown()), rows: z.array(reportRowSchema),
}).strict();
export type EvalReport = Omit<z.infer<typeof reportSchema>, 'metrics'> & { metrics: RunMetrics };

export const safeLabel = (label: string | undefined) => (label ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'run';
/** `2026-11-14T190512Z-<label>`: UTC, no colons, so it works as a file name everywhere. */
export const reportBaseName = (label: string, startedAt: string) => `${startedAt.replace(/\.\d+Z$/, 'Z').replace(/:/g, '')}-${safeLabel(label)}`;
export const serverKind = (server: string): 'loopback' | 'remote' => {
  const host = new URL(server).hostname;
  return host === 'localhost' || host === '[::1]' || host === '::1' || /^127\./.test(host) ? 'loopback' : 'remote';
};

export function buildReport(input: {
  label: string; startedAt: string; finishedAt: string; stoppedReason: string | null; server: string; mode: string | null;
  sets: EvalSet[]; limit: number | null; joins: number; rows: EvalRow[];
}): EvalReport {
  const rows = input.rows.map(row => reportRowSchema.parse({
    set: row.set, id: row.id, expected: row.expected, predicted: row.predicted, reasonCode: row.reasonCode, latencyMs: row.latencyMs,
    jevCalls: row.jevCalls, exaSearches: row.exaSearches, ...(row.fieldUnsupported ? { fieldUnsupported: true } : {}),
  }));
  return {
    schemaVersion: 1, label: safeLabel(input.label), startedAt: input.startedAt, finishedAt: input.finishedAt,
    completed: input.stoppedReason === null, stoppedReason: input.stoppedReason,
    server: { kind: serverKind(input.server), mode: input.mode }, sets: input.sets, limit: input.limit, joins: input.joins,
    licence: LICENCE_NOTE, metrics: computeRunMetrics(rows), rows,
  };
}

export function reportMarkdown(report: EvalReport): string {
  const parts = [
    `# Live eval: ${report.label}`, '',
    `Started ${report.startedAt}, finished ${report.finishedAt}. Server: ${report.server.kind}, ${report.server.mode ?? 'unknown'} mode. `
      + `${report.completed ? 'Completed' : `Stopped early (${report.stoppedReason})`}, ${report.rows.length} checks, ${report.joins} sessions.`, '',
    markdownTable([{ label: report.label, metrics: report.metrics }]),
  ];
  for (const set of EVAL_SETS) {
    const metrics = report.metrics[set];
    if (metrics) parts.push('', `## ${set.toUpperCase()} confusion matrix`, '', confusionTable(metrics));
  }
  parts.push('', report.licence, '');
  return parts.join('\n');
}

/** Writes `<dir>/<UTC>-<label>.json` and `.md`. Refuses to overwrite an existing run. */
export async function writeReport(report: EvalReport, dir = LIVE_RUNS_DIR): Promise<{ json: string; markdown: string }> {
  await mkdir(dir, { recursive: true });
  const base = join(dir, reportBaseName(report.label, report.startedAt));
  const json = `${base}.json`; const markdown = `${base}.md`;
  await writeFile(json, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await writeFile(markdown, reportMarkdown(report), { flag: 'wx' });
  return { json, markdown };
}

/** Reads a saved run. Metrics are recomputed from its rows so an older report scores by today's definitions. */
export async function readReport(path: string): Promise<EvalReport> {
  const parsed = reportSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  return { ...parsed, metrics: computeRunMetrics(parsed.rows) };
}
