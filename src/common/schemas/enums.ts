// src/common/schemas/enums.ts
/**
 * Every closed taxonomy value in the content model, declared once.
 *
 * Each is exported as an `as const` ARRAY as well as a schema, because three consumers
 * need the same list: the WRITE schemas (`z.enum(...)`, exact), the dashboard's option
 * lists in prompt 6, and the label maps in the UI. One edit updates all three.
 *
 * ─── WHY READ SCHEMAS DO NOT USE THESE ────────────────────────────────────────────
 * Read schemas type these fields as a plain `z.string()`, deliberately. The rule is
 * tolerant leaves, strict shape: a row carrying a value not listed here must not throw a
 * `ZodError` that blanks the whole index page. `tolerantEnum()` is the other option and is
 * wrong here — it substitutes a FALLBACK, so a project whose status the dashboard set to
 * something new would render as "Completed", which is a lie rather than a degradation. The
 * UI's translation dictionary already falls back to the raw value (see
 * `legacy/js/core/i18n.js` `t()`), so an unknown value displays as itself.
 *
 * Writes are where the taxonomy is enforced: the write schemas below reject anything not
 * in these arrays, so in practice the database only ever holds these values — which is
 * also what makes the DERIVED filter taxonomy in `project-service.ts` correct.
 *
 * ─── LABELS ARE NOT HERE ──────────────────────────────────────────────────────────
 * These are wire values. `'Residential'` is a database value; `مسکونی` is copy, and copy
 * lives in the UI layer (prompt 4 ports `legacy/data/i18n.js`'s `type.*` dictionary).
 */
import { z } from 'zod';

/* ── projects (legacy/data/projects.js:9-16) ──────────────────────────────────── */

export const projectTypeValues = [
  'Residential',
  'Villa',
  'Office',
  'Hospitality',
  'Commercial',
  'Complex',
  'Interior Design',
  'Renovation',
  'Public',
  'Urban Design',
  'Industrial',
] as const;

export const projectStatusValues = ['Completed', 'Under Construction', 'Concept'] as const;

export const projectScaleValues = ['Small', 'Medium', 'Large'] as const;

export const projectTypeEnum = z.enum(projectTypeValues);
export const projectStatusEnum = z.enum(projectStatusValues);
export const projectScaleEnum = z.enum(projectScaleValues);

export type ProjectType = z.infer<typeof projectTypeEnum>;
export type ProjectStatus = z.infer<typeof projectStatusEnum>;
export type ProjectScale = z.infer<typeof projectScaleEnum>;

/* ── design works (legacy/data/works.js:10) ───────────────────────────────────── */

export const designCategoryValues = [
  'Branding',
  'Detail Design',
  'Furniture',
  'Product',
  'Exhibition',
  'Signage',
] as const;

/** Not the same set as a project's: a chair is `In production`, a building never is. */
export const designStatusValues = ['Completed', 'In production'] as const;

export const designCategoryEnum = z.enum(designCategoryValues);
export const designStatusEnum = z.enum(designStatusValues);

export type DesignCategory = z.infer<typeof designCategoryEnum>;
export type DesignStatus = z.infer<typeof designStatusEnum>;

/* ── media (legacy/data/works.js:273) ─────────────────────────────────────────── */

export const mediaTypeValues = ['Publication', 'Award', 'Lecture', 'Exhibition'] as const;

export const mediaTypeEnum = z.enum(mediaTypeValues);

export type MediaType = z.infer<typeof mediaTypeEnum>;
