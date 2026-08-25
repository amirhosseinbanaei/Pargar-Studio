// src/modules/projects/components/ProjectFilterRail.tsx
/**
 * The filter rail — four groups of links, and no client JavaScript at all.
 *
 * Every option is an `<a>` whose href is this view plus or minus one filter, so selecting
 * one is a navigation the server answers with the filtered grid already rendered. The
 * legacy rail was a `click` handler mutating an object and toggling an `is-out` class on
 * 76 nodes (`legacy/js/ui/panel.js:643`); the visible behaviour is the same and everything
 * behind it is different — the URL is the state, the Back button walks the filter history,
 * and the view is linkable.
 *
 * The groups are `<details>`/`<summary>`, which is the accordion the legacy
 * `aria-expanded` button was hand-building. `route.css` restates the two `panel.css` rules
 * that keyed off `aria-expanded` so the caret and the colour still work.
 *
 * The first group is open by default and the rest are closed, matching `syncRailDefault`
 * at `legacy/js/ui/panel.js:74` — and, like it, that is a default rather than a rule: a
 * `<details>` the reader opens stays open until the navigation replaces it. Which is the
 * one behaviour URL state does NOT preserve, and the trade is worth stating: the filter
 * survives a reload and a shared link; which drawers were open does not.
 */
import Link from 'next/link';
import type { Dictionary } from '@/common/i18n';
import type { Project } from '@/common/schemas/project';
import {
  FILTER_KEYS,
  hasAnyFilter,
  optionCount,
  toggleFilterHref,
  type FilterKey,
  type ProjectFilters,
} from '../lib/filters';

/** The option values per axis, derived from the rows that exist by `getProjectFilters()`. */
export interface FilterTaxonomy {
  types: string[];
  statuses: string[];
  scales: string[];
  years: string[];
}

export interface ProjectFilterRailProps {
  taxonomy: FilterTaxonomy;
  filters: ProjectFilters;
  /** Every project, unfiltered — the counts are computed against the whole archive. */
  projects: readonly Project[];
  /** How many the current selection leaves. */
  shown: number;
  basePath: string;
  dictionary: Dictionary;
}

const OPTIONS_BY_KEY: Record<FilterKey, keyof FilterTaxonomy> = {
  type: 'types',
  status: 'statuses',
  scale: 'scales',
  year: 'years',
};

export function ProjectFilterRail({
  taxonomy,
  filters,
  projects,
  shown,
  basePath,
  dictionary,
}: ProjectFilterRailProps) {
  const { t, num, term } = dictionary;

  return (
    <div className="route__rail">
      <p className="fcount">{`${num(shown)} ${t('ui.projectsCount')}`}</p>

      {FILTER_KEYS.map((key, index) => (
        <details className="fgroup" key={key} data-group={key} open={index === 0}>
          <summary className="fgroup__head">
            <span>{t(`filter.${key}`)}</span>
            <svg className="fgroup__caret" viewBox="0 0 8 8" aria-hidden="true">
              <line x1="0" y1="4" x2="8" y2="4" />
              <line x1="4" y1="0" x2="4" y2="8" />
            </svg>
          </summary>
          <div className="fgroup__body">
            <ul className="fgroup__list">
              {taxonomy[OPTIONS_BY_KEY[key]].map(value => {
                const selected = filters[key] === value;
                return (
                  <li key={value}>
                    <Link
                      className="fopt magnet"
                      href={toggleFilterHref(basePath, filters, key, value)}
                      aria-current={selected ? 'true' : undefined}
                      // Filtering swaps content inside the current view; jumping to the
                      // top would lose the reader's place in a 76-card grid.
                      scroll={false}
                    >
                      {/* Years are values, not vocabulary — they are shaped, not looked up. */}
                      <span>{key === 'year' ? num(value) : term(key, value)}</span>
                      <span className="fopt__n">
                        {num(optionCount(projects, filters, key, value))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      ))}

      {/* Only rendered when there is something to clear: a permanently visible "Clear all"
          that does nothing is a control that teaches the reader to ignore controls. */}
      {hasAnyFilter(filters) && (
        <Link className="frow-clear magnet" href={basePath} scroll={false}>
          {t('ui.clearAll')}
        </Link>
      )}
    </div>
  );
}
