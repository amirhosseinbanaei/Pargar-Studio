// src/common/services/contact-message-repository.ts
/**
 * RING 2 — the `contact_messages` inbox.
 *
 * The only repository whose `create` is reachable by the public: prompt 5's contact form
 * writes here through a Server Action. That is why `contactMessageCreateSchema` is exact
 * and bounded, and why this file re-parses its input rather than trusting the caller — an
 * action is a public endpoint, and the form is not a security boundary.
 *
 * `markRead` replaces the usual `update`: the only mutable thing about a received message
 * is whether it has been read. Editing the body of mail somebody else sent is not an
 * operation this application should be able to perform.
 */
import 'server-only';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { contactMessages } from './schema';
import {
  contactMessageCreateSchema,
  contactMessageRowSchema,
  type ContactMessage,
  type ContactMessageCreate,
} from '@/common/schemas/contact-message';

/** Newest first — an inbox is read from the top, unlike the sort-ordered content tables. */
export async function list(): Promise<ContactMessage[]> {
  const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  return rows.map(row => contactMessageRowSchema.parse(row));
}

export async function listUnread(): Promise<ContactMessage[]> {
  const rows = await db
    .select()
    .from(contactMessages)
    .where(isNull(contactMessages.readAt))
    .orderBy(desc(contactMessages.createdAt));
  return rows.map(row => contactMessageRowSchema.parse(row));
}

/**
 * Parses its input as well as its output. Every other repository here is fed by the
 * dashboard, behind auth; this one is fed by a stranger, so the length caps and the email
 * check are enforced at the last point before the write regardless of what the action did.
 */
export async function create(input: ContactMessageCreate): Promise<ContactMessage> {
  const values = contactMessageCreateSchema.parse(input);
  const [row] = await db.insert(contactMessages).values(values).returning();
  return contactMessageRowSchema.parse(row);
}

/**
 * Idempotent: an already-read message keeps its ORIGINAL `readAt`. The `coalesce` is what
 * buys that — a plain `set({ readAt: new Date() })` re-stamps on every click and makes
 * "when did we first see this?" unanswerable, and adding `where(isNull(read_at))` instead
 * would make a second click look like a missing message.
 */
export async function markRead(id: number): Promise<ContactMessage | null> {
  const [row] = await db
    .update(contactMessages)
    .set({ readAt: sql`coalesce(${contactMessages.readAt}, unixepoch())` })
    .where(eq(contactMessages.id, id))
    .returning();
  return row ? contactMessageRowSchema.parse(row) : null;
}

export async function remove(id: number): Promise<boolean> {
  const rows = await db
    .delete(contactMessages)
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id });
  return rows.length > 0;
}
