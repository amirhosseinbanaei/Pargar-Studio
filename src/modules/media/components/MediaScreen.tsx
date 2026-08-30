// src/modules/media/components/MediaScreen.tsx
/**
 * The media index: the kind rail beside the fourteen entries.
 *
 * A Server Component in full, filtered on the server, with `CardReveal` as its only
 * client JavaScript — the same shape as the projects and design lists.
 *
 * ─── IT NO LONGER TAKES THE PROJECT ARCHIVE (prompt 14) ──────────────────────────
 * It used to, and that was not incidental: every card's DRAWING was seeded from the
 * building the piece was about, and choosing a generator needed that project's types
 * (`legacy/js/ui/panel.js:264`), so this screen read all 76 projects to render 14 cards.
 *
 * Prompt 14 removed the generated fallback for records — a card shows the entry's own
 * uploaded cover or an empty frame — so nothing here needs a seed and the second read is
 * gone with it. The list route makes one cached call instead of two.
 */
import { CardReveal, FacetRail, type FacetOption } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import type { Media } from '@/common/schemas/media';
import type { TermOption } from '@/common/schemas/taxonomy';
import { MediaCard } from './MediaCard';

const GRID_ID = 'media-grid';

/** The query-string key the rail writes. `type` is the column it filters. */
export const MEDIA_FACET = 'type';

export interface MediaScreenProps {
  entries: readonly Media[];
  /** The kind options, from `taxonomy_terms` via `getMediaFilters()`. */
  kinds: readonly TermOption[];
  /** The selected kind, or undefined for all fourteen. */
  type: string | undefined;
  basePath: string;
  dictionary: Dictionary;
}

export function MediaScreen({ entries, kinds, type, basePath, dictionary }: MediaScreenProps) {
  const { t, num, term } = dictionary;

  // Options from the terms table, counts from these rows — see `DesignScreen` for the full
  // reasoning. The catalog group is `kind` while the column and the axis are both `type`.
  const options: FacetOption[] = kinds.map(option => ({
    value: option.value,
    label: option.label ?? term('kind', option.value),
    count: entries.filter(entry => entry.type === option.value).length,
  }));

  const shown = type ? entries.filter(entry => entry.type === type) : entries;

  return (
    <div className="route" id="main">
      <FacetRail
        facetKey={MEDIA_FACET}
        label={t('filter.kind')}
        options={options}
        selected={type}
        basePath={basePath}
        countLabel={`${num(shown.length)} ${t('ui.entriesCount')}`}
        dictionary={dictionary}
      />

      <div className="route__main">
        <div className="grid" id={GRID_ID}>
          {shown.map(entry => (
            <MediaCard key={entry.slug} entry={entry} dictionary={dictionary} />
          ))}
        </div>

        {shown.length === 0 && <p className="empty">{t('filter.noKind')}</p>}

        <CardReveal gridId={GRID_ID} />
      </div>
    </div>
  );
}
