import { CALCULATION_URL, type Evidence } from '../../../../../packages/contracts/src/index.js';
import { freeEvidence } from '../../sources/evidence.js';

/**
 * Claims that can be worked out on the server with no network (port of the reference app's Calculation):
 * unit conversions, percentages, simple arithmetic, the weekday of a date and spans between years or dates.
 * The grammar is small and strict: the whole sentence must be one of the forms below, apart from a hedge
 * such as "about" before the claimed result. The evidence states what the calculation gives; Jev still
 * judges the claim against it.
 */
export const CALCULATION_PUBLISHER = 'Calculated by Facto';
/** Ends every calculated evidence sentence. */
export const CALCULATION_MARK = ' (calculated)';

/** The evidence for `text`, or null when it is not a calculation this grammar reads cleanly. */
export function calculationEvidence(text: string, now: Date, retrievedAt: string): Evidence | null {
  const sentence = calculationResult(text, now);
  return sentence === null ? null : freeEvidence({ origin: 'calculation', url: CALCULATION_URL, title: 'Calculation',
    publisher: CALCULATION_PUBLISHER, excerpt: sentence + CALCULATION_MARK, retrievedAt, sourceGroup: 'calculation' });
}

/** The calculated sentence without the "(calculated)" mark, or null. `now` decides "ago", "was" and "will be". */
export function calculationResult(text: string, now: Date): string | null {
  const s = normalize(text);
  if (!s || Array.from(s).length > 160) return null;
  return arithmetic(s) ?? percent(s) ?? conversion(s) ?? weekday(s, now) ?? span(s, now);
}

/** Lowercase, one space between words, no thousands separators, no closing full stop, "%" as "percent". */
export function normalize(text: string): string {
  let s = text.toLowerCase().trim();
  while (s.endsWith('.') || s.endsWith('!')) s = s.slice(0, -1);
  s = s.replaceAll('−', '-').replaceAll('–', '-').replaceAll('’', "'");
  // 5,280 and 1,716,961, but not "1, 2".
  for (let previous = ''; previous !== s;) { previous = s; s = s.replace(/(\d),(\d{3})(?!\d)/, '$1$2'); }
  s = s.replaceAll('per cent', 'percent').replace(/(\d)\s*%/g, '$1 percent');
  return s.split(/\s+/).filter(Boolean).join(' ');
}

const number = String.raw`(-?\d+(?:\.\d+)?)`;
/** Words that may stand before the claimed result. The evidence gives the exact figure; Jev weighs the hedge. */
const hedge = String.raw`(?:(?:about|approximately|roughly|around|nearly|almost|exactly|precisely|just over|just under|over|under|more than|less than|close to|some) )?`;

/** The capture groups of `pattern` matched against all of `s`, or null. */
function match(pattern: string, s: string): string[] | null {
  const found = new RegExp(`^${pattern}$`).exec(s);
  return found ? found.slice(1).map(group => group ?? '') : null;
}

// Arithmetic

type Op = 'plus' | 'minus' | 'times' | 'divided';
const symbols: Record<Op, string> = { plus: '+', minus: '−', times: '×', divided: '÷' };

/** "7 times 8 is 56", "12 x 12 = 144", "100 divided by 4 equals 25", "2 + 3 * 4 = 14": × and ÷ first. */
function arithmetic(s: string): string | null {
  let t = ` ${s} `;
  for (const [from, to] of [['×', ' times '], ['*', ' times '], ['÷', ' divided by '], ['+', ' plus '], ['=', ' equals '],
    [' x ', ' times '], [' / ', ' divided by '], [' - ', ' minus ']]) t = t.replaceAll(from, to);
  t = t.replaceAll('multiplied by', 'times').replaceAll('divided by', 'divided').split(/\s+/).filter(Boolean).join(' ');
  const parts = match(`(.+?) (?:equals|is equal to|is|makes|gives) ${hedge}${number}`, t);
  if (!parts) return null;
  const words = parts[0].split(' ');
  if (words.length < 3 || words.length % 2 === 0) return null;
  const values: number[] = [];
  const ops: Op[] = [];
  for (const [index, word] of words.entries()) {
    if (index % 2 === 0) {
      if (!new RegExp(`^${number}$`).test(word)) return null;
      values.push(Number(word));
    } else {
      if (!(word in symbols)) return null;
      ops.push(word as Op);
    }
  }
  const total = evaluate(values, ops);
  if (total === null) return null;
  const expression = ops.map((op, index) => `${format(values[index])} ${symbols[op]} `).join('') + format(values.at(-1)!);
  return `${expression} = ${format(total)}`;
}

