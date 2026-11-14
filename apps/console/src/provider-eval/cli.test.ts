import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquire, assertNotFrozenBaseline, frozenPath, loadAdmissionCases } from './benchmark.js';
import { loadPacks, parseCli, parsePackFlag } from './cli.js';

describe('evaluate:providers arguments', () => {
  it('keeps the existing defaults', () => {
    const cli = parseCli([]);
    expect(cli).toMatchObject({ kind: 'run', options: { providers: ['jev', 'laya'], modes: ['pipeline', 'judge'], repetitions: 1, deadlineMs: 10000, dataset: 'dev' } });
    if (cli.kind === 'run') expect(cli.options.layaDeadlineMs).toBeUndefined();
  });
  it('parses the dataset, pack, lock and summary flags', () => {
    const cli = parseCli(['--providers', 'laya', '--modes', 'admission,judge', '--prompt-pack', 'laya=/tmp/a.json', '--admission-cases', 'a.json', '--cases', 'c.json', '--evidence', 'e.json', '--laya-deadline-ms', '30000', '--lock', '/tmp/l', '--summary', 's.json', '--dataset', 'holdout']);
    expect(cli).toMatchObject({ kind: 'run', packFiles: { laya: '/tmp/a.json' }, options: { admissionCasesPath: 'a.json', casesPath: 'c.json', evidencePath: 'e.json', layaDeadlineMs: 30000, lockPath: '/tmp/l', summaryPath: 's.json', dataset: 'holdout' } });
  });
  it('rejects bad pack flags, unknown flags ', () => {
    expect(() => parsePackFlag('jev', ['jev'])).toThrow('invalid_prompt_pack_flag');
    expect(() => parsePackFlag('jev=a,jev=b', ['jev'])).toThrow('invalid_prompt_pack_flag');
    expect(() => parsePackFlag('laya=a', ['jev'])).toThrow(/unused_provider/);
    expect(parsePackFlag('jev=a.json,laya=b.json', ['jev', 'laya'])).toEqual({ jev: 'a.json', laya: 'b.json' });
    expect(() => parseCli(['--nope'])).toThrow(/unknown_argument/);
    expect(() => parseCli(['--providers'])).toThrow(/missing_value/);
    expect(() => parseCli(['--dataset', 'train'])).toThrow('invalid_dataset');
  });
  it('accepts a Laya deadline in pipeline mode', () => {
    const cli = parseCli(['--providers', 'laya', '--modes', 'pipeline', '--laya-deadline-ms', '60000']);
    expect(cli).toMatchObject({ kind: 'run', options: { layaDeadlineMs: 60000, deadlineMs: 10000 } });
  });
  it('requires --evidence-out to acquire and never writes the frozen baseline', async () => {
    expect(() => parseCli(['--acquire'])).toThrow('acquire_requires_evidence_out');
    expect(() => parseCli(['--evidence-out', 'x.json'])).toThrow('evidence_out_requires_acquire');
    expect(parseCli(['--acquire', '--evidence-out', 'x.json', '--cases', 'c.json'])).toMatchObject({ kind: 'acquire', evidenceOut: 'x.json', casesPath: 'c.json' });
    expect(() => assertNotFrozenBaseline(frozenPath)).toThrow('refusing_to_overwrite_frozen_evidence');
    expect(() => assertNotFrozenBaseline(new URL('../../../../fixtures/evaluation/provider-comparison/../provider-comparison/frozen-evidence.json', import.meta.url).pathname)).toThrow('refusing_to_overwrite_frozen_evidence');
    await expect(acquire([], frozenPath)).rejects.toThrow('refusing_to_overwrite_frozen_evidence');
  });
  it('loads packs and admission cases from files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cli-'));
    await writeFile(join(dir, 'p.json'), JSON.stringify({ name: 'compact', judge: { evidence: { maxItems: 3 } } }));
    const packs = await loadPacks({ laya: join(dir, 'p.json') });
    expect(packs.laya.name).toBe('compact'); expect(packs.laya.judge.evidence.maxItems).toBe(3);
    await writeFile(join(dir, 'a.json'), JSON.stringify([{ id: 'a1', text: 'Water boils at 100 C.', expected: 'supported' }, { id: 'a2', text: 'I like tea.', expected: 'not_a_claim', mode: 'audio', confidence: 0.8 }]));
    expect(await loadAdmissionCases(join(dir, 'a.json'))).toMatchObject([{ id: 'a1', mode: 'typed', expected: 'true', context: [] }, { id: 'a2', mode: 'audio', confidence: 0.8, expected: 'not_a_claim' }]);
    await writeFile(join(dir, 'b.json'), JSON.stringify([{ id: 'a1', text: 'x', expected: 'bogus' }]));
    await expect(loadAdmissionCases(join(dir, 'b.json'))).rejects.toThrow(/Unknown expected label/);
    await writeFile(join(dir, 'c.json'), JSON.stringify({ cases: [{ id: 'd', text: 'x', expected: 'false' }, { id: 'd', text: 'y', expected: 'false' }] }));
    await expect(loadAdmissionCases(join(dir, 'c.json'))).rejects.toThrow(/duplicate_id/);
  });
});
