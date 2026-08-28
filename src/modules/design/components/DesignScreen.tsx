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
import type { TermOption } from '@/common/schemas/taxonomy';
import { DesignCard } from './DesignCard';

const GRID_ID = 'design-grid';

/** The query-string key the rail writes. `category` is the column it filters. */
export const DESIGN_FACET = 'category';

export interface DesignScreenProps {
  works: readonly DesignWork[];
  /**
   * The category options, from `taxonomy_terms` via `getDesignWorkFilters()` — visible terms
   * some work actually uses, in the order an editor chose, plus any value a work carries
   * that no term declares.
   */
  categories: readonly TermOption[];
  /** The selected category, or undefined for all nine. */
  category: string | undefined;
  basePath: string;
  dictionary: Dictionary;
}

export function DesignScreen({
  works,
  categories,
  category,
  basePath,
  dictionary,
}: DesignScreenProps) {
  const { t, num, term } = dictionary;

  /**
   * THE OPTIONS COME FROM THE TERMS TABLE; THE COUNTS COME FROM THESE ROWS.
   *
   * Until prompt 9 both were derived from the rows, which is why a category could not be
   * reordered, retired or relabelled without a deploy. The service now composes the option
   * list (see `getDesignWorkFilters`) and this screen only counts, because it already holds
   * every work for the grid below.
   *
   * `label` is `null` for a value no term declares, and falls through to the catalog's
   * `cat.*` group, which itself degrades to the raw value — the same three-step the projects
   * rail applies. Note the group name is `cat` while the column is `category`; AGENTS.md
   * records that catalog keys are never renamed.
   */
  const options: FacetOption[] = categories.map(option => ({
    value: option.value,
    label: option.label ?? term('cat', option.value),
    count: works.filter(work => work.category === option.value).length,
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
