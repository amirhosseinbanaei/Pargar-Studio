// src/common/services/contact-service.ts
/**
 * RING 3 — the contact singleton: the editable CONTENT of the public contact page.
 *
 * The INBOX is `./contact-message-service`, and it is deliberately uncached. See
 * `./project-service` for the caching and locale reasoning every service in this ring
 * follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleContact, type Contact } from '@/common/schemas/contact';
import type { ContactRow, ContactUpdate } from '@/common/schemas/contact';
import type { Locale } from '@/common/schemas/locale';
import * as contactRepo from './contact-repository';
import { CACHE_TAGS } from './cache-tags';

export async function getContact(locale: Locale): Promise<Contact | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.contact);

  const row = await contactRepo.get();
  return row ? toLocaleContact(row, locale) : null;
}

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF (prompt 7) — bilingual, uncached. See `./studio-service` for   *
 *  why there is no `createContact`.                                                  *
 * ═════════════════════════════════════════════════════════════════════════════════ */

export async function getContactRow(): Promise<ContactRow | null> {
  return contactRepo.get();
}

export async function updateContact(input: ContactUpdate): Promise<ContactRow | null> {
  return contactRepo.update(input);
}
