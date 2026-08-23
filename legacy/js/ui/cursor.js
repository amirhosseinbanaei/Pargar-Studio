/**
 * The custom cursor.
 *
 * A dot that tracks the pointer exactly and a ring that springs after it. Over
 * anything marked `.magnet` (or any link/button), the ring is pulled toward
 * the element's centre and grows — so targets feel like they attract the
 * cursor rather than merely highlighting under it.
 *
 * Pointer coordinates are recorded in the event and consumed on the shared
 * ticker; the handler itself never reads layout, so moving the mouse cannot
 * cause a synchronous reflow.
 */

import { onTick, spring, damp, round, reduced } from '../core/anim.js';

const MAGNET_SEL = '.magnet, a[href], button:not([disabled]), .card, .row, .fopt, .col__hit';

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root) return { destroy() {} };

  // No custom cursor on touch, or when the visitor asked for less motion.
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (!fine || reduced()) return { destroy() {} };

  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const label = root.querySelector('.cursor__label');

  document.documentElement.classList.add('has-cursor');

  let px = innerWidth / 2, py = innerHeight / 2;   // raw pointer
  let live = false;

  const rx = spring(px, { stiffness: 210, damping: 24 });
  const ry = spring(py, { stiffness: 210, damping: 24 });
  const rs = spring(1, { stiffness: 260, damping: 26 });   // ring scale
  rx.jump(px); ry.jump(py);

  let target = null;         // currently magnetised element
  let targetRect = null;
  let pull = 0;              // 0 = free, 1 = fully snapped

  /* -- pointer ----------------------------------------------------------- */
  const onMove = (e) => {
    px = e.clientX; py = e.clientY;
    if (!live) {
      live = true;
      root.classList.add('is-live');
      rx.jump(px); ry.jump(py);
    }
  };

  const onOver = (e) => {
    const el = e.target instanceof Element ? e.target.closest(MAGNET_SEL) : null;
    if (el === target) return;
    target = el;
    // One read here, on a discrete event — not on every frame.
    targetRect = el ? el.getBoundingClientRect() : null;

    const text = el?.dataset.cursor || '';
    label.textContent = text;
    root.classList.toggle('has-label', Boolean(text));
    rs.target = el ? (text ? 1.85 : 1.55) : 1;
  };

  const onDown = () => { rs.target = target ? 1.2 : 0.7; };
  const onUp = () => { rs.target = target ? 1.55 : 1; };
  const onLeave = () => { live = false; root.classList.remove('is-live'); };
  const onEnter = () => { live = true; root.classList.add('is-live'); };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerover', onOver, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });
  document.addEventListener('pointerenter', onEnter, { passive: true });

  // Rects go stale when the layout moves underneath a held pointer.
  const invalidate = () => {
    targetRect = target && target.isConnected ? target.getBoundingClientRect() : null;
    if (!targetRect) { target = null; rs.target = 1; root.classList.remove('has-label'); }
  };
  addEventListener('resize', invalidate, { passive: true });

  /* -- frame ------------------------------------------------------------- */
  const stop = onTick((dt) => {
    // How strongly the ring is drawn toward the target's centre.
    const want = targetRect ? 1 : 0;
    pull = damp(pull, want, 0.0001, dt);

    let tx = px, ty = py;
    if (targetRect && pull > 0.001) {
      const cx = targetRect.left + targetRect.width / 2;
      const cy = targetRect.top + targetRect.height / 2;
      // Cap the pull so the ring never leaves the pointer far behind on a
      // wide element like a table row.
      const maxPull = Math.min(46, targetRect.width / 2);
      const dx = Math.max(-maxPull, Math.min(maxPull, cx - px));
      const dy = Math.max(-maxPull, Math.min(maxPull, cy - py));
      tx = px + dx * pull * 0.55;
      ty = py + dy * pull * 0.55;
    }

    rx.target = tx; ry.target = ty;
    rx.step(dt); ry.step(dt); rs.step(dt);

    ring.style.transform =
      `translate3d(${round(rx.value)}px, ${round(ry.value)}px, 0) scale(${round(rs.value, 1000)})`;
    dot.style.transform = `translate3d(${round(px)}px, ${round(py)}px, 0)`;
    label.style.transform = `translate3d(${round(rx.value)}px, ${round(ry.value)}px, 0)`;
  });

  return {
    /** Re-measure after a layout change (panel open/close). */
    refresh: invalidate,
    destroy() {
      stop();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerover', onOver);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('resize', invalidate);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      document.documentElement.classList.remove('has-cursor');
      root.classList.remove('is-live');
    },
  };
}
