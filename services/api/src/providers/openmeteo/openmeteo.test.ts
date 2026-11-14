import { describe, expect, it } from 'vitest';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { createTestContext, jsonResponse, recordingFetch } from '../../sources/testing.js';
import { createOpenMeteo, parseGeocode, parseWeather } from './client.js';
import { claimDates, isoDay, startOfDay } from './dates.js';
import { citiesIn, loadCities, parseWeatherQuery, weatherPlaces, weatherTopic } from './query.js';
import { weatherSentence, type Daily } from './report.js';

const friday = startOfDay('2026-11-13');
const cities = loadCities();
const range = (text: string, today = friday) => {
  const found = claimDates(text, today);
  return found ? [isoDay(found.start), isoDay(found.end)] : null;
};
const daily = (days: string[], values: Partial<Record<string, (number | null)[]>>) => ({
  daily: { time: days, temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], rain_sum: [], showers_sum: [], snowfall_sum: [],
    wind_gusts_10m_max: [], sunshine_duration: [], ...values },
});

describe('claim dates', () => {
  it('end of the week', () => {
    const finland = 'Snowy weather is rolling into a large part of Finland toward the end of the week.';
    expect(range(finland)).toEqual(['2026-11-13', '2026-11-15']);
    expect(range(finland, startOfDay('2026-11-09'))).toEqual(['2026-11-12', '2026-11-15']);
    expect(range('Rain later this week', startOfDay('2026-11-09'))).toEqual(['2026-11-10', '2026-11-15']);
  });

  it('days around today', () => {
    expect(range('It snowed in Oslo yesterday.')).toEqual(['2026-11-12', '2026-11-12']);
    expect(range('It will rain in Paris tomorrow.')).toEqual(['2026-11-14', '2026-11-14']);
    expect(range('Storms hit Rome today')).toEqual(['2026-11-13', '2026-11-13']);
    expect(range('Heavy rain is expected over the next few days')).toEqual(['2026-11-13', '2026-11-16']);
    expect(range('Rain over the next 5 days')).toEqual(['2026-11-13', '2026-11-17']);
  });

  it('weekends and weeks', () => {
    expect(range('Snow is forecast this weekend')).toEqual(['2026-11-14', '2026-11-15']);
    expect(range('It was freezing in Berlin last weekend')).toEqual(['2026-11-07', '2026-11-08']);
    expect(range('It was cold over the weekend')).toEqual(['2026-11-07', '2026-11-08']);
    expect(range('Temperatures will drop next week')).toEqual(['2026-11-16', '2026-11-22']);
    expect(range('It rained every day last week')).toEqual(['2026-11-02', '2026-11-08']);
    expect(range('Snow early next week')).toEqual(['2026-11-16', '2026-11-18']);
  });

  it('weekdays follow the tense', () => {
    expect(range('It rained in Oslo on Tuesday.')).toEqual(['2026-11-10', '2026-11-10']);
    expect(range('Snow will hit Oslo on Tuesday.')).toEqual(['2026-11-17', '2026-11-17']);
    expect(range('Sunshine in Madrid next Monday')).toEqual(['2026-11-16', '2026-11-16']);
  });

  it('written-out dates', () => {
    expect(range('London had snow on 28 February 2018.')).toEqual(['2018-02-28', '2018-02-28']);
    expect(range('It snowed in London from 26 February to 2 March 2018.')![0]).toBe('2018-02-26');
    expect(range('Paris was hot on 12 November')).toEqual(['2026-11-12', '2026-11-12']);
    expect(range('Rain in Oslo on Feb 28, 2018')).toEqual(['2018-02-28', '2018-02-28']);
    expect(range('Rain in Oslo on 2018-02-28')).toEqual(['2018-02-28', '2018-02-28']);
  });

  it('no time, or too long, is nothing', () => {
    expect(range('It is often rainy in Bergen.')).toBeNull();
    expect(range('Helsinki had a snowy winter in 2021.')).toBeNull();
    expect(range('It snowed in Oslo from 1 January 2021 to 30 March 2021.')).toBeNull();
    expect(range('Rain at 5 pm in Oslo')).toBeNull();
  });
});

