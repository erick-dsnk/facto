import { format } from '../calculation/calculation.js';
import { joinList } from '../../sources/evidence.js';
import { fold, mentions } from './lookup.js';

/**
 * Turns an item's statements into a short plain sentence (port of WikidataStatements): the few that bear
 * most on the claim, by the words it uses, the values it names and the numbers and years it gives.
 * "Bucharest: population 1,716,961 (2021)."
 */
export type WikidataValue =
  | { type: 'item'; id: string }
  | { type: 'quantity'; amount: number; unit: string | null }
  /** "+1879-03-14T00:00:00Z" and Wikidata's precision (9 year, 10 month, 11 day). */
  | { type: 'time'; time: string; precision: number }
  | { type: 'text'; text: string };
export type WikidataStatement = { property: string; value: WikidataValue; rank: string; pointInTime?: WikidataValue };
export type WikidataEntity = { id: string; label: string; aliases: string[]; statements: WikidataStatement[] };

/** A disambiguation page names many things and settles none. */
export const isDisambiguation = (entity: WikidataEntity) =>
  entity.statements.some(s => s.property === 'P31' && s.value.type === 'item' && s.value.id === 'Q4167410');

type Property = { phrase: string; keywords: string[]; location?: boolean };
const p = (phrase: string, keywords: string[], location = false): Property => ({ phrase, keywords, location });

/** The properties worth stating, with the words that point to each. */
export const PROPERTIES: Record<string, Property> = {
  P1082: p('population', ['population', 'people', 'inhabitants', 'residents', 'populous', 'live', 'lives', 'million']),
  P2046: p('area', ['area', 'square', 'km²', 'km2', 'acres', 'hectares', 'size']),
  P2044: p('elevation above sea level', ['high', 'height', 'tall', 'elevation', 'altitude', 'metres', 'meters', 'feet', 'above sea level', 'summit']),
  P2048: p('height', ['tall', 'height', 'high', 'metres', 'meters', 'feet']),
  P2043: p('length', ['long', 'length', 'km', 'kilometres', 'kilometers', 'miles']),
  P2386: p('diameter', ['diameter', 'across', 'wide']),
  P2067: p('mass', ['weighs', 'weight', 'mass', 'kg', 'kilograms', 'tonnes', 'pounds']),
  P4511: p('vertical depth', ['deep', 'depth', 'deepest']),
  P571: p('inception', ['founded', 'established', 'created', 'built', 'formed', 'started', 'since', 'opened', 'dates', 'inception']),
  P1619: p('official opening', ['opened', 'opening', 'inaugurated']),
  P576: p('dissolved or demolished', ['dissolved', 'abolished', 'closed', 'ended', 'defunct', 'demolished']),
  P569: p('date of birth', ['born', 'birth', 'birthday', 'age', 'old']),
  P19: p('place of birth', ['born', 'birthplace', 'native']),
  P570: p('date of death', ['died', 'death', 'dead', 'killed']),
  P20: p('place of death', ['died', 'death']),
  P27: p('citizenship', ['citizen', 'citizenship', 'nationality']),
  P106: p('occupation', ['occupation', 'profession', 'worked as']),
  P39: p('position held', ['president', 'prime minister', 'minister', 'king', 'queen', 'chancellor', 'mayor', 'governor', 'senator', 'pope', 'served']),
  P26: p('spouse', ['married', 'wife', 'husband', 'spouse']),
  P22: p('father', ['father', 'son of', 'daughter of']),
  P25: p('mother', ['mother', 'son of', 'daughter of']),
  P166: p('award received', ['award', 'awarded', 'won', 'prize', 'nobel', 'medal']),
  P36: p('capital', ['capital']),
  P1376: p('capital of', ['capital']),
  P17: p('country', ['country', 'located', 'lies', 'situated'], true),
  P131: p('located in', ['located', 'lies', 'situated', 'region', 'province', 'state'], true),
  P30: p('continent', ['continent'], true),
  P706: p('located on terrain feature', ['located', 'range', 'mountains'], true),
  P206: p('located next to body of water', ['lake', 'river', 'sea', 'ocean', 'coast', 'shore']),
  P403: p('flows into', ['flows', 'mouth', 'empties', 'drains', 'into']),
  P885: p('source', ['source', 'rises', 'originates']),
  P38: p('currency', ['currency', 'money']),
  P37: p('official language', ['language', 'spoken', 'official']),
  P35: p('head of state', ['head of state', 'president', 'king', 'queen', 'monarch']),
  P6: p('head of government', ['prime minister', 'mayor', 'head of government', 'chancellor', 'premier', 'leader']),
  P112: p('founded by', ['founded', 'founder', 'co-founded', 'established']),
  P169: p('chief executive officer', ['ceo', 'chief executive']),
  P159: p('headquarters', ['headquarters', 'headquartered', 'based']),
  P1128: p('employees', ['employees', 'staff', 'workers', 'employs']),
  P50: p('author', ['wrote', 'written', 'author', 'novel', 'book']),
  P57: p('director', ['directed', 'director']),
  P86: p('composer', ['composed', 'composer']),
  P175: p('performer', ['sang', 'sung', 'performed', 'performer']),
  P577: p('publication date', ['published', 'released', 'release', 'came out', 'premiered']),
  P61: p('discoverer or inventor', ['discovered', 'invented', 'inventor', 'discoverer']),
  P575: p('time of discovery or invention', ['discovered', 'invented', 'discovery', 'invention']),
  P84: p('architect', ['designed', 'architect']),
  P2250: p('life expectancy', ['life expectancy']),
  P610: p('highest point', ['highest point', 'highest mountain', 'tallest mountain', 'highest peak']),
  P2047: p('duration', ['minutes', 'duration', 'runtime', 'lasts']),
  P1120: p('number of deaths', ['deaths', 'killed', 'casualties', 'fatalities']),
  P580: p('start time', ['began', 'started', 'start']),
  P582: p('end time', ['ended', 'end', 'lasted']),
  P585: p('point in time', ['happened', 'took place', 'occurred']),
  P2101: p('melting point', ['melts', 'melting']),
  P2102: p('boiling point', ['boils', 'boiling']),
  P1086: p('atomic number', ['atomic number']),
  P2583: p('distance from Earth', ['distance', 'far', 'away', 'light-years', 'light years']),
};

