import { PipelineError, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { retryAfterDelay } from '../../runtime/provider-retry.js';
import { getJson } from '../../sources/http.js';

/** Wikimedia's API rules ask for a descriptive User-Agent. It names the app only: no person, no email. */
export const WIKIMEDIA_USER_AGENT = 'FactoFactCheck/1.0 (Junction 2026 hackathon)';

/** Anonymous budget until there is a contact page: 9 requests a minute, 3 at once, a doubling pause on push-back. */
export const WIKIMEDIA_LIMITS = { perMinute: 9, concurrent: 3, backoffMs: 5_000, maxBackoffMs: 300_000 } as const;

/**
 * Port of the reference app's WikipediaThrottle: a per-minute budget, a cap on requests at once and a pause
 * after Wikimedia pushes back. `begin()` answers at once, so a refused lookup never slows a check.
 */
export class WikimediaThrottle {
  private starts: number[] = [];
  private inFlight = 0;
  private pausedUntil = -Infinity;
  private strikes = 0;

  constructor(private perMinute: number = WIKIMEDIA_LIMITS.perMinute, private maxConcurrent: number = WIKIMEDIA_LIMITS.concurrent,
    private now: () => number = Date.now) {}

  /** Takes a slot, or returns false when the budget, the cap or a pause says no. */
  begin(): boolean {
    const time = this.now();
    if (time < this.pausedUntil || this.inFlight >= this.maxConcurrent) return false;
    this.starts = this.starts.filter(start => time - start < 60_000);
    if (this.starts.length >= this.perMinute) return false;
    this.starts.push(time);
    this.inFlight++;
    return true;
  }

  end(): void { this.inFlight = Math.max(0, this.inFlight - 1); }

  /**
   * Pauses for Retry-After, or for a wait that doubles with each push-back in a row. Requests already in
   * flight when the pause starts add no strikes, and a later push-back never shortens a pause.
   */
  backOff(retryAfterMs: number | undefined): void {
    const time = this.now();
    const doubling = Math.min(WIKIMEDIA_LIMITS.maxBackoffMs, WIKIMEDIA_LIMITS.backoffMs * 2 ** this.strikes);
    if (time >= this.pausedUntil) this.strikes++;
    const wait = retryAfterMs === undefined ? doubling : Math.min(Math.max(retryAfterMs, 0), WIKIMEDIA_LIMITS.maxBackoffMs);
    this.pausedUntil = Math.max(this.pausedUntil, time + wait);
  }

  get paused(): boolean { return this.now() < this.pausedUntil; }

  succeeded(): void { this.strikes = 0; }
}

/** One throttle per Wikimedia service, shared by every session. */
export const wikipediaThrottle = new WikimediaThrottle();
export const wikidataThrottle = new WikimediaThrottle();

const errorCode = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
};

/**
 * One Wikimedia API GET under its throttle and the claim's allowance. A throttle refusal throws
 * `<service>_throttled` before any request; 429, 403, 503 or an API error `ratelimited`/`maxlag` pauses the
 * service and throws `<service>_rate_limited`. Any other API error is a failed lookup, never "nothing found".
 */
export async function wikimediaGet(options: {
  fetch: typeof fetch; url: string; throttle: WikimediaThrottle; context: ProviderContext; service: 'wikipedia' | 'wikidata'; claimId: string;
}): Promise<unknown> {
  const { context, service, throttle } = options;
  context.signal.throwIfAborted();
  if (!throttle.begin()) throw new PipelineError(`${service}_throttled`);
  let reply;
  try {
    context.consume(service, options.claimId);
    reply = await getJson(options.fetch, options.url, {
      service, signal: context.signal, maxBytes: 8_000_000, headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
    });
  } finally { throttle.end(); }
  const retryAfter = retryAfterDelay(reply.retryAfter, context.now());
  if ([429, 403, 503].includes(reply.status)) {
    throttle.backOff(retryAfter);
    throw new PipelineError(`${service}_rate_limited`);
  }
  if (reply.status !== 200) throw new PipelineError(`${service}_unavailable`);
  const code = errorCode(reply.body);
  if (code !== null) {
    if (code === 'ratelimited' || code === 'maxlag') {
      throttle.backOff(retryAfter);
      throw new PipelineError(`${service}_rate_limited`);
    }
    throw new PipelineError(`${service}_unavailable`);
  }
  throttle.succeeded();
  return reply.body;
}
