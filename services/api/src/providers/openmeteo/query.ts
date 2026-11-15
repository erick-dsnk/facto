import { readFileSync } from 'node:fs';
import nlp from 'compromise';
import { DATA_DIRECTORY } from '../../sources/domain-lists.js';
import { addDays, claimDates, startOfDay, type DayRange } from './dates.js';

/**
 * What a weather claim asks Open-Meteo, read on the server (port of the reference app's WeatherQuery): the
 * places, the days and the kind of weather. Only place names and dates ever leave the server.
 */
export type WeatherPlace = { type: 'named'; name: string } | { type: 'country'; code: string; name: string };
export type WeatherTopic = 'snow' | 'rain' | 'wind' | 'temperature' | 'sun' | 'general';
/** `asOf` is the check date (YYYY-MM-DD, UTC); `forecast` is true when any of the days is today or later. */
export type WeatherQuery = { places: WeatherPlace[]; range: DayRange; topic: WeatherTopic; forecast: boolean; asOf: string };

export const WEATHER = { forecastDays: 16, recentDays: 30, maxCities: 3, maxLocations: 5, snowCm: 0.2, rainMm: 0.2 } as const;
/** Open-Meteo's historical records start in 1940. */
export const FIRST_RECORD = new Date(Date.UTC(1940, 0, 1));

export type City = { name: string; code: string; latitude: number; longitude: number };
export type CityList = { byCountry: Map<string, City[]>; countryNames: Map<string, string> };

/** Other names people use for countries in cities.txt. */
const aliases: Record<string, string> = {
  USA: 'US', 'U.S.': 'US', America: 'US', 'the United States': 'US', 'United States of America': 'US',
  UK: 'GB', 'U.K.': 'GB', Britain: 'GB', 'Great Britain': 'GB', 'Czech Republic': 'CZ', Holland: 'NL',
  Turkey: 'TR', 'Ivory Coast': 'CI', Burma: 'MM', 'South Korea': 'KR', 'North Korea': 'KP', Russia: 'RU',
};

/** cities.txt: the five largest places per country (GeoNames, CC BY 4.0), tab-separated name, code, latitude, longitude. */
export function parseCities(text: string): CityList {
  const byCountry = new Map<string, City[]>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    const [latitude, longitude] = [Number(parts[2]), Number(parts[3])];
    if (parts.length !== 4 || parts[1].length !== 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    byCountry.set(parts[1], [...(byCountry.get(parts[1]) ?? []), { name: parts[0], code: parts[1], latitude, longitude }]);
  }
  const countryNames = new Map<string, string>();
  const english = new Intl.DisplayNames(['en'], { type: 'region' });
  for (const code of byCountry.keys()) {
    try {
      const name = english.of(code);
      if (name && name !== code) countryNames.set(name, code);
    } catch { /* not a region code */ }
  }
  for (const [alias, code] of Object.entries(aliases)) if (byCountry.has(code)) countryNames.set(alias, code);
  return { byCountry, countryNames };
}

let shippedCities: CityList | undefined;
/** The shipped city list, read once. */
export function loadCities(): CityList {
  shippedCities ??= parseCities(readFileSync(new URL('cities.txt', DATA_DIRECTORY), 'utf8'));
  return shippedCities;
}

export const citiesIn = (cities: CityList, code: string) => cities.byCountry.get(code) ?? [];

/** A city from the list by its exact name, so the largest cities need no geocoding request. */
export function cityNamed(cities: CityList, name: string): City | null {
  const wanted = name.toLocaleLowerCase('en');
  for (const list of cities.byCountry.values()) {
    const city = list.find(item => item.name.toLocaleLowerCase('en') === wanted);
    if (city) return city;
  }
  return null;
}

