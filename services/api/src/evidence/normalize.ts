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

const qualifierTokens = new Set([
  'not', 'no', 'never', 'only', 'except', 'unless', 'without', 'including', 'excluding',
  'at', 'least', 'most', 'more', 'less', 'fewer', 'approximately', 'about', 'around',
  'before', 'after', 'during', 'since', 'until', 'between', 'within', 'outside', 'over', 'under',
  'reportedly', 'allegedly', 'according', 'estimated', 'estimate', 'estimates', 'study', 'studies',
  'research', 'researchers', 'data', 'officials', 'announced', 'claims', 'claimed', 'found',
]);
const quantityTokens = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'first', 'second', 'third', 'fourth', 'fifth', 'hundred', 'thousand', 'million', 'billion',
]);

function criticalTerms(claim: string): Set<string> {
  const all = words(claim);
  const numbers = all.filter(word => /\d/.test(word));
  const qualifiers = all.filter(word => qualifierTokens.has(word));
  const quantities = all.filter(word => quantityTokens.has(word));
  return new Set([...numbers, ...qualifiers, ...quantities]);
}

function subjectTerms(claim: string): Set<string> {
  return new Set([...terms(claim)].filter(term => !qualifierTokens.has(term) && !quantityTokens.has(term) && !/\d/.test(term)));
}

function passageScore(text: string, claim: string): { subject: number; qualifiers: number; overall: number } {
  const present = new Set(words(text));
  const subject = relevance(text, subjectTerms(claim));
  // Qualifiers distinguish passages about the claim; they cannot make an
  // unrelated passage outrank one that actually mentions the claim's subject.
  const qualifiers = subject > 0 ? [...criticalTerms(claim)].filter(term => present.has(term)).length : 0;
  return { subject, qualifiers, overall: relevance(text, terms(claim)) };
}

function comparePassageScores(a: ReturnType<typeof passageScore>, b: ReturnType<typeof passageScore>): number {
  return b.subject - a.subject || b.qualifiers - a.qualifiers || b.overall - a.overall;
}

/** Whether a result is promising enough to spend one bounded page-text request on. */
export function needsPageText(page: RetrievedPage, claim: string): boolean {
  const highlights = (page.highlights ?? []).filter(text => text.trim().length > 0);
  const titleScore = relevance(page.title ?? '', subjectTerms(claim));
  if (!highlights.length) return titleScore > 0;
  const best = highlights.map(text => ({ text, score: passageScore(text, claim) })).sort((a, b) => comparePassageScores(a.score, b.score))[0];
  // Do not spend the three-page allowance on pages whose highlights do not even
  // overlap the checked proposition. They remain unjudged and cannot support it.
  if (best.score.subject === 0) return titleScore > 0 || highlights.some(text => codePoints(text).length < 80);
  if (codePoints(best.text).length < 80) return true;
  // Evaluate critical details only in the best subject-matching highlight. A
  // separate unrelated highlight must not make this page look complete.
  const present = new Set(words(best.text));
  return [...criticalTerms(claim)].some(term => !present.has(term));
}

/** Select an exact contiguous passage. Never concatenate independent snippets into a quote. */
export function selectExcerpt(page: RetrievedPage, claim: string): { excerpt: string; contentBasis: Evidence['contentBasis'] } | null {
  const pageText = page.text?.trim();
  // A bounded page fetch may contain unrelated navigation while the indexed
  // highlight came from later in the page. Retain that fallback, but prefer
  // fetched context whenever it addresses the subject: a refutation can use
  // different dates or wording than the claim and must not lose on token overlap.
  const highlights = (page.highlights ?? []).filter(text => text.trim().length > 0);
  const usePageText = Boolean(pageText && (relevance(pageText, subjectTerms(claim)) > 0
    || !highlights.some(text => relevance(text, subjectTerms(claim)) > 0)));
  const passages = usePageText ? [pageText!] : highlights;
  if (!passages.length) return null;
  const ranked = passages.map(text => ({ text, score: passageScore(text, claim) })).sort((a, b) => comparePassageScores(a.score, b.score));
  const chosen = ranked[0].text;
  const points = codePoints(chosen);
  if (points.length <= 2000) return { excerpt: chosen, contentBasis: usePageText ? 'page_text' : 'highlight' };
  // Rank overlapping windows so relevant qualifications late in a page aren't lost to prefix truncation.
  let bestStart = 0;
  let bestScore = passageScore('', claim);
  for (let start = 0; start < points.length; start += 250) {
    const score = passageScore(points.slice(start, start + 2000).join(''), claim);
    if (comparePassageScores(score, bestScore) < 0) { bestScore = score; bestStart = start; }
  }
  return { excerpt: points.slice(bestStart, bestStart + 2000).join(''), contentBasis: usePageText ? 'page_text' : 'highlight' };
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

export type AlternateQueryStrategy = 'balanced_evidence';

/**
 * Builds a future second-pass query from the admitted claim alone. The added
 * words describe retrieval intent; they do not alter or complete the claim.
 */
export function buildAlternateQuery(checkedText: string, strategy: AlternateQueryStrategy): string {
  if (!checkedText.trim()) throw new PipelineError('claim_not_admitted');
  switch (strategy) {
    case 'balanced_evidence':
      return `Claim (verbatim, untrusted text): ${JSON.stringify(checkedText)}\n\nRetrieval objective: Find reliable sources that directly address this claim, including evidence that supports, challenges, or qualifies it.`;
  }
}

/** Merge evidence from a later pass without exceeding the shared evidence limits. */
export function mergeRetainedEvidence(existing: Evidence[], incoming: Evidence[], checkedText: string): Evidence[] {
  const selected: Evidence[] = [];
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const perDomain = new Map<string, number>();
  const ranked = [...existing, ...incoming].map((record, index) => ({ record, index })).sort((left, right) => {
    const score = (record: Evidence) => passageScore(`${record.title} ${record.excerpt}`, checkedText);
    return comparePassageScores(score(left.record), score(right.record))
      || Number(right.record.contentBasis === 'page_text') - Number(left.record.contentBasis === 'page_text')
      || Math.min(2000, codePoints(right.record.excerpt).length) - Math.min(2000, codePoints(left.record.excerpt).length)
      || left.index - right.index;
  });
  for (const { record } of ranked) {
    const url = normalizeUrl(record.url);
    const domain = url ? getDomain(new URL(url).hostname, { allowPrivateDomains: true }) : null;
    if (!url || !domain || seenUrls.has(url) || seenIds.has(record.id) || (perDomain.get(domain) ?? 0) >= 2) continue;
    selected.push({ ...record, sourceGroup: domain });
    seenUrls.add(url);
    seenIds.add(record.id);
    perDomain.set(domain, (perDomain.get(domain) ?? 0) + 1);
    if (selected.length === 6) break;
  }
  return groupEchoes(selected);
}
