import { z } from 'zod';
import { PipelineError, type Evidence, type ProviderContext, type SourceQuery } from '../../../../../packages/contracts/src/index.js';
import { freeEvidence } from '../../sources/evidence.js';
import { wikidataThrottle, wikimediaGet, type WikimediaThrottle } from '../wikimedia/throttle.js';
import { guardTexts, mentions, wikidataSubjects } from './lookup.js';
import { isDisambiguation, labelsNeeded, statementSentence, type WikidataEntity, type WikidataStatement, type WikidataValue } from './statements.js';

/** What the sources need from a database of facts about named things. A failure throws; nothing usable is []. */
export interface FactDatabase {
  evidence(query: Pick<SourceQuery, 'claimId' | 'text' | 'subject'>, context: ProviderContext): Promise<Evidence[]>;
}

export const WIKIDATA_ENDPOINT = 'https://www.wikidata.org/w/api.php';

const requestUrl = (items: Record<string, string>) =>
  `${WIKIDATA_ENDPOINT}?${new URLSearchParams(Object.entries(items).sort(([a], [b]) => (a < b ? -1 : 1)))}`;

export const searchRequestUrl = (subject: string) => requestUrl({
  action: 'wbsearchentities', search: Array.from(subject).slice(0, 100).join(''), language: 'en', uselang: 'en', type: 'item', limit: '5', format: 'json',
});
export const entityRequestUrl = (id: string) => requestUrl({ action: 'wbgetentities', ids: id, props: 'labels|aliases|claims', languages: 'en', format: 'json' });
export const labelsRequestUrl = (ids: string[]) => requestUrl({ action: 'wbgetentities', ids: ids.slice(0, 50).join('|'), props: 'labels', languages: 'en', format: 'json' });

const malformed = () => new PipelineError('malformed_wikidata_response');

export type WikidataHit = { id: string; names: string[] };
const searchSchema = z.object({
  search: z.array(z.object({
    id: z.string(), label: z.string().optional(), match: z.object({ text: z.string().optional() }).passthrough().optional(), aliases: z.array(z.string()).optional(),
  }).passthrough()).optional(),
}).passthrough();

/** Each hit's id with its label, the matched text and any aliases the search returned. */
export function parseWikidataSearch(body: unknown): WikidataHit[] {
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) throw malformed();
  return (parsed.data.search ?? []).map(item => ({
    id: item.id, names: [item.label, item.match?.text, ...(item.aliases ?? [])].filter((name): name is string => Boolean(name)),
  }));
}

const valueObject = z.record(z.string(), z.unknown());
const snakSchema = z.object({ snaktype: z.string().optional(), datavalue: z.object({ type: z.string(), value: z.unknown() }).passthrough().optional() }).passthrough();

/** A statement's value from its main snak or a qualifier, or null for no value and types the sentence does not use. */
export function snakValue(raw: unknown): WikidataValue | null {
  const snak = snakSchema.safeParse(raw);
  if (!snak.success || snak.data.snaktype !== 'value' || !snak.data.datavalue) return null;
  const { type, value } = snak.data.datavalue;
  const object = valueObject.safeParse(value);
  if (type === 'wikibase-entityid') return object.success && typeof object.data.id === 'string' ? { type: 'item', id: object.data.id } : null;
  if (type === 'quantity') {
    if (!object.success || typeof object.data.amount !== 'string') return null;
    const amount = Number(object.data.amount);
    if (!Number.isFinite(amount)) return null;
    const unitText = typeof object.data.unit === 'string' ? object.data.unit : '1';
    return { type: 'quantity', amount, unit: unitText === '1' ? null : unitText.split('/').at(-1) ?? null };
  }
  if (type === 'time') {
    if (!object.success || typeof object.data.time !== 'string') return null;
    return { type: 'time', time: object.data.time, precision: typeof object.data.precision === 'number' ? object.data.precision : 11 };
  }
  if (type === 'string') return typeof value === 'string' ? { type: 'text', text: value } : null;
  if (type === 'monolingualtext') return object.success && typeof object.data.text === 'string' ? { type: 'text', text: object.data.text } : null;
  return null;
}

