// src/common/components/collection/DetailPlates.tsx
/**
 * The plates at the head of a detail page — up to three of the record's photographs, and
 * nothing at all when it has none.
 *
 * PROMOTED IN PROMPT 5 out of `modules/projects/components/ProjectDetail.tsx`; ported from
 * `legacy/js/ui/panel.js:94`, which every one of the three detail views called.
 *
 * ═══ ~~THE SEED CONTRACT~~ THERE ARE NO DRAWINGS HERE ANY MORE (prompt 14) ════════
 * This file used to own the arithmetic that made the first plate and the card show the same
 * generated picture — `drawingSet(seed, types)[0]` at the bare seed being `kindFor(seed,
 * types)` — with plates two and three seed-offset so one generator did not draw the same
 * geometry twice on one page. That is gone with the drawings themselves: prompt 14 reversed
 * the "a record with no image keeps its generated drawing" decision, so a slot with no
 * photograph renders nothing rather than art. `CardPlate`'s header carries the argument
 * that was overturned and the cost of overturning it.
 *
 * Consequences worth naming, because each was a real property of the old file:
 *
 *  - `seed`, `types` and `dictionary` are no longer props. Nothing here is seeded and
 *    nothing here is captioned — the figcaption named the GENERATOR ("Elevation"), which is
 *    meaningless over a photograph and false under one.
 *  - `modules/projects/components/__tests__/drawing-identity.test.ts` pinned that identity
 *    and is REPLACED, not deleted, by `__tests__/plates.test.tsx` beside this file, which
 *    pins the rule that took its place. See AGENTS.md.
 *
 * ═══ AS MANY PLATES AS THERE ARE PHOTOGRAPHS, UP TO THREE (decision 5.3) ══════════
 * `.detail__plates` is a `2fr 1fr` grid whose first child spans both rows, which is exactly
 * three boxes. With fewer photographs the head renders fewer boxes and `data-count` picks
 * the geometry for one and for two (`route.css`); with none it renders nothing and the page
 * simply starts at its title.
 *
 * The alternative — keeping three boxes and leaving the empty ones empty — is the "grey
 * rectangles" failure `CardPlate`'s header warns about, arriving through a different door:
 * three empty boxes at the top of every one of 76 project pages. An empty CARD frame is
 * different and is kept, because there the frame holds a grid's rhythm; here there is no
 * rhythm to hold, only a hole.
 *
 * ═══ THE FOURTH PHOTOGRAPH ONWARD ═════════════════════════════════════════════════
 * `GalleryBand` renders them, below the specs. Until prompt 14 they were TRUNCATED here and
 * this header recorded that as a known limit needing "a second band below the specs with
 * its own geometry, which is a design decision this prompt had no mandate to make". That is
 * the band; `HEAD_PLATE_COUNT` is the number the two share so the page cannot show one
 * photograph twice or drop one between them.
 */
import Image from 'next/image';
import { mediaUrl } from '@/common/constants/uploads';
import type { LocaleImage } from '@/common/schemas/image';

/**
 * How many photographs the head takes before `GalleryBand` gets the rest.
 *
 * Exported because the two components must agree: a detail page slices its own image list
 * with this and hands the tail to the band. Two copies of the number is one page rendering
 * its third photograph twice.
 */
export const HEAD_PLATE_COUNT = 3;

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
  /**
   * The record's photographs for this locale, cover first, then the gallery in its stored
   * order. Empty for a record with none, which is the normal case today — and then this
   * component renders nothing at all.
   */
  images?: readonly LocaleImage[];
}

export function DetailPlates({ images = [] }: DetailPlatesProps) {
  const plates = images.slice(0, HEAD_PLATE_COUNT);
  if (plates.length === 0) return null;

  return (
    /*
      `data-count` rather than `:has()`: the count is a fact the component already knows, and
      naming it in the markup makes the two special cases greppable from the stylesheet
      instead of inferred from a selector. The rules are in `route.css`.
    */
    <div className="detail__plates" data-count={plates.length}>
      {plates.map((image, i) => (
        /*
          Keyed on the PATH. A stored path carries 16 random bytes and is generated per
          upload, so it is unique within a record and stable across a reorder — which an
          index is not: reordering a gallery would otherwise re-key every plate after the
          one that moved and remount images that did not change.
        */
        <figure className="detail__plate" key={image.path}>
          <Image
            src={mediaUrl(image.path)}
            alt={image.alt}
            fill
            sizes={i === 0 ? COVER_SIZES : SIDE_SIZES}
            className="detail__photo"
          />
        </figure>
      ))}
    </div>
  );
}
