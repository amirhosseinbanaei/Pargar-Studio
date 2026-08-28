// src/modules/dashboard/schemas/media-form.ts
/**
 * The media editor's contract. Same shape as `design-work-form.ts`, with one field that has
 * no counterpart anywhere else in the dashboard: `projectSlug`.
 *
 * ─── THE RELATED-PROJECT FIELD IS A SELECT, NOT A TEXT INPUT ──────────────────────
 * `references/07-forms.md`'s rule against a free-text field for a value that must match a
 * real record applies here precisely: a typo in a hand-typed slug produces a dead link on
 * the public media detail page, which prompt 5 built the "resolve the link before
 * rendering it, tolerate a miss" behaviour specifically to avoid at READ time — the
 * WRITE side should not manufacture the very typo that behaviour exists to survive. The
 * options come from `listProjectRows()`, called by the ROUTE (a Server Component) and
 * passed down as props, because this is a `'use client'` form and `project-service` is
 * `server-only`.
 *
 * The HTML `<select>` element cannot hold a `null` value, so the form spells "no related
 * project" as `''` and the submission schema converts that to `null` on the way in —
 * `MediaCreate.projectSlug` is `string | null`, matching the nullable column.
 */
import { z } from 'zod';
import type { MediaCreate, MediaRow } from '@/common/schemas/media';
import { fallbackList, fallbackText, yearFieldAsNumber, yearFieldAsString } from './shared';

/**
 * ─── THE TAXONOMY FIELDS ARE NOT ENUMS ANY MORE (prompt 9) ────────────────────────
 * Non-empty strings on both schemas below; the closed set is enforced at runtime against
 * `taxonomy_terms` by `unknownTermErrors()` in `services/taxonomy-service.ts`, which the
 * write actions run before they call a service. See `@/common/schemas/enums`'s header.
 * Everything else is exactly as strict as it was, `strictObject` included.
 */

export const MEDIA_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MEDIA_YEAR_MIN = 1900;
export const MEDIA_YEAR_MAX = 2200;

/** The sentinel the `<select>` sends for "no related project". */
export const NO_RELATED_PROJECT = '';

const factFormSchema = z.object({ k: z.string(), v: z.string() });

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const mediaFormSchema = z.object({
  slug: z
    .string()
    .min(1, 'A slug is required.')
    .regex(MEDIA_SLUG_PATTERN, 'Lowercase words separated by single hyphens.'),
  type: z.string().min(1, 'Choose a kind.'),
  year: yearFieldAsString(MEDIA_YEAR_MIN, MEDIA_YEAR_MAX),
  /** `''` = no related project, matching `NO_RELATED_PROJECT`. */
  projectSlug: z.string(),

  titleEn: z.string().min(1, 'An English title is required.'),
  titleFa: z.string(),
  outletEn: z.string(),
  outletFa: z.string(),
  blurbEn: z.string(),
  blurbFa: z.string(),
  authorEn: z.string(),
  authorFa: z.string(),
  excerptEn: z.string(),
  excerptFa: z.string(),
  contextEn: z.string(),
  contextFa: z.string(),

  factsEn: z.array(factFormSchema),
  factsFa: z.array(factFormSchema),
});

export type MediaFormValues = z.infer<typeof mediaFormSchema>;

export const MEDIA_FORM_FIELDS = [
  'slug',
  'type',
  'year',
  'projectSlug',
  'titleEn',
  'titleFa',
  'outletEn',
  'outletFa',
  'blurbEn',
  'blurbFa',
  'authorEn',
  'authorFa',
  'excerptEn',
  'excerptFa',
  'contextEn',
  'contextFa',
  'factsEn',
  'factsFa',
] as const satisfies ReadonlyArray<keyof MediaFormValues>;