/** × and ÷ before + and −, left to right. Null on division by zero. */
function evaluate(values: number[], ops: Op[]): number | null {
  const terms = [values[0]];
  const signs: Op[] = [];
  for (const [index, op] of ops.entries()) {
    const value = values[index + 1];
    if (op === 'times') terms[terms.length - 1] *= value;
    else if (op === 'divided') {
      if (value === 0) return null;
      terms[terms.length - 1] /= value;
    } else { terms.push(value); signs.push(op); }
  }
  let total = terms[0];
  for (const [index, sign] of signs.entries()) total += sign === 'plus' ? terms[index + 1] : -terms[index + 1];
  return Number.isFinite(total) ? total : null;
}

// Percentages

/** "20% of 150 is 30", "30 is 20% of 150", "from 50 to 75 is a 50% increase". */
function percent(s: string): string | null {
  const of = match(`${number} percent of ${number} (?:equals|is equal to|is|makes|=) ${hedge}${number}`, s);
  if (of) {
    const [a, b] = [Number(of[0]), Number(of[1])];
    return `${format(a)}% of ${format(b)} = ${format(a * b / 100)}`;
  }
  const share = match(`${number} is ${hedge}${number} percent of ${number}`, s);
  if (share && Number(share[2]) !== 0) {
    const [part, whole] = [Number(share[0]), Number(share[2])];
    return `${format(part)} is ${format(part / whole * 100)}% of ${format(whole)}`;
  }
  const change = match(`(?:going |a change |a rise |an increase |a drop |a fall |a decrease )?from ${number} to ${number}`
    + ` (?:is|was|would be|represents|means) (?:a|an) ${hedge}${number}`
    + ' percent (?:increase|rise|gain|growth|jump|drop|decrease|fall|decline|cut|reduction)', s);
  if (change && Number(change[0]) !== 0) {
    const [a, b] = [Number(change[0]), Number(change[1])];
    const pct = (b - a) / a * 100;
    const shown = format(Math.abs(pct));
    const whole = shown.split('.')[0];
    const article = shown.startsWith('8') || whole === '11' || whole === '18' ? 'an' : 'a';
    return `From ${format(a)} to ${format(b)} is ${article} ${shown}% ${pct >= 0 ? 'increase' : 'decrease'}`;
  }
  return null;
}

// Units

type Unit = { symbol: string; kind: string; toBase(value: number): number; fromBase(value: number): number };
const linear = (symbol: string, kind: string, coefficient: number): Unit =>
  ({ symbol, kind, toBase: value => value * coefficient, fromBase: value => value / coefficient });
const temperature = (symbol: string, toKelvin: (v: number) => number, fromKelvin: (v: number) => number): Unit =>
  ({ symbol, kind: 'temperature', toBase: toKelvin, fromBase: fromKelvin });

/** Names as people write them. Names that could mean several units ("ton", "pint", "calorie") are left out. */
const units = new Map<string, Unit>();
const add = (names: string[], unit: Unit) => { for (const name of names) units.set(name, unit); };
add(['millimetres', 'millimeters', 'millimetre', 'millimeter', 'mm'], linear('mm', 'length', 0.001));
add(['centimetres', 'centimeters', 'centimetre', 'centimeter', 'cm'], linear('cm', 'length', 0.01));
add(['metres', 'meters', 'metre', 'meter', 'm'], linear('m', 'length', 1));
add(['kilometres', 'kilometers', 'kilometre', 'kilometer', 'km', 'kms'], linear('km', 'length', 1000));
add(['inches', 'inch'], linear('in', 'length', 0.0254));
add(['feet', 'foot', 'ft'], linear('ft', 'length', 0.3048));
add(['yards', 'yard', 'yd'], linear('yd', 'length', 0.9144));
add(['miles', 'mile', 'mi'], linear('mi', 'length', 1609.344));
add(['nautical miles', 'nautical mile'], linear('nmi', 'length', 1852));
add(['light-years', 'light years', 'light-year', 'light year'], linear('ly', 'length', 9.4607304725808e15));
add(['milligrams', 'milligram', 'mg'], linear('mg', 'mass', 1e-6));
add(['grams', 'gram', 'g'], linear('g', 'mass', 0.001));
add(['kilograms', 'kilogram', 'kilos', 'kilo', 'kg'], linear('kg', 'mass', 1));
add(['tonnes', 'tonne', 'metric tons', 'metric ton'], linear('t', 'mass', 1000));
add(['ounces', 'ounce', 'oz'], linear('oz', 'mass', 0.028349523125));
add(['pounds', 'pound', 'lbs', 'lb'], linear('lb', 'mass', 0.45359237));
add(['stones', 'stone'], linear('st', 'mass', 6.35029318));
add(['millilitres', 'milliliters', 'millilitre', 'milliliter', 'ml'], linear('ml', 'volume', 0.001));
add(['litres', 'liters', 'litre', 'liter', 'l'], linear('l', 'volume', 1));
add(['cubic metres', 'cubic meters', 'cubic metre', 'cubic meter', 'm³', 'm3'], linear('m³', 'volume', 1000));
add(['us gallons', 'us gallon', 'gallons', 'gallon'], linear('US gal', 'volume', 3.785411784));
add(['imperial gallons', 'imperial gallon', 'uk gallons', 'uk gallon'], linear('imp gal', 'volume', 4.54609));
add(['degrees celsius', 'degree celsius', 'degrees centigrade', 'celsius', 'centigrade', '°c', '° c', 'degrees c'],
  temperature('°C', v => v + 273.15, v => v - 273.15));
