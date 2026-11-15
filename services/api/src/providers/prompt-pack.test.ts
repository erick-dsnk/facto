import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createClassifier } from './jev/classification.js';
import { createJudge } from './jev/judgment.js';
import { admissionScenarios, capturingClient, digestOf, fixedContext, judgeScenarios, serializeRequest } from './prompt-pack.scenarios.js';

const golden = JSON.parse(readFileSync(new URL('./prompt-pack.golden.json', import.meta.url), 'utf8')) as Record<string, { sha256: string; bytes: number; questions: string[] }>;

describe('built-in prompt pack', () => {
  // The golden digests were generated from the code as it was before prompt packs existed.
  for (const [name, input] of Object.entries(admissionScenarios)) it(`sends the same admission request as before: ${name}`, async () => {
    const client = capturingClient(); await createClassifier(client)(input, fixedContext()).catch(() => undefined);
    const request = client.requests[0];
    expect(Object.keys(request.questions)).toEqual(golden[`admission:${name}`].questions);
    expect(digestOf(serializeRequest(request))).toMatchObject({ sha256: golden[`admission:${name}`].sha256, bytes: golden[`admission:${name}`].bytes });
  });
  for (const [name, scenario] of Object.entries(judgeScenarios)) it(`sends the same judgment request as before: ${name}`, async () => {
    const client = capturingClient(); await createJudge(client)(scenario.claim, scenario.evidence, fixedContext()).catch(() => undefined);
    const request = client.requests[0];
    expect(Object.keys(request.questions)).toEqual(golden[`judge:${name}`].questions);
    expect(digestOf(serializeRequest(request))).toMatchObject({ sha256: golden[`judge:${name}`].sha256, bytes: golden[`judge:${name}`].bytes });
  });
});

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JevAnswer, JevClient, JevRequest } from './jev/client.js';
import { DEFAULT_PROMPT_PACK, PROMPT_PACKS, loadPromptPack, packForProvider, resolvePromptPack } from './prompt-pack.js';

/** Answers every question: the first listed option at probability 1, and a fixed score for yes/no questions. */
function scripted(noul = 0, pick: Record<string, string> = {}): JevClient & { requests: JevRequest[] } {
  const requests: JevRequest[] = [];
  return { requests, async ask(request) {
    requests.push(request);
    return Object.fromEntries(Object.entries(request.questions).map(([name, question]): [string, JevAnswer] => {
      if (question.type === 'noul') return [name, { noul: noul }];
      const keys = Object.keys(question.criteria); const chosen = Object.entries(pick).find(([suffix]) => name.endsWith(suffix))?.[1] ?? keys[0];
      return [name, { choice: chosen, probabilities: Object.fromEntries(keys.map(key => [key, key === chosen ? 1 : 0])) }];
    }));
  } };
}

