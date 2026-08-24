// src/common/lib/art/draw.ts
/**
 * Procedural architecture, in colour.
 *
 * Eight generators — elevation, massing, court, section, plan, screen,
 * contour, portrait — each producing an SVG string from a string seed. No
 * raster assets ship with this site; every image you see is drawn here.
 *
 * They are built to read like photographs of buildings rather than technical
 * drawings: sky behind the mass, foliage at the base, glass carrying the sky
 * back, a shadow side, and a few windows lit warm from inside. Colour comes
 * from `palette.ts`, seeded identically to the geometry.
 *
 * Repetitive texture (brick coursing, hatching) uses <pattern> rather than
 * thousands of nodes: a facade costs ~60 elements instead of ~4000.
 *
 * Ported from `legacy/js/art/draw.js`. VERIFIED PURE — no `document`, no
 * `window`, no `Date`, no `Math.random` — so a Server Component can call it,
 * emit the result inline, and ship zero JavaScript for the drawing. Do NOT add
 * 'use client' to this file or anything it imports: that single directive
 * would pull ~52KB of generator back into the browser bundle and add a
 * hydration cost for markup that never changes.
 *
 * Every numeric constant here is part of the output. The drawings are
 * deterministic, so a changed constant silently changes every image on the
 * site and nothing fails to report it.
 */
import { rng, n, type Rng } from './rng';
import { palette, mix, shade, type Palette } from './palette';

const NS = 'http://www.w3.org/2000/svg';
const W = 1000;
const uid = (s: string): string => `k${(s || 'x').replace(/[^a-z0-9]/gi, '').slice(0, 10)}`;

/** Every generator has this shape. `ratio` is height as a multiple of width. */
export type Generator = (seed: string, ratio?: number) => string;

/* --------------------------------------------------------------------------
   shared pieces
   -------------------------------------------------------------------------- */

function svg(h: number, defs: string, body: string): string {
  return `<svg viewBox="0 0 ${W} ${n(h)}" preserveAspectRatio="xMidYMid slice"
    xmlns="${NS}" aria-hidden="true" focusable="false">
    <defs>${defs}</defs>${body}</svg>`;
}

const skyDef = (id: string, p: Palette): string => `
  <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${p.sky.top}"/>
    <stop offset="1" stop-color="${p.sky.low}"/>
  </linearGradient>`;

const glassDef = (id: string, p: Palette): string => `
  <linearGradient id="${id}-gl" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="${p.glassLite}"/>
    <stop offset="0.45" stop-color="${p.glass}"/>
    <stop offset="1" stop-color="${shade(p.glass, -0.2)}"/>
  </linearGradient>`;

/** Running-bond coursing, drawn in mortar over the wall colour. */
const brickDef = (id: string, p: Palette, course: number, len: number): string => `
  <pattern id="${id}-b" width="${n(len)}" height="${n(course * 2)}"
    patternUnits="userSpaceOnUse">
    <rect width="${n(len)}" height="${n(course * 2)}" fill="${p.mat.wall}"/>
    <path d="M0 ${n(course)}H${n(len)}M0 ${n(course * 2)}H${n(len)}
             M${n(len / 2)} 0V${n(course)}M0 ${n(course)}V${n(course * 2)}"
      stroke="${p.mat.mortar}" stroke-width="1" fill="none" opacity="0.5"/>
  </pattern>`;

/** A clump of foliage — three overlapping ellipses and a trunk. */
function tree(r: Rng, p: Palette, x: number, base: number, h: number): string {
  const w = h * r.float(0.55, 0.85);
  const c1 = p.leaf;
  const c2 = shade(p.leaf, 0.16);
  const c3 = shade(p.leaf, -0.16);
  return `<g>
    <rect x="${n(x - h * 0.028)}" y="${n(base - h * 0.34)}" width="${n(h * 0.056)}"
      height="${n(h * 0.34)}" fill="${shade(p.mat.trim, 0.1)}"/>
    <ellipse cx="${n(x - w * 0.22)}" cy="${n(base - h * 0.55)}" rx="${n(w * 0.4)}"
      ry="${n(h * 0.3)}" fill="${c3}"/>
    <ellipse cx="${n(x + w * 0.24)}" cy="${n(base - h * 0.6)}" rx="${n(w * 0.38)}"
      ry="${n(h * 0.29)}" fill="${c2}"/>
    <ellipse cx="${n(x)}" cy="${n(base - h * 0.76)}" rx="${n(w * 0.42)}"
      ry="${n(h * 0.31)}" fill="${c1}"/>
  </g>`;
}

/* ---------------------------------------------------------------------------
   1. ELEVATION — a building front, photographed against the sky.
   --------------------------------------------------------------------------- */

