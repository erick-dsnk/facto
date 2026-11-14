import { createHash } from 'node:crypto';
import { getDomain } from 'tldts';
import { z } from 'zod';
import { codePoints, type Evidence, type EvidenceOrigin } from '../../../../packages/contracts/src/index.js';

/** `www.example.com` and `example.com` are one host. */
export const stripWww = (host: string) => host.startsWith('www.') ? host.slice(4) : host;

/** The lowercased host of a link without `www.`, or '' for anything that is not an http(s) URL. */
export function hostOf(link: string): string {
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? stripWww(url.hostname.toLowerCase()) : '';
  } catch { return ''; }
}

/** The same page reached as http or https, with or without `www.`, a fragment or a trailing slash counts once. */
export function linkKey(link: string): string {
  try {
    const url = new URL(link);
    const key = `${stripWww(url.hostname.toLowerCase())}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;
    return key.endsWith('/') ? key.slice(0, -1) : key;
  } catch { return link; }
}

/** One line, at most `max` code points, cut with an ellipsis. */
export function shortened(text: string, max: number): string {
  const points = codePoints(text);
  return points.length <= max ? text : `${points.slice(0, max - 1).join('').trim()}…`;
}

/** "a", "a and b", "a, b and c" (or "or"). */
export function joinList(items: string[], last: 'and' | 'or'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;
}

/** Collapses whitespace to single spaces. */
export const oneLine = (text: string) => text.split(/\s+/u).filter(Boolean).join(' ');

/** Stable evidence id for a free source: `${origin}-${sha256(url + excerpt)[0..16]}`. */
export const freeEvidenceId = (origin: EvidenceOrigin, url: string, excerpt: string) =>
  `${origin}-${createHash('sha256').update(url + excerpt).digest('hex').slice(0, 16)}`;

export type FreeEvidenceFields = {
  origin: EvidenceOrigin; url: string; title: string; publisher: string | null; excerpt: string; retrievedAt: string;
  publishedAt?: string | null; contentBasis?: Evidence['contentBasis']; sourceGroup?: string;
  stance?: Evidence['stance']; stanceProbability?: number | null; rating?: Evidence['rating'];
};

/**
 * Evidence from a free source. The judge decides relevance and stance, so both start neutral; only a fact
 * check's rating fixes a stance. Excerpts are capped at the contract's 2,000 code points.
 */
export function freeEvidence(fields: FreeEvidenceFields): Evidence {
  const excerpt = codePoints(fields.excerpt).slice(0, 2000).join('');
  const host = hostOf(fields.url);
  const evidence: Evidence = {
    id: freeEvidenceId(fields.origin, fields.url, excerpt), url: fields.url, title: fields.title, publisher: fields.publisher,
    publishedAt: fields.publishedAt ?? null, retrievedAt: fields.retrievedAt, contentBasis: fields.contentBasis ?? 'highlight', excerpt,
    sourceGroup: fields.sourceGroup ?? (getDomain(host, { allowPrivateDomains: true }) || host || fields.origin), echoGroup: null,
    sourceRole: 'unknown', directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false,
    stance: fields.stance ?? 'unrelated', stanceProbability: fields.stanceProbability ?? null, origin: fields.origin,
  };
  if (fields.rating) evidence.rating = fields.rating;
  return evidence;
}

const isoDate = z.iso.date();
const isoTimestamp = z.iso.datetime({ offset: true });

/** A provider date kept at its own precision (`YYYY-MM-DD` or a timestamp with an offset), as the wire schema accepts it; anything else is unknown. */
export function publicationDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (isoDate.safeParse(text).success) {
    const time = Date.parse(`${text}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(text) ? text : null;
  }
  return isoTimestamp.safeParse(text).success && !Number.isNaN(Date.parse(text)) ? text : null;
}
