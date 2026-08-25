// src/common/services/design-work-service.ts
/**
 * RING 3 — design works. See `./project-service` for the caching and locale reasoning
 * every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleDesignWork, type DesignWork } from '@/common/schemas/design-work';
import type { Locale } from '@/common/schemas/locale';
import * as designWorkRepo from './design-work-repository';
import { CACHE_TAGS, designWorkTag } from './cache-tags';

export async function listDesignWorks(locale: Locale): Promise<DesignWork[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.designWorks);

  const rows = await designWorkRepo.list();
  return rows.map(row => toLocaleDesignWork(row, locale));
}

export async function getDesignWork(slug: string, locale: Locale): Promise<DesignWork | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.designWorks, designWorkTag(slug));

  const row = await designWorkRepo.bySlug(slug);
  return row ? toLocaleDesignWork(row, locale) : null;
}