export function elevation(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':elev');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const ground = H * r.float(0.88, 0.94);
  const floors = r.int(4, 9);
  const parapet = H * r.float(0.06, 0.15);
  const bodyH = ground - parapet;
  const fh = bodyH / floors;

  const inset = W * r.float(0.07, 0.15);
  const bw = W - inset * 2;
  const bays = r.int(4, 8);
  const bayW = r.partition(bw, bays, bw / (bays * 2.4));
  const course = Math.max(5, fh / r.int(9, 14));

  const defs = skyDef(id, p) + glassDef(id, p) + brickDef(id, p, course, bayW[0] / r.int(4, 7));

  let s = `<rect width="${W}" height="${n(H)}" fill="url(#${id}-sky)"/>`;

  // a neighbour behind, to give the city some depth
  if (r.chance(0.75)) {
    const nx = r.chance(0.5) ? 0 : W * r.float(0.55, 0.72);
    const nw = W * r.float(0.28, 0.45);
    s += `<rect x="${n(nx)}" y="${n(parapet + fh * r.float(0.4, 1.4))}" width="${n(nw)}"
            height="${n(H)}" fill="${mix(p.mat.dark, p.sky.low, 0.55)}"/>`;
  }

  // ground
  s += `<rect x="0" y="${n(ground)}" width="${W}" height="${n(H - ground)}"
          fill="${p.ground}"/>`;

  // the mass
  s += `<rect x="${n(inset)}" y="${n(parapet)}" width="${n(bw)}" height="${n(bodyH)}"
          fill="url(#${id}-b)"/>`;

  // shadow side — one flank falls away from the sun
  const sunLeft = r.chance(0.5);
  s += `<rect x="${n(sunLeft ? inset + bw * 0.62 : inset)}" y="${n(parapet)}"
          width="${n(bw * 0.38)}" height="${n(bodyH)}" fill="${p.shade}"/>`;

  // floor lines
  for (let f = 1; f < floors; f++) {
    const y = parapet + fh * f;
    s += `<line x1="${n(inset)}" y1="${n(y)}" x2="${n(inset + bw)}" y2="${n(y)}"
            stroke="${p.mat.dark}" stroke-width="1.4" opacity="0.5"/>`;
  }

  // openings
  let x = inset;
  const recessBay = r.int(0, bays - 1);
  for (let b = 0; b < bays; b++) {
    const bwid = bayW[b];
    const pad = bwid * r.float(0.16, 0.3);
    const ox = x + pad;
    const ow = bwid - pad * 2;
    const isRecess = b === recessBay && ow > 40;

    if (isRecess) {
      const ry = parapet + fh * 0.3;
      const rh = bodyH - fh * 0.6;
      s += `<rect x="${n(ox)}" y="${n(ry)}" width="${n(ow)}" height="${n(rh)}"
              fill="url(#${id}-gl)"/>`;
      s += `<rect x="${n(ox)}" y="${n(ry)}" width="${n(ow)}" height="${n(rh)}"
              fill="${p.ink}" opacity="0.3"/>`;
      const gm = r.int(2, 4);
      for (let m = 1; m <= gm; m++) {
        const mx = ox + (ow / (gm + 1)) * m;
        s += `<line x1="${n(mx)}" y1="${n(ry)}" x2="${n(mx)}" y2="${n(ry + rh)}"
                stroke="${p.mat.trim}" stroke-width="2"/>`;
      }
      for (let f = 1; f < floors; f++) {
        const y = parapet + fh * f;
        s += `<rect x="${n(ox)}" y="${n(y - 3)}" width="${n(ow)}" height="6"
                fill="${p.mat.lite}"/>`;
      }
      x += bwid;
      continue;
    }

    for (let f = 0; f < floors; f++) {
      const top = parapet + fh * f;
      if (f === 0 && r.chance(0.3)) continue;

      const oh = fh * r.float(0.4, 0.62);
      const oy = top + (fh - oh) * r.float(0.34, 0.58);
      const lit = r.chance(0.14);

      s += `<rect x="${n(ox)}" y="${n(oy)}" width="${n(ow)}" height="${n(oh)}"
              fill="${lit ? p.warm : `url(#${id}-gl)`}"/>`;
      // reveal — the depth of the opening in the wall
      s += `<path d="M${n(ox)} ${n(oy + oh)}V${n(oy)}H${n(ox + ow)}"
              stroke="${p.mat.dark}" stroke-width="3" fill="none" opacity="0.75"/>`;
      s += `<rect x="${n(ox)}" y="${n(oy + oh - 3)}" width="${n(ow)}" height="4"
              fill="${p.mat.lite}"/>`;

      const mull = r.int(0, 2);
      for (let m = 1; m <= mull; m++) {
        const mx = ox + (ow / (mull + 1)) * m;
        s += `<line x1="${n(mx)}" y1="${n(oy)}" x2="${n(mx)}" y2="${n(oy + oh)}"
                stroke="${p.mat.trim}" stroke-width="2"/>`;
      }

      if (r.chance(0.24) && f > 0) {
        const by = oy + oh;
        const proj = fh * 0.15;
        s += `<rect x="${n(ox - 8)}" y="${n(by)}" width="${n(ow + 16)}" height="${n(proj)}"
                fill="${p.mat.lite}" opacity="0.9"/>`;
        for (let g = 0; g <= 6; g++) {
          const gx = ox - 8 + ((ow + 16) / 6) * g;
          s += `<line x1="${n(gx)}" y1="${n(by)}" x2="${n(gx)}" y2="${n(by + proj)}"
                  stroke="${p.mat.trim}" stroke-width="1.6" opacity="0.8"/>`;
        }
        if (r.chance(0.5)) {
          s += `<ellipse cx="${n(ox + ow * r.float(0.2, 0.8))}" cy="${n(by - 3)}"
                  rx="${n(ow * 0.16)}" ry="${n(proj * 0.5)}" fill="${p.leaf}"/>`;
        }
      }
    }
    x += bwid;
  }

  // parapet cap
  s += `<rect x="${n(inset - 8)}" y="${n(parapet - 9)}" width="${n(bw + 16)}" height="10"
          fill="${p.mat.lite}"/>`;

  // street trees in front
  const treeCount = r.int(1, 3);
  for (let i = 0; i < treeCount; i++) {
    const tx = W * ((i + 0.5) / treeCount) + r.float(-70, 70);
    s += tree(r, p, tx, ground + 4, H * r.float(0.3, 0.46));
  }

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   2. MASSING — stacked volumes, lit from one side.
   --------------------------------------------------------------------------- */

export function massing(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':mass');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;
  const cx = W / 2;
  const cy = H * 0.66;
  const u = W * r.float(0.052, 0.072);
  const k = 0.5;

  const iso = (x: number, y: number, z: number): [number, number] => [
    cx + (x - y) * u,
    cy + (x + y) * u * k - z * u,
  ];

  const defs = skyDef(id, p);
  let s = `<rect width="${W}" height="${n(H)}" fill="url(#${id}-sky)"/>`;

  // ground plane
  const g = 8;
  const corners = [iso(-g, -g, 0), iso(g, -g, 0), iso(g, g, 0), iso(-g, g, 0)];
  s += `<polygon points="${corners.map(c => c.map(n).join(' ')).join(' ')}"
          fill="${mix(p.leaf, '#9aa38a', 0.45)}"/>`;
  for (let i = -g; i <= g; i += 2) {
    const a = iso(i, -g, 0).map(n);
    const b = iso(i, g, 0).map(n);
    const c = iso(-g, i, 0).map(n);
    const d = iso(g, i, 0).map(n);
    s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"
            stroke="${p.ink}" stroke-width="0.6" opacity="0.12"/>`;
    s += `<line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}"
            stroke="${p.ink}" stroke-width="0.6" opacity="0.12"/>`;
  }

  const box = (x: number, y: number, z: number, w: number, d: number, h: number): string => {
    const pt = (X: number, Y: number, Z: number): string => iso(X, Y, Z).map(n).join(' ');
    const top = `${pt(x, y, z + h)} ${pt(x + w, y, z + h)} ${pt(x + w, y + d, z + h)} ${pt(x, y + d, z + h)}`;
    const left = `${pt(x, y + d, z)} ${pt(x, y + d, z + h)} ${pt(x + w, y + d, z + h)} ${pt(x + w, y + d, z)}`;
    const right = `${pt(x + w, y, z)} ${pt(x + w, y, z + h)} ${pt(x + w, y + d, z + h)} ${pt(x + w, y + d, z)}`;
    // windows punched into the sunlit face
    let win = '';
    const cols = Math.max(1, w);
    const rows = Math.max(1, h);
    for (let a = 0; a < cols; a++) {
      for (let b = 0; b < rows; b++) {
        if (!r.chance(0.55)) continue;
        const q = [
          iso(x + a + 0.22, y + d, z + b + 0.28),
          iso(x + a + 0.78, y + d, z + b + 0.28),
          iso(x + a + 0.78, y + d, z + b + 0.76),
          iso(x + a + 0.22, y + d, z + b + 0.76),
        ];
        win += `<polygon points="${q.map(c => c.map(n).join(' ')).join(' ')}"
                  fill="${r.chance(0.12) ? p.warm : p.glass}" opacity="0.9"/>`;
      }
    }
    return `<polygon points="${top}" fill="${p.mat.lite}"/>
            <polygon points="${left}" fill="${p.mat.wall}"/>
            <polygon points="${right}" fill="${p.mat.dark}"/>${win}`;
  };

  const blocks: {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    h: number;
    key: number;
  }[] = [];
  for (let i = 0; i < r.int(3, 6); i++) {
    const w = r.int(2, 4);
    const d = r.int(2, 4);
    const x = r.int(-4, 2);
    const y = r.int(-4, 2);
    const z = r.chance(0.4) ? r.int(1, 3) : 0;
    const h = r.int(1, 4);
    blocks.push({ x, y, z, w, d, h, key: x + y + z });
  }
  blocks.sort((a, b) => a.key - b.key);
  for (const b of blocks) s += box(b.x, b.y, b.z, b.w, b.d, b.h);

  // planting around the base
  for (let i = 0; i < r.int(3, 6); i++) {
    const px = W * r.float(0.08, 0.92);
    const py = H * r.float(0.72, 0.94);
    const th = H * r.float(0.1, 0.17);
    s += tree(r, p, px, py, th);
  }

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   3. COURT — a courtyard seen from above: pool, paving, planting.
   --------------------------------------------------------------------------- */

export function court(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':court');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const defs = skyDef(id, p);
  const paving = mix(p.mat.lite, '#d8cdb8', 0.4);
  const t = W * r.float(0.1, 0.17); // depth of the surrounding building

  let s = `<rect width="${W}" height="${n(H)}" fill="${paving}"/>`;

  // paving, laid in courses with visible joints
  const cw = W / r.int(9, 14);
  const chh = cw * r.float(0.6, 1);
  for (let j = 0; j * chh < H; j++) {
    const off = j % 2 ? cw / 2 : 0;
    for (let i = -1; i * cw < W; i++) {
      s += `<rect x="${n(i * cw + off + 1)}" y="${n(j * chh + 1)}"
              width="${n(cw - 2)}" height="${n(chh - 2)}"
              fill="${shade(paving, r.float(-0.05, 0.05))}"/>`;
    }
  }

  // roofs of the surrounding building, seen from above
  s += `<path d="M0 0H${W}V${n(H)}H0Z M${n(t)} ${n(t)}V${n(H - t)}H${n(W - t)}V${n(t)}Z"
          fill="${p.mat.dark}" fill-rule="evenodd"/>`;
  // parapet catching the light on two sides
  s += `<path d="M0 0H${W}V${n(t * 0.28)}H0Z" fill="${p.mat.lite}" opacity="0.7"/>`;
  s += `<path d="M0 0V${n(H)}H${n(t * 0.28)}V0Z" fill="${p.mat.lite}" opacity="0.45"/>`;
  // rooflights scattered over the roof band
  for (let i = 0; i < r.int(4, 9); i++) {
    const onTop = r.chance(0.5);
    const rx = onTop ? W * r.float(0.05, 0.95) : r.chance(0.5) ? t * 0.5 : W - t * 0.5;
    const ry = onTop ? (r.chance(0.5) ? t * 0.5 : H - t * 0.5) : H * r.float(0.05, 0.95);
    s += `<rect x="${n(rx - 14)}" y="${n(ry - 9)}" width="28" height="18"
            fill="${p.glass}" opacity="0.85"/>`;
  }
  // the inner face of the court, in shadow on two sides
  s += `<rect x="${n(t)}" y="${n(t)}" width="${n(W - t * 2)}" height="${n(H - t * 2)}"
          fill="none" stroke="${p.ink}" stroke-width="3" opacity="0.35"/>`;

  const ix = t;
  const iy = t;
  const iw = W - t * 2;
  const ih = H - t * 2;

  // the pool — sky caught on the ground
  const pw = iw * r.float(0.36, 0.6);
  const ph = ih * r.float(0.26, 0.46);
  const px = ix + (iw - pw) * r.float(0.2, 0.8);
  const py = iy + (ih - ph) * r.float(0.2, 0.8);
  s += `<rect x="${n(px - 7)}" y="${n(py - 7)}" width="${n(pw + 14)}" height="${n(ph + 14)}"
          fill="${shade(paving, 0.12)}"/>`;
  s += `<rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}"
          fill="url(#${id}-sky)"/>`;
  s += `<rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}"
          fill="${p.glass}" opacity="0.4"/>`;
  for (let i = 0; i < 5; i++) {
    const ly = py + ph * ((i + 1) / 6);
    s += `<line x1="${n(px + 8)}" y1="${n(ly)}" x2="${n(px + pw * r.float(0.5, 0.95))}"
            y2="${n(ly)}" stroke="#ffffff" stroke-width="1.6" opacity="0.2"/>`;
  }

  // the building's shadow thrown across the court
  const sd = iw * r.float(0.2, 0.36);
  s += `<path d="M${n(ix)} ${n(iy)}H${n(ix + sd)}L${n(ix + sd * 0.55)} ${n(iy + ih)}
          H${n(ix)}Z" fill="${p.ink}" opacity="0.17"/>`;

  // trees, each with a shadow offset the same way
  for (let i = 0; i < r.int(3, 6); i++) {
    const cxx = ix + r.float(0.08, 0.92) * iw;
    const cyy = iy + r.float(0.08, 0.92) * ih;
    if (cxx > px - 24 && cxx < px + pw + 24 && cyy > py - 24 && cyy < py + ph + 24) continue;
    const rad = W * r.float(0.04, 0.08);
    s += `<ellipse cx="${n(cxx + rad * 0.5)}" cy="${n(cyy + rad * 0.42)}" rx="${n(rad)}"
            ry="${n(rad * 0.82)}" fill="${p.ink}" opacity="0.2"/>`;
    s += `<circle cx="${n(cxx)}" cy="${n(cyy)}" r="${n(rad)}" fill="${shade(p.leaf, -0.16)}"/>`;
    s += `<circle cx="${n(cxx - rad * 0.16)}" cy="${n(cyy - rad * 0.16)}" r="${n(rad * 0.74)}"
            fill="${p.leaf}"/>`;
    s += `<circle cx="${n(cxx - rad * 0.3)}" cy="${n(cyy - rad * 0.3)}" r="${n(rad * 0.4)}"
            fill="${shade(p.leaf, 0.18)}"/>`;
  }

  // a bench or two, for scale
  for (let i = 0; i < r.int(1, 3); i++) {
    const bx = ix + r.float(0.1, 0.85) * iw;
    const by = iy + r.float(0.1, 0.9) * ih;
    const bw = iw * 0.09;
    s += `<rect x="${n(bx)}" y="${n(by)}" width="${n(bw)}" height="${n(bw * 0.3)}"
            fill="${p.mat.trim}" opacity="0.65"/>`;
  }

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   4. SECTION — cut through the building, sky above, ground below.
   --------------------------------------------------------------------------- */

