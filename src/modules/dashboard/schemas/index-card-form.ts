// src/modules/dashboard/schemas/index-card-form.ts
/**
 * The index-card editor's contract — five records, each edited on its own, and the second
 * area in this module with no create and no delete.
 *
 * ─── FIVE SINGLETONS, NOT A COLLECTION ────────────────────────────────────────────
 * `studio` and `contact` are singletons because there is one row; these five are singletons
 * because there are exactly five and their identity is `NAV`, a constant. So there is no
 * `indexCardCreateSchema` and no delete, for the reason `studio-form.ts` gives: offering a
 * create path risks writing a row for a section that does not exist, and the five rows the
 * migration inserts are the whole set for the life of the site.
 *
 * `sectionId` IS in the submission schema and is not a form field. It names the RECORD, not
 * the caller, which `references/04-actions-and-mutations.md` allows explicitly — and it is
 * validated against `NAV` here as well as on the route, because a Server Action is a public
 * endpoint and the route's `notFound()` proves nothing about a hand-written POST.
 *
 * ─── THE ALT RULE IS IMPORTED, NOT RESTATED ───────────────────────────────────────
 * `requireAltWithImage` from `./image` — the same `superRefine` the four prompt-10 editors
 * compose, on both the form schema and the submission schema. It is not spelled out again
 * here for the reason that file's header gives: a rule written five times is a rule that
 * gets relaxed in one of them.
 */
import { z } from 'zod';
import { isNavSectionId } from '@/common/constants/site';
import type { IndexCardRow, IndexCardUpdate } from '@/common/schemas/index-card';
import { imagePathField, requireAltWithImage, toNullableAlt, toNullablePath } from './image';

/**
 * THE PERSIAN HALF OF A TRANSLATED PAIR, IN ONE PLACE — deliberately, so that prompt 14's
 * change to what "required" means for Persian is this line and not four of them.
 *
 * Today it accepts anything, including `''`, which is what makes an untranslated card
 * degrade to the message catalog instead of blocking the save. Making Persian required is
 * `z.string().min(1, '…')` here and nowhere else.
 */
const persianField = z.string();

/**
 * The one required field on the whole form.
 *
 * ─── TITLE REQUIRED, CAPTION OPTIONAL — AND WHAT THAT COSTS ───────────────────────
 * Taken as recommended (AGENTS.md). Both still fall back to the catalog when empty, so the
 * front page cannot break either way; the requirement is about the EDITOR rather than the
 * renderer — somebody who opens a card to name it should not be able to save it nameless
 * by accident.
 *
 * The consequence, stated rather than discovered later: once a title is saved it cannot be
 * cleared from this form, so the `nav.<id>` fallback is reachable only for a card nobody
 * has edited. Reverting a card to the catalog wording means retyping it. If that turns out
 * to matter, the fix is dropping `.min(1)` from this one field.
 */
const requiredTitle = z.string().min(1, 'A title, or leave the whole card unedited.');

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const indexCardFormSchema = z
  .object({
    titleEn: requiredTitle,
    titleFa: persianField,
    captionEn: z.string(),
    captionFa: persianField,
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
  })
  .superRefine((values, ctx) => requireAltWithImage(values, ctx, 'picture'));

export type IndexCardFormValues = z.infer<typeof indexCardFormSchema>;

export const INDEX_CARD_FORM_FIELDS = [
  'titleEn',
  'titleFa',
  'captionEn',
  'captionFa',
  'coverImage',
  'coverAltEn',
  'coverAltFa',
] as const satisfies ReadonlyArray<keyof IndexCardFormValues>;

/** Both halves of every translated pair, so neither can be added without the other. */
export const INDEX_CARD_LOCALE_FIELDS = [
  { en: 'titleEn', fa: 'titleFa' },
  { en: 'captionEn', fa: 'captionFa' },
  { en: 'coverAltEn', fa: 'coverAltFa' },
] as const satisfies ReadonlyArray<{
  en: keyof IndexCardFormValues;
  fa: keyof IndexCardFormValues;
}>;

/** A card with no row yet — the editor still gets a complete, controlled form. */
export const EMPTY_INDEX_CARD_FORM: IndexCardFormValues = {
  titleEn: '',
  titleFa: '',
  captionEn: '',
  captionFa: '',
  coverImage: '',
  coverAltEn: '',
  coverAltFa: '',
};

export function toIndexCardFormValues(row: IndexCardRow | null): IndexCardFormValues {
  if (!row) return { ...EMPTY_INDEX_CARD_FORM };
  return {
    titleEn: row.titleEn,
    titleFa: row.titleFa,
    captionEn: row.captionEn,
    captionFa: row.captionFa,
    // `null` -> `''`: the form holds a path as a string, and a controlled input handed
    // `null` mounts uncontrolled — the flip `references/07-forms.md` warns about.
    coverImage: row.coverImage ?? '',
    coverAltEn: row.coverAltEn,
    coverAltFa: row.coverAltFa,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const indexCardSubmissionSchema = z
  .strictObject({
    /** One of the five NAV ids. See the header for why this is checked here too. */
    sectionId: z.string().refine(isNavSectionId, 'Not one of the five sections.'),
    titleEn: requiredTitle,
    titleFa: persianField,
    captionEn: z.string(),
    captionFa: persianField,
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
  })
  .superRefine((values, ctx) => requireAltWithImage(values, ctx, 'picture'));

export type IndexCardSubmission = z.output<typeof indexCardSubmissionSchema>;

/**
 * Form values -> columns.
 *
 * ─── THE PERSIAN HALF IS NOT FILLED IN FROM THE ENGLISH, AND THAT IS THE POINT ────
 * Every other editor in this module runs `withPersianFallback` and writes the English
 * value into an empty `_fa` column (AGENTS.md, prompt 6). This one deliberately does not,
 * and it is the only place in the codebase where NOT falling back is the better answer for
 * prose:
 *
 *   The fallback exists because a blank Persian page is worse than an untranslated one.
 *   Here there is no blank to avoid — an empty Persian title renders `nav.<id>` from the
 *   message catalog, which is REAL, authored Persian. Copying the English word in would
 *   replace good Persian with English and, worse, populate the column so nothing could
 *   tell afterwards that the translation was never written.
 *
 * So the degradation still happens at read time for these five, because for these five a
 * better fallback than English already exists. The alt text is not copied either, for the
 * reason `./image`'s header gives — that one is about being HEARD and applies everywhere.
 */
export function toIndexCardColumns(input: IndexCardSubmission): IndexCardUpdate {
  return {
    titleEn: input.titleEn,
    titleFa: input.titleFa,
    captionEn: input.captionEn,
    captionFa: input.captionFa,
    coverImage: toNullablePath(input.coverImage),
    coverAltEn: toNullableAlt(input.coverAltEn),
    coverAltFa: toNullableAlt(input.coverAltFa),
  };
}
