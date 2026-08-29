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
import type { TermOption } from '@/common/schemas/taxonomy';
import { optionsForAxis } from '@/common/utils/taxonomy';
import { planReorder } from '@/common/utils/reorder';
import * as mediaRepo from './media-repository';
import { getPublicTerms } from './taxonomy-service';
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

/**
 * The kind rail's option list, from `taxonomy_terms`.
 *
 * One axis, the `type` column (`legacy/js/ui/panel.js:279`). Same composition and the same
 * two tags as `getProjectFilters` — see that function's header. Counts stay on the screen,
 * which already holds every entry.
 *
 * Note the naming mismatch, which is deliberate and load-bearing: the COLUMN and the axis
 * are `type`, the rail's heading is "Kind", and the message catalog's fallback group is
 * `kind.*`. Renaming any of them would be a repo-wide edit for no gain — AGENTS.md records
 * that catalog keys are never renamed — so `schemas/taxonomy.ts`'s `AXIS_TERM_GROUP` maps
 * between them in one place.
 */
export async function getMediaFilters(locale: Locale): Promise<{ types: TermOption[] }> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.media, CACHE_TAGS.taxonomy);

  const [rows, terms] = await Promise.all([mediaRepo.list(), getPublicTerms('media')]);

  return {
    types: optionsForAxis(
      terms.filter(term => term.axis === 'type'),
      rows.map(row => row.type),
      locale,
    ),
  };
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

/**
 * Same anchor-and-renumber algorithm as `moveProject` — see that function for why the action
 * sends the record it now FOLLOWS rather than an index or a whole ordering, and
 * `common/utils/reorder.ts` for the arithmetic itself.
 *
 * `null` when nothing happened: an unknown id, an anchor that has since been deleted, or a
 * drop back where the media entry already was.
 */
export async function moveMediaEntry(
  id: number,
  afterId: number | null,
): Promise<{ moved: MediaRow; changed: MediaRow[] } | null> {
  const rows = await mediaRepo.list();
  const plan = planReorder(rows, id, afterId);
  if (!plan) return null;

  await Promise.all(
    plan.writes.map(write => mediaRepo.update(write.row.id, { sortOrder: write.sortOrder })),
  );

  return { moved: plan.moved, changed: plan.writes.map(write => write.row) };
}
