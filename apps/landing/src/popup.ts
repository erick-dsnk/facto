/**
 * The Facto display inside the right lens, on its own clock (not scroll).
 * Motion follows docs/design/card-mockups.html, scaled into the lens:
 *   1. the claim is heard, word by word
 *   2. a band of light sweeps it
 *   3. a pill grows from where the sweep ends and names its stages
 *      (Reading, Searching, Weighing sources) while source tiles arrive
 *   4. the pill stretches into the verdict card
 * then the next example. Loops.
 */
import gsap from 'gsap';

interface Example {
  mode: string;
  /** What was said. For "You asked", the request; `read` then replaces it. */
  claim: string;
  read?: string;
  /** Publishers the search turns up; `logo` is a file in public/img/sources. */
  sources: { name: string; logo: string }[];
  verdict: 'true' | 'false';
  label: string;
  after: string;
  quote: string;
  pub: string;
}

// TODO(launch): replace sources, quotes and wording with the real pipeline output.
const EXAMPLES: Example[] = [
  {
    mode: 'Heard nearby',
    claim: 'Goldfish only remember things for three seconds.',
    sources: [
      { name: 'Live Science', logo: 'livescience' },
      { name: 'BBC', logo: 'bbc' },
      { name: 'National Geographic', logo: 'natgeo' },
    ],
    verdict: 'false',
    label: 'False',
    after: '3 of 3 sources disagree',
    quote: '“Goldfish can remember things for months, not seconds.”',
    pub: 'Live Science',
  },
  {
    mode: 'You asked',
    claim: 'Facto, can you check this?',
    read: 'The Eiffel Tower grows up to 15 cm taller in summer.',
    sources: [
      { name: 'Tour Eiffel', logo: 'toureiffel' },
      { name: 'Britannica', logo: 'britannica' },
    ],
    verdict: 'true',
    label: 'True',
    after: 'official site',
    quote: '“The tower can grow up to 15 cm as its iron expands in the heat.”',
    pub: 'toureiffel.paris',
  },
];

const logoUrl = (logo: string) => `${import.meta.env.BASE_URL}img/sources/${logo}.webp`;

// Fetch the logos up front so each tile shows its mark the moment it arrives.
const preloaded = EXAMPLES.flatMap((ex) => ex.sources.map((src) => logoUrl(src.logo))).map((url) => {
  const img = new Image();
  img.src = url;
  return img; // kept referenced so the fetch is not dropped
});
void preloaded;

const PILL_H = 1.9; // em
const STAGE_X = 1.75; // em, where stage labels start
const ICON = 1.15; // em, tile size inside the pill font
const ICON_STEP = 0.93; // em, overlap step (about a fifth of a tile, as in apps/glasses)

const q = <T extends Element>(root: ParentNode, sel: string): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

export interface Popup {
  play(): void;
  pause(): void;
  /** Static final card of the first example (reduced motion). */
  showStatic(): void;
}

