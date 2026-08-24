// src/common/lib/art/rng.ts
/**
 * Deterministic randomness.
 *
 * Every drawing in this site is generated from a string seed (a project slug),
 * so a given project always renders the exact same artwork — across reloads,
 * across machines — while no two projects look alike.
 *
 * Ported from `legacy/js/art/rng.js` with the arithmetic untouched. Every
 * constant below is load-bearing: change one and every image on the site
 * silently becomes a different image, with nothing failing to report it.
 *
 * PURE. No `document`, no `window`, no `Date`, no `Math.random`. That is what
 * lets a Server Component call it and ship the SVG as cached HTML instead of
 * shipping this file to the browser.
 */

/** FNV-1a. Cheap, well-distributed, stable. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The generator object `rng()` returns.
 *
 * It is an object rather than a bare function so call sites read declaratively:
 * `r.int(2, 5)`, `r.pick(list)`, `r.chance(0.3)`.
 */
export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** float in [min,max) */
  float(min: number, max: number): number;
  /** integer in [min,max] inclusive */
  int(min: number, max: number): number;
  /** true with probability p */
  chance(p: number): boolean;
  /** uniform element */
  pick<T>(arr: readonly T[]): T;
  /** weighted element — weights parallel to items */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Fisher-Yates, returning a new array */
  shuffle<T>(arr: readonly T[]): T[];
  /** n floats summing to `total`, each at least `min` — used for bay widths */
  partition(total: number, n: number, min?: number): number[];
}

/**
 * Mulberry32 — 32-bit PRNG, tiny and fast, good enough for visual work.
 */
export function rng(seed: string | number): Rng {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    weighted: (items, weights) => {
      const total = weights.reduce((s, w) => s + w, 0);
      let t = next() * total;
      for (let i = 0; i < items.length; i++) {
        t -= weights[i];
        if (t <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    shuffle: arr => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    partition: (total, n, min = 0) => {
      const slack = total - min * n;
      if (slack <= 0) return Array.from({ length: n }, () => total / n);
      const cuts = Array.from({ length: n - 1 }, () => next() * slack).sort((x, y) => x - y);
      const out: number[] = [];
      let prev = 0;
      for (const c of cuts) {
        out.push(min + (c - prev));
        prev = c;
      }
      out.push(min + (slack - prev));
      return out;
    },
  };
}

/**
 * Round to 2dp — keeps generated SVG path strings compact.
 *
 * The precision is part of the output contract, not a formatting preference:
 * every coordinate in every generator passes through here, so raising or
 * lowering it changes the bytes of every drawing the site emits.
 */
export const n = (v: number): number => Math.round(v * 100) / 100;
