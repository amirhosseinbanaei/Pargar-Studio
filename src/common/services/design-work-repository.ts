// src/common/services/design-work-repository.ts
/**
 * RING 2 — the `design_works` table. The only place a design-work row is validated.
 *
 * Six JSON columns rather than one (`team`, `facts` and — since prompt 10 — `gallery`, each
 * per locale), so the encode/decode pair matters more here: `toRow` below is the exact inverse of the
 * `jsonArray` leaves in `@/common/schemas/design-work`, and they must be edited together.
 * See `./project-repository` for the reasoning this file follows.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { designWorks } from './schema';
import {
  designWorkRowSchema,
  type DesignWorkCreate,
  type DesignWorkRow,
  type DesignWorkUpdate,
} from '@/common/schemas/design-work';

type DesignWorkInsert = typeof designWorks.$inferInsert;

/**
 * Six since prompt 10: the two gallery columns join `team` and `facts`. Adding a JSON
 * column to the schema means adding it here in the same commit — the array would otherwise
 * reach drizzle as an object and be written as `'[object Object]'`.
 */
const JSON_FIELDS = ['teamEn', 'teamFa', 'factsEn', 'factsFa', 'galleryEn', 'galleryFa'] as const;

/**
 * JSON-encode the list columns, leaving an absent key absent — an `undefined` in a PATCH
 * `set()` must stay undefined, or drizzle writes `'undefined'` into the column.
 */
function toRow<T extends DesignWorkCreate | DesignWorkUpdate>(input: T) {
  const out: Record<string, unknown> = { ...input };
  for (const field of JSON_FIELDS) {
    if (input[field] !== undefined) out[field] = JSON.stringify(input[field]);
  }
  return out;
}

export async function list(): Promise<DesignWorkRow[]> {
  const rows = await db.select().from(designWorks).orderBy(designWorks.sortOrder);
  return rows.map(row => designWorkRowSchema.parse(row));
}

export async function bySlug(slug: string): Promise<DesignWorkRow | null> {
  const [row] = await db.select().from(designWorks).where(eq(designWorks.slug, slug)).limit(1);
  return row ? designWorkRowSchema.parse(row) : null;
}

export async function create(input: DesignWorkCreate): Promise<DesignWorkRow> {
  const [row] = await db
    .insert(designWorks)
    .values(toRow(input) as DesignWorkInsert)
    .returning();
  return designWorkRowSchema.parse(row);
}

export async function update(id: number, input: DesignWorkUpdate): Promise<DesignWorkRow | null> {
  const [row] = await db
    .update(designWorks)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(designWorks.id, id))
    .returning();
  return row ? designWorkRowSchema.parse(row) : null;
}

export async function remove(id: number): Promise<boolean> {
  const rows = await db
    .delete(designWorks)
    .where(eq(designWorks.id, id))
    .returning({ id: designWorks.id });
  return rows.length > 0;
}
