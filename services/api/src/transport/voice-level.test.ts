import { describe, expect, it } from 'vitest';
import { DEFAULT_DIM_DB, DEFAULT_DIM_FLOOR_DBFS, DEFAULT_ECHO_MS, LevelHistory, VoiceDimmer, parseVoiceConfig } from './voice-level.js';

/** `ms` of 16 kHz s16le square wave at `amplitude` (its RMS level is 20·log10(amplitude / 32768) dBFS). */
function pcm(ms: number, amplitude: number): Uint8Array {
  const bytes = new Uint8Array(ms * 32); const view = new DataView(bytes.buffer);
  for (let sample = 0; sample < ms * 16; sample++) view.setInt16(sample * 2, sample % 2 ? amplitude : -amplitude, true);
  return bytes;
}
const dbfs = (amplitude: number) => 20 * Math.log10(amplitude / 32768);

describe('level history', () => {
  it('measures a span in dBFS from the frames that covered it, at any frame size and byte alignment', () => {
    const history = new LevelHistory();
    history.add(0, pcm(100, 3277));
    // A 13-byte header puts the samples at an odd offset, as in the bridge.
    const framed = new Uint8Array(13 + 25 * 32); framed.set(pcm(25, 328), 13);
    history.add(100, framed.subarray(13));
    history.add(125, pcm(75, 328));
    expect(history.levelDbfs(0, 100)).toBeCloseTo(dbfs(3277), 1);
    expect(history.levelDbfs(100, 200)).toBeCloseTo(dbfs(328), 1);
    expect(history.levelDbfs(0, 20)).toBeNull();
    expect(history.levelDbfs(500, 900)).toBeNull();
  });

  it('reports speech level through pauses between words and ignores a single click', () => {
    const history = new LevelHistory();
    let at = 0;
    for (const [ms, amplitude] of [[300, 1036], [150, 0], [300, 1036], [10, 32000], [140, 0], [300, 1036]] as const) { history.add(at, pcm(ms, amplitude)); at += ms; }
    expect(history.levelDbfs(0, at)).toBeCloseTo(dbfs(1036), 1);
  });

  it('forgets audio older than two minutes', () => {
    const history = new LevelHistory();
    history.add(0, pcm(200, 3277));
    for (let at = 200; at < 121_000; at += 200) history.add(at, pcm(200, 100));
    expect(history.levelDbfs(0, 200)).toBeNull();
    expect(history.levelDbfs(120_000, 120_200)).toBeCloseTo(dbfs(100), 1);
  });
});

describe('voice dimmer', () => {
  const gate = (dimDb = 14, floorDbfs = -60) => { let clock = 0; const dimmer = new VoiceDimmer({ dimDb, floorDbfs }, () => clock); return { dimmer, advance: (ms: number) => { clock += ms; } }; };

  it('keeps the first sentences while it learns, then dims sentences more than dimDb under the wearer and never uses them', () => {
    const { dimmer } = gate();
    expect([-22, -24, -21].map(level => dimmer.decide(level, false).action)).toEqual(['learning', 'learning', 'learning']);
    expect(dimmer.reference()).toBe(-22);
    expect(dimmer.decide(-35, false)).toEqual({ action: 'kept', level: -35, reference: -22 });
    expect(dimmer.decide(-37, false)).toEqual({ action: 'dimmed', level: -37, reference: -22, reason: 'below_reference' });
    for (let index = 0; index < 20; index++) expect(dimmer.decide(-45, false).action).toBe('dimmed');
    expect(dimmer.reference()).toBe(-22);
  });

  it('uses the 90th percentile once it has 10 levels, so the wearer stays the reference while the partner talks more', () => {
    const { dimmer } = gate();
    for (const level of [-20, -21, -32, -33, -31, -34, -32, -33, -30, -32]) dimmer.decide(level, false);
    expect(dimmer.reference()).toBe(-21);
    expect(dimmer.decide(-34, false).action).toBe('kept');
    expect(dimmer.decide(-36, false).action).toBe('dimmed');
  });

  it('does not let one shout or knock raise the reference enough to dim the wearer', () => {
    const early = gate().dimmer;
    for (const level of [-5, -22, -23]) early.decide(level, false);
    expect(early.reference()).toBe(-22);
    expect(early.decide(-24, false).action).toBe('kept');

    const late = gate().dimmer;
    for (let index = 0; index < 12; index++) late.decide(-22, false);
    late.decide(-3, false); late.decide(-2, false);
    expect(late.reference()).toBe(-16);
    expect(late.decide(-24, false).action).toBe('kept');
  });

  it('dims below the floor even close to a quiet wearer, never dims a trigger, and keeps sentences it could not measure', () => {
    const { dimmer } = gate(14, -60);
    for (const level of [-55, -56, -54]) dimmer.decide(level, false);
    expect(dimmer.decide(-62, false)).toEqual({ action: 'dimmed', level: -62, reference: -55, reason: 'below_floor' });
    expect(dimmer.decide(-80, true)).toEqual({ action: 'trigger', level: -80, reference: -55 });
    expect(dimmer.decide(null, false)).toEqual({ action: 'unmeasured', level: null, reference: -55 });
  });

  it('reports levels without dimming when dimDb is 0, forgets after 10 minutes and on reset', () => {
    const off = gate(0).dimmer;
    expect(off.decide(-70, false)).toEqual({ action: 'off', level: -70, reference: null });

    const { dimmer, advance } = gate();
    for (const level of [-20, -21, -22]) dimmer.decide(level, false);
    advance(10 * 60_000 + 1);
    expect(dimmer.reference()).toBeNull();
    expect(dimmer.decide(-50, false).action).toBe('learning');
    dimmer.reset();
    expect(dimmer.reference()).toBeNull();
  });
});

describe('voice config', () => {
  it('defaults to 14 dB, a -60 dBFS floor, an 800 ms echo window and a 4 s stitch window, and accepts 0 to turn each off', () => {
    expect(parseVoiceConfig({})).toEqual({ dimDb: 14, floorDbfs: -60, echoMs: 800, stitchMs: 4000 });
    expect([DEFAULT_DIM_DB, DEFAULT_DIM_FLOOR_DBFS, DEFAULT_ECHO_MS]).toEqual([14, -60, 800]);
    expect(parseVoiceConfig({ ASR_DIM_DB: ' 0 ', ASR_DIM_FLOOR_DBFS: '-55.5', ASR_ECHO_MS: '0', ASR_STITCH_MS: '0' })).toEqual({ dimDb: 0, floorDbfs: -55.5, echoMs: 0, stitchMs: 0 });
    expect(parseVoiceConfig({ ASR_DIM_DB: '', ASR_ECHO_MS: '1200', ASR_STITCH_MS: '6000' })).toEqual({ dimDb: 14, floorDbfs: -60, echoMs: 1200, stitchMs: 6000 });
  });

  it('refuses values that are not numbers in range, naming the variable', () => {
    expect(() => parseVoiceConfig({ ASR_DIM_DB: '14dB' })).toThrow('ASR_DIM_DB must be a number from 0 to 60.');
    expect(() => parseVoiceConfig({ ASR_DIM_FLOOR_DBFS: '10' })).toThrow('ASR_DIM_FLOOR_DBFS must be a number from -120 to 0.');
    expect(() => parseVoiceConfig({ ASR_ECHO_MS: '-1' })).toThrow('ASR_ECHO_MS must be a number from 0 to 5000.');
    expect(() => parseVoiceConfig({ ASR_STITCH_MS: '20000' })).toThrow('ASR_STITCH_MS must be a number from 0 to 15000.');
  });
});
