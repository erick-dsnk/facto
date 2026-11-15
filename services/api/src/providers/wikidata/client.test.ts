import { describe, expect, it } from 'vitest';
import { PipelineError } from '../../../../../packages/contracts/src/index.js';
import { evidenceSchema } from '../../../../../packages/contracts/src/wire.js';
import { createTestContext, jsonResponse, recordingFetch } from '../../sources/testing.js';
import { WikimediaThrottle } from '../wikimedia/throttle.js';
import { createWikidata, parseWikidataEntity, parseWikidataLabels, parseWikidataSearch } from './client.js';
import { mentions, wikidataSubjects } from './lookup.js';
import { describe as describeValue, describeTime, numbers, statementSentence } from './statements.js';

const item = (id: string) => ({ snaktype: 'value', datavalue: { value: { 'entity-type': 'item', id }, type: 'wikibase-entityid' } });
const quantity = (amount: string, unit: string) => ({ snaktype: 'value', datavalue: { value: { amount, unit }, type: 'quantity' } });
const claim = (mainsnak: unknown, extra: Record<string, unknown> = {}) => ({ mainsnak, type: 'statement', rank: 'normal', ...extra });

/** Recorded shapes, trimmed from Wikidata's answers for Mount Kilimanjaro (CC0). */
const search = { searchinfo: { search: 'Mount Kilimanjaro' }, search: [
  { id: 'Q7296', label: 'Mount Kilimanjaro', description: 'mountain massif', match: { type: 'label', language: 'en', text: 'Mount Kilimanjaro' } },
  { id: 'Q4126733', label: 'Mount Kilimanjaro climbing routes', match: { type: 'label', language: 'en', text: 'Mount Kilimanjaro climbing routes' } },
] };
const entity = { entities: { Q7296: { type: 'item', id: 'Q7296', labels: { en: { language: 'en', value: 'Mount Kilimanjaro' } },
  aliases: { en: [{ language: 'en', value: 'Kilimanjaro' }, { language: 'en', value: 'Mt. Kilimanjaro' }] },
  claims: {
    P610: [claim(item('Q1394606'))], P131: [claim(item('Q328922'))], P31: [claim(item('Q1061151')), claim(item('Q1325302'))],
    P17: [claim(item('Q924'))], P30: [claim(item('Q15'))], P2044: [claim(quantity('+5895', 'http://www.wikidata.org/entity/Q11573'))],
    P706: [claim(item('Q81591'))],
  } } }, success: 1 };
const labels = { entities: {
  Q1394606: { labels: { en: { value: 'Mount Kibo' } } }, Q328922: { labels: { en: { value: 'Kilimanjaro Region' } } }, Q924: { labels: { en: { value: 'Tanzania' } } },
  Q15: { labels: { en: { value: 'Africa' } } }, Q81591: { labels: { en: { value: 'Great Rift Valley' } } },
}, success: 1 };

const replying = () => recordingFetch(request => {
  const params = new URL(request.url).searchParams;
  if (params.get('action') === 'wbsearchentities') return jsonResponse(search);
  return jsonResponse(params.get('props') === 'labels' ? labels : entity);
});

