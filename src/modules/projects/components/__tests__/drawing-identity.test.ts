// @vitest-environment node
/**
 * The card and the detail page must show the SAME drawing for a project.
 *
 * This is the one visible promise the pure art layer makes, and it is easy to break by
 * accident: give the card its own kind, or seed a plate with `slug + ':0'` for symmetry
 * with the other two, and the grid stops agreeing with the page it links to. Nothing else
 * in the gate would notice.
 *
 * `ProjectCard` draws `kindFor(slug, types)` at the slug; `ProjectDetail` draws
 * `drawingSet(slug, types)[0]` at the slug for its first plate, and offsets only plates 2
 * and 3. This asserts both halves against the real archive's slugs.
 */
import { describe, expect, it } from 'vitest';
import { draw, drawingSet, kindFor } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';

const SAMPLES = [
  { slug: 'qeytarieh-08-residence', types: ['Residential'] },
  { slug: 'darrous-court-residence', types: ['Residential', 'Interior Design'] },
  { slug: 'sohanak-ridge-villa', types: ['Villa'] },
];

describe('card and detail agree', () => {
  it.each(SAMPLES)('$slug draws the same picture in both places', ({ slug, types }) => {
    const card = draw(kindFor(slug, types), slug, PLATE_RATIO);
    const firstPlate = draw(drawingSet(slug, types)[0], slug, PLATE_RATIO);

    expect(firstPlate).toBe(card);
    expect(card).toContain('<svg');
  });

  it.each(SAMPLES)('$slug gets three DIFFERENT plates, not one repeated', ({ slug, types }) => {
    const kinds = drawingSet(slug, types);
    expect(kinds).toHaveLength(3);
    expect(new Set(kinds).size).toBe(3);

    // Plates 2 and 3 are seed-offset — `slug:1`, `slug:2` — so the same generator does not
    // produce the same geometry twice on one page.
    const svgs = kinds.map((kind, i) => draw(kind, i ? `${slug}:${i}` : slug, PLATE_RATIO));
    expect(new Set(svgs).size).toBe(3);
  });

  it('is deterministic across runs, which is what makes the pages cacheable', () => {
    const once = draw(
      kindFor('qeytarieh-08-residence', ['Residential']),
      'qeytarieh-08-residence',
      PLATE_RATIO,
    );
    const twice = draw(
      kindFor('qeytarieh-08-residence', ['Residential']),
      'qeytarieh-08-residence',
      PLATE_RATIO,
    );
    expect(twice).toBe(once);
  });
});
