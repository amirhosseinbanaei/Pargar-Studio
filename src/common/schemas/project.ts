// src/common/schemas/project.ts
/**
 * Contracts for the `projects` table — the 76-record archive ported from
 * `legacy/data/projects.js`.
 *
 * Three schemas, three jobs:
 *
 * - `projectRowSchema` — READ. What `project-repository.ts` parses every row through, and
 *   the ONLY place a project row is validated. Tolerant at the leaves, strict at the
 *   shape: a missing column is a schema bug worth throwing over, a surprising VALUE is
 *   not worth blanking the index page for.
 * - `projectCreateSchema` / `projectUpdateSchema` — WRITE. Exact, and the taxonomy is
 *   enforced here (`z.enum`) rather than on read.
 * - `toLocaleProject` — the single mapper that collapses the bilingual row to one locale.
 *
 * Everything is bilingual by COLUMN PAIR (`titleEn` / `titleFa`), not by row: see
 * `@/common/services/schema`. Persian translates exactly five fields — title, blurb,
 * description, location and client — confirmed against `legacy/data/projects.fa.part1.js:8`,
 * which carries those five keys and no others. `types`, `status`, `scale`, `year` and
 * `area` are single columns; their Persian is a UI dictionary, not content.
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
import { projectTypeValues } from './enums';

/* ─────────────────────────────────────────────────────────────────────────────
   READ
   ───────────────────────────────────────────────────────────────────────────── */