add(['degrees fahrenheit', 'degree fahrenheit', 'fahrenheit', '°f', '° f', 'degrees f'],
  temperature('°F', v => (v - 32) * 5 / 9 + 273.15, v => (v - 273.15) * 9 / 5 + 32));
add(['kelvin', 'kelvins'], temperature('K', v => v, v => v));
add(['kilometres per hour', 'kilometers per hour', 'km/h', 'kmh', 'kph'], linear('km/h', 'speed', 1 / 3.6));
add(['miles per hour', 'mph'], linear('mph', 'speed', 0.44704));
add(['metres per second', 'meters per second', 'm/s'], linear('m/s', 'speed', 1));
add(['knots', 'knot'], linear('kn', 'speed', 1852 / 3600));
add(['square metres', 'square meters', 'square metre', 'square meter', 'm²', 'm2', 'sq m'], linear('m²', 'area', 1));
add(['square kilometres', 'square kilometers', 'square kilometre', 'square kilometer', 'km²', 'km2', 'sq km'], linear('km²', 'area', 1e6));
add(['hectares', 'hectare', 'ha'], linear('ha', 'area', 1e4));
add(['acres', 'acre'], linear('acres', 'area', 4046.8564224));
add(['square miles', 'square mile', 'sq mi'], linear('sq mi', 'area', 2589988.110336));
add(['square feet', 'square foot', 'sq ft'], linear('sq ft', 'area', 0.09290304));
add(['seconds', 'second', 'secs', 'sec'], linear('s', 'duration', 1));
add(['minutes', 'minute', 'mins', 'min'], linear('min', 'duration', 60));
add(['hours', 'hour', 'hrs', 'hr'], linear('h', 'duration', 3600));
add(['days', 'day'], linear('days', 'duration', 86_400));
add(['weeks', 'week'], linear('weeks', 'duration', 604_800));
add(['kilojoules', 'kilojoule', 'kj'], linear('kJ', 'energy', 1000));
add(['kilocalories', 'kilocalorie', 'kcal'], linear('kcal', 'energy', 4184));
add(['kilowatt-hours', 'kilowatt hours', 'kilowatt-hour', 'kilowatt hour', 'kwh'], linear('kWh', 'energy', 3.6e6));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** The unit names as one alternation, longest first. */
const unitPattern = `(${[...units.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0)).map(escape).join('|')})`;

/** "100 miles is about 161 kilometres", "32 degrees fahrenheit is 0 degrees celsius", "there are 5280 feet in a mile". */
function conversion(s: string): string | null {
  // "32°F" and "10km" get a space before the unit.
  const t = s.replace(/(\d)(°|[a-z])/g, '$1 $2').replaceAll('=', ' equals ').split(/\s+/).filter(Boolean).join(' ');
  const amount = String.raw`(-?\d+(?:\.\d+)?|a|an|one)`;
  let sides: [string, string, string] | null = null;
  const direct = match(`${amount} ${unitPattern} (?:is|are|equals|is equal to|is the same as|makes|equal) ${hedge}${number} ${unitPattern}`, t);
  const thereAre = direct ? null : match(`there (?:are|is) ${hedge}${number} ${unitPattern} in (?:a|an|one|1) ${unitPattern}`, t);
  const has = direct || thereAre ? null : match(`(?:a|an|one|1) ${unitPattern} (?:has|contains|is|equals) ${hedge}${number} ${unitPattern}`, t);
  if (direct) sides = [direct[0], direct[1], direct[3]];
  else if (thereAre) sides = ['1', thereAre[2], thereAre[1]];
  else if (has) sides = ['1', has[0], has[2]];
  if (!sides) return null;
  const [rawAmount, fromName, toName] = sides;
  const from = units.get(fromName);
  const to = units.get(toName);
  if (!from || !to || from.kind !== to.kind || fromName === toName || from.symbol === to.symbol) return null;
  const word = ['a', 'an', 'one'].includes(rawAmount);
  const value = word ? 1 : Number(rawAmount);
  const converted = to.fromBase(from.toBase(value));
  if (!Number.isFinite(converted)) return null;
  return `${word ? `1 ${fromName}` : `${format(value)} ${fromName}`} = ${format(converted)} ${to.symbol}`;
}

