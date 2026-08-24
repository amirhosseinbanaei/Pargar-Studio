// @vitest-environment node
/**
 * Fidelity lock for the ported art layer.
 *
 * These hashes were taken from `legacy/js/art/draw.js` running under Node at the
 * time of the port, when the TypeScript output was verified byte-for-byte
 * identical to the original for every seed, every generator and both ratios.
 * They are pinned as HASHES rather than by importing the legacy module for two
 * reasons: `src/` may never import `legacy/`, and prompt 7 deletes `legacy/`
 * entirely — a test that reads it would die with it.
 *
 * If one of these fails, a numeric constant moved. That is not a test to
 * update: it means every drawing on the site silently became a different
 * drawing. Find the constant.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { draw, drawingSet, kindFor, KIND_NAMES } from '../draw';
import { rng, hash, n } from '../rng';
import { palette } from '../palette';

const sig = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16);

const REFERENCE: ReadonlyArray<readonly [string, string, string]> = [
  ['qeytarieh-08-residence', 'elevation', 'ee47849989dc2ba1'],
  ['qeytarieh-08-residence', 'massing', '8e3ea77c4a02327e'],
  ['qeytarieh-08-residence', 'court', 'a583afb85c4c3626'],
  ['qeytarieh-08-residence', 'section', '8b004c55b2f0e263'],
  ['qeytarieh-08-residence', 'plan', '0567a3fb758bb942'],
  ['qeytarieh-08-residence', 'screen', '2c9a6498d2f09a6e'],
  ['qeytarieh-08-residence', 'contour', '39b40d23dfb5ebe2'],
  ['qeytarieh-08-residence', 'portrait', '4e8f7e11345b6249'],
  ['niavaran-terraces', 'elevation', '77c99693310c1bd7'],
  ['niavaran-terraces', 'massing', '44449d665de12cb1'],
  ['niavaran-terraces', 'court', '2917ebba8d68a7ca'],
  ['niavaran-terraces', 'section', 'c58281167304d012'],
  ['niavaran-terraces', 'plan', '4c1e601b91f520bb'],
  ['niavaran-terraces', 'screen', 'c10dfbf2450ffa59'],
  ['niavaran-terraces', 'contour', '098a87eb77cc3d23'],
  ['niavaran-terraces', 'portrait', '807090cd40e0f576'],
  ['elahieh-office', 'elevation', '32f45a7990648501'],
  ['elahieh-office', 'massing', '4bdb7ca8860e1698'],
  ['elahieh-office', 'court', '2dfd929bb3514a64'],
  ['elahieh-office', 'section', '540ebc1abd406af0'],
  ['elahieh-office', 'plan', '4a1ced679af5f58d'],
  ['elahieh-office', 'screen', '6fe011c2042460f5'],
  ['elahieh-office', 'contour', 'a088ef7e8b75c4fb'],
  ['elahieh-office', 'portrait', 'b97b0a22771b78a1'],
];

describe('art fidelity', () => {
  it.each(REFERENCE)('%s / %s matches the legacy generator byte-for-byte', (seed, kind, want) => {
    expect(sig(draw(kind, seed))).toBe(want);
  });

  it('is deterministic: the same seed twice gives the identical string', () => {
    expect(draw('elevation', 'qeytarieh-08-residence')).toBe(
      draw('elevation', 'qeytarieh-08-residence'),
    );
  });

  it('gives different seeds different drawings', () => {
    expect(draw('elevation', 'a')).not.toBe(draw('elevation', 'b'));
  });

  it('falls back to elevation for an unknown kind, rather than throwing', () => {
    expect(draw('not-a-kind', 'seed-x')).toBe(draw('elevation', 'seed-x'));
  });

  it('honours the ratio argument in the emitted viewBox', () => {
    expect(draw('elevation', 'seed-x', 1.4)).toContain('viewBox="0 0 1000 1400"');
    expect(draw('elevation', 'seed-x', 0.75)).toContain('viewBox="0 0 1000 750"');
  });
});

describe('kind selection', () => {
  it('biases by project type and stays stable per seed', () => {
    expect(kindFor('qeytarieh-08-residence', ['Villa'])).toBe('massing');
    expect(kindFor('qeytarieh-08-residence', ['Villa'])).toBe('massing');
  });

  it('drawingSet returns the primary kind plus two distinct others', () => {
    const set = drawingSet('qeytarieh-08-residence', ['Residential']);
    expect(set).toEqual(['court', 'contour', 'screen']);
    expect(new Set(set).size).toBe(3);
  });

  it('never offers portrait as a project drawing — it is for team plates only', () => {
    expect(KIND_NAMES).not.toContain('portrait');
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(drawingSet(seed)).not.toContain('portrait');
    }
  });
});

describe('the seeded PRNG', () => {
  it('hashes with FNV-1a, unsigned', () => {
    expect(hash('kavan')).toBe(hash('kavan'));
    expect(hash('kavan')).toBeGreaterThanOrEqual(0);
    expect(hash('a')).not.toBe(hash('b'));
  });

  it('produces the same stream from a string seed and its hash', () => {
    const a = rng('seed');
    const b = rng(hash('seed'));
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('partition sums to the total and respects the minimum', () => {
    const parts = rng('p').partition(100, 5, 8);
    expect(parts).toHaveLength(5);
    expect(parts.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 6);
    for (const v of parts) expect(v).toBeGreaterThanOrEqual(8);
  });

  it('n() keeps coordinates at two decimals — the SVG output contract', () => {
    expect(n(1.23456)).toBe(1.23);
    expect(n(1.235)).toBe(1.24);
    expect(n(-4.567)).toBe(-4.57);
    // Binary floating point, faithfully: 1.005 * 100 is 100.49999…, so this
    // rounds DOWN. Legacy did exactly the same, and the drawings encode it.
    expect(n(1.005)).toBe(1);
  });
});

describe('palette', () => {
  it('is seeded from the same string as the geometry, so colour is as stable as plan', () => {
    expect(palette('qeytarieh-08-residence')).toEqual(palette('qeytarieh-08-residence'));
  });

  it('deepens the sky into glass rather than reusing it flat', () => {
    const p = palette('qeytarieh-08-residence');
    expect(p.glass).not.toBe(p.sky.top);
    expect(p.glass).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('has a night mode that overrides the sky only', () => {
    const day = palette('s');
    const night = palette('s', { night: true });
    expect(night.sky.id).toBe('night');
    expect(night.mat).toEqual(day.mat);
  });
});

describe('server safety', () => {
  it('runs with no DOM present at all — this is what lets an RSC emit it inline', () => {
    // The node environment for this file means `document` and `window` are
    // genuinely absent. If a generator ever reaches for one, this file fails
    // rather than the browser failing in production.
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(draw('elevation', 'no-dom-here')).toContain('<svg');
  });
});
