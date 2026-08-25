// src/modules/dashboard/schemas/project-form.ts
/**
 * The project editor's contract: what the browser types against, what the action
 * re-validates, and the mapping between a database row and a set of form values.
 *
 * ─── TWO SCHEMAS, ONE SET OF BOUNDS ───────────────────────────────────────────────
 * `projectFormSchema` carries user-facing copy and is what `zodResolver` runs per
 * keystroke. `projectSubmissionSchema` carries none and is what the Server Action parses,
 * because the action is a public HTTP endpoint and the form's validation proves nothing
 * about a hand-written POST.
 *
 * Every bound they share is imported from `@/common/schemas/project`, so neither can drift
 * from the other or from the exact write schema underneath both. `__tests__/agreement.test.ts`
 * asserts they judge the same payloads the same way — prompt 5 shipped this exact bug once
 * (a `min(10)` form in front of a `min(1)` action) and it cost a message the form had
 * already refused.
 *
 * ─── THE OPEN DECISION, RESOLVED: PERSIAN IS OPTIONAL ─────────────────────────────
 * Only `titleEn` is required. Every `*Fa` field may be left empty and every English field
 * other than the title may too. The action fills an empty Persian field with its English
 * counterpart before writing, which is exactly what `scripts/seed.ts` already does for a
 * missing translation and what `legacy/js/core/i18n.js:154` did before it.
 *
 * The alternative — requiring both — would block the studio from publishing a new project
 * until someone had translated it, which turns a content decision into a deployment
 * blocker. And because the fallback is written IN, at author time, the read path still
 * needs no fallback branch: `pickLocale` stays a two-line function and `/fa/projects/x`
 * never renders blank. Recorded in AGENTS.md.
 *
 * ─── WHY `sortOrder` IS ABSENT ────────────────────────────────────────────────────
 * Position is not a field anyone types. It is owned by the reorder control on the list
 * screen, and `createProject` places a new record first. A number input for it would let
 * one editor's save silently displace another project.
 */
import { z } from 'zod';
import {
  projectScaleEnum,
  projectScaleValues,
  projectStatusEnum,
  projectStatusValues,
  projectTypeEnum,
  projectTypeValues,
} from '@/common/schemas/enums';
import {
  PROJECT_SLUG_PATTERN,
  PROJECT_YEAR_MAX,
  PROJECT_YEAR_MIN,
  type ProjectCreate,
  type ProjectRow,
} from '@/common/schemas/project';

/* ────────────────────────────────────────────────────────────────────────────────
   The year field
   ──────────────────────────────────────────────────────────────────────────────── */

const YEAR_RANGE_MESSAGE = `A four-digit year between ${PROJECT_YEAR_MIN} and ${PROJECT_YEAR_MAX}.`;

/**
 * `<input type="number">` hands react-hook-form a STRING, and the form schema keeps it one.
 *
 * THE FORM SCHEMA DOES NOT TRANSFORM, and that is deliberate. A zod transform makes a
 * schema's input type differ from its output type, which forces every layer above it —
 * `defaultValues`, the controlled input, `handleSubmit`'s callback, the generic form
 * scaffold — to thread two type parameters instead of one, for the sake of a `Number()`
 * call. Validation belongs where the value lives: the browser holds a string, so the form
 * schema validates a string, and `projectSubmissionSchema` converts on arrival because the
 * DATABASE holds a number.
 *
 * Neither side may use `z.coerce.number()` to do that conversion. It turns `''`, `null`,
 * `false` and `[]` all into `0`, so a cleared year field becomes the year 0, fails the range
 * check, and reports "must be at least 1900" for a field that was simply left blank — the
 * wrong sentence for the wrong reason. The explicit union rejects those instead, which is
 * the rule `common/schemas/helpers.ts`'s `numberFromString` encodes and the reason that
 * helper exists.
 */
const yearAsString = z
  .string()
  .regex(/^\d{4}$/, YEAR_RANGE_MESSAGE)
  .refine(value => {
    const year = Number(value);
    return year >= PROJECT_YEAR_MIN && year <= PROJECT_YEAR_MAX;
  }, YEAR_RANGE_MESSAGE);