// Dates

const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const monthPattern = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
/** "1 january 2000", "1st january 2000", "january 1, 2000", "2000-01-01". */
const datePattern = String.raw`((?:\d{1,2}(?:st|nd|rd|th)? ${monthPattern},? \d{4})|(?:${monthPattern} \d{1,2}(?:st|nd|rd|th)?,? \d{4})|(?:\d{4}-\d{2}-\d{2}))`;
const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A date this grammar reads, at noon UTC. Null for an impossible date or one before the Gregorian calendar (1583). */
function parseDate(text: string): Date | null {
  let day: number | undefined, month: number | undefined, year: number | undefined;
  const iso = match(String.raw`(\d{4})-(\d{2})-(\d{2})`, text);
  if (iso) [year, month, day] = iso.map(Number);
  else {
    for (const word of text.replaceAll(',', '').split(' ')) {
      const index = monthNames.findIndex(name => name === word || (name.startsWith(word) && word.length >= 3));
      if (index >= 0) month = index + 1;
      else if (/^\d{4}$/.test(word)) year = Number(word);
      else if (/^\d{1,2}(?:st|nd|rd|th)?$/.test(word)) day = Number(word.replace(/(st|nd|rd|th)$/, ''));
    }
  }
  if (day === undefined || month === undefined || year === undefined || year < 1583) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? date : null;
}

const describe = (date: Date) => `${date.getUTCDate()} ${capitalized(monthNames[date.getUTCMonth()])} ${date.getUTCFullYear()}`;
const dayNumber = (date: Date) => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);

/** "1 january 2000 was a saturday", "july 4, 1776 fell on a thursday". */
function weekday(s: string, now: Date): string | null {
  const verbs = '(?:was|is|will be|fell on|falls on|fell|falls|will fall on|is on|was on)';
  const parts = match(`${datePattern} ${verbs} (?:a |an )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)`, s);
  const date = parts ? parseDate(parts[0]) : null;
  if (!date) return null;
  const name = capitalized(weekdayNames[date.getUTCDay()]);
  const verb = dayNumber(date) < dayNumber(now) ? 'was' : dayNumber(date) === dayNumber(now) ? 'is' : 'will be';
  return `${describe(date)} ${verb} a ${name}`;
}

/** "1969 was 57 years ago", "from 1914 to 1918 is 4 years", "there are 365 days between 1 january 2026 and 1 january 2027". */
function span(s: string, now: Date): string | null {
  const year = String.raw`(\d{3,4})`;
  const thisYear = now.getUTCFullYear();
  const ago = match(`${year} was ${hedge}${number} years ago`, s);
  if (ago && Number(ago[0]) <= thisYear) return `${Number(ago[0])} was ${thisYear - Number(ago[0])} years before ${thisYear}`;
  const since = match(`${number} years (?:have passed|passed|have gone by) since ${year}`, s);
  if (since && Number(since[1]) <= thisYear) return `${thisYear} is ${thisYear - Number(since[1])} years after ${Number(since[1])}`;
  const between = match(`(?:from|between) ${year} (?:to|and|until|till) ${year} (?:is|was|are|were|spans|spanned|lasted|covers) ${hedge}${number} years`, s);
  if (between) {
    const [a, b] = [Number(between[0]), Number(between[1])];
    return `From ${a} to ${b} is ${Math.abs(b - a)} years`;
  }
  const days = match(`there (?:are|were|will be) ${hedge}${number} days between ${datePattern} and ${datePattern}`, s);
  if (days) {
    const a = parseDate(days[1]);
    const b = parseDate(days[4]);
    if (a && b) return `There are ${Math.abs(dayNumber(b) - dayNumber(a))} days between ${describe(a)} and ${describe(b)}`;
  }
  return null;
}

// Numbers

const decimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const significant = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });

/** Whole numbers with thousands separators, others to two decimals without trailing zeros, tiny ones to four significant digits. */
export function format(raw: number): string {
  // Floating-point dust such as 2.2e-12 from 32 °F in °C is zero.
  const value = Math.abs(raw) < 1e-9 ? 0 : raw;
  const text = value !== 0 && Math.abs(value) < 0.01 ? significant.format(value) : decimals.format(value);
  return text === '-0' ? '0' : text.replaceAll('-', '−');
}
