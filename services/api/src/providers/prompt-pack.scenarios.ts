import type { AcceptedClaim, Evidence, ProviderContext, TextInput } from '../../../../packages/contracts/src/index.js';
import { createHash } from 'node:crypto';
import type { JevClient, JevRequest } from './jev/client.js';

/** Fixed inputs for the "default pack reproduces the pre-pack requests byte for byte" test. Independent of the code under test. */
const NOW = Date.parse('2026-11-14T12:00:00Z');
export const fixedContext = (): ProviderContext => ({ signal: new AbortController().signal, now: () => NOW, consume: () => undefined });

const input = (text: string, extra: Partial<TextInput> & { capture?: Partial<TextInput['capture']> } = {}): TextInput => {
  const { capture, ...rest } = extra;
  return { schemaVersion: 1, requestId: 'req-1', sessionId: 'sess-1', sessionEpoch: 1, revision: 1, mode: 'typed', text, language: 'en', capturedAt: '2026-11-14T12:00:00.000Z',
    capture: { source: 'typed_fixture', segmentId: 'seg-1', confidence: 1, final: true, ...capture }, context: [], userInitiated: true, ...rest } as TextInput;
};
export const admissionScenarios: Record<string, TextInput> = {
  plain: input('The Eiffel Tower is 330 metres tall.'),
  attributed_subject: input('According to Reuters, he said the company will close 200 stores and it lost money.', { context: ['Tim Cook spoke about Apple on Tuesday.', 'Apple is based in Cupertino.'] }),
  audio_low_confidence: input('The population of Canberra is two hundred thousand', { mode: 'audio', capture: { source: 'glasses_hfp', confidence: 0.71, lowConfidenceWords: [{ text: 'Canberra', confidence: 0.42 }, { text: 'two', confidence: 0.55 }] } as never }),
  ocr: input('Water boils at 90 degrees at sea level. Drinking bleach cures colds.', { mode: 'ocr', capture: { source: 'glasses_camera', confidence: 0.9 } as never }),
  quoted: input('I heard that "the moon landing was staged" and I think vaccines cause autism, but she said hello.', { userInitiated: false }),
};

const evidence = (id: string, extra: Partial<Evidence> = {}): Evidence => ({
  id, url: `https://example.org/${id}`, title: `Title for ${id}`, publisher: 'Example Org', publishedAt: '2026-01-02', retrievedAt: '2026-11-14T11:59:00Z', contentBasis: 'highlight',
  excerpt: `Excerpt ${id}: the Eiffel Tower is 330 metres (1,083 ft) tall including its antennas.`, sourceGroup: id, echoGroup: null, sourceRole: 'unknown', directlyAddressesClaim: false,
  matchesTimePlaceAndPopulation: false, stance: 'unrelated', stanceProbability: null, ...extra,
});
const claim = (extra: Partial<AcceptedClaim> = {}): AcceptedClaim => {
  const text = 'The Eiffel Tower is 330 metres tall.';
  return { id: 'c1', originalText: text, checkedText: text, sourceSpan: { start: 0, end: text.length },
    admission: { assertionStatus: 'asserted', hasPracticalConsequence: null, matchedSelectedTopic: null, admissionAction: 'check', reasonCode: 'eligible_public_claim' }, ...extra };
};
const three = () => [evidence('w0', { publishedAt: null }), evidence('w1', { origin: 'news', publisher: null }), evidence('w2', { origin: 'fact_check', rating: 'misleading', contentBasis: 'page_text' })];
export const judgeScenarios: Record<string, { claim: AcceptedClaim; evidence: Evidence[] }> = {
  plain: { claim: claim(), evidence: three() },
  one_evidence: { claim: claim(), evidence: [evidence('w0')] },
  attributed: { claim: claim({ attribution: { source: 'Gustave Eiffel', mode: 'said' }, route: 'recent_event' }), evidence: three().slice(0, 2) },
  future_subject: { claim: claim({ future: true, subject: 'Eiffel Tower' }), evidence: three() },
  rumour: { claim: claim({ rumour: true }), evidence: three().slice(0, 2) },
  long_title: { claim: claim(), evidence: [evidence('w0', { title: 'T'.repeat(400) }), evidence('w1', { excerpt: 'E'.repeat(2000) })] },
};

/** The raw wire request, as the provider would receive it. */
export const serializeRequest = (request: JevRequest) => JSON.stringify({ state: request.state, questions: request.questions });
export const digestOf = (text: string) => ({ sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) });
/** A client that records the request and stops the pipeline there. */
export function capturingClient(): JevClient & { requests: JevRequest[] } {
  const requests: JevRequest[] = [];
  return { requests, async ask(request) { requests.push(request); throw new Error('captured'); } };
}
