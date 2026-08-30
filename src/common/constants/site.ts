// src/common/constants/site.ts
/**
 * The shell's own constants: the wordmark and the five columns.
 *
 * These are NOT in the database, and that is a decision rather than an omission (AGENTS.md).
 * A wordmark and five section ids are chrome: they are referenced by the route tree, by the
 * ported CSS (`.col[data-id]`) and by the shell transition, so making them editable would
 * mean a dashboard save could delete a route. The LABELS and CAPTIONS are not here either —
 * they are interface copy and live in `@/common/i18n` under `nav.*` and `cap.*`, which is
 * what makes the columns bilingual without a second constant.
 *
 * ─── PARTIALLY REVERSED IN PROMPT 13, AND THE BOUNDARY IS THE WHOLE DESIGN ────────
 * An editor CAN now change a column's title and caption and put a photograph behind it,
 * through `index_cards` and `/dashboard/index-cards`. The paragraph above is not repealed —
 * it is the reason the reversal is bounded exactly where it is:
 *
 *   EDITABLE (a row in `index_cards`, keyed on `id`) — the title, the caption, the picture
 *     and its alt text. None of these is referenced by anything but a renderer, so the
 *     worst a bad save can do is show the wrong words on the front page.
 *   NOT EDITABLE (still here, still constants) — `id`, `path`, `art` and `seed`. These ARE
 *     the route tree, the CSS hook and the shell transition's lookup, and the failure the
 *     original decision names is real: a dashboard that could change `id` or `path` is a
 *     dashboard that can delete a route with a save.
 *
 * `labelKey` and `captionKey` stay too, and are now the FALLBACK rather than the only
 * source: a section with no row, or with an empty title, renders `nav.<id>` / `cap.<id>`
 * exactly as it always did. Deleting those catalog entries would break that degradation —
 * they are load-bearing copy, not dead copy.
 *
 * Ported from `legacy/data/studio.js:6` (BRAND) and `:17` (NAV), with the per-column
 * drawing kind and seed lifted out of `legacy/index.html:112` onward, where they were
 * `data-art` / `data-seed` attributes read by the client at runtime. They are constants
 * here because the drawing is now generated on the SERVER: the attribute existed to tell
 * a browser what to draw, and the browser no longer draws anything.
 */
import type { MessageKey } from '@/common/i18n';
import type { ProjectKind } from '@/common/lib/art';

export const BRAND = {
  short: 'KAVAN',
  city: 'Tehran',
  founded: 2007,
  /**
   * `meaning` MOVED TO THE DICTIONARY in prompt 5, as `brand.meaning`. The studio page
   * prints it under "The name", and `legacy/data/studio.fa.js:10` translates it — a
   * constant cannot be bilingual, and keeping an English copy here beside the Persian one
   * there would be two truths with one of them always wrong.
   */
} as const;

export interface NavSection {
  /** Matches `.col[data-id]` in the ported CSS and the shell transition's lookup. */
  id: string;
  /** Locale-less path; `localeHref` adds the prefix. */
  path: string;
  /** Dictionary keys, so the column is bilingual without a second table. */
  labelKey: MessageKey;
  captionKey: MessageKey;
  /** The generator and seed for this column's `.col__art`, run on the server. */
  art: ProjectKind;
  seed: string;
}

export const NAV: readonly NavSection[] = [
  {
    id: 'projects',
    path: '/projects',
    labelKey: 'nav.projects',
    captionKey: 'cap.projects',
    art: 'elevation',
    seed: 'kavan-projects',
  },
  {
    id: 'design',
    path: '/design',
    labelKey: 'nav.design',
    captionKey: 'cap.design',
    art: 'screen',
    seed: 'kavan-design',
  },
  {
    id: 'media',
    path: '/media',
    labelKey: 'nav.media',
    captionKey: 'cap.media',
    art: 'massing',
    seed: 'kavan-media',
  },
  {
    id: 'studio',
    path: '/studio',
    labelKey: 'nav.studio',
    captionKey: 'cap.studio',
    art: 'section',
    seed: 'kavan-studio',
  },
  {
    id: 'contact',
    path: '/contact',
    labelKey: 'nav.contact',
    captionKey: 'cap.contact',
    art: 'plan',
    seed: 'kavan-contact',
  },
] as const;

/**
 * Is this string one of the five sections?
 *
 * The one place that question is answered, because two callers ask it and they must agree:
 * `/dashboard/index-cards/[section]` refuses an unknown segment with `notFound()` before
 * rendering anything, and `indexCardSubmissionSchema` refuses one on the way in — a Server
 * Action is a public endpoint and the route's check proves nothing about a hand-written
 * POST. A third caller would be a third chance to spell the list differently.
 */
export const isNavSectionId = (value: string): boolean => NAV.some(section => section.id === value);

/**
 * The ratio the column artwork is authored at.
 *
 * A resting column is roughly 1:2.5. Drawing at 1:1.4 and letting the SVG's `slice` fit
 * crop the sides yields a vertical DETAIL of a correctly-proportioned drawing; authoring at
 * the column's own ratio would stretch the geometry instead. Lifted from
 * `legacy/js/ui/shell.js`'s `ensureArt`, which is now the fallback path in
 * `common/lib/motion/shell.ts` rather than the normal one.
 */
export const COLUMN_ART_RATIO = 1.4;

/** Card thumbnails and detail plates, both from `legacy/js/ui/panel.js:610` and `:97`. */
export const PLATE_RATIO = 0.75;