describe('weather places and topics', () => {
  it('a country samples its largest cities', () => {
    expect(citiesIn(cities, 'FI').map(city => city.name)).toEqual(['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu']);
    const query = parseWeatherQuery('Snowy weather is rolling into a large part of Finland toward the end of the week.', '2026-11-13', cities)!;
    expect(query.places).toEqual([{ type: 'country', code: 'FI', name: 'Finland' }]);
    expect(query.topic).toBe('snow');
    expect(query.forecast).toBe(true);
  });

  it('cities and lookalikes', () => {
    expect(weatherPlaces('It will snow in Helsinki tomorrow', cities)).toEqual([{ type: 'named', name: 'Helsinki' }]);
    expect(weatherPlaces('Record heat in New Mexico today', cities)).not.toEqual([{ type: 'country', code: 'MX', name: 'Mexico' }]);
    expect(weatherPlaces('Rain across the UK this weekend', cities)).toEqual([{ type: 'country', code: 'GB', name: 'United Kingdom' }]);
    expect(weatherPlaces('Atlanta, Georgia will see snow tomorrow', cities)).toEqual([{ type: 'named', name: 'Atlanta' }]);
    expect(weatherPlaces('It will be sunny tomorrow', cities)).toEqual([]);
  });

  it('no place, or days beyond the window, is nothing', () => {
    const parse = (text: string) => parseWeatherQuery(text, '2026-11-13', cities);
    expect(parse('It will be sunny tomorrow.')).toBeNull();
    expect(parse('It will snow in Oslo on 30 December 2026.')).toBeNull();
    expect(parse('It snowed in Oslo on 3 March 1900.')).toBeNull();
    expect(parse('London had snow on 28 February 2018.')?.forecast).toBe(false);
  });

  it('topics', () => {
    expect(weatherTopic('A blizzard is coming')).toBe('snow');
    expect(weatherTopic('Heavy showers expected')).toBe('rain');
    expect(weatherTopic('Gale force winds')).toBe('wind');
    expect(weatherTopic('It will be 30 °C')).toBe('temperature');
    expect(weatherTopic('Clear skies all day')).toBe('sun');
    expect(weatherTopic('Nice weather in Rome')).toBe('general');
  });

  it('the sentence lists where it fell', () => {
    const query = { places: [], range: { start: startOfDay('2026-11-14'), end: startOfDay('2026-11-14') }, topic: 'snow' as const, forecast: true, asOf: '2026-11-13' };
    const day = (snow: number, high: number): Daily => ({ days: ['2026-11-14'], high: [high], low: [0], precipitation: [0], rain: [0], showers: [0], snow: [snow], gusts: [0], sunshine: [0] });
    expect(weatherSentence(query, [{ name: 'Oulu', days: day(4.3, 3) }, { name: 'Espoo', days: day(0, 3) }], friday))
      .toBe('Open-Meteo forecast, Sat 14 Nov: snowfall in Oulu (4.3 cm); none in Espoo. Daytime highs 3 °C.');
    expect(weatherSentence(query, [{ name: 'Oulu', days: { ...day(0, 0), high: [null] } }], friday)).toBeNull();
  });
});

