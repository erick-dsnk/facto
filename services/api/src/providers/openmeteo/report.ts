import { joinList } from '../../sources/evidence.js';
import type { DayRange } from './dates.js';
import { WEATHER, type WeatherQuery } from './query.js';

/** One place's daily values, each list a day long; null where Open-Meteo has no value. */
export type Daily = {
  days: string[]; high: (number | null)[]; low: (number | null)[]; precipitation: (number | null)[]; rain: (number | null)[];
  showers: (number | null)[]; snow: (number | null)[]; gusts: (number | null)[]; sunshine: (number | null)[];
};
export type PlaceDays = { name: string; days: Daily };

const known = (values: (number | null)[]) => values.filter((value): value is number => value !== null);
const total = (values: (number | null)[]) => known(values).reduce((a, b) => a + b, 0);
const peak = (values: (number | null)[]) => known(values).length ? Math.max(...known(values)) : 0;
const average = (values: (number | null)[]) => known(values).length ? total(values) / known(values).length : 0;

/** One decimal at most: 2.1, 7, -3.5. */
export function number(value: number): string {
  // Halves round away from zero, as Swift's rounded() did.
  const rounded = Math.sign(value) * Math.round(Math.abs(value) * 10) / 10;
  const text = (rounded === 0 ? 0 : rounded).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}

function range(values: (number | null)[]): string {
  const list = known(values);
  if (!list.length) return '?';
  const [low, high] = [Math.min(...list), Math.max(...list)];
  return low === high ? number(low) : `${number(low)} to ${number(high)}`;
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 13 to Sun 15 Nov", "Sat 28 Nov to Tue 1 Dec", "Mon 26 Feb to Fri 2 Mar 2018". The year shows when it is not this year. */
export function dates(days: DayRange, today: Date): string {
  const { start, end } = days;
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const thisYear = sameYear && end.getUTCFullYear() === today.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const day = (date: Date) => `${weekdays[date.getUTCDay()]} ${date.getUTCDate()}`;
  const withMonth = (date: Date) => `${day(date)} ${months[date.getUTCMonth()]}`;
  const withYear = (date: Date) => `${withMonth(date)} ${date.getUTCFullYear()}`;
  const endText = thisYear ? withMonth(end) : withYear(end);
  if (start.getTime() === end.getTime()) return endText;
  return `${sameMonth ? day(start) : sameYear ? withMonth(start) : withYear(start)} to ${endText}`;
}

/** "snowfall in Oulu (2.1 cm) and Tampere (0.4 cm); none in Helsinki or Espoo". */
function split(places: PlaceDays[], value: (days: Daily) => number, atLeast: number, unit: string, what: string): string {
  const withIt = places.filter(place => value(place.days) >= atLeast);
  const without = places.filter(place => value(place.days) < atLeast);
  const parts: string[] = [];
  if (withIt.length) parts.push(`${what} in ${joinList(withIt.map(place => `${place.name} (${number(value(place.days))} ${unit})`), 'and')}`);
  if (without.length) parts.push(`${withIt.length ? 'none in ' : `no ${what} in `}${joinList(without.map(place => place.name), 'or')}`);
  return parts.join('; ');
}

function highs(places: PlaceDays[]): string {
  const all = places.flatMap(place => known(place.days.high));
  if (!all.length) return '';
  const [low, high] = [Math.min(...all), Math.max(...all)];
  return `Daytime highs ${low === high ? number(low) : `${number(low)} to ${number(high)}`} °C.`;
}

/**
 * The weather evidence as one plain sentence (port of WeatherReport): "Open-Meteo forecast, Fri 13 to Sun 15
 * Nov: snowfall in Oulu (2.1 cm); none in Helsinki, Espoo, Tampere or Vantaa. Daytime highs 1 to 9 °C."
 * Null when no place has data.
 */
export function weatherSentence(query: WeatherQuery, places: PlaceDays[], today: Date): string | null {
  const withData = places.filter(place => known(place.days.high).length > 0);
  if (!withData.length) return null;
  const head = `${query.forecast ? 'Open-Meteo forecast, ' : 'Open-Meteo weather records, '}${dates(query.range, today)}`;
  let body: string;
  switch (query.topic) {
    case 'snow': body = `${split(withData, days => total(days.snow), WEATHER.snowCm, 'cm', 'snowfall')}. ${highs(withData)}`; break;
    case 'rain': body = split(withData, days => total(days.rain) + total(days.showers), WEATHER.rainMm, 'mm', 'rain'); break;
    case 'temperature': body = withData.map(place => `${place.name} highs ${range(place.days.high)} °C, lows ${range(place.days.low)} °C`).join('; '); break;
    case 'wind': body = `strongest gusts ${withData.map(place => `${number(peak(place.days.gusts))} km/h in ${place.name}`).join(', ')}`; break;
    case 'sun': body = `sunshine ${withData.map(place => `${number(average(place.days.sunshine) / 3600)} h a day in ${place.name}`).join(', ')}`; break;
    default: body = withData.map(place => {
      const snow = total(place.days.snow);
      const rain = total(place.days.rain) + total(place.days.showers);
      return `${place.name} highs ${range(place.days.high)} °C, ${number(rain)} mm rain, ${snow >= WEATHER.snowCm ? `${number(snow)} cm snow` : 'no snow'}`;
    }).join('; ');
  }
  const trimmed = body.trim();
  return `${head}: ${trimmed}${body.endsWith('.') ? '' : '.'}`;
}
