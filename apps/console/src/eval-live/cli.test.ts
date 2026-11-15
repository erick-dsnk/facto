import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main, parseCliArgs } from './cli.js';
import { FakeServer } from './fake-server.js';
import { buildReport, writeReport } from './report.js';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const tempDir = async () => { const dir = await mkdtemp(join(tmpdir(), 'eval-cli-')); dirs.push(dir); return dir; };

describe('live eval CLI arguments', () => {
  it('defaults to both sets against EVAL_SERVER_URL or the local server', () => {
    expect(parseCliArgs([], {})).toMatchObject({ server: 'http://127.0.0.1:3000', sets: ['everyday', 'hard'], limit: null, label: 'run', timeoutMs: 15_000, baseline: null });
    expect(parseCliArgs([], { EVAL_SERVER_URL: 'http://127.0.0.1:3311/' }).server).toBe('http://127.0.0.1:3311');
    expect(parseCliArgs(['--server', 'https://x.example', '--sets', 'hard', '--limit', '3', '--label', 'fc'], {})).toMatchObject({ server: 'https://x.example', sets: ['hard'], limit: 3, label: 'fc' });
  });

  it('rejects bad values', () => {
    expect(() => parseCliArgs(['--sets', 'everyday,medium'], {})).toThrow();
    expect(() => parseCliArgs(['--limit', '0'], {})).toThrow();
    expect(() => parseCliArgs(['--server', 'http://127.0.0.1:3000/v1'], {})).toThrow('--server');
    expect(() => parseCliArgs(['--candidate', 'b.json'], {})).toThrow('--candidate needs --baseline');
    expect(() => parseCliArgs(['--unknown'], {})).toThrow();
  });
});

describe('live eval CLI', () => {
  it('prints usage and refuses to run without a join code', async () => {
    const out: string[] = [];
    expect(await main(['--help'], {}, line => out.push(line))).toBe(0);
    expect(out.join('\n')).toContain('npm run evaluate:live');
    expect(await main([], {}, line => out.push(line))).toBe(2);
    expect(out.at(-1)).toContain('DEMO_JOIN_CODE');
  });

  it('runs both sets, writes the report and prints ids and metrics only', async () => {
    const repo = await tempDir();
    await mkdir(join(repo, 'test')); await mkdir(join(repo, '.build', 'averitec'), { recursive: true });
    await writeFile(join(repo, 'test', 'claims.json'), JSON.stringify([{ id: 'plain-01', text: 'Everyday fact one.', context: null, expected: 'true' }]));
    await writeFile(join(repo, '.build', 'averitec', 'heldout.json'), JSON.stringify([{ id: 'true-9', text: 'Secret hard claim about Zanzibarium.', context: { before: 'Speaker Q' }, expected: 'true' }]));
    const outDir = await tempDir();
    const server = new FakeServer('cli-join-code');
    const out: string[] = [];
    const code = await main(['--server', 'http://127.0.0.1:3311', '--limit', '1', '--label', 'unit', '--out-dir', outDir],
      { DEMO_JOIN_CODE: 'cli-join-code', FACTCHECK_REPO: repo }, line => out.push(line), server.transport());
    expect(code).toBe(0);
    const printed = out.join('\n');
    expect(printed).toContain('Running 2 checks (everyday 1, hard 1) against a loopback server in fixture mode.');
    expect(printed).toContain('[hard 2/2] true-9 expected true got true');
    for (const secret of ['cli-join-code', 'Zanzibarium', 'Speaker Q', 'token-s1']) expect(printed).not.toContain(secret);
    const files = await readdir(outDir);
    expect(files.filter(file => file.endsWith('-unit.json'))).toHaveLength(1);
    const saved = await readFile(join(outDir, files.find(file => file.endsWith('.json'))!), 'utf8');
    expect(saved).not.toContain('Zanzibarium');
    expect(JSON.parse(saved).rows.map((row: { id: string }) => row.id)).toEqual(['plain-01', 'true-9']);
  });

  it('compares two saved runs and exits non-zero when the ship rule fails', async () => {
    const dir = await tempDir();
    const save = async (label: string, predicted: 'true' | 'cant_verify' | 'false') => (await writeReport(buildReport({
      label, startedAt: `2026-11-14T10:00:0${label.length}.000Z`, finishedAt: '2026-11-14T10:10:00.000Z', stoppedReason: null, server: 'http://127.0.0.1:3000', mode: 'live',
      sets: ['everyday'], limit: null, joins: 1,
      rows: [{ set: 'everyday', id: 'plain-01', expected: 'true', predicted, reasonCode: null, latencyMs: 2_000, jevCalls: null, exaSearches: null }],
    }), dir)).json;
    const baseline = await save('base', 'cant_verify');
    const better = await save('better', 'true');
    const worse = await save('worse12', 'false');
    const out: string[] = [];
    expect(await main(['--baseline', baseline, '--candidate', better], {}, line => out.push(line))).toBe(0);
    expect(out.join('\n')).toContain('| Metric | EVERYDAY: base | EVERYDAY: better |');
    expect(out.at(-1)!.endsWith('Ship rule: PASS')).toBe(true);
    expect(await main(['--baseline', baseline, '--candidate', worse], {}, line => out.push(line))).toBe(1);
    expect(out.at(-1)!.endsWith('Ship rule: FAIL')).toBe(true);
    expect(out.at(-1)).toContain('FAIL  everyday: wrong True/False not higher: 0/1 -> 1/1');
  });
});
