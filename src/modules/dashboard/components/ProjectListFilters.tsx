// src/modules/dashboard/components/ProjectListFilters.tsx
/**
 * Search and the four filters, as a NATIVE GET FORM.
 *
 * ─── NO JAVASCRIPT, DELIBERATELY ──────────────────────────────────────────────────
 * A `<form method="get">` writes its own controls into the query string when it submits.
 * That is the entire mechanism: no `onChange`, no `router.push`, no debounce, no client
 * component, and nothing shipped to the browser. It also means the filters work before
 * hydration and with scripting disabled, and — the part that actually matters day to day —
 * a filtered view is a URL that can be bookmarked, shared and undone with the back button.
 *
 * The alternative, a controlled client form pushing to the router on every keystroke, needs
 * a debounce to avoid a navigation per character, and the debounce is where the bugs live.
 *
 * ─── WHY THE SORT IS A HIDDEN INPUT ───────────────────────────────────────────────
 * A GET form REPLACES the query string with exactly its own fields. Without these two hidden
 * inputs, submitting a search would silently discard the sort the reader had chosen from the
 * table header — the classic "my filter reset my sort" bug, and it has no visible cause.
 *
 * A Server Component. `defaultValue` rather than `value`, because these controls are
 * uncontrolled by design: that is what lets the form submit without React being involved.
 */
import Link from 'next/link';
import { Button, Input } from '@/common/components/ds';
import {
  PROJECT_FILTER_KEYS,
  type ProjectFilterKey,
  type ProjectListQuery,
} from '../lib/project-list';

const FILTER_LABELS: Record<ProjectFilterKey, string> = {
  type: 'Type',
  status: 'Status',
  scale: 'Scale',
  year: 'Year',
};

export interface ProjectListFiltersProps {
  action: string;
  query: ProjectListQuery;
  facets: Record<ProjectFilterKey, string[]>;
  sort: { key: string | null; direction: 'asc' | 'desc' };
  /** Shown beside the controls: how many of how many. */
  matched: number;
  total: number;
  /** Where "Clear" goes — the bare list path, with nothing on it. */
  clearHref: string;
  showClear: boolean;
}

export function ProjectListFilters({
  action,
  query,
  facets,
  sort,
  matched,
  total,
  clearHref,
  showClear,
}: ProjectListFiltersProps) {
  return (
    <form method="get" action={action} className="flex flex-col gap-4">
      {/* Carry the sort across a filter submit — see the header. */}
      {sort.key && <input type="hidden" name="sort" value={sort.key} />}
      {sort.key && sort.direction === 'desc' && <input type="hidden" name="dir" value="desc" />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <label
            htmlFor="project-search"
            className="text-fs-xs tracking-mid-kavan text-t-lo uppercase"
          >
            Search
          </label>
          <Input
            id="project-search"
            name="q"
            type="search"
            defaultValue={query.search}
            placeholder="Slug, English title, or Persian title"
          />
        </div>

        {PROJECT_FILTER_KEYS.map(key => (
          <div key={key} className="flex min-w-[9rem] flex-col gap-1.5">
            <label
              htmlFor={`project-${key}`}
              className="text-fs-xs tracking-mid-kavan text-t-lo uppercase"
            >
              {FILTER_LABELS[key]}
            </label>
            {/*
              A native `<select>`, NOT `ds/Select`. The design system's Select is a Radix
              combobox — a button plus a portalled listbox — which is a better control in
              every way except the one that matters here: it renders no form-associated
              element, so a GET form submits nothing for it. Using it would mean giving up
              the no-JavaScript submit that is this component's whole point.
              It is styled with the same tokens so the two read as one family.
            */}
            <select
              id={`project-${key}`}
              name={key}
              defaultValue={query.filters[key] ?? ''}
              className="h-control cursor-pointer rounded-control border border-rule bg-s-4 px-3 text-fs-sm tracking-tight-kavan text-t-hi outline-none focus:border-a-1"
            >
              <option value="">Any</option>
              {facets[key].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}

        <Button type="submit" variant="outline" size="md">
          Apply
        </Button>

        {showClear && (
          <Button variant="ghost" size="md" asChild>
            <Link href={clearHref}>Clear</Link>
          </Button>
        )}
      </div>

      {/*
        `aria-live="polite"` so the count is announced after a filter is applied. The page
        navigated, so a sighted reader sees the table change; without this a screen-reader
        user gets no signal that anything happened at all.
      */}
      <p aria-live="polite" className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
        {matched === total ? `${total} projects` : `${matched} of ${total} projects`}
      </p>
    </form>
  );
}
