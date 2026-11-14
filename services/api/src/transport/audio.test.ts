import { describe, expect, it } from 'vitest';
import { AudioFrameValidator, type AudioStart } from './audio.js';

const start: AudioStart = { type: 'audio.start', sessionEpoch: 1, streamGeneration: 1, encoding: 'pcm_s16le', sampleRateHz: 16000, channels: 1, source: 'glasses_stream_audio' };
function frame(sequence = 0, offset = 0, generation = 1, payload = 3200) {
  const bytes = new Uint8Array(13 + payload);
  const header = new DataView(bytes.buffer);
  header.setUint8(0, 1); header.setUint32(1, generation); header.setUint32(5, sequence); header.setUint32(9, offset);
  return bytes;
}
describe('PCM transport boundary', () => {
  it('requires a valid handshake and explicit acknowledgement before 100ms PCM frames', () => {
    const v = new AudioFrameValidator(1);
    expect(() => v.accept(frame())).toThrow('audio_not_ready');
    expect(v.start(start)).toEqual(start); v.acknowledge();
    const decoded = v.accept(frame());
    expect(decoded.durationMs).toBe(100); expect(decoded.pcm.byteLength).toBe(3200);
    expect(v.accept(frame(1, 100)).sequence).toBe(1);
  });
  it('rejects a frame sent before acknowledgement and requires a fresh generation', () => {
    const v = new AudioFrameValidator(1); v.start(start);
    expect(() => v.accept(frame())).toThrow('audio_not_ready');
    expect(() => v.start(start)).toThrow('invalid_audio_generation');
    v.start({ ...start, streamGeneration: 2 }); v.acknowledge();
    expect(v.accept(frame(0, 0, 2)).streamGeneration).toBe(2);
  });
  it.each([[2, 200, 1], [0, 100, 1], [0, 0, 2]])('invalidates partial audio on discontinuity %s/%s/%s', (seq, offset, gen) => {
    const v = new AudioFrameValidator(1); v.start(start); v.acknowledge();
    expect(() => v.accept(frame(seq, offset, gen))).toThrow();
    expect(() => v.accept(frame())).toThrow('audio_not_ready');
  });
  it('rejects stale epochs, unsupported formats and oversized/unaligned PCM', () => {
    expect(() => new AudioFrameValidator(2).start(start)).toThrow('old_epoch');
    expect(() => new AudioFrameValidator(1).start({ ...start, sampleRateHz: 48000 })).toThrow('invalid_audio_start');
    for (const size of [0, 639, 3201, 6401]) {
      const v = new AudioFrameValidator(1); v.start(start); v.acknowledge();
      expect(() => v.accept(frame(0, 0, 1, size))).toThrow('invalid_audio_frame_size');
    }
  });
});