export function createPopup(root: HTMLElement): Popup {
  const ui = q<HTMLElement>(root, '.lensui');
  const ctx = q<HTMLElement>(root, '.lensui__ctx');
  const mode = q<HTMLElement>(root, '.lensui__mode');
  const claimBox = q<HTMLElement>(root, '.lensui__claim');
  const text = q<HTMLElement>(root, '.lensui__text');
  const band = q<HTMLElement>(root, '.lensui__band');
  const pop = q<HTMLElement>(root, '.pop');
  const pillDot = q<HTMLElement>(root, '.pop__pill .pop__dot');
  const stages = {
    read: q<HTMLElement>(root, '.pop__stage[data-k="read"]'),
    search: q<HTMLElement>(root, '.pop__stage[data-k="search"]'),
    weigh: q<HTMLElement>(root, '.pop__stage[data-k="weigh"]'),
  };
  const iconsBox = q<HTMLElement>(root, '.pop__icons');
  const icons = Array.from(iconsBox.children) as HTMLElement[];
  const card = q<HTMLElement>(root, '.pop__card');
  const label = q<HTMLElement>(root, '.pop__label');
  const after = q<HTMLElement>(root, '.pop__after');
  const quote = q<HTMLElement>(root, '.pop__quote');
  const pub = q<HTMLElement>(root, '.pop__pub');

  const em = () => parseFloat(getComputedStyle(ui).fontSize) || 16;

  function setWords(el: HTMLElement, s: string, visible = false): void {
    el.replaceChildren(
      ...s.split(' ').map((w, k, all) => {
        const span = document.createElement('span');
        span.textContent = k < all.length - 1 ? `${w} ` : w;
        if (visible) span.style.opacity = '1';
        return span;
      }),
    );
  }

  function fillCard(ex: Example): void {
    pop.dataset.verdict = ex.verdict;
    label.textContent = ex.label;
    after.textContent = ex.after;
    quote.textContent = ex.quote;
    pub.textContent = ex.pub;
    icons.forEach((i, k) => {
      const src = ex.sources[k];
      i.style.backgroundImage = src ? `url("${logoUrl(src.logo)}")` : 'none';
      i.style.display = src ? '' : 'none';
    });
  }

  /** Reset every element to the start of an example. */
  function setup(ex: Example, cardH: number): void {
    fillCard(ex);
    mode.textContent = ex.mode;
    setWords(text, ex.claim);
    pop.style.height = `${cardH}em`;
    gsap.set(ui, { opacity: 1, scale: 1 });
    gsap.set(text, { opacity: 1 });
    gsap.set([ctx, pop, card, iconsBox, ...icons, ...Object.values(stages)], { opacity: 0 });
    gsap.set(Object.values(stages), { y: 5 });
    gsap.set(icons, { scale: 0.6 });
    gsap.set(pillDot, { opacity: 1 });
    gsap.set(band, { x: '-4em' });
    gsap.set(pop, { scale: 0.3, '--pw': '6em', '--ph': `${PILL_H}em` });
  }

  /** Words fade in one after another, at a speaking pace; layout never reflows. */
  function speak(tl: gsap.core.Timeline, words: number, at: number): number {
    const proxy = { n: 0 };
    const dur = Math.min(1.8, words * 0.2);
    tl.to(
      proxy,
      {
        n: words + 1,
        duration: dur,
        ease: 'none',
        onUpdate: () => {
          Array.from(text.children as HTMLCollectionOf<HTMLElement>).forEach((s, k) => {
            s.style.opacity = String(Math.max(0, Math.min(1, proxy.n - k)));
          });
        },
      },
      at,
    );
    return at + dur;
  }

  interface Measure {
    lw: Record<keyof typeof stages, number>;
    fullW: number;
    cardH: Record<Example['verdict'], number>;
  }

  function exampleTimeline(ex: Example, m: Measure): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.call(() => setup(ex, m.cardH[ex.verdict]), [], 0);
    tl.to(ctx, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.05);
    let t = speak(tl, ex.claim.split(' ').length, 0.25);

    if (ex.read) {
      // Capture: a quick shutter dip, then the text it read from the screen.
      const read = ex.read;
      t += 0.45;
      tl.to(ui, { scale: 0.985, duration: 0.1, ease: 'power2.in' }, t);
      tl.to(ui, { scale: 1, duration: 0.35, ease: 'expo.out' }, t + 0.1);
      tl.to(text, { opacity: 0, duration: 0.12 }, t);
      tl.call(
        () => {
          mode.textContent = 'Read from screen';
          setWords(text, read, true);
        },
        [],
        t + 0.12,
      );
      tl.to(text, { opacity: 1, duration: 0.3, ease: 'power2.out' }, t + 0.14);
      t += 0.5;
    }

    // 2. The sweep across the claim.
    const t0 = t + 0.5;
    tl.to(band, { x: () => claimBox.offsetWidth, duration: 0.45, ease: 'power2.out' }, t0);

    // 3. The pill grows out of where the sweep ends, then names its stages.
    const tp = t0 + 0.36;
    const seq: [keyof typeof stages, number][] = [
      ['read', tp],
      ['search', tp + 0.3],
      ['weigh', tp + 1.5],
    ];
    const icoT = ex.sources.map((_, i) => tp + 0.48 + i * 0.25);
    const tv = tp + 2.0;
    const labAt = (time: number) => seq.filter((s) => s[1] <= time + 1e-6).pop()![0];
    const iconX = (k: keyof typeof stages) => STAGE_X + m.lw[k] + 0.5;
    const pillW = (k: keyof typeof stages, n: number) =>
      n ? iconX(k) + ICON + (n - 1) * ICON_STEP + 0.5 : STAGE_X + m.lw[k] + 0.85;

    tl.set(pop, { '--pw': `${pillW('read', 0)}em` }, tp - 0.01);
    tl.to(pop, { scale: 1, duration: 0.28, ease: 'expo.out' }, tp);
    tl.to(pop, { opacity: 1, duration: 0.12, ease: 'power2.out' }, tp);

    seq.forEach(([k, at], i) => {
      const el = stages[k];
      const next = seq[i + 1];
      const end = next ? next[1] : tv;
      tl.to(el, { opacity: 1, duration: 0.18, ease: 'power2.out' }, at + 0.04);
      tl.to(el, { y: 0, duration: 0.26, ease: 'expo.out' }, at + 0.04);
      tl.to(el, { opacity: 0, duration: next ? 0.14 : 0.12, ease: 'power2.in' }, end);
      if (next) tl.to(el, { y: -5, duration: 0.18, ease: 'power2.in' }, end);
    });

    // Source tiles arrive while it searches; the row slides when the label changes.
    tl.set(iconsBox, { opacity: 1, left: `${iconX(labAt(icoT[0]))}em` }, icoT[0]);
    seq.forEach(([k, at]) => {
      if (at > icoT[0]) tl.to(iconsBox, { left: `${iconX(k)}em`, duration: 0.26, ease: 'expo.out' }, at + 0.04);
    });
    ex.sources.forEach((_, i) => {
      tl.to(icons[i], { opacity: 1, duration: 0.16, ease: 'power2.out' }, icoT[i] + 0.04);
      tl.to(icons[i], { scale: 1, duration: 0.22, ease: 'expo.out' }, icoT[i] + 0.04);
    });

    // The pill's width follows its content.
    const events = [...seq.slice(1).map((s) => s[1] + 0.04), ...icoT].sort((a, b) => a - b);
    events.forEach((at, i) => {
      const n = icoT.filter((x) => x <= at + 1e-6).length;
      const dur = Math.min(0.26, (events[i + 1] ?? tv) - at);
      tl.to(pop, { '--pw': `${pillW(labAt(at), n)}em`, duration: dur, ease: 'expo.out' }, at);
    });

    // 4. The pill stretches into the card.
    tl.to([iconsBox, pillDot], { opacity: 0, duration: 0.12, ease: 'power2.in' }, tv);
    tl.to(pop, { '--pw': `${m.fullW}em`, '--ph': `${m.cardH[ex.verdict]}em`, duration: 0.42, ease: 'expo.out' }, tv);
    tl.to(card, { opacity: 1, duration: 0.25, ease: 'power2.out' }, tv + 0.12);

    // Hold, then leave.
    tl.to(ui, { opacity: 0, duration: 0.4, ease: 'power2.in' }, tv + 3.6);
    tl.to({}, { duration: 0.5 });
    return tl;
  }

  /** Sizes in em, measured once the font is in, so the motion scales with the lens. */
  function measure(): Measure {
    const e = em();
    const lw = {
      read: stages.read.offsetWidth / e,
      search: stages.search.offsetWidth / e,
      weigh: stages.weigh.offsetWidth / e,
    };
    const cardH = {} as Measure['cardH'];
    pop.style.height = 'auto';
    for (const ex of EXAMPLES) {
      fillCard(ex);
      cardH[ex.verdict] = card.offsetHeight / e;
    }
    return { lw, fullW: pop.offsetWidth / e, cardH };
  }

  let master: gsap.core.Timeline | null = null;
  let builtW = 0; // card width in em when the timeline was built
  const widthEm = () => pop.offsetWidth / (parseFloat(getComputedStyle(pop).fontSize) || 16);

  function build(): gsap.core.Timeline {
    const m = measure();
    builtW = m.fullW;
    const tl = gsap.timeline({ paused: true, repeat: -1 });
    EXAMPLES.forEach((ex) => tl.add(exampleTimeline(ex, m)));
    return tl;
  }

  // The lens can still be growing when the popup first plays, and the font has a pixel
  // floor, so the card's width in em is not fixed. Rebuild when it changes, or the card
  // opens too narrow and clips its text.
  // Wait until the lens stops resizing, so a scroll that is still moving it does not
  // restart the popup on every frame.
  let staticMode = false;
  let settle = 0;
  new ResizeObserver(() => {
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      if (Math.abs(widthEm() - builtW) < 0.05) return;
      if (staticMode) {
        controls.showStatic();
        return;
      }
      if (!master) return;
      const playing = master.isActive();
      master.kill();
      master = null;
      if (playing) {
        master = build();
        master.play();
      }
    }, 150);
  }).observe(pop);

  const controls: Popup = {
    play() {
      staticMode = false;
      master ??= build();
      if (!master.isActive()) master.play();
    },
    pause() {
      master?.pause(0);
      gsap.set(ui, { opacity: 0 });
    },
    showStatic() {
      staticMode = true;
      master?.pause(0);
      const m = measure();
      builtW = m.fullW;
      const ex = EXAMPLES[0];
      setup(ex, m.cardH[ex.verdict]);
      setWords(text, ex.claim, true);
      gsap.set([ctx, pop, card], { opacity: 1 });
      gsap.set(pop, { scale: 1, '--pw': `${m.fullW}em`, '--ph': `${m.cardH[ex.verdict]}em` });
      gsap.set(pillDot, { opacity: 0 });
    },
  };
  return controls;
}
