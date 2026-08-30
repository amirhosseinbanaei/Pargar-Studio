// src/common/services/index-card-repository.ts
/**
 * RING 2 — the five index cards. The only place an `index_cards` row is validated.
 *
 * Shaped like `studio-repository.ts` rather than like a slug-keyed one: there is no
 * `create` and no `remove`, because the five rows are the SCHEMA's — the migration that
 * creates the table inserts them — and a section id that is not one of the five NAV ids
 * has nothing to name. The dashboard only ever updates.
 *
 * `list()` returns whatever rows exist, in no particular order. Ordering the five by NAV
 * and filling in the ones that are missing is the SERVICE's job, because NAV order is a
 * property of the site's chrome rather than of the table.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { indexCards } from './schema';
import {
  indexCardRowSchema,
  type IndexCardRow,
  type IndexCardUpdate,
} from '@/common/schemas/index-card';

export async function list(): Promise<IndexCardRow[]> {
  const rows = await db.select().from(indexCards);
  return rows.map(row => indexCardRowSchema.parse(row));
}

/** `null` when no row has been inserted for this section — never an error. */
export async function get(sectionId: string): Promise<IndexCardRow | null> {
  const [row] = await db
    .select()
    .from(indexCards)
    .where(eq(indexCards.sectionId, sectionId))
    .limit(1);
  return row ? indexCardRowSchema.parse(row) : null;
}

/**
 * UPSERT rather than UPDATE, and that is the one thing this repository does differently
 * from the other singletons.
 *
 * `updateStudio` may return `null` for "there is no row 1, seed the database", and the
 * action turns that into a 404 — correct there, because a studio row carries content
 * nobody could reconstruct. A missing index card carries nothing: the column has been
 * rendering from the message catalog the whole time. So a save writes the row if it is not
 * there, and an editor working against a database that was migrated before this table
 * existed never meets a 404 they cannot act on.
 */
export async function upsert(sectionId: string, input: IndexCardUpdate): Promise<IndexCardRow> {
  const [row] = await db
    .insert(indexCards)
    .values({ ...input, sectionId })
    .onConflictDoUpdate({
      target: indexCards.sectionId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return indexCardRowSchema.parse(row);
}
