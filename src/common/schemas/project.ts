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
import { projectScaleEnum, projectStatusEnum, projectTypeEnum, projectTypeValues } from './enums';

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
 * `strictObject`: an unexpected key on a write is tampering or a mass-assignment attempt,
 * not an additive release to tolerate.
 */
export const projectCreateSchema = z.strictObject({
  slug: z
    .string()
    .min(1)
    /**
     * The slug is also the seed for the project's generated drawings
     * (`legacy/data/projects.js:5`), so it must stay URL- and RNG-safe forever. Lowercase
     * ASCII, digits and single hyphens only.
     */
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by single hyphens'),
  types: z.array(projectTypeEnum).min(1),
  status: projectStatusEnum,
  scale: projectScaleEnum,
  year: z.number().int().min(1900).max(2200),
  area: z.string(),
  sortOrder: z.number().int().default(0),

  titleEn: z.string().min(1),
  titleFa: z.string().min(1),
  blurbEn: z.string(),
  blurbFa: z.string(),
  descriptionEn: z.string(),
  descriptionFa: z.string(),
  locationEn: z.string(),
  locationFa: z.string(),
  clientEn: z.string(),
  clientFa: z.string(),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;

/**
 * PATCH semantics: every field optional, so a save sends only what changed. Sending the
 * whole record on every save makes each one a full overwrite that blanks fields another
 * session changed between load and submit.
 */
export const projectUpdateSchema = projectCreateSchema.partial();

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/** Re-exported so a dashboard option list has one import, not two. */
export { projectTypeValues };
