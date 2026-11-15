import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runEvaluation } from './driver.js';
import { FakeServer } from './fake-server.js';
import { buildReport, readReport, reportBaseName, safeLabel, serverKind, writeReport } from './report.js';
import { hardClaims } from './sets.js';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const tempDir = async () => { const dir = await mkdtemp(join(tmpdir(), 'eval-report-')); dirs.push(dir); return dir; };

// Distinctive stand-ins for CC BY-NC claim text. None of it may reach a report, a table or a log line.
const HARD_TEXT = ['The zorbulon treaty was signed by seven moons in 1871.', 'Quentaris exported 40 tonnes of glimmerwool last year.'];
const HARD_CONTEXT = 'Speaker Vexmoor, 3 March 2021';

describe('live eval report', () => {
  it('keeps HARD claim text, context and server prose out of the report, the table and the log', async () => {
    const server = new FakeServer();
    server.onCheck = (body, session) => {
      // A server that echoes the claim back everywhere it can: summary, checked text and even the reason code.
      session.socket!.push('claim.result', { verdict: 'contradicted', reasonCode: body.text, summary: body.text, checkedText: body.text, originalText: body.context.join(' ') },
        { requestId: body.requestId, claimId: `${body.requestId}-claim-0`, revision: 1 });
    };
    const cases = hardClaims(HARD_TEXT.map((text, index) => ({ id: `fals-${index}`, text, context: { before: HARD_CONTEXT }, expected: 'false' })));
    const log: string[] = [];
    const run = await runEvaluation(cases, { server: 'http://127.0.0.1:3311', joinCode: server.joinCode, transport: server.transport(), log: line => log.push(line) });
    expect(server.sessions.get('s1')!.checks.map(check => check.text)).toEqual(HARD_TEXT);
    const report = buildReport({ label: 'Hard Test!', startedAt: '2026-11-14T19:05:12.345Z', finishedAt: '2026-11-14T19:06:00.000Z', stoppedReason: null,
      server: 'http://127.0.0.1:3311', mode: 'fixture', sets: ['hard'], limit: null, joins: run.joins, rows: run.rows });
    const dir = await tempDir();
    const files = await writeReport(report, dir);
    expect(files.json).toBe(join(dir, '2026-11-14T190512Z-hard-test.json'));
    const written = [await readFile(files.json, 'utf8'), await readFile(files.markdown, 'utf8'), log.join('\n')];
    for (const text of written) {
      for (const secret of [...HARD_TEXT, HARD_CONTEXT, 'zorbulon', 'glimmerwool', 'Vexmoor', server.joinCode]) expect(text).not.toContain(secret);
    }
    expect(report.rows.map(row => [row.id, row.expected, row.predicted, row.reasonCode])).toEqual([['fals-0', 'false', 'false', 'other'], ['fals-1', 'false', 'false', 'other']]);
    expect(Object.keys(report.rows[0]).sort()).toEqual(['exaSearches', 'expected', 'id', 'jevCalls', 'latencyMs', 'predicted', 'reasonCode', 'set']);
    expect(written[1]).toContain('| Accuracy, 4 labels | 2/2 (100.0%) |');
    expect(written[1]).toContain('CC BY-NC');
  });

  it('round-trips a saved run, recomputing metrics from its rows, and never overwrites one', async () => {
    const report = buildReport({ label: 'baseline', startedAt: '2026-11-14T10:00:00.000Z', finishedAt: '2026-11-14T10:05:00.000Z', stoppedReason: 'join_unauthorized',
      server: 'https://example.workers.dev', mode: 'live', sets: ['everyday'], limit: 3, joins: 1,
      rows: [{ set: 'everyday', id: 'myth-01', expected: 'false', predicted: 'cant_verify', reasonCode: 'insufficient_evidence', latencyMs: 2_500, jevCalls: 2, exaSearches: 1, fieldUnsupported: true }] });
    expect(report).toMatchObject({ completed: false, server: { kind: 'remote', mode: 'live' } });
    const dir = await tempDir();
    const files = await writeReport(report, dir);
    const loaded = await readReport(files.json);
    expect(loaded.rows).toEqual(report.rows);
    expect(loaded.metrics.everyday).toMatchObject({ cases: 1, cantVerify: { count: 1, total: 1 }, exaSearchesPerCheck: 1, fieldUnsupported: 1 });
    await expect(writeReport(report, dir)).rejects.toThrow();
    expect(await readdir(dir)).toHaveLength(2);
  });

  it('names files safely and tells loopback from remote servers', () => {
    expect(safeLabel('fc-port / Candidate #2')).toBe('fc-port-candidate-2');
    expect(safeLabel('')).toBe('run');
    expect(reportBaseName('x', '2026-11-14T01:02:03.004Z')).toBe('2026-11-14T010203Z-x');
    expect(['http://127.0.0.1:3311', 'http://localhost:3000', 'http://[::1]:3000'].map(serverKind)).toEqual(['loopback', 'loopback', 'loopback']);
    expect(serverKind('https://facto-api.example.workers.dev')).toBe('remote');
  });
});
