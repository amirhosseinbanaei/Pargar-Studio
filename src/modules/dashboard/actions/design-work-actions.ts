// src/modules/dashboard/actions/design-work-actions.ts
'use server';
/**
 * Every write to the `design_works` table. Same four rules, same shape, as
 * `project-actions.ts` — re-authorize first, re-validate against the exact write schema,
 * call a service through `toActionResult`, purge the exact tags on success only. See that
 * file for the reasoning; it is not repeated per resource.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS, designWorkTag } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import {
  createDesignWork,
  deleteDesignWork,
  getDesignWorkRowById,
  moveDesignWork,
  updateDesignWork,
} from '@/common/services/design-work-service';
import { readSession } from '@/common/services/session';
import { checkTaxonomy } from '../lib/taxonomy-guard';
import { designWorkSubmissionSchema, withPersianFallback } from '../schemas/design-work-form';
import { reorderSubmissionSchema } from '../schemas/reorder';

async function requireSession(): Promise<{ ok: false; status: number } | null> {
  const session = await readSession();
  return session.status === 'valid' ? null : { ok: false, status: 401 };
}

function purgeDesignWork(slug: string, previousSlug?: string): void {
  updateTag(CACHE_TAGS.designWorks);
  updateTag(designWorkTag(slug));
  if (previousSlug && previousSlug !== slug) updateTag(designWorkTag(previousSlug));
}

export async function createDesignWorkAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = designWorkSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK, after the parse and before the write. `category` and `status` were
   * `z.enum(...)` until prompt 9 and are plain strings now, because the closed set became
   * editable rows — see `@/common/schemas/enums`'s header and `project-actions.ts`'s clause
   * 2b. It answers in the same 422 envelope naming the same field, so nothing downstream
   * changed.
   */
  const invalid = await checkTaxonomy('design', [
    { field: 'category', axis: 'category', values: [parsed.data.category] },
    { field: 'status', axis: 'status', values: [parsed.data.status] },
  ]);
  if (invalid) return invalid;

  const result = await toActionResult(() => createDesignWork(withPersianFallback(parsed.data)));
  if (result.ok) purgeDesignWork(result.data.slug);

  return result.ok ? { ok: true, data: { slug: result.data.slug } } : result;
}

export async function updateDesignWorkAction(
  id: number,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = designWorkSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK, after the parse and before the write. `category` and `status` were
   * `z.enum(...)` until prompt 9 and are plain strings now, because the closed set became
   * editable rows — see `@/common/schemas/enums`'s header and `project-actions.ts`'s clause
   * 2b. It answers in the same 422 envelope naming the same field, so nothing downstream
   * changed.
   */
  const invalid = await checkTaxonomy('design', [
    { field: 'category', axis: 'category', values: [parsed.data.category] },
    { field: 'status', axis: 'status', values: [parsed.data.status] },
  ]);
  if (invalid) return invalid;

  const result = await toActionResult(async () => {
    const before = await getDesignWorkRowById(id);
    if (!before) return null;
    const after = await updateDesignWork(id, withPersianFallback(parsed.data));
    return after ? { after, previousSlug: before.slug } : null;
  });
  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  purgeDesignWork(result.data.after.slug, result.data.previousSlug);
  return { ok: true, data: { slug: result.data.after.slug } };
}

export async function deleteDesignWorkAction(id: number): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(async () => {
    const row = await getDesignWorkRowById(parsed.data);
    if (!row) return null;
    return (await deleteDesignWork(parsed.data)) ? row.slug : null;
  });

  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  purgeDesignWork(result.data);
  return { ok: true, data: undefined };
}

/**
 * Move one record to the position a drag or a keyboard move left it in. Same shape as
 * `moveProjectAction` — see that action for why the payload names the record it now FOLLOWS
 * rather than an index or a whole ordering, and why every renumbered row's tag is purged.
 */
export async function moveDesignWorkAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = reorderSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => moveDesignWork(parsed.data.id, parsed.data.afterId));
  if (!result.ok) return result;

  // `null` is "nothing moved" — a stale id, a deleted anchor, or a drop that travelled
  // nowhere. A success that purges nothing; the client refreshes onto the truth.
  if (result.data === null) return { ok: true, data: undefined };

  updateTag(CACHE_TAGS.designWorks);
  for (const row of result.data.changed) updateTag(designWorkTag(row.slug));
  return { ok: true, data: undefined };
}
