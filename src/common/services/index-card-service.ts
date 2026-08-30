// src/common/services/index-card-service.ts
/**
 * RING 3 — the five index cards. See `./project-service` for the caching and locale
 * reasoning every service in this ring follows.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { NAV } from '@/common/constants/site';
import {
  emptyIndexCard,
  toLocaleIndexCard,
  type IndexCard,
  type IndexCardRow,
  type IndexCardUpdate,
} from '@/common/schemas/index-card';
import type { Locale } from '@/common/schemas/locale';
import * as indexCardRepo from './index-card-repository';
import { CACHE_TAGS } from './cache-tags';

/**
 * The five cards, in NAV order, one per column, always.
 *
 * ─── IT DEGRADES, IT DOES NOT THROW ───────────────────────────────────────────────
 * This function cannot return four cards, or six, or a card for a section that is not on
 * the front page. It walks NAV — the constant that decides what the five columns ARE — and
 * looks each id up in whatever the table returned, so:
 *
 *  - a section with NO ROW gets `emptyIndexCard`, whose every field is `''`/`null`;
 *  - a row for an id NAV does not list is ignored, rather than rendering a sixth column
 *    the CSS and the shell transition have no place for;
 *  - an empty column stays empty here and is filled in by the renderer from `nav.<id>` /
 *    `cap.<id>`, which is what those columns have always shown.
 *
 * That is the same three-step shape the taxonomy rails use (prompt 9): the table is the
 * canon, presence gates, and the message catalog is the floor nothing falls through. It is
 * what lets this ship before anybody has opened the new editor, and it is why the migration
 * seeding five empty rows is a convenience rather than a requirement.
 *
 * No instance tag: the five rows are only ever read as a SET, so one tag identifies the
 * whole read and a per-section name would be five things to forget to purge.
 */
export async function listIndexCards(locale: Locale): Promise<IndexCard[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.indexCards);

  const rows = await indexCardRepo.list();
  const bySection = new Map(rows.map(row => [row.sectionId, row]));

  return NAV.map(section => {
    const row = bySection.get(section.id);
    return row ? toLocaleIndexCard(row, locale) : emptyIndexCard(section.id);
  });
}

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF — bilingual, uncached.                                         *
 * ═════════════════════════════════════════════════════════════════════════════════ */

/** All five rows as STORED — bilingual, uncached, for the list screen. */
export async function listIndexCardRows(): Promise<IndexCardRow[]> {
  return indexCardRepo.list();
}

/**
 * `null` when the section has no row yet. The editor renders an empty form rather than a
 * 404: unlike the studio singleton there is nothing to reconstruct, and the first save
 * writes the row — see `index-card-repository.ts`'s `upsert`.
 */
export async function getIndexCardRow(sectionId: string): Promise<IndexCardRow | null> {
  return indexCardRepo.get(sectionId);
}

/** No `createIndexCard` and no `deleteIndexCard`: the five rows are the schema's. */
export async function updateIndexCard(
  sectionId: string,
  input: IndexCardUpdate,
): Promise<IndexCardRow> {
  return indexCardRepo.upsert(sectionId, input);
}