export const projectRowSchema = z.object({
  /**
   * NOT tolerant, and never `.catch()`ed. A fabricated id points a dashboard update at
   * the wrong record; an untrustworthy id is a bug, not a degraded read.
   */
  id: z.number(),
  slug: z.string().min(1),

  /**
   * Stored as a JSON string because a project carries MORE THAN ONE type
   * (`['Residential', 'Interior Design']`, `legacy/data/projects.js:31`). It leaves this
   * schema as a real `string[]`; nothing downstream calls `JSON.parse`.
   *
   * Typed `z.string()` rather than the enum on purpose — see the header of `./enums`.
   */
  types: jsonArray(z.string()),
  status: z.string(),
  scale: z.string(),
  year: z.number(),
  area: looseString,
  sortOrder: z.number(),

  titleEn: looseString,
  titleFa: looseString,
  blurbEn: looseString,
  blurbFa: looseString,
  descriptionEn: looseString,
  descriptionFa: looseString,
  locationEn: looseString,
  locationFa: looseString,
  clientEn: looseString,
  clientFa: looseString,

  /**
   * THE PHOTOGRAPHS (prompt 10), and every one of them is optional.
   *
   * `null` / `[]` is the state of the entire seeded archive and is not a gap: a project
   * with no cover keeps the drawing `kindFor(slug, types)` generates, on the card and on
   * the detail page alike. See `@/common/schemas/image` for why a path with no alt text in
   * the rendered locale counts as "no image" rather than as an undescribed one.
   */
  coverImage: imagePath,
  coverAltEn: looseString,
  coverAltFa: looseString,
  galleryEn: galleryColumn,
  galleryFa: galleryColumn,

  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The full bilingual row, as it leaves the repository. */
export type ProjectRow = z.infer<typeof projectRowSchema>;

/* ─────────────────────────────────────────────────────────────────────────────
   LOCALE MAPPER
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Collapse a bilingual row to one locale.
 *
 * Lives here, not in a component and not in a page, for the reason the whole schemas
 * layer exists: if each surface picked its own columns, the day a field gains a Persian
 * translation would be a hunt through every template instead of one edit here.
 */
export function toLocaleProject(row: ProjectRow, locale: Locale) {
  return {
    id: row.id,
    slug: row.slug,
    types: row.types,
    status: row.status,
    scale: row.scale,
    year: row.year,
    area: row.area,
    sortOrder: row.sortOrder,
    title: pickLocale(locale, row.titleEn, row.titleFa),
    blurb: pickLocale(locale, row.blurbEn, row.blurbFa),
    description: pickLocale(locale, row.descriptionEn, row.descriptionFa),
    location: pickLocale(locale, row.locationEn, row.locationFa),
    client: pickLocale(locale, row.clientEn, row.clientFa),
    /**
     * `{ path, alt } | null` rather than a path and a string, so "is there a picture here"
     * is one check a component cannot half-do — and so the alt text is already in the
     * rendered locale by the time any component sees it.
     */
    cover: toLocaleImage(locale, row.coverImage, row.coverAltEn, row.coverAltFa),
    gallery: toLocaleGallery(locale, row.galleryEn, row.galleryFa),
  };
}

/**
 * Derived from the mapper rather than hand-written beside it, for the same reason wire
 * types are derived with `z.infer`: two declarations of one shape drift, and the compiler
 * validates the stale one.
 */
export type Project = ReturnType<typeof toLocaleProject>;

/* ─────────────────────────────────────────────────────────────────────────────
   WRITE — exact. Consumed by the dashboard Server Actions in prompt 6.
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * The bounds shared by this schema and the dashboard's FORM schema
 * (`modules/dashboard/schemas/project-form.ts`), exported so there is exactly one copy of
 * each.
 *
 * The failure this prevents is not hypothetical: prompt 5 shipped `min(10)` in the contact
 * form and `min(1)` in the action that backs it, and a nine-character message was accepted
 * by the server the form had just refused. A bound that appears twice drifts; a bound that
 * appears once cannot.
 *
 * The slug is also the SEED for the project's generated drawings
 * (`legacy/data/projects.js:5`), so its pattern must stay URL- and RNG-safe forever:
 * lowercase ASCII, digits and single hyphens only.
 */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROJECT_YEAR_MIN = 1900;
export const PROJECT_YEAR_MAX = 2200;

/**
 * `strictObject`: an unexpected key on a write is tampering or a mass-assignment attempt,
 * not an additive release to tolerate.
 */
export const projectCreateSchema = z.strictObject({
  slug: z
    .string()
    .min(1)
    .regex(PROJECT_SLUG_PATTERN, 'lowercase words separated by single hyphens'),
  /**
   * A TAXONOMY COLUMN, and no longer a `z.enum` — see `@/common/schemas/enums`'s header.
   * The closed set moved into `taxonomy_terms` in prompt 9, so a value added five minutes
   * ago must be accepted here; what rejects an arbitrary string is the runtime check
   * `unknownTermErrors` in `services/taxonomy-service.ts`, which the write ACTION runs
   * before it calls a service and reports as a 422 naming this field.
   */
  types: z.array(z.string().min(1)).min(1),
  status: z.string().min(1),
  scale: z.string().min(1),
  year: z.number().int().min(PROJECT_YEAR_MIN).max(PROJECT_YEAR_MAX),
  area: z.string(),
  sortOrder: z.number().int().default(0),

  titleEn: z.string().min(1),
  /**
   * STILL REQUIRED, even though the dashboard lets an editor leave Persian blank.
   *
   * Those two facts are not in tension — they are the same decision seen from either end.
   * The seed writes the English value into the `_fa` column wherever an overlay omits a
   * key (`scripts/seed.ts`, reproducing `legacy/js/core/i18n.js:154`), and prompt 6's
   * create/update actions do exactly the same thing with an empty Persian field. So the
   * fallback is applied at the point content is AUTHORED, and by the time a payload
   * reaches this schema both columns are populated. That is precisely what lets
   * `pickLocale` have no fallback branch and `/fa/...` never render a blank page.
   */
  titleFa: z.string().min(1),
  blurbEn: z.string(),
  blurbFa: z.string(),
  descriptionEn: z.string(),
  descriptionFa: z.string(),
  locationEn: z.string(),
  locationFa: z.string(),
  clientEn: z.string(),
  clientFa: z.string(),

  /**
   * NULLABLE, and the alt pair is nullable beside it, because "no photograph" is a normal
   * and permanent state for a record in this archive.
   *
   * The rule that alt text is REQUIRED WHENEVER AN IMAGE IS SET is cross-field, so it lives
   * on the dashboard's form and submission schemas (`modules/dashboard/schemas/image.ts`'s
   * `requireAltWithImage`) rather than here — this schema describes what a column may hold,
   * and by the time a payload reaches it the rule has already been enforced.
   */
  coverImage: imagePathWrite,
  coverAltEn: z.string().nullable(),
  coverAltFa: z.string().nullable(),
  galleryEn: z.array(galleryItemWriteSchema),
  galleryFa: z.array(galleryItemWriteSchema),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;

/**
 * PATCH semantics: every field optional, so a save sends only what changed. Sending the
 * whole record on every save makes each one a full overwrite that blanks fields another
 * session changed between load and submit.
 */
export const projectUpdateSchema = projectCreateSchema.partial();

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/**
 * Re-exported so a dashboard option list has one import, not two.
 *
 * NOT an option list any more — the options come from `taxonomy_terms`. This array is the
 * seed source and a historical record of the eleven types the archive was built with; see
 * `@/common/schemas/enums`.
 */
export { projectTypeValues };