export function section(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':sect');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const levels = r.int(2, 7);
  const base = r.chance(0.3) ? r.int(1, 2) : 0;
  const wide = r.chance(0.5);
  const x0 = W * (wide ? r.float(0.04, 0.1) : r.float(0.17, 0.29));
  const x1 = W - x0;
  const span = x1 - x0;

  const ground = H * (base ? r.float(0.62, 0.74) : r.float(0.8, 0.9));
  const top = H * r.float(0.06, 0.16);
  const fh = (ground - top) / levels;
  const slab = Math.max(7, Math.min(16, fh * r.float(0.12, 0.18)));

  const roof = r.weighted(['flat', 'pitch', 'step'], [5, 2, 2]);
  const setback = r.chance(0.3) ? r.int(1, Math.max(1, levels - 1)) : 0;
  const setIn = span * r.float(0.12, 0.24);
  const inner = (l: number): [number, number] =>
    setback && l >= setback ? [x0 + setIn, x1 - setIn] : [x0, x1];

  const defs =
    skyDef(id, p) +
    glassDef(id, p) +
    `
    <pattern id="${id}-e" width="14" height="14" patternUnits="userSpaceOnUse"
      patternTransform="rotate(35)">
      <rect width="14" height="14" fill="${p.ground}"/>
      <line x1="0" y1="0" x2="0" y2="14" stroke="${shade(p.ground, -0.2)}" stroke-width="2"/>
    </pattern>`;

  let s = `<rect width="${W}" height="${n(H)}" fill="url(#${id}-sky)"/>`;
  s += `<rect x="0" y="${n(ground)}" width="${W}" height="${n(H - ground)}"
          fill="url(#${id}-e)"/>`;

  const voidKind = r.weighted(['none', 'double', 'atrium'], [3, 4, 3]);
  const vA = x0 + span * r.float(0.24, 0.5);
  const vB = vA + span * r.float(0.14, 0.26);
  const vFrom = r.int(1, Math.max(1, levels - 1));
  const vTo = voidKind === 'atrium' ? levels : Math.min(levels, vFrom + 1);
  const cut = (l: number): boolean => voidKind !== 'none' && l > vFrom && l <= vTo;

  // rooms — the interior air, warm where it is occupied
  for (let l = 0; l < levels; l++) {
    const [a, b] = inner(l);
    s += `<rect x="${n(a)}" y="${n(ground - fh * (l + 1))}" width="${n(b - a)}"
            height="${n(fh)}" fill="${mix(p.warm, '#efe2cb', 0.62)}"/>`;
  }
  for (let b2 = 1; b2 <= base; b2++) {
    s += `<rect x="${n(x0)}" y="${n(ground + fh * (b2 - 1))}" width="${n(span)}"
            height="${n(fh)}" fill="${mix(p.warm, '#6f665c', 0.72)}"/>`;
  }

  // furniture-scale marks so the rooms read as rooms
  for (let l = 0; l < levels; l++) {
    const [a, b] = inner(l);
    const y = ground - fh * l;
    for (let i = 0; i < r.int(1, 3); i++) {
      const fx = a + (b - a) * r.float(0.1, 0.85);
      const fwid = span * r.float(0.06, 0.13);
      s += `<rect x="${n(fx)}" y="${n(y - fh * 0.22)}" width="${n(fwid)}"
              height="${n(fh * 0.22)}" fill="${p.mat.trim}" opacity="0.3"/>`;
    }
  }

  const cut2 = (l: number): boolean => cut(l);
  // slabs
  for (let l = 1; l <= levels; l++) {
    const y = ground - fh * l;
    const [a, b] = inner(l);
    const spans = cut2(l)
      ? [
          [a, Math.min(vA, b)],
          [Math.max(vB, a), b],
        ]
      : [[a, b]];
    for (const [q1, q2] of spans) {
      if (q2 - q1 < 2) continue;
      s += `<rect x="${n(q1)}" y="${n(y - slab)}" width="${n(q2 - q1)}"
              height="${n(slab)}" fill="${p.mat.wall}"/>`;
      s += `<rect x="${n(q1)}" y="${n(y - slab)}" width="${n(q2 - q1)}" height="2.5"
              fill="${p.mat.lite}"/>`;
    }
  }

  // envelope
  for (let l = 0; l < levels; l++) {
    const [a, b] = inner(l);
    const y = ground - fh * (l + 1);
    s += `<rect x="${n(a - slab)}" y="${n(y)}" width="${n(slab)}" height="${n(fh)}"
            fill="${p.mat.wall}"/>`;
    s += `<rect x="${n(b)}" y="${n(y)}" width="${n(slab)}" height="${n(fh)}"
            fill="${p.mat.wall}"/>`;
    // a window on each flank, showing sky through the cut
    if (r.chance(0.6)) {
      s += `<rect x="${n(b)}" y="${n(y + fh * 0.28)}" width="${n(slab)}"
              height="${n(fh * 0.4)}" fill="url(#${id}-gl)"/>`;
    }
  }
  for (let b2 = 1; b2 <= base; b2++) {
    s += `<rect x="${n(x0 - slab)}" y="${n(ground + fh * (b2 - 1))}" width="${n(slab)}"
            height="${n(fh)}" fill="${p.mat.dark}"/>`;
    s += `<rect x="${n(x1)}" y="${n(ground + fh * (b2 - 1))}" width="${n(slab)}"
            height="${n(fh)}" fill="${p.mat.dark}"/>`;
  }

  // roof
  const [ra, rb] = inner(levels - 1);
  if (roof === 'pitch') {
    const apex = top - fh * r.float(0.35, 0.7);
    s += `<path d="M${n(ra - slab)} ${n(top)}L${n((ra + rb) / 2)} ${n(apex)}
            L${n(rb + slab)} ${n(top)}Z" fill="${p.mat.dark}"/>`;
  } else if (roof === 'step') {
    const m = (ra + rb) / 2;
    s += `<rect x="${n(ra - slab)}" y="${n(top - slab)}" width="${n(m - ra + slab)}"
            height="${n(slab)}" fill="${p.mat.dark}"/>`;
    s += `<rect x="${n(m)}" y="${n(top - fh * 0.5)}" width="${n(rb - m + slab)}"
            height="${n(slab)}" fill="${p.mat.dark}"/>`;
  } else {
    s += `<rect x="${n(ra - slab)}" y="${n(top - slab)}" width="${n(rb - ra + slab * 2)}"
            height="${n(slab)}" fill="${p.mat.dark}"/>`;
  }

  // stair
  if (r.chance(0.78) && levels > 1) {
    const sw = span * r.float(0.1, 0.17);
    const sx = r.chance(0.5) ? x0 + span * r.float(0.06, 0.2) : x1 - sw - span * r.float(0.06, 0.2);
    for (let l = 0; l < levels; l++) {
      const yb = ground - fh * l;
      let d = `M${n(sx)} ${n(yb)}`;
      for (let i = 0; i < 9; i++) d += `v${n(-fh / 9)}h${n(sw / 9)}`;
      s += `<path d="${d}" stroke="${p.mat.trim}" stroke-width="2.4" fill="none"
              opacity="0.75"/>`;
    }
  }

  // figures for scale
  for (let i = 0; i < r.int(2, 4); i++) {
    const px = x0 + span * r.float(0.08, 0.9);
    const lvl = r.int(0, levels - 1);
    const py = ground - fh * lvl;
    const fhh = fh * 0.36;
    s += `<g stroke="${p.ink}" stroke-width="2" opacity="0.5" fill="none">
        <circle cx="${n(px)}" cy="${n(py - fhh)}" r="${n(fhh * 0.14)}" fill="${p.ink}"/>
        <line x1="${n(px)}" y1="${n(py - fhh * 0.84)}" x2="${n(px)}" y2="${n(py - fhh * 0.3)}"/>
        <line x1="${n(px)}" y1="${n(py - fhh * 0.3)}" x2="${n(px - fhh * 0.12)}" y2="${n(py)}"/>
        <line x1="${n(px)}" y1="${n(py - fhh * 0.3)}" x2="${n(px + fhh * 0.12)}" y2="${n(py)}"/>
      </g>`;
  }

  // trees on the ground line
  for (let i = 0; i < r.int(1, 2); i++) {
    const tx = r.chance(0.5) ? x0 * r.float(0.15, 0.7) : x1 + (W - x1) * r.float(0.3, 0.85);
    s += tree(r, p, tx, ground + 2, H * r.float(0.14, 0.24));
  }

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   5. PLAN — poché walls, rooms, a courtyard.
   --------------------------------------------------------------------------- */

