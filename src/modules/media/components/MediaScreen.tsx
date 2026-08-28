// src/modules/media/components/MediaScreen.tsx
/**
 * The media index: the kind rail beside the fourteen entries.
 *
 * A Server Component in full, filtered on the server, with `CardReveal` as its only
 * client JavaScript — the same shape as the projects and design lists.
 *
 * IT TAKES THE PROJECT LIST, and that is not incidental. Every card's drawing is seeded
 * from the building the piece is about, and `kindFor` needs that project's TYPES to
 * choose a generator (`legacy/js/ui/panel.js:264`). Resolving fourteen projects one at a
 * time would be fourteen cached reads to answer one question; the archive is one cached
 * read, and the page hands it in.
 */
import { CardReveal, FacetRail, type FacetOption } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import type { Media } from '@/common/schemas/media';
import type { Project } from '@/common/schemas/project';
import type { TermOption } from '@/common/schemas/taxonomy';
import { MediaCard } from './MediaCard';

const GRID_ID = 'media-grid';

/** The query-string key the rail writes. `type` is the column it filters. */
export const MEDIA_FACET = 'type';

export interface MediaScreenProps {
  entries: readonly Media[];
  /** The whole archive, for the card seeds. Missing slugs simply draw from their own. */
  projects: readonly Project[];
  /** The kind options, from `taxonomy_terms` via `getMediaFilters()`. */
  kinds: readonly TermOption[];
  /** The selected kind, or undefined for all fourteen. */
  type: string | undefined;
  basePath: string;
  dictionary: Dictionary;
}

export function MediaScreen({
  entries,
  projects,
  kinds,
  type,
  basePath,
  dictionary,
}: MediaScreenProps) {
  const { t, num, term } = dictionary;

  const typesBySlug = new Map(projects.map(project => [project.slug, project.types]));

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
            <MediaCard
              key={entry.slug}
              entry={entry}
              projectTypes={
                (entry.projectSlug ? typesBySlug.get(entry.projectSlug) : undefined) ?? []
              }
              dictionary={dictionary}
            />
          ))}
        </div>

        {shown.length === 0 && <p className="empty">{t('filter.noKind')}</p>}

        <CardReveal gridId={GRID_ID} />
      </div>
    </div>
  );
}
