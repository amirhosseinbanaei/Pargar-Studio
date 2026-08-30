// src/common/components/layout/ColumnShell.tsx
/**
 * The five-column index — the site's front door, rendered on the server.
 *
 * Ported from `legacy/index.html:112`. Structurally it is the same markup, and it has to
 * be: `shell.css` and the shell transition both address `.col[data-id]`, `.col__art`,
 * `.col__title .ch`, `.col__idx` and `.col__rule` by name.
 *
 * THREE THINGS ARE DIFFERENT, and each of them is the point of the migration:
 *
 *  1. `.col__art` arrives FULL. The generators are pure and server-safe, so the SVG is in
 *     the HTML — no lazy draw on idle, no generator JavaScript in the browser, no layout
 *     shift when a drawing appears. `shell.ts`'s `ensureArt` sees a populated host and
 *     does nothing, which is why it no longer imports `draw`.
 *  2. The titles are `<Link>`s to REAL ROUTES, not `href="#projects"` plus a hash handler.
 *     Middle-click, open-in-new-tab, prefetch and a crawler all work, and with JavaScript
 *     disabled the whole index is navigable.
 *  3. The `.panel` div is gone. A section is a route now, not a state of this page.
 *
 * The `.ch` spans, the `data-cursor` labels and the per-column index numerals are all
 * emitted here rather than written in by a script after boot.
 *
 * ═══ THE WORDS AND THE PICTURE ARE EDITABLE NOW (prompt 13) ═══════════════════════
 * `cards` arrives as a PROP, read by the page from `listIndexCards`. This component does
 * not call the service itself: `app/` is composition and the page already owns the locale,
 * so a read here would be a second place that decides which language the front page is in.
 *
 * Every field degrades to the dictionary. A card with an empty title renders
 * `t(section.labelKey)` and an empty caption renders `t(section.captionKey)` — the strings
 * these columns have always shown — so the front page is correct before anybody has opened
 * the new editor, and stays correct if a row goes missing. Those two catalog keys are the
 * FALLBACK, not dead copy; see `common/constants/site.ts`.
 */
import Image from 'next/image';
import Link from 'next/link';
import { draw } from '@/common/lib/art';
import { COLUMN_ART_RATIO, NAV } from '@/common/constants/site';
import { mediaUrl } from '@/common/constants/uploads';
import { localeHref } from '@/common/i18n/navigation';
import type { Dictionary } from '@/common/i18n';
import type { IndexCard } from '@/common/schemas/index-card';
import { GlyphText } from './GlyphText';

/**
 * DERIVED FROM THE COLUMN, NOT GUESSED — the arithmetic `CardPlate` documents, run against
 * this layout's own rule rather than the grid's.
 *
 * A resting column is one FIFTH of the stage (`shell.css:112`: `.col { flex: 1 1 20% }`),
 * and the stage is the viewport minus the page's side padding — so 20vw is the width
 * rounded UP, which is the safe direction: too small serves a visibly soft photograph on a
 * 1440px screen, too large only wastes bytes. Below 860px the columns stack
 * (`shell.css:307`), and a stacked column is the full width of the page.
 */
const COLUMN_IMAGE_SIZES = '(max-width: 860px) 100vw, 20vw';

export interface ColumnShellProps {
  dictionary: Dictionary;
  /** The five cards, in NAV order — `listIndexCards(locale)`. */
  cards: readonly IndexCard[];
}

export function ColumnShell({ dictionary, cards }: ColumnShellProps) {
  const { t, num, locale } = dictionary;
  const bySection = new Map(cards.map(card => [card.sectionId, card]));

  return (
    <nav className="cols" id="cols" aria-label={t('ui.sections')}>
      {NAV.map((section, i) => {
        const card = bySection.get(section.id);
        const title = card?.title.trim() ? card.title : t(section.labelKey);
        const caption = card?.caption.trim() ? card.caption : t(section.captionKey);
        const image = card?.image ?? null;

        return (
          <section className="col" key={section.id} data-id={section.id} data-i={i}>
            <i className="col__rule" />

            {/*
              THE PHOTOGRAPH REPLACES THE DRAWING AND NOTHING ELSE. It goes INSIDE
              `.col__art`, which is `position: absolute; inset: 0; overflow: hidden`
              (`shell.css:137`), so the vignette at `:158` and the hover scale at `:155`
              apply over a photograph exactly as they do over an SVG — same box, same
              crop, same FLIP.

              `data-art` / `data-seed` stay on the host in BOTH branches. They are
              `ensureArt`'s fallback contract for a surface with no server render
              (`motion/shell.ts:147`), and dropping them here — including from the
              photographed branch, where this render happens not to need them — would
              leave that path unreachable the day something else mounts these columns.

              A COLUMN WITH NO PICTURE KEEPS ITS DRAWING. That is the decision recorded in
              AGENTS.md and it is deliberately the opposite of what prompt 14 does for
              RECORDS: these five are chrome, not records, their seed is a constant rather
              than a slug, and five empty frames is an empty front page.
            */}
            {image ? (
              <div className="col__art" data-art={section.art} data-seed={section.seed}>
                <Image
                  src={mediaUrl(image.path)}
                  /* Never empty — a path with no alt text for this locale is treated as
                     "no image" by `toLocaleImage` and never reaches this branch. */
                  alt={image.alt}
                  fill
                  sizes={COLUMN_IMAGE_SIZES}
                  className="col__photo"
                />
              </div>
            ) : (
              <div
                className="col__art"
                data-art={section.art}
                data-seed={section.seed}
                /* `dangerouslySetInnerHTML` is correct and safe here, and it is the ONLY
                   way to put a generated SVG into the tree without parsing it into React
                   elements: the string comes from `common/lib/art`, which is a pure
                   function of a hardcoded seed and emits no attribute that is not its
                   own. Nothing user-supplied reaches it. */
                dangerouslySetInnerHTML={{
                  __html: draw(section.art, section.seed, COLUMN_ART_RATIO),
                }}
              />
            )}

            <span className="col__idx">{num(String(i + 1).padStart(2, '0'))}</span>

            <h2 className="col__title">
              <Link
                className="col__hit"
                href={localeHref(locale, section.path)}
                data-open={section.id}
                data-cursor={t('ui.open')}
              >
                <GlyphText>{title}</GlyphText>
              </Link>
            </h2>

            <p className="col__caption">{caption}</p>
          </section>
        );
      })}
    </nav>
  );
}
