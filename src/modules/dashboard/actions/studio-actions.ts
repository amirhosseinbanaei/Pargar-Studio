// src/modules/dashboard/actions/studio-actions.ts
'use server';
/**
 * The one write to the `studio` singleton. Same four rules as `project-actions.ts`, minus
 * the id — there is one row, and `updateStudio` always targets it (`STUDIO_ID`, pinned by a
 * database CHECK constraint).
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { updateStudio } from '@/common/services/studio-service';
import { readSession } from '@/common/services/session';
import { studioSubmissionSchema, withPersianFallback } from '../schemas/studio-form';

export async function updateStudioAction(input: unknown): Promise<ActionResult> {
  const session = await readSession();
  if (session.status !== 'valid') return { ok: false, status: 401 };

  const parsed = studioSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => updateStudio(withPersianFallback(parsed.data)));
  if (!result.ok) return result;

  // `null` — the database has not been seeded, so there is no row 1 to update. Reported as
  // a 404 rather than a silent success: the toast would say "Saved" for a write that
  // touched nothing.
  if (result.data === null) return { ok: false, status: 404 };

  updateTag(CACHE_TAGS.studio);
  return { ok: true, data: undefined };
}