export function plan(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':plan');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const m = W * r.float(0.07, 0.13);
  const x0 = m;
  const y0 = H * r.float(0.08, 0.14);
  const x1 = W - m;
  const y1 = H - H * r.float(0.08, 0.14);
  const pw = r.float(13, 19);

  const paper = mix(p.mat.lite, '#f2ead9', 0.3);
  const defs = skyDef(id, p);

  let s = `<rect width="${W}" height="${n(H)}" fill="${mix(p.leaf, '#c9ccb8', 0.62)}"/>`;

  // floor
  s += `<rect x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}"
          fill="${paper}"/>`;

  const wall = (ax: number, ay: number, bx: number, by: number, thin?: boolean): string => {
    const t = thin ? pw * 0.55 : pw;
    const vert = Math.abs(bx - ax) < 1;
    const w = vert ? t : Math.abs(bx - ax) + t;
    const h = vert ? Math.abs(by - ay) + t : t;
    return `<rect x="${n(Math.min(ax, bx) - t / 2)}" y="${n(Math.min(ay, by) - t / 2)}"
              width="${n(w)}" height="${n(h)}"
              fill="${thin ? p.mat.wall : p.mat.dark}"/>`;
  };

  // courtyard
  let court2: { cx: number; cy: number; cw: number; ch: number } | null = null;
  if (r.chance(0.72)) {
    const cw = (x1 - x0) * r.float(0.22, 0.36);
    const ch = (y1 - y0) * r.float(0.3, 0.48);
    const cx = x0 + (x1 - x0 - cw) * r.float(0.25, 0.7);
    const cy = y0 + (y1 - y0 - ch) * r.float(0.25, 0.7);
    court2 = { cx, cy, cw, ch };

    s += `<rect x="${n(cx)}" y="${n(cy)}" width="${n(cw)}" height="${n(ch)}"
            fill="${mix(p.mat.lite, p.leaf, 0.25)}"/>`;
    const pw2 = cw * 0.52;
    const ph = ch * 0.34;
    s += `<rect x="${n(cx + (cw - pw2) / 2)}" y="${n(cy + (ch - ph) / 2)}"
            width="${n(pw2)}" height="${n(ph)}" fill="url(#${id}-sky)"/>`;
    const tx = cx + cw * r.float(0.16, 0.84);
    const ty = cy + ch * r.float(0.16, 0.84);
    s += `<circle cx="${n(tx)}" cy="${n(ty)}" r="${n(Math.min(cw, ch) * 0.13)}"
            fill="${p.leaf}"/>`;
    s += wall(cx, cy, cx + cw, cy) + wall(cx, cy + ch, cx + cw, cy + ch);
    s += wall(cx, cy, cx, cy + ch) + wall(cx + cw, cy, cx + cw, cy + ch);
  }

  s += wall(x0, y0, x1, y0) + wall(x0, y1, x1, y1);
  s += wall(x0, y0, x0, y1) + wall(x1, y0, x1, y1);

  for (let i = 0; i < r.int(7, 12); i++) {
    if (r.chance(0.5)) {
      const px = x0 + (x1 - x0) * r.float(0.14, 0.86);
      if (court2 && px > court2.cx - 16 && px < court2.cx + court2.cw + 16) continue;
      const a = y0 + (y1 - y0) * r.float(0, 0.5);
      const b = a + (y1 - y0) * r.float(0.24, 0.5);
      s += wall(px, a, px, Math.min(b, y1), true);
    } else {
      const py = y0 + (y1 - y0) * r.float(0.14, 0.86);
      if (court2 && py > court2.cy - 16 && py < court2.cy + court2.ch + 16) continue;
      const a = x0 + (x1 - x0) * r.float(0, 0.5);
      const b = a + (x1 - x0) * r.float(0.24, 0.5);
      s += wall(a, py, Math.min(b, x1), py, true);
    }
  }

  // columns
  const cols = r.int(3, 5);
  const rows = r.int(2, 4);
  for (let i = 1; i < cols; i++) {
    for (let j = 1; j < rows; j++) {
      const px = x0 + ((x1 - x0) / cols) * i;
      const py = y0 + ((y1 - y0) / rows) * j;
      if (
        court2 &&
        px > court2.cx &&
        px < court2.cx + court2.cw &&
        py > court2.cy &&
        py < court2.cy + court2.ch
      )
        continue;
      s += `<rect x="${n(px - 5)}" y="${n(py - 5)}" width="10" height="10"
              fill="${p.mat.trim}"/>`;
    }
  }

  // door swings
  for (let i = 0; i < r.int(2, 4); i++) {
    const dx = x0 + (x1 - x0) * r.float(0.15, 0.85);
    const dy = y0 + (y1 - y0) * r.float(0.15, 0.85);
    const rad = r.float(22, 36);
    s += `<path d="M${n(dx)} ${n(dy)}v${n(-rad)}A${n(rad)} ${n(rad)} 0 0 1 ${n(dx + rad)} ${n(dy)}"
            stroke="${p.mat.trim}" stroke-width="1.6" fill="none" opacity="0.5"/>`;
  }

  // north point
  const nx = x1 - 6;
  const ny = y0 - 34;
  s += `<g opacity="0.7">
      <circle cx="${n(nx)}" cy="${n(ny)}" r="12" fill="none" stroke="${p.ink}" stroke-width="1.6"/>
      <path d="M${n(nx)} ${n(ny - 12)}L${n(nx)} ${n(ny + 12)}" stroke="${p.ink}" stroke-width="1.6"/>
      <path d="M${n(nx)} ${n(ny - 12)}l-4 7h8z" fill="${p.ink}"/>
    </g>`;

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   6. SCREEN — a perforated brick jali, sky behind it.
   --------------------------------------------------------------------------- */