/** Short symbols for common units; others show their label. */
export const UNIT_SYMBOLS: Record<string, string> = {
  Q11573: 'm', Q828224: 'km', Q712226: 'km²', Q25343: 'm²', Q11570: 'kg', Q191118: 't', Q41803: 'g',
  Q25267: '°C', Q42289: '°F', Q11579: 'K', Q3710: 'ft', Q253276: 'mi', Q174728: 'cm', Q174789: 'mm',
  Q11574: 's', Q7727: 'min', Q25235: 'h', Q573: 'days', Q577: 'years', Q11229: '%', Q4917: 'US dollars',
  Q4916: 'euros', Q531: 'light-years', Q1811: 'AU', Q35852: 'ha', Q81292: 'acres', Q180154: 'km/h',
  Q182429: 'm/s', Q211256: 'mph', Q218593: 'in',
};

export const VALUES_PER_PROPERTY = 3;
export const MAX_STATEMENTS = 4;

/** "+1879-…" is 1879, "-0500-…" is -500. */
export function year(value: WikidataValue | undefined): number | null {
  if (value?.type !== 'time') return null;
  const match = /^([+-])(\d+)-/.exec(value.time);
  if (!match) return null;
  return match[1] === '-' ? -Number(match[2]) : Number(match[2]);
}

/** Statements of known properties by property: preferred ones when there are any, never deprecated, latest figure only. */
export function chosen(entity: WikidataEntity): { property: string; statements: WikidataStatement[] }[] {
  const byProperty = new Map<string, WikidataStatement[]>();
  for (const statement of entity.statements) {
    if (!PROPERTIES[statement.property] || statement.rank === 'deprecated') continue;
    byProperty.set(statement.property, [...(byProperty.get(statement.property) ?? []), statement]);
  }
  return [...byProperty.keys()].sort().map(property => {
    let list = byProperty.get(property)!;
    if (list.some(s => s.rank === 'preferred')) list = list.filter(s => s.rank === 'preferred');
    if (list[0].value.type === 'quantity') {
      list = [list.reduce((best, s) => (year(s.pointInTime) ?? -Infinity) > (year(best.pointInTime) ?? -Infinity) ? s : best)];
    }
    return { property, statements: list.slice(0, VALUES_PER_PROPERTY) };
  });
}

/** Item ids whose labels the sentence may need: values and units of the chosen statements, at most 50. */
export function labelsNeeded(entity: WikidataEntity): string[] {
  const ids: string[] = [];
  for (const { statements } of chosen(entity)) {
    for (const { value } of statements) {
      if (value.type === 'item') ids.push(value.id);
      else if (value.type === 'quantity' && value.unit && !UNIT_SYMBOLS[value.unit]) ids.push(value.unit);
    }
  }
  return [...new Set(ids)].slice(0, 50);
}

