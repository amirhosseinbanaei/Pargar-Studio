/**
 * Colour.
 *
 * The reference site's warmth comes entirely from daylight photography:
 * saturated sky behind a brick or concrete mass, foliage at the base, glass
 * carrying a slice of the sky back at you, and a few windows lit warm from
 * inside. These are those colours, sorted into families a drawing can pick
 * from — so every generated project reads as a photograph of a real building
 * on a real day rather than a blueprint.
 *
 * A palette is chosen from the same seed as the geometry, so a project's
 * colour is as stable as its plan.
 */

import { rng } from './rng.js';

/** Facade materials, as actually built in north Tehran. */
export const MATERIALS = [
  { id: 'brick-red',  wall: '#96513a', dark: '#7b3f2d', lite: '#b06a4c',
    mortar: '#c0906f', trim: '#37302c' },
  { id: 'buff-brick', wall: '#c08a5b', dark: '#a3714a', lite: '#d5a373',
    mortar: '#e0c39c', trim: '#443a31' },
  { id: 'concrete',   wall: '#9c968f', dark: '#827c76', lite: '#b6b0a8',
    mortar: '#c3bdb5', trim: '#3b3735' },
  { id: 'travertine', wall: '#cbbba1', dark: '#ae9d84', lite: '#e2d5bd',
    mortar: '#ece2cf', trim: '#4a4239' },
  { id: 'timber',     wall: '#bc7b3e', dark: '#9c6229', lite: '#d69a55',
    mortar: '#e0ae76', trim: '#38302a' },
  { id: 'stone',      wall: '#a9a096', dark: '#8d857c', lite: '#c4bcb1',
    mortar: '#d2cabe', trim: '#403a35' },
];

/** Sky, top colour to horizon colour. */
export const SKIES = [
  { id: 'clear',  top: '#4f97cd', low: '#bcd9ec' },
  { id: 'high',   top: '#3d84bd', low: '#a3cbe5' },
  { id: 'hazy',   top: '#8db1c7', low: '#dfe8ed' },
  { id: 'winter', top: '#7898b2', low: '#d9e3e9' },
  { id: 'dusk',   top: '#4c5f86', low: '#d2967a' },
];

const LEAVES = ['#4d6b3a', '#5f8347', '#3d5730', '#6d8f4e', '#557640'];

/**
 * Build a coherent scheme.
 * @param {string} seed
 * @param {{night?: boolean}} [opts]
 */
export function palette(seed, opts = {}) {
  const r = rng(seed + ':pal');
  const mat = r.pick(MATERIALS);
  const sky = opts.night
    ? { id: 'night', top: '#1d2740', low: '#4a4a58' }
    : r.weighted(SKIES, [5, 4, 3, 3, 2]);
  const leaf = r.pick(LEAVES);

  // Glass takes the sky and deepens it — that is what makes a window read as
  // a window rather than a hole.
  const glass = mix(sky.top, '#12202c', 0.42);
  const glassLite = mix(sky.low, '#ffffff', 0.22);

  return {
    mat, sky, leaf,
    glass, glassLite,
    warm: '#f0bb72',              // a lit room seen from outside
    shade: 'rgba(24,18,14,0.42)', // the shadow side of a mass
    ground: mix(mat.wall, '#5a5148', 0.55),
    ink: '#241d18',
  };
}

/* --------------------------------------------------------------------------
   tiny colour maths — enough to shade a facade, no library required
   -------------------------------------------------------------------------- */

const hex = (c) => {
  const s = c.replace('#', '');
  const n = s.length === 3 ? s.split('').map((x) => x + x).join('') : s;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
};

const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');

/** Blend `a` toward `b` by t (0..1). */
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** Lighten (t>0) or darken (t<0). */
export const shade = (c, t) => (t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t));