const labelSchema = z.object({ en: z.object({ value: z.string() }).passthrough() }).passthrough();
const entitySchema = z.object({
  labels: labelSchema,
  aliases: z.object({ en: z.array(z.object({ value: z.string() }).passthrough()).optional() }).passthrough().optional(),
  claims: z.record(z.string(), z.array(z.object({
    mainsnak: z.unknown(), rank: z.string().optional(), qualifiers: z.record(z.string(), z.array(z.unknown())).optional(),
  }).passthrough())).optional(),
}).passthrough();
const entitiesSchema = z.object({ entities: z.record(z.string(), z.unknown()) }).passthrough();

/** The item with its English label, aliases and statements. Throws when the item or its English label is missing. */
export function parseWikidataEntity(body: unknown, id: string): WikidataEntity {
  const entities = entitiesSchema.safeParse(body);
  const entity = entities.success ? entitySchema.safeParse(entities.data.entities[id]) : null;
  if (!entity?.success) throw malformed();
  const statements: WikidataStatement[] = [];
  for (const [property, list] of Object.entries(entity.data.claims ?? {})) {
    for (const raw of list) {
      const value = snakValue(raw.mainsnak);
      if (!value) continue;
      const point = raw.qualifiers?.P585?.[0];
      const pointInTime = point === undefined ? null : snakValue(point);
      statements.push({ property, value, rank: raw.rank ?? 'normal', ...(pointInTime ? { pointInTime } : {}) });
    }
  }
  return { id, label: entity.data.labels.en.value, aliases: (entity.data.aliases?.en ?? []).map(alias => alias.value), statements };
}

/** English labels by item id. */
export function parseWikidataLabels(body: unknown): Record<string, string> {
  const entities = entitiesSchema.safeParse(body);
  if (!entities.success) throw malformed();
  const labels: Record<string, string> = {};
  for (const [id, raw] of Object.entries(entities.data.entities)) {
    const parsed = z.object({ labels: labelSchema }).passthrough().safeParse(raw);
    if (parsed.success) labels[id] = parsed.data.labels.en.value;
  }
  return labels;
}

/**
 * Wikidata through its Action API (port of WikidataClient): `wbsearchentities` finds the item for the claim's
 * subject, `wbgetentities` fetches its statements, and one more fetches the labels of the values: three
 * requests, the claim's whole allowance. The item's label or an alias must appear in the claim or its chosen
 * subject, else nothing comes of it: a wrong item adds nothing.
 */
export function createWikidata(options: { fetch?: typeof fetch; throttle?: WikimediaThrottle } = {}): FactDatabase {
  const fetcher = options.fetch ?? globalThis.fetch;
  const throttle = options.throttle ?? wikidataThrottle;
  return {
    async evidence(query, context) {
      const subject = wikidataSubjects(query.text, query.subject)[0];
      if (!subject) return [];
      const get = (url: string) => wikimediaGet({ fetch: fetcher, url, throttle, context, service: 'wikidata', claimId: query.claimId });
      const texts = guardTexts(query.text, query.subject);
      const hit = parseWikidataSearch(await get(searchRequestUrl(subject))).find(item => mentions(item.names, texts));
      if (!hit || !/^Q\d+$/.test(hit.id)) return [];
      const entity = parseWikidataEntity(await get(entityRequestUrl(hit.id)), hit.id);
      if (!mentions([entity.label, ...entity.aliases], texts) || isDisambiguation(entity)) return [];
      const ids = labelsNeeded(entity);
      const labels = ids.length ? parseWikidataLabels(await get(labelsRequestUrl(ids))) : {};
      const sentence = statementSentence(entity, texts.join(' '), labels);
      if (!sentence) return [];
      return [freeEvidence({ origin: 'wikidata', url: `https://www.wikidata.org/wiki/${entity.id}`, title: `${entity.label} - Wikidata`,
        publisher: 'Wikidata', excerpt: sentence, retrievedAt: new Date(context.now()).toISOString(), sourceGroup: 'wikidata.org' })];
    },
  };
}

/** A scripted FactDatabase for tests. */
export function createMockFactDatabase(answer: Evidence[] | Error): FactDatabase & { queries: Pick<SourceQuery, 'claimId' | 'text' | 'subject'>[] } {
  const queries: Pick<SourceQuery, 'claimId' | 'text' | 'subject'>[] = [];
  return {
    queries,
    async evidence(query, context) {
      context.signal.throwIfAborted();
      queries.push(query);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}
