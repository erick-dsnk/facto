import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';

/**
 * A cross-process mutex: `fs.mkdir` is atomic, so whichever process creates `path` owns it. Waiters spin.
 * A lock whose owner process is gone, or that nobody has touched for `staleMs`, is broken so a crashed harness never wedges the others.
 */
export async function acquireLock(path: string, options: { pollMs?: number; staleMs?: number; timeoutMs?: number } = {}): Promise<() => Promise<void>> {
  const { pollMs = 25, staleMs = 15 * 60_000, timeoutMs = 6 * 60 * 60_000 } = options;
  const started = Date.now();
  for (;;) {
    try {
      await mkdir(path);
      await writeFile(`${path}/owner`, String(process.pid)).catch(() => undefined);
      let released = false;
      return async () => { if (!released) { released = true; await rm(path, { recursive: true, force: true }); } };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (await isStale(path, staleMs)) { await rm(path, { recursive: true, force: true }); continue; }
    if (Date.now() - started > timeoutMs) throw new Error('lock_timeout');
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}

async function isStale(path: string, staleMs: number): Promise<boolean> {
  try {
    const owner = Number(await readFile(`${path}/owner`, 'utf8').catch(() => ''));
    if (Number.isInteger(owner) && owner > 0) {
      try { process.kill(owner, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; }
    }
    return Date.now() - (await stat(path)).mtimeMs > staleMs;
  } catch { return false; }
}
