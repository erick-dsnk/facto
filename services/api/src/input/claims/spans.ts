import { codePoints, sliceSpan, type SourceSpan } from '../../../../../packages/contracts/src/index.js';

export type ClaimCandidate = { id: string; text: string; span: SourceSpan };

const conditional = /\b(if|unless|provided|assuming|hypothetically|imagine|suppose|only when|as long as|even when)\b/i;
const attribution = /\b(said|says|according to|quoted?|jok(?:e|ing))\b|\b(?:he|she|they|speaker|company)\s+claims?\b/i;
const scopedNegation = /\b(?:it\s+is\s+not\s+true\s+that|it\s+isn['’]t\s+true\s+that|it\s+is\s+false\s+that|not\s+the\s+case\s+that|there\s+is\s+no\s+evidence\s+that)\b/i;

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
  const add = (start: number, end: number) => {
    const span = trim(start, end);
    if (span.end > span.start && !spans.some(s => s.start === span.start && s.end === span.end)) spans.push(span);
  };
  const utf16ToPoint = (index: number) => codePoints(text.slice(0, index)).length;
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  let straightQuoteOpen = false;
  let curlyQuoteOpen = false;
  for (const sentence of sentences) {
    if (spans.length >= 4) break;
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
    if (sentences.length > 1 && !sentenceCutsQuote) add(start, end);
    // A sentence-level condition or quote may govern every clause: never detach it.
    if (conditional.test(sentence.segment) || scopedNegation.test(sentence.segment) || attribution.test(sentence.segment) || containsQuote || sentenceCutsQuote) continue;
    const separators = [...sentence.segment.matchAll(/;\s*|\s+(?:and|but)\s+/giu)];
    let localStart = 0;
    for (const separator of separators) {
      if (spans.length >= 4) break;
      const separatorStart = separator.index;
      add(start + codePoints(sentence.segment.slice(0, localStart)).length, start + codePoints(sentence.segment.slice(0, separatorStart)).length);
      localStart = separatorStart + separator[0].length;
    }
    if (separators.length && spans.length < 4) add(start + codePoints(sentence.segment.slice(0, localStart)).length, end);
  }
  return spans.slice(0, 4).map((span, index) => ({ id: `span_${index}`, text: sliceSpan(text, span), span }));
}

/** Deliberately small backstops; semantic eligibility still requires validated Jev answers. */
export function deterministicIssue(text: string): 'incomplete' | 'private_data' | 'nonliteral' | null {
  const trimmed = text.trim();
  if (/\b(my (?:salary|income|address|phone number|diagnosis|password|social security)|i (?:feel|felt|visited|was diagnosed)|my (?:wife|husband|child|doctor))\b/i.test(trimmed) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(trimmed)) return 'private_data';
  if (attribution.test(trimmed) || /\b(?:imagine|hypothetically|suppose|just kidding)\b/i.test(trimmed)) return 'nonliteral';
  if (trimmed.split(/\s+/u).length < 3 || /^(?:he|she|it|they|this|that|these|those|and|but|because)\b/i.test(trimmed)) return 'incomplete';
  // Existential “there are” states a proposition; locative “there” still needs a referent.
  if (/^there\b/i.test(trimmed) && !/^there(?:['’](?:s|re|ve)|\s+(?:(?:is|are|was|were)(?:n['’]t)?|has\s+been|have\s+been|exists?|remain(?:s|ed)?))\b/i.test(trimmed)) return 'incomplete';
  if (/(?:\b(?:and|but|if|because|of|to|than|is|are|was|were|has|have)|[,;:—-])\s*$/i.test(trimmed)) return 'incomplete';
  if (/^(?:unemployment|inflation|the rate|the population)\s+(?:is|was|rose|fell)\s+\d[\d.,]*%?\.?$/i.test(trimmed)) return 'incomplete';
  return null;
}
