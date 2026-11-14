import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireLock } from './lock.js';

const path = async () => join(await mkdtemp(join(tmpdir(), 'lock-')), 'laya.lock');
describe('cross-process lock', () => {
  it('serialises holders and releases for the next waiter', async () => {
    const lock = await path(); const log: string[] = [];
    const worker = (name: string) => (async () => { const release = await acquireLock(lock, { pollMs: 2 }); log.push(`${name}:in`); await new Promise(resolve => setTimeout(resolve, 20)); log.push(`${name}:out`); await release(); })();
    await Promise.all([worker('a'), worker('b'), worker('c')]);
    for (let index = 0; index < log.length; index += 2) expect(log[index].split(':')[0]).toBe(log[index + 1].split(':')[0]);
    expect(existsSync(lock)).toBe(false);
  });
  it('breaks a lock whose owner process is gone and a lock past its stale age', async () => {
    const dead = await path(); await mkdir(dead); await writeFile(join(dead, 'owner'), '2147483000');
    await (await acquireLock(dead, { pollMs: 2 }))();
    const old = await path(); await mkdir(old); await writeFile(join(old, 'owner'), String(process.pid));
    await (await acquireLock(old, { pollMs: 2, staleMs: 0 }))();
  });
  it('gives up after the timeout and releases only once', async () => {
    const lock = await path(); const release = await acquireLock(lock);
    await expect(acquireLock(lock, { pollMs: 2, timeoutMs: 20 })).rejects.toThrow('lock_timeout');
    await release(); await release(); expect(existsSync(lock)).toBe(false);
  });
});
