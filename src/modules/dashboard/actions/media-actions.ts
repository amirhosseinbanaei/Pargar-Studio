// src/modules/dashboard/actions/media-actions.ts
'use server';
/**
 * Every write to the `media` table. Same four rules as `project-actions.ts`.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS, mediaTag } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import {
  createMediaEntry,
  deleteMediaEntry,
  getMediaRowById,
  moveMediaEntry,
  updateMediaEntry,
} from '@/common/services/media-service';
import { readSession } from '@/common/services/session';
import { checkTaxonomy } from '../lib/taxonomy-guard';
import { mediaSubmissionSchema, withPersianFallback } from '../schemas/media-form';
import { reorderSubmissionSchema } from '../schemas/reorder';

async function requireSession(): Promise<{ ok: false; status: number } | null> {
  const session = await readSession();
  return session.status === 'valid' ? null : { ok: false, status: 401 };
}

function purgeMedia(slug: string, previousSlug?: string): void {
  updateTag(CACHE_TAGS.media);
  updateTag(mediaTag(slug));
  if (previousSlug && previousSlug !== slug) updateTag(mediaTag(previousSlug));
}

export async function createMediaAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = mediaSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK, after the parse and before the write. `type` was `z.enum(...)` until
   * prompt 9 and is a plain string now, because the closed set became editable rows — see
   * `@/common/schemas/enums`'s header and `project-actions.ts`'s clause 2b. It answers in the
   * same 422 envelope naming the same field, so nothing downstream changed.
   */
  const invalid = await checkTaxonomy('media', [
    { field: 'type', axis: 'type', values: [parsed.data.type] },
  ]);
  if (invalid) return invalid;

  const result = await toActionResult(() => createMediaEntry(withPersianFallback(parsed.data)));
  if (result.ok) purgeMedia(result.data.slug);

  return result.ok ? { ok: true, data: { slug: result.data.slug } } : result;
}

export async function updateMediaAction(
  id: number,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = mediaSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK, after the parse and before the write. `type` was `z.enum(...)` until
   * prompt 9 and is a plain string now, because the closed set became editable rows — see
   * `@/common/schemas/enums`'s header and `project-actions.ts`'s clause 2b. It answers in the
   * same 422 envelope naming the same field, so nothing downstream changed.
   */
  const invalid = await checkTaxonomy('media', [
    { field: 'type', axis: 'type', values: [parsed.data.type] },
  ]);
  if (invalid) return invalid;

  const result = await toActionResult(async () => {
    const before = await getMediaRowById(id);
    if (!before) return null;
    const after = await updateMediaEntry(id, withPersianFallback(parsed.data));
    return after ? { after, previousSlug: before.slug } : null;
  });
  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  purgeMedia(result.data.after.slug, result.data.previousSlug);
  return { ok: true, data: { slug: result.data.after.slug } };
}

export async function deleteMediaAction(id: number): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(async () => {
    const row = await getMediaRowById(parsed.data);
    if (!row) return null;
    return (await deleteMediaEntry(parsed.data)) ? row.slug : null;
  });

  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  purgeMedia(result.data);
  return { ok: true, data: undefined };
}

/**
 * Move one record to the position a drag or a keyboard move left it in. Same shape as
 * `moveProjectAction` — see that action for why the payload names the record it now FOLLOWS
 * rather than an index or a whole ordering, and why every renumbered row's tag is purged.
 */
export async function moveMediaAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = reorderSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => moveMediaEntry(parsed.data.id, parsed.data.afterId));
  if (!result.ok) return result;

  // `null` is "nothing moved" — a stale id, a deleted anchor, or a drop that travelled
  // nowhere. A success that purges nothing; the client refreshes onto the truth.
  if (result.data === null) return { ok: true, data: undefined };

  updateTag(CACHE_TAGS.media);
  for (const row of result.data.changed) updateTag(mediaTag(row.slug));
  return { ok: true, data: undefined };
}
