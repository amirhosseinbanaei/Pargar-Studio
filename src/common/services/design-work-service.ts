// src/common/services/design-work-service.ts
/**
 * RING 3 — design works. See `./project-service` for the caching and locale reasoning
 * every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { toLocaleDesignWork, type DesignWork } from '@/common/schemas/design-work';
import type {
  DesignWorkCreate,
  DesignWorkRow,
  DesignWorkUpdate,
} from '@/common/schemas/design-work';
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

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF (prompt 7) — bilingual, uncached. See `./project-service` for  *
 *  why: an editor shown the value they just replaced cannot tell a stale cache from  *
 *  a failed save.                                                                    *
 * ═════════════════════════════════════════════════════════════════════════════════ */

export async function listDesignWorkRows(): Promise<DesignWorkRow[]> {
  return designWorkRepo.list();
}

export async function getDesignWorkRow(slug: string): Promise<DesignWorkRow | null> {
  return designWorkRepo.bySlug(slug);
}

/** Scans the (nine-row) list rather than adding a `byId` query — see `getProjectRowById`. */
export async function getDesignWorkRowById(id: number): Promise<DesignWorkRow | null> {
  return (await designWorkRepo.list()).find(row => row.id === id) ?? null;
}

/** A new design work is placed FIRST, same reasoning as `createProject`. */
export async function createDesignWork(
  input: Omit<DesignWorkCreate, 'sortOrder'>,
): Promise<DesignWorkRow> {
  const rows = await designWorkRepo.list();
  const leading = rows.length === 0 ? 0 : Math.min(...rows.map(row => row.sortOrder)) - 1;
  return designWorkRepo.create({ ...input, sortOrder: leading });
}

export async function updateDesignWork(
  id: number,
  input: DesignWorkUpdate,
): Promise<DesignWorkRow | null> {
  return designWorkRepo.update(id, input);
}

export async function deleteDesignWork(id: number): Promise<boolean> {
  return designWorkRepo.remove(id);
}

/** Same renumber-by-index algorithm as `moveProject` — see that function for why. */
export async function moveDesignWork(
  id: number,
  direction: 'up' | 'down',
): Promise<{ moved: DesignWorkRow; displaced: DesignWorkRow } | null> {
  const rows = await designWorkRepo.list();
  const from = rows.findIndex(row => row.id === id);
  if (from === -1) return null;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return null;

  const reordered = [...rows];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  await Promise.all(
    reordered.flatMap((row, index) =>
      row.sortOrder === index ? [] : [designWorkRepo.update(row.id, { sortOrder: index })],
    ),
  );

  return { moved, displaced: rows[to] };
}
