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
 * ─── ~~PERSIAN IS OPTIONAL~~ REVERSED IN PROMPT 14: REQUIRED MEANS BOTH ───────────
 * The title is required, and it is required in ENGLISH AND IN PERSIAN. Every other field
 * on this form is optional on both sides, exactly as before.
 *
 * What is gone is `withPersianFallback`, which used to write the English value into an
 * empty `_fa` column on the way to the database. Prompt 6 took that trade because
 * requiring both would "block the studio from publishing until somebody had translated
 * it" — a real cost, and the wrong answer to it. Refusing the SAVE achieves the same
 * protection without the damage: the editor is told at the field, before anything is
 * stored, instead of ending up with a Persian column holding English that nothing
 * afterwards can distinguish from a translation.
 *
 * The read path is unaffected and still needs no fallback branch — `pickLocale` stays two
 * lines — because a required column can no longer be empty. Every row already in the
 * database was written by the old path and therefore has both columns populated
 * (verified per table before this shipped; see AGENTS.md).
 *
 * ─── THE TAXONOMY FIELDS ARE NOT ENUMS ANY MORE (prompt 9) ────────────────────────
 * `types`, `status` and `scale` were `z.enum(...)` on both schemas below, which is what made
 * a category a code edit and a deploy. They are non-empty STRINGS here now, and the closed
 * set is enforced at runtime against `taxonomy_terms` by `unknownTermErrors()` in
 * `services/taxonomy-service.ts`, which the actions run before they call a service — see
 * `@/common/schemas/enums`'s header for why a compile-time enum became the wrong check.
 *
 * Everything else about the submission schema is EXACTLY as strict: still `strictObject`, so
 * an unexpected key is still refused, and `.min(1)` still refuses an empty string, so the
 * runtime check is never handed a blank to look up.
 *
 * ─── WHY `sortOrder` IS ABSENT ────────────────────────────────────────────────────
 * Position is not a field anyone types. It is owned by the reorder control on the list
 * screen, and `createProject` places a new record first. A number input for it would let
 * one editor's save silently displace another project.
 */
import { z } from 'zod';
import {
  PROJECT_SLUG_PATTERN,
  PROJECT_YEAR_MAX,
  PROJECT_YEAR_MIN,
  type ProjectCreate,
  type ProjectRow,
} from '@/common/schemas/project';
import {
  galleryField,
  imagePathField,
  requireAltWithImage,
  toGalleryColumns,
  toGalleryFormItems,
  toNullableAlt,
  toNullablePath,
} from './image';
import { requiredText } from './shared';

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

/**
 * `.superRefine` rather than `.refine`, because the rule raises SEVERAL issues on SEVERAL
 * fields — an image with neither description named is two errors on two boxes, not one
 * message at the top of the form. See `./image`.
 */
export const projectFormSchema = z
  .object({
    slug: z
      .string()
      .min(1, 'A slug is required.')
      .regex(
        PROJECT_SLUG_PATTERN,
        'Lowercase words separated by single hyphens — qeytarieh-08-residence.',
      ),
    types: z.array(z.string().min(1)).min(1, 'Choose at least one type.'),
    status: z.string().min(1, 'Choose a status.'),
    scale: z.string().min(1, 'Choose a scale.'),
    year: yearAsString,
    area: z.string(),

    // The title is the only required piece of content — and since prompt 14 it is
    // required in BOTH languages. See the header.
    titleEn: requiredText('An English title is required.'),
    titleFa: requiredText(
      'A Persian title is required — it is no longer copied from the English one on save.',
    ),
    blurbEn: z.string(),
    blurbFa: z.string(),
    descriptionEn: z.string(),
    descriptionFa: z.string(),
    locationEn: z.string(),
    locationFa: z.string(),
    clientEn: z.string(),
    clientFa: z.string(),

    /**
     * THE PHOTOGRAPHS (prompt 10). `''` is "no cover", which is the state of the whole
     * archive today and stays a valid record — the card and the detail page fall back to the
     * generated drawing.
     */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine(requireAltWithImage);

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
  'coverImage',
  'coverAltEn',
  'coverAltFa',
  'gallery',
] as const satisfies ReadonlyArray<keyof ProjectFormValues>;

/**
 * Every field present and non-`undefined`. Mandatory, not tidiness: a field that starts
 * `undefined` mounts uncontrolled and flips controlled on the first `reset()`, which React
 * warns about and which leaves selects stuck on their placeholder. It is also what makes
 * `isDirty` mean anything — the flag compares against these.
 *
 * The taxonomy fields start EMPTY rather than at a hardcoded first value, because there is
 * no longer a hardcoded list to take one from — the options are rows now, and which one
 * should lead is an editorial choice expressed by the term order. `ProjectForm` fills these
 * from the first available term before it mounts; `''` is what a select renders as its
 * placeholder, and `.min(1)` above is what makes leaving it there a validation error rather
 * than a blank column.
 */
export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  slug: '',
  types: [],
  status: '',
  scale: '',
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
  coverImage: '',
  coverAltEn: '',
  coverAltFa: '',
  gallery: [],
};

