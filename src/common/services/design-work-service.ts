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
import type { TermOption } from '@/common/schemas/taxonomy';
import { optionsForAxis } from '@/common/utils/taxonomy';
import { planReorder } from '@/common/utils/reorder';
import * as designWorkRepo from './design-work-repository';
import { getPublicTerms } from './taxonomy-service';
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

/**
 * The category rail's option list, from `taxonomy_terms`.
 *
 * The design index filters on ONE axis (`legacy/js/ui/panel.js:215`), and until prompt 9 its
 * options were derived from the rows alone — so a category could not be reordered, retired
 * or relabelled without a deploy. Same composition and the same two tags as
 * `getProjectFilters`; that function's header carries the full reasoning, including why
 * nesting a cached read does not lift its tag onto this entry.
 *
 * The COUNTS are not here: the screen already has every row in memory for the grid it is
 * about to render, so counting there costs nothing and counting here would mean returning a
 * second parallel structure for the screen to zip back together.
 */
export async function getDesignWorkFilters(locale: Locale): Promise<{ categories: TermOption[] }> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.designWorks, CACHE_TAGS.taxonomy);

  const [rows, terms] = await Promise.all([designWorkRepo.list(), getPublicTerms('design')]);

  return {
    categories: optionsForAxis(
      terms.filter(term => term.axis === 'category'),
      rows.map(row => row.category),
      locale,
    ),
  };
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

/**
 * Same anchor-and-renumber algorithm as `moveProject` — see that function for why the action
 * sends the record it now FOLLOWS rather than an index or a whole ordering, and
 * `common/utils/reorder.ts` for the arithmetic itself.
 *
 * `null` when nothing happened: an unknown id, an anchor that has since been deleted, or a
 * drop back where the design work already was.
 */
export async function moveDesignWork(
  id: number,
  afterId: number | null,
): Promise<{ moved: DesignWorkRow; changed: DesignWorkRow[] } | null> {
  const rows = await designWorkRepo.list();
  const plan = planReorder(rows, id, afterId);
  if (!plan) return null;

  await Promise.all(
    plan.writes.map(write => designWorkRepo.update(write.row.id, { sortOrder: write.sortOrder })),
  );

  return { moved: plan.moved, changed: plan.writes.map(write => write.row) };
}
