// src/common/schemas/enums.ts
/**
 * ─── THIS FILE IS NO LONGER THE ENFORCEMENT POINT ─────────────────────────────────
 * Read this before using anything below.
 *
 * Until prompt 9 these arrays were the taxonomy: the write schemas enforced them with
 * `z.enum`, so the database could only ever hold a value listed here. That is no longer
 * true, and the change is deliberate rather than a regression.
 *
 * **The taxonomy now lives in the `taxonomy_terms` TABLE** (`services/schema.ts`), one row
 * per option, with per-locale labels, an explicit order and a show-on-site flag — editable
 * from each subject's own dashboard page. **Enforcement moved with it**, to a RUNTIME check
 * against that table:
 *
 *   `unknownTermErrors()` in `services/taxonomy-service.ts`
 *      ← called by every write action in `modules/dashboard/actions/` before it calls a
 *        service, returning `{ ok: false, status: 422, body: fieldErrors }` naming the field
 *
 * A compile-time enum is the WRONG check once terms are editable: a category the studio
 * added five minutes ago would be rejected as invalid by code that shipped last week, and
 * the only fix would be a deploy — from a dashboard that exists so the studio would not need
 * one. The rest of every write schema is exactly as strict as it was: still `strictObject`,
 * so an unexpected key is still refused.
 *
 * A file that silently stops being enforced is worse than one that says so. This says so.
 *
 * ─── WHAT THESE ARRAYS ARE FOR NOW ────────────────────────────────────────────────
 * Two things, both real:
 *
 *  1. **They are the SEED SOURCE.** `scripts/seed-taxonomy.ts` writes one `taxonomy_terms`
 *     row per entry, IN THE ORDER DECLARED HERE — which is the legacy order, deliberate and
 *     not alphabetical (`project-service.ts` has said so since prompt 2). The seed is the
 *     only chance to carry that order across into `sort_order`, so do not tidy these arrays.
 *  2. **They are the historical record** of the vocabulary the archive was authored with.
 *     A value below that no term exists for any more is still a value 76 rows may carry.
 *
 * The exported TYPES are kept and are derived from the arrays directly. They no longer come
 * from a `z.enum`, because there is no longer a schema here to infer them from — nothing
 * parses against these arrays at all.
 *
 * ─── WHY READ SCHEMAS NEVER USED THESE, WHICH IS UNCHANGED ────────────────────────
 * Read schemas type these fields as a plain `z.string()`, deliberately, and prompt 9 makes
 * that MORE important rather than less. The rule is tolerant leaves, strict shape: a row
 * carrying a value not declared anywhere must not throw a `ZodError` that blanks the whole
 * index page. `tolerantEnum()` is the other option and is wrong here — it substitutes a
 * FALLBACK, so a project whose status was set to something new would render as "Completed",
 * which is a lie rather than a degradation. An unrecognized value must DEGRADE: it displays
 * as itself, and `utils/taxonomy.ts` appends it to the filter rail rather than dropping it,
 * so the records carrying it stay reachable.
 *
 * ─── LABELS ARE NOT HERE ──────────────────────────────────────────────────────────
 * These are wire values. `'Residential'` is a database value; `مسکونی` is a label, and a
 * label is now a COLUMN on the term (`label_fa`) rather than a key in the message catalog.
 * The catalog's `type.*` / `status.*` / `scale.*` / `cat.*` / `kind.*` groups are kept as
 * the fallback for a value that has no term at all — the middle step of the three-step
 * degradation (term label → catalog → raw value) the rails apply.
 */

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

export type ProjectType = (typeof projectTypeValues)[number];
export type ProjectStatus = (typeof projectStatusValues)[number];
export type ProjectScale = (typeof projectScaleValues)[number];

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

export type DesignCategory = (typeof designCategoryValues)[number];
export type DesignStatus = (typeof designStatusValues)[number];

/* ── media (legacy/data/works.js:273) ─────────────────────────────────────────── */

export const mediaTypeValues = ['Publication', 'Award', 'Lecture', 'Exhibition'] as const;

export type MediaType = (typeof mediaTypeValues)[number];