describe('prompt pack files', () => {
  it('resolves an empty file to the built-in pack and registers it for both providers', () => {
    expect(resolvePromptPack({})).toEqual(DEFAULT_PROMPT_PACK);
    expect(PROMPT_PACKS.jev).toBe(DEFAULT_PROMPT_PACK); expect(packForProvider('jev')).toBe(DEFAULT_PROMPT_PACK);
  });
  it('loads the committed per-provider packs: Laya ships its tuned pack, the Jev pack is opt-in and the Jev default stays built-in (docs/per-provider-prompts.md)', async () => {
    const jev = await loadPromptPack(new URL('./packs/jev.json', import.meta.url).pathname);
    expect(jev.name).toBe('jev-stack-1');
    expect(jev).not.toEqual(DEFAULT_PROMPT_PACK);
    expect(PROMPT_PACKS.jev).toBe(DEFAULT_PROMPT_PACK);
    const laya = await loadPromptPack(new URL('./packs/laya.json', import.meta.url).pathname);
    expect(laya.name).toBe('laya-structure-r2a2');
    expect(laya).not.toEqual(DEFAULT_PROMPT_PACK);
    expect(PROMPT_PACKS.laya).toEqual(laya);
    expect(packForProvider('laya')).toBe(PROMPT_PACKS.laya);
  });
  it('rejects unknown keys, options with no canonical answer and bad option maps', () => {
    expect(() => resolvePromptPack({ admission: { thresholdz: {} } })).toThrow(/prompt_pack_invalid/);
    expect(() => resolvePromptPack({ judge: { verdict: { criteria: { yes: 'a', no: 'b' } } } })).toThrow(/needs an optionMap/);
    expect(() => resolvePromptPack({ judge: { verdict: { criteria: { yes: 'a', no: 'b' }, optionMap: { yes: 'supported', no: 'bogus' } } } })).toThrow(/not one of/);
    expect(() => resolvePromptPack({ judge: { verdict: { criteria: { supported: 'a' } } } })).toThrow(/at least two/);
    expect(() => resolvePromptPack({ judge: { thresholds: { scope: 2 } } })).toThrow(/prompt_pack_invalid/);
  });
  it('loads a pack from a JSON file', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'pack-')), 'p.json'); await writeFile(path, JSON.stringify({ name: 'mine', admission: { prefix: 'Assess {id}. ' } }));
    const pack = await loadPromptPack(path); expect(pack.name).toBe('mine'); expect(pack.admission.prefix).toBe('Assess {id}. ');
    await expect(loadPromptPack(`${path}.missing`)).rejects.toThrow(/prompt_pack_unreadable/);
  });
  it('collapses a merged verdict option set back to canonical answers', async () => {
    const pack = resolvePromptPack({ judge: { verdict: { criteria: { true: 'True', false: 'False', unsure: 'Unsure' }, optionMap: { true: 'supported', false: 'contradicted', unsure: 'insufficient_evidence' } } } });
    const client = scripted(0.9); const { claim, evidence } = judgeScenarios.plain;
    const judgment = await createJudge(client, pack)(claim, evidence, fixedContext());
    expect(Object.keys((client.requests[0].questions.verdict as { criteria: object }).criteria)).toEqual(['true', 'false', 'unsure']);
    expect(judgment.label).toBe('supported');
    expect(judgment.probabilities).toEqual({ supported: 1, contradicted: 0, misleading: 0, insufficient_evidence: 0 });
  });
  it('sums probabilities of options that share a canonical answer', async () => {
    const pack = resolvePromptPack({ judge: { verdict: { criteria: { yes: 'Yes', no: 'No', maybe: 'Maybe', unsure: 'Unsure' }, optionMap: { yes: 'supported', no: 'contradicted', maybe: 'supported', unsure: 'insufficient_evidence' } } } });
    const client: JevClient = { async ask(request) {
      const answers = await scripted(0.9).ask(request, fixedContext());
      answers.verdict = { choice: 'yes', probabilities: { yes: 0.4, no: 0.1, maybe: 0.3, unsure: 0.2 } }; return answers;
    } };
    const { claim, evidence } = judgeScenarios.one_evidence;
    expect((await createJudge(client, pack)(claim, evidence, fixedContext())).probabilities).toEqual({ supported: 0.7, contradicted: 0.1, misleading: 0, insufficient_evidence: 0.2 });
  });
  it('changes evidence serialization: order, count, excerpt length, fields and labels', async () => {
    const pack = resolvePromptPack({ judge: { evidence: { maxItems: 2, order: 'reversed', excerptChars: 12, fields: ['id', 'excerpt'], labels: { excerpt: 'text' }, stateLabels: { evidence: 'passages' } } } });
    const client = scripted(0.9); const { claim, evidence } = judgeScenarios.plain;
    await createJudge(client, pack)(claim, evidence, fixedContext());
    const state = client.requests[0].state as { passages: Record<string, string>[] };
    expect(state.passages).toEqual([{ id: 'w2', text: 'Excerpt w2: ' }, { id: 'w1', text: 'Excerpt w1: ' }]);
    expect(Object.keys(client.requests[0].questions).filter(name => name.endsWith('_content_basis'))).toEqual(['e0_content_basis', 'e1_content_basis']);
  });
  it('applies judge probability thresholds and policy rules from the pack', async () => {
    const strict = resolvePromptPack({ judge: { thresholds: { relevant: 0.95 } } });
    const { claim, evidence } = judgeScenarios.one_evidence;
    expect((await createJudge(scripted(0.9), strict)(claim, evidence, fixedContext())).evidence[0].directlyAddressesClaim).toBe(false);
    expect((await createJudge(scripted(0.9))(claim, evidence, fixedContext())).evidence[0].directlyAddressesClaim).toBe(true);
    expect(resolvePromptPack({ judge: { policy: { minProbabilityTrue: 0.9 } } }).judge.policy).toMatchObject({ minProbabilityTrue: 0.9, minProbabilityFalse: 0.7 });
  });
  it('lets admission use fewer options and its own thresholds', async () => {
    const pack = resolvePromptPack({ admission: { choice: { kind: { criteria: { fact: 'A checkable fact', other: 'Anything else' }, optionMap: { fact: 'claim' } } } } });
    const client = scripted(0.9, { _source: 'none', _attribution: 'none', _claim_structure: 'one_coherent', _route: 'general' });
    // privacy questions answer 0.9 too, so use a client that scores privacy low
    const answer = async (request: JevRequest) => { const out = await client.ask(request, fixedContext()); for (const name of Object.keys(out)) if (/_(private_data|private_life|rumour|future|subject_private)$/.test(name)) out[name] = { noul: 0 }; return out; };
    const result = await createClassifier({ ask: answer }, pack)(admissionScenarios.plain, fixedContext());
    expect(result.action).toBe('check');
    expect(Object.keys((client.requests[0].questions.span_0_kind as { criteria: object }).criteria)).toEqual(['fact', 'other']);
    const strict = resolvePromptPack({ admission: { thresholds: { selfContained: 0.99 } } });
    expect((await createClassifier({ ask: answer }, strict)(admissionScenarios.quoted, fixedContext())).action).toBe('skip');
  });
});
