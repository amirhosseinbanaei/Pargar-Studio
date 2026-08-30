// src/common/components/collection/FacetRail.tsx
/**
 * A one-axis filter rail: a count, one group of options, and a clear link.
 *
 * The Design and Media panels each had exactly one filter group — category and kind
 * (`legacy/js/ui/panel.js:215` and `:279`) — against the projects panel's four. This is
 * that rail, shared by both, because two copies of it would be two places to fix the
 * `aria-current` spelling that `route.css` colours off.
 *
 * It is NOT the projects rail generalized. That one carries cross-axis counting (an
 * option's number excludes its own axis, `legacy/js/ui/panel.js:715`), which is
 * meaningless with one axis; folding both into one component would put a branch in the
 * middle of the interesting logic to serve a case that has no logic at all.
 *
 * Every option is a `<Link>`, so selecting one is a navigation the server answers with
 * the filtered grid already rendered: no client state, a linkable view, and a Back button
 * that walks the filter history.
 *
 * SINCE PROMPT 12 IT IS WRAPPED IN `RailDrawer`, and this file's own markup did not change
 * for it: the group, the options and the clear link are handed over as children, and the
 * count moved into the wrapper because the narrow-screen bar is what renders it. Above
 * 900px the result is the rail exactly as it was. This component stays a Server Component
 * — `RailDrawer` is the one `'use client'` leaf, and it is a leaf.
 */
import Link from 'next/link';
import type { Dictionary } from '@/common/i18n';
import { facetHref } from '@/common/utils/facets';
import { RailDrawer } from './RailDrawer';

export interface FacetOption {
  /** The raw, canonical-English value that goes in the URL. */
  value: string;
  /** Already translated by the caller — it owns which `term()` group applies. */
  label: string;
  count: number;
}

export interface FacetRailProps {
  /** The query-string key this rail writes, e.g. `category`. */
  facetKey: string;
  /** The group heading. */
  label: string;
  options: readonly FacetOption[];
  /** The currently selected value, if any. */
  selected: string | undefined;
  /** The route without a query string. */
  basePath: string;
  /** How many records the current selection leaves, and the noun for them. */
  countLabel: string;
  dictionary: Dictionary;
}

export function FacetRail({
  facetKey,
  label,
  options,
  selected,
  basePath,
  countLabel,
  dictionary,
}: FacetRailProps) {
  const { t, num } = dictionary;

  return (
    <RailDrawer
      countLabel={countLabel}
      filterLabel={t('ui.filter')}
      closeLabel={t('ui.close')}
      hasActiveFilter={selected !== undefined}
    >
      {/* `<details>` is the accordion the legacy `aria-expanded` button hand-built, and it
          works with no JavaScript. Open by default: with a single group there is nothing
          below it to push off the fold. */}
      <details className="fgroup" data-group={facetKey} open>
        <summary className="fgroup__head">
          <span>{label}</span>
          <svg className="fgroup__caret" viewBox="0 0 8 8" aria-hidden="true">
            <line x1="0" y1="4" x2="8" y2="4" />
            <line x1="4" y1="0" x2="4" y2="8" />
          </svg>
        </summary>
        <div className="fgroup__body">
          <ul className="fgroup__list">
            {options.map(option => (
              <li key={option.value}>
                <Link
                  className="fopt magnet"
                  href={facetHref(basePath, facetKey, option.value, selected)}
                  aria-current={selected === option.value ? 'true' : undefined}
                  // Filtering swaps content inside the current view; jumping to the top
                  // would lose the reader's place in the grid.
                  scroll={false}
                >
                  <span>{option.label}</span>
                  <span className="fopt__n">{num(option.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* Only when there is something to clear: a permanently visible control that does
          nothing teaches the reader to ignore controls. */}
      {selected !== undefined && (
        <Link className="frow-clear magnet" href={basePath} scroll={false}>
          {t('ui.clearAll')}
        </Link>
      )}
    </RailDrawer>
  );
}
