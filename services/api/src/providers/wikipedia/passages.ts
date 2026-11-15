import { codePoints } from '../../../../../packages/contracts/src/index.js';
import { shortened } from '../../sources/evidence.js';

/** Passage picking from the reference app's SecondLook: about 500 characters each, cut to 600 when shown. */
export const PASSAGE = { chars: 500, maxChars: 600, perPage: 2 } as const;

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does', 'did',
  'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her', 'their', 'this', 'that', 'these', 'those',
  'not', 'no', 'only', 'than', 'then', 'so', 'very', 'also', 'about', 'into', 'over', 'more', 'most',
  'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how', 'can', 'could', 'will', 'would', 'there',
]);

const words = (text: string) => text.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Crude plural folding, enough for "hearts" to meet "heart" and "octopuses" to meet "octopus". */
export function stem(word: string): string {
  const length = codePoints(word).length;
  if (length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  for (const ending of ['ses', 'xes', 'zes', 'ches', 'shes']) {
    if (length > ending.length + 2 && word.endsWith(ending)) return word.slice(0, -2);
  }
  if (length > 3 && word.endsWith('s') && !['ss', 'us', 'is'].some(suffix => word.endsWith(suffix))) return word.slice(0, -1);
  return word;
}

/** The words a passage should share with the claim and its subject. */
export function passageTerms(claim: string, subject: string | null): Set<string> {
  return new Set(words(`${claim} ${subject ?? ''}`)
    .filter(word => !stopWords.has(word) && (codePoints(word).length > 2 || /^\p{N}/u.test(word))).map(stem));
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const sentences = (line: string) => {
  const found = [...segmenter.segment(line)].map(part => part.segment.trim()).filter(Boolean);
  return found.length ? found : [line];
};

/** Consecutive sentences grouped into passages of about `size` characters. Lines too short to be prose are skipped. */
export function passages(text: string, size: number = PASSAGE.chars): string[] {
  const prose = text.split(/\r?\n/).filter(line => line.split(' ').filter(Boolean).length >= 6);
  const out: string[] = [];
  let current = '';
  for (const line of prose) {
    for (const sentence of sentences(line)) {
      if (current && codePoints(current).length + codePoints(sentence).length + 1 > size) {
        out.push(current);
        current = '';
      }
      current += current ? ` ${sentence}` : sentence;
    }
    if (codePoints(current).length >= size / 2) {
      out.push(current);
      current = '';
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Up to `count` passages sharing the most terms with the claim, in page order, each cut to `maxChars`.
 * A passage needs at least two shared terms (or every term, for a claim with fewer).
 */
export function bestPassages(found: string[], terms: Set<string>, count: number = PASSAGE.perPage, maxChars: number = PASSAGE.maxChars): string[] {
  if (!terms.size) return [];
  const needed = Math.min(2, terms.size);
  return found.map((text, offset) => ({ text, offset, score: [...new Set(words(text).map(stem))].filter(word => terms.has(word)).length }))
    .filter(item => item.score >= needed)
    .sort((a, b) => b.score - a.score || a.offset - b.offset)
    .slice(0, count)
    .sort((a, b) => a.offset - b.offset)
    .map(item => shortened(item.text, maxChars));
}
