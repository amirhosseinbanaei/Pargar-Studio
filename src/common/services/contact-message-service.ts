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
import type { ContactMessage, ContactMessageCreate } from '@/common/schemas/contact-message';

/** Newest first. */
export async function listContactMessages(): Promise<ContactMessage[]> {
  return contactMessageRepo.list();
}

export async function listUnreadContactMessages(): Promise<ContactMessage[]> {
  return contactMessageRepo.listUnread();
}

/**
 * Store one submission from the public contact form (prompt 5).
 *
 * THE ONE WRITE IN THIS RING A STRANGER CAN REACH, which is why the boundary is guarded
 * twice: the Server Action parses its input with the exact schema before calling this, and
 * the repository parses again immediately before the insert. That is not belt-and-braces
 * for its own sake — the action is a public HTTP endpoint whose caller controls every
 * argument, and this function is reachable from any future server code that skips it.
 *
 * NO CACHE TAG IS PURGED, and that is checked rather than assumed: nothing caches this
 * table. `contact_messages` reads are deliberately uncached (see the header above), and no
 * public page reads the inbox at all — the contact PAGE reads the `contact` singleton,
 * which is a different table that this write does not touch. An `updateTag` here would
 * purge a cache that does not exist.
 *
 * NO EMAIL IS SENT. The dashboard inbox in prompt 7 is where messages are read; adding
 * SMTP is a deploy-time concern with its own credentials and failure modes, and a send
 * that fails must not lose a message that was successfully stored. See AGENTS.md.
 */
export async function createContactMessage(input: ContactMessageCreate): Promise<ContactMessage> {
  return contactMessageRepo.create(input);
}
