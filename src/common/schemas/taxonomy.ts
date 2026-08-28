// src/common/schemas/taxonomy.ts
/**
 * The contract for `taxonomy_terms` — the table that made every closed axis editable.
 *
 * ─── WHAT IS STILL A CONSTANT HERE, AND WHY ───────────────────────────────────────
 * `subject` and `axis` are `z.enum`s and stay that way. They are not taxonomy in the sense
 * prompt 9 opened up: a subject is a content TABLE and an axis is a COLUMN on it, so a new
 * one is a schema change, a migration and a screen — not something a studio adds on a
 * Tuesday. What became editable is the set of VALUES on an axis, and that set lives in rows.
 *
 * `SUBJECT_AXES` is the closed map between them, and it is the single source both the editor
 * and the write-time check read. Getting it from one place is what stops the editor
 * rendering a `scale` group for design works while the check quietly accepts one.
 *
 * ─── READ SCHEMA: TOLERANT LEAVES, STRICT SHAPE ───────────────────────────────────
 * `subject` and `axis` are parsed as plain strings on the way OUT rather than as their
 * enums, for the same reason `enums.ts` gives for content rows: a row written by a database
 * shell, or left behind by a subject this app no longer has, must not throw a `ZodError`
 * that blanks the whole editor. Callers filter by subject explicitly, so an unrecognized
 * one is simply never selected — invisible, not fatal.
 *
 * The WRITE schemas are exact, because a write is where the vocabulary is enforced.
 */
import { z } from 'zod';
import { pickLocale, type Locale } from './locale';

/* ────────────────────────────────────────────────────────────────────────────────
   Subjects and axes
   ──────────────────────────────────────────────────────────────────────────────── */

export const taxonomySubjectValues = ['project', 'design', 'media'] as const;
export const taxonomyAxisValues = ['type', 'status', 'scale', 'category'] as const;

export const taxonomySubjectEnum = z.enum(taxonomySubjectValues);
export const taxonomyAxisEnum = z.enum(taxonomyAxisValues);

export type TaxonomySubject = (typeof taxonomySubjectValues)[number];
export type TaxonomyAxis = (typeof taxonomyAxisValues)[number];

/**
 * Which axes each subject actually has, in the order the editor renders them.
 *
 * A design work has a category and a status but no scale; a media entry has one axis and it
 * is called `type`, matching its column. Nothing outside this file may hardcode that pairing.
 */
export const SUBJECT_AXES = {
  project: ['type', 'status', 'scale'],
  design: ['category', 'status'],
  media: ['type'],
} as const satisfies Record<TaxonomySubject, readonly TaxonomyAxis[]>;

/**
 * The `term()` group in the message catalog that backs an axis when a value has no term.
 *
 * The catalog's group names predate this table and are NOT renamed — AGENTS.md records that
 * `<group>.<value>` is load-bearing across the ported stylesheets and the projects module —
 * so `design.category` maps to `cat` and `media.type` maps to `kind` rather than the other
 * way round. This is the third step of the label degradation: term label → catalog → raw.
 */
export const AXIS_TERM_GROUP = {
  project: { type: 'type', status: 'status', scale: 'scale' },
  design: { category: 'cat', status: 'status' },
  media: { type: 'kind' },
} as const;

/** The human name of an axis, for the dashboard's English interface. */
export const AXIS_LABEL: Record<TaxonomyAxis, string> = {
  type: 'Type',
  status: 'Status',
  scale: 'Scale',
  category: 'Category',
};

/* ────────────────────────────────────────────────────────────────────────────────
   The row
   ──────────────────────────────────────────────────────────────────────────────── */

export const taxonomyTermRowSchema = z.object({
  id: z.number(),
  // Plain strings on the read side — see the header.
  subject: z.string(),
  axis: z.string(),
  value: z.string(),
  labelEn: z.string(),
  labelFa: z.string(),
  sortOrder: z.number(),
  visible: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxonomyTermRow = z.infer<typeof taxonomyTermRowSchema>;

/* ────────────────────────────────────────────────────────────────────────────────
   The writes — exact
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * `value` is required at CREATE and appears in no update schema below, and that asymmetry is
 * the resolved open decision (AGENTS.md): a term's wire value is immutable. Renaming it
 * would have to rewrite every content row holding the old string inside the same
 * transaction, and a partial rename is data corruption behind a green toast. The labels
 * carry any change an editor wants to make.
 */
export const taxonomyTermCreateSchema = z.object({
  subject: taxonomySubjectEnum,
  axis: taxonomyAxisEnum,
  value: z.string().min(1),
  labelEn: z.string().min(1),
  labelFa: z.string().min(1),
  sortOrder: z.number().int(),
  visible: z.boolean(),
});

export type TaxonomyTermCreate = z.infer<typeof taxonomyTermCreateSchema>;

/** Every field optional: the reorder writes only `sortOrder`, the toggle only `visible`. */
export const taxonomyTermUpdateSchema = taxonomyTermCreateSchema
  .omit({ subject: true, axis: true, value: true })
  .partial();

export type TaxonomyTermUpdate = z.infer<typeof taxonomyTermUpdateSchema>;

/* ────────────────────────────────────────────────────────────────────────────────
   Reading a term
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * One option on a public filter rail.
 *
 * `label` is `null` when the value has no term — a row carrying a value nobody has declared,
 * which must stay visible rather than vanish. The rail degrades that to the message catalog
 * and then to the raw value, which is the same three-step the i18n layer already documents
 * for `term()`. Resolving it HERE would need the dictionary, and this layer has no copy in it.
 */
export interface TermOption {
  value: string;
  label: string | null;
}

/** The label a term shows in one locale. The pair is a column pair, so this is a pick. */
export function termLabel(
  term: Pick<TaxonomyTermRow, 'labelEn' | 'labelFa'>,
  locale: Locale,
): string {
  return pickLocale(locale, term.labelEn, term.labelFa);
}
