// src/modules/dashboard/lib/project-list.ts
/**
 * Search and the four filters for the dashboard's project list. Pure functions over rows —
 * no React, no router, no database — so the whole thing is unit-testable in milliseconds.
 *
 * ─── WHY THIS IS NOT `modules/projects/lib/filters.ts` ────────────────────────────
 * The public list and this one filter the same table on the same four axes, and they are
 * genuinely different functions rather than a missed opportunity to share:
 *
 *  - The public rail filters a `Project` — one locale, already collapsed. This filters a
 *    `ProjectRow`, bilingual, because the dashboard has to find a record by its PERSIAN
 *    title as readily as its English one. Searching only the collapsed locale would make
 *    half the archive unfindable in a tool whose entire job is finding a record to edit.
 *  - The public rail counts options excluding their own axis, so the number beside an option
 *    answers "how many would I get if I picked this" (`legacy/js/ui/panel.js:715`). A
 *    dashboard list wants the plain count of what is on screen.
 *  - There is no free-text search on the public site at all.
 *
 * The cross-module import is banned anyway, and the honest reading of that ban is that it is
 * asking the right question here: what these two share is a table, not a behaviour. Sharing
 * the behaviour would mean a function with a locale mode and a counting mode.
 *
 * `type` MATCHES WITH `includes`, NOT EQUALITY — the one rule that IS carried across
 * verbatim, because a project carries more than one type and equality silently drops every
 * multi-type project from every type filter. Prompt 4 pinned that with a test on the public
 * side; it is pinned again here.
 */
import type { ProjectRow } from '@/common/schemas/project';

export const PROJECT_FILTER_KEYS = ['type', 'status', 'scale', 'year'] as const;

export type ProjectFilterKey = (typeof PROJECT_FILTER_KEYS)[number];

export interface ProjectListQuery {
  /** Free text, matched against slug and both locales' titles. */
  search: string;
  filters: Record<ProjectFilterKey, string | null>;
}

/** What the URL carries. Next hands a repeated parameter as an array; only the first counts. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Read a query out of search parameters.
 *
 * Nothing is validated against the taxonomy here, deliberately. A filter value that matches
 * no row yields an empty list, which is the honest answer and is visibly a filter problem;
 * silently dropping an unrecognized value would show the FULL list and look like the filter
 * was ignored. The options themselves are derived from the rows that exist
 * (`projectListFacets`), so an unreachable value can only come from a hand-edited URL or a
 * stale bookmark.
 */
export function parseProjectListQuery(params: RawSearchParams): ProjectListQuery {
  return {
    search: first(params.q) ?? '',
    filters: {
      type: first(params.type),
      status: first(params.status),
      scale: first(params.scale),
      year: first(params.year),
    },
  };
}

/**
 * Case-insensitive substring match across the slug and BOTH titles.
 *
 * Not `localeCompare`-based and not fuzzy: an editor searching this list already knows what
 * they are looking for and typed part of its name. What matters is that the Persian title is
 * searched too — `toLowerCase()` is a no-op on Persian text, which is correct, since the
 * script has no case.
 */
function matchesSearch(row: ProjectRow, search: string): boolean {
  if (search === '') return true;
  const needle = search.toLowerCase();
  return (
    row.slug.toLowerCase().includes(needle) ||
    row.titleEn.toLowerCase().includes(needle) ||
    row.titleFa.includes(search)
  );
}

export function matchesProjectFilters(row: ProjectRow, query: ProjectListQuery): boolean {
  const { type, status, scale, year } = query.filters;
  // `includes`, not `===`. See the header.
  if (type !== null && !row.types.includes(type)) return false;
  if (status !== null && row.status !== status) return false;
  if (scale !== null && row.scale !== scale) return false;
  if (year !== null && String(row.year) !== year) return false;
  return matchesSearch(row, query.search);
}

export function filterProjectRows(
  rows: readonly ProjectRow[],
  query: ProjectListQuery,
): ProjectRow[] {
  return rows.filter(row => matchesProjectFilters(row, query));
}

export function hasAnyProjectFilter(query: ProjectListQuery): boolean {
  return query.search !== '' || PROJECT_FILTER_KEYS.some(key => query.filters[key] !== null);
}

/**
 * The four option lists, DERIVED from the rows that exist rather than hardcoded.
 *
 * Same rule as `getProjectFilters` on the public side, and for the same reason: a hardcoded
 * list goes stale in both directions — it offers a filter matching nothing the first time a
 * category empties, and hides a project the first time somebody introduces a value nobody
 * listed. In a dashboard the second failure is worse, because the record that cannot be
 * filtered to is a record that cannot be found to be fixed.
 *
 * Order is NOT the canonical enum order here, unlike the public rail. These are `<select>`
 * options in an admin tool, so they are sorted the way a person scans a dropdown: years
 * newest-first, everything else alphabetically.
 */
export function projectListFacets(rows: readonly ProjectRow[]): Record<ProjectFilterKey, string[]> {
  const distinct = (values: readonly string[]) => [...new Set(values)].sort();
  return {
    type: distinct(rows.flatMap(row => row.types)),
    status: distinct(rows.map(row => row.status)),
    scale: distinct(rows.map(row => row.scale)),
    year: [...new Set(rows.map(row => row.year))].sort((a, b) => b - a).map(String),
  };
}

/**
 * Build a list URL from a query plus a sort, dropping every empty parameter.
 *
 * Dropping them matters more than it looks: a URL carrying `?q=&type=&status=&scale=&year=`
 * is a different string from the bare path, so the "no filters" state would have two
 * spellings — and the two would cache separately, read differently in a bookmark, and make
 * `hasAnyProjectFilter` disagree with what the address bar shows.
 */
export function projectListHref(
  base: string,
  query: ProjectListQuery,
  sort?: { key: string | null; direction: 'asc' | 'desc' },
): string {
  const params = new URLSearchParams();
  if (query.search !== '') params.set('q', query.search);
  for (const key of PROJECT_FILTER_KEYS) {
    const value = query.filters[key];
    if (value !== null) params.set(key, value);
  }
  if (sort?.key) {
    params.set('sort', sort.key);
    // `asc` is the default, so it is never written — one fewer parameter in every link, and
    // one fewer way to spell the same view.
    if (sort.direction === 'desc') params.set('dir', 'desc');
  }
  const search = params.toString();
  return search === '' ? base : `${base}?${search}`;
}