export function screen(seed: string, ratio = 1.4): string {
  const r = rng(seed + ':scr');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const cols = r.int(8, 14);
  const cw = W / cols;
  const ch = cw * r.float(0.34, 0.55);
  const rows = Math.ceil(H / ch) + 1;
  const gap = cw * r.float(0.1, 0.22);

  const defs = skyDef(id, p);
  let s = `<rect width="${W}" height="${n(H)}" fill="url(#${id}-sky)"/>`;
  s += `<rect width="${W}" height="${n(H)}" fill="${p.ink}" opacity="0.25"/>`;

  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? cw / 2 : 0;
    for (let i = -1; i <= cols; i++) {
      const x = i * cw + off;
      const y = j * ch;
      const turned = r.chance(0.24);
      // each brick fired slightly differently, as they are
      const c = shade(p.mat.wall, r.float(-0.16, 0.16));
      if (turned) {
        const k = cw * 0.3;
        s += `<path d="M${n(x + gap)} ${n(y + ch / 2)}L${n(x + gap + k)} ${n(y + 1)}
                L${n(x + cw - gap)} ${n(y + ch / 2)}L${n(x + cw - gap - k)} ${n(y + ch - 1)}z"
                fill="${c}"/>`;
        s += `<path d="M${n(x + gap)} ${n(y + ch / 2)}L${n(x + gap + k)} ${n(y + 1)}
                L${n(x + cw - gap)} ${n(y + ch / 2)}z" fill="${p.mat.lite}" opacity="0.5"/>`;
      } else {
        s += `<rect x="${n(x + gap)}" y="${n(y + 1)}" width="${n(cw - gap * 2)}"
                height="${n(ch - 2)}" fill="${c}"/>`;
        s += `<rect x="${n(x + gap)}" y="${n(y + 1)}" width="${n(cw - gap * 2)}"
                height="2" fill="${p.mat.lite}" opacity="0.55"/>`;
      }
    }
  }
  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   7. CONTOUR — site topography, with the building set into it.
   --------------------------------------------------------------------------- */