/** The display name of a country code, not an alias. */
export function countryName(cities: CityList, code: string): string {
  for (const [name, value] of cities.countryNames) if (value === code && !(name in aliases)) return name;
  return code;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The first country named in `text`, longest name first at one position so "South Korea" is not "Korea". */
export function countryIn(cities: CityList, text: string): { code: string; name: string } | null {
  let best: { position: number; length: number; code: string } | null = null;
  for (const [name, code] of cities.countryNames) {
    if (!text.includes(name)) continue;
    // "New Mexico" and "Northern Ireland" are not those countries; in "Atlanta, Georgia" the name after "<Place>, " is a region.
    const found = new RegExp(`(?<![\\p{L}])(?<!New )(?<!Northern )(?<!South )(?<!Latin )(?<!Central )(?<!North )(?<!\\p{Lu}\\p{Ll}{1,20}, )${escape(name)}(?![\\p{L}])`, 'u').exec(text);
    if (!found) continue;
    if (!best || found.index < best.position || (found.index === best.position && name.length > best.length)) {
      best = { position: found.index, length: name.length, code };
    }
  }
  return best ? { code: best.code, name: countryName(cities, best.code) } : null;
}

/** Capitalized words that are never the place in a weather sentence. */
const notPlaces = new Set(['The', 'A', 'An', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Christmas', 'Easter', 'New Year', 'Celsius', 'Fahrenheit', 'Open-Meteo']);

/**
 * Places in a weather sentence: names compromise reads as places, or a capitalized name after "in", "across",
 * "over" and the like; a whole country only when nothing smaller is named. "Atlanta, Georgia" is Atlanta.
 * Only short names are taken, so a Title Case headline never goes to the geocoder whole.
 */
export function weatherPlaces(text: string, cities: CityList): WeatherPlace[] {
  const names: string[] = [];
  const add = (raw: string) => {
    const name = raw.split(',')[0].replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
    if (Array.from(name).length < 2 || name.split(' ').length > 3 || notPlaces.has(name) || cities.countryNames.has(name)
      || names.some(other => other.toLocaleLowerCase('en') === name.toLocaleLowerCase('en'))) return;
    names.push(name);
  };
  const doc = nlp(text);
  for (const place of doc.places().out('array') as string[]) add(place);
  if (!names.length) {
    const people = (doc.people().out('array') as string[]).concat(doc.organizations().out('array') as string[]);
    for (const match of text.matchAll(/\b(?:in|across|over|into|near)\s+(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){0,2})/gu)) {
      if (!people.some(person => person.includes(match[1]) || match[1].includes(person))) add(match[1]);
    }
  }
  if (names.length) return names.slice(0, WEATHER.maxCities).map(name => ({ type: 'named', name }));
  const country = countryIn(cities, text);
  return country ? [{ type: 'country', ...country }] : [];
}

/** What kind of weather a claim is about, which decides what the evidence sentence leads with. */
export function weatherTopic(text: string): WeatherTopic {
  const words = text.toLocaleLowerCase('en').split(/[^\p{L}°]+/u).filter(Boolean);
  const any = (stems: string[]) => words.some(word => stems.some(stem => word.startsWith(stem)));
  if (any(['snow', 'blizzard', 'sleet', 'flurr'])) return 'snow';
  if (any(['rain', 'shower', 'downpour', 'drizzl', 'wet', 'precipitation', 'flood', 'thunderstorm'])) return 'rain';
  if (any(['wind', 'gust', 'gale', 'storm', 'hurricane', 'typhoon', 'cyclone'])) return 'wind';
  if (any(['hot', 'heat', 'warm', 'temperature', 'degree', '°', 'cold', 'freez', 'frost', 'chill', 'mild', 'cool'])) return 'temperature';
  if (any(['sun', 'clear', 'dry'])) return 'sun';
  return 'general';
}

/**
 * The weather question in `text` for the check date `asOf` (YYYY-MM-DD, UTC), or null when it names no usable
 * place or time, or the days lie beyond Open-Meteo's forecast or before its records.
 */
export function parseWeatherQuery(text: string, asOf: string, cities: CityList): WeatherQuery | null {
  const today = startOfDay(asOf);
  if (Number.isNaN(today.getTime())) return null;
  const range = claimDates(text, today);
  if (!range || range.end > addDays(today, WEATHER.forecastDays - 1) || range.start < FIRST_RECORD) return null;
  const places = weatherPlaces(text, cities);
  if (!places.length) return null;
  return { places, range, topic: weatherTopic(text), forecast: range.end >= today, asOf };
}
