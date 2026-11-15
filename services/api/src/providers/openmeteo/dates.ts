/**
 * Dates in a weather sentence (port of the reference app's ClaimDates), relative ones ("toward the end of the
 * week", "yesterday", "this weekend") resolved against the check date. Days are UTC midnights; weeks run
 * Monday to Sunday.
 */
export type DayRange = { start: Date; end: Date };
export const WEATHER_MAX_DAYS = 16;

const DAY_MS = 86_400_000;
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
export const dayCount = (range: DayRange) => Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS) + 1;
/** The UTC midnight of a `YYYY-MM-DD` check date. */
export const startOfDay = (asOf: string) => new Date(`${asOf}T00:00:00Z`);

type Tense = 'past' | 'future' | 'neutral';
const has = (lower: string, pattern: string) => new RegExp(`\\b(?:${pattern})\\b`).test(lower);

/** Future wins over past: "it will be colder than last week" is about the coming days. */
export function tense(lower: string): Tense {
  if (has(lower, "will|won't|shall|expected|forecast|forecasts|predicted|is set to|are set to|going to|coming|upcoming|next|later|rolling|on the way|approaching|ahead")) return 'future';
  if (has(lower, 'was|were|had|fell|fallen|hit|saw|recorded|reached|dropped|rose|brought|blanketed|covered|struck|swept|last|ago|yesterday|did')) return 'past';
  // "rained", "snowed", "poured": a verb in the past.
  if (/\b(?!(?:expected|predicted|forecasted|scheduled|named|called)\b)[a-z]{3,}ed\b/.test(lower)) return 'past';
  return 'neutral';
}