/** The submission side: accept the string the form sends OR a number, and store a number. */
const yearAsNumber = z
  .union([z.number(), z.string().regex(/^\d+$/, 'expected a year')])
  .transform(Number)
  .pipe(z.number().int().min(PROJECT_YEAR_MIN).max(PROJECT_YEAR_MAX));

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const projectFormSchema = z.object({
  slug: z
    .string()
    .min(1, 'A slug is required.')
    .regex(
      PROJECT_SLUG_PATTERN,
      'Lowercase words separated by single hyphens — qeytarieh-08-residence.',
    ),
  types: z.array(projectTypeEnum).min(1, 'Choose at least one type.'),
  status: projectStatusEnum,
  scale: projectScaleEnum,
  year: yearAsString,
  area: z.string(),

  // English title is the only required piece of content — see the header.
  titleEn: z.string().min(1, 'An English title is required.'),
  titleFa: z.string(),
  blurbEn: z.string(),
  blurbFa: z.string(),
  descriptionEn: z.string(),
  descriptionFa: z.string(),
  locationEn: z.string(),
  locationFa: z.string(),
  clientEn: z.string(),
  clientFa: z.string(),
});

/**
 * Input and output are the SAME type, because nothing in `projectFormSchema` transforms —
 * see `yearAsString`. That is what lets the generic form scaffold carry one type parameter
 * instead of two.
 */
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/** The fields this form renders — the allow-list `applyFieldErrors` binds against. */
export const PROJECT_FORM_FIELDS = [
  'slug',
  'types',
  'status',
  'scale',
  'year',
  'area',
  'titleEn',
  'titleFa',
  'blurbEn',
  'blurbFa',
  'descriptionEn',
  'descriptionFa',
  'locationEn',
  'locationFa',
  'clientEn',
  'clientFa',
] as const satisfies ReadonlyArray<keyof ProjectFormValues>;

/**
 * Every field present and non-`undefined`. Mandatory, not tidiness: a field that starts
 * `undefined` mounts uncontrolled and flips controlled on the first `reset()`, which React
 * warns about and which leaves selects stuck on their placeholder. It is also what makes
 * `isDirty` mean anything — the flag compares against these.
 */
export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  slug: '',
  types: [],
  status: projectStatusValues[0],
  scale: projectScaleValues[1],
  year: String(new Date().getFullYear()),
  area: '',
  titleEn: '',
  titleFa: '',
  blurbEn: '',
  blurbFa: '',
  descriptionEn: '',
  descriptionFa: '',
  locationEn: '',
  locationFa: '',
  clientEn: '',
  clientFa: '',
};

/**
 * A stored row -> the values the edit form mounts with.
 *
 * `types` is widened from the row's tolerant `string[]` back to the enum. The read schema
 * types it loosely on purpose (`common/schemas/enums.ts`: a row carrying an unlisted value
 * must not throw a `ZodError` that blanks the index page), but this form's checkbox group
 * only renders the known values — so an unknown one is dropped here rather than silently
 * re-submitted through a control that never displayed it.
 */
