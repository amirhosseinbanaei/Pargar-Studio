// src/common/services/media-repository.ts
/**
 * RING 2 — the `media` table. The only place a media row is validated.
 * See `./project-repository` for the reasoning this file follows.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { media } from './schema';
import {
  mediaRowSchema,
  type MediaCreate,
  type MediaRow,
  type MediaUpdate,
} from '@/common/schemas/media';

type MediaInsert = typeof media.$inferInsert;

const JSON_FIELDS = ['factsEn', 'factsFa'] as const;

function toRow<T extends MediaCreate | MediaUpdate>(input: T) {
  const out: Record<string, unknown> = { ...input };
  for (const field of JSON_FIELDS) {
    if (input[field] !== undefined) out[field] = JSON.stringify(input[field]);
  }
  return out;
}

export async function list(): Promise<MediaRow[]> {
  const rows = await db.select().from(media).orderBy(media.sortOrder);
  return rows.map(row => mediaRowSchema.parse(row));
}

export async function bySlug(slug: string): Promise<MediaRow | null> {
  const [row] = await db.select().from(media).where(eq(media.slug, slug)).limit(1);
  return row ? mediaRowSchema.parse(row) : null;
}

/**
 * Every media entry attached to one project. Not a foreign-key join: `project_slug` is a
 * loose reference on purpose (see `@/common/schemas/media`), so this is a filter that
 * returns an empty list rather than a query that fails when the project is gone.
 */
export async function byProjectSlug(projectSlug: string): Promise<MediaRow[]> {
  const rows = await db
    .select()
    .from(media)
    .where(eq(media.projectSlug, projectSlug))
    .orderBy(media.sortOrder);
  return rows.map(row => mediaRowSchema.parse(row));
}

export async function create(input: MediaCreate): Promise<MediaRow> {
  const [row] = await db
    .insert(media)
    .values(toRow(input) as MediaInsert)
    .returning();
  return mediaRowSchema.parse(row);
}

export async function update(id: number, input: MediaUpdate): Promise<MediaRow | null> {
  const [row] = await db
    .update(media)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(media.id, id))
    .returning();
  return row ? mediaRowSchema.parse(row) : null;
}

export async function remove(id: number): Promise<boolean> {
  const rows = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id });
  return rows.length > 0;
}
