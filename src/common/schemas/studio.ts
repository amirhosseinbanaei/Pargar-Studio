// src/common/schemas/studio.ts
/**
 * Contracts for the `studio` singleton — the editorial block at `legacy/data/studio.js:25`.
 *
 * One row, id 1. Every field is per-locale, because every field is prose or a list of
 * prose: the manifesto, the two founder biographies, the four statistics, twenty-two
 * current names, forty alumni, six awards and five chapters of the studio's history. The
 * Persian layer (`legacy/data/studio.fa.js`) translates all of them, names included.
 *
 * `BRAND` and `NAV` from the same legacy file are NOT stored here. They are the shell's
 * chrome — the wordmark, five nav labels and their captions — not editable content, and
 * prompt 4 ports them as constants beside the shell. Putting them in this table would make
 * the site's navigation a database read on every render for values that change when the
 * routing does, not when an editor decides.
 */
import { z } from 'zod';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';
import {
  embeddedImageAlt,
  embeddedImagePath,
  galleryColumn,
  galleryItemWriteSchema,
  imagePathWrite,
  toLocaleGallery,
} from './image';

/** The id every read and write pins to. Exported so the repository never spells it twice. */
export const STUDIO_ID = 1;

/* ── Nested shapes ────────────────────────────────────────────────────────────── */

export const founderSchema = z.object({
  name: looseString,
  role: looseString,
  born: looseString,
  bio: looseString,
  /**
   * THE PORTRAIT (prompt 10), inside the founder rather than in a parallel column.
   *
   * `null` for a founder with no photograph — which is both of them today — and the studio
   * page then renders the generated `portrait()` seeded from the ENGLISH name, exactly as
   * it did before. That English-name seeding is the reason `modules/studio/lib/seeds.ts`
   * exists, and the uploaded path is carried alongside those seeds for the same reason: the
   * English record is the authority on which picture a founder has, and the localized one
   * is the authority on what it says.
   */
  /**
   * `embedded*` rather than the plain leaves, and that is load-bearing: every founder object
   * in the database was written before these keys existed, and a schema that rejects an
   * ABSENT key makes `jsonArray` degrade the whole array to `[]` — which blanks the founders
   * section of the studio page silently. See `./image`.
   */
  image: embeddedImagePath,
  /** Required whenever `image` is set — enforced by the dashboard's schemas. */
  imageAlt: embeddedImageAlt,
});

export const statSchema = z.object({
  label: looseString,
  value: looseString,
});

/**
 * A year, whichever way the record spells it.
 *
 * FIXED IN PROMPT 5, and it was a silent one. `legacy/data/studio.js:89` writes an award's
 * year as a NUMBER (`year: 2024`) and a chapter's as a STRING (`year: '2007'`) — the two
 * arrays disagree in the source, and the seed copies both verbatim. A `looseString` leaf
 * therefore failed on every award, and because `jsonArray` degrades an unparseable payload
 * to `[]` rather than throwing (which is the right call for a leaf), the studio page
 * rendered `<div class="rows"></div>`: six awards, no error, no empty state, nothing in the
 * gate to notice. The tolerance that keeps one bad row from blanking a page is also what
 * hides a schema that never matched.
 *
 * Normalizing to a string here rather than to a number is deliberate: the value is
 * displayed and digit-shaped by `num()`, never compared or sorted, and `'2024'` is what
 * every other year in this file already is.
 */
const looseYear = z
  .union([z.string(), z.number()])
  .nullable()
  .transform(v => (v === null ? '' : String(v)));

export const awardSchema = z.object({
  year: looseYear,
  title: looseString,
  project: looseString,
  body: looseString,
});

export const chapterSchema = z.object({
  /** A string in the source today; `looseYear` so a numeric one cannot blank the timeline. */
  year: looseYear,
  text: looseString,
});

