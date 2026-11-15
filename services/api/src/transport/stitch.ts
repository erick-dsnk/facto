/**
 * Stitches spoken claims that hesitation or a recogniser boundary split into several sentences, and keeps fragments from being checked.
 * Live examples: "Crocodiles are, uh," / "Uh Uh..." / "From the family of zebras." within 4 s, and "The Great Wall of China" /
 * "Is visible from space.". Pure: no timers, no I/O. Times are capture times in ms.
 */
import { DEFAULT_STITCH_MS } from './voice-level.js';

const FILLERS = new Set(['uh', 'uhh', 'um', 'umm', 'uhm', 'erm', 'er', 'ah', 'eh', 'hmm', 'hm', 'mm', 'mmm']);
/** Words a sentence does not end on: articles, prepositions, conjunctions, auxiliaries and possessives. */
const DANGLING = new Set(('a an the of to in on at by for with from into about over under between than as and or but nor so because if that which who ' +
  'whose whom where when while is are was were be been being am has have had will would can could should may might must do does did its their his ' +
  'her our your my this these those very not').split(' '));
/** Words that rarely open a sentence of their own, so after a finished-looking sentence they still continue it. */
const CONTINUES = new Set(['is', 'are', 'was', 'were', 'which', 'whose', 'whom', 'from', 'of', 'than', 'and']);
const ENDS_SENTENCE = /[.!?]["'”’)\]]*$/u;
const TRAILS_OFF = /(?:\.\.\.|…|[,;:\-–—])["'”’)\]]*$/u;
const bare = (token: string) => token.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** Ends with a comma, a dash, "…"/"...", a filler, or (without terminal punctuation) a dangling function word. */
export function looksUnfinished(text: string): boolean {
  const trimmed = text.trim();
  if (TRAILS_OFF.test(trimmed)) return true;
  const last = bare(words(trimmed).at(-1) ?? '');
  if (FILLERS.has(last)) return true;
  return !ENDS_SENTENCE.test(trimmed) && DANGLING.has(last);
}
const endsSentence = (text: string) => ENDS_SENTENCE.test(text.trim()) && !TRAILS_OFF.test(text.trim());
/** The first word is all lowercase ("from", "is"), so it continues something. "iPhone" and "eBay" open sentences of their own. */
function startsLowercase(text: string): boolean {
  const first = (words(text)[0] ?? '').replace(/^\P{L}+/u, '');
  return /^\p{Ll}/u.test(first) && !/\p{Lu}/u.test(first);
}
/** Opens with a lowercase letter, or with a continuation word in a sentence that is not a question ("Is visible from space."). */
function continues(text: string): boolean {
  const first = words(text)[0] ?? '';
  if (startsLowercase(text)) return true;
  return CONTINUES.has(bare(first)) && !/\?["'”’)\]]*$/u.test(text.trim());
}
/** The sentence without fillers ("uh," "Uh..."), keeping its terminal punctuation. Empty when it was only fillers. */
function withoutFillers(text: string): string {
  const kept = words(text).filter(token => !FILLERS.has(bare(token))).join(' ');
  const terminal = endsSentence(text) ? text.trim().match(/[.!?]["'”’)\]]*$/u)![0] : '';
  return terminal && kept && !endsSentence(kept) ? kept.replace(/[\s,;:\-–—]+$/u, '') + terminal : kept;
}
/** Joins parts into one sentence: no punctuation at the joins, and a continuation's function word lowercased ("from the family"). */
function join(texts: string[]): string {
  const parts = texts.map(withoutFillers).filter(Boolean);
  return parts.map((part, index) => {
    let text = index < parts.length - 1 ? part.replace(/(?:\.\.\.|[\s,;:.…\-–—])+$/u, '') : part;
    const first = words(text)[0] ?? '';
    if (index > 0 && (CONTINUES.has(bare(first)) || DANGLING.has(bare(first)) || /^(it|there|then)$/u.test(bare(first)))) text = text[0].toLowerCase() + text.slice(1);
    return text;
  }).join(' ').replace(/\s+/g, ' ').trim();
}

export type Sentence = { requestId: string; segmentId: string; text: string; speaker: number | null; atMs: number };
/**
 * - check: submit `text` under the first part's request (a stitched claim supersedes its fragments by being a revision of it).
 * - hold: a fragment, never checked on its own; it waits for a continuation. `cancel` names a check of an earlier, complete version
 *   of this sentence that a correction cut short, so it must not alert.
 * - skip: only fillers, nothing to check.
 */
/** A sentence or stitched claim to check. */
export type CheckStep = { action: 'check'; requestId: string; segmentId: string; text: string; speaker: number | null; atMs: number };
export type StitchStep =
  | { action: 'check' | 'hold'; requestId: string; segmentId: string; text: string; speaker: number | null; atMs: number; cancel?: string }
  | { action: 'skip' };

type Part = Sentence & { truncated: boolean; empty: boolean };
type Chain = { parts: Part[]; speaker: number | null };
const MEMORY = 64;
const MAX_CHAINS = 8;

/**
 * One per audio connection. A sentence joins the latest chain of the same speaker (or an unknown one) when it starts within `windowMs`
 * of that chain's last part and either the chain looks unfinished or the sentence continues it. Fragments are never checked on their
 * own: a chain that ends unfinished, starts lowercase, or whose last part a correction cut short (it lost its terminal punctuation) is
 * held. A correction of a part replaces that part.
 */
export class SentenceStitcher {
  private chains: Chain[] = [];
  private texts = new Map<string, string>();
  private submitted = new Set<string>();

  constructor(private readonly windowMs = DEFAULT_STITCH_MS) {}

  add(sentence: Sentence): StitchStep {
    const before = this.texts.get(sentence.requestId);
    this.texts.delete(sentence.requestId); this.texts.set(sentence.requestId, sentence.text);
    if (this.texts.size > MEMORY) this.texts.delete(this.texts.keys().next().value!);
    const part: Part = { ...sentence, truncated: before !== undefined && endsSentence(before) && !endsSentence(sentence.text), empty: !withoutFillers(sentence.text) };

    let chain = this.chains.find(candidate => candidate.parts.some(entry => entry.requestId === sentence.requestId));
    if (chain) chain.parts[chain.parts.findIndex(entry => entry.requestId === sentence.requestId)] = part;
    else {
      chain = this.chains.find(candidate => this.joins(candidate, part));
      if (chain) { chain.parts.push(part); if (chain.speaker === null) chain.speaker = part.speaker; }
      else {
        chain = { parts: [part], speaker: part.speaker };
        this.chains.unshift(chain);
        this.chains = this.chains.filter(candidate => sentence.atMs - (candidate.parts.at(-1)?.atMs ?? 0) <= Math.max(this.windowMs, 1) * 4).slice(0, MAX_CHAINS);
      }
    }
    // The most recently extended chain is the first one a later sentence tries.
    this.chains = [chain, ...this.chains.filter(candidate => candidate !== chain)];

    const head = chain.parts[0];
    const text = join(chain.parts.map(entry => entry.text));
    if (!text) return { action: 'skip' };
    const step = { requestId: head.requestId, segmentId: head.segmentId, text, speaker: chain.speaker, atMs: head.atMs };
    if (this.unfinished(chain) || startsLowercase(text)) {
      const cancel = this.submitted.delete(head.requestId) ? head.requestId : undefined;
      return { action: 'hold', ...step, ...(cancel ? { cancel } : {}) };
    }
    this.submitted.add(head.requestId);
    if (this.submitted.size > MEMORY) this.submitted.delete(this.submitted.values().next().value!);
    return { action: 'check', ...step };
  }

  /**
   * Checks, on its own, a chain that trailed off and got no continuation within the window ("The Eiffel Tower is in Berlin," and
   * then silence), so a held claim is never lost. A headless continuation ("from the family of zebras.") and a sentence a correction
   * cut short stay unchecked: fragments never alert. The chain stays, so a slow continuation or a late correction still joins it and
   * re-checks the whole claim as a newer revision.
   */
  release(nowMs: number): CheckStep[] {
    const due: CheckStep[] = [];
    for (const chain of this.chains) {
      if (nowMs - chain.parts.at(-1)!.atMs < this.windowMs) continue;
      const head = chain.parts[0];
      // It stands alone now: drop the trailing comma, dash or "…" it broke off on.
      const text = join(chain.parts.map(entry => entry.text)).replace(/(?:\.\.\.|[\s,;:…\-–—])+$/u, '');
      if (!text || this.submitted.has(head.requestId) || startsLowercase(text) || chain.parts.some(entry => entry.truncated) || !this.unfinished(chain)) continue;
      this.submitted.add(head.requestId);
      if (this.submitted.size > MEMORY) this.submitted.delete(this.submitted.values().next().value!);
      due.push({ action: 'check', requestId: head.requestId, segmentId: head.segmentId, text, speaker: chain.speaker, atMs: head.atMs });
    }
    return due;
  }

  /** A spoken trigger or anything else that ends the conversation thread: nothing joins what came before. */
  interrupt(): void { this.chains = []; }
  clear(): void { this.chains = []; this.texts.clear(); this.submitted.clear(); }

  private unfinished(chain: Chain): boolean {
    const last = [...chain.parts].reverse().find(entry => !entry.empty);
    // A chain that so far is only fillers, or whose last words trail off, waits for more.
    return !last || last.truncated || looksUnfinished(last.text) || chain.parts.at(-1)!.empty;
  }

  private joins(chain: Chain, part: Part): boolean {
    const last = chain.parts.at(-1)!;
    const sameSpeaker = chain.speaker === null || part.speaker === null || chain.speaker === part.speaker;
    const gap = part.atMs - last.atMs;
    return sameSpeaker && gap >= 0 && gap <= this.windowMs && (this.unfinished(chain) || continues(part.text));
  }
}
