import nlp from 'compromise';
import { codePoints, type SourceSpan, type TextInput } from '../../../../../packages/contracts/src/index.js';

// Names come from compromise (MIT, runs locally, no network). Jev only ever chooses among them.

/** Organizations compromise does not know. Add a name here when a demo subject goes missing. */
const ORGANIZATIONS: Record<string, string> = { anthropic: 'Organization', meta: 'Organization', nvidia: 'Organization', openai: 'Organization', facto: 'Organization' };
const NAME_TAGS = ['ProperNoun', 'Person', 'Place', 'Organization'];
const LEXICON_NAME_TAGS = /Name|Person|Place|City|Country|Region|Organization|Company|Honorific/;
const NOT_NAME_TAGS = ['Pronoun', 'Determiner', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'QuestionWord', 'Expression', 'Value'];
/** Lowercase words that may sit inside a name: "Bank of England", "Ludwig van Beethoven". */
const CONNECTORS = new Set(['of', 'the', 'de', 'du', 'da', 'del', 'der', 'von', 'van', 'al', 'bin', 'la', 'le']);
const BREAK_AFTER = /[,.;:!?()[\]{}"“”‘|/]/u;
const BREAK_BEFORE = /[([{"“‘]/u;
const MAX_NAME_CODE_POINTS = 120;

type Term = { text: string; pre: string; post: string; tags: string[]; offset: { start: number; length: number } };
const lexicon = (nlp as unknown as { model(): { one: { lexicon: Record<string, string | string[]> } } }).model().one.lexicon;

/** "EIFFEL TOWER" reads as "Eiffel Tower" to the tagger; single acronyms such as "NASA" stay as they are. */
function titleCaseShouting(text: string): string {
  return text.replace(/\b\p{Lu}[\p{Lu}'’-]+(?:\s+\p{Lu}[\p{Lu}'’-]+)+\b/gu, run => {
    const cased = run.replace(/\p{Lu}+/gu, word => word[0] + word.slice(1).toLowerCase());
    return cased.length === run.length ? cased : run;
  });
}

function isNameWord(term: Term, surface: string, sentenceStart: boolean): boolean {
  if (!/^\p{Lu}/u.test(surface)) return false;
  const tags = new Set(term.tags);
  const named = NAME_TAGS.some(tag => tags.has(tag));
  if (named) return !tags.has('Pronoun') && !tags.has('Determiner');
  if (!tags.has('Noun') || tags.has('Acronym') || NOT_NAME_TAGS.some(tag => tags.has(tag))) return false;
  if (!sentenceStart) return true;
  // A capitalized first word is a name only if it is not a known common word: "Kushner said", not "Water boils" or "Bats are".
  if (tags.has('Plural')) return false;
  const known = lexicon[surface.toLowerCase()];
  return known === undefined || LEXICON_NAME_TAGS.test(String(known));
}

function cleanName(name: string): string {
  const bare = name.replace(/\s+/gu, ' ').replace(/['’]s$/u, '').replace(/[^\p{L}\p{N}.]+$/u, '');
  return /(?:^|[\s.])\p{L}\.$/u.test(bare) ? bare : bare.replace(/\.+$/u, '');
}

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Drops repeats and merges a shorter name into a longer one that contains its words ("Einstein" into "Albert Einstein"). */
function mergeNames(names: string[]): string[] {
  const result: string[] = [];
  for (const name of names) {
    const nameWords = new Set(words(name));
    if (!nameWords.size || codePoints(name).length > MAX_NAME_CODE_POINTS) continue;
    if (result.some(existing => [...nameWords].every(word => words(existing).includes(word)))) continue;
    const shorter = result.flatMap((existing, index) => words(existing).every(word => nameWords.has(word)) ? [index] : []);
    if (shorter.length) {
      for (const index of shorter.slice(1).reverse()) result.splice(index, 1);
      result[shorter[0]] = name;
    } else result.push(name);
  }
  return result;
}

/** Named people, places and organizations in `text`, in order, as written in it. */
export function namedEntities(text: string): string[] {
  const analysis = titleCaseShouting(text);
  const sentences = nlp(analysis, ORGANIZATIONS).json({ offset: true }) as { terms: Term[] }[];
  const surface = (term: Term) => text.slice(term.offset.start, term.offset.start + term.offset.length);
  const names: string[] = [];
  for (const sentence of sentences) {
    let run: Term[] = [];
    let connectors: Term[] = [];
    const flush = () => {
      if (run.length) names.push(text.slice(run[0].offset.start, run.at(-1)!.offset.start + run.at(-1)!.offset.length));
      run = []; connectors = [];
    };
    sentence.terms.forEach((term, index) => {
      const written = surface(term);
      if (BREAK_BEFORE.test(term.pre)) flush();
      if (isNameWord(term, written, index === 0)) {
        run.push(...connectors, term);
        connectors = [];
      } else if (run.length && CONNECTORS.has(written.toLowerCase())) connectors.push(term);
      else flush();
      if (BREAK_AFTER.test(term.post) || /['’]s$/u.test(written)) flush();
    });
    flush();
  }
  return mergeNames(names.map(cleanName));
}

const stripSpeaker = (line: string) => line.replace(/^Speaker \d+:\s*/u, '');

/**
 * Who or what a candidate might be about. A photo offers the rest of its OCR text first, in reading order; spoken and typed
 * input offer the earlier sentences of the same input, nearest first. Then come the context lines, nearest first.
 * Names whose words all occur in the candidate are left out; it already names them.
 */
export function subjectCandidates(input: TextInput, span: SourceSpan, limit = 8): string[] {
  const points = codePoints(input.text);
  const before = points.slice(0, span.start).join('');
  const ordered: string[] = input.mode === 'ocr'
    ? [...namedEntities(before), ...namedEntities(points.slice(span.end).join(''))]
    : namedEntities(before).reverse();
  for (const line of [...input.context].reverse()) ordered.push(...namedEntities(stripSpeaker(line)).reverse());
  const spanWords = new Set(words(points.slice(span.start, span.end).join('')));
  return mergeNames(ordered.filter(name => !words(name).every(word => spanWords.has(word)))).slice(0, limit);
}

/** Possible speakers or outlets of a candidate: X from a leading "According to X," first, then the names inside it. */
export function sourceNameCandidates(text: string, limit = 6): string[] {
  const according = /^\s*according\s+to\s+([^,]{2,60}),/iu.exec(text)?.[1]?.trim().replace(/^the\s+/u, '');
  return mergeNames([...(according ? [according] : []), ...namedEntities(text)]).slice(0, limit);
}
