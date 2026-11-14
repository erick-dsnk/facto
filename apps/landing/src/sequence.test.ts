import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sequence, type Variant } from './sequence';

const variant: Variant = {
  name: 'desktop', width: 1920, height: 1080, count: 360, fps: 30, lens: {},
};
const timeAt = (frame: number) => (frame + 0.5) / variant.fps;

class Video extends EventTarget {
  muted = false;
  playsInline = false;
  preload = '';
  readyState = 2;
  seeking = false;
  clientWidth = 1920;
  clientHeight = 1080;
  writes: number[] = [];
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  private time = 0;

  get currentTime() { return this.time; }
  set currentTime(time: number) {
    this.time = time;
    this.seeking = true;
    this.writes.push(time);
  }

  completeSeek(emit = true): void {
    this.seeking = false;
    if (emit) this.dispatchEvent(new Event('seeked'));
  }
}

describe('landing video scroll sequence', () => {
  let page: EventTarget & { hidden: boolean };
  let browser: EventTarget;
  let video: Video;
  let sequence: Sequence;

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { hidden: false });
    browser = new EventTarget();
    vi.stubGlobal('document', page);
    vi.stubGlobal('window', browser);
    video = new Video();
    sequence = new Sequence(video as unknown as HTMLVideoElement, variant);
  });

  afterEach(() => {
    sequence.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hide = () => {
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
  };
  const show = () => {
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
  };

  it('coalesces active seeks and draws only the latest scroll target', () => {
    sequence.draw(10);
    sequence.draw(20);
    sequence.draw(30);
    expect(video.writes).toEqual([timeAt(10)]);

    video.completeSeek();
    expect(video.writes).toEqual([timeAt(10), timeAt(30)]);
    video.completeSeek();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains hidden scroll updates and reissues the latest target on return', () => {
    sequence.draw(10);
    hide();
    sequence.draw(20);
    sequence.draw(30);
    vi.advanceTimersByTime(5000);
    expect(video.writes).toEqual([timeAt(10)]);
    expect(vi.getTimerCount()).toBe(0);

    show(); // The background seek never emitted seeked and still reports seeking.
    expect(video.writes).toEqual([timeAt(10), timeAt(30)]);
    sequence.draw(40);
    video.completeSeek();
    expect(video.writes.at(-1)).toBe(timeAt(40));
  });

  it('recovers on focus even when switching apps did not hide the document', () => {
    sequence.draw(10);
    sequence.draw(20);
    browser.dispatchEvent(new Event('focus'));
    expect(video.writes).toEqual([timeAt(10), timeAt(20)]);
    video.completeSeek();
    sequence.draw(30);
    expect(video.writes.at(-1)).toBe(timeAt(30));
  });

  it('repaints the current frame on return even if there is no queued scroll', () => {
    sequence.draw(10);
    video.completeSeek();
    hide();
    show();
    expect(video.writes).toEqual([timeAt(10), timeAt(10)]);
  });

  it('retries a stalled seek with the latest target without waiting forever', () => {
    sequence.draw(10);
    sequence.draw(20);
    vi.advanceTimersByTime(499);
    expect(video.writes).toEqual([timeAt(10)]);
    sequence.draw(30);
    vi.advanceTimersByTime(1);
    expect(video.writes).toEqual([timeAt(10), timeAt(30)]);
    vi.advanceTimersByTime(10000);
    expect(video.writes).toEqual([timeAt(10), timeAt(30), timeAt(30)]);
    expect(vi.getTimerCount()).toBe(0);

    // A later foreground transition starts another bounded recovery opportunity.
    browser.dispatchEvent(new Event('focus'));
    expect(video.writes.at(-1)).toBe(timeAt(30));
    expect(vi.getTimerCount()).toBe(1);
  });

  it('drains the latest target when seek completion happened without its event', () => {
    sequence.draw(10);
    sequence.draw(20);
    video.completeSeek(false);
    vi.advanceTimersByTime(500);
    expect(video.writes).toEqual([timeAt(10), timeAt(20)]);
    video.completeSeek(false);
    vi.advanceTimersByTime(500);
    expect(video.writes).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not replay an older queued target after a missed completion event', () => {
    sequence.draw(10);
    sequence.draw(20);
    video.completeSeek(false);
    sequence.draw(30);
    video.completeSeek();
    expect(video.writes).toEqual([timeAt(10), timeAt(30)]);
  });

  it('ignores focus while hidden and waits for visibility to return', () => {
    sequence.draw(10);
    hide();
    sequence.draw(20);
    browser.dispatchEvent(new Event('focus'));
    expect(video.writes).toEqual([timeAt(10)]);
    show();
    expect(video.writes.at(-1)).toBe(timeAt(20));
  });

  it('retains the requested frame until metadata and warm-up are available', async () => {
    video.readyState = 0;
    sequence.draw(10);
    sequence.draw(20);
    expect(video.writes).toEqual([]);
    video.readyState = 2;
    video.dispatchEvent(new Event('loadeddata'));
    await vi.waitFor(() => expect(video.writes).toEqual([timeAt(20)]));
  });

  it('removes lifecycle listeners and pending retry work on disposal', () => {
    sequence.draw(10);
    sequence.draw(20);
    sequence.dispose();
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    video.completeSeek();
    video.dispatchEvent(new Event('loadeddata'));
    sequence.draw(30);
    vi.advanceTimersByTime(10000);
    expect(video.writes).toEqual([timeAt(10)]);
    expect(video.play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let late warm-up completion pause a replacement sequence', async () => {
    let resolvePlay!: () => void;
    video.play.mockReturnValue(new Promise<void>((resolve) => { resolvePlay = resolve; }));
    video.dispatchEvent(new Event('loadeddata'));
    sequence.dispose();
    sequence = new Sequence(video as unknown as HTMLVideoElement, variant);
    sequence.draw(30);
    resolvePlay();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(video.pause).not.toHaveBeenCalled();
    expect(video.writes).toEqual([timeAt(30)]);
  });
});
