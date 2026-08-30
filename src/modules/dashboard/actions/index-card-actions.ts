// src/modules/dashboard/actions/index-card-actions.ts
'use server';
/**
 * The one write to an index card. Same four rules as `project-actions.ts`, minus the create
 * and the delete — the five rows are the schema's, inserted by the migration that made the
 * table, and `section_id` is one of the five ids in `NAV`.
 *
 * `sectionId` is an ARGUMENT and it is legal: it names the RECORD, not the caller
 * (`references/04-actions-and-mutations.md`). It is validated against `NAV` by the
 * submission schema, because the route's `notFound()` gate says nothing about a POST that
 * never passed through a route.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { updateIndexCard } from '@/common/services/index-card-service';
import { readSession } from '@/common/services/session';
import { indexCardSubmissionSchema, toIndexCardColumns } from '../schemas/index-card-form';

export async function updateIndexCardAction(input: unknown): Promise<ActionResult> {
  const session = await readSession();
  if (session.status !== 'valid') return { ok: false, status: 401 };

  const parsed = indexCardSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const { sectionId } = parsed.data;
  const result = await toActionResult(() =>
    updateIndexCard(sectionId, toIndexCardColumns(parsed.data)),
  );
  if (!result.ok) return result;

  /**
   * ONE TAG, and no 404 branch.
   *
   * `updateStudioAction` answers 404 when its service returns `null`, because an unseeded
   * `studio` row is content nobody can reconstruct. There is no equivalent here: the
   * service upserts, so a section whose row was never inserted gets one on the first save
   * rather than a refusal the editor cannot act on. The front page was rendering from the
   * message catalog the whole time.
   */
  updateTag(CACHE_TAGS.indexCards);
  return { ok: true, data: undefined };
}
