// src/common/components/collection/CardPlate.tsx
/**
 * The picture on a card: an uploaded photograph if the record has one, the drawing it
 * always had if it does not.
 *
 * PROMOTED HERE ON ARRIVAL, not after the second consumer, because all three grids —
 * projects, design and media — needed it in the same commit and the fallback rule is a
 * property of the whole site rather than of one section. Same line `CardReveal` and
 * `DetailPlates` sit on: the BEHAVIOUR is shared, so the component is.
 *
 * ═══ THE FALLBACK IS THE FEATURE ══════════════════════════════════════════════════
 * 76 projects, 9 design works and 14 media entries have no photograph today and most of
 * them never will. `image === null` is therefore the NORMAL case, not a gap: it renders the
 * drawing seeded from the record's slug, which is what those pages have shown since the
 * site was static. What must never happen is an empty box — a grid where a third of the
 * cards are grey rectangles reads as broken, and the generated art exists precisely so that
 * a page with no photography still looks finished.
 *
 * ═══ WHY `fill` AND NOT `width` / `height` ════════════════════════════════════════
 * `.card__frame` is a fixed 4:3 box with `overflow: hidden`, and the SVG inside it is drawn
 * with `preserveAspectRatio="xMidYMid slice"` — it COVERS the frame and is cropped. `fill`
 * plus `object-fit: cover` is the same behaviour for a bitmap, so a photograph and a drawing
 * are framed identically and swapping one for the other moves nothing on the page.
 *
 * Giving the image its intrinsic width and height instead would either letterbox it inside
 * that frame or distort it, and would make the layout depend on a number stored in a column
 * — which is the reason the upload endpoint reports the intrinsic size and nothing persists
 * it. See `common/schemas/image.ts`.
 *
 * ═══ AND WHY THAT KEEPS `content-visibility: auto` WORKING ════════════════════════
 * `ProjectCard`'s header explains what `panel.css` buys: an offscreen card skips layout and
 * paint entirely, which is what makes 76 cards cost roughly what the dozen on screen cost.
 * A `fill` image is absolutely positioned, so it contributes nothing to layout and cannot
 * force one — the frame's size comes from its own `aspect-ratio` either way, and
 * `contain-intrinsic-size` still describes the card correctly.
 *
 * ═══ AND THE REVEAL STILL PLAYS ═══════════════════════════════════════════════════
 * `clip-path: inset(0 0 100% 0)` is on `.card__frame`, the PARENT. Whatever is inside it —
 * an `<svg>` or an `<img>` — is clipped by the same rule and wiped open by the same
 * `.is-in` class `CardReveal` adds. That is why the frame element is unchanged here and
 * only its child differs: putting the image outside the frame, or giving it its own
 * clipping, would be the way to break a reveal that currently cannot break.
 */
import Image from 'next/image';
import { draw } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import { mediaUrl } from '@/common/constants/uploads';
import type { LocaleImage } from '@/common/schemas/image';

/**
 * DERIVED FROM THE GRID, NOT GUESSED.
 *
 * `panel.css`'s `.grid` is `repeat(auto-fill, minmax(15rem, 1fr))`, dropping to
 * `minmax(9rem, 1fr)` below 860px. With `auto-fill`, a column can never reach TWICE its
 * minimum — at that width the grid fits another column instead — so the widest a card is
 * ever rendered is just under 30rem normally and just under 18rem on a narrow screen. Those
 * two numbers are the whole of this string.
 *
 * Getting it wrong is not cosmetic: too small serves a blurry image on a wide screen, and
 * too large hands every card in a 76-card grid a full-width variant to download.
 */
const CARD_IMAGE_SIZES = '(max-width: 860px) 18rem, 30rem';

export interface CardPlateProps {
  /** The record's photograph for this locale, or `null` — see `common/schemas/image.ts`. */
  image: LocaleImage | null;
  /** The generator to fall back to. */
  kind: string;
  /**
   * What that generator is seeded from. NOT always the record's own slug — a media entry
   * seeds from the PROJECT it is about, so a press cutting shows the building
   * (`legacy/js/ui/panel.js:263`). That is why it is a parameter.
   */
  seed: string;
}

export function CardPlate({ image, kind, seed }: CardPlateProps) {
  if (!image) {
    return (
      <span
        className="card__frame"
        // Pure, seeded, and nothing user-supplied reaches it: `draw` emits its own SVG
        // string from numbers, so there is no injection surface here.
        dangerouslySetInnerHTML={{ __html: draw(kind, seed, PLATE_RATIO) }}
      />
    );
  }

  return (
    <span className="card__frame">
      <Image
        src={mediaUrl(image.path)}
        /**
         * The record's own sentence, in the rendered locale. It is never empty — a path
         * with no alt text for this locale is treated as "no image" upstream and this
         * component receives `null` instead, so there is no path through here that emits an
         * undescribed photograph.
         */
        alt={image.alt}
        fill
        sizes={CARD_IMAGE_SIZES}
        // The rule that gives it `object-fit: cover` and the frame's hover scale lives in
        // `common/styles/route.css`, beside the equivalent rule for the SVG.
        className="card__photo"
      />
    </span>
  );
}
