// src/modules/dashboard/schemas/design-work-form.ts
/**
 * The design-work editor's contract. Same two-schema shape as `project-form.ts` — a form
 * schema carrying copy, a submission schema that does not — for the same reason: the form
 * validates a keystroke ago with a localized schema, and that proves nothing to an action
 * reachable directly over HTTP.
 *
 * ─── ~~PERSIAN IS OPTIONAL~~ REVERSED IN PROMPT 14, LISTS INCLUDED ────────────────
 * The title is required in both languages, and nothing is copied between them any more —
 * see `project-form.ts`'s header for the argument, which is identical here.
 *
 * The LIST half is the part specific to this file. `fallbackList` used to duplicate an
 * empty Persian `teamFa` / `factsFa` from the English one on save; it is deleted, and
 * `requireTranslatedList` refuses the save instead when one side has rows and the Persian
 * side has none. That keeps the property the fallback was protecting — a Persian page never
 * silently loses a section — and drops the property it was not: a Persian column that looks
 * translated and is not.
 */
import { z } from 'zod';
import type { DesignWorkCreate, DesignWorkRow } from '@/common/schemas/design-work';
import { requiredText, yearFieldAsNumber, yearFieldAsString } from './shared';
import {
  galleryField,
  imagePathField,
  requireAltWithImage,
  requireTranslatedList,
  toGalleryColumns,
  toGalleryFormItems,
  toNullableAlt,
  toNullablePath,
} from './image';

/**
 * ─── THE TAXONOMY FIELDS ARE NOT ENUMS ANY MORE (prompt 9) ────────────────────────
 * Non-empty strings on both schemas below; the closed set is enforced at runtime against
 * `taxonomy_terms` by `unknownTermErrors()` in `services/taxonomy-service.ts`, which the
 * write actions run before they call a service. See `@/common/schemas/enums`'s header.
 * Everything else is exactly as strict as it was, `strictObject` included.
 */

export const DESIGN_WORK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DESIGN_WORK_YEAR_MIN = 1900;
export const DESIGN_WORK_YEAR_MAX = 2200;

