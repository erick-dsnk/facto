import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EventEnvelope } from '../../../../../packages/contracts/src/index.js';
import { Session } from '../../runtime/session.js';
import { AudioBridge } from '../../transport/audio-bridge.js';
import { type AsrTranscript, type AudioFrame, type AudioStart } from '../../transport/audio.js';
import { DEEPGRAM_LISTEN_URL, DEFAULT_KEYTERMS, createDeepgramAdapter, deepgramListenUrl, parseKeyterms, type DeepgramSocket } from './deepgram-adapter.js';

const config: AudioStart = { type: 'audio.start', sessionEpoch: 1, streamGeneration: 3, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' };
const apiKey = 'test-deepgram-key';

class FakeSocket extends EventEmitter implements DeepgramSocket {
  sent: (string | Uint8Array)[] = [];
  terminated = false;
  failSends = false;
  constructor(public url: string, public headers: Record<string, string>) { super(); }
  send(data: string | Uint8Array, callback?: (error?: Error) => void) {
    if (this.failSends) { callback?.(new Error('socket closed')); return; }
    this.sent.push(data); callback?.();
  }
  close(code?: number) { this.emit('close', code); }
  terminate() { if (this.terminated) return; this.terminated = true; this.emit('close', 1006); }
  controls() { return this.sent.filter((item): item is string => typeof item === 'string').map(item => JSON.parse(item).type as string); }
  results(words: [string, number, number, number?][], isFinal: boolean, start = 0, duration = 2) {
    this.emit('message', Buffer.from(JSON.stringify({
      type: 'Results', start, duration, is_final: isFinal, speech_final: isFinal,
      channel: { alternatives: [{ transcript: words.map(word => word[0]).join(' '), confidence: 0.9,
        words: words.map(([text, wordStart, end, speaker]) => ({ word: text.toLowerCase().replace(/[^a-z0-9]/g, ''), punctuated_word: text, start: wordStart, end, confidence: 0.9, speaker })) }] }
    })), false);
  }
}

function setup(overrides: Partial<Parameters<typeof createDeepgramAdapter>[0]> = {}) {
  const sockets: FakeSocket[] = [];
  const logs: [string, Record<string, number | string>][] = [];
  const adapter = createDeepgramAdapter({ apiKey, socketFactory: (url, headers) => { const socket = new FakeSocket(url, headers); sockets.push(socket); return socket; },
    log: (event, fields) => { logs.push([event, fields]); }, ...overrides });
  const transcripts: AsrTranscript[] = [];
  const failures: string[] = [];
  const controller = new AbortController();
  const begin = () => adapter.start(config, event => transcripts.push(event), controller.signal, code => { failures.push(code); });
  return { adapter, sockets, transcripts, failures, logs, controller, begin, socket: () => sockets[0] };
}
const frame = (sequence: number): AudioFrame => ({ streamGeneration: 3, sequence, captureOffsetMs: sequence * 100, pcm: new Uint8Array(3200).fill(sequence + 1), durationMs: 100 });

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Deepgram adapter', () => {
  it('opens the nova-3 diarized stream with a Token header, forwards PCM and assembles sentences', async () => {
    const state = setup(); const starting = state.begin();
    const socket = state.socket();
    expect(socket.url).toBe(deepgramListenUrl(DEFAULT_KEYTERMS));
    expect(socket.url.startsWith(DEEPGRAM_LISTEN_URL)).toBe(true);
    expect(socket.url).toContain('model=nova-3'); expect(socket.url).toContain('diarize=true'); expect(socket.url).toContain('utterance_end_ms=1000');
    expect(socket.url).toContain('encoding=linear16'); expect(socket.url).toContain('sample_rate=16000'); expect(socket.url).toContain('endpointing=300');
    expect(socket.url).not.toContain(apiKey);
    expect(socket.headers).toEqual({ Authorization: `Token ${apiKey}` });
    socket.emit('open'); const stream = await starting;
    await stream.write(frame(0));
    expect(socket.sent[0]).toBeInstanceOf(Uint8Array); expect((socket.sent[0] as Uint8Array).byteLength).toBe(3200);
    socket.results([['Helsinki', 0.1, 0.4, 0], ['is', 0.5, 0.6, 0], ['the', 0.7, 0.8, 0], ['capital.', 0.9, 1.2, 0], ['Paris', 1.3, 1.6, 1]], true, 0, 1.7);
    expect(state.transcripts).toEqual([{ text: 'Helsinki is the capital.', final: true, segmentId: 'g3-1', confidence: 0.9, captureOffsetMs: 100, speaker: 0 }]);
    socket.emit('message', JSON.stringify({ type: 'UtteranceEnd', channel: [0, 1], last_word_end: 1.6 }), false);
    expect(state.transcripts.at(-1)).toMatchObject({ text: 'Paris', final: true, segmentId: 'g3-2', speaker: 1, captureOffsetMs: 1300 });
    await stream.stop();
  });

  it('sends CloseStream on stop, then closes the socket after a grace period', async () => {
    vi.useFakeTimers();
    const state = setup({ closeGraceMs: 500 }); const starting = state.begin(); state.socket().emit('open'); const stream = await starting;
    await stream.stop(); await stream.stop();
    expect(state.socket().controls()).toEqual(['CloseStream']);
    expect(state.socket().terminated).toBe(false);
    state.socket().results([['Late.', 0, 0.5]], true);
    expect(state.transcripts).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(state.socket().terminated).toBe(true);
    await expect(stream.write(frame(0))).rejects.toThrow('asr_unavailable');
  });

  it('honors abort while opening and after the stream is open', async () => {
    const opening = setup(); const starting = opening.begin();
    opening.controller.abort(new Error('audio_cancelled'));
    await expect(starting).rejects.toThrow('audio_cancelled');
    expect(opening.socket().terminated).toBe(true);
    const aborted = new AbortController(); aborted.abort();
    await expect(opening.adapter.start(config, () => {}, aborted.signal)).rejects.toThrow();
    expect(opening.sockets).toHaveLength(1);

    const open = setup(); const started = open.begin(); open.socket().emit('open'); await started;
    open.controller.abort();
    expect(open.socket().controls()).toEqual(['CloseStream']);
  });

  it('fails startup with a sanitized code when the provider rejects or never answers', async () => {
    const rejected = setup(); const starting = rejected.begin();
    rejected.socket().emit('error', new Error(`Unexpected server response: 401 ${apiKey}`)); rejected.socket().emit('close');
    const error = await starting.then(() => new Error('opened'), (caught: Error) => caught);
    expect(error.message).toBe('asr_unavailable'); expect(error.message).not.toContain(apiKey);

    vi.useFakeTimers();
    const silent = setup({ openTimeoutMs: 1000 }); const waiting = silent.begin().then(() => new Error('opened'), (caught: Error) => caught);
    vi.advanceTimersByTime(1000);
    expect((await waiting).message).toBe('asr_unavailable'); expect(silent.socket().terminated).toBe(true);
    expect(() => createDeepgramAdapter({ apiKey: '' })).toThrow('DEEPGRAM_API_KEY');
  });

  it('sends KeepAlive only while no audio is flowing', async () => {
    vi.useFakeTimers(); let clock = 0;
    const state = setup({ keepAliveMs: 3000, now: () => clock }); const starting = state.begin(); state.socket().emit('open'); const stream = await starting;
    clock = 2000; vi.advanceTimersByTime(2000); await stream.write(frame(0));
    clock = 4500; vi.advanceTimersByTime(2500);
    expect(state.socket().controls()).toEqual([]);
    clock = 6000; vi.advanceTimersByTime(1500);
    expect(state.socket().controls()).toEqual(['KeepAlive']);
    clock = 9000; vi.advanceTimersByTime(3000);
    expect(state.socket().controls()).toEqual(['KeepAlive', 'KeepAlive']);
    await stream.stop();
  });

  it('rejects writes after the provider drops the connection and ignores malformed messages', async () => {
    const state = setup(); const starting = state.begin(); state.socket().emit('open'); const stream = await starting;
    state.socket().emit('message', 'not json', false);
    state.socket().emit('message', JSON.stringify({ type: 'Results', channel: 'broken' }), false);
    state.socket().emit('message', Buffer.from([1, 2, 3]), true);
    state.socket().emit('message', JSON.stringify({ type: 'Metadata', request_id: 'x' }), false);
    expect(state.transcripts).toEqual([]);
    state.socket().failSends = true;
    await expect(stream.write(frame(0))).rejects.toThrow('asr_unavailable');
    state.socket().failSends = false; state.socket().emit('close');
    await expect(stream.write(frame(1))).rejects.toThrow('asr_unavailable');
  });

  it('never logs audio, transcripts or the key, only failure codes and sizes', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method).mockImplementation(() => {}));
    const state = setup({ log: undefined }); const starting = state.begin(); state.socket().emit('open'); const stream = await starting;
    await stream.write(frame(0)); state.socket().results([['Secret', 0, 0.3], ['words.', 0.4, 0.6]], true);
    state.socket().emit('message', 'garbage Secret words', false); state.socket().emit('error', new Error(`boom ${apiKey} Secret`)); await stream.stop();
    const refused = setup({ log: undefined }); const refusing = refused.begin().catch(() => undefined);
    refused.socket().emit('error', new Error(`Unexpected server response: 401 ${apiKey}`)); await refusing;
    const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
    expect(spies[2]).toHaveBeenCalled();
    for (const forbidden of ['Secret', 'words', 'garbage', 'boom', apiKey]) expect(logged).not.toContain(forbidden);
    expect(logged).toContain('deepgram_unparsable_message'); expect(logged).toContain('"status":401');
    for (const spy of [spies[0], spies[1], spies[3], spies[4]]) expect(spy).not.toHaveBeenCalled();
  });

  it('reports a provider close, socket error or Error message after open to the bridge once, with a code', async () => {
    const closed = setup(); const starting = closed.begin(); closed.socket().emit('open'); const stream = await starting;
    closed.socket().close(1011);
    expect(closed.failures).toEqual(['asr_unavailable']);
    expect(closed.logs).toEqual([['deepgram_closed', { generation: 3, code: 1011 }]]);
    await stream.stop(); expect(closed.failures).toHaveLength(1);
    await expect(stream.write(frame(0))).rejects.toThrow('asr_unavailable');

    const errored = setup(); const opening = errored.begin(); errored.socket().emit('open'); await opening;
    errored.socket().emit('error', new Error('reset'));
    expect(errored.failures).toEqual(['asr_unavailable']); expect(errored.socket().terminated).toBe(true);
    expect(errored.logs.map(([event]) => event)).toEqual(['deepgram_socket_error']);

    const provider = setup(); const begun = provider.begin(); provider.socket().emit('open'); await begun;
    provider.socket().emit('message', JSON.stringify({ type: 'Warning', description: 'private detail' }), false);
    provider.socket().emit('message', JSON.stringify({ type: 'Error', description: 'private detail' }), false);
    expect(provider.failures).toEqual(['asr_unavailable']); expect(provider.socket().terminated).toBe(true);
    expect(provider.logs.map(([event, fields]) => [event, fields.type])).toEqual([['deepgram_unexpected_message', 'Warning'], ['deepgram_provider_error', undefined]]);
    expect(JSON.stringify(provider.logs)).not.toContain('private');

    const stopped = setup({ closeGraceMs: 0 }); const ready = stopped.begin(); stopped.socket().emit('open'); const own = await ready;
    await own.stop(); stopped.socket().close(1000);
    expect(stopped.failures).toEqual([]); expect(stopped.logs).toEqual([]);
  });

  it('makes the audio bridge stop listening when Deepgram drops while no frames arrive', async () => {
    const session = new Session(() => Date.parse('2026-11-14T10:00:00Z'));
    const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
    const state = setup();
    const bridge = new AudioBridge(session, state.adapter, () => {});
    const starting = bridge.start(config);
    await vi.waitFor(() => expect(state.sockets).toHaveLength(1));
    state.socket().emit('open'); await starting;
    state.socket().close(1011);
    await vi.waitFor(() => expect(events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(events.find(event => event.type === 'audio.stopped')?.payload).toMatchObject({ reasonCode: 'asr_failed', streamGeneration: 3 });
    expect(events.find(event => event.type === 'pipeline.error')?.payload).toMatchObject({ reasonCode: 'asr_unavailable' });
  });

  it('feeds the audio bridge transcripts it accepts, including speaker and corrections as revisions', async () => {
    const session = new Session(() => Date.parse('2026-11-14T10:00:00Z'));
    const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
    const state = setup(); const finals: AsrTranscript[] = [];
    const bridge = new AudioBridge(session, state.adapter, event => { finals.push(event); });
    const starting = bridge.start(config);
    await vi.waitFor(() => expect(state.sockets).toHaveLength(1));
    state.socket().emit('open'); await starting;
    for (let sequence = 0; sequence < 20; sequence++) {
      const bytes = new Uint8Array(3213); const view = new DataView(bytes.buffer);
      view.setUint8(0, 1); view.setUint32(1, 3); view.setUint32(5, sequence); view.setUint32(9, sequence * 100);
      await bridge.accept(bytes);
    }
    state.socket().results([['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['70.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1]], false);
    state.socket().results([['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['70.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1], ['it', 1.1, 1.2, 1]], false);
    state.socket().results([['It', 0.1, 0.2, 0], ['was', 0.3, 0.4, 0], ['17.', 0.5, 0.7, 0], ['Sorry', 0.8, 1.0, 1], ['it', 1.1, 1.2, 1], ['was', 1.3, 1.4, 1], ['17.', 1.5, 1.7, 1]], true, 0, 1.8);
    await vi.waitFor(() => expect(finals).toHaveLength(3));
    expect(finals.map(event => [event.segmentId, event.text, event.speaker])).toEqual([['g3-1', 'It was 70.', 0], ['g3-1', 'It was 17.', 0], ['g3-2', 'Sorry it was 17.', 1]]);
    expect(events.some(event => event.type === 'pipeline.error')).toBe(false);
    expect(events.filter(event => event.type === 'transcript.partial').length).toBeGreaterThan(0);
    await bridge.stop();
    expect(state.socket().controls()).toEqual(['CloseStream']);
  });
  it('sends every final result with per-word confidence to the opt-in transcript log, and nothing for interims', async () => {
    const entries: unknown[] = [];
    const state = setup({ transcriptLog: entry => { entries.push(entry); } }); const starting = state.begin();
    state.socket().emit('open'); await starting;
    state.socket().results([['Jensen', 0.1, 0.4, 0], ['Huang', 0.5, 0.8, 0]], false, 0, 1);
    expect(entries).toEqual([]);
    state.socket().results([['Jensen', 0.1, 0.4, 0], ['Huang', 0.5, 0.8, 0], ['spoke.', 0.9, 1.2, 0]], true, 0, 1.3);
    expect(entries).toEqual([{ generation: 3, start: 0, duration: 1.3, transcript: 'Jensen Huang spoke.', averageConfidence: 0.9,
      words: [{ word: 'Jensen', confidence: 0.9, speaker: 0 }, { word: 'Huang', confidence: 0.9, speaker: 0 }, { word: 'spoke.', confidence: 0.9, speaker: 0 }] }]);
    state.controller.abort();
  });

  it('logs no transcript text without the opt-in', async () => {
    const state = setup(); const starting = state.begin();
    state.socket().emit('open'); await starting;
    state.socket().results([['Helsinki', 0.1, 0.4, 0], ['is', 0.5, 0.6, 0], ['north.', 0.7, 0.9, 0]], true, 0, 1);
    expect(JSON.stringify(state.logs)).not.toContain('Helsinki');
    state.controller.abort();
  });
});

