/**
 * The motion core.
 *
 * Three ideas hold this together:
 *
 *  1. ONE rAF. Every per-frame consumer (cursor, inertia scroll, parallax)
 *     subscribes to a single shared ticker. N independent rAF loops is the
 *     most common cause of jitter in sites like this one.
 *
 *  2. TRANSFORMS ONLY. The reference site animated top/left/width/height and
 *     letter-spacing, which forces layout on every frame. Nothing here
 *     animates anything but transform, opacity, clip-path and filter.
 *
 *  3. FLIP for layout change. When an element genuinely has to move to a new
 *     place in the layout, we let CSS put it there instantly, measure the
 *     delta, and play the difference back as a transform.
 */

/* --------------------------------------------------------------------------
   easing
   -------------------------------------------------------------------------- */

export const EASE = {
  /** stand-in for anime.js easeOutExpo — the reference's house curve */
  expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  quint: 'cubic-bezier(0.22, 1, 0.36, 1)',
  out: 'cubic-bezier(0.33, 1, 0.68, 1)',
  in: 'cubic-bezier(0.55, 0, 1, 0.45)',
  inOut: 'cubic-bezier(0.65, 0.05, 0.36, 1)',
  /** slight overshoot, for marks snapping into place */
  back: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
};

export const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Play instantly instead of animating.
 *
 * Two cases: the visitor asked for reduced motion, or the document is hidden.
 * The second matters more than it looks — a hidden document stops advancing
 * its animation timeline, so an animation started there never progresses and
 * anything relying on it to finish would be stranded mid-flight. Collapsing to
 * a single frame keeps state correct and costs a background tab nothing.
 */
export const instant = () => reduced() || document.hidden;

/* --------------------------------------------------------------------------
   math
   -------------------------------------------------------------------------- */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Frame-rate independent lerp. A plain `lerp(a, b, 0.1)` per frame moves twice
 * as fast at 120Hz as at 60Hz; this keeps the feel identical on any display.
 * `smoothing` is the fraction remaining after one second.
 */
export const damp = (a, b, smoothing, dt) =>
  lerp(a, b, 1 - Math.pow(smoothing, dt));

export const round = (v, p = 1000) => Math.round(v * p) / p;

/* --------------------------------------------------------------------------
   the shared ticker
   -------------------------------------------------------------------------- */

const subs = new Set();
let raf = 0;
let last = 0;

function frame(now) {
  // dt in seconds, clamped so a backgrounded tab does not fire one huge step
  const dt = last ? Math.min((now - last) / 1000, 0.064) : 0.016;
  last = now;
  for (const fn of subs) fn(dt, now);
  raf = subs.size ? requestAnimationFrame(frame) : 0;
}