const factFormSchema = z.object({ k: z.string(), v: z.string() });

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const designWorkFormSchema = z
  .object({
    slug: z
      .string()
      .min(1, 'A slug is required.')
      .regex(DESIGN_WORK_SLUG_PATTERN, 'Lowercase words separated by single hyphens.'),
    category: z.string().min(1, 'Choose a category.'),
    status: z.string().min(1, 'Choose a status.'),
    year: yearFieldAsString(DESIGN_WORK_YEAR_MIN, DESIGN_WORK_YEAR_MAX),

    titleEn: requiredText('An English title is required.'),
    titleFa: requiredText(
      'A Persian title is required — it is no longer copied from the English one on save.',
    ),
    blurbEn: z.string(),
    blurbFa: z.string(),
    clientEn: z.string(),
    clientFa: z.string(),
    scopeEn: z.string(),
    scopeFa: z.string(),
    materialsEn: z.string(),
    materialsFa: z.string(),
    descriptionEn: z.string(),
    descriptionFa: z.string(),

    teamEn: z.array(z.string()),
    teamFa: z.array(z.string()),
    factsEn: z.array(factFormSchema),
    factsFa: z.array(factFormSchema),

    /** THE PHOTOGRAPHS (prompt 10). `''` is "no cover" and stays a valid record: the card and
     *  the detail page fall back to the drawing seeded from the slug. */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine((values, ctx) => {
    requireAltWithImage(values, ctx);
    requireTranslatedList(values.teamEn, values.teamFa, ctx, 'teamFa', 'team');
    requireTranslatedList(values.factsEn, values.factsFa, ctx, 'factsFa', 'facts');
  });

export type DesignWorkFormValues = z.infer<typeof designWorkFormSchema>;

export const DESIGN_WORK_FORM_FIELDS = [
  'slug',
  'category',
  'status',
  'year',
  'titleEn',
  'titleFa',
  'blurbEn',
  'blurbFa',
  'clientEn',
  'clientFa',
  'scopeEn',
  'scopeFa',
  'materialsEn',
  'materialsFa',
  'descriptionEn',
  'descriptionFa',
  'teamEn',
  'teamFa',
  'factsEn',
  'factsFa',
  'coverImage',
  'coverAltEn',
  'coverAltFa',
  'gallery',
] as const satisfies ReadonlyArray<keyof DesignWorkFormValues>;

export const EMPTY_DESIGN_WORK_FORM: DesignWorkFormValues = {
  slug: '',
  // Empty, not a hardcoded first value — the options are rows now. `DesignWorkForm` fills
  // these from the first available term, and `.min(1)` makes a blank one a validation error.
  category: '',
  status: '',
  year: String(new Date().getFullYear()),
  titleEn: '',
  titleFa: '',
  blurbEn: '',
  blurbFa: '',
  clientEn: '',
  clientFa: '',
  scopeEn: '',
  scopeFa: '',
  materialsEn: '',
  materialsFa: '',
  descriptionEn: '',
  descriptionFa: '',
  teamEn: [],
  teamFa: [],
  factsEn: [],
  factsFa: [],
  coverImage: '',
  coverAltEn: '',
  coverAltFa: '',
  gallery: [],
};

export function toDesignWorkFormValues(row: DesignWorkRow): DesignWorkFormValues {
  return {
    slug: row.slug,
    // Carried through untouched. Substituting a default for a value whose term was retired
    // would silently rewrite a field the editor never opened — see `toProjectFormValues`.
    category: row.category,
    status: row.status,
    year: String(row.year),
    titleEn: row.titleEn,
    titleFa: row.titleFa,
    blurbEn: row.blurbEn,
    blurbFa: row.blurbFa,
    clientEn: row.clientEn,
    clientFa: row.clientFa,
    scopeEn: row.scopeEn,
    scopeFa: row.scopeFa,
    materialsEn: row.materialsEn,
    materialsFa: row.materialsFa,
    descriptionEn: row.descriptionEn,
    descriptionFa: row.descriptionFa,
    teamEn: row.teamEn,
    teamFa: row.teamFa,
    factsEn: row.factsEn,
    factsFa: row.factsFa,
    // `?? ''` — the columns are nullable and a controlled input handed `null` mounts
    // uncontrolled, which is the flip `references/07-forms.md` warns about.
    coverImage: row.coverImage ?? '',
    coverAltEn: row.coverAltEn,
    coverAltFa: row.coverAltFa,
    gallery: toGalleryFormItems(row.galleryEn, row.galleryFa),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const designWorkSubmissionSchema = z
  .strictObject({
    slug: z.string().min(1).regex(DESIGN_WORK_SLUG_PATTERN),
    category: z.string().min(1),
    status: z.string().min(1),
    year: yearFieldAsNumber(DESIGN_WORK_YEAR_MIN, DESIGN_WORK_YEAR_MAX),

    titleEn: requiredText('required'),
    titleFa: requiredText('required'),
    blurbEn: z.string(),
    blurbFa: z.string(),
    clientEn: z.string(),
    clientFa: z.string(),
    scopeEn: z.string(),
    scopeFa: z.string(),
    materialsEn: z.string(),
    materialsFa: z.string(),
    descriptionEn: z.string(),
    descriptionFa: z.string(),

    teamEn: z.array(z.string()),
    teamFa: z.array(z.string()),
    factsEn: z.array(factFormSchema),
    factsFa: z.array(factFormSchema),

    /** THE PHOTOGRAPHS (prompt 10). `''` is "no cover" and stays a valid record: the card and
     *  the detail page fall back to the drawing seeded from the slug. */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine((values, ctx) => {
    requireAltWithImage(values, ctx);
    requireTranslatedList(values.teamEn, values.teamFa, ctx, 'teamFa', 'team');
    requireTranslatedList(values.factsEn, values.factsFa, ctx, 'factsFa', 'facts');
  });

export type DesignWorkSubmission = z.output<typeof designWorkSubmissionSchema>;

/** The parsed submission -> the write payload. Nothing is copied between locales; see
 *  `project-form.ts`'s `toProjectColumns` for why this stopped being `withPersianFallback`. */
export function toDesignWorkColumns(
  input: DesignWorkSubmission,
): Omit<DesignWorkCreate, 'sortOrder'> {
  return {
    slug: input.slug,
    category: input.category,
    status: input.status,
    year: input.year,
    titleEn: input.titleEn,
    titleFa: input.titleFa,
    blurbEn: input.blurbEn,
    blurbFa: input.blurbFa,
    clientEn: input.clientEn,
    clientFa: input.clientFa,
    scopeEn: input.scopeEn,
    scopeFa: input.scopeFa,
    materialsEn: input.materialsEn,
    materialsFa: input.materialsFa,
    descriptionEn: input.descriptionEn,
    descriptionFa: input.descriptionFa,
    teamEn: input.teamEn,
    teamFa: input.teamFa,
    factsEn: input.factsEn,
    factsFa: input.factsFa,

    /** Alt text was the one field that never fell back; since prompt 14 nothing does. */
    coverImage: toNullablePath(input.coverImage),
    coverAltEn: toNullableAlt(input.coverAltEn),
    coverAltFa: toNullableAlt(input.coverAltFa),
    ...toGalleryColumns(input.gallery),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Layout metadata — what the form renders, and how
   ──────────────────────────────────────────────────────────────────────────────── */

export const DESIGN_WORK_LOCALE_FIELDS = [
  { label: 'Title', en: 'titleEn', fa: 'titleFa', multiline: false, required: true },
  { label: 'Blurb', en: 'blurbEn', fa: 'blurbFa', multiline: true, rows: 3 },
  { label: 'Client', en: 'clientEn', fa: 'clientFa', multiline: false },
  { label: 'Scope', en: 'scopeEn', fa: 'scopeFa', multiline: true, rows: 3 },
  { label: 'Materials', en: 'materialsEn', fa: 'materialsFa', multiline: true, rows: 2 },
  { label: 'Description', en: 'descriptionEn', fa: 'descriptionFa', multiline: true, rows: 8 },
] as const satisfies ReadonlyArray<{
  label: string;
  en: keyof DesignWorkFormValues;
  fa: keyof DesignWorkFormValues;
  multiline: boolean;
  rows?: number;
  required?: boolean;
}>;
