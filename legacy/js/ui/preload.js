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
 */

import { animate, stagger, wait, EASE, reduced } from '../core/anim.js';

const INTRO = 'is-intro';
const root = () => document.documentElement;

/** Drop the intro mask. Safe to call any number of times. */
export function endIntro() {
  root().classList.remove(INTRO);
  const p = document.getElementById('preload');
  if (p) p.hidden = true;
  document.body.classList.add('is-ready');
}

export async function runPreload() {
  const host = document.getElementById('preload');
  const bar = document.getElementById('preloadBar');
  const num = document.getElementById('preloadNum');
  const name = host?.querySelector('.preload__name');
  const sub = host?.querySelector('.preload__sub');

  document.body.classList.add('is-ready');
  if (!host) return;

  // Reduced motion, or loaded into a background tab: no performance to give.
  if (reduced() || document.hidden) { endIntro(); return; }

  // Split the wordmark so it can arrive glyph by glyph.
  if (name) {
    const text = name.textContent.trim();
    name.textContent = '';
    name.append(...[...text].map((c) => {
      const s = document.createElement('span');
      s.className = 'ch' + (c === ' ' ? ' ch--space' : '');
      s.textContent = c === ' ' ? ' ' : c;
      return s;
    }));
  }

  const glyphs = name ? [...name.querySelectorAll('.ch')] : [];
  stagger(glyphs, [
    { opacity: 0, transform: 'translate3d(0,0.45em,0)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 520, step: 30, easing: EASE.expo, fill: 'backwards' });

  animate(sub, [{ opacity: 0 }, { opacity: 1 }],
    { duration: 480, delay: 220, easing: EASE.out, fill: 'backwards' });
  sub.style.opacity = '1';

  /* -- progress ----------------------------------------------------------- */
  let pct = 0;
  const set = (v) => {
    pct = Math.max(pct, Math.min(100, v));
    bar.style.transform = `scaleX(${pct / 100})`;
    num.textContent = String(Math.round(pct)).padStart(2, '0');
  };
  set(8);

  const creep = setInterval(() => set(pct + (94 - pct) * 0.2), 60);
  await Promise.race([ready(), wait(1600)]);
  clearInterval(creep);
  set(100);

  await wait(140);

  /* -- lift --------------------------------------------------------------- */
  // These few hold their end state: the element is removed immediately after,
  // and reverting for one frame would read as a flash.
  const out = { fill: 'forwards' };
  await Promise.all([
    animate(host.querySelector('.preload__inner'),
      [{ opacity: 1 }, { opacity: 0, transform: 'translate3d(0,-1.1rem,0)' }],
      { duration: 380, easing: EASE.expo, ...out })?.done,
    animate(host.querySelector('.preload__meter'),
      [{ opacity: 1 }, { opacity: 0 }], { duration: 240, ...out })?.done,
    animate(num, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, ...out })
      ?.done,
  ]);

  await animate(host, [
    { transform: 'translate3d(0,0,0)' },
    { transform: 'translate3d(0,-101%,0)' },
  ], { duration: 620, easing: EASE.expo, ...out })?.done;

  host.hidden = true;
}

/** Resolves when stylesheets have applied and the document has loaded. */
function ready() {
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(
    (l) => (l.sheet ? Promise.resolve() : new Promise((res) => {
      l.addEventListener('load', res, { once: true });
      l.addEventListener('error', res, { once: true });
    }))
  );
  const doc = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((res) => addEventListener('load', res, { once: true }));
  return Promise.all([...sheets, doc]);
}

/**
 * The columns rise into place. Called once the preloader has lifted; taking
 * `.is-intro` off is what actually makes them visible, so a throttled or
 * failed animation degrades to "already there" rather than "never appears".
 */
export function revealShell() {
  const cols = [...document.querySelectorAll('.col')];
  root().classList.remove(INTRO);

  if (reduced() || document.hidden) return Promise.resolve();

  const q = (sel) => cols.map((c) => c.querySelector(sel));
  const opts = { easing: EASE.expo, fill: 'backwards' };

  // The trailing rule is a pseudo-element, so it rides a CSS transition
  // keyed off `.is-intro` instead — see shell.css.
  stagger(q('.col__rule'),
    [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    { ...opts, duration: 820, step: 55 });

  stagger([...document.querySelectorAll('.mark')],
    [{ opacity: 0, transform: 'scale(0)' }, { opacity: 0.85, transform: 'scale(1)' }],
    { ...opts, duration: 520, step: 45, delay: 160, easing: EASE.back });

  stagger(q('.col__title'),
    [{ opacity: 0, transform: 'translate3d(-50%,calc(-50% + 12px),0)' },
     { opacity: 1, transform: 'translate3d(-50%,-50%,0)' }],
    { ...opts, duration: 640, step: 58, delay: 200 });

  stagger(q('.col__idx'), [{ opacity: 0 }, { opacity: 1 }],
    { ...opts, duration: 420, step: 55, delay: 320, easing: EASE.out });

  return stagger(
    [document.querySelector('.wordmark'), ...document.querySelectorAll('.footbar__set')],
    [{ opacity: 0 }, { opacity: 1 }],
    { ...opts, duration: 520, step: 70, delay: 140, easing: EASE.out }
  );
}
