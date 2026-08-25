// src/common/utils/facets.ts
/**
 * Single-axis filtering, as URL state.
 *
 * The Design and Media lists filter on one axis each — category and kind. Both need the
 * same two operations and neither may import the other, so the operations live here:
 * pure string work over `searchParams`, with no knowledge of either resource.
 *
 * WHY THE URL. The same reason the projects rail uses it (`modules/projects/lib/filters.ts`):
 * a filtered view survives a reload, can be sent to someone, and is walked by the Back
 * button. The legacy panels held their selection in a `WeakMap` keyed by the panel element
 * (`legacy/js/ui/panel.js:65`), so none of the three were true.
 *
 * An unknown value is deliberately NOT rejected. `?category=Nonsense` matches nothing and
 * the empty state says so, which is the honest answer; a `notFound()` would turn someone
 * else's stale link into a 404, and validating against the values that happen to exist
 * today would 404 a category the dashboard has merely emptied.
 */

/** The raw shape `await searchParams` produces; a repeated key arrives as an array. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Read one facet out of the query string. A repeated key takes its first value rather
 * than flowing a `string[]` into a comparison that would always be false.
 */
export function parseFacet(searchParams: RawSearchParams, key: string): string | undefined {
  const raw = searchParams[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The href that TOGGLES this option: selecting it when it is not selected, and clearing
 * the filter when it is. That is the legacy rail's behaviour (`legacy/js/ui/panel.js:660`
 * cleared a group by re-pressing its active option) and it is what makes a single-select
 * rail navigable without a separate "all" entry.
 */
export function facetHref(
  basePath: string,
  key: string,
  value: string,
  selected: string | undefined,
): string {
  if (selected === value) return basePath;
  return `${basePath}?${new URLSearchParams({ [key]: value }).toString()}`;
}
