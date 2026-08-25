// src/common/components/collection/DetailPlates.tsx
/**
 * The three drawings at the head of a detail page.
 *
 * PROMOTED IN PROMPT 5 out of `modules/projects/components/ProjectDetail.tsx`; ported
 * from `legacy/js/ui/panel.js:94`, which every one of the three detail views called.
 *
 * THE SEED CONTRACT, and why it must live in exactly one file. `drawingSet(seed, types)`
 * picks three kinds deterministically, and its FIRST kind drawn at the BARE seed is
 * `kindFor(seed, types)` — the same call the card makes. That identity is what makes the
 * card in the grid and the first plate on the page the same picture; it is not preserved
 * by care, it falls out of the generators being pure and the seed being the slug. Plates
 * two and three are seed-offset (`seed:1`, `seed:2`) so one generator does not draw the
 * same geometry twice on one page. Three copies of this arithmetic is three chances to
 * "tidy" the first plate into `seed:0` and silently break the promise on one section
 * only — `modules/projects/components/__tests__/drawing-identity.test.ts` pins it.
 *
 * The seed is NOT always the record's own slug: a media entry seeds from the PROJECT it
 * is about, so the plate shows the building rather than the magazine
 * (`legacy/js/ui/panel.js:263`). That is why the seed is a parameter.
 */
import { draw, drawingSet } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import type { Dictionary } from '@/common/i18n';

export interface DetailPlatesProps {
  /** What the drawings are seeded from — a slug, or the related project's slug. */
  seed: string;
  /** Steers which generators are chosen; a design work passes its single category. */
  types: readonly string[];
  dictionary: Dictionary;
}

export function DetailPlates({ seed, types, dictionary }: DetailPlatesProps) {
  const plates = drawingSet(seed, types);

  return (
    <div className="detail__plates">
      {plates.map((kind, i) => (
        <figure className="detail__plate" key={kind}>
          {/* Pure, seeded, and nothing user-supplied reaches it: `draw` emits its own
              SVG string from numbers, so there is no injection surface here. */}
          <div
            dangerouslySetInnerHTML={{
              __html: draw(kind, i ? `${seed}:${i}` : seed, PLATE_RATIO),
            }}
          />
          <figcaption>{dictionary.term('kindName', kind)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
