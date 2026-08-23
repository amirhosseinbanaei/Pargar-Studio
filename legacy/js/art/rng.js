/**
 * Deterministic randomness.
 *
 * Every drawing in this site is generated from a string seed (a project slug),
 * so a given project always renders the exact same artwork — across reloads,
 * across machines — while no two projects look alike.
 */

/** FNV-1a. Cheap, well-distributed, stable. */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Mulberry32 — 32-bit PRNG, tiny and fast, good enough for visual work.
 * Returns a generator object rather than a bare function so call sites read
 * declaratively: r.int(2, 5), r.pick(list), r.chance(0.3).
 */
export function rng(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;

  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** float in [0,1) */
    next,
    /** float in [min,max) */
    float: (min, max) => min + next() * (max - min),
    /** integer in [min,max] inclusive */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    /** true with probability p */
    chance: (p) => next() < p,
    /** uniform element */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** weighted element — weights parallel to items */
    weighted: (items, weights) => {
      const total = weights.reduce((s, w) => s + w, 0);
      let t = next() * total;
      for (let i = 0; i < items.length; i++) {
        t -= weights[i];
        if (t <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    /** in-place Fisher-Yates */
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** n floats summing to `total`, each at least `min` — used for bay widths */
    partition: (total, n, min = 0) => {
      const slack = total - min * n;
      if (slack <= 0) return Array.from({ length: n }, () => total / n);
      const cuts = Array.from({ length: n - 1 }, () => next() * slack).sort((x, y) => x - y);
      const out = [];
      let prev = 0;
      for (const c of cuts) { out.push(min + (c - prev)); prev = c; }
      out.push(min + (slack - prev));
      return out;
    },
  };
}

/** Round to 2dp — keeps generated SVG path strings compact. */
export const n = (v) => Math.round(v * 100) / 100;
