// src/common/lib/motion/index.ts
/**
 * The motion layer: one shared ticker, one WAAPI wrapper, and the four
 * interaction modules the shell is built from.
 *
 * NONE of these files carries a 'use client' directive, and none should. They
 * need the DOM, but the directive marks a BOUNDARY, not a requirement — it
 * belongs on the single React component in `common/components/layout/` that
 * mounts them. Put it on a shared library instead and everything that so much
 * as imports a type from here joins the client graph.
 */
export {
  EASE,
  reduced,
  instant,
  clamp,
  lerp,
  damp,
  round,
  onTick,
  animate,
  stagger,
  wait,
  flip,
  spring,
  type TickFn,
  type TrackedAnimation,
  type AnimateOptions,
  type StaggerOptions,
  type FlipOptions,
  type Spring,
} from './anim';
export { canSplitGlyphs } from './glyphs';
export { initCursor, type CursorHandle } from './cursor';
export { smoothScroll, type SmoothScroller } from './smooth';
export { endIntro, runPreload, revealShell } from './preload';
export { createShell, type ShellApi, type ShellOptions, type ShellNavItem } from './shell';
