// src/common/services/contact-message-service.ts
/**
 * RING 3 — the contact inbox.
 *
 * ─── THE ONE SERVICE IN THIS RING WITH NO `'use cache'` ───────────────────────────
 * Deliberate, and it must stay that way. The dashboard inbox has to be dynamic: a cached
 * list shows "no new messages" while a message sits in the database, and the person who
 * notices is the client who never got a reply. Caching a mailbox trades the only property
 * a mailbox has.
 *
 * That is why these functions carry no `cacheTag` either — there is nothing to purge. The
 * name `contact-messages` is still reserved in `./cache-tags` so a future cached read
 * (an unread COUNT in the shell, say) has one to use.
 *
 * No locale mapper: a visitor writes in whichever language they choose.
 */
import 'server-only';
import * as contactMessageRepo from './contact-message-repository';
import type { ContactMessage } from '@/common/schemas/contact-message';

/** Newest first. */
export async function listContactMessages(): Promise<ContactMessage[]> {
  return contactMessageRepo.list();
}

export async function listUnreadContactMessages(): Promise<ContactMessage[]> {
  return contactMessageRepo.listUnread();
}
