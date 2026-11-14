/** Which subject to look up on Wikidata, and whether a name appears in the claim (port of WikidataLookup). */

/** Names never longer than this many words go to Wikidata, so a Title Case headline is never sent whole. */
export const MAX_NAME_WORDS = 4;

/** Capitalized words that open a sentence but name nothing. */
const leading = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'From', 'With', 'It', 'Its', 'This', 'That', 'These', 'Those',
  'There', 'He', 'She', 'They', 'His', 'Her', 'Their', 'When', 'After', 'Before', 'Since', 'During', 'Today',
]);

const wordCount = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
const capitalizedRun = /\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+(?:(?:of|de|del|da|du|von|van|la|le|the|and)\s+)?\p{Lu}[\p{L}\p{M}'’.-]*)*/gu;

/** Where the item's name must appear: the claim, and the subject Jev chose for it when there is one. */
export const guardTexts = (text: string, subject: string | null): string[] => subject ? [text, subject] : [text];

/**
 * The subject Jev chose first (the claim refers to it without naming it), then short capitalized runs of
 * words that do not make up most of the claim: "Mount Kilimanjaro", "Lake Baikal".
 */
export function wikidataSubjects(text: string, subject: string | null): string[] {
  const out: string[] = [];
  if (subject?.trim()) out.push(subject.trim());
  const claimWords = wordCount(text);
  const fits = (name: string) => {
    const n = wordCount(name);
    return Array.from(name).length >= 2 && n >= 1 && n <= MAX_NAME_WORDS && n <= claimWords * 0.6 && !out.includes(name);
  };
  for (const match of text.matchAll(capitalizedRun)) {
    const words = match[0].split(' ').filter(Boolean);
    while (words.length && leading.has(words[0])) words.shift();
    const name = words.join(' ').replace(/^[.’'-]+|[.’'-]+$/gu, '');
    if (fits(name)) out.push(name);
  }
  return out;
}

/** Case- and accent-insensitive form, with a curly apostrophe read as a straight one. */
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replaceAll('’', "'");

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Whether any of `names` appears as whole words in one of `texts`, ignoring case and accents. */
export function mentions(names: string[], texts: string[]): boolean {
  const folded = texts.map(fold);
  return names.some(name => {
    const n = fold(name);
    if (Array.from(n).length < 2) return false;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, 'u');
    return folded.some(text => pattern.test(text));
  });
}
