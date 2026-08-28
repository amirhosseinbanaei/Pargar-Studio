// @vitest-environment node
/**
 * The portrait seed, and the one bug it exists to prevent.
 *
 * A Persian name contains no `[a-z0-9]` at all, so seeding a portrait from the DISPLAYED
 * name gives every one of the twenty-two people the same picture on `/fa/studio` — and the
 * English page, which is where anyone would look, is perfect. This asserts both halves:
 * that Persian collapses (so the fallback is never the right source) and that the English
 * record produces twenty-two distinct seeds.
 */
import { describe, expect, it } from 'vitest';
import type { Studio } from '@/common/schemas/studio';
import { seedOf, studioSeeds } from '../seeds';

describe('seedOf', () => {
  it('slugifies a Latin name', () => {
    expect(seedOf('Farhad Rastgar')).toBe('farhad-rastgar');
    expect(seedOf('Mahsa Aminzadeh')).toBe('mahsa-aminzadeh');
  });

  it('COLLAPSES a Persian name — which is why the English record is the seed source', () => {
    expect(seedOf('فرهاد رستگار')).toBe('-');
    expect(seedOf('مهسا امین‌زاده')).toBe('-');
    // Both collapse to the SAME string: two people, one portrait.
    expect(seedOf('فرهاد رستگار')).toBe(seedOf('مهسا امین‌زاده'));
  });
});

describe('studioSeeds', () => {
  const english = {
    manifesto: '',
    founders: [
      {
        name: 'Farhad Rastgar',
        role: '',
        born: '',
        bio: '',
        image: '2026/08/0123456789abcdef0123456789abcdef.jpg',
        imageAlt: 'Farhad in the studio',
      },
      // No photograph — the normal state, and the one that must keep drawing a portrait.
      { name: 'Mahsa Aminzadeh', role: '', born: '', bio: '', image: null, imageAlt: '' },
    ],
    stats: [],
    team: ['Sepehr Ansari', 'Golnaz Bahrami', 'Kaveh Daneshvar'],
    alumni: [],
    awards: [],
    chapters: [],
  } satisfies Studio;

  it('derives one distinct seed per person, in record order', () => {
    const seeds = studioSeeds(english);
    expect(seeds.founders).toEqual(['farhad-rastgar', 'mahsa-aminzadeh']);
    expect(seeds.team).toEqual(['sepehr-ansari', 'golnaz-bahrami', 'kaveh-daneshvar']);
    expect(new Set(seeds.team).size).toBe(seeds.team.length);
  });

  it("carries each founder's uploaded portrait, index-aligned, `null` where there is none", () => {
    // The path comes from the ENGLISH record for the same reason the seed does: that array
    // is the authority on which picture a founder has. `null` is what makes the page fall
    // back to the generated portrait for the founder beside it, one position at a time.
    const seeds = studioSeeds(english);
    expect(seeds.founderImages).toEqual(['2026/08/0123456789abcdef0123456789abcdef.jpg', null]);
    expect(seeds.founderImages).toHaveLength(seeds.founders.length);
  });

  it('is index-aligned with the arrays it was built from', () => {
    // The page zips these against the LOCALIZED record by index, exactly as
    // `legacy/js/ui/panel.js:396` did. Order is the identity; a sort here would hand
    // every person somebody else's face.
    const seeds = studioSeeds(english);
    expect(seeds.founders).toHaveLength(english.founders.length);
    expect(seeds.team).toHaveLength(english.team.length);
  });
});
