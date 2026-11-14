import { describe, expect, it, vi } from 'vitest';
import { Session } from '../runtime/session.js';
import { AudioBridge } from './audio-bridge.js';
import { type AsrAdapter, type AsrStream, type AsrTranscript, type AudioStart } from './audio.js';
import { type EventEnvelope } from '../../../../packages/contracts/src/index.js';

const config: AudioStart = { type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' };
const transcript: AsrTranscript = { text: 'Helsinki is the capital of Finland.', final: true, segmentId: 'segment-1', confidence: 0.95, captureOffsetMs: 100 };
function frame(sequence = 0, generation = 1) {
  const bytes = new Uint8Array(3213); const view = new DataView(bytes.buffer);
  view.setUint8(0, 1); view.setUint32(1, generation); view.setUint32(5, sequence); view.setUint32(9, sequence * 100); return bytes;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
function setup(adapterOverride?: AsrAdapter) {
  const session = new Session(() => Date.parse('2026-11-14T10:00:00Z'));
  const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
  const writes = vi.fn(async () => {}); const stopped = vi.fn(async () => {});
  const stream: AsrStream = { write: writes, stop: stopped };
  let publish!: (event: AsrTranscript) => void;
  let signal!: AbortSignal;
  const adapter: AsrAdapter = adapterOverride ?? { start: vi.fn(async (_config, onTranscript, abort) => { publish = onTranscript; signal = abort; return stream; }) };
  const final = vi.fn(async () => {});
  const bridge = new AudioBridge(session, adapter, final);
  return { session, events, stream, writes, stopped, adapter, final, bridge, publish: (event: AsrTranscript) => publish(event), signal: () => signal };
}

describe('injectable audio bridge', () => {
  it('acknowledges only after ASR readiness and forwards only final transcripts to checking', async () => {
    const opening = deferred<AsrStream>(); const state = setup({ start: () => opening.promise });
    const started = state.bridge.start(config);
    expect(state.events.some(event => event.type === 'audio.ready')).toBe(false);
    await expect(state.bridge.accept(frame())).rejects.toThrow('audio_not_ready');
    opening.resolve(state.stream); await started;
    expect(state.events.filter(event => event.type === 'audio.ready')).toHaveLength(1);
    await state.bridge.accept(frame()); expect(state.writes).toHaveBeenCalledTimes(1);
    await state.bridge.stop();

    const ready = setup(); await ready.bridge.start(config); await ready.bridge.accept(frame());
    ready.publish({ ...transcript, final: false }); ready.publish(transcript);
    await vi.waitFor(() => expect(ready.final).toHaveBeenCalledTimes(1));
    expect(ready.events.map(event => event.type)).toEqual(['audio.ready', 'transcript.partial', 'transcript.final']);
    await ready.bridge.stop();
  });

  it('accepts an optional diarization speaker and includes it in transcript events', async () => {
    const state = setup(); await state.bridge.start(config); await state.bridge.accept(frame());
    state.publish({ ...transcript, final: false, speaker: 1 }); state.publish({ ...transcript, speaker: 1 });
    await vi.waitFor(() => expect(state.final).toHaveBeenCalledWith(expect.objectContaining({ speaker: 1 }), config, expect.any(Number)));
    state.publish({ ...transcript, segmentId: 'segment-2' });
    await vi.waitFor(() => expect(state.final).toHaveBeenCalledTimes(2));
    const payloads = state.events.filter(event => event.type.startsWith('transcript.')).map(event => (event.payload as { speaker: unknown }).speaker);
    expect(payloads).toEqual([1, 1, null]);
    await state.bridge.stop();
    const invalid = setup(); await invalid.bridge.start(config); await invalid.bridge.accept(frame());
    invalid.publish({ ...transcript, speaker: -1 });
    await vi.waitFor(() => expect(invalid.events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(invalid.final).not.toHaveBeenCalled();
  });

  it('stops listening at once when the adapter reports a provider failure after audio.ready', async () => {
    let failure!: (reasonCode: string) => void;
    const opening = vi.fn<AsrAdapter['start']>(async (_config, _onTranscript, _signal, onFailure) => { failure = onFailure!; return { write: async () => {}, stop: async () => {} }; });
    const state = setup({ start: opening });
    await state.bridge.start(config);
    failure('asr_unavailable');
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(state.events.find(event => event.type === 'audio.stopped')?.payload).toMatchObject({ reasonCode: 'asr_failed', streamGeneration: 1 });
    expect(state.events.find(event => event.type === 'pipeline.error')?.payload).toMatchObject({ reasonCode: 'asr_unavailable' });
    await expect(state.bridge.accept(frame())).rejects.toThrow('audio_not_ready');
    failure('asr_unavailable'); await new Promise<void>(done => setImmediate(done));
    expect(state.events.filter(event => event.type === 'pipeline.error')).toHaveLength(1);
  });

  it('caps queued audio to two seconds and aborts a blocked adapter on overflow', async () => {
    const blocked = deferred<void>(); const stopped = vi.fn(async () => {}); const write = vi.fn(() => blocked.promise);
    const state = setup({ start: async () => ({ write, stop: stopped }) }); await state.bridge.start(config);
    const accepted = Array.from({ length: 20 }, (_, sequence) => state.bridge.accept(frame(sequence)).catch(error => error));
    await expect(state.bridge.accept(frame(20))).rejects.toThrow('audio_backlog');
    await Promise.all(accepted); expect(stopped).toHaveBeenCalledTimes(1);
    expect(write.mock.calls.length).toBeLessThanOrEqual(1);
    blocked.resolve();
    await expect(state.bridge.accept(frame(21))).rejects.toThrow('audio_not_ready');
  });

  it('serializes writes and clears the partial stream on sequence gaps', async () => {
    const first = deferred<void>(); const write = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const stopped = vi.fn(async () => {}); const state = setup({ start: async () => ({ write, stop: stopped }) });
    await state.bridge.start(config);
    const a = state.bridge.accept(frame(0)); const b = state.bridge.accept(frame(1));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    first.resolve(); await Promise.all([a, b]); expect(write).toHaveBeenCalledTimes(2);
    await expect(state.bridge.accept(frame(3))).rejects.toThrow('audio_gap'); expect(stopped).toHaveBeenCalledTimes(1);
    await expect(state.bridge.start(config)).rejects.toThrow('invalid_audio_generation');
    await state.bridge.start({ ...config, streamGeneration: 2 }); await state.bridge.stop();
  });

  it('suppresses callbacks after stop and closes an adapter that finishes opening late', async () => {
    const opening = deferred<AsrStream>(); let publish!: (event: AsrTranscript) => void;
    const state = setup({ start: (_config, onTranscript) => { publish = onTranscript; return opening.promise; } });
    const started = state.bridge.start(config).catch(error => error);
    await state.bridge.stop(); opening.resolve(state.stream); await started;
    await vi.waitFor(() => expect(state.stopped).toHaveBeenCalledTimes(1));
    publish(transcript);
    expect(state.final).not.toHaveBeenCalled(); expect(state.events.some(event => event.type === 'audio.ready')).toBe(false);
  });

  it('suppresses stale epochs and playback feedback and requires a new generation', async () => {
    const state = setup(); await state.bridge.start(config);
    await state.bridge.playback(true); expect(state.signal().aborted).toBe(true);
    state.publish(transcript); expect(state.final).not.toHaveBeenCalled();
    await expect(state.bridge.start({ ...config, streamGeneration: 2 })).rejects.toThrow('playback_active');
    await state.bridge.playback(false);
    await expect(state.bridge.accept(frame())).rejects.toThrow('audio_not_ready');
    await state.bridge.start({ ...config, streamGeneration: 2 });
    state.session.pause(); state.publish(transcript); expect(state.final).not.toHaveBeenCalled();
    await expect(state.bridge.accept(frame(0, 2))).rejects.toThrow('audio_not_ready');
    await state.bridge.stop();
  });

  it('sanitizes failed ASR startup and fails closed for oversized transcripts', async () => {
    const failed = setup({ start: async () => { throw new Error('secret vendor payload'); } });
    await expect(failed.bridge.start(config)).rejects.toThrow('asr_unavailable');
    expect(JSON.stringify(failed.events)).not.toContain('secret vendor payload');
    expect(failed.events.some(event => event.type === 'audio.ready')).toBe(false);
    const state = setup(); await state.bridge.start(config); state.publish({ ...transcript, text: '🙂'.repeat(801) });
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(state.final).not.toHaveBeenCalled(); expect(state.stopped).toHaveBeenCalledTimes(1);
  });

  it('preserves capture time when a final transcript arrives late and rejects offsets beyond received audio', async () => {
    const startedAt = Date.parse('2026-11-14T10:00:00Z'); let clock = startedAt;
    const session = new Session(() => clock); const events: EventEnvelope[] = []; session.listeners.add(event => events.push(event));
    let publish!: (event: AsrTranscript) => void; const final = vi.fn();
    const bridge = new AudioBridge(session, { start: async (_config, callback) => { publish = callback; return { write: async () => {}, stop: async () => {} }; } }, final);
    await bridge.start(config); await bridge.accept(frame()); clock += 20_000;
    publish(transcript);
    await vi.waitFor(() => expect(final).toHaveBeenCalledWith(transcript, config, startedAt + 100));
    publish({ ...transcript, captureOffsetMs: 20_000 });
    await vi.waitFor(() => expect(events.some(event => event.type === 'pipeline.error')).toBe(true));
    expect(final).toHaveBeenCalledTimes(1); await bridge.stop();
  });
});
