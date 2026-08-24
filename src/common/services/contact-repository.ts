// src/common/services/contact-repository.ts
/**
 * RING 2 — the `contact` singleton: the editable CONTENT of the public contact page.
 *
 * Not the inbox. Inbound messages are `./contact-message-repository`, a different table
 * with a different lifecycle. See `./studio-repository` for the singleton shape this file
 * follows.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { contact } from './schema';
import {
  CONTACT_ID,
  contactRowSchema,
  type ContactCreate,
  type ContactRow,
  type ContactUpdate,
} from '@/common/schemas/contact';

type ContactInsert = typeof contact.$inferInsert;

const JSON_FIELDS = ['socialsEn', 'socialsFa'] as const;

function toRow<T extends ContactCreate | ContactUpdate>(input: T) {
  const out: Record<string, unknown> = { ...input };
  for (const field of JSON_FIELDS) {
    if (input[field] !== undefined) out[field] = JSON.stringify(input[field]);
  }
  return out;
}

export async function get(): Promise<ContactRow | null> {
  const [row] = await db.select().from(contact).where(eq(contact.id, CONTACT_ID)).limit(1);
  return row ? contactRowSchema.parse(row) : null;
}

export async function create(input: ContactCreate): Promise<ContactRow> {
  const [row] = await db
    .insert(contact)
    .values({ ...toRow(input), id: CONTACT_ID } as ContactInsert)
    .returning();
  return contactRowSchema.parse(row);
}

export async function update(input: ContactUpdate): Promise<ContactRow | null> {
  const [row] = await db
    .update(contact)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(contact.id, CONTACT_ID))
    .returning();
  return row ? contactRowSchema.parse(row) : null;
}

export async function remove(): Promise<boolean> {
  const rows = await db
    .delete(contact)
    .where(eq(contact.id, CONTACT_ID))
    .returning({ id: contact.id });
  return rows.length > 0;
}