export function toProjectFormValues(row: ProjectRow): ProjectFormValues {
  const known = new Set<string>(projectTypeValues);
  return {
    slug: row.slug,
    types: row.types.filter((type): type is (typeof projectTypeValues)[number] => known.has(type)),
    status: projectStatusEnum.safeParse(row.status).data ?? projectStatusValues[0],
    scale: projectScaleEnum.safeParse(row.scale).data ?? projectScaleValues[1],
    year: String(row.year),
    area: row.area,
    titleEn: row.titleEn,
    titleFa: row.titleFa,
    blurbEn: row.blurbEn,
    blurbFa: row.blurbFa,
    descriptionEn: row.descriptionEn,
    descriptionFa: row.descriptionFa,
    locationEn: row.locationEn,
    locationFa: row.locationFa,
    clientEn: row.clientEn,
    clientFa: row.clientFa,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * What every project write action parses. `strictObject`, so an unexpected key is refused
 * rather than tolerated — a write body that carries `sortOrder` or `id` is either tampering
 * or a mass-assignment attempt, and neither is an additive release.
 *
 * The messages inside are zod's own defaults, in English, and they are not shown to anyone:
 * the dashboard's interface language is English (AGENTS.md), so a 422 that reaches the form
 * is bound onto the field by NAME through `applyFieldErrors`, exactly as the public contact
 * form does. What matters at this boundary is which key failed, not what the sentence says.
 */
export const projectSubmissionSchema = z.strictObject({
  slug: z.string().min(1).regex(PROJECT_SLUG_PATTERN),
  types: z.array(projectTypeEnum).min(1),
  status: projectStatusEnum,
  scale: projectScaleEnum,
  year: yearAsNumber,
  area: z.string(),

  titleEn: z.string().min(1),
  titleFa: z.string(),
  blurbEn: z.string(),
  blurbFa: z.string(),
  descriptionEn: z.string(),
  descriptionFa: z.string(),
  locationEn: z.string(),
  locationFa: z.string(),
  clientEn: z.string(),
  clientFa: z.string(),
});

export type ProjectSubmission = z.output<typeof projectSubmissionSchema>;

/**
 * Fill an empty Persian column with its English counterpart, and return the exact write
 * payload the service takes.
 *
 * THIS IS WHERE THE "PERSIAN IS OPTIONAL" DECISION IS ACTUALLY IMPLEMENTED. The form lets
 * the field be blank; this function makes sure a blank one never reaches the database,
 * because the read path deliberately has no fallback (`pickLocale`) and a null Persian
 * column would render `/fa/projects/<slug>` with holes in it.
 *
 * `.trim()` on the test, not on the stored value: a field holding only whitespace is
 * "empty" as far as this decision is concerned, but a Persian string's own leading and
 * trailing characters are the editor's business — several of the seeded values carry
 * meaningful zero-width non-joiners (AGENTS.md), and trimming stored content is how those
 * get quietly damaged.
 *
 * The return type is checked by the compiler against the exact write schema's inferred
 * type, so a field added to `projectCreateSchema` and forgotten here is a build error
 * rather than a column that silently stays at its default.
 */
export function withPersianFallback(input: ProjectSubmission): Omit<ProjectCreate, 'sortOrder'> {
  const fallback = (fa: string, en: string) => (fa.trim() === '' ? en : fa);
  return {
    slug: input.slug,
    types: input.types,
    status: input.status,
    scale: input.scale,
    year: input.year,
    area: input.area,
    titleEn: input.titleEn,
    titleFa: fallback(input.titleFa, input.titleEn),
    blurbEn: input.blurbEn,
    blurbFa: fallback(input.blurbFa, input.blurbEn),
    descriptionEn: input.descriptionEn,
    descriptionFa: fallback(input.descriptionFa, input.descriptionEn),
    locationEn: input.locationEn,
    locationFa: fallback(input.locationFa, input.locationEn),
    clientEn: input.clientEn,
    clientFa: fallback(input.clientFa, input.clientEn),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Layout metadata — what the form renders, and how
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The five translated fields, as English/Persian PAIRS.
 *
 * Driving the form from this list rather than writing ten inputs by hand is what makes the
 * side-by-side layout a property of the data model instead of a template that has to be
 * remembered. Add a translated column to `projects` and it appears in the editor by adding
 * one entry here — and it is impossible to add the English half and forget the Persian one,
 * which is the mistake the pair-shaped type prevents.
 *
 * `multiline` chooses a textarea over an input. `rows` differ because a description is
 * paragraphs and a blurb is a sentence.
 */
export const PROJECT_LOCALE_FIELDS = [
  { label: 'Title', en: 'titleEn', fa: 'titleFa', multiline: false, required: true },
  { label: 'Blurb', en: 'blurbEn', fa: 'blurbFa', multiline: true, rows: 3 },
  { label: 'Description', en: 'descriptionEn', fa: 'descriptionFa', multiline: true, rows: 8 },
  { label: 'Location', en: 'locationEn', fa: 'locationFa', multiline: false },
  { label: 'Client', en: 'clientEn', fa: 'clientFa', multiline: false },
] as const satisfies ReadonlyArray<{
  label: string;
  en: keyof ProjectFormValues;
  fa: keyof ProjectFormValues;
  multiline: boolean;
  rows?: number;
  required?: boolean;
}>;
