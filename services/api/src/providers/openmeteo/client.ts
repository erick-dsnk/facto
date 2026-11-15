import { z } from 'zod';
import { PipelineError, PROVIDER_LIMITS, type Evidence, type ProviderContext } from '../../../../../packages/contracts/src/index.js';
import { freeEvidence } from '../../sources/evidence.js';
import { getJson } from '../../sources/http.js';
import { WIKIMEDIA_USER_AGENT } from '../wikimedia/throttle.js';
import { addDays, isoDay, startOfDay, type DayRange } from './dates.js';
import { cityNamed, citiesIn, loadCities, parseWeatherQuery, WEATHER, type CityList, type WeatherPlace, type WeatherQuery } from './query.js';
import { weatherSentence, type Daily } from './report.js';

/** What the sources need from a weather service. A failure throws; nothing usable is []. */
export interface WeatherService {
  /** The weather question in a claim, read on the server; null when it names no usable place or time. */
  query(text: string, asOf: string): WeatherQuery | null;
  evidence(query: WeatherQuery, context: ProviderContext, claimId: string): Promise<Evidence[]>;
}

export type Location = { name: string; latitude: number; longitude: number };
export const OPEN_METEO_PUBLISHER = 'Open-Meteo';

export function geocodeRequestUrl(name: string): string {
  const params = new URLSearchParams({ name: Array.from(name).slice(0, 80).join(''), count: '1', language: 'en', format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

const dailyForecast = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'rain_sum', 'showers_sum', 'snowfall_sum', 'wind_gusts_10m_max', 'sunshine_duration'];
/** The archive has no showers. */
const dailyArchive = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'rain_sum', 'snowfall_sum', 'wind_gusts_10m_max', 'sunshine_duration'];

/** All places in one request: the forecast API for recent and coming days, the archive for anything older. */
export function weatherRequestUrl(locations: Location[], range: DayRange, forecast: boolean): string {
  const params = new URLSearchParams({
    latitude: locations.map(l => l.latitude.toFixed(4)).join(','), longitude: locations.map(l => l.longitude.toFixed(4)).join(','),
    daily: (forecast ? dailyForecast : dailyArchive).join(','), timezone: 'auto', start_date: isoDay(range.start), end_date: isoDay(range.end),
  });
  return `${forecast ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive'}?${params}`;
}

export type GeocodeHit = { name: string; latitude: number; longitude: number; countryCode: string; featureCode: string };
const geocodeSchema = z.object({
  results: z.array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), country_code: z.string().optional(), feature_code: z.string().optional() }).passthrough()).optional(),
}).passthrough();

/** The first hit, or null for none. A body that is not the documented shape throws. */
export function parseGeocode(body: unknown): GeocodeHit | null {
  const parsed = geocodeSchema.safeParse(body);
  if (!parsed.success) throw new PipelineError('malformed_weather_response');
  const first = parsed.data.results?.[0];
  return first ? { name: first.name, latitude: first.latitude, longitude: first.longitude, countryCode: first.country_code ?? '', featureCode: first.feature_code ?? '' } : null;
}

const series = z.array(z.number().nullable());
const placeSchema = z.object({
  daily: z.object({
    time: z.array(z.string()), temperature_2m_max: series.optional(), temperature_2m_min: series.optional(), precipitation_sum: series.optional(),
    rain_sum: series.optional(), showers_sum: series.optional(), snowfall_sum: series.optional(), wind_gusts_10m_max: series.optional(), sunshine_duration: series.optional(),
  }).passthrough(),
}).passthrough();

/** One `Daily` per location, in order. One location comes back as an object, several as an array. Anything else throws. */
export function parseWeather(body: unknown, count: number): Daily[] {
  const objects = Array.isArray(body) ? body : [body];
  if (objects.length !== count) throw new PipelineError('malformed_weather_response');
  return objects.map(raw => {
    const parsed = placeSchema.safeParse(raw);
    if (!parsed.success) throw new PipelineError('malformed_weather_response');
    const { daily } = parsed.data;
    const values = (list: (number | null)[] | undefined) => daily.time.map((_, index) => list?.[index] ?? null);
    return { days: daily.time, high: values(daily.temperature_2m_max), low: values(daily.temperature_2m_min), precipitation: values(daily.precipitation_sum),
      rain: values(daily.rain_sum), showers: values(daily.showers_sum), snow: values(daily.snowfall_sum), gusts: values(daily.wind_gusts_10m_max),
      sunshine: values(daily.sunshine_duration) };
  });
}

