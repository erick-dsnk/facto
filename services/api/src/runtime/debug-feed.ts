/**
 * Debug only (DEBUG_TRANSCRIPTS=1): the newest server-side records in memory, read with
 * GET /v1/debug/feed. It holds what bystanders said, so it is never written to disk and
 * the oldest entries drop out once the buffer is full.
 */
export type DebugEntry = { seq: number; at: string; kind: string; sessionId?: string; data: unknown };

export class DebugFeed {
  private entries: DebugEntry[] = [];
  private seq = 0;
  constructor(private readonly max = 500, private readonly now: () => number = Date.now) {}

  push(kind: string, data: unknown, sessionId?: string) {
    this.entries.push({ seq: ++this.seq, at: new Date(this.now()).toISOString(), kind, ...(sessionId ? { sessionId } : {}), data });
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
  }

  /** Entries with a sequence number above `seq`, oldest first. */
  after(seq: number): DebugEntry[] {
    return this.entries.filter(entry => entry.seq > seq);
  }
}