export function contour(seed: string, ratio = 0.75): string {
  const r = rng(seed + ':cont');
  const p = palette(seed);
  const id = uid(seed);
  const H = W * ratio;

  const bands = r.int(8, 13);
  const amp = H * r.float(0.05, 0.11);
  const freq = r.float(1.4, 3.1);
  const phase = r.float(0, 6.28);
  const step = H / (bands - 1);

  const lo = mix(p.leaf, '#d7cfae', 0.55);
  const hi = mix(p.leaf, '#7d8f63', 0.3);
  const defs =
    `
    <linearGradient id="${id}-t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/>
    </linearGradient>` + skyDef(id, p);

  let s = `<rect width="${W}" height="${n(H)}" fill="url(#${id}-t)"/>`;

  const line = (i: number): [number, number][] => {
    const base = i * step;
    const pts: [number, number][] = [];
    for (let x = 0; x <= W; x += 20) {
      const t = x / W;
      pts.push([
        x,
        base +
          Math.sin(t * Math.PI * freq + phase + i * 0.42) * amp +
          Math.sin(t * Math.PI * freq * 2.3 + i) * amp * 0.34,
      ]);
    }
    return pts;
  };

  // banded terrain — each contour interval a slightly different green
  for (let i = 0; i < bands; i++) {
    const a = line(i);
    const b: [number, number][] = i + 1 < bands ? line(i + 1) : a.map(([x]) => [x, H + 40]);
    const d = `M${a.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}
               L${b
                 .slice()
                 .reverse()
                 .map(([x, y]) => `${n(x)} ${n(y)}`)
                 .join('L')}Z`;
    s += `<path d="${d}" fill="${shade(mix(hi, lo, i / bands), r.float(-0.04, 0.04))}"/>`;
    s += `<polyline points="${a.map(([x, y]) => `${n(x)} ${n(y)}`).join(' ')}"
            fill="none" stroke="${p.ink}" stroke-width="${i % 4 === 0 ? 1.6 : 0.8}"
            opacity="${i % 4 === 0 ? 0.34 : 0.16}"/>`;
  }

  // the building
  const fw = W * r.float(0.18, 0.3);
  const fh2 = H * r.float(0.14, 0.24);
  const fx = W * r.float(0.2, 0.56);
  const fy = H * r.float(0.3, 0.56);
  s += `<rect x="${n(fx + 8)}" y="${n(fy + 10)}" width="${n(fw)}" height="${n(fh2)}"
          fill="${p.ink}" opacity="0.22"/>`;
  s += `<rect x="${n(fx)}" y="${n(fy)}" width="${n(fw)}" height="${n(fh2)}"
          fill="${p.mat.lite}"/>`;
  s += `<rect x="${n(fx)}" y="${n(fy)}" width="${n(fw)}" height="${n(fh2 * 0.42)}"
          fill="${p.mat.wall}"/>`;

  // access track
  const tx = r.chance(0.5) ? 0 : W;
  s += `<path d="M${n(tx)} ${n(fy + fh2 * 1.9)}Q${n((tx + fx) / 2)} ${n(fy + fh2 * 1.3)}
          ${n(fx + fw / 2)} ${n(fy + fh2)}" stroke="${mix(p.mat.mortar, '#ffffff', 0.3)}"
          stroke-width="7" fill="none" opacity="0.75" stroke-linecap="round"/>`;

  // scattered planting
  for (let i = 0; i < r.int(5, 10); i++) {
    const px = W * r.float(0.04, 0.96);
    const py = H * r.float(0.06, 0.96);
    if (px > fx - 20 && px < fx + fw + 20 && py > fy - 20 && py < fy + fh2 + 20) continue;
    const rad = W * r.float(0.016, 0.032);
    s += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(rad)}" fill="${shade(p.leaf, -0.1)}"/>`;
    s += `<circle cx="${n(px - rad * 0.2)}" cy="${n(py - rad * 0.2)}" r="${n(rad * 0.7)}"
            fill="${shade(p.leaf, 0.16)}"/>`;
  }

  return svg(H, defs, s);
}

