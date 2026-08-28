// src/common/services/taxonomy-repository.ts
/**
 * RING 2 — the `taxonomy_terms` table, and the ONE place a term row is validated.
 *
 * Shaped exactly like `project-repository.ts`: it imports ring 1 (`./db`, `./schema`) and
 * this resource's contracts, parses every row on the way out, and calls nothing sideways or
 * upward. See that file's header for why the parse is not optional — the same argument
 * applies here and applies harder, because this table is the one a `turso db shell` session
 * is most likely to be pointed at when somebody wants to fix a label quickly.
 *
 * ─── ORDERING IS A PROPERTY OF THE QUERY ──────────────────────────────────────────
 * Every read below orders by `sort_order` within a group, then by `id`. The tiebreak is not
 * decoration: `sortOrder` defaults to 0, so two terms created before anything is reordered
 * genuinely share a position, and SQLite is free to return them either way round. Without
 * the tiebreak the rail's order would be stable only by luck, and the reorder arrows would
 * appear to do nothing on exactly the rows that need them most.
 */
import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import { taxonomyTerms } from './schema';
import {
  taxonomyTermRowSchema,
  type TaxonomySubject,
  type TaxonomyTermCreate,
  type TaxonomyTermRow,
  type TaxonomyTermUpdate,
} from '@/common/schemas/taxonomy';

/** Every term, every subject. The table is a few dozen rows; there is nothing to paginate. */
export async function list(): Promise<TaxonomyTermRow[]> {
  const rows = await db
    .select()
    .from(taxonomyTerms)
    .orderBy(
      asc(taxonomyTerms.subject),
      asc(taxonomyTerms.axis),
      asc(taxonomyTerms.sortOrder),
      asc(taxonomyTerms.id),
    );
  return rows.map(row => taxonomyTermRowSchema.parse(row));
}

/** One subject's terms, every axis, in editor order. */
export async function listBySubject(subject: TaxonomySubject): Promise<TaxonomyTermRow[]> {
  const rows = await db
    .select()
    .from(taxonomyTerms)
    .where(eq(taxonomyTerms.subject, subject))
    .orderBy(asc(taxonomyTerms.axis), asc(taxonomyTerms.sortOrder), asc(taxonomyTerms.id));
  return rows.map(row => taxonomyTermRowSchema.parse(row));
}

/*
 * THERE IS DELIBERATELY NO `listVisibleBySubject` HERE, and there was one for a while.
 *
 * Filtering `visible` in the query looks obviously right — the public rails only ever offer
 * visible terms — and it produces a bug end-to-end verification caught and reading did not:
 * a caller holding only the visible terms cannot tell a term that was just HIDDEN from a
 * value nobody ever DECLARED, so the "append an unknown value rather than dropping it" rule
 * puts the hidden one straight back on the rail carrying its raw English value. The flag has
 * to travel with the row to the one place that knows both facts. See
 * `common/utils/taxonomy.ts`'s `optionsForAxis`.
 */

/** `null` for an id that is not there — a concurrent delete, not an error. */
export async function byId(id: number): Promise<TaxonomyTermRow | null> {
  const [row] = await db.select().from(taxonomyTerms).where(eq(taxonomyTerms.id, id)).limit(1);
  return row ? taxonomyTermRowSchema.parse(row) : null;
}

/**
 * Insert one term.
 *
 * A duplicate `(subject, axis, value)` triple is refused by the unique index, and that
 * rejection is left to propagate rather than being caught and softened here: the service
 * above checks for the collision first so the editor gets a field-level message, and this
 * throw is the backstop for the race between that check and this insert. Swallowing it would
 * turn a genuine constraint violation into a silent no-op reported as a success.
 */
export async function create(input: TaxonomyTermCreate): Promise<TaxonomyTermRow> {
  const [row] = await db.insert(taxonomyTerms).values(input).returning();
  return taxonomyTermRowSchema.parse(row);
}

/** Re-stamps `updatedAt`; the column's default only applies at INSERT. */
export async function update(
  id: number,
  input: TaxonomyTermUpdate,
): Promise<TaxonomyTermRow | null> {
  const [row] = await db
    .update(taxonomyTerms)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(taxonomyTerms.id, id))
    .returning();
  return row ? taxonomyTermRowSchema.parse(row) : null;
}

/** `true` if a row was deleted, `false` if the id was already gone. */
export async function remove(id: number): Promise<boolean> {
  const rows = await db
    .delete(taxonomyTerms)
    .where(eq(taxonomyTerms.id, id))
    .returning({ id: taxonomyTerms.id });
  return rows.length > 0;
}
