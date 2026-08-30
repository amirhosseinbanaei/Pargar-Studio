// src/common/schemas/index-card.ts
/**
 * Contracts for the five index cards — the WORDS and the PICTURE on each of the columns
 * that make up the front page.
 *
 * ─── THE BOUNDARY OF THE REVERSAL ─────────────────────────────────────────────────
 * `common/constants/site.ts` records that the wordmark and the five section ids are CHROME
 * and are not editable, because they are referenced by the route tree, by `.col[data-id]`
 * in the ported CSS and by the shell transition — so a dashboard save could otherwise
 * delete a route. That reasoning stands and is not reversed. `id`, `path`, `art` and `seed`
 * are still constants nobody can edit, and `labelKey` / `captionKey` are still there.
 *
 * What this file adds is everything that is NOT chrome: the title, the caption and an
 * uploaded photograph. `section_id` is the primary key and it is one of the five NAV ids,
 * so the table cannot grow a sixth meaningful row and deleting one deletes CONTENT rather
 * than a route.
 *
 * ─── `labelKey` / `captionKey` ARE THE FALLBACK NOW, NOT DEAD COPY ────────────────
 * `toLocaleIndexCard` deliberately returns `''` for an empty column rather than reaching
 * for a message catalog, and the RENDERER supplies `nav.<id>` / `cap.<id>` when it does.
 * Two reasons: the degradation belongs where the dictionary already is (`ColumnShell`
 * holds one, this layer would have to import one), and a service that had already
 * substituted the fallback would make "has an editor written a title yet?" unanswerable
 * from its return value — which is the question the dashboard asks.
 *
 * Read side tolerant at the leaves, write side exact — `./helpers`'s rule, unchanged.
 */
import { z } from 'zod';
import { looseString } from './helpers';
import { imagePath, imagePathWrite, toLocaleImage, type LocaleImage } from './image';
import { pickLocale, type Locale } from './locale';

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const indexCardRowSchema = z.object({
  sectionId: z.string(),

  titleEn: looseString,
  titleFa: looseString,
  captionEn: looseString,
  captionFa: looseString,

  /** The trio from prompt 10. `null` is the normal state of all five rows today. */
  coverImage: imagePath,
  coverAltEn: looseString,
  coverAltFa: looseString,

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type IndexCardRow = z.infer<typeof indexCardRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

/** What a column renders. Every string may be `''`; the caller falls back. */
export interface IndexCard {
  /** One of the five NAV ids. */
  sectionId: string;
  /** `''` when nobody has written one — render `nav.<sectionId>`. */
  title: string;
  /** `''` when nobody has written one — render `cap.<sectionId>`. */
  caption: string;
  /**
   * The uploaded picture, or `null` — meaning "draw one". `toLocaleImage` also answers
   * `null` for a path whose alt text is missing in THIS locale, which is prompt 10's rule
   * and the reason a column can never publish a photograph no screen reader can describe.
   */
  image: LocaleImage | null;
}

export function toLocaleIndexCard(row: IndexCardRow, locale: Locale): IndexCard {
  return {
    sectionId: row.sectionId,
    title: pickLocale(locale, row.titleEn, row.titleFa),
    caption: pickLocale(locale, row.captionEn, row.captionFa),
    image: toLocaleImage(locale, row.coverImage, row.coverAltEn, row.coverAltFa),
  };
}

/**
 * The card a section with NO ROW renders — every field empty, so every field degrades.
 *
 * It exists so that "the row is missing" and "the row is blank" are the same case for
 * every consumer. A freshly migrated database has all five rows, but nothing in the read
 * path may depend on that: a column must never render blank because a row is not there.
 */
export function emptyIndexCard(sectionId: string): IndexCard {
  return { sectionId, title: '', caption: '', image: null };
}

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

/**
 * The update, and there is no create and no delete — the five rows are the schema's, put
 * there by the migration. `section_id` is not in here: it names the row being written and
 * is an argument to the repository, never a value the payload may change.
 *
 * `.partial()` for the same PATCH reason the other singletons give: a save must not blank
 * a column the caller did not send.
 */
export const indexCardUpdateSchema = z
  .strictObject({
    titleEn: z.string(),
    titleFa: z.string(),
    captionEn: z.string(),
    captionFa: z.string(),
    coverImage: imagePathWrite,
    coverAltEn: z.string().nullable(),
    coverAltFa: z.string().nullable(),
  })
  .partial();

export type IndexCardUpdate = z.infer<typeof indexCardUpdateSchema>;
