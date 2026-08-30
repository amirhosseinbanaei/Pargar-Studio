// src/common/schemas/media.ts
/**
 * Contracts for the `media` table — 14 press, award, lecture and exhibition entries ported
 * from `legacy/data/works.js:273`.
 *
 * Persian translates title, outlet, blurb, author, excerpt, context and facts.
 *
 * `outlet` is the interesting one: it is translated in some records and left in Latin
 * script in others — `legacy/data/works.fa.js:283` keeps "ArchDaily" exactly as written,
 * while other entries render the outlet's name in Persian. Both columns therefore exist
 * even though many pairs hold identical strings; which ones differ is an editorial
 * decision per record, not a rule that could be applied at render time.
 *
 * ─── A GALLERY, AS OF PROMPT 14 ───────────────────────────────────────────────────
 * The line this file used to carry — "a media entry carries one image at most" — is gone.
 * An exhibition or a lecture is photographed like anything else, and the columns are the
 * ones `projects` already has. What survives unchanged is the fallback SEED: an entry with
 * no cover still takes the related PROJECT's slug, so a cutting about a building is still
 * tied to the building rather than to the magazine.
 */
import { z } from 'zod';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';
import {
  galleryColumn,
  galleryItemWriteSchema,
  imagePath,
  imagePathWrite,
  toLocaleGallery,
  toLocaleImage,
} from './image';
import { factSchema, factWriteSchema } from './fact';

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const mediaRowSchema = z.object({
  id: z.number(),
  slug: z.string().min(1),
  type: z.string(),
  year: z.number(),
  /**
   * The related project's slug, or `null` for the three entries about the practice rather
   * than a building (the brick essay, the Pars lecture and the biennale). Nullable, NOT optional: the column always exists, and making the key
   * optional would ripple a `?` through every consumer.
   */
  projectSlug: z.string().nullable(),
  sortOrder: z.number(),

  titleEn: looseString,
  titleFa: looseString,
  outletEn: looseString,
  outletFa: looseString,
  blurbEn: looseString,
  blurbFa: looseString,
  /**
   * Nullable in the database — an award has no byline (five of the fourteen records).
   * `looseString` normalizes that `null` to `''` so nothing downstream needs a null check
   * to render a line it was going to skip anyway.
   */
  authorEn: looseString,
  authorFa: looseString,
  excerptEn: looseString,
  excerptFa: looseString,
  contextEn: looseString,
  contextFa: looseString,
  factsEn: jsonArray(factSchema),
  factsFa: jsonArray(factSchema),

  /**
   * A COVER AND A GALLERY (prompt 14 widened prompt 10's cover-only), usually absent.
   *
   * `null` / `[]` is the state of every seeded row. `galleryColumn` degrades a NULL column
   * — which is what an `ALTER TABLE ADD COLUMN` leaves on every existing row — and
   * unparseable JSON alike to `[]`, so adding these two columns cannot blank the media
   * page. That is the ban at the foot of AGENTS.md, and
   * `__tests__/image.test.ts` pins it for this table by name.
   */
  coverImage: imagePath,
  coverAltEn: looseString,
  coverAltFa: looseString,
  galleryEn: galleryColumn,
  galleryFa: galleryColumn,

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MediaRow = z.infer<typeof mediaRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

export function toLocaleMedia(row: MediaRow, locale: Locale) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    year: row.year,
    projectSlug: row.projectSlug,
    sortOrder: row.sortOrder,
    title: pickLocale(locale, row.titleEn, row.titleFa),
    outlet: pickLocale(locale, row.outletEn, row.outletFa),
    blurb: pickLocale(locale, row.blurbEn, row.blurbFa),
    author: pickLocale(locale, row.authorEn, row.authorFa),
    excerpt: pickLocale(locale, row.excerptEn, row.excerptFa),
    context: pickLocale(locale, row.contextEn, row.contextFa),
    facts: pickLocale(locale, row.factsEn, row.factsFa),
    cover: toLocaleImage(locale, row.coverImage, row.coverAltEn, row.coverAltFa),
    gallery: toLocaleGallery(locale, row.galleryEn, row.galleryFa),
  };
}

export type Media = ReturnType<typeof toLocaleMedia>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

export const mediaCreateSchema = z.strictObject({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by single hyphens'),
  /**
   * A TAXONOMY COLUMN, and no longer a `z.enum` — see `@/common/schemas/enums`'s header.
   * The closed set moved into `taxonomy_terms` in prompt 9, so a value added five minutes
   * ago must be accepted here; what rejects an arbitrary string is the runtime check
   * `unknownTermErrors` in `services/taxonomy-service.ts`, which the write ACTION runs
   * before it calls a service and reports as a 422 naming this field.
   */
  type: z.string().min(1),
  year: z.number().int().min(1900).max(2200),
  /**
   * Deliberately not constrained to an existing project slug. A press cutting about a
   * building does not stop existing when that building is un-published or re-slugged from
   * the dashboard; the join is resolved on read and tolerates a miss.
   */
  projectSlug: z.string().nullable(),
  sortOrder: z.number().int().default(0),

  titleEn: z.string().min(1),
  titleFa: z.string().min(1),
  outletEn: z.string(),
  outletFa: z.string(),
  blurbEn: z.string(),
  blurbFa: z.string(),
  /** Write side keeps the distinction the column does: `null` means "no byline". */
  authorEn: z.string().nullable(),
  authorFa: z.string().nullable(),
  excerptEn: z.string(),
  excerptFa: z.string(),
  contextEn: z.string(),
  contextFa: z.string(),
  factsEn: z.array(factWriteSchema),
  factsFa: z.array(factWriteSchema),

  /** See `projectCreateSchema` — the same five columns, since prompt 14 gave this table a
   *  gallery too. The alt rule is cross-field and lives on the dashboard's schemas. */
  coverImage: imagePathWrite,
  coverAltEn: z.string().nullable(),
  coverAltFa: z.string().nullable(),
  galleryEn: z.array(galleryItemWriteSchema),
  galleryFa: z.array(galleryItemWriteSchema),
});

export type MediaCreate = z.infer<typeof mediaCreateSchema>;

export const mediaUpdateSchema = mediaCreateSchema.partial();

export type MediaUpdate = z.infer<typeof mediaUpdateSchema>;