/**
 * Open-Meteo, no key needed (port of OpenMeteoClient). The largest cities come from cities.txt without a
 * request; any other place takes one geocoding request, which leaves the second of the claim's two weather
 * requests for the forecast or archive. Only place names, coordinates and dates are sent, never the claim.
 */
export function createOpenMeteo(options: { fetch?: typeof fetch; cities?: CityList } = {}): WeatherService {
  const fetcher = options.fetch ?? globalThis.fetch;
  const cities = () => options.cities ?? loadCities();
  const get = async (url: string, context: ProviderContext, claimId: string) => {
    context.consume('weather', claimId);
    const reply = await getJson(fetcher, url, { service: 'weather', signal: context.signal, maxBytes: 2_000_000, headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' } });
    if (reply.status !== 200) throw new PipelineError(reply.status === 429 ? 'weather_rate_limited' : 'weather_unavailable');
    return reply.body;
  };
  const sample = (code: string): Location[] => citiesIn(cities(), code).map(city => ({ name: city.name, latitude: city.latitude, longitude: city.longitude }));

  async function locations(places: WeatherPlace[], context: ProviderContext, claimId: string): Promise<Location[]> {
    const out: Location[] = [];
    let geocodes = 0;
    for (const place of places) {
      if (place.type === 'country') { out.push(...sample(place.code)); continue; }
      const city = cityNamed(cities(), place.name);
      if (city) { out.push({ name: city.name, latitude: city.latitude, longitude: city.longitude }); continue; }
      if (geocodes >= PROVIDER_LIMITS.weather - 1) continue;
      geocodes++;
      const hit = parseGeocode(await get(geocodeRequestUrl(place.name), context, claimId));
      if (!hit) continue;
      if (hit.featureCode.startsWith('PCL') && citiesIn(cities(), hit.countryCode).length) out.push(...sample(hit.countryCode));
      else out.push({ name: hit.name, latitude: hit.latitude, longitude: hit.longitude });
    }
    const byName = new Map<string, Location>();
    for (const location of out) if (!byName.has(location.name)) byName.set(location.name, location);
    return [...byName.values()].slice(0, WEATHER.maxLocations);
  }

  return {
    query: (text, asOf) => parseWeatherQuery(text, asOf, cities()),
    async evidence(query, context, claimId) {
      context.signal.throwIfAborted();
      const found = await locations(query.places, context, claimId);
      if (!found.length) return [];
      const today = startOfDay(query.asOf);
      // The archive lags some days behind, so recent past days come from the forecast API too.
      const useForecast = query.forecast || query.range.start >= addDays(today, -WEATHER.recentDays);
      const url = weatherRequestUrl(found, query.range, useForecast);
      const daily = parseWeather(await get(url, context, claimId), found.length);
      const sentence = weatherSentence(query, found.map((location, index) => ({ name: location.name, days: daily[index] })), today);
      if (!sentence) return [];
      return [freeEvidence({ origin: 'weather', url, title: query.forecast ? 'Open-Meteo forecast' : 'Open-Meteo weather records',
        publisher: OPEN_METEO_PUBLISHER, excerpt: sentence, retrievedAt: new Date(context.now()).toISOString(), sourceGroup: 'open-meteo.com' })];
    },
  };
}

/** A scripted WeatherService for tests; it reads the query with the real parser. */
export function createMockWeather(answer: Evidence[] | Error, cities?: CityList): WeatherService & { calls: WeatherQuery[] } {
  const calls: WeatherQuery[] = [];
  return {
    calls,
    query: (text, asOf) => parseWeatherQuery(text, asOf, cities ?? loadCities()),
    async evidence(query, context) {
      context.signal.throwIfAborted();
      calls.push(query);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}
