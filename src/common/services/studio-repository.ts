// src/common/services/studio-repository.ts
/**
 * RING 2 — the `studio` singleton. The only place the studio row is validated.
 *
 * A singleton reads with `get()` rather than `bySlug()`: there is one row, its id is
 * pinned to 1 by a CHECK constraint in `./schema`, and every function here targets that id
 * through `STUDIO_ID` so the number appears once.
 *
 * `create` exists for the seed, which is the only writer that inserts this row; the
 * dashboard only ever updates it. `remove` exists to satisfy the same repository shape
 * every other resource has, and deleting the row is a legitimate reset — the seed puts it
 * back.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { studio } from './schema';
import {
  STUDIO_ID,
  studioRowSchema,
  type StudioCreate,
  type StudioRow,
  type StudioUpdate,
} from '@/common/schemas/studio';

type StudioInsert = typeof studio.$inferInsert;

/** Every column on this table except the id and the timestamps is JSON or prose. */
const JSON_FIELDS = [
  'foundersEn',
  'foundersFa',
  'statsEn',
  'statsFa',
  'teamEn',
  'teamFa',
  'alumniEn',
  'alumniFa',
  'awardsEn',
  'awardsFa',
  'chaptersEn',
  'chaptersFa',
  'galleryEn',
  'galleryFa',
] as const;

function toRow<T extends StudioCreate | StudioUpdate>(input: T) {
  const out: Record<string, unknown> = { ...input };
  for (const field of JSON_FIELDS) {
    if (input[field] !== undefined) out[field] = JSON.stringify(input[field]);
  }
  return out;
}

/**
 * `null` before the seed has run. The caller decides what an unseeded database means —
 * a page can render nothing, the dashboard can offer to seed — and throwing here would
 * take that choice away.
 */
export async function get(): Promise<StudioRow | null> {
  const [row] = await db.select().from(studio).where(eq(studio.id, STUDIO_ID)).limit(1);
  return row ? studioRowSchema.parse(row) : null;
}

export async function create(input: StudioCreate): Promise<StudioRow> {
  const [row] = await db
    .insert(studio)
    .values({ ...toRow(input), id: STUDIO_ID } as StudioInsert)
    .returning();
  return studioRowSchema.parse(row);
}

export async function update(input: StudioUpdate): Promise<StudioRow | null> {
  const [row] = await db
    .update(studio)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(studio.id, STUDIO_ID))
    .returning();
  return row ? studioRowSchema.parse(row) : null;
}

export async function remove(): Promise<boolean> {
  const rows = await db.delete(studio).where(eq(studio.id, STUDIO_ID)).returning({ id: studio.id });
  return rows.length > 0;
}
