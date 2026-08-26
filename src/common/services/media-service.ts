// src/common/services/media-service.ts
/**
 * RING 3 — press, awards, lectures and exhibitions. See `./project-service` for the
 * caching and locale reasoning every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleMedia, type Media } from '@/common/schemas/media';
import type { MediaCreate, MediaRow, MediaUpdate } from '@/common/schemas/media';
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

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF (prompt 7) — bilingual, uncached. See `./project-service` for  *
 *  why.                                                                              *
 * ═════════════════════════════════════════════════════════════════════════════════ */

export async function listMediaRows(): Promise<MediaRow[]> {
  return mediaRepo.list();
}

export async function getMediaRow(slug: string): Promise<MediaRow | null> {
  return mediaRepo.bySlug(slug);
}

export async function getMediaRowById(id: number): Promise<MediaRow | null> {
  return (await mediaRepo.list()).find(row => row.id === id) ?? null;
}

export async function createMediaEntry(input: Omit<MediaCreate, 'sortOrder'>): Promise<MediaRow> {
  const rows = await mediaRepo.list();
  const leading = rows.length === 0 ? 0 : Math.min(...rows.map(row => row.sortOrder)) - 1;
  return mediaRepo.create({ ...input, sortOrder: leading });
}

export async function updateMediaEntry(id: number, input: MediaUpdate): Promise<MediaRow | null> {
  return mediaRepo.update(id, input);
}

export async function deleteMediaEntry(id: number): Promise<boolean> {
  return mediaRepo.remove(id);
}

export async function moveMediaEntry(
  id: number,
  direction: 'up' | 'down',
): Promise<{ moved: MediaRow; displaced: MediaRow } | null> {
  const rows = await mediaRepo.list();
  const from = rows.findIndex(row => row.id === id);
  if (from === -1) return null;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return null;

  const reordered = [...rows];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  await Promise.all(
    reordered.flatMap((row, index) =>
      row.sortOrder === index ? [] : [mediaRepo.update(row.id, { sortOrder: index })],
    ),
  );

  return { moved, displaced: rows[to] };
}
