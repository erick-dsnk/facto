import { readFileSync } from 'node:fs';
import { stripWww } from './evidence.js';

/**
 * The domain lists in ./data (ported from the reference app, see data/README.md for sources and licences):
 * unreliable sites (CRED-1, CC BY 4.0) and low-signal sites are never evidence, trusted sites rank first,
 * and publisher names label sources. An entry covers its subdomains.
 */
export type DomainLists = {
  /** Unreliable or low-signal: never evidence. */
  isBlocked(host: string): boolean;
  isTrusted(host: string): boolean;
  /** One site for the per-site cap and the one-voice-per-site rule. */
  siteKey(host: string): string;
  /** A display name such as "NASA" for nasa.gov, or null when the site is not listed. */
  publisher(host: string): string | null;
};

/** A set of domains where an entry also covers its subdomains, so `wikipedia.org` matches `en.m.wikipedia.org`. */
export class DomainSet {
  readonly domains: Set<string>;
  constructor(domains: Iterable<string>) { this.domains = new Set([...domains].map(domain => stripWww(domain.toLowerCase()))); }
  /** The entry that covers `host`, if any. */
  entry(host: string): string | null {
    let rest = stripWww(host.toLowerCase());
    while (rest) {
      if (this.domains.has(rest)) return rest;
      const dot = rest.indexOf('.');
      if (dot < 0) return null;
      rest = rest.slice(dot + 1);
    }
    return null;
  }
  has(host: string): boolean { return this.entry(host) !== null; }
}

/** One domain per line; `#` starts a comment; a trailing `# query` marks a site-restricted search domain. */
export function parseDomainList(text: string): { domains: string[]; query: string[] } {
  const domains: string[] = [];
  const query: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const hash = raw.indexOf('#');
    const domain = stripWww((hash < 0 ? raw : raw.slice(0, hash)).trim().toLowerCase());
    if (!domain || /\s/.test(domain)) continue;
    domains.push(domain);
    if (hash >= 0 && raw.slice(hash + 1).trim().toLowerCase() === 'query') query.push(domain);
  }
  return { domains, query };
}

/** `site  Name` per line (two or more spaces between); `#` starts a comment. */
export function parsePublishers(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    const gap = line.indexOf('  ');
    if (gap < 0) continue;
    const site = stripWww(line.slice(0, gap).toLowerCase());
    const name = line.slice(gap).trim();
    if (site && !/\s/.test(site) && name) names.set(site, name);
  }
  return names;
}

const secondLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'or', 'ne', 'go']);

export type DomainListData = { unreliable?: Iterable<string>; lowSignal?: Iterable<string>; trusted?: Iterable<string>; publishers?: Map<string, string> | Record<string, string> };

/** Lists from explicit data; tests and mocks use this, `loadDomainLists()` reads the shipped files. */
export function createDomainLists(data: DomainListData = {}): DomainLists & { unreliable: DomainSet; lowSignal: DomainSet; trusted: DomainSet } {
  const unreliable = new DomainSet(data.unreliable ?? []);
  const lowSignal = new DomainSet(data.lowSignal ?? []);
  const trusted = new DomainSet(data.trusted ?? []);
  const publishers = data.publishers instanceof Map ? data.publishers : new Map(Object.entries(data.publishers ?? {}));
  return {
    unreliable, lowSignal, trusted,
    isBlocked: host => unreliable.has(host) || lowSignal.has(host),
    isTrusted: host => trusted.has(host),
    siteKey(host) {
      for (const list of [trusted, lowSignal, unreliable]) {
        const entry = list.entry(host);
        if (entry) return entry;
      }
      const labels = stripWww(host.toLowerCase()).split('.').filter(Boolean);
      if (labels.length <= 2) return labels.join('.');
      const take = labels.at(-1)!.length === 2 && secondLevel.has(labels.at(-2)!) ? 3 : 2;
      return labels.slice(-take).join('.');
    },
    publisher(host) {
      let rest = stripWww(host.toLowerCase());
      while (rest) {
        const name = publishers.get(rest);
        if (name) return name;
        const dot = rest.indexOf('.');
        if (dot < 0) break;
        rest = rest.slice(dot + 1);
      }
      return null;
    },
  };
}

/** Where the shipped lists live; the Docker image ships `services/api/src/`, so they travel with the code. */
export const DATA_DIRECTORY = new URL('./data/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, DATA_DIRECTORY), 'utf8');

let shipped: ReturnType<typeof createDomainLists> | undefined;

/** The shipped lists, read once. A missing file is a deployment error and throws at startup. */
export function loadDomainLists(): ReturnType<typeof createDomainLists> {
  shipped ??= createDomainLists({
    unreliable: parseDomainList(read('unreliable-domains.txt')).domains,
    lowSignal: parseDomainList(read('low-signal-domains.txt')).domains,
    trusted: parseDomainList(read('trusted-domains.txt')).domains,
    publishers: parsePublishers(read('publisher-names.txt')),
  });
  return shipped;
}
