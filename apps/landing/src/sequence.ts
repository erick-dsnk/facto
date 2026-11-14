/**
 * The glasses animation as one MP4 per screen shape, scrubbed by scroll.
 * The browser's hardware decoder does the work, so the page stays light:
 * a few MB of video instead of hundreds of images decoded in JavaScript.
 */

export type Box = [number, number, number, number]; // x0, y0, x1, y1, normalized, top-left origin

export interface Variant {
  name: 'desktop' | 'mobile';
  width: number;
  height: number;
  count: number;
  fps: number;
  lens: Record<string, Box>;
}

export interface Placement {
  /** Right-lens box in video-element CSS pixels. */
  lens: { x: number; y: number; w: number; h: number };
}

export class Sequence {
  private current = 0;
  private pending: number | null = null;
  private disposed = false;
  private cssW = 0;
  private cssH = 0;
  onDraw?: (p: Placement) => void;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly variant: Variant,
  ) {
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('seeked', this.onSeeked);
    video.addEventListener('loadeddata', this.onLoaded);
  }

  private readonly onSeeked = () => {
    if (this.pending !== null) {
      const t = this.pending;
      this.pending = null;
      this.seek(t);
    }
  };

  private readonly onLoaded = () => {
    // iOS only paints a muted inline video after it has played once.
    const p = this.video.play();
    if (p) p.then(() => this.video.pause()).catch(() => undefined).finally(() => this.draw(this.current));
  };

  /** Start loading the variant's video at the given frame. */
  load(start = 0): void {
    this.current = start;
    const src = `${import.meta.env.BASE_URL}video/${this.variant.name}.mp4`;
    if (!this.video.src.endsWith(src)) {
      this.video.src = src;
      this.video.load();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.onDraw = undefined;
    this.pending = null;
    this.video.removeEventListener('seeked', this.onSeeked);
    this.video.removeEventListener('loadeddata', this.onLoaded);
  }

  resize(): void {
    if (this.disposed) return;
    this.cssW = this.video.clientWidth; // ignores CSS transforms
    this.cssH = this.video.clientHeight;
    this.place(this.current);
  }

  private seek(time: number): void {
    const v = this.video;
    if (v.readyState < 1) return;
    if (v.seeking) {
      this.pending = time; // only the latest target matters
      return;
    }
    if (Math.abs(v.currentTime - time) > 0.001) v.currentTime = time;
  }

  /** Show a (fractional) frame and move the HUD to its lens. */
  draw(frame: number): void {
    if (this.disposed) return;
    const last = this.variant.count - 1;
    const f = Math.max(0, Math.min(last, frame));
    this.current = f;
    // Aim for the middle of the frame so rounding never lands on its neighbour.
    this.seek((Math.round(f) + 0.5) / this.variant.fps);
    this.place(f);
  }

  /** Lens box for frame f, mapped through the video's object-fit: cover. */
  private place(f: number): void {
    if (!this.onDraw) return;
    const a = Math.floor(f);
    const b = Math.min(this.variant.count - 1, a + 1);
    const t = f - a;
    const boxA = this.variant.lens[String(a)];
    const boxB = this.variant.lens[String(b)] ?? boxA;
    if (!boxA) return;
    const { width: iw, height: ih } = this.variant;
    const s = Math.max(this.cssW / iw, this.cssH / ih);
    const dw = iw * s;
    const dh = ih * s;
    const ox = (this.cssW - dw) / 2;
    const oy = (this.cssH - dh) / 2;
    const lerp = (k: number) => boxA[k] + (boxB[k] - boxA[k]) * t;
    const [x0, y0, x1, y1] = [lerp(0), lerp(1), lerp(2), lerp(3)];
    this.onDraw({ lens: { x: ox + x0 * dw, y: oy + y0 * dh, w: (x1 - x0) * dw, h: (y1 - y0) * dh } });
  }
}
