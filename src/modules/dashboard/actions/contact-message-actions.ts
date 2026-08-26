// src/modules/dashboard/actions/contact-message-actions.ts
'use server';
/**
 * Every write to the `contact_messages` inbox. Same two rules as every other action in this
 * module — re-authorize first, return rather than throw — minus the two that do not apply
 * to an inbox: there is no write SCHEMA to re-validate against, because neither action
 * accepts anything but the record's own id, and there is NO CACHE TAG TO PURGE.
 *
 * `contact_messages` is deliberately never cached (`common/services/cache-tags.ts`,
 * `contact-message-service.ts`) and no public page reads it — the contact PAGE reads the
 * `contact` singleton, a different table these actions never touch. An `updateTag` here
 * would purge a cache that does not exist, which is precisely the kind of call that looks
 * safe, does nothing, and would mislead the next reader into thinking a tag was declared
 * for this table. Checked against `common/services/cache-tags.ts`, not assumed.
 */
import { z } from 'zod';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import {
  deleteContactMessage,
  markContactMessageRead,
} from '@/common/services/contact-message-service';
import { readSession } from '@/common/services/session';

async function requireSession(): Promise<{ ok: false; status: number } | null> {
  const session = await readSession();
  return session.status === 'valid' ? null : { ok: false, status: 401 };
}

/**
 * Marks a message read. Idempotent — see `markRead` in the repository — so calling it on an
 * already-read message is a harmless no-op rather than a re-stamp.
 */
export async function markContactMessageReadAction(id: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => markContactMessageRead(parsed.data));
  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  return { ok: true, data: undefined };
}

export async function deleteContactMessageAction(id: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => deleteContactMessage(parsed.data));
  if (!result.ok) return result;
  if (!result.data) return { ok: false, status: 404 };

  return { ok: true, data: undefined };
}
