// src/common/components/collection/DetailPlates.tsx
/**
 * The three plates at the head of a detail page.
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
 *
 * ═══ PHOTOGRAPHS FILL THE SLOTS FROM THE FRONT (prompt 10) ════════════════════════
 * `images` is the record's cover followed by its gallery, already collapsed to this locale.
 * Slot `i` renders `images[i]` if there is one and THE DRAWING IT WOULD OTHERWISE HAVE
 * SHOWN if there is not — per slot, not all-or-nothing.
 *
 * Two consequences, both deliberate:
 *
 *  - A record with a cover and no gallery shows its photograph beside two drawings, which
 *    is the state most records will be in for a long time and has to look composed rather
 *    than half-finished. The plates are the same three boxes either way.
 *  - THE SEED ARITHMETIC IS UNTOUCHED. `drawingSet` is still called with the bare seed and
 *    the kinds are still taken in order, so slot 0's drawing is still `kindFor(seed, types)`
 *    — the card's picture — for every record that has no cover. Computing the drawings only
 *    for the slots that need them would have made the kind of slot 2 depend on how many
 *    photographs the record happens to have, which is exactly the kind of accidental
 *    coupling the test above exists to catch.
 *
 * A GALLERY LONGER THAN TWO IS TRUNCATED HERE and that is a known limit rather than an
 * oversight: this component is the three-plate head the legacy layout defines, and
 * `.detail__plates` is a two-column grid with the first plate spanning both rows. A longer
 * gallery needs a second band below the specs with its own geometry, which is a design
 * decision this prompt had no mandate to make.
 */
import Image from 'next/image';
import { draw, drawingSet } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import { mediaUrl } from '@/common/constants/uploads';
import type { Dictionary } from '@/common/i18n';
import type { LocaleImage } from '@/common/schemas/image';

/**
 * DERIVED FROM `.detail__plates`, NOT GUESSED.
 *
 * That grid is `2fr 1fr` inside `.route__main`, which on a `route--solo` detail page is the
 * full stage width — `100vw` less `.stage`'s `clamp(1.25rem, 4.5vw, 5rem)` of padding on
 * each side. So the first plate is about two thirds of ~92vw and the other two about a
 * third. Below 900px `panel.css` collapses the grid to one column and every plate is the
 * full content width.
 */
const COVER_SIZES = '(max-width: 900px) 92vw, 60vw';
const SIDE_SIZES = '(max-width: 900px) 92vw, 30vw';

export interface DetailPlatesProps {
  /** What the drawings are seeded from — a slug, or the related project's slug. */
  seed: string;
  /** Steers which generators are chosen; a design work passes its single category. */
  types: readonly string[];
  dictionary: Dictionary;
  /**
   * The record's photographs for this locale, cover first, then the gallery in its stored
   * order. Empty for a record with none, which is the normal case.
   */
  images?: readonly LocaleImage[];
}

export function DetailPlates({ seed, types, dictionary, images = [] }: DetailPlatesProps) {
  const plates = drawingSet(seed, types);

  return (
    <div className="detail__plates">
      {plates.map((kind, i) => {
        const image = images[i];

        // The key stays the KIND rather than becoming the index, so a record that gains a
        // photograph does not renumber the React keys of the plates beside it.
        return (
          <figure className="detail__plate" key={kind}>
            {image ? (
              <Image
                src={mediaUrl(image.path)}
                alt={image.alt}
                fill
                sizes={i === 0 ? COVER_SIZES : SIDE_SIZES}
                className="detail__photo"
              />
            ) : (
              /* Pure, seeded, and nothing user-supplied reaches it: `draw` emits its own
                 SVG string from numbers, so there is no injection surface here. */
              <div
                dangerouslySetInnerHTML={{
                  __html: draw(kind, i ? `${seed}:${i}` : seed, PLATE_RATIO),
                }}
              />
            )}
            {/*
              The caption names the GENERATOR, so it belongs to a drawing and only to a
              drawing. A photograph gets none: repeating its alt text as visible copy makes
              a screen reader announce the same sentence twice, and "Elevation" under a
              photograph of a building would simply be false.
            */}
            {!image && <figcaption>{dictionary.term('kindName', kind)}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}