describe('Deepgram keyterms', () => {
  it('starts from the defaults and adds a trimmed, case-insensitively deduplicated comma list', () => {
    expect(parseKeyterms(undefined)).toEqual([...DEFAULT_KEYTERMS]);
    expect(parseKeyterms('')).toEqual([...DEFAULT_KEYTERMS]);
    expect(parseKeyterms('  Junction ,anthropic, Typesafe,,  JUNCTION, Jensen   Huang ')).toEqual([...DEFAULT_KEYTERMS, 'Junction', 'Typesafe']);
    expect(parseKeyterms("O'Neill, AT&T, Dr. Who, Saint-Étienne, GPT 5")).toEqual([...DEFAULT_KEYTERMS, "O'Neill", 'AT&T', 'Dr. Who', 'Saint-Étienne', 'GPT 5']);
  });

  it('drops terms that are too long or carry other characters, and keeps at most 50', () => {
    const long = 'x'.repeat(51);
    expect(parseKeyterms(`${long}, ${'y'.repeat(50)}, a=b, <script>, x/y, ok`)).toEqual([...DEFAULT_KEYTERMS, 'y'.repeat(50), 'ok']);
    const many = Array.from({ length: 80 }, (_, index) => `Term${index}`).join(',');
    const parsed = parseKeyterms(many);
    expect(parsed).toHaveLength(50);
    expect(parsed.slice(0, DEFAULT_KEYTERMS.length)).toEqual([...DEFAULT_KEYTERMS]);
  });

  it('adds one encoded keyterm parameter per term to the listen URL', () => {
    const url = deepgramListenUrl(['Jensen Huang', 'AT&T', "O'Neill"]);
    expect(url).toBe(`${DEEPGRAM_LISTEN_URL}&keyterm=Jensen%20Huang&keyterm=AT%26T&keyterm=O'Neill`);
    expect(new URL(url).searchParams.getAll('keyterm')).toEqual(['Jensen Huang', 'AT&T', "O'Neill"]);
    expect(deepgramListenUrl([])).toBe(DEEPGRAM_LISTEN_URL);
    expect(deepgramListenUrl(DEFAULT_KEYTERMS)).toContain('&keyterm=Jensen%20Huang&keyterm=Meta&keyterm=Ray-Ban&keyterm=OpenAI');
  });

  it('opens the keyterm URL from options, keeps the key in the header only, and lets url override everything', async () => {
    const keyterms = parseKeyterms('Junction');
    const state = setup({ keyterms }); const starting = state.begin();
    expect(state.socket().url).toBe(deepgramListenUrl(keyterms));
    expect(state.socket().url).toContain('&keyterm=Junction');
    expect(state.socket().url).not.toContain(apiKey);
    expect(state.socket().headers).toEqual({ Authorization: `Token ${apiKey}` });
    state.socket().emit('open'); await starting; state.controller.abort();

    const custom = setup({ keyterms, url: 'wss://example.test/listen?model=nova-3' }); const opening = custom.begin();
    expect(custom.socket().url).toBe('wss://example.test/listen?model=nova-3');
    custom.socket().emit('open'); await opening; custom.controller.abort();
  });
});
