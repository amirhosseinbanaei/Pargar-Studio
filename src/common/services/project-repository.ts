// src/common/services/project-repository.ts
/**
 * RING 2 — the `projects` table, and the ONE place a project row is validated.
 *
 * Imports exactly two things: ring 1 (`./db`, `./schema`) and this resource's contracts.
 * It does not import a service, an action, a component or another repository — the ring
 * only ever calls downward.
 *
 * ─── WHY EVERY ROW IS PARSED ──────────────────────────────────────────────────────
 * drizzle's row type is a COMPILE-TIME claim derived from the table definition. It is not
 * evidence: the database is a file that migrations, the seed script, a `turso db shell`
 * session and a future column change all write to, and any of them can leave a row that
 * does not match. `.parse()` is the claim the runtime enforces, and it happens here so
 * that nothing downstream has to — a service, a page or a component that casts is
 * asserting something nobody checked.
 *
 * It is also where the JSON columns stop being strings: `types` leaves this file as
 * `string[]`, and the two gallery columns as arrays of `{ path, alt }`.
 *
 * ─── WRITES ───────────────────────────────────────────────────────────────────────
 * `create` / `update` / `remove` exist and are unused until prompt 6 wires the dashboard
 * actions. They are written now because the parse-and-encode rules for this table belong
 * next to the read that shares them; splitting them across two prompts is how the seed's
 * JSON encoding and the dashboard's end up disagreeing.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { projects } from './schema';
import {
  projectRowSchema,
  type ProjectCreate,
  type ProjectRow,
  type ProjectUpdate,
} from '@/common/schemas/project';

/** The insert shape drizzle expects, with `types` already JSON-encoded. */
type ProjectInsert = typeof projects.$inferInsert;

/**
 * The JSON columns. `types` since prompt 2, the two gallery columns since prompt 10 —
 * adding one to the schema means adding it here in the same commit, or the array reaches
 * drizzle as an object and is written as `'[object Object]'`.
 */
const JSON_FIELDS = ['types', 'galleryEn', 'galleryFa'] as const;

/**
 * Encode the JSON columns on the way IN. The exact inverse of the `jsonArray` leaves in
 * `@/common/schemas/project`; the pair is what keeps `JSON.parse`/`JSON.stringify` out of
 * every call site.
 *
 * An ABSENT key stays absent. A PATCH `set()` handed `undefined` would otherwise have
 * drizzle write the string `'undefined'` into a column the caller never meant to touch.
 */
function toRow<T extends ProjectCreate | ProjectUpdate>(input: T) {
  const out: Record<string, unknown> = { ...input };
  for (const field of JSON_FIELDS) {
    if (input[field] !== undefined) out[field] = JSON.stringify(input[field]);
  }
  return out;
}

export async function list(): Promise<ProjectRow[]> {
  const rows = await db.select().from(projects).orderBy(projects.sortOrder);
  return rows.map(row => projectRowSchema.parse(row));
}

/**
 * Returns `null` for a slug that does not exist — it is not an error, it is a 404, and
 * throwing here would force every caller into a try/catch to render one.
 */
export async function bySlug(slug: string): Promise<ProjectRow | null> {
  const [row] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return row ? projectRowSchema.parse(row) : null;
}

export async function create(input: ProjectCreate): Promise<ProjectRow> {
  const [row] = await db
    .insert(projects)
    .values(toRow(input) as ProjectInsert)
    .returning();
  return projectRowSchema.parse(row);
}

/**
 * Re-stamps `updatedAt`. The column's default only applies at INSERT, so without this line
 * an edited row keeps the timestamp it was seeded with and every "recently changed" view
 * in the dashboard is wrong.
 */
export async function update(id: number, input: ProjectUpdate): Promise<ProjectRow | null> {
  const [row] = await db
    .update(projects)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ? projectRowSchema.parse(row) : null;
}

/** `true` if a row was deleted, `false` if the id was already gone. */
export async function remove(id: number): Promise<boolean> {
  const rows = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return rows.length > 0;
}