describe('S1 wikidata', () => {
  it('turns the relevant statements into one schema-valid sentence in three requests', async () => {
    const recorded = replying();
    const context = createTestContext();
    const found = await createWikidata({ fetch: recorded.fetch, throttle: new WikimediaThrottle() })
      .evidence({ claimId: 'c1', text: 'Mount Kilimanjaro is about 5,895 metres high.', subject: null }, context);
    expect(recorded.requests).toHaveLength(3);
    expect(new URL(recorded.requests[0].url).searchParams.get('search')).toBe('Mount Kilimanjaro');
    for (const request of recorded.requests) expect(request.headers['user-agent']).toBe('FactoFactCheck/1.0 (Junction 2026 hackathon)');
    expect(found).toHaveLength(1);
    expect(evidenceSchema.parse(found[0])).toBeTruthy();
    expect(found[0]).toMatchObject({ origin: 'wikidata', url: 'https://www.wikidata.org/wiki/Q7296', title: 'Mount Kilimanjaro - Wikidata', publisher: 'Wikidata', sourceGroup: 'wikidata.org' });
    expect(found[0].excerpt.startsWith('Mount Kilimanjaro: elevation above sea level 5,895 m')).toBe(true);
    expect(found[0].excerpt.split(';').length).toBeLessThanOrEqual(4);
    expect(context.used('wikidata', 'c1')).toBe(3);
  });

  it('a wrong item adds nothing after one request', async () => {
    const recorded = recordingFetch(() => jsonResponse({ search: [{ id: 'Q1', label: 'Something Else' }] }));
    const found = await createWikidata({ fetch: recorded.fetch, throttle: new WikimediaThrottle() })
      .evidence({ claimId: 'c1', text: 'Mount Kilimanjaro is high.', subject: null }, createTestContext());
    expect(found).toEqual([]);
    expect(recorded.requests).toHaveLength(1);
  });

  it('a claim that names nothing sends nothing', async () => {
    const recorded = replying();
    expect(await createWikidata({ fetch: recorded.fetch, throttle: new WikimediaThrottle() }).evidence({ claimId: 'c', text: 'it is high.', subject: null }, createTestContext())).toEqual([]);
    expect(recorded.requests).toHaveLength(0);
  });

  it('malformed bodies throw', () => {
    expect(() => parseWikidataSearch({ search: 'x' })).toThrow(PipelineError);
    expect(() => parseWikidataEntity({ entities: {} }, 'Q7296')).toThrow(PipelineError);
    expect(() => parseWikidataEntity('x', 'Q7296')).toThrow(PipelineError);
    expect(() => parseWikidataLabels([])).toThrow(PipelineError);
  });

  it('the guard reads whole words without case or accents', () => {
    expect(mentions(['Kilimanjaro'], ['mount kilimanjaro is high'])).toBe(true);
    expect(mentions(['Bogotá'], ['Bogota is the capital of Colombia.'])).toBe(true);
    expect(mentions(['bat'], ['Bats are blind.'])).toBe(false);
    expect(mentions(['Paris'], ['The Danube flows into the North Sea.'])).toBe(false);
    expect(mentions(['Albert Einstein'], ['He was born in Ulm.', 'Albert Einstein'])).toBe(true);
  });

  it('subjects: the chosen subject first, then short capitalized names', () => {
    expect(wikidataSubjects('The Danube flows into the North Sea.', null)).toEqual(['Danube', 'North Sea']);
    expect(wikidataSubjects('He was born in Ulm.', 'Albert Einstein')[0]).toBe('Albert Einstein');
  });

  it('statements are ranked and capped; values read in words', () => {
    const parsed = parseWikidataEntity(entity, 'Q7296');
    const names = parseWikidataLabels(labels);
    const located = statementSentence(parsed, 'Mount Kilimanjaro is located in Tanzania.', names)!;
    expect(located).toContain('country Tanzania');
    expect(located).not.toContain('elevation');
    expect(statementSentence(parsed, 'Mount Kilimanjaro is beautiful.', names)).toBeNull();
    expect(describeTime('+1879-03-14T00:00:00Z', 11)).toBe('14 March 1879');
    expect(describeTime('+1879-00-00T00:00:00Z', 9)).toBe('1879');
    expect(describeTime('-0500-00-00T00:00:00Z', 9)).toBe('500 BC');
    expect(describeTime('+1801-00-00T00:00:00Z', 7)).toBe('19th century');
    expect(describeValue({ property: 'P1082', value: { type: 'quantity', amount: 1716961, unit: null }, rank: 'normal',
      pointInTime: { type: 'time', time: '+2021-00-00T00:00:00Z', precision: 9 } }, {})).toBe('1,716,961 (2021)');
    expect(numbers('about 1.7 million people and 5,895 m')).toEqual([1_700_000, 5895]);
    expect(numbers('1,716,961 people')).toEqual([1716961]);
  });
});
