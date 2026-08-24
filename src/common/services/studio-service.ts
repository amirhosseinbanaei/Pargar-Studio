// src/common/services/studio-service.ts
/**
 * RING 3 — the studio singleton. See `./project-service` for the caching and locale
 * reasoning every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleStudio, type Studio } from '@/common/schemas/studio';
import type { Locale } from '@/common/schemas/locale';
import * as studioRepo from './studio-repository';
import { CACHE_TAGS } from './cache-tags';

/**
 * `null` on an unseeded database. No instance tag: there is one record, so the collection
 * tag `studio` already identifies it exactly, and a second name for the same thing is a
 * second thing to forget to purge.
 */
export async function getStudio(locale: Locale): Promise<Studio | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.studio);

  const row = await studioRepo.get();
  return row ? toLocaleStudio(row, locale) : null;
}
