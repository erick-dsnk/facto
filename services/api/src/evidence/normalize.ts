import { createHash } from 'node:crypto';
import { getDomain } from 'tldts';
import { z } from 'zod';
import { codePoints, PipelineError, type Evidence } from '../../../../packages/contracts/src/index.js';

const resultSchema = z.object({
  id: z.string().max(4096).optional(), url: z.string().max(4096), title: z.string().max(4000).nullable().optional(),
  publishedDate: z.string().max(100).nullable().optional(), publisher: z.string().max(1000).nullable().optional(),
  highlights: z.array(z.string().max(50000)).max(20).optional(), text: z.string().max(100000).optional(),
});
const responseSchema = z.object({
  results: z.array(resultSchema).max(100),
  statuses: z.array(z.object({ status: z.string(), id: z.string().optional() })).max(100).optional(),
});
const publicationDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
export type RetrievedPage = z.infer<typeof resultSchema>;

export function parseExaResponse(value: unknown): RetrievedPage[] {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new PipelineError('malformed_exa_response');
  if (parsed.data.statuses?.some(status => /error|failed|timeout/i.test(status.status))) {
    throw new PipelineError('exa_content_failed', true);
  }
  return parsed.data.results;
}

export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !getDomain(url.hostname, { allowPrivateDomains: true })) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'msclkid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 20);
const words = (text: string) => text.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [];
const common = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'into', 'have', 'has', 'was', 'were', 'are', 'for', 'not', 'never', 'always', 'does', 'than', 'think']);
const terms = (claim: string) => new Set(words(claim).filter(word => word.length >= 3 && !common.has(word)));
const relevance = (text: string, queryTerms: Set<string>) => new Set(words(text).filter(word => queryTerms.has(word))).size;

/** Select an exact contiguous passage. Never concatenate independent snippets into a quote. */
export function selectExcerpt(page: RetrievedPage, claim: string): { excerpt: string; contentBasis: Evidence['contentBasis'] } | null {
  const pageText = page.text?.trim();
  const passages = pageText ? [pageText] : (page.highlights ?? []).filter(text => text.trim().length > 0);
  if (!passages.length) return null;
  const queryTerms = terms(claim);
  const ranked = passages.map(text => ({ text, score: relevance(text, queryTerms) })).sort((a, b) => b.score - a.score);
  const chosen = ranked[0].text;
  const points = codePoints(chosen);
  if (points.length <= 2000) return { excerpt: chosen, contentBasis: pageText ? 'page_text' : 'highlight' };
  // Rank overlapping windows so relevant qualifications late in a page aren't lost to prefix truncation.
  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start < points.length; start += 1000) {
    const score = relevance(points.slice(start, start + 2000).join(''), queryTerms);
    if (score > bestScore) { bestScore = score; bestStart = start; }
  }
  return { excerpt: points.slice(bestStart, bestStart + 2000).join(''), contentBasis: pageText ? 'page_text' : 'highlight' };
}

function textShingles(text: string): Set<string> {
  const tokens = words(text);
  return new Set(tokens.slice(0, -4).map((_, i) => tokens.slice(i, i + 5).join(' ')));
}

function copies(a: string, b: string): boolean {
  const normalizedA = words(a).join(' ');
  const normalizedB = words(b).join(' ');
  if (normalizedA === normalizedB) return true;
  const left = textShingles(a), right = textShingles(b);
  if (Math.min(left.size, right.size) < 8) return false;
  const overlap = [...left].filter(shingle => right.has(shingle)).length;
  // Containment also groups a shortened syndication of a longer original passage.
  return overlap / Math.min(left.size, right.size) >= 0.75;
}

/** Groups obvious copying, not a universal assertion of source independence. */
export function groupEchoes(evidence: Evidence[]): Evidence[] {
  const parent = evidence.map((_, index) => index);
  const root = (index: number): number => parent[index] === index ? index : root(parent[index]);
  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      if (copies(evidence[i].excerpt, evidence[j].excerpt)) parent[root(j)] = root(i);
    }
  }
  return evidence.map((record, index) => {
    const family = evidence.filter((_, other) => root(other) === root(index));
    return { ...record, echoGroup: family.length > 1 ? `echo-${hash(family.map(item => item.id).sort().join('|'))}` : null };
  });
}

export function normalizeEvidence(pages: RetrievedPage[], claim: string, retrievedAt: string): Evidence[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const result: Evidence[] = [];
  const queryTerms = terms(claim);
  const ranked = [...pages].sort((a, b) => relevance(`${b.title ?? ''} ${(b.highlights ?? []).join(' ')} ${b.text ?? ''}`, queryTerms) - relevance(`${a.title ?? ''} ${(a.highlights ?? []).join(' ')} ${a.text ?? ''}`, queryTerms));
  for (const page of ranked) {
    const url = normalizeUrl(page.url);
    const selected = selectExcerpt(page, claim);
    if (!url || !selected || seen.has(url)) continue;
    const sourceGroup = getDomain(new URL(url).hostname, { allowPrivateDomains: true });
    if (!sourceGroup || (counts.get(sourceGroup) ?? 0) >= 2) continue;
    seen.add(url);
    counts.set(sourceGroup, (counts.get(sourceGroup) ?? 0) + 1);
    result.push({
      id: `ev-${hash(url)}`, url, title: page.title ?? '', publisher: page.publisher ?? null,
      // Keep publisher precision: a date-only value must not acquire an invented time.
      publishedAt: publicationDateSchema.safeParse(page.publishedDate).success ? page.publishedDate! : null,
      retrievedAt, ...selected, sourceGroup, echoGroup: null, sourceRole: 'unknown',
      directlyAddressesClaim: false, matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null,
    });
    if (result.length === 6) break;
  }
  return groupEchoes(result);
}
