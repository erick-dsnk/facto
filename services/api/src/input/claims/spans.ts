import { codePoints, sliceSpan, type SourceSpan } from '../../../../../packages/contracts/src/index.js';

/**
 * `contentOf` marks the exact text after a leading hearsay, question, belief or "According to X," frame, or before a trailing
 * tag question ("X, right?"): the id of the framed candidate.
 * `asked` marks content passed on as a question ("Have you heard that X?", "X, right?"), whose trailing "?" is left out.
 * `hedged` marks content the speaker only believes ("I'm pretty sure X", "I think X"): X is what gets checked.
 */
export type ClaimCandidate = { id: string; text: string; span: SourceSpan; contentOf?: string; asked?: true; hedged?: true };

const conditional = /\b(if|unless|provided|assuming|hypothetically|imagine|suppose|only when|as long as|even when)\b/i;
const attribution = /\b(said|says|according to|quoted?|jok(?:e|ing))\b|\b(?:he|she|they|speaker|company)\s+claims?\b/i;
const scopedNegation = /\b(?:it\s+is\s+not\s+true\s+that|it\s+isn['’]t\s+true\s+that|it\s+is\s+false\s+that|not\s+the\s+case\s+that|there\s+is\s+no\s+evidence\s+that)\b/i;
/** Spoken filler before a frame: "So", "Yeah,", "Hey guys,", "Bro,", "I mean". */
const frameFiller = String.raw`(?:(?:so|yeah|yes|yep|oh|hey|yo|well|and|but|okay|ok|um|uh|wait|look|listen|guys|bro|bruh|dude|man|mate|like|i\s+mean|by\s+the\s+way|actually)[,.!]?\s+)*`;
const you = String.raw`you(?:\s+guys|\s+all|\s+two)?`;
/**
 * A claim passed on as a question: "Have you heard/seen/read (that)", "Did you hear/see/read/know (that)", "Do you know/realise that",
 * "You know that", "Are you aware (that)", "Can/Would you believe (that)", "Is it true/right/real (that)", "Isn't it crazy/wild (that)",
 * "Wasn't it true that", "Did they announce/confirm (that)".
 */
const questionFrame = [
  String.raw`(?:have|did)\s+${you}\s+(?:heard?|see|seen|read|notice|noticed)(?:\s+that)?`,
  String.raw`(?:did|do)\s+${you}\s+(?:know|reali[sz]e)(?:\s+that)?`,
  String.raw`you\s+know\s+that`,
  String.raw`(?:are|were)\s+${you}\s+aware(?:\s+that)?`,
  String.raw`(?:can|would|could)\s+${you}\s+believe(?:\s+that)?`,
  String.raw`(?:is|isn['’]t|wasn['’]t)\s+it\s+(?:actually\s+|really\s+)?(?:true|right|correct|real|a\s+fact|crazy|wild|insane|funny|weird|amazing|interesting|nuts)(?:\s+that)?`,
  String.raw`did\s+(?:they|he|she|it)\s+(?:really\s+)?(?:say|announce|confirm|admit)(?:\s+that)?`,
].join('|');
/** What the speaker only believes: "I think (that)", "I believe", "I'm pretty sure (that)", "I swear", "I feel like", "I bet you didn't know (that)". */
const beliefFrame = [
  String.raw`i\s+(?:really\s+)?(?:think|believe|guess|reckon|swear|suspect|assume)(?:\s+that)?`,
  String.raw`i\s+feel\s+like`,
  String.raw`i['’]?m\s+(?:pretty\s+|fairly\s+|quite\s+|almost\s+|100%\s+)?(?:sure|certain|positive|convinced)(?:\s+that)?`,
  String.raw`(?:i\s+)?bet\s+${you}\s+didn['’]t\s+know(?:\s+that)?`,
].join('|');
/**
 * Hearsay and reported facts: "I heard/read/saw (that)", "I've (just) heard", "you heard (that)", "people/they/everyone say(s) (that)",
 * "someone/my friend told me (that)", "I was told (that)", "rumour has it (that)", "word is (that)", "turns out (that)",
 * "fun fact:", "apparently", "supposedly", "reportedly", "allegedly", "the news said (that)", "studies show (that)", "According to X,".
 */
const statementFrame = [
  String.raw`(?:i|you|we)(?:['’]ve|\s+have)?(?:\s+just|\s+recently)?\s+(?:heard|read|saw|seen)(?:\s+somewhere)?(?:\s+that)?`,
  String.raw`(?:people|they|everyone|everybody|folks)\s+(?:say|says|said|are\s+saying|keep\s+saying|know|knows)(?:\s+that)?`,
  String.raw`(?:someone|somebody|a\s+friend|my\s+\p{L}+)\s+(?:told|showed)\s+me(?:\s+that)?`,
  String.raw`i\s+was\s+told(?:\s+that)?`,
  String.raw`rumou?r\s+(?:has\s+it|is)(?:\s+that)?`,
  String.raw`word\s+is(?:\s+that)?`,
  String.raw`(?:it\s+)?turns\s+out(?:\s+that)?`,
  String.raw`fun\s+fact[:,]?(?:\s+that)?`,
  String.raw`(?:apparently|supposedly|reportedly|allegedly|evidently),?`,
  String.raw`(?:the\s+)?news\s+(?:says|said)(?:\s+that)?|it\s+was\s+on\s+the\s+news(?:\s+that)?`,
  String.raw`(?:studies|research|science|scientists|experts|doctors)\s+(?:show|shows|showed|say|says|said|found|prove|proved)(?:\s+that)?`,
  String.raw`according\s+to\s+[^,]{2,60},`,
].join('|');
/** A frame followed by content. "Did you know what…", "Have you heard about…" and "Is it true if…" ask a real question: no content. */
const leadingFrame = new RegExp(String.raw`^${frameFiller}(?:(${questionFrame})|(${beliefFrame})|${statementFrame})\s+(?!(?:what|who|whom|whose|where|when|why|how|which|if|whether|about|of)\b)`, 'iu');
/** A statement turned into a question by a tag: "Opus 5.5 is out, right?", "…, isn't it?", "…, no?". The content is the statement. */
const trailingTag = /^(.*?\S)[\s,]+(?:right|isn['’]t\s+it|aren['’]t\s+they|wasn['’]t\s+it|weren['’]t\s+they|don['’]t\s+they|doesn['’]t\s+it|didn['’]t\s+(?:they|it|he|she)|no|yeah|correct|true|huh|eh|you\s+know)\s*\?+\s*$/iu;
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
  const asked = new Set<number>();
  const hedged = new Set<number>();
  /** Index of the added span, or -1 when it is empty, a duplicate or over the cap. */
  const add = (start: number, end: number): number => {
    const span = trim(start, end);
    if (span.end <= span.start || spans.length >= MAX_CANDIDATES || spans.some(s => s.start === span.start && s.end === span.end)) return -1;
    return spans.push(span) - 1;
  };
  // The exact content after a leading frame, so hearsay and a claim passed on as a question can be checked without the framing.
  const addFrameContent = (parent: number) => {
    const span = spans[parent];
    const match = leadingFrame.exec(sliceSpan(text, span));
    if (!match) return;
    const start = span.start + codePoints(match[0]).length;
    // "Have you heard that X?" and "You heard that X?" pass X on as a question: the content is the statement, without its "?".
    const question = match[1] !== undefined || points[span.end - 1] === '?';
    let end = span.end;
    while (end > start && /[?\s]/u.test(points[end - 1])) end--;
    const words = sliceSpan(text, trim(start, end)).split(/\s+/u).filter(Boolean);
    if (words.length < 2) return;
    // "Have you seen my keys?", "Did you read the news?": a short object, not a claim.
    if (words.length < 3 && /^(?:my|your|his|her|our|their|this|that|these|those|the|a|an|it|me|him|them|us)$/iu.test(words[0])) return;
    // "I've heard this sentence so many times", "I heard it on the news", "My dad told me so": what follows is an object, not a claim.
    // Passed on as hearsay it came back as Speculation and alerted (15 Nov).
    // With an explicit "that" ("I heard that it opened in 1889"), a pronoun starts a real clause.
    if (!/\bthat\s*$/iu.test(match[0]) && /^(?:this|these|those|it|him|her|them|you|me|us|so|such)$/iu.test(words[0].replace(/[^\p{L}]/gu, ''))) return;
    const index = add(start, end);
    if (index < 0) return;
    contentOf.set(index, parent);
    if (question) asked.add(index);
    if (match[2] !== undefined) hedged.add(index);
    // "Have you heard that X, right?": the tag comes off the content too (its "?" was already left out).
    addTagContent(index, parent, question);
  };
  // The statement before a trailing tag question, as exact text. Its parent stays the sentence the speaker said.
  const addTagContent = (from: number, parent: number, markRemoved = false) => {
    const span = spans[from];
    const match = trailingTag.exec(sliceSpan(text, span) + (markRemoved ? '?' : ''));
    if (!match || match[1].split(/\s+/u).filter(Boolean).length < 3) return;
    const index = add(span.start, span.start + codePoints(match[1]).length);
    if (index < 0) return;
    contentOf.set(index, parent);
    asked.add(index);
    if (hedged.has(from)) hedged.add(index);
  };
  const utf16ToPoint = (index: number) => codePoints(text.slice(0, index)).length;
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  if (sentences.length <= 1) {
    addFrameContent(0);
    addTagContent(0, 0);
  }
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
      if (index >= 0) {
        addFrameContent(index);
        addTagContent(index, index);
      }
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
    return { id: `span_${index}`, text: sliceSpan(text, span), span, ...(parent === undefined ? {} : { contentOf: `span_${parent}` }), ...(asked.has(index) ? { asked: true as const } : {}),
      ...(hedged.has(index) ? { hedged: true as const } : {}) };
  });
}

const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
/** A spoken or obfuscated address: "jane at example dot com", "jane (at) example [dot] org". */
const spokenEmail = /\b[\p{L}\p{N}._%+-]+\s*(?:\bat\b|\(at\)|\[at\])\s*([\p{L}\p{N}-]+)\s*(?:\bdot\b|\(dot\)|\[dot\])\s*(?:com|org|net|edu|gov|io|co|uk|de|fi|fr|eu|me|info|ai)\b/giu;
/** Words that make "at X dot com" ordinary speech ("the dot com bubble"), not an address. */
const NOT_A_MAIL_DOMAIN = new Set(['the', 'a', 'an', 'that', 'this', 'its', 'his', 'her', 'their', 'our', 'your', 'my', 'least', 'most', 'first', 'last']);
/** A run of digits with phone-style separators. Commas never appear in one, so "$2,500,000" is not a candidate. */
const digitRun = /(?<![\p{L}\p{N}])\+?\(?\d[\d \t().-]{5,}\d(?![\p{L}\p{N}])/gu;
/** An amount or a count, not a number to call: a currency before it or a unit or counted noun after it. */
const currencyBefore = /(?:[$€£¥₹]|\b(?:usd|eur|gbp|jpy|chf|sek|nok|dkk))\s*$/iu;
const quantityAfter = /^\s*(?:[%‰]|(?:dollars?|euros?|pounds?|yen|yuan|rupees?|people|persons|users|views|visitors|subscribers|followers|downloads|copies|units|items|cases|deaths|votes|years?|days?|hours?|seconds?|kilometres?|kilometers?|km|miles?|metres?|meters?|tons?|tonnes?|kg|bytes?|digits?|times|cells|stars|galaxies|atoms|molecules|bacteria)\b)/iu;
const isbnBefore = /\bISBN(?:-1[03])?:?\s*$/iu;

function looksLikePhone(run: string, before: string, after: string): boolean {
  const digits = run.replace(/\D/gu, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (run.startsWith('+')) return digits.length >= 8;
  const groups = run.split(/[\s().-]+/u).filter(Boolean);
  // ISBNs: "ISBN 978-3-16-148410-0", or 13 digits starting 978/979 in four or five hyphenated groups.
  if (isbnBefore.test(before) || (digits.length === 13 && /^97[89]/u.test(digits) && /^\d+(?:-\d+){3,4}$/u.test(run))) return false;
  // An unseparated 10 to 15 digit run is a phone number unless it reads as an amount or a count.
  if (groups.length === 1) return digits.length >= 10 && !currencyBefore.test(before) && !quantityAfter.test(after);
  // A local number: 555-1234, 555 1234.
  if (groups.length === 2 && /^\d{3}[\s-]\d{4}$/u.test(run)) return true;
  if (groups.length < 3 && !run.includes('(')) return false;
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
  if ([...text.matchAll(spokenEmail)].some(match => !NOT_A_MAIL_DOMAIN.has(match[1].toLocaleLowerCase('en')))) return true;
  return [...text.matchAll(digitRun)].some(match => {
    const run = match[0].trim();
    const start = match.index + match[0].indexOf(run);
    return looksLikePhone(run, text.slice(0, start), text.slice(start + run.length));
  });
}

const firstPersonPrivate = /\b(my (?:salary|income|address|phone number|diagnosis|password|social security)|i (?:feel|felt|visited|was diagnosed)|my (?:wife|husband|child|doctor))\b/i;

/** Deliberately small privacy backstop; whether something is a claim at all is Jev's call. */
export function deterministicIssue(text: string): 'private_data' | null {
  const trimmed = text.trim();
  return containsContactData(trimmed) || firstPersonPrivate.test(trimmed) ? 'private_data' : null;
}