export const EMPTY_MEDIA_FORM: MediaFormValues = {
  slug: '',
  // Empty, not a hardcoded first value — see `EMPTY_DESIGN_WORK_FORM`.
  type: '',
  year: String(new Date().getFullYear()),
  projectSlug: NO_RELATED_PROJECT,
  titleEn: '',
  titleFa: '',
  outletEn: '',
  outletFa: '',
  blurbEn: '',
  blurbFa: '',
  authorEn: '',
  authorFa: '',
  excerptEn: '',
  excerptFa: '',
  contextEn: '',
  contextFa: '',
  factsEn: [],
  factsFa: [],
};

export function toMediaFormValues(row: MediaRow): MediaFormValues {
  return {
    slug: row.slug,
    // Carried through untouched — see `toProjectFormValues`.
    type: row.type,
    year: String(row.year),
    projectSlug: row.projectSlug ?? NO_RELATED_PROJECT,
    titleEn: row.titleEn,
    titleFa: row.titleFa,
    outletEn: row.outletEn,
    outletFa: row.outletFa,
    blurbEn: row.blurbEn,
    blurbFa: row.blurbFa,
    authorEn: row.authorEn,
    authorFa: row.authorFa,
    excerptEn: row.excerptEn,
    excerptFa: row.excerptFa,
    contextEn: row.contextEn,
    contextFa: row.contextFa,
    factsEn: row.factsEn,
    factsFa: row.factsFa,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const mediaSubmissionSchema = z.strictObject({
  slug: z.string().min(1).regex(MEDIA_SLUG_PATTERN),
  type: z.string().min(1),
  year: yearFieldAsNumber(MEDIA_YEAR_MIN, MEDIA_YEAR_MAX),
  projectSlug: z.string().transform(value => (value === NO_RELATED_PROJECT ? null : value)),

  titleEn: z.string().min(1),
  titleFa: z.string(),
  outletEn: z.string(),
  outletFa: z.string(),
  blurbEn: z.string(),
  blurbFa: z.string(),
  authorEn: z.string(),
  authorFa: z.string(),
  excerptEn: z.string(),
  excerptFa: z.string(),
  contextEn: z.string(),
  contextFa: z.string(),

  factsEn: z.array(factFormSchema),
  factsFa: z.array(factFormSchema),
});

export type MediaSubmission = z.output<typeof mediaSubmissionSchema>;

export function withPersianFallback(input: MediaSubmission): Omit<MediaCreate, 'sortOrder'> {
  return {
    slug: input.slug,
    type: input.type,
    year: input.year,
    projectSlug: input.projectSlug,
    titleEn: input.titleEn,
    titleFa: fallbackText(input.titleFa, input.titleEn),
    outletEn: input.outletEn,
    outletFa: fallbackText(input.outletFa, input.outletEn),
    blurbEn: input.blurbEn,
    blurbFa: fallbackText(input.blurbFa, input.blurbEn),
    authorEn: input.authorEn,
    authorFa: fallbackText(input.authorFa, input.authorEn),
    excerptEn: input.excerptEn,
    excerptFa: fallbackText(input.excerptFa, input.excerptEn),
    contextEn: input.contextEn,
    contextFa: fallbackText(input.contextFa, input.contextEn),
    factsEn: input.factsEn,
    factsFa: fallbackList(input.factsFa, input.factsEn),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Layout metadata
   ──────────────────────────────────────────────────────────────────────────────── */

export const MEDIA_LOCALE_FIELDS = [
  { label: 'Title', en: 'titleEn', fa: 'titleFa', multiline: false, required: true },
  { label: 'Outlet', en: 'outletEn', fa: 'outletFa', multiline: false },
  { label: 'Blurb', en: 'blurbEn', fa: 'blurbFa', multiline: true, rows: 3 },
  { label: 'Author', en: 'authorEn', fa: 'authorFa', multiline: false },
  { label: 'Excerpt', en: 'excerptEn', fa: 'excerptFa', multiline: true, rows: 4 },
  { label: 'Context', en: 'contextEn', fa: 'contextFa', multiline: true, rows: 6 },
] as const satisfies ReadonlyArray<{
  label: string;
  en: keyof MediaFormValues;
  fa: keyof MediaFormValues;
  multiline: boolean;
  rows?: number;
  required?: boolean;
}>;
