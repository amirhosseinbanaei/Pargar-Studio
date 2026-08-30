// src/common/components/collection/CardPlate.tsx
/**
 * The picture on a card: the record's uploaded photograph, or an empty frame.
 *
 * PROMOTED HERE ON ARRIVAL, not after the second consumer, because all three grids —
 * projects, design and media — needed it in the same commit and the rule is a property of
 * the whole site rather than of one section. Same line `CardReveal` and `DetailPlates` sit
 * on: the BEHAVIOUR is shared, so the component is.
 *
 * ═══ ~~THE FALLBACK IS THE FEATURE~~ REVERSED IN PROMPT 14 ════════════════════════
 * This header used to argue the opposite, at length, and the argument is kept because it
 * is the thing to weigh if anyone reverses this back:
 *
 *   "76 projects, 9 design works and 14 media entries have no photograph today and most of
 *   them never will. `image === null` is therefore the NORMAL case, not a gap: it renders
 *   the drawing seeded from the record's slug, which is what those pages have shown since
 *   the site was static. What must never happen is an empty box — a grid where a third of
 *   the cards are grey rectangles reads as broken, and the generated art exists precisely
 *   so that a page with no photography still looks finished."
 *
 * A RECORD WITH NO PHOTOGRAPH NOW SHOWS NO PHOTOGRAPH. The decision was overturned
 * deliberately, and the cost is exactly what the paragraph above predicts and is stated in
 * AGENTS.md rather than discovered: until photographs are uploaded, the projects, design
 * and media grids are largely empty of imagery. That is the studio's call to make about
 * its own archive, and it is one branch — this one — to reverse.
 *
 * ═══ THE FRAME STAYS, AND THAT IS THE WHOLE OF THE EMPTY CASE ═════════════════════
 * `.card__frame` keeps its aspect ratio, its hairline border and its `--s-1` ground, so an
 * empty card reads as an absent picture rather than a broken one and the grid's rhythm is
 * unchanged — nothing reflows when a photograph arrives or leaves. Collapsing the frame
 * instead would reflow all 76 cards the first time one was uploaded.
 *
 * It also keeps its `clip-path`, so `CardReveal`'s wipe still plays over it: the reveal is
 * a property of the frame, not of what is inside, which is why the frame element is
 * untouched here and only its child differs.
 *
 * ═══ WHY `fill` AND NOT `width` / `height` ════════════════════════════════════════
 * `.card__frame` is a fixed 4:3 box with `overflow: hidden`. `fill` plus `object-fit:
 * cover` makes a photograph cover and crop to it, which is what the box was always drawn
 * for. Intrinsic width and height would either letterbox it or distort it, and would make
 * the layout depend on a number stored in a column — the reason the upload endpoint
 * reports the intrinsic size and nothing persists it. See `common/schemas/image.ts`.
 *
 * ═══ AND WHY THAT KEEPS `content-visibility: auto` WORKING ════════════════════════
 * `ProjectCard`'s header explains what `panel.css` buys: an offscreen card skips layout and
 * paint entirely, which is what makes 76 cards cost roughly what the dozen on screen cost.
 * A `fill` image is absolutely positioned, so it contributes nothing to layout and cannot
 * force one — the frame's size comes from its own `aspect-ratio` either way.
 */
import Image from 'next/image';
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
}

export function CardPlate({ image }: CardPlateProps) {
  if (!image) {
    // Empty, and deliberately not `null`: the frame is what holds the card's proportions,
    // so removing it would reflow the grid rather than leave a gap in it.
    return <span className="card__frame" />;
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
        // `common/styles/route.css`.
        className="card__photo"
      />
    </span>
  );
}
