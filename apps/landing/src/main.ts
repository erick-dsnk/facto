import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Sequence, type Box, type Placement, type Variant } from './sequence';
import { createPopup } from './popup';
import lensDesktop from './data/lens-desktop.json';
import lensMobile from './data/lens-mobile.json';

gsap.registerPlugin(ScrollTrigger);

const FRAMES = 360;
const LAST = FRAMES - 1;

/** Validate the Blender lens export: every entry must be a 4-number box. */
function toLens(raw: Record<string, number[]>): Record<string, Box> {
  const out: Record<string, Box> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v) && v.length === 4 && v.every(Number.isFinite)) out[k] = [v[0], v[1], v[2], v[3]];
  }
  return out;
}

const VARIANTS: Record<Variant['name'], Variant> = {
  desktop: { name: 'desktop', width: 1920, height: 1080, count: FRAMES, fps: 30, lens: toLens(lensDesktop) },
  mobile: { name: 'mobile', width: 900, height: 1600, count: FRAMES, fps: 30, lens: toLens(lensMobile) },
};

// Static layout for reduced motion, and for viewports too short to pin the stage
// (landscape phones, 400% zoom) where pinned text would be clipped.
const staticQuery = window.matchMedia('(prefers-reduced-motion: reduce), (max-height: 520px)');
const reduceMotion = staticQuery.matches;
staticQuery.addEventListener('change', () => location.reload());
const aspect = () => window.innerWidth / window.innerHeight;
const pickVariant = (): Variant => VARIANTS[aspect() < 1 ? 'mobile' : 'desktop'];

const $ = <T extends Element>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

const stage = $<HTMLElement>('.stage');
const video = $<HTMLVideoElement>('.stage__canvas');
const hud = $<HTMLElement>('.hud');
const popup = createPopup(hud);

const state = { frame: 0 };
let variant = pickVariant();
let seq = new Sequence(video, variant);
let videoTop = 0;

/** Lock the HUD to the right lens of the current frame. */
function placeHud({ lens }: Placement): void {
  const top = videoTop;
  hud.style.transform = `translate3d(${lens.x}px, ${lens.y + top}px, 0)`;
  hud.style.width = `${lens.w}px`;
  hud.style.height = `${lens.h}px`;
  hud.style.setProperty('--lw', `${lens.w}px`);
  hud.style.setProperty('--lh', `${lens.h}px`);
}

function measure(): void {
  videoTop = video.offsetTop;
  seq.resize();
}

function bindSequence(start: number): void {
  seq.onDraw = placeHud;
  seq.load(start);
  measure();
  seq.draw(start);
}

// Swap frame sets only when the viewport is clearly past square (rotation, a big
// window resize), so iOS toolbar jitter near 1:1 never reloads the sequence.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const a = aspect();
    const next = a < 0.9 ? VARIANTS.mobile : a > 1.1 ? VARIANTS.desktop : variant;
    if (next.name !== variant.name && !document.documentElement.classList.contains('is-static')) {
      seq.dispose();
      variant = next;
      seq = new Sequence(video, variant);
      bindSequence(Math.round(state.frame));
    } else {
      measure();
    }
  }, 200);
});
document.fonts?.ready.then(measure).catch(() => undefined);

// Light header over the mahogany stage, ink header over the light sections.
const bar = $<HTMLElement>('.bar');
ScrollTrigger.create({
  trigger: stage,
  start: 'top top',
  end: 'bottom 40px',
  toggleClass: { targets: bar, className: 'bar--dark' },
});

if (reduceMotion) {
  renderStatic();
} else {
  renderScroll();
}

/** No scrubbing: the final lens frame with the first verdict; text below covers both. */
function renderStatic(): void {
  document.documentElement.classList.add('is-static');
  state.frame = LAST;
  bindSequence(LAST);
  gsap.set(hud, { opacity: 1 });
  popup.showStatic();
}

function renderScroll(): void {
  bindSequence(0);
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // Hero: the glasses sit dimmed and drift a little behind the headline.
  // Portrait frames show the glasses small; start them larger on phones.
  gsap.set(video, { opacity: 0.55, scale: variant.name === 'mobile' ? 1.3 : 1 });
  const drift = gsap.to(video, { yPercent: -1.2, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  const hero = $<HTMLElement>('.hero');
  const captions = {
    orbit: $<HTMLElement>('[data-caption="orbit"]'),
    lens: $<HTMLElement>('[data-caption="lens"]'),
  };

  // The popup plays on its own clock once the lens fills the screen.
  const LENS_AT = 0.6;
  let popupOn = false;
  const setPopup = (on: boolean) => {
    if (on === popupOn) return;
    popupOn = on;
    if (on) popup.play();
    else popup.pause();
  };

  // Timeline positions are fractions of the pinned scroll (total duration 1).
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.35, // a short catch-up evens out uneven wheel and trackpad input
      onUpdate: (st) => {
        if (st.progress > 0.01 && drift.isActive()) {
          // Settle the drift at zero so the HUD math (which ignores transforms) stays exact.
          drift.kill();
          gsap.to(video, { yPercent: 0, duration: 0.4, ease: 'power2.out' });
        }
        hero.inert = st.progress > 0.06; // faded hero link must not stay focusable
        // On at the lens, off a little earlier, so scroll jitter at the edge can't restart it.
        setPopup(st.isActive && st.progress >= (popupOn ? LENS_AT - 0.03 : LENS_AT));
      },
      onLeave: () => setPopup(false),
      onLeaveBack: () => setPopup(false),
    },
  });

  tl.set({}, {}, 1); // fix total duration at 1

  // Hero out, glasses up.
  tl.to(hero, { opacity: 0, y: -40, duration: 0.06, ease: 'power2.in' }, 0.005);
  tl.to(video, { opacity: 1, duration: 0.08, ease: 'power2.out' }, 0);
  tl.to(video, { scale: 1, duration: 0.3, ease: 'power1.inOut' }, 0.04); // phones start zoomed in

  // Camera path, all from behind: back three-quarter, orbit, push into the right lens.
  tl.to(state, { frame: LAST, duration: LENS_AT - 0.03, onUpdate: () => seq.draw(state.frame) }, 0.03);

  tl.fromTo(captions.orbit, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.03, ease: 'power3.out' }, 0.12);
  tl.to(captions.orbit, { opacity: 0, duration: 0.03 }, 0.3);
  tl.fromTo(captions.lens, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.03, ease: 'power3.out' }, 0.38);
  tl.to(captions.lens, { opacity: 0, duration: 0.03 }, 0.53);

  // The display wakes as the lens fills the screen.
  tl.to(hud, { opacity: 1, duration: 0.03 }, LENS_AT - 0.03);

  // The band's glasses rise in as the section arrives.
  gsap.from('.band__glasses', {
    yPercent: 18,
    opacity: 0,
    scale: 0.92,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.band', start: 'top 85%', end: 'top 25%', scrub: true },
  });
  gsap.utils.toArray<HTMLElement>('.beat, .verdicts__title, .verdict, .close > *').forEach((el) => {
    gsap.from(el, {
      y: 32,
      opacity: 0,
      duration: 0.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  // Anchor links go through Lenis so they stay smooth.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not(.skip)').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement);
    });
  });
}
