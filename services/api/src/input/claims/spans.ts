import { codePoints, sliceSpan, type SourceSpan } from '../../../../../packages/contracts/src/index.js';

/** `contentOf` marks the exact text after a leading hearsay or "According to X," frame: the id of the framed candidate. */
export type ClaimCandidate = { id: string; text: string; span: SourceSpan; contentOf?: string };

const conditional = /\b(if|unless|provided|assuming|hypothetically|imagine|suppose|only when|as long as|even when)\b/i;
const attribution = /\b(said|says|according to|quoted?|jok(?:e|ing))\b|\b(?:he|she|they|speaker|company)\s+claims?\b/i;
const scopedNegation = /\b(?:it\s+is\s+not\s+true\s+that|it\s+isn['’]t\s+true\s+that|it\s+is\s+false\s+that|not\s+the\s+case\s+that|there\s+is\s+no\s+evidence\s+that)\b/i;
/** "I heard (that)", "you heard (that)", "people say (that)", "they say (that)", "apparently", "According to X,". */
const leadingFrame = /^(?:(?:i|you|we)(?:['’]ve)?\s+heard(?:\s+that)?|(?:people|they)\s+say(?:\s+that)?|apparently,?|according\s+to\s+[^,]{2,60},)\s+/iu;
const MAX_CANDIDATES = 4;

/** Subspans are exact captured text: no normalization, referent guessing or semantic repair. */
export function generateCandidates(text: string): ClaimCandidate[] {
  const points = codePoints(text);
  const trim = (start: number, end: number): SourceSpan => {
    while (start < end && /\s/u.test(points[start])) start++;
    while (end > start && /\s/u.test(points[end - 1])) end--;
    return { start, end };
  };
  const whole = trim(0, points.length);
  const spans: SourceSpan[] = [whole];
  const contentOf = new Map<number, number>();
  /** Index of the added span, or -1 when it is empty, a duplicate or over the cap. */
  const add = (start: number, end: number): number => {
    const span = trim(start, end);
    if (span.end <= span.start || spans.length >= MAX_CANDIDATES || spans.some(s => s.start === span.start && s.end === span.end)) return -1;
    return spans.push(span) - 1;
  };
  // The exact content after a leading frame, so hearsay can be checked without its framing.
  const addFrameContent = (parent: number) => {
    const span = spans[parent];
    const match = leadingFrame.exec(sliceSpan(text, span));
    if (!match) return;
    const start = span.start + codePoints(match[0]).length;
    if (sliceSpan(text, trim(start, span.end)).split(/\s+/u).filter(Boolean).length < 2) return;
    const index = add(start, span.end);
    if (index >= 0) contentOf.set(index, parent);
  };
  const utf16ToPoint = (index: number) => codePoints(text.slice(0, index)).length;
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  if (sentences.length <= 1) addFrameContent(0);
  let straightQuoteOpen = false;
  let curlyQuoteOpen = false;
  for (const sentence of sentences) {
    if (spans.length >= MAX_CANDIDATES) break;
    const start = utf16ToPoint(sentence.index);
    const end = start + codePoints(sentence.segment).length;
    const containsQuote = /["“”]/u.test(sentence.segment);
    const insideQuoteAtStart = straightQuoteOpen || curlyQuoteOpen;
    for (const character of sentence.segment) {
      if (character === '"') straightQuoteOpen = !straightQuoteOpen;
      else if (character === '“') curlyQuoteOpen = true;
      else if (character === '”') curlyQuoteOpen = false;
    }
    const insideQuoteAtEnd = straightQuoteOpen || curlyQuoteOpen;
    const sentenceCutsQuote = insideQuoteAtStart || insideQuoteAtEnd;
    // Permit balanced local titles/names, but never extract a sentence whose
    // boundary falls inside a quotation spanning multiple sentences.
    if (sentences.length > 1 && !sentenceCutsQuote) {
      const index = add(start, end);
      if (index >= 0) addFrameContent(index);
    }
    // A sentence-level condition or quote may govern every clause: never detach it.
    if (conditional.test(sentence.segment) || scopedNegation.test(sentence.segment) || attribution.test(sentence.segment) || containsQuote || sentenceCutsQuote) continue;
    const separators = [...sentence.segment.matchAll(/;\s*|\s+(?:and|but)\s+/giu)];
    let localStart = 0;
    for (const separator of separators) {
      if (spans.length >= MAX_CANDIDATES) break;
      const separatorStart = separator.index;
      add(start + codePoints(sentence.segment.slice(0, localStart)).length, start + codePoints(sentence.segment.slice(0, separatorStart)).length);
      localStart = separatorStart + separator[0].length;
    }
    if (separators.length) add(start + codePoints(sentence.segment.slice(0, localStart)).length, end);
  }
  return spans.map((span, index) => {
    const parent = contentOf.get(index);
    return { id: `span_${index}`, text: sliceSpan(text, span), span, ...(parent === undefined ? {} : { contentOf: `span_${parent}` }) };
  });
}

const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
/** A run of digits with phone-style separators. Commas never appear in one, so "$2,500,000" is not a candidate. */
const digitRun = /(?<![\p{L}\p{N}])\+?\(?\d[\d \t().-]{5,}\d(?![\p{L}\p{N}])/gu;

function looksLikePhone(run: string): boolean {
  const digits = run.replace(/\D/gu, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (run.startsWith('+')) return digits.length >= 8;
  const groups = run.split(/[\s().-]+/u).filter(Boolean);
  if (groups.length < 2 || (groups.length < 3 && !run.includes('('))) return false;
  // Dates: 2026-11-14, 14.11.2026, 11/14/2026.
  if (/^\d{4}-\d{1,2}-\d{1,2}$/u.test(run) || /^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/u.test(run)) return false;
  // Thousands written with spaces or dots: 10 000 000, 1.500.000.
  if (!/[()-]/u.test(run) && /^[1-9]\d{0,2}$/u.test(groups[0]) && groups.slice(1).every(group => group.length === 3)) return false;
  // A list of years: 1999 2000 2001.
  if (groups.every(group => /^(?:1[5-9]|20)\d\d$/u.test(group))) return false;
  return true;
}

/** An email address or a phone number. These never reach any search, whatever Jev says. */
export function containsContactData(text: string): boolean {
  if (email.test(text)) return true;
  return [...text.matchAll(digitRun)].some(match => looksLikePhone(match[0].trim()));
}

const firstPersonPrivate = /\b(my (?:salary|income|address|phone number|diagnosis|password|social security)|i (?:feel|felt|visited|was diagnosed)|my (?:wife|husband|child|doctor))\b/i;

/** Deliberately small privacy backstop; whether something is a claim at all is Jev's call. */
export function deterministicIssue(text: string): 'private_data' | null {
  const trimmed = text.trim();
  return containsContactData(trimmed) || firstPersonPrivate.test(trimmed) ? 'private_data' : null;
}