/** Numbers in the claim, with "million" and "billion" applied: "1.7 million" is 1,700,000. */
export function numbers(text: string): number[] {
  const cleaned = text.toLowerCase().replace(/(\d),(?=\d{3})/g, '$1');
  return [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(million|billion|thousand)?/g)]
    .map(match => Number(match[1]) * ({ thousand: 1e3, million: 1e6, billion: 1e9 }[match[2] ?? ''] ?? 1));
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "14 March 1879", "March 1879", "1879", "1870s", "19th century", "500 BC". */
export function describeTime(time: string, precision: number): string | null {
  const bc = time.startsWith('-');
  const parts = time.slice(1).split('T')[0].split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  const era = bc ? ' BC' : '';
  if (precision === 11 && m >= 1 && m <= 12 && d > 0) return `${d} ${monthNames[m - 1]} ${y}${era}`;
  if (precision === 10 && m >= 1 && m <= 12) return `${monthNames[m - 1]} ${y}${era}`;
  if (precision === 9) return `${y}${era}`;
  if (precision === 8) return `${Math.floor(y / 10) * 10}s${era}`;
  if (precision === 7) {
    const century = Math.floor((y - 1) / 100) + 1;
    const lastDigit = century % 10;
    const suffix = century % 100 >= 11 && century % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][lastDigit >= 4 ? 0 : lastDigit];
    return `${century}${suffix} century${era}`;
  }
  return null;
}

/** One value in words, with the year of a "point in time" qualifier. */
export function describe(statement: WikidataStatement, labels: Record<string, string>): string | null {
  const { value } = statement;
  let text: string;
  if (value.type === 'item') {
    if (!labels[value.id]) return null;
    text = labels[value.id];
  } else if (value.type === 'text') text = value.text;
  else if (value.type === 'quantity') {
    text = format(value.amount).replaceAll('−', '-');
    if (value.unit) text += ` ${UNIT_SYMBOLS[value.unit] ?? labels[value.unit] ?? ''}`;
    text = text.trim();
  } else {
    const date = describeTime(value.time, value.precision);
    if (!date) return null;
    text = date;
  }
  const pointYear = year(statement.pointInTime);
  return pointYear === null ? text : `${text} (${pointYear})`;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * How much one property bears on the claim: 2 for a word that points to it ("born", "capital"), 1 for "in"
 * before a location, 3 for a value the claim names, 3 for a year it gives, 2 for a number near the figure.
 */
export function score(property: string, statements: WikidataStatement[], claim: string, labels: Record<string, string>): number {
  const info = PROPERTIES[property];
  const lower = ` ${fold(claim)} `;
  let total = 0;
  if (info.keywords.some(keyword => lower.includes(keyword) && new RegExp(`(?<![\\p{L}])${escape(keyword)}(?![\\p{L}])`, 'u').test(lower))) total += 2;
  else if (info.location && lower.includes(' in ')) total += 1;
  const found = numbers(claim);
  for (const statement of statements) {
    const { value } = statement;
    if (value.type === 'item') { if (labels[value.id] && mentions([labels[value.id]], [claim])) total += 3; }
    else if (value.type === 'text') { if (mentions([value.text], [claim])) total += 3; }
    else if (value.type === 'quantity') {
      if (found.some(n => Math.abs(n - value.amount) <= Math.max(Math.abs(value.amount) * 0.1, 0.5))) total += 2;
    } else {
      const y = year(value);
      if (y !== null && found.includes(y)) total += 3;
    }
  }
  return total;
}

/** The sentence, or null when no statement bears on the claim. */
export function statementSentence(entity: WikidataEntity, claim: string, labels: Record<string, string>, limit: number = MAX_STATEMENTS): string | null {
  const scored = chosen(entity).flatMap(({ property, statements }) => {
    const values = statements.map(s => describe(s, labels)).filter((v): v is string => v !== null);
    if (!values.length) return [];
    const points = score(property, statements, claim, labels);
    return points >= 2 ? [{ property, points, text: `${PROPERTIES[property].phrase} ${joinList(values, 'and')}` }] : [];
  });
  const top = scored.sort((a, b) => b.points - a.points || (a.property < b.property ? -1 : a.property > b.property ? 1 : 0)).slice(0, limit);
  return top.length ? `${entity.label}: ${top.map(item => item.text).join('; ')}.` : null;
}