describe('S1 and S7 Open-Meteo', () => {
  it('S7: "It will snow in Helsinki tomorrow." sends one forecast request with only coordinates and dates', async () => {
    const recorded = recordingFetch(() => jsonResponse(daily(['2026-11-14'], { temperature_2m_max: [1.5], temperature_2m_min: [-2], snowfall_sum: [2.1], rain_sum: [0], showers_sum: [0] })));
    const weather = createOpenMeteo({ fetch: recorded.fetch, cities });
    const query = weather.query('It will snow in Helsinki tomorrow.', '2026-11-13')!;
    const context = createTestContext();
    const [evidence] = await weather.evidence(query, context, 'c1');
    expect(recorded.requests).toHaveLength(1);
    const url = new URL(recorded.requests[0].url);
    expect(url.host).toBe('api.open-meteo.com');
    expect(url.searchParams.get('start_date')).toBe('2026-11-14');
    expect(url.searchParams.get('end_date')).toBe('2026-11-14');
    expect(url.searchParams.get('latitude')).toBe('60.1695');
    for (const word of ['Helsinki', 'tomorrow', 'will', 'It%20']) expect(recorded.requests[0].url).not.toContain(word);
    expect(evidenceSchema.parse(evidence)).toBeTruthy();
    expect(evidence).toMatchObject({ origin: 'weather', url: recorded.requests[0].url, title: 'Open-Meteo forecast', publisher: 'Open-Meteo', sourceGroup: 'open-meteo.com',
      excerpt: 'Open-Meteo forecast, Sat 14 Nov: snowfall in Helsinki (2.1 cm). Daytime highs 1.5 °C.' });
    expect(context.used('weather', 'c1')).toBe(1);
  });

  it('a country needs no geocoding; all five places go in one request', async () => {
    const days = ['2026-11-13', '2026-11-14', '2026-11-15'];
    const five = ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu'].map((_, index) =>
      daily(days, { temperature_2m_max: [6, 4, 9], temperature_2m_min: [1, 1, 1], snowfall_sum: index === 4 ? [2, 3, 0.7] : [0, 0, 0] }));
    const recorded = recordingFetch(() => jsonResponse(five));
    const weather = createOpenMeteo({ fetch: recorded.fetch, cities });
    const query = weather.query('Snowy weather is rolling into a large part of Finland toward the end of the week.', '2026-11-13')!;
    const [evidence] = await weather.evidence(query, createTestContext(), 'c1');
    expect(recorded.requests).toHaveLength(1);
    expect(new URL(recorded.requests[0].url).searchParams.get('latitude')!.split(',')).toHaveLength(5);
    expect(evidence.excerpt.startsWith('Open-Meteo forecast, Fri 13 to Sun 15 Nov: snowfall in Oulu (5.7 cm); none in Helsinki, Espoo, Tampere or Vantaa.')).toBe(true);
  });

  it('an unlisted place is geocoded and the past goes to the archive', async () => {
    const recorded = recordingFetch(request => request.url.includes('geocoding-api')
      ? jsonResponse({ results: [{ id: 1, name: 'Lillehammer', latitude: 61.115, longitude: 10.4662, feature_code: 'PPLA', country_code: 'NO' }] })
      : jsonResponse(daily(['2018-02-28'], { temperature_2m_max: [-3], snowfall_sum: [7.6] })));
    const weather = createOpenMeteo({ fetch: recorded.fetch, cities });
    const query = weather.query('It snowed in Lillehammer on 28 February 2018.', '2026-11-13')!;
    const [evidence] = await weather.evidence(query, createTestContext(), 'c1');
    expect(recorded.requests).toHaveLength(2);
    expect(new URL(recorded.requests[0].url).searchParams.get('name')).toBe('Lillehammer');
    expect(new URL(recorded.requests[1].url).host).toBe('archive-api.open-meteo.com');
    expect(recorded.requests[1].url).not.toContain('showers');
    expect(evidence.title).toBe('Open-Meteo weather records');
    expect(evidence.excerpt.startsWith('Open-Meteo weather records, Wed 28 Feb 2018: snowfall in Lillehammer (7.6 cm).')).toBe(true);
  });

  it('a failure throws, nothing found is empty, malformed bodies throw', async () => {
    const query = parseWeatherQuery('It will snow in Helsinki tomorrow.', '2026-11-13', cities)!;
    await expect(createOpenMeteo({ fetch: recordingFetch(() => jsonResponse('', 500)).fetch, cities }).evidence(query, createTestContext(), 'c'))
      .rejects.toMatchObject({ code: 'weather_unavailable' });
    expect(await createOpenMeteo({ fetch: recordingFetch(() => jsonResponse(daily(['2026-11-14'], {}))).fetch, cities }).evidence(query, createTestContext(), 'c')).toEqual([]);
    expect(() => parseWeather({ daily: { time: 'x' } }, 1)).toThrow(PipelineError);
    expect(() => parseWeather([daily([], {}), daily([], {})], 1)).toThrow(PipelineError);
    expect(() => parseGeocode({ results: [{ name: 1 }] })).toThrow(PipelineError);
    expect(parseGeocode({})).toBeNull();
  });
});