export type Founder = z.infer<typeof founderSchema>;
export type Stat = z.infer<typeof statSchema>;
export type Award = z.infer<typeof awardSchema>;
export type Chapter = z.infer<typeof chapterSchema>;

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const studioRowSchema = z.object({
  id: z.number(),

  manifestoEn: looseString,
  manifestoFa: looseString,
  foundersEn: jsonArray(founderSchema),
  foundersFa: jsonArray(founderSchema),
  statsEn: jsonArray(statSchema),
  statsFa: jsonArray(statSchema),
  teamEn: jsonArray(z.string()),
  teamFa: jsonArray(z.string()),
  alumniEn: jsonArray(z.string()),
  alumniFa: jsonArray(z.string()),
  awardsEn: jsonArray(awardSchema),
  awardsFa: jsonArray(awardSchema),
  chaptersEn: jsonArray(chapterSchema),
  chaptersFa: jsonArray(chapterSchema),

  /**
   * THE PAGE'S GALLERY (prompt 14). The first image fills the hero band, which was a
   * drawing at a fixed seed until this prompt; the rest render in a band below it.
   *
   * `galleryColumn` degrades NULL — the value the `ALTER TABLE` left on the one existing
   * row — and unparseable JSON alike to `[]`. That matters more here than anywhere: this
   * is the table whose sections have silently vanished twice (`awards` in prompt 5,
   * `founders` in prompt 10), and both were the same shape of failure.
   */
  galleryEn: galleryColumn,
  galleryFa: galleryColumn,

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StudioRow = z.infer<typeof studioRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

export function toLocaleStudio(row: StudioRow, locale: Locale) {
  return {
    manifesto: pickLocale(locale, row.manifestoEn, row.manifestoFa),
    founders: pickLocale(locale, row.foundersEn, row.foundersFa),
    stats: pickLocale(locale, row.statsEn, row.statsFa),
    team: pickLocale(locale, row.teamEn, row.teamFa),
    alumni: pickLocale(locale, row.alumniEn, row.alumniFa),
    awards: pickLocale(locale, row.awardsEn, row.awardsFa),
    chapters: pickLocale(locale, row.chaptersEn, row.chaptersFa),
    gallery: toLocaleGallery(locale, row.galleryEn, row.galleryFa),
  };
}

export type Studio = ReturnType<typeof toLocaleStudio>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

const founderWriteSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string(),
  born: z.string(),
  bio: z.string(),
  image: imagePathWrite,
  imageAlt: z.string().nullable(),
});

const statWriteSchema = z.strictObject({ label: z.string().min(1), value: z.string() });

const awardWriteSchema = z.strictObject({
  year: z.string().min(1),
  title: z.string().min(1),
  project: z.string(),
  body: z.string(),
});

const chapterWriteSchema = z.strictObject({ year: z.string().min(1), text: z.string() });

/**
 * There is no `create` for a singleton — the seed writes row 1 and the dashboard edits it —
 * so the write contract is the update, and every field is optional for the PATCH reason:
 * saving one section must not blank the six the editor did not open.
 */
export const studioUpdateSchema = z
  .strictObject({
    manifestoEn: z.string(),
    manifestoFa: z.string(),
    foundersEn: z.array(founderWriteSchema),
    foundersFa: z.array(founderWriteSchema),
    statsEn: z.array(statWriteSchema),
    statsFa: z.array(statWriteSchema),
    teamEn: z.array(z.string().min(1)),
    teamFa: z.array(z.string().min(1)),
    alumniEn: z.array(z.string().min(1)),
    alumniFa: z.array(z.string().min(1)),
    awardsEn: z.array(awardWriteSchema),
    awardsFa: z.array(awardWriteSchema),
    chaptersEn: z.array(chapterWriteSchema),
    chaptersFa: z.array(chapterWriteSchema),
    /** The page's own gallery — see the read schema. Index-aligned, like every other pair. */
    galleryEn: z.array(galleryItemWriteSchema),
    galleryFa: z.array(galleryItemWriteSchema),
  })
  .partial();

export type StudioUpdate = z.infer<typeof studioUpdateSchema>;

/** The full row shape the seed inserts, before ids and timestamps. */
export const studioCreateSchema = studioUpdateSchema.required();

export type StudioCreate = z.infer<typeof studioCreateSchema>;