/**
 * A stored row -> the values the edit form mounts with.
 *
 * THE ROW'S TAXONOMY VALUES ARE CARRIED THROUGH UNTOUCHED, and that is a change from prompt
 * 6, which filtered `types` against the frozen array and substituted a default for an
 * unrecognized `status` or `scale`. Both were silent rewrites: opening a project and saving
 * it — without touching a taxonomy field — could change what it said. With terms editable
 * that is no longer a rare edge case, it is what happens to every record using a term
 * somebody retired.
 *
 * `ProjectForm` merges these values into its option lists (`withCurrentValues`), so a value
 * with no term is DISPLAYED and preserved rather than dropped through a control that never
 * rendered it.
 */
export function toProjectFormValues(row: ProjectRow): ProjectFormValues {
  return {
    slug: row.slug,
    types: row.types,
    status: row.status,
    scale: row.scale,
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
    // `?? ''` on every one: the columns are nullable and a controlled input handed `null`
    // mounts uncontrolled, which is the flip `references/07-forms.md` warns about.
    coverImage: row.coverImage ?? '',
    coverAltEn: row.coverAltEn,
    coverAltFa: row.coverAltFa,
    gallery: toGalleryFormItems(row.galleryEn, row.galleryFa),
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
export const projectSubmissionSchema = z
  .strictObject({
    slug: z.string().min(1).regex(PROJECT_SLUG_PATTERN),
    types: z.array(z.string().min(1)).min(1),
    status: z.string().min(1),
    scale: z.string().min(1),
    year: yearAsNumber,
    area: z.string(),

    titleEn: requiredText('required'),
    titleFa: requiredText('required'),
    blurbEn: z.string(),
    blurbFa: z.string(),
    descriptionEn: z.string(),
    descriptionFa: z.string(),
    locationEn: z.string(),
    locationFa: z.string(),
    clientEn: z.string(),
    clientFa: z.string(),

    /** Same three plus the list. The alt rule below is the same one the form applies. */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine(requireAltWithImage);

export type ProjectSubmission = z.output<typeof projectSubmissionSchema>;

/**
 * The parsed submission -> the exact write payload the service takes.
 *
 * ─── IT WAS `withPersianFallback`, AND IT NO LONGER FALLS BACK ────────────────────
 * Renamed in prompt 14 along with the behaviour: a function called `withPersianFallback`
 * that applies no fallback is the kind of name that survives three prompts and misleads
 * every reader of them. Every value now goes to its own column unchanged, and NOTHING is
 * copied between locales — the schema above refuses an empty required Persian field
 * instead, at the field, before anything is stored.
 *
 * Values are still never trimmed on the way to the database. Several seeded Persian values
 * carry meaningful zero-width non-joiners (AGENTS.md); the `.trim()` that survives lives in
 * the emptiness TESTS in `./image`, never on a stored value.
 *
 * The return type is checked by the compiler against the exact write schema's inferred
 * type, so a field added to `projectCreateSchema` and forgotten here is a build error
 * rather than a column that silently stays at its default.
 */
export function toProjectColumns(input: ProjectSubmission): Omit<ProjectCreate, 'sortOrder'> {
  return {
    slug: input.slug,
    types: input.types,
    status: input.status,
    scale: input.scale,
    year: input.year,
    area: input.area,
    titleEn: input.titleEn,
    titleFa: input.titleFa,
    blurbEn: input.blurbEn,
    blurbFa: input.blurbFa,
    descriptionEn: input.descriptionEn,
    descriptionFa: input.descriptionFa,
    locationEn: input.locationEn,
    locationFa: input.locationFa,
    clientEn: input.clientEn,
    clientFa: input.clientFa,

    /**
     * Alt text was the ONE field that never fell back; since prompt 14 nothing does. The
     * argument that made it special — a populated column is indistinguishable from a
     * translated one — turned out to be the general argument. See `./image`'s header.
     */
    coverImage: toNullablePath(input.coverImage),
    coverAltEn: toNullableAlt(input.coverAltEn),
    coverAltFa: toNullableAlt(input.coverAltFa),
    ...toGalleryColumns(input.gallery),
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
