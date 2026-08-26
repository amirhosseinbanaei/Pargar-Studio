// src/modules/dashboard/actions/contact-actions.ts
'use server';
/**
 * The one write to the `contact` singleton — the editable CONTENT of the public contact
 * page, not the inbox (`contact-message-actions.ts`). Same shape as `studio-actions.ts`.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { updateContact } from '@/common/services/contact-service';
import { readSession } from '@/common/services/session';
import { contactSubmissionSchema, withPersianFallback } from '../schemas/contact-form';

export async function updateContactAction(input: unknown): Promise<ActionResult> {
  const session = await readSession();
  if (session.status !== 'valid') return { ok: false, status: 401 };

  const parsed = contactSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => updateContact(withPersianFallback(parsed.data)));
  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  updateTag(CACHE_TAGS.contact);
  return { ok: true, data: undefined };
}