/* ---------------------------------------------------------------------------
   8. PORTRAIT — a team plate.
   Deliberately not a face: an abstract figure in flat colour, so the grid
   reads as a set of people without inventing any.
   --------------------------------------------------------------------------- */

export function portrait(seed: string, ratio = 1): string {
  const r = rng(seed + ':port');
  const p = palette(seed);
  const H = W * ratio;

  const bg = r.pick([
    mix(p.mat.wall, '#e6dccb', 0.55),
    mix(p.leaf, '#dfe3d2', 0.6),
    mix(p.sky.low, '#ffffff', 0.3),
    mix(p.mat.lite, '#ffffff', 0.35),
    mix(p.warm, '#ffffff', 0.45),
  ]);
  const figure = shade(p.mat.dark, r.float(-0.1, 0.12));

  let s = `<rect width="${W}" height="${n(H)}" fill="${bg}"/>`;

  // a wall behind, so each plate reads as taken somewhere
  s += `<rect x="0" y="${n(H * r.float(0.55, 0.72))}" width="${W}" height="${n(H)}"
          fill="${shade(bg, -0.1)}"/>`;
  if (r.chance(0.5)) {
    s += `<rect x="${n(W * r.float(0.05, 0.6))}" y="0" width="${n(W * r.float(0.12, 0.3))}"
            height="${n(H)}" fill="${shade(bg, 0.08)}"/>`;
  }

  // head and shoulders
  const cx = W * r.float(0.42, 0.58);
  const headR = W * r.float(0.14, 0.18);
  const headY = H * r.float(0.38, 0.46);
  s += `<path d="M${n(cx - W * 0.34)} ${n(H)}
          Q${n(cx - W * 0.3)} ${n(headY + headR * 1.5)} ${n(cx)} ${n(headY + headR * 1.5)}
          Q${n(cx + W * 0.3)} ${n(headY + headR * 1.5)} ${n(cx + W * 0.34)} ${n(H)}Z"
          fill="${figure}"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(headY)}" r="${n(headR)}" fill="${figure}"/>`;

  // a highlight, so the silhouette has some form
  s += `<circle cx="${n(cx - headR * 0.3)}" cy="${n(headY - headR * 0.25)}"
          r="${n(headR * 0.72)}" fill="${shade(figure, 0.1)}" opacity="0.55"/>`;

  return svg(H, '', s);
}

