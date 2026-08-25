// src/common/services/media-service.ts
/**
 * RING 3 — press, awards, lectures and exhibitions. See `./project-service` for the
 * caching and locale reasoning every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleMedia, type Media } from '@/common/schemas/media';
import type { Locale } from '@/common/schemas/locale';
import * as mediaRepo from './media-repository';
import { CACHE_TAGS, mediaTag, projectTag } from './cache-tags';

export async function listMedia(locale: Locale): Promise<Media[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.media);

  const rows = await mediaRepo.list();
  return rows.map(row => toLocaleMedia(row, locale));
}

export async function getMediaEntry(slug: string, locale: Locale): Promise<Media | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.media, mediaTag(slug));

  const row = await mediaRepo.bySlug(slug);
  return row ? toLocaleMedia(row, locale) : null;
}

/**
 * The press attached to one project, for its detail page.
 *
 * Tagged `media` and `project:<slug>`: the list changes when a media entry is edited, and
 * it also stops being reachable when that project is deleted. Both purges must drop it, so
 * both tags are set.
 */
export async function listMediaForProject(projectSlug: string, locale: Locale): Promise<Media[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.media, projectTag(projectSlug));

  const rows = await mediaRepo.byProjectSlug(projectSlug);
  return rows.map(row => toLocaleMedia(row, locale));
}