/** Subscribe to the shared loop. Returns an unsubscribe function. */
export function onTick(fn) {
  subs.add(fn);
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  return () => {
    subs.delete(fn);
    if (!subs.size && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
}

// Drop the accumulated timestamp when the tab comes back, so the first frame
// after a long background stint is not a jump.
document.addEventListener('visibilitychange', () => { last = 0; }, { passive: true });

/* --------------------------------------------------------------------------
   WAAPI wrapper
   -------------------------------------------------------------------------- */

/**
 * animate(el, keyframes, options) -> Animation
 * Adds will-change for the duration and removes it after, which matters: a
 * permanent will-change holds a compositor layer forever and costs memory.
 */
export function animate(el, keyframes, opts = {}) {
  if (!el) return null;
  /**
   * `backwards` is the default on purpose.
   *
   * A filled-forwards animation keeps overriding the cascade after it ends, so
   * a value pinned by one transition silently wins against the CSS that is
   * supposed to describe the next state — which is exactly how a closed
   * panel's leftovers reappear on the following open. Backwards fill holds the
   * start value through the stagger delay and then hands the element back to
   * CSS. Anything that genuinely needs to persist asks for it explicitly.
   */
  const {
    duration = 600, delay = 0, easing = EASE.expo,
    fill = 'backwards', composite, hint = true, ...rest
  } = opts;

  const flat = instant();
  const d = flat ? 1 : duration;
  const dl = flat ? 0 : delay;

  if (hint) {
    const props = new Set();
    const frames = Array.isArray(keyframes) ? keyframes : [keyframes];
    for (const f of frames) for (const k of Object.keys(f)) {
      if (k !== 'offset' && k !== 'easing') props.add(cssName(k));
    }
    if (props.size) el.style.willChange = [...props].join(',');
  }

  const anim = el.animate(keyframes, {
    duration: d, delay: dl, easing, fill, composite, ...rest,
  });

  /**
   * `anim.done` — always await this, never `anim.finished`.
   *
   * A document's animation timeline stops advancing while it is hidden, so an
   * animation started just before a tab switch never reaches `finished` and
   * anything awaiting it waits forever. That is enough to strand a transition
   * state machine with its "busy" flag set and silently kill every later
   * interaction. Racing the real promise against the animation's own worst
   * case keeps sequencing honest without changing how it looks.
   */
  anim.done = (flat
    // Nothing to wait for: yield one turn so the fill is applied, then carry
    // on. Sequencing a reduced-motion transition through real timeouts would
    // make it slow rather than absent.
    ? new Promise((res) => setTimeout(res, 0))
    : Promise.race([
      anim.finished.catch(() => {}),
      new Promise((res) => setTimeout(res, d + dl + 150)),
    ])
  ).then(() => { if (hint) el.style.willChange = ''; });

  return anim;
}

const cssName = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** Animate a list with a stagger. Resolves when the last one lands. */
export function stagger(els, keyframes, opts = {}) {
  const { step = 40, from = 0, ...rest } = opts;
  const list = [...els];
  const anims = list.map((el, i) =>
    animate(el, keyframes, { ...rest, delay: (rest.delay || 0) + (i - from) * step })
  ).filter(Boolean);
  return Promise.all(anims.map((a) => a.done));
}

/** A promise that resolves after `ms` — immediately when not animating. */
export const wait = (ms) =>
  new Promise((res) => setTimeout(res, instant() ? 0 : ms));

/* --------------------------------------------------------------------------
   FLIP
   -------------------------------------------------------------------------- */

/**
 * Measure a set of elements, run `mutate()` (which may change any layout it
 * likes), then play each element from where it was to where it now is.
 *
 * All reads happen before all writes, so this costs exactly two layout passes
 * regardless of how many elements are involved.
 *
 * @param {Element[]} els
 * @param {() => void} mutate
 * @param {object} opts  duration/easing/stagger + `scale` to also invert size
 * @returns {Promise<void>}
 */
export function flip(els, mutate, opts = {}) {
  const {
    duration = 900, easing = EASE.expo, step = 0, scale = false, delay = 0,
  } = opts;

  const list = [...els].filter(Boolean);
  const first = list.map((el) => el.getBoundingClientRect());

  mutate();

  const last = list.map((el) => el.getBoundingClientRect());
  const anims = [];

  for (let i = 0; i < list.length; i++) {
    const a = first[i], b = last[i];
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sx = scale && b.width ? a.width / b.width : 1;
    const sy = scale && b.height ? a.height / b.height : 1;

    // Sub-pixel deltas are not worth a composited layer.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 &&
        Math.abs(sx - 1) < 0.005 && Math.abs(sy - 1) < 0.005) continue;

    const from = `translate3d(${round(dx)}px, ${round(dy)}px, 0)` +
                 (scale ? ` scale(${round(sx, 10000)}, ${round(sy, 10000)})` : '');

    anims.push(animate(list[i], [
      { transform: from },
      { transform: 'translate3d(0, 0, 0)' + (scale ? ' scale(1, 1)' : '') },
    ], { duration, easing, delay: delay + i * step, fill: 'none' }));
  }

  return Promise.all(anims.map((a) => a.done));
}


/* --------------------------------------------------------------------------
   spring — used by the cursor
   -------------------------------------------------------------------------- */

/** A critically-damped-ish 1D spring integrated on the shared ticker. */
export function spring(initial = 0, { stiffness = 170, damping = 22 } = {}) {
  let value = initial, target = initial, velocity = 0;
  return {
    get value() { return value; },
    set target(v) { target = v; },
    get target() { return target; },
    jump(v) { value = target = v; velocity = 0; },
    step(dt) {
      const f = -stiffness * (value - target);
      const d = -damping * velocity;
      velocity += (f + d) * dt;
      value += velocity * dt;
      return value;
    },
  };
}
