import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fixtureAdapters } from '../../../../services/api/src/runtime/fixtures.js';
import { buildServer } from '../../../../services/api/src/transport/server.js';
import { main } from './cli.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const step of cleanup.splice(0).reverse()) await step(); });

describe('live eval against a fixture-mode server (E4 dry run)', () => {
  it('drives the real HTTP and WebSocket transport and writes a report', async () => {
    const joinCode = 'fixture-join-code';
    const { app } = await buildServer({ adapters: fixtureAdapters(), mode: 'fixture', joinCode, joinExpiresAt: Date.now() + 3_600_000 });
    cleanup.push(() => app.close());
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    const repo = await mkdtemp(join(tmpdir(), 'factcheck-fixture-'));
    const outDir = await mkdtemp(join(tmpdir(), 'eval-runs-'));
    cleanup.push(() => rm(repo, { recursive: true, force: true }), () => rm(outDir, { recursive: true, force: true }));
    await mkdir(join(repo, 'test'));
    // The fixture server knows these exact sentences.
    await writeFile(join(repo, 'test', 'claims.json'), JSON.stringify([
      { id: 'fixture-true', text: 'Helsinki is the capital of Finland.', context: null, expected: 'true' },
      { id: 'fixture-false', text: 'Lightning never strikes the same place twice.', context: { title: 'Weather myths', before: null }, expected: 'false' },
      { id: 'fixture-empty', text: 'There is not enough fixture evidence.', context: null, expected: 'unverifiable' },
    ]));
    const out: string[] = [];
    const code = await main(['--server', `http://127.0.0.1:${address.port}`, '--sets', 'everyday', '--limit', '4', '--label', 'fixture-dry-run', '--out-dir', outDir],
      { DEMO_JOIN_CODE: joinCode, FACTCHECK_REPO: repo }, line => out.push(line));
    expect(code).toBe(0);
    expect(out.join('\n')).not.toContain(joinCode);
    const [file] = (await readdir(outDir)).filter(name => name.endsWith('-fixture-dry-run.json'));
    const report = JSON.parse(await readFile(join(outDir, file), 'utf8'));
    expect(report).toMatchObject({ completed: true, server: { kind: 'loopback', mode: 'fixture' }, joins: 1 });
    expect(report.rows.map((row: { id: string; predicted: string }) => [row.id, row.predicted])).toEqual([
      ['fixture-true', 'true'], ['fixture-false', 'false'], ['fixture-empty', 'cant_verify'], ['dev-affair', expect.any(String)],
    ]);
    expect(report.rows.every((row: { latencyMs: number | null }) => typeof row.latencyMs === 'number')).toBe(true);
    expect(report.metrics.everyday.fourLabel).toEqual({ count: 3, total: 3, share: 1 });
  }, 20_000);
});
