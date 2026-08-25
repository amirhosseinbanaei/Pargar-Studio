// src/common/lib/motion/smooth.ts
/**
 * Inertia scrolling for the content panes.
 *
 * The host clips, an inner wrapper is translated. Wheel, touch, keyboard and
 * focus all drive a single `target` value; the rendered position eases toward
 * it on the shared ticker with frame-rate-independent damping, so the feel is
 * identical at 60Hz and 120Hz.
 *
 * Accessibility is not sacrificed for the effect: arrow/page/home/end keys
 * work, and focusing an offscreen element scrolls it into view.
 *
 * Ported from `legacy/js/ui/smooth.js`. No 'use client' here — see anim.ts.
 */
import { onTick, damp, clamp, round, instant } from './anim';

const LINE = 16; // px per wheel line, for deltaMode 1

/** The handle a caller keeps to drive or tear down one pane. */
export interface SmoothScroller {
  measure: () => void;
  readonly max: number;
  scrollTo: (v: number, immediate?: boolean) => void;
  reset: () => void;
  destroy: () => void;
}

export function smoothScroll(
  host: HTMLElement,
  { smoothing = 0.0006 }: { smoothing?: number } = {},
): SmoothScroller | null {
  const found = host.querySelector<HTMLElement>('.smooth__inner');
  if (!found) return null;
  // Re-bound after the guard: `measure()` and `apply()` below are hoisted
  // function declarations, and TypeScript will not carry a null-narrowing into
  // a body that could in principle run before the check.
  const inner: HTMLElement = found;

  const thumb = host.querySelector<HTMLElement>('.smooth__thumb');

  let target = 0;
  let current = 0;
  let max = 0;
  let viewH = 0;
  let contentH = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  /* The easing runs on rAF, which does not tick under reduced motion or in a
     hidden document. Scrolling must not depend on it: when the ticker is not
     going to deliver, jump straight to the target. */
  const settleNow = (): void => {
    if (!instant()) return;
    current = target;
    apply();
  };

  /* -- measurement -------------------------------------------------------- */
  function measure(): void {
    viewH = host.clientHeight;
    contentH = inner.scrollHeight;
    max = Math.max(0, contentH - viewH);
    target = clamp(target, 0, max);
    current = clamp(current, 0, max);
    if (thumb) {
      const ratio = contentH > 0 ? Math.min(1, viewH / contentH) : 1;
      thumb.style.height = `${Math.max(24, viewH * ratio)}px`;
      thumb.style.opacity = max > 1 ? '' : '0';
    }
    apply(true);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(host);
  ro.observe(inner);

  /* -- render ------------------------------------------------------------- */
  function apply(force?: boolean): void {
    inner.style.transform = `translate3d(0, ${round(-current)}px, 0)`;
    if (thumb && max > 0) {
      const trackFree = viewH - thumb.offsetHeight;
      thumb.style.transform = `translate3d(0, ${round((current / max) * trackFree)}px, 0)`;
    }
    if (force) {
      /* nothing else to do */
    }
  }

  function markScrolling(): void {
    host.classList.add('is-scrolling');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => host.classList.remove('is-scrolling'), 700);
  }

  function setTarget(v: number): void {
    target = clamp(v, 0, max);
    markScrolling();
    settleNow();
  }

  /* -- wheel -------------------------------------------------------------- */
  function onWheel(e: WheelEvent): void {
    if (max <= 0) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * LINE : e.deltaMode === 2 ? e.deltaY * viewH : e.deltaY;
    setTarget(target + d);
  }
  host.addEventListener('wheel', onWheel, { passive: false });

  /* -- touch -------------------------------------------------------------- */
  let dragging = false;
  let lastY = 0;
  let lastT = 0;
  let vel = 0;
  let pid: number | null = null;

  function onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' || max <= 0) return;
    dragging = true;
    pid = e.pointerId;
    lastY = e.clientY;
    lastT = performance.now();
    vel = 0;
    host.setPointerCapture(pid);
  }
  function onMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pid) return;
    const now = performance.now();
    const dy = e.clientY - lastY;
    const dt = Math.max(1, now - lastT);
    vel = (-dy / dt) * 1000;
    setTarget(target - dy);
    current = target; // direct tracking under the finger
    apply();
    lastY = e.clientY;
    lastT = now;
  }
  function onUp(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    try {
      if (pid !== null) host.releasePointerCapture(pid);
    } catch {
      /* already gone */
    }
    setTarget(target + clamp(vel, -4000, 4000) * 0.22); // momentum fling
  }
  host.addEventListener('pointerdown', onDown, { passive: true });
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerup', onUp, { passive: true });
  host.addEventListener('pointercancel', onUp, { passive: true });

  /* -- keyboard ----------------------------------------------------------- */
  function onKey(e: KeyboardEvent): void {
    if (max <= 0) return;
    const page = viewH * 0.9;
    const map: Record<string, number | undefined> = {
      ArrowDown: 90,
      ArrowUp: -90,
      PageDown: page,
      PageUp: -page,
      Home: -1e9,
      End: 1e9,
      ' ': e.shiftKey ? -page : page,
    };
    const d = map[e.key];
    if (d === undefined) return;
    // Let form controls keep their own key handling.
    const t = e.target;
    if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    e.preventDefault();
    setTarget(d === -1e9 ? 0 : d === 1e9 ? max : target + d);
  }
  host.addEventListener('keydown', onKey);

  /* -- keep focus visible -------------------------------------------------- */
  function onFocusIn(e: FocusEvent): void {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !host.contains(el)) return;
    const hr = host.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const pad = 48;
    if (er.top < hr.top + pad) setTarget(target - (hr.top + pad - er.top));
    else if (er.bottom > hr.bottom - pad) setTarget(target + (er.bottom - (hr.bottom - pad)));
  }
  host.addEventListener('focusin', onFocusIn);

  /* -- loop ---------------------------------------------------------------- */
  const stop = onTick(dt => {
    if (stopped) return;
    if (Math.abs(target - current) < 0.05) {
      if (current !== target) {
        current = target;
        apply();
      }
      return;
    }
    current = damp(current, target, smoothing, dt);
    apply();
  });

  measure();

  return {
    measure,
    get max() {
      return max;
    },
    scrollTo(v: number, immediate?: boolean) {
      setTarget(v);
      if (immediate) {
        current = target;
        apply();
      }
    },
    reset() {
      target = 0;
      current = 0;
      apply();
    },
    destroy() {
      stopped = true;
      stop();
      ro.disconnect();
      clearTimeout(idleTimer);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      host.removeEventListener('keydown', onKey);
      host.removeEventListener('focusin', onFocusIn);
      inner.style.transform = '';
    },
  };
}
