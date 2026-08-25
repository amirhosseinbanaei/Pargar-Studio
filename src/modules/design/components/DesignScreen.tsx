// src/modules/design/components/DesignScreen.tsx
/**
 * The design index: the category rail beside the grid of nine works.
 *
 * A Server Component in full. The only JavaScript it ships is `CardReveal`, which adds
 * one class — the cards, their drawings, the filter links and the counts are all in the
 * HTML the server wrote.
 *
 * Filtering happens HERE, before the response: the legacy panel rendered all nine cards
 * and hid the non-matching ones with `.is-out` (`legacy/js/ui/panel.js:643`). There is no
 * reason to ship what you are about to hide, and no reason for a filter to cost a
 * round-trip through the browser.
 */
import { CardReveal, FacetRail, type FacetOption } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import type { DesignWork } from '@/common/schemas/design-work';
import { DesignCard } from './DesignCard';

const GRID_ID = 'design-grid';

/** The query-string key the rail writes. `category` is the column it filters. */
export const DESIGN_FACET = 'category';

export interface DesignScreenProps {
  works: readonly DesignWork[];
  /** The selected category, or undefined for all nine. */
  category: string | undefined;
  basePath: string;
  dictionary: Dictionary;
}

export function DesignScreen({ works, category, basePath, dictionary }: DesignScreenProps) {
  const { t, num, term } = dictionary;

  /**
   * DERIVED from the rows that exist, not a constant — the same decision
   * `getProjectFilters()` encodes (AGENTS.md). A hardcoded category list goes stale in
   * both directions: it offers a filter matching nothing the first time a category
   * empties, and hides a work the first time the dashboard adds a category nobody listed.
   */
  const categories = [...new Set(works.map(work => work.category))];
  const options: FacetOption[] = categories.map(value => ({
    value,
    label: term('cat', value),
    count: works.filter(work => work.category === value).length,
  }));

  const shown = category ? works.filter(work => work.category === category) : works;

  return (
    <div className="route" id="main">
      <FacetRail
        facetKey={DESIGN_FACET}
        label={t('filter.category')}
        options={options}
        selected={category}
        basePath={basePath}
        countLabel={`${num(shown.length)} ${t('ui.worksCount')}`}
        dictionary={dictionary}
      />

      <div className="route__main">
        <div className="grid" id={GRID_ID}>
          {shown.map(work => (
            <DesignCard key={work.slug} work={work} dictionary={dictionary} />
          ))}
        </div>

        {shown.length === 0 && <p className="empty">{t('filter.nothing')}</p>}

        <CardReveal gridId={GRID_ID} />
      </div>
    </div>
  );
}
