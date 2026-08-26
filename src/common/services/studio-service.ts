// src/common/services/studio-service.ts
/**
 * RING 3 — the studio singleton. See `./project-service` for the caching and locale
 * reasoning every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleStudio, type Studio } from '@/common/schemas/studio';
import type { StudioRow, StudioUpdate } from '@/common/schemas/studio';
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

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF (prompt 7) — bilingual, uncached.                              *
 * ═════════════════════════════════════════════════════════════════════════════════ */

/** `null` before the seed has run — the edit route turns that into `notFound()`. */
export async function getStudioRow(): Promise<StudioRow | null> {
  return studioRepo.get();
}

/**
 * No `createStudio` here: a singleton has one row, planted by the seed. The dashboard only
 * ever edits it, so `null` here means "seed the database first", not "make one from the
 * form" — offering a create path from an editor would risk a second attempt at row 1, which
 * the `studio_singleton` CHECK constraint would then reject with a database error instead
 * of the field-level message a form should give.
 */
export async function updateStudio(input: StudioUpdate): Promise<StudioRow | null> {
  return studioRepo.update(input);
}