const numberWords: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** N in "next 5 days" or "the past three days". */
function count(lower: string, after: string, before: string): number | null {
  const found = new RegExp(`\\b${after} (\\d{1,2}|two|three|four|five|six|seven|eight|nine|ten) ${before}\\b`).exec(lower);
  return found ? (numberWords[found[1]] ?? Number(found[1])) : null;
}

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** A weekday name, Monday 0, and "next", "last" or "this" before it. */
function weekday(lower: string): { index: number; modifier: string | null } | null {
  const found = /\b(?:(next|last|this|on) )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.exec(lower);
  if (!found) return null;
  return { index: weekdays.indexOf(found[2]), modifier: found[1] && found[1] !== 'on' ? found[1] : null };
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthToken = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?';
const monthIndex = (token: string) => months.findIndex(name => name.startsWith(token.replace('.', '').slice(0, 3)));

/**
 * Dates written out: "12 November", "Feb 28, 2018", "2018-02-28", "from 26 February to 2 March 2018". Only
 * a month name with a day number or an ISO date counts, so "at 5 pm" is left alone. A date without a year
 * borrows the year of a later date in the sentence, else takes the year that puts it nearest the check date.
 */
export function absoluteDates(text: string, today: Date): DayRange | null {
  const lower = text.toLowerCase();
  const found: { index: number; month: number; day: number; year: number | null }[] = [];
  for (const match of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    found.push({ index: match.index, year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) });
  }
  for (const match of lower.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${monthToken}(?:,? (\\d{4}))?\\b`, 'g'))) {
    found.push({ index: match.index, day: Number(match[1]), month: monthIndex(match[2]), year: match[3] ? Number(match[3]) : null });
  }
  for (const match of lower.matchAll(new RegExp(`\\b${monthToken} (\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`, 'g'))) {
    found.push({ index: match.index, day: Number(match[2]), month: monthIndex(match[1]), year: match[3] ? Number(match[3]) : null });
  }
  found.sort((a, b) => a.index - b.index);
  const days: Date[] = [];
  for (const [position, item] of found.entries()) {
    if (item.month < 0 || item.day < 1 || item.day > 31) continue;
    let year = item.year ?? found.slice(position + 1).find(later => later.year !== null)?.year ?? null;
    if (year === null) {
      const candidates = [-1, 0, 1].map(offset => new Date(Date.UTC(today.getUTCFullYear() + offset, item.month, item.day)));
      year = candidates.reduce((best, date) => Math.abs(date.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime()) ? date : best).getUTCFullYear();
    }
    const date = new Date(Date.UTC(year, item.month, item.day));
    if (date.getUTCMonth() !== item.month || date.getUTCDate() !== item.day) continue;
    days.push(date);
  }
  if (!days.length) return null;
  const times = days.map(day => day.getTime());
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}

/** The days a weather sentence is about, or null when it names none or more than 16. */
export function claimDates(text: string, today: Date): DayRange | null {
  const lower = ` ${text.toLowerCase().replaceAll('’', "'")} `;
  const span = (a: number, b: number): DayRange => ({ start: addDays(today, Math.min(a, b)), end: addDays(today, Math.max(a, b)) });
  const is = (pattern: string) => has(lower, pattern);
  // Monday 0 ... Sunday 6.
  const wd = (today.getUTCDay() + 6) % 7;
  const when = tense(lower);
  let found: DayRange | null = absoluteDates(text, today);
  if (found) { /* written-out dates win */ }
  else if (is('the day after tomorrow')) found = span(2, 2);
  else if (is('tomorrow')) found = span(1, 1);
  else if (is('the day before yesterday')) found = span(-2, -2);
  else if (is('yesterday')) found = span(-1, -1);
  else if (is('last night') || (is('overnight') && when !== 'future')) found = span(-1, 0);
  else if (is('overnight')) found = span(0, 1);
  else if (is('today|tonight|this morning|this afternoon|this evening|right now|currently|at the moment|now')) found = span(0, 0);
  else if (is('end of next week|later next week|late next week')) found = span(7 - wd + 3, 7 - wd + 6);
  else if (is('early next week|start of next week|beginning of next week')) found = span(7 - wd, 7 - wd + 2);
  else if (is('towards? the end of (?:the|this) week|(?:by|at|near|around) the end of (?:the|this) week|end of the week|later (?:this|in the) week|late (?:this|in the) week')) {
    if (is('later (?:this|in the) week')) found = span(Math.min(1, 6 - wd), 6 - wd);
    else found = wd <= 3 ? span(3 - wd, 6 - wd) : span(0, 6 - wd);
  }
  else if (is('next weekend')) found = span(7 - wd + 5, 7 - wd + 6);
  else if (is('last weekend|past weekend')) found = span(5 - wd - 7, 6 - wd - 7);
  else if (is('this weekend|the weekend')) found = when === 'past' && !is('this weekend') ? span(5 - wd - 7, 6 - wd - 7) : span(5 - wd, 6 - wd);
  else if (is('next week|the coming week|the week ahead')) found = span(7 - wd, 7 - wd + 6);
  else if (is('last week|past week')) found = span(-wd - 7, -wd - 1);
  else if (is('early this week|start of the week|beginning of the week')) found = span(-wd, 2 - wd);
  else if (is('this week')) found = span(-wd, 6 - wd);
  else {
    const ahead = count(lower, '(?:next|coming)', 'days');
    const behind = count(lower, '(?:past|last)', 'days');
    const day = weekday(lower);
    if (ahead !== null && ahead >= 1) found = span(0, ahead - 1);
    else if (is('in the coming days|over the next few days|the next few days|the coming days|the days ahead|next few days')) found = span(0, 3);
    else if (behind !== null && behind >= 1) found = span(-behind, -1);
    else if (day) {
      const delta = (day.index - wd + 7) % 7;
      if (day.modifier === 'next') found = span(delta === 0 ? 7 : delta, delta === 0 ? 7 : delta);
      else if (day.modifier === 'last') found = span(delta === 0 ? -7 : delta - 7, delta === 0 ? -7 : delta - 7);
      else if (day.modifier === 'this') found = span(day.index - wd, day.index - wd);
      else {
        const back = delta === 0 ? 0 : delta - 7;
        found = when === 'past' ? span(back, back) : span(delta, delta);
      }
    }
  }
  return found && dayCount(found) <= WEATHER_MAX_DAYS ? found : null;
}
