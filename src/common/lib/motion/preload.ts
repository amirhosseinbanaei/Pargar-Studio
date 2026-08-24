// src/common/lib/motion/preload.ts
/**
 * The preloader and the opening reveal.
 *
 * Design rule for this file: the settled, visible layout is the DEFAULT state.
 * The intro is subtractive — an inline script in <head> adds `.is-intro` to
 * <html>, which hides the pieces we are about to animate in, and this module
 * takes it off again. If anything here throws, stalls, or is throttled by a
 * background tab, removing that one class is all it takes to show the site.
 *
 * That is why the animations below fill `backwards` and never `forwards`: they
 * hold their start value during the stagger delay, then hand control back to
 * plain CSS. Nothing depends on an animation reaching its end to be legible.
 *
 * Ported from `legacy/js/ui/preload.js`. No 'use client' here — see anim.ts.
 */
import { animate, stagger, wait, EASE, reduced } from './anim';

const INTRO = 'is-intro';
const root = (): HTMLElement => document.documentElement;

/**
 * The timing, SHORTENED from the static site — the one deliberate behavioural
 * change in this port, recorded in AGENTS.md as a resolved open decision.
 *
 * The original numbers bought perceived performance: there was no server
 * rendering, so the preloader covered a genuinely empty page while modules
 * parsed and the first drawing was generated. A Server Component renders the
 * shell and its artwork into the HTML, so content is on screen at first paint
 * and the preloader is now an intro flourish over a page that is already
 * finished. A long one costs the very thing it used to buy.
 *
 * Every legacy value is recorded beside its replacement, so restoring the
 * original feel is one edit to this block and nothing else.
 */
const T = {
  /** cap on waiting for stylesheets + load before finishing the bar (was 1600) */
  readyDeadline: 600,
  /** beat at 100% before the lift begins (was 140) */
  settle: 90,
  /** the wordmark and meter fading out (was 380 / 240) */
  liftInner: 280,
  liftMeter: 180,
  /** the panel sliding off the top (was 620) */
  liftOut: 420,
} as const;

/** Drop the intro mask. Safe to call any number of times. */
export function endIntro(): void {
  root().classList.remove(INTRO);
  const p = document.getElementById('preload');
  if (p) p.hidden = true;
  document.body.classList.add('is-ready');
}

export async function runPreload(): Promise<void> {
  const host = document.getElementById('preload');
  const bar = document.getElementById('preloadBar');
  const num = document.getElementById('preloadNum');
  const name = host?.querySelector<HTMLElement>('.preload__name');
  const sub = host?.querySelector<HTMLElement>('.preload__sub');

  document.body.classList.add('is-ready');
  if (!host) return;

  // Reduced motion, or loaded into a background tab: no performance to give.
  if (reduced() || document.hidden) {
    endIntro();
    return;
  }

  // Split the wordmark so it can arrive glyph by glyph.
  if (name) {
    const text = name.textContent?.trim() ?? '';
    name.textContent = '';
    name.append(
      ...[...text].map(c => {
        const s = document.createElement('span');
        s.className = 'ch' + (c === ' ' ? ' ch--space' : '');
        s.textContent = c === ' ' ? ' ' : c;
        return s;
      }),
    );
  }

  const glyphs = name ? [...name.querySelectorAll<HTMLElement>('.ch')] : [];
  void stagger(
    glyphs,
    [
      { opacity: 0, transform: 'translate3d(0,0.45em,0)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 520, step: 30, easing: EASE.expo, fill: 'backwards' },
  );

  animate(sub, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 480,
    delay: 220,
    easing: EASE.out,
    fill: 'backwards',
  });
  if (sub) sub.style.opacity = '1';

  /* -- progress ----------------------------------------------------------- */
  let pct = 0;
  const set = (v: number): void => {
    pct = Math.max(pct, Math.min(100, v));
    if (bar) bar.style.transform = `scaleX(${pct / 100})`;
    if (num) num.textContent = String(Math.round(pct)).padStart(2, '0');
  };
  set(8);

  const creep = setInterval(() => set(pct + (94 - pct) * 0.2), 60);
  await Promise.race([ready(), wait(T.readyDeadline)]);
  clearInterval(creep);
  set(100);

  await wait(T.settle);

  /* -- lift --------------------------------------------------------------- */
  // These few hold their end state: the element is removed immediately after,
  // and reverting for one frame would read as a flash.
  const out = { fill: 'forwards' } as const;
  await Promise.all([
    animate(
      host.querySelector('.preload__inner'),
      [{ opacity: 1 }, { opacity: 0, transform: 'translate3d(0,-1.1rem,0)' }],
      { duration: T.liftInner, easing: EASE.expo, ...out },
    )?.done,
    animate(host.querySelector('.preload__meter'), [{ opacity: 1 }, { opacity: 0 }], {
      duration: T.liftMeter,
      ...out,
    })?.done,
    animate(num, [{ opacity: 1 }, { opacity: 0 }], { duration: T.liftMeter, ...out })?.done,
  ]);

  await animate(
    host,
    [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-101%,0)' }],
    { duration: T.liftOut, easing: EASE.expo, ...out },
  )?.done;

  host.hidden = true;
}

/** Resolves when stylesheets have applied and the document has loaded. */
function ready(): Promise<unknown> {
  const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(l =>
    l.sheet
      ? Promise.resolve()
      : new Promise<void>(res => {
          l.addEventListener('load', () => res(), { once: true });
          l.addEventListener('error', () => res(), { once: true });
        }),
  );
  const doc =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>(res => addEventListener('load', () => res(), { once: true }));
  return Promise.all([...sheets, doc]);
}

/**
 * The columns rise into place. Called once the preloader has lifted; taking
 * `.is-intro` off is what actually makes them visible, so a throttled or
 * failed animation degrades to "already there" rather than "never appears".
 */
export function revealShell(): Promise<unknown> {
  const cols = [...document.querySelectorAll<HTMLElement>('.col')];
  root().classList.remove(INTRO);

  if (reduced() || document.hidden) return Promise.resolve();

  const q = (sel: string): (HTMLElement | null)[] => cols.map(c => c.querySelector(sel));
  const opts = { easing: EASE.expo, fill: 'backwards' } as const;

  // The trailing rule is a pseudo-element, so it rides a CSS transition
  // keyed off `.is-intro` instead — see shell.css.
  void stagger(q('.col__rule'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
    ...opts,
    duration: 820,
    step: 55,
  });

  void stagger(
    [...document.querySelectorAll<HTMLElement>('.mark')],
    [
      { opacity: 0, transform: 'scale(0)' },
      { opacity: 0.85, transform: 'scale(1)' },
    ],
    { ...opts, duration: 520, step: 45, delay: 160, easing: EASE.back },
  );

  void stagger(
    q('.col__title'),
    [
      { opacity: 0, transform: 'translate3d(-50%,calc(-50% + 12px),0)' },
      { opacity: 1, transform: 'translate3d(-50%,-50%,0)' },
    ],
    { ...opts, duration: 640, step: 58, delay: 200 },
  );

  void stagger(q('.col__idx'), [{ opacity: 0 }, { opacity: 1 }], {
    ...opts,
    duration: 420,
    step: 55,
    delay: 320,
    easing: EASE.out,
  });

  return stagger(
    [
      document.querySelector<HTMLElement>('.wordmark'),
      ...document.querySelectorAll<HTMLElement>('.footbar__set'),
    ],
    [{ opacity: 0 }, { opacity: 1 }],
    { ...opts, duration: 520, step: 70, delay: 140, easing: EASE.out },
  );
}
