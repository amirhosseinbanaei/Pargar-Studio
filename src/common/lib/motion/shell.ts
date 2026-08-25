// src/common/lib/motion/shell.ts
/**
 * The shell: five columns, and the transition that promotes one of them to
 * the full stage.
 *
 * The reference site animated `top`, `left`, `width`, `height` and
 * `letter-spacing` on every frame of this move. Here the layout change is
 * instantaneous — CSS puts everything in its final place the moment a class
 * flips — and what the eye follows is a FLIP played back per glyph. Nothing
 * but transform and opacity is ever animated.
 *
 * The sequence, on open:
 *
 *    0ms   active column's artwork fades out
 *    0ms   the wipe stands up at the active column's leading edge
 *  140ms   sibling titles and rules leave, staggered outward from the active
 *  300ms   LAYOUT SWAP + per-glyph FLIP + mark redistribution
 *  340ms   the wipe sweeps across the stage and lies back down
 *  620ms   panel content is mounted and staggered in
 *
 * Ported from `legacy/js/ui/shell.js`. No 'use client' here — see anim.ts.
 *
 * WHAT CHANGED, and only this: the four things the static site imported
 * directly — the panel mounter, the i18n dictionary, the nav data and the
 * drawing generator — are now INJECTED through `createShell`'s options instead
 * of imported. Two reasons, both structural rather than stylistic:
 *
 *   - Panels, routing and the i18n dictionary are prompt 4's and prompt 5's,
 *     and this module has to compile and be testable before either exists.
 *   - Importing `draw` here would defeat the entire point of the art layer.
 *     This file ends up inside a 'use client' boundary, so an import of the
 *     generators would pull ~52KB of them back into the browser bundle for
 *     drawings the server has already rendered into the HTML.
 *
 * The transition itself — every duration, every stagger step, every class
 * flip, the queue, the FLIP — is unchanged.
 */
import { animate, stagger, flip, wait, EASE, reduced, round } from './anim';
import { canSplitGlyphs } from './glyphs';
import type { CursorHandle } from './cursor';

const esc = (s: string): string =>
  String(s).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

const OPEN_MS = 900;
const GLYPH_STEP = 18;

/** One column's nav entry, already localised by the caller. */
export interface ShellNavItem {
  id: string;
  label: string;
  caption: string;
}

export interface ShellOptions {
  /** Told after every settled open/close, so the caller can write history. */
  onChange?: (state: { id: string | null; push: boolean }) => void;
  cursor?: CursorHandle | null;
  /** The `aria-live` region that announces a section change. */
  live?: HTMLElement | null;

  /** Mount a section's content into its panel. Prompt 4 supplies this. */
  mountPanel: (id: string, panel: HTMLElement) => Promise<void> | void;
  unmountPanel: (panel: HTMLElement) => Promise<void> | void;

  /** The five nav entries, localised. Re-read on `relang()`. */
  nav: () => readonly ShellNavItem[];
  /** UI string lookup, e.g. `t('ui.escToClose')`. */
  t: (key: string) => string;
  /** Locale digit shaping for the column index numerals. */
  num: (s: string) => string;
  /** True in Persian — mirrors the mark stepper. */
  isRTL: () => boolean;

  /**
   * OPTIONAL client-side drawing. Leave it unset — the normal path — and the
   * server-rendered SVG already in `.col__art` is used as-is, which is why no
   * generator code reaches the browser. Supply it only for a surface that
   * genuinely has no server render to inherit.
   */
  drawArt?: (kind: string, seed: string, ratio: number) => string;
}

export interface ShellApi {
  open: (id: string, opts?: { push?: boolean }) => void;
  close: (opts?: { push?: boolean }) => void;
  warmArt: () => void;
  relang: () => Promise<void>;
  readonly openId: string | null;
  readonly busy: boolean;
}

