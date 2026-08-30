// src/common/components/collection/GalleryBand.tsx
/**
 * Every photograph past the ones the head already showed, in stored order, each with its
 * own description.
 *
 * ═══ WHAT IT EXISTS TO FIX ════════════════════════════════════════════════════════
 * `DetailPlates` is a three-box head and a gallery longer than two was simply TRUNCATED —
 * an editor could upload eight photographs, see the save succeed, and find five of them on
 * no page at all. That file's header recorded the limit honestly and named the fix: "a
 * longer gallery needs a second band below the specs with its own geometry, which is a
 * design decision this prompt had no mandate to make." This is that band.
 *
 * ═══ PROMOTED ON ARRIVAL, LIKE `CardPlate` ════════════════════════════════════════
 * Projects, design works and media all render it in the same commit, and studio and contact
 * render it too since prompt 14 gave those two pages galleries. Five consumers in three
 * modules plus two more — it could not live in any one of them, and `collection/` is where
 * this project puts a piece whose BEHAVIOUR is shared. It is deliberately not a `ds/`
 * component: it knows what a record's gallery is, which a design-system primitive must not.
 *
 * ═══ NO LIGHTBOX, NO CAROUSEL, NO CLIENT JAVASCRIPT ═══════════════════════════════
 * A Server Component rendering a band of images. Embla is installed for nothing here and
 * would not be warranted if it were: a carousel hides photographs behind an interaction on
 * a page whose whole purpose is showing them, and a lightbox is a focus trap, a keyboard
 * protocol and a history entry to get right for the sake of a bigger version of an image
 * the browser can already open. Every photograph is on the page, at a size the layout
 * chose, and that is the finished behaviour rather than a first step.
 *
 * ═══ `sizes`, DERIVED FROM THE BAND'S REAL COLUMN COUNT ═══════════════════════════
 * `.gband` in `route.css` is `repeat(auto-fill, minmax(18rem, 1fr))`, collapsing to a
 * single column below 700px. The band sits in `.route__main`, which on a `route--solo`
 * detail page is the full stage width — about 92vw.
 *
 * The arithmetic, the same way `CardPlate` does it: with `auto-fill` and a 18rem minimum a
 * column can never reach TWICE its minimum, because at that width the grid fits another
 * column instead. So above 700px a cell is at most just under 36rem, and 36rem is the
 * number. Below 700px there is one column and a cell is the content width, 92vw.
 *
 * Getting it wrong is not cosmetic in either direction: too small serves a soft image on a
 * wide screen, too large hands a phone a desktop-sized download for every photograph in the
 * band.
 */
import Image from 'next/image';
import { mediaUrl } from '@/common/constants/uploads';
import type { LocaleImage } from '@/common/schemas/image';

const BAND_IMAGE_SIZES = '(max-width: 700px) 92vw, 36rem';

export interface GalleryBandProps {
  /** The photographs this band shows, in stored order. Renders nothing when empty. */
  images: readonly LocaleImage[];
  /**
   * The section heading, already translated by the caller.
   *
   * A `<section>` full of images needs a name for anyone navigating by landmark or by
   * heading, and it cannot be built here: `collection/` components take a `Dictionary` or a
   * translated string, never a locale to translate from.
   */
  heading: string;
}

export function GalleryBand({ images, heading }: GalleryBandProps) {
  if (images.length === 0) return null;

  return (
    /*
      `aria-labelledby` rather than `aria-label`: the heading is on the page anyway, so
      pointing at it keeps one string doing both jobs and cannot drift from what is shown.
    */
    <section className="gband__wrap" aria-labelledby="gallery-band-heading">
      <h2 className="sheet__h" id="gallery-band-heading">
        {heading}
      </h2>
      <div className="gband">
        {images.map(image => (
          // Keyed on the PATH — 16 random bytes per upload, unique within a record and
          // stable across a reorder, which an index is not.
          <figure className="gband__f" key={image.path}>
            <Image
              src={mediaUrl(image.path)}
              alt={image.alt}
              fill
              sizes={BAND_IMAGE_SIZES}
              className="gband__photo"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
