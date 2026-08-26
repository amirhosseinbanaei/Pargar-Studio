// src/modules/dashboard/schemas/design-work-form.ts
/**
 * The design-work editor's contract. Same two-schema shape as `project-form.ts` — a form
 * schema carrying copy, a submission schema that does not — for the same reason: the form
 * validates a keystroke ago with a localized schema, and that proves nothing to an action
 * reachable directly over HTTP.
 *
 * ─── PERSIAN IS OPTIONAL, GENERALIZED TO ARRAYS ───────────────────────────────────
 * Only `titleEn` is required, exactly as prompt 6 decided for projects (AGENTS.md). Every
 * other English field and every Persian field may be left empty; `withPersianFallback`
 * fills an empty Persian TEXT column with its English counterpart, and — new here — an
 * empty Persian LIST (`teamFa`, `factsFa`) with the English list wholesale. A studio
 * publishing a new object should not be blocked on translating its team or its fact table
 * before the record can be saved at all.
 */
import { z } from 'zod';
import {
  designCategoryEnum,
  designCategoryValues,
  designStatusEnum,
  designStatusValues,
} from '@/common/schemas/enums';
import type { DesignWorkCreate, DesignWorkRow } from '@/common/schemas/design-work';
import { fallbackList, fallbackText, yearFieldAsNumber, yearFieldAsString } from './shared';

export const DESIGN_WORK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DESIGN_WORK_YEAR_MIN = 1900;
export const DESIGN_WORK_YEAR_MAX = 2200;

const factFormSchema = z.object({ k: z.string(), v: z.string() });

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const designWorkFormSchema = z.object({
  slug: z
    .string()
    .min(1, 'A slug is required.')
    .regex(DESIGN_WORK_SLUG_PATTERN, 'Lowercase words separated by single hyphens.'),
  category: designCategoryEnum,
  status: designStatusEnum,
  year: yearFieldAsString(DESIGN_WORK_YEAR_MIN, DESIGN_WORK_YEAR_MAX),

  titleEn: z.string().min(1, 'An English title is required.'),
  titleFa: z.string(),
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
] as const satisfies ReadonlyArray<keyof DesignWorkFormValues>;

export const EMPTY_DESIGN_WORK_FORM: DesignWorkFormValues = {
  slug: '',
  category: designCategoryValues[0],
  status: designStatusValues[0],
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
};

export function toDesignWorkFormValues(row: DesignWorkRow): DesignWorkFormValues {
  return {
    slug: row.slug,
    category: designCategoryEnum.safeParse(row.category).data ?? designCategoryValues[0],
    status: designStatusEnum.safeParse(row.status).data ?? designStatusValues[0],
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
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const designWorkSubmissionSchema = z.strictObject({
  slug: z.string().min(1).regex(DESIGN_WORK_SLUG_PATTERN),
  category: designCategoryEnum,
  status: designStatusEnum,
  year: yearFieldAsNumber(DESIGN_WORK_YEAR_MIN, DESIGN_WORK_YEAR_MAX),

  titleEn: z.string().min(1),
  titleFa: z.string(),
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
});

export type DesignWorkSubmission = z.output<typeof designWorkSubmissionSchema>;

export function withPersianFallback(
  input: DesignWorkSubmission,
): Omit<DesignWorkCreate, 'sortOrder'> {
  return {
    slug: input.slug,
    category: input.category,
    status: input.status,
    year: input.year,
    titleEn: input.titleEn,
    titleFa: fallbackText(input.titleFa, input.titleEn),
    blurbEn: input.blurbEn,
    blurbFa: fallbackText(input.blurbFa, input.blurbEn),
    clientEn: input.clientEn,
    clientFa: fallbackText(input.clientFa, input.clientEn),
    scopeEn: input.scopeEn,
    scopeFa: fallbackText(input.scopeFa, input.scopeEn),
    materialsEn: input.materialsEn,
    materialsFa: fallbackText(input.materialsFa, input.materialsEn),
    descriptionEn: input.descriptionEn,
    descriptionFa: fallbackText(input.descriptionFa, input.descriptionEn),
    teamEn: input.teamEn,
    teamFa: fallbackList(input.teamFa, input.teamEn),
    factsEn: input.factsEn,
    factsFa: fallbackList(input.factsFa, input.factsEn),
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