export function createShell(options: ShellOptions): ShellApi {
  const { onChange, cursor, live, mountPanel, unmountPanel, nav, t, num, isRTL, drawArt } = options;

  const stageEl = document.getElementById('stage');
  const colsWrapEl = document.getElementById('cols');
  const wipeEl = document.getElementById('wipe');
  const marks = [...document.querySelectorAll<HTMLElement>('.mark')];
  const closer = document.getElementById('closer');
  const home = document.getElementById('home');
  const hint = document.getElementById('hint');

  if (!stageEl || !colsWrapEl || !wipeEl) {
    throw new Error('createShell: #stage, #cols and #wipe must all be in the document');
  }
  // Re-bound after the guard: the transition functions below are hoisted
  // declarations, and TypeScript will not carry a null-narrowing into a body
  // that could in principle run before the check.
  const stage: HTMLElement = stageEl;
  const colsWrap: HTMLElement = colsWrapEl;
  const wipe: HTMLElement = wipeEl;

  const cols = [...colsWrap.querySelectorAll<HTMLElement>('.col')];
  const byId = new Map(cols.map(c => [c.dataset.id ?? '', c]));

  let openId: string | null = null;
  let busy = false;

  /* ======================================================================
     column artwork

     On the static site this was generated here, lazily, off the critical
     path. It is now rendered by a Server Component into the HTML, so the
     normal path has nothing to do: the SVG is already in the box, in the
     cached markup, with no hydration and no layout shift. The lazy path is
     kept for a caller that injects `drawArt` and has no server render.
     ====================================================================== */
  const drawn = new WeakSet<Element>();

  function ensureArt(col: HTMLElement): void {
    const host = col.querySelector<HTMLElement>('.col__art');
    if (!host || drawn.has(host)) return;
    drawn.add(host);
    if (!drawArt || host.firstElementChild) return; // server already drew it
    const { art, seed } = host.dataset;
    if (!art || !seed) return;
    /* A resting column is roughly 1:2.5. Authoring the drawing at 1:1.4 and
       letting the SVG `slice` fit crop the sides gives a vertical detail of a
       correctly-proportioned drawing; authoring it at the column's own ratio
       would stretch the geometry instead. */
    host.innerHTML = drawArt(art, seed, 1.4);
  }

  function warmArt(): void {
    const run = (): void => cols.forEach(ensureArt);
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1800 });
    else setTimeout(run, 600);
  }

  /* ======================================================================
     titles

     The FLIP target is always `.ch`. In English that is one box per letter,
     which is what lets the tracking collapse ride on transforms. In Persian
     it is a single box holding the whole word: Arabic-script letters join,
     and splitting them into separate inline boxes destroys the shaping and
     renders the word as disconnected presentation forms. Same animation,
     same code path, one box instead of eight.
     ====================================================================== */
  function setTitles(): void {
    const items = new Map(nav().map(x => [x.id, x]));
    for (const col of cols) {
      const item = items.get(col.dataset.id ?? '');
      if (!item) continue;

      const hit = col.querySelector<HTMLElement>('.col__hit');
      if (hit) {
        hit.innerHTML = canSplitGlyphs(item.label)
          ? [...item.label]
              .map(c =>
                c === ' '
                  ? '<span class="ch ch--space"> </span>'
                  : `<span class="ch">${esc(c)}</span>`,
              )
              .join('')
          : `<span class="ch">${esc(item.label)}</span>`;
      }

      const cap = col.querySelector<HTMLElement>('.col__caption');
      if (cap) cap.textContent = item.caption;
      const idx = col.querySelector<HTMLElement>('.col__idx');
      if (idx) idx.textContent = num(String(Number(col.dataset.i) + 1).padStart(2, '0'));
    }
  }

  /* ======================================================================
     hover
     ====================================================================== */
  /* Hover is a class, not an animation. The artwork's opacity is a piece of
     state CSS should own — driving it from script would pin a value that the
     open/close rules then have to fight. */
  function hoverIn(col: HTMLElement): void {
    if (openId || busy) return;
    ensureArt(col);
    col.classList.add('is-hover');
    setRule(col, true); // neighbouring rules brighten
  }

  function hoverOut(col: HTMLElement): void {
    if (openId || busy) return;
    col.classList.remove('is-hover');
    setRule(col, false);
  }

  function setRule(col: HTMLElement, on: boolean): void {
    const own = col.querySelector<HTMLElement>('.col__rule');
    const next = col.nextElementSibling?.querySelector<HTMLElement>('.col__rule');
    for (const r of [own, next]) {
      if (r) r.style.background = on ? 'var(--rule-md)' : '';
    }
  }

  /* ======================================================================
     the wipe
     ====================================================================== */
  /**
   * A single hairline stands up at `fromX`, travels to `toX`, and lies back
   * down. It is decoration only — the transition underneath is already
   * correct without it, which is why every exit path clears it.
   */
  async function sweep(fromX: number, toX: number): Promise<void> {
    if (reduced() || document.hidden) return;
    const at = (x: number, s: number): string => `translate3d(${round(x)}px,0,0) scaleY(${s})`;

    try {
      wipe.style.transformOrigin = '50% 0';
      wipe.style.opacity = '1';

      await animate(wipe, [{ transform: at(fromX, 0) }, { transform: at(fromX, 1) }], {
        duration: 240,
        easing: EASE.expo,
      })?.done;

      await animate(wipe, [{ transform: at(fromX, 1) }, { transform: at(toX, 1) }], {
        duration: 520,
        easing: EASE.expo,
      })?.done;

      wipe.style.transformOrigin = '50% 100%';
      await animate(wipe, [{ transform: at(toX, 1) }, { transform: at(toX, 0) }], {
        duration: 240,
        easing: EASE.in,
      })?.done;
    } catch {
      /* interrupted by a faster click — fall through and clean up */
    } finally {
      wipe.style.opacity = '0';
      wipe.style.transform = at(toX, 0);
    }
  }

  /* ======================================================================
     marks — at rest they sit on the six column rules; while a panel is open
     they compress into a centred stepper showing which section you are in.
     ====================================================================== */
  const markHost = document.querySelector<HTMLElement>('.marks');
  const GAP = 18;

  // The marks are placed by CSS at 0/20/…/100% of this box, so its width is
  // the only measurement the stepper needs. It is tracked rather than read on
  // demand: reading it during a transition can catch a layout that has not
  // settled, and a stale width puts every mark in the wrong place.
  let markW = 0;
  let markState: number | null = null; // last requested activeIndex

  const markRO = new ResizeObserver(([entry]) => {
    const w = entry.contentRect.width;
    if (w < 1 || Math.abs(w - markW) < 0.5) return;
    markW = w;
    void moveMarks(markState, 1); // re-place instantly
  });
  if (markHost) markRO.observe(markHost);

  function markTargets(activeIndex: number | null): { x: number; s: number; k: number }[] {
    const w = markW || (markHost?.getBoundingClientRect().width ?? 0);
    const rest = marks.map((_, k) => (k / 5) * w);

    if (activeIndex == null) return marks.map((_, k) => ({ x: 0, s: 1, k }));

    const start = (w - GAP * 4) / 2;
    // The stepper is positioned left-to-right, but in Persian the columns run
    // right-to-left, so the dot that grows is mirrored to match what the
    // reader actually sees.
    const active = isRTL() ? 4 - activeIndex : activeIndex;
    return marks.map((_, k) => {
      if (k === 0) return { x: 0, s: 1, k }; // lead mark holds
      const idx = k - 1; // 0..4
      return { x: start + idx * GAP - rest[k], s: idx === active ? 2.6 : 1, k };
    });
  }

  function moveMarks(activeIndex: number | null, duration: number = OPEN_MS): Promise<unknown> {
    markState = activeIndex;
    const targets = markTargets(activeIndex);
    return Promise.all(
      targets.map((tg, k) => {
        const m = marks[k];
        const to = `translate3d(${round(tg.x)}px,0,0) scale(${round(tg.s, 100)},1)`;
        const from = getComputedStyle(m).transform;
        const a = animate(m, [{ transform: from === 'none' ? 'none' : from }, { transform: to }], {
          duration,
          easing: EASE.expo,
          delay: duration > 1 ? k * 26 : 0,
          fill: 'forwards',
        });
        m.style.opacity = activeIndex != null && k === activeIndex + 1 ? '1' : '';
        return a ? a.done : Promise.resolve();
      }),
    );
  }

  /* ======================================================================
     the transition queue

     Every entry point — a click, Esc, a hash change, back/forward — states a
     desired end state rather than starting a transition. A guard that simply
     dropped input while animating would lose clicks and, worse, leave the URL
     pointing at a section the shell never actually opened. Only the most
     recent request is kept: asking for three sections in quick succession
     runs one transition and lands on the third.
     ====================================================================== */
  let queued: { id: string | null; push: boolean } | null = null;

  /** @param id section to show, or null for the index */
  function go(id: string | null, { push = true }: { push?: boolean } = {}): void {
    if (id !== null && !byId.has(id)) return;
    queued = { id, push };
    if (!busy) void pump();
  }

  async function pump(): Promise<void> {
    busy = true;
    try {
      while (queued) {
        const { id, push } = queued;
        queued = null;
        if (id === openId) continue;
        // Moving between two sections retires the current panel first, or two
        // of them end up mounted on top of each other. Only the final step of
        // a hop writes history.
        if (openId) await runClose(id ? false : push);
        if (id) {
          const col = byId.get(id);
          if (col) await runOpen(col, id, push);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      // `busy` gates the queue, so it is released in a finally and never at
      // the end of the happy path. One throw here would otherwise freeze the
      // shell for the rest of the session.
      busy = false;
    }
  }

  const open = (id: string, opts?: { push?: boolean }): void => go(id, opts);
  const close = (opts?: { push?: boolean }): void => go(null, opts);

  async function runOpen(col: HTMLElement, id: string, push: boolean): Promise<void> {
    const i = Number(col.dataset.i);
    const others = cols.filter(c => c !== col);

    // 1. the active column's own artwork gets out of the way
    cols.forEach(c => {
      c.classList.remove('is-hover');
      setRule(c, false);
    });

    // 2. the wipe stands up at the column's leading edge and sweeps
    const stageRect = colsWrap.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();
    const sweepPromise = sweep(colRect.left, stageRect.right);

    // 3. siblings leave, staggered outward from the one you picked
    const leaving = others
      .map(c => ({ c, d: Math.abs(Number(c.dataset.i) - i) }))
      .sort((a, b) => a.d - b.d)
      .map(({ c }) => c);

    void stagger(
      leaving.map(c => c.querySelector('.col__title')),
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 420, step: 45, easing: EASE.out },
    );
    void stagger(
      leaving.map(c => c.querySelector('.col__idx')),
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 320, step: 40, easing: EASE.out },
    );
    void stagger(
      leaving.map(c => c.querySelector('.col__rule')),
      [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }],
      { duration: 560, step: 45, easing: EASE.expo },
    );

    await wait(140);

    // 4. THE SWAP. Layout moves in one frame; the glyphs fly the difference.
    const glyphs = [...col.querySelectorAll<HTMLElement>('.col__title .ch')];
    const caption = col.querySelector('.col__caption');
    animate(caption, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE.out });

    void moveMarks(i);

    await flip(
      glyphs,
      () => {
        stage.classList.add('is-open');
        col.classList.add('is-active');
        // `inert` takes the collapsed columns out of the tab order and off the
        // accessibility tree entirely, so a keyboard user cannot tab into a
        // column that is visually gone.
        cols.forEach(c => {
          if (c !== col) c.setAttribute('inert', '');
        });
      },
      { duration: OPEN_MS, easing: EASE.expo, step: GLYPH_STEP },
    );

    openId = id;
    cursor?.refresh?.();

    // 5. content
    const panel = col.querySelector<HTMLElement>('.panel');
    if (panel) await mountPanel(id, panel);

    if (hint) hint.textContent = t('ui.escToClose');
    if (live) live.textContent = `${t('nav.' + id)} — ${t('ui.opened')}`;
    onChange?.({ id, push });

    await sweepPromise;
  }

  /* ======================================================================
     close
     ====================================================================== */
  async function runClose(push: boolean): Promise<void> {
    const col = openId ? byId.get(openId) : undefined;
    if (!col) return;
    const i = Number(col.dataset.i);
    const others = cols.filter(c => c !== col);
    const panel = col.querySelector<HTMLElement>('.panel');

    const stageRect = colsWrap.getBoundingClientRect();
    const sweepPromise = sweep(stageRect.right, stageRect.left);

    if (panel) await unmountPanel(panel);

    const glyphs = [...col.querySelectorAll<HTMLElement>('.col__title .ch')];
    void moveMarks(null);

    await flip(
      glyphs,
      () => {
        stage.classList.remove('is-open');
        col.classList.remove('is-active');
        cols.forEach(c => c.removeAttribute('inert'));
      },
      { duration: OPEN_MS, easing: EASE.expo, step: GLYPH_STEP },
    );

    // siblings return, nearest first
    const returning = others
      .map(c => ({ c, d: Math.abs(Number(c.dataset.i) - i) }))
      .sort((a, b) => a.d - b.d)
      .map(({ c }) => c);

    void stagger(
      returning.map(c => c.querySelector('.col__rule')),
      [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
      { duration: 700, step: 50, easing: EASE.expo },
    );
    void stagger(
      returning.map(c => c.querySelector('.col__title')),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 520, step: 55, easing: EASE.out },
    );
    await stagger(
      returning.map(c => c.querySelector('.col__idx')),
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 420, step: 50, easing: EASE.out },
    );

    openId = null;
    cursor?.refresh?.();
    if (hint) hint.textContent = t('ui.selectSection');
    if (live) live.textContent = t('ui.returned');
    onChange?.({ id: null, push });

    await sweepPromise;
  }

  /* ======================================================================
     events
     ====================================================================== */
  const onPointerOver = (e: PointerEvent): void => {
    const col = e.target instanceof Element ? e.target.closest<HTMLElement>('.col') : null;
    if (col && !col.contains(e.relatedTarget as Node | null)) hoverIn(col);
  };
  const onPointerOut = (e: PointerEvent): void => {
    const col = e.target instanceof Element ? e.target.closest<HTMLElement>('.col') : null;
    if (col && !col.contains(e.relatedTarget as Node | null)) hoverOut(col);
  };
  colsWrap.addEventListener('pointerover', onPointerOver);
  colsWrap.addEventListener('pointerout', onPointerOut);

  colsWrap.addEventListener('click', e => {
    const hit = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-open]') : null;
    if (!hit) return;
    e.preventDefault();
    if (hit.dataset.open) open(hit.dataset.open);
  });

  // Focus drives the same affordances as hover, so keyboard users see the art.
  colsWrap.addEventListener('focusin', e => {
    const col = e.target instanceof Element ? e.target.closest<HTMLElement>('.col') : null;
    if (col) {
      col.classList.add('is-focus');
      hoverIn(col);
    }
  });
  colsWrap.addEventListener('focusout', e => {
    const col = e.target instanceof Element ? e.target.closest<HTMLElement>('.col') : null;
    if (col) {
      col.classList.remove('is-focus');
      hoverOut(col);
    }
  });

  closer?.addEventListener('click', () => close());
  home?.addEventListener('click', e => {
    e.preventDefault();
    close();
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' && openId) {
      e.preventDefault();
      close();
      return;
    }
    if (openId || busy) return;
    // Left/right move between columns at the index level.
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const focused =
        document.activeElement instanceof Element
          ? document.activeElement.closest<HTMLElement>('.col')
          : null;
      const at = focused ? Number(focused.dataset.i) : -1;
      const next =
        e.key === 'ArrowRight'
          ? Math.min(cols.length - 1, at + 1)
          : Math.max(0, at <= 0 ? 0 : at - 1);
      cols[next]?.querySelector<HTMLElement>('.col__hit')?.focus();
      e.preventDefault();
    }
  });

  // The mark stepper re-places itself through its ResizeObserver; the cursor
  // only needs its cached target rect invalidated.
  let rt: ReturnType<typeof setTimeout> | undefined;
  addEventListener(
    'resize',
    () => {
      clearTimeout(rt);
      rt = setTimeout(() => cursor?.refresh?.(), 120);
    },
    { passive: true },
  );

  /**
   * Re-render everything language-dependent. The open panel is rebuilt from
   * scratch rather than patched: its markup is generated from data anyway, so
   * a rebuild is both simpler and guaranteed complete.
   */
  async function relang(): Promise<void> {
    setTitles();
    if (hint) hint.textContent = openId ? t('ui.escToClose') : t('ui.selectSection');
    const closerLabel = closer?.querySelector('span');
    if (closerLabel) closerLabel.textContent = t('ui.close');
    if (openId) {
      const panel = byId.get(openId)?.querySelector<HTMLElement>('.panel');
      if (panel) {
        await unmountPanel(panel);
        await mountPanel(openId, panel);
      }
    }
    const activeCol = openId ? byId.get(openId) : undefined;
    void moveMarks(activeCol ? Number(activeCol.dataset.i) : null, 1);
  }

  setTitles();

  return {
    open,
    close,
    warmArt,
    relang,
    get openId() {
      return openId;
    },
    get busy() {
      return busy;
    },
  };
}
