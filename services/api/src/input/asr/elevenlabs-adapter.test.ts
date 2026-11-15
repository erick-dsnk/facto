import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EventEnvelope } from '../../../../../packages/contracts/src/index.js';
import { Session } from '../../runtime/session.js';
import { AudioBridge } from '../../transport/audio-bridge.js';
import { type AsrTranscript, type AudioFrame, type AudioStart } from '../../transport/audio.js';
import { ELEVENLABS_DEFAULT_KEYTERMS, ELEVENLABS_MODEL_ID, ELEVENLABS_REALTIME_URL, createElevenLabsAdapter, elevenLabsRealtimeUrl, type ElevenLabsSocket } from './elevenlabs-adapter.js';

const config: AudioStart = { type: 'audio.start', sessionEpoch: 1, streamGeneration: 3, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' };
const apiKey = 'test-elevenlabs-key';
/** [text, start, end, speaker index or null]. Times are seconds on the server's audio clock. */
type W = [string, number | null, number | null, (number | null)?];

const toWords = (words: W[], logprob = -0.8) => words.flatMap(([text, start, end, speaker], index) => [
  ...(index ? [{ text: ' ', start, end: start, type: 'spacing', speaker_id: null, logprob: 0 }] : []),
  { text, start, end, type: 'word', speaker_id: speaker === undefined || speaker === null ? null : `speaker_${speaker}`, logprob: start === null ? 0 : logprob }
]);

class FakeSocket extends EventEmitter implements ElevenLabsSocket {
  sent: string[] = [];
  terminated = false;
  closedWith: number | undefined;
  failSends = false;
  constructor(public url: string, public headers: Record<string, string>) { super(); }
  send(data: string, callback?: (error?: Error) => void) {
    if (this.failSends) { callback?.(new Error('socket closed')); return; }
    this.sent.push(data); callback?.();
  }
  /** Client-initiated close: like ws, the close event comes later (serverClose) or never (then terminate). */
  close(code?: number) { this.closedWith = code; }
  terminate() { if (this.terminated) return; this.terminated = true; this.emit('close', 1006); }
  serverClose(code?: number) { this.emit('close', code); }
  message(payload: unknown) { this.emit('message', Buffer.from(JSON.stringify(payload)), false); }
  started() { this.emit('open'); this.message({ message_type: 'session_started', session_id: 'abc', config: { sample_rate: 16000, audio_format: 'pcm_16000', model_id: ELEVENLABS_MODEL_ID } }); }
  partial(words: W[]) { this.message({ message_type: 'partial_transcript', text: words.map(word => word[0]).join(' '), turn_probability: 0.1, words: toWords(words) }); }
  committed(text: string, index?: number) { this.message({ message_type: 'committed_transcript', text, ...(index === undefined ? {} : { segment_index: index }) }); }
  timestamps(words: W[]) { this.message({ message_type: 'committed_transcript_with_timestamps', text: words.map(word => word[0]).join(' '), language_code: 'en', words: toWords(words) }); }
  diarized(index: number, words: W[], logprob?: number) { this.message({ message_type: 'diarized_transcript', segment_index: index, text: words.map(word => word[0]).join(' '), words: toWords(words, logprob) }); }
  chunks() { return this.sent.map(item => JSON.parse(item) as { message_type: string; audio_base_64: string; commit: boolean; sample_rate: number }); }
}

function setup(overrides: Partial<Parameters<typeof createElevenLabsAdapter>[0]> = {}) {
  const sockets: FakeSocket[] = [];
  const logs: [string, Record<string, number | string>][] = [];
  const adapter = createElevenLabsAdapter({ apiKey, socketFactory: (url, headers) => { const socket = new FakeSocket(url, headers); sockets.push(socket); return socket; },
    log: (event, fields) => { logs.push([event, fields]); }, ...overrides });
  const transcripts: AsrTranscript[] = [];
  const failures: string[] = [];
  const controller = new AbortController();
  const begin = (start: AudioStart = config) => adapter.start(start, event => transcripts.push(event), controller.signal, code => { failures.push(code); });
  const finals = () => transcripts.filter(event => event.final);
  return { adapter, sockets, transcripts, finals, failures, logs, controller, begin, socket: () => sockets[sockets.length - 1] };
}
async function open(overrides: Parameters<typeof setup>[0] = {}) {
  const state = setup(overrides); const starting = state.begin(); state.socket().started();
  return { ...state, stream: await starting };
}
const frame = (sequence: number, durationMs = 100): AudioFrame => ({ streamGeneration: 3, sequence, captureOffsetMs: sequence * durationMs, pcm: new Uint8Array(durationMs * 32).fill(sequence + 1), durationMs });

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('ElevenLabs realtime URL', () => {
  it('asks for Scribe v3 Live with 16 kHz PCM, English, turn prediction, timestamps and diarization, and keeps the key out', () => {
    const url = new URL(elevenLabsRealtimeUrl(ELEVENLABS_DEFAULT_KEYTERMS));
    expect(`${url.origin}${url.pathname}`).toBe(ELEVENLABS_REALTIME_URL);
    expect(ELEVENLABS_MODEL_ID).toBe('scribe_v3_live');
    expect(Object.fromEntries([...url.searchParams].filter(([name]) => name !== 'keyterms'))).toEqual({
      model_id: 'scribe_v3_live', audio_format: 'pcm_16000', language_code: 'en', commit_strategy: 'turn_prediction',
      vad_silence_threshold_secs: '0.5', include_timestamps: 'true', diarize: 'true'
    });
    expect(url.searchParams.getAll('keyterms')).toEqual([...ELEVENLABS_DEFAULT_KEYTERMS]);
    expect(url.href).not.toContain(apiKey);
  });

  it('defaults to the names live testing misheard, encodes spaces as %20 and drops terms over the 20-character realtime limit', () => {
    expect(ELEVENLABS_DEFAULT_KEYTERMS).toEqual(['Facto', 'Hey Facto', 'Anthropic', 'Claude', 'Opus', 'Sonnet', 'Haiku', 'DeepSeek', 'OpenAI', 'ChatGPT',
      'Gemini', 'Meta', 'Ray-Ban', 'Zelensky', 'Donbas', 'NATO']);
    const url = elevenLabsRealtimeUrl(['Hey Facto', 'AT&T', 'x'.repeat(21), 'y'.repeat(20)]);
    expect(url).toContain('&keyterms=Hey%20Facto&keyterms=AT%26T&keyterms=' + 'y'.repeat(20));
    expect(url).not.toContain('x'.repeat(21));
    expect(new URL(elevenLabsRealtimeUrl(Array.from({ length: 60 }, (_, index) => `Term${index}`))).searchParams.getAll('keyterms')).toHaveLength(50);
    expect(new URL(elevenLabsRealtimeUrl([])).searchParams.has('keyterms')).toBe(false);
  });
});

describe('ElevenLabs adapter', () => {
  it('opens with the xi-api-key header, is ready only after session_started, and sends PCM as base64 input_audio_chunk messages', async () => {
    const state = setup(); const starting = state.begin();
    const socket = state.socket();
    expect(socket.url).toBe(elevenLabsRealtimeUrl(ELEVENLABS_DEFAULT_KEYTERMS));
    expect(socket.headers).toEqual({ 'xi-api-key': apiKey });
    let ready = false; void starting.then(() => { ready = true; });
    socket.emit('open'); await Promise.resolve();
    expect(ready).toBe(false);
    socket.started(); const stream = await starting;
    await stream.write(frame(0));
    const [chunk] = socket.chunks();
    expect(chunk).toEqual({ message_type: 'input_audio_chunk', audio_base_64: Buffer.from(frame(0).pcm).toString('base64'), commit: false, sample_rate: 16000 });
    expect(Buffer.from(chunk.audio_base_64, 'base64')).toHaveLength(3200);
    await stream.stop();
  });

  it('uses only timed partials as interims and turns a commit plus its diarized words into sentences with speakers', async () => {
    const state = await open(); const socket = state.socket();
    await state.stream.write(frame(0));
    socket.partial([['Helsinki', null, null], ['is', null, null]]);
    expect(state.transcripts).toEqual([]);
    socket.partial([['Helsinki', 0.1, 0.4, 0], ['is', 0.5, 0.6, 0]]);
    expect(state.transcripts).toEqual([{ text: 'Helsinki is', final: false, segmentId: 'g3-1', confidence: null, captureOffsetMs: 100, endOffsetMs: 600, speaker: 0 }]);
    socket.committed('Helsinki is the capital. Paris is not.', 0);
    socket.message({ message_type: 'diarized_transcript', segment_index: 0, text: 'Helsinki is the capital. Paris is not.', words: [
      ...toWords([['Helsinki', 0.1, 0.4, 0], ['is', 0.5, 0.6, 0], ['the', 0.7, 0.8, 0], ['capital.', 0.9, 1.2, 0]]),
      { text: '(laughs)', start: 1.2, end: 1.3, type: 'audio_event', speaker_id: 'speaker_1', logprob: -0.2 },
      ...toWords([['Paris', 1.3, 1.6, 1], ['is', 1.7, 1.8, 1], ['not.', 1.9, 2.0, 1]])
    ] });
    expect(state.finals()).toEqual([
      { text: 'Helsinki is the capital.', final: true, segmentId: 'g3-1', confidence: null, captureOffsetMs: 100, endOffsetMs: 1200, speaker: 0 },
      { text: 'Paris is not.', final: true, segmentId: 'g3-2', confidence: null, captureOffsetMs: 1300, endOffsetMs: 2000, speaker: 1 }
    ]);
    expect(state.finals().some(event => 'lowConfidenceWords' in event)).toBe(false);
    await state.stream.stop();
  });

  it('waits commitWaitMs for diarized words, then finalizes with the timestamped words, or spreads the text when it has neither', async () => {
    vi.useFakeTimers();
    const state = await open({ commitWaitMs: 250 }); const socket = state.socket();
    for (let sequence = 0; sequence < 20; sequence++) await state.stream.write(frame(sequence));
    socket.committed('Nokia sold phones.', 0);
    socket.timestamps([['Nokia', 0.2, 0.5], ['sold', 0.6, 0.8], ['phones.', 0.9, 1.3]]);
    vi.advanceTimersByTime(249);
    expect(state.finals()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(state.finals()).toEqual([{ text: 'Nokia sold phones.', final: true, segmentId: 'g3-1', confidence: null, captureOffsetMs: 200, endOffsetMs: 1300, speaker: null }]);
    socket.diarized(0, [['Nokia', 0.2, 0.5, 0], ['sold', 0.6, 0.8, 0], ['phones.', 0.9, 1.3, 0]]);
    expect(state.finals()).toHaveLength(1);

    socket.partial([['Oulu', 1.5, 1.7, 0]]);
    socket.committed('Oulu is north.', 1);
    vi.advanceTimersByTime(250);
    expect(state.logs.map(([event]) => event)).toEqual(['elevenlabs_commit_untimed']);
    const spread = state.finals()[1];
    expect(spread).toMatchObject({ text: 'Oulu is north.', final: true, segmentId: 'g3-2', speaker: null, captureOffsetMs: 1500 });
    expect(spread.captureOffsetMs).toBeLessThanOrEqual(2000);
    await state.stream.stop();
  });

  it('finalizes a waiting commit as soon as speech for the next segment arrives', async () => {
    const state = await open(); const socket = state.socket();
    await state.stream.write(frame(0));
    socket.committed('It rained.', 0);
    socket.timestamps([['It', 0.1, 0.2], ['rained.', 0.3, 0.6]]);
    expect(state.finals()).toEqual([]);
    socket.partial([['Then', 2.0, 2.2, 0]]);
    expect(state.finals().map(event => event.text)).toEqual(['It rained.']);
    expect(state.transcripts.at(-1)).toMatchObject({ text: 'Then', final: false });
    await state.stream.stop();
  });

  it('holds a tail without terminal punctuation: it joins speech that resumes within the gap and is flushed after a longer pause', async () => {
    vi.useFakeTimers();
    const state = await open({ utteranceGapMs: 1000 }); const socket = state.socket();
    for (let sequence = 0; sequence < 60; sequence++) await state.stream.write(frame(sequence));
    // A pause mid-sentence: the commit stops at "in", and the speaker goes on 0.4 s later.
    socket.committed('Nvidia was founded in', 0);
    socket.diarized(0, [['Nvidia', 0.1, 0.5, 0], ['was', 0.6, 0.7, 0], ['founded', 0.8, 1.1, 0], ['in', 1.2, 1.3, 0]]);
    expect(state.finals()).toEqual([]);
    vi.advanceTimersByTime(600);
    socket.partial([['1993.', 1.7, 2.3, 0]]);
    socket.committed('1993.', 1);
    socket.diarized(1, [['1993.', 1.7, 2.3, 0]]);
    expect(state.finals().map(event => [event.segmentId, event.text])).toEqual([['g3-1', 'Nvidia was founded in 1993.']]);

    // The commit misses the period and the next sentence starts 1.5 s later: the tail is its own sentence.
    socket.committed('Helsinki is the capital', 2);
    socket.diarized(2, [['Helsinki', 2.5, 2.9, 0], ['is', 3.0, 3.1, 0], ['the', 3.2, 3.3, 0], ['capital', 3.4, 3.8, 0]]);
    socket.partial([['Paris', 5.3, 5.6, 1]]);
    expect(state.finals().map(event => event.text)).toEqual(['Nvidia was founded in 1993.', 'Helsinki is the capital']);

    // No more speech after a tail: it is flushed utteranceGapMs after the commit.
    socket.committed('Paris is south', 3);
    socket.diarized(3, [['Paris', 5.3, 5.6, 1], ['is', 5.7, 5.8, 1], ['south', 5.9, 6.2, 1]]);
    vi.advanceTimersByTime(999);
    expect(state.finals()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(state.finals().at(-1)).toMatchObject({ text: 'Paris is south', speaker: 1, captureOffsetMs: 5300 });
    await state.stream.stop();
  });

  it('counts a repeated partial once, so an early sentence needs two different partials that agree on it', async () => {
    const state = await open(); const socket = state.socket();
    for (let sequence = 0; sequence < 20; sequence++) await state.stream.write(frame(sequence));
    const first: W[] = [['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['70.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1]];
    socket.partial(first); socket.partial(first);
    expect(state.finals()).toEqual([]);
    socket.partial([...first, ['it', 1.1, 1.2, 1]]);
    expect(state.finals().map(event => [event.segmentId, event.text])).toEqual([['g3-1', 'It was 70.']]);
    // The commit hears "17": the early sentence is corrected under the same segment id.
    socket.committed('It was 17. Sorry, it was 17.', 0);
    socket.diarized(0, [['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['17.', 0.5, 0.7, 0], ['Sorry,', 0.8, 1.0, 1], ['it', 1.1, 1.2, 1], ['was', 1.3, 1.4, 1], ['17.', 1.5, 1.7, 1]]);
    expect(state.finals().map(event => [event.segmentId, event.text, event.speaker])).toEqual([['g3-1', 'It was 70.', 0], ['g3-1', 'It was 17.', 0], ['g3-2', 'Sorry, it was 17.', 1]]);
    await state.stream.stop();
  });

  it('drops words that start inside the echo window the bridge asks for after a spoken answer', async () => {
    const state = setup(); const transcripts: AsrTranscript[] = [];
    const starting = state.adapter.start(config, event => transcripts.push(event), state.controller.signal, undefined, { ignoreWordsBeforeMs: 800 });
    state.socket().started(); const stream = await starting;
    for (let sequence = 0; sequence < 20; sequence++) await stream.write(frame(sequence));
    state.socket().committed('Australia. The tower is tall.', 0);
    state.socket().diarized(0, [['Australia.', 0.1, 0.6, 0], ['The', 0.9, 1.0, 1], ['tower', 1.1, 1.3, 1], ['is', 1.4, 1.5, 1], ['tall.', 1.6, 1.9, 1]]);
    expect(transcripts.filter(event => event.final).map(event => [event.text, event.captureOffsetMs])).toEqual([['The tower is tall.', 900]]);
    await stream.stop();
  });

  it('applies speakers_merged to later words, following chains', async () => {
    const state = await open(); const socket = state.socket();
    await state.stream.write(frame(0));
    socket.message({ message_type: 'speakers_merged', from_speaker_id: 'speaker_2', to_speaker_id: 'speaker_1' });
    socket.message({ message_type: 'speakers_merged', from_speaker_id: 'speaker_1', to_speaker_id: 'speaker_0' });
    socket.committed('Oulu is cold.', 0);
    socket.diarized(0, [['Oulu', 0.1, 0.3, 2], ['is', 0.4, 0.5, 1], ['cold.', 0.6, 0.9, 2]]);
    expect(state.finals()).toEqual([expect.objectContaining({ text: 'Oulu is cold.', speaker: 0 })]);
    await state.stream.stop();
  });

  it('keeps an idle session open with 100 ms of silence and counts word times without that silence', async () => {
    vi.useFakeTimers(); let clock = 0;
    const state = await open({ keepAliveMs: 3000, now: () => clock }); const socket = state.socket();
    clock = 2000; vi.advanceTimersByTime(2000);
    expect(socket.chunks()).toEqual([]);
    clock = 3000; vi.advanceTimersByTime(1000);
    clock = 6000; vi.advanceTimersByTime(3000);
    const silent = socket.chunks();
    expect(silent).toHaveLength(2);
    for (const chunk of silent) { expect(chunk.commit).toBe(false); expect(Buffer.from(chunk.audio_base_64, 'base64').equals(Buffer.alloc(3200))).toBe(true); }
    // 0.2 s of silence went first, so the server's 0.25 s is the phone's 0.05 s.
    for (let sequence = 0; sequence < 20; sequence++) { await state.stream.write(frame(sequence)); clock += 100; vi.advanceTimersByTime(100); }
    expect(socket.chunks()).toHaveLength(22);
    socket.committed('Jensen spoke.', 0);
    socket.diarized(0, [['Jensen', 0.25, 0.6, 0], ['spoke.', 0.7, 1.0, 0]]);
    expect(state.finals()).toEqual([expect.objectContaining({ text: 'Jensen spoke.', captureOffsetMs: 50 })]);
    await state.stream.stop();
  });

  it('closes with 1000 on stop, ignores late results, terminates after the grace period and rejects writes', async () => {
    vi.useFakeTimers();
    const state = await open({ closeGraceMs: 500 }); const socket = state.socket();
    await state.stream.stop(); await state.stream.stop();
    expect(socket.closedWith).toBe(1000); expect(socket.terminated).toBe(false);
    socket.committed('Late.', 0); socket.diarized(0, [['Late.', 0, 0.5, 0]]);
    expect(state.transcripts).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(socket.terminated).toBe(true);
    await expect(state.stream.write(frame(0))).rejects.toThrow('asr_unavailable');

    const graceful = await open({ closeGraceMs: 500 });
    await graceful.stream.stop(); graceful.socket().serverClose(1000);
    vi.advanceTimersByTime(500);
    expect(graceful.socket().terminated).toBe(false);
    expect(graceful.failures).toEqual([]); expect(graceful.logs).toEqual([]);
  });

  it('honors abort while opening and after the stream is open', async () => {
    const opening = setup(); const starting = opening.begin();
    opening.socket().emit('open');
    opening.controller.abort(new Error('audio_cancelled'));
    await expect(starting).rejects.toThrow('audio_cancelled');
    expect(opening.socket().terminated).toBe(true);
    const aborted = new AbortController(); aborted.abort();
    await expect(opening.adapter.start(config, () => {}, aborted.signal)).rejects.toThrow();
    expect(opening.sockets).toHaveLength(1);

    const live = await open();
    live.controller.abort();
    expect(live.socket().closedWith).toBe(1000);
  });

  it('fails startup with a sanitized code on a refused handshake, an error before session_started or no answer', async () => {
    const rejected = setup(); const starting = rejected.begin();
    rejected.socket().emit('error', new Error(`Unexpected server response: 401 ${apiKey}`)); rejected.socket().serverClose();
    const error = await starting.then(() => new Error('opened'), (caught: Error) => caught);
    expect(error.message).toBe('asr_unavailable'); expect(error.message).not.toContain(apiKey);
    expect(rejected.logs[0]).toEqual(['elevenlabs_open_failed', { generation: 3, status: 401 }]);

    const refused = setup(); const refusing = refused.begin();
    refused.socket().emit('open'); refused.socket().message({ message_type: 'invalid_request', error: `bad parameter ${apiKey}` });
    expect((await refusing.then(() => new Error('opened'), (caught: Error) => caught)).message).toBe('asr_unavailable');
    expect(refused.socket().terminated).toBe(true);
    expect(refused.logs).toEqual([['elevenlabs_open_failed', { generation: 3, type: 'invalid_request' }]]);

    vi.useFakeTimers();
    const silent = setup({ openTimeoutMs: 1000 }); const waiting = silent.begin().then(() => new Error('opened'), (caught: Error) => caught);
    silent.socket().emit('open');
    vi.advanceTimersByTime(1000);
    expect((await waiting).message).toBe('asr_unavailable'); expect(silent.socket().terminated).toBe(true);
    expect(() => createElevenLabsAdapter({ apiKey: '' })).toThrow('ELEVENLABS_API_KEY');
  });

  it('reports a provider close, socket error or error message after open to the bridge once, with a code', async () => {
    const closed = await open();
    closed.socket().serverClose(1011);
    expect(closed.failures).toEqual(['asr_unavailable']);
    expect(closed.logs).toEqual([['elevenlabs_closed', { generation: 3, code: 1011 }]]);
    await closed.stream.stop(); expect(closed.failures).toHaveLength(1);
    await expect(closed.stream.write(frame(0))).rejects.toThrow('asr_unavailable');

    const errored = await open();
    errored.socket().emit('error', new Error('reset'));
    expect(errored.failures).toEqual(['asr_unavailable']); expect(errored.socket().terminated).toBe(true);
    expect(errored.logs.map(([event]) => event)).toEqual(['elevenlabs_socket_error']);

    const provider = await open();
    provider.socket().message({ message_type: 'warning', warning: 'private detail' });
    provider.socket().message({ message_type: 'committed_transcript_entities', text: 'private detail', entities: [] });
    expect(provider.failures).toEqual([]);
    provider.socket().message({ message_type: 'quota_exceeded', error: 'private detail' });
    expect(provider.failures).toEqual(['asr_unavailable']); expect(provider.socket().terminated).toBe(true);
    expect(provider.logs.map(([event, fields]) => [event, fields.type])).toEqual([
      ['elevenlabs_warning', undefined], ['elevenlabs_unexpected_message', 'committed_transcript_entities'], ['elevenlabs_provider_error', 'quota_exceeded']]);
    expect(JSON.stringify(provider.logs)).not.toContain('private');
  });

  it('ends the stream with a failure code instead of crashing when handling a result throws', async () => {
    const logs: string[] = []; const failures: string[] = []; const sockets: FakeSocket[] = [];
    const adapter = createElevenLabsAdapter({ apiKey, log: event => { logs.push(event); },
      socketFactory: (url, headers) => { const socket = new FakeSocket(url, headers); sockets.push(socket); return socket; } });
    const starting = adapter.start(config, () => { throw new Error('downstream Secret'); }, new AbortController().signal, code => { failures.push(code); });
    sockets[0].started(); const stream = await starting;
    await stream.write(frame(0));
    sockets[0].committed('Oulu is cold.', 0);
    expect(() => sockets[0].diarized(0, [['Oulu', 0.1, 0.3, 0], ['is', 0.4, 0.5, 0], ['cold.', 0.6, 0.9, 0]])).not.toThrow();
    expect(failures).toEqual(['asr_unavailable']); expect(sockets[0].terminated).toBe(true);
    expect(logs).toEqual(['elevenlabs_handler_error']);
    await expect(stream.write(frame(1))).rejects.toThrow('asr_unavailable');
  });

  it('rejects writes after a failed send and ignores malformed messages', async () => {
    const state = await open(); const socket = state.socket();
    socket.emit('message', 'not json', false);
    socket.message({ message_type: 'partial_transcript', text: 42 });
    socket.message({ message_type: 'diarized_transcript', segment_index: 0, text: 'x', words: 'broken' });
    socket.emit('message', Buffer.from([1, 2, 3]), true);
    socket.message({ message_type: 'partial_transcript', text: '' });
    expect(state.transcripts).toEqual([]); expect(state.failures).toEqual([]);
    expect(state.logs.map(([event]) => event)).toEqual(['elevenlabs_unparsable_message', 'elevenlabs_unexpected_message']);
    socket.failSends = true;
    await expect(state.stream.write(frame(0))).rejects.toThrow('asr_unavailable');
  });

  it('never logs audio, transcripts or the key, only failure codes and sizes', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method).mockImplementation(() => {}));
    const state = await open({ log: undefined }); const socket = state.socket();
    await state.stream.write(frame(0));
    socket.partial([['Secret', 0.1, 0.3, 0]]); socket.committed('Secret words.', 0); socket.diarized(0, [['Secret', 0.1, 0.3, 0], ['words.', 0.4, 0.6, 0]]);
    socket.emit('message', 'garbage Secret words', false); socket.emit('error', new Error(`boom ${apiKey} Secret`));
    const refused = setup({ log: undefined }); const refusing = refused.begin().catch(() => undefined);
    refused.socket().emit('error', new Error(`Unexpected server response: 401 ${apiKey}`)); await refusing;
    const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
    expect(spies[2]).toHaveBeenCalled();
    for (const forbidden of ['Secret', 'words', 'garbage', 'boom', apiKey]) expect(logged).not.toContain(forbidden);
    expect(logged).toContain('elevenlabs_unparsable_message'); expect(logged).toContain('"status":401');
    for (const spy of [spies[0], spies[1], spies[3], spies[4]]) expect(spy).not.toHaveBeenCalled();
  });

  it('sends every committed segment with raw logprob to the opt-in transcript log, and nothing for partials', async () => {
    const entries: unknown[] = [];
    const state = await open({ transcriptLog: entry => { entries.push(entry); } }); const socket = state.socket();
    await state.stream.write(frame(0));
    socket.partial([['Jensen', 0.1, 0.4, 0]]);
    expect(entries).toEqual([]);
    socket.committed('Jensen spoke.', 4);
    socket.diarized(4, [['Jensen', 0.1, 0.4, 0], ['spoke.', 0.5, 0.8, 0]], -1.25);
    expect(entries).toEqual([{ generation: 3, segmentIndex: 4, start: 0.1, end: 0.8, transcript: 'Jensen spoke.', words: 'diarized',
      wordDetail: [{ word: 'Jensen', logprob: -1.25, speaker: 0 }, { word: 'spoke.', logprob: -1.25, speaker: 0 }] }]);
    expect(JSON.stringify(state.logs)).not.toContain('Jensen');
    await state.stream.stop();
  });
});

describe('ElevenLabs adapter behind the audio bridge', () => {
  const bytesFor = (generation: number, sequence: number) => {
    const bytes = new Uint8Array(3213); const view = new DataView(bytes.buffer);
    view.setUint8(0, 1); view.setUint32(1, generation); view.setUint32(5, sequence); view.setUint32(9, sequence * 100);
    return bytes;
  };

  it('stops listening when ElevenLabs drops while no frames arrive, and a new generation opens a fresh session', async () => {
    const session = new Session(() => Date.parse('2026-11-14T10:00:00Z'));
    const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
    const state = setup(); const finals: AsrTranscript[] = [];
    const bridge = new AudioBridge(session, state.adapter, event => { finals.push(event); });
    const starting = bridge.start(config);
    await vi.waitFor(() => expect(state.sockets).toHaveLength(1));
    state.socket().started(); await starting;
    state.socket().serverClose(1011);
    await vi.waitFor(() => expect(events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(events.find(event => event.type === 'audio.stopped')?.payload).toMatchObject({ reasonCode: 'asr_failed', streamGeneration: 3 });
    expect(events.find(event => event.type === 'pipeline.error')?.payload).toMatchObject({ reasonCode: 'asr_unavailable' });

    // The app reconnects with the next generation: a new provider session, and segment ids that cannot collide with the old ones.
    const restarting = bridge.start({ ...config, streamGeneration: 4 });
    await vi.waitFor(() => expect(state.sockets).toHaveLength(2));
    state.socket().started(); await restarting;
    for (let sequence = 0; sequence < 10; sequence++) await bridge.accept(bytesFor(4, sequence));
    state.socket().committed('Back online.', 0); state.socket().diarized(0, [['Back', 0.1, 0.3, 0], ['online.', 0.4, 0.8, 0]]);
    await vi.waitFor(() => expect(finals).toHaveLength(1));
    expect(finals[0]).toMatchObject({ text: 'Back online.', segmentId: 'g4-1' });
    await bridge.stop();
    expect(state.socket().closedWith).toBe(1000);
  });

  it('feeds the bridge partials and finals it accepts, with speakers, corrections as revisions and no low-confidence words', async () => {
    const session = new Session(() => Date.parse('2026-11-14T10:00:00Z'));
    const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
    const state = setup(); const finals: AsrTranscript[] = [];
    const bridge = new AudioBridge(session, state.adapter, event => { finals.push(event); });
    const starting = bridge.start(config);
    await vi.waitFor(() => expect(state.sockets).toHaveLength(1));
    state.socket().started(); await starting;
    for (let sequence = 0; sequence < 20; sequence++) await bridge.accept(bytesFor(3, sequence));
    const socket = state.socket();
    socket.partial([['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['70.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1]]);
    socket.partial([['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['70.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1], ['it', 1.1, 1.2, 1]]);
    socket.committed('It was 17. Sorry, it was 17.', 0);
    socket.diarized(0, [['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['17.', 0.5, 0.7, 0], ['Sorry,', 0.8, 1.0, 1], ['it', 1.1, 1.2, 1], ['was', 1.3, 1.4, 1], ['17.', 1.5, 1.7, 1]]);
    await vi.waitFor(() => expect(finals).toHaveLength(3));
    expect(finals.map(event => [event.segmentId, event.text, event.speaker])).toEqual([['g3-1', 'It was 70.', 0], ['g3-1', 'It was 17.', 0], ['g3-2', 'Sorry, it was 17.', 1]]);
    expect(finals.every(event => event.confidence === null && event.lowConfidenceWords === undefined)).toBe(true);
    expect(events.some(event => event.type === 'pipeline.error')).toBe(false);
    expect(events.filter(event => event.type === 'transcript.partial').length).toBeGreaterThan(0);
    await bridge.stop();
  });
});
