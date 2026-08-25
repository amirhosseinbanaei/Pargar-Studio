// src/modules/projects/lib/filters.ts
/**
 * The four project filters, as URL state.
 *
 * WHERE THIS STATE LIVES, and why. The state decision table's third row: anything that
 * should survive a refresh, be shareable as a link and drive the back button belongs in
 * the URL. All three apply here and none of them worked on the legacy site, where filters
 * were fields on a `state` object held in a `WeakMap` keyed by the panel element
 * (`legacy/js/ui/panel.js:65`). A filtered view could not be linked, bookmarked, or
 * reached with the Back button, and reloading the page dropped it.
 *
 * As `searchParams` the server reads them, so the filtering happens before the HTML is
 * written: 76 cards are not shipped and then hidden with a class, the matching ones are
 * rendered and the rest never exist. That also means no filter code reaches the browser.
 *
 * THE PREDICATES are ported one for one from `legacy/data/projects.js:426`. The one that
 * matters is `type`: a project carries an ARRAY of types (`['Residential', 'Interior
 * Design']`), so the test is `includes`, not equality. Written as equality it would drop
 * every multi-type project from every type filter — silently, and only for the projects
 * that are hardest to notice missing.
 */
import type { Project } from '@/common/schemas/project';

export const FILTER_KEYS = ['type', 'status', 'scale', 'year'] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** One selected value per axis, or none. Mirrors the legacy single-select-per-group rail. */
export type ProjectFilters = Partial<Record<FilterKey, string>>;

/**
 * The raw shape `await searchParams` produces. A repeated key arrives as an array, which
 * is why every read below narrows before using it — `?type=A&type=B` would otherwise flow
 * a `string[]` into a string comparison that always fails.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Read the four filters out of the query string.
 *
 * Deliberately NOT validated against the taxonomy. An unknown value simply matches nothing
 * and the empty state says so, which is the honest answer to `?type=Nonsense`; rejecting
 * it with `notFound()` would turn a stale bookmark from someone else's link into a 404,
 * and validating against the derived taxonomy would make a hand-typed URL fail for a
 * category that merely happens to be empty today.
 */
export function parseProjectFilters(searchParams: RawSearchParams): ProjectFilters {
  const filters: ProjectFilters = {};
  for (const key of FILTER_KEYS) {
    const value = first(searchParams[key]);
    if (value !== undefined) filters[key] = value;
  }
  return filters;
}

/** `legacy/data/projects.js:426` — the four `match` predicates, unchanged. */
export function matchesFilters(project: Project, filters: ProjectFilters): boolean {
  if (filters.type !== undefined && !project.types.includes(filters.type)) return false;
  if (filters.status !== undefined && project.status !== filters.status) return false;
  if (filters.scale !== undefined && project.scale !== filters.scale) return false;
  // The year filter's option values are strings, because that is what a URL carries.
  if (filters.year !== undefined && String(project.year) !== filters.year) return false;
  return true;
}

export function filterProjects(projects: readonly Project[], filters: ProjectFilters): Project[] {
  return projects.filter(project => matchesFilters(project, filters));
}

/**
 * The href for toggling one option.
 *
 * Selecting an option in a group REPLACES that group's value (one per axis, as the legacy
 * rail did) and clicking the selected one clears it, so a filter is its own off switch.
 * Every other axis is preserved, which is what makes the rail composable without any
 * client state to keep in sync.
 */
export function toggleFilterHref(
  basePath: string,
  current: ProjectFilters,
  key: FilterKey,
  value: string,
): string {
  const next: ProjectFilters = { ...current };
  if (next[key] === value) delete next[key];
  else next[key] = value;

  // Emitted in FILTER_KEYS order, not insertion order, so the same selection always
  // produces the same URL — two links to one view is a cache miss and a confusing history.
  const query = new URLSearchParams();
  for (const filterKey of FILTER_KEYS) {
    const filterValue = next[filterKey];
    if (filterValue !== undefined) query.set(filterKey, filterValue);
  }

  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** Counts for one axis, computed with that axis's own filter removed. */
export function optionCount(
  projects: readonly Project[],
  filters: ProjectFilters,
  key: FilterKey,
  value: string,
): number {
  // `legacy/js/ui/panel.js:715`: the count beside an option answers "how many would I get
  // if I picked this", so the axis being counted is excluded from the rest of the
  // selection. Counting with it applied shows `0` beside every unselected option in the
  // group the reader is currently looking at — which reads as a bug.
  const rest: ProjectFilters = { ...filters };
  delete rest[key];
  return projects.filter(
    project => matchesFilters(project, rest) && matchesFilters(project, { [key]: value }),
  ).length;
}

export function hasAnyFilter(filters: ProjectFilters): boolean {
  return FILTER_KEYS.some(key => filters[key] !== undefined);
}
