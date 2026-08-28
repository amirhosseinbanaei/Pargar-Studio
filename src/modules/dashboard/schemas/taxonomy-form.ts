// src/modules/dashboard/schemas/taxonomy-form.ts
/**
 * The term editor's contract. Same two-schema shape as every other editor here: a form
 * schema carrying user-facing copy for `zodResolver`, and a submission schema carrying none
 * for the Server Action, which is a public HTTP endpoint and cannot trust the form.
 *
 * ─── `value` IS ON THE CREATE SCHEMA AND ON NO OTHER ──────────────────────────────
 * The resolved open decision (AGENTS.md): a term's wire value is IMMUTABLE. It is the string
 * every content row stores, and renaming it would have to rewrite each of those rows inside
 * the same transaction — a partial rename is data corruption behind a green toast, and the
 * failure is invisible because both halves keep rendering. The labels carry any change an
 * editor wants to make, which is what they are for.
 *
 * So the update schema below is labels only, and the absence of `value` from it is the
 * enforcement, not a comment.
 *
 * ─── WHY BOTH LABELS ARE REQUIRED HERE, UNLIKE EVERY OTHER PERSIAN FIELD ──────────
 * Persian is optional on every content form: an empty `_fa` column is filled with its
 * English counterpart before the write (`withPersianFallback`), so a studio is never blocked
 * from publishing by a missing translation. A term is one word, entered once, and it is the
 * thing every Persian rail on the site renders — so the same fallback would quietly put an
 * English word on the Persian page for as long as nobody noticed. `.min(1)` on both makes
 * that a decision rather than an accident. It is two words, at the moment the term is
 * created, and never again.
 */
import { z } from 'zod';
import {
  taxonomyAxisEnum,
  taxonomySubjectEnum,
  type TaxonomyTermRow,
} from '@/common/schemas/taxonomy';

/**
 * The wire value a content row stores.
 *
 * NOT slug-shaped, deliberately: the archive's values are `'Interior Design'` and
 * `'Under Construction'` — capitalized English with spaces — because that is what 76 rows
 * already hold and what the message catalog's fallback keys are spelled as. A slug rule here
 * would make every existing term unrepresentable.
 *
 * Trimmed, because a trailing space produces a value that looks identical to an existing one
 * in every list and matches nothing at all.
 */
const termValue = z
  .string()
  .trim()
  .min(1, 'A value is required.')
  .max(64, 'Keep a value under 64 characters.');

/* ────────────────────────────────────────────────────────────────────────────────
   Create — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const taxonomyTermCreateFormSchema = z.object({
  value: termValue,
  labelEn: z.string().min(1, 'An English label is required.'),
  labelFa: z.string().min(1, 'A Persian label is required.'),
});

export type TaxonomyTermCreateFormValues = z.infer<typeof taxonomyTermCreateFormSchema>;

export const TAXONOMY_CREATE_FIELDS = [
  'value',
  'labelEn',
  'labelFa',
] as const satisfies ReadonlyArray<keyof TaxonomyTermCreateFormValues>;

export const EMPTY_TAXONOMY_TERM: TaxonomyTermCreateFormValues = {
  value: '',
  labelEn: '',
  labelFa: '',
};

/* ────────────────────────────────────────────────────────────────────────────────
   Edit — labels only
   ──────────────────────────────────────────────────────────────────────────────── */

export const taxonomyTermEditFormSchema = taxonomyTermCreateFormSchema.omit({ value: true });

export type TaxonomyTermEditFormValues = z.infer<typeof taxonomyTermEditFormSchema>;

/**
 * The label pair both forms share, as its own type.
 *
 * It exists so the editor's shared label inputs can be typed against exactly what they bind
 * — a generic over the union of the two form types would need a cast at every `name`, and a
 * cast there would hide the day one of the two stopped carrying these fields.
 */
export type TaxonomyLabelValues = TaxonomyTermEditFormValues;

export const TAXONOMY_EDIT_FIELDS = ['labelEn', 'labelFa'] as const satisfies ReadonlyArray<
  keyof TaxonomyTermEditFormValues
>;

export function toTaxonomyTermEditValues(term: TaxonomyTermRow): TaxonomyTermEditFormValues {
  return { labelEn: term.labelEn, labelFa: term.labelFa };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schemas — carry no copy
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * `strictObject` throughout, so an unexpected key is refused rather than tolerated. On this
 * endpoint in particular: `sortOrder` and `visible` are owned by the reorder arrows and the
 * toggle, each of which has its own action, and a create that accepted either would let one
 * crafted POST insert a term already at the head of the list and already hidden.
 */
export const taxonomyTermCreateSubmissionSchema = z.strictObject({
  subject: taxonomySubjectEnum,
  axis: taxonomyAxisEnum,
  value: termValue,
  labelEn: z.string().min(1),
  labelFa: z.string().min(1),
});

export type TaxonomyTermCreateSubmission = z.output<typeof taxonomyTermCreateSubmissionSchema>;

export const taxonomyTermUpdateSubmissionSchema = z.strictObject({
  id: z.number().int().positive(),
  labelEn: z.string().min(1),
  labelFa: z.string().min(1),
});

export const taxonomyTermVisibilitySubmissionSchema = z.strictObject({
  id: z.number().int().positive(),
  visible: z.boolean(),
});

export const taxonomyTermMoveSubmissionSchema = z.strictObject({
  id: z.number().int().positive(),
  direction: z.enum(['up', 'down']),
});