/* ---------------------------------------------------------------------------
   dispatcher
   --------------------------------------------------------------------------- */

/**
 * Every kind the dispatcher knows. `portrait` is deliberately NOT in
 * `KIND_NAMES` below — it is asked for by name for a team plate and must never
 * turn up as a project's artwork.
 */
export type DrawKind =
  'elevation' | 'massing' | 'court' | 'section' | 'plan' | 'screen' | 'contour' | 'portrait';

/**
 * `Generator | undefined` is honest rather than defensive: `draw()` accepts a
 * kind read off a data attribute or a database column, so the lookup genuinely
 * can miss and the `?? elevation` fallback below is the behaviour being ported.
 */
const KINDS: Readonly<Record<string, Generator | undefined>> = {
  elevation,
  massing,
  court,
  section,
  plan,
  screen,
  contour,
  portrait,
};

/** The kinds a project drawing may be. Order is the legacy order. */
export const KIND_NAMES = [
  'elevation',
  'massing',
  'court',
  'section',
  'plan',
  'screen',
  'contour',
] as const;

/** A project drawing kind — `KIND_NAMES` minus `portrait`. */
export type ProjectKind = (typeof KIND_NAMES)[number];

/**
 * Pick a drawing kind deterministically, biased by project type.
 * Elevation and massing carry a card best at thumbnail size, so they lead;
 * plan and screen are distinctive but flatten when repeated, so they are held
 * back to keep a scrolling grid varied.
 */
export function kindFor(seed: string, types: readonly string[] = []): ProjectKind {
  const r = rng(seed + ':kind');
  const t = types.join(' ').toLowerCase();
  if (/urban|complex|industrial/.test(t))
    return r.weighted(
      ['massing', 'elevation', 'contour', 'court', 'plan'] as const,
      [5, 4, 3, 2, 1],
    );
  if (/interior|renovation/.test(t))
    return r.weighted(
      ['section', 'elevation', 'court', 'plan', 'screen'] as const,
      [4, 4, 2, 2, 2],
    );
  if (/hospitality|office|commercial/.test(t))
    return r.weighted(
      ['elevation', 'massing', 'section', 'screen', 'court'] as const,
      [6, 3, 3, 2, 2],
    );
  if (/villa/.test(t))
    return r.weighted(
      ['elevation', 'court', 'contour', 'massing', 'section'] as const,
      [4, 4, 3, 3, 2],
    );
  return r.weighted(
    ['elevation', 'massing', 'section', 'court', 'screen', 'plan', 'contour'] as const,
    [7, 4, 3, 3, 2, 2, 1],
  );
}

/** Render one drawing. An unknown kind falls back to `elevation`, as it always did. */
export function draw(kind: string, seed: string, ratio?: number): string {
  return (KINDS[kind] ?? elevation)(seed, ratio);
}

/**
 * The three-drawing set shown on a project detail page.
 *
 * Returns KIND NAMES, not markup — the caller pairs each with `draw()` and its
 * own aspect ratio, because a detail page's three plates are not all the same
 * shape.
 */
export function drawingSet(seed: string, types: readonly string[] = []): ProjectKind[] {
  const primary = kindFor(seed, types);
  const rest = KIND_NAMES.filter(k => k !== primary);
  const r = rng(seed + ':set');
  return [primary, ...r.shuffle(rest).slice(0, 2)];
}
