// src/modules/media/components/MediaCard.tsx
/**
 * One media entry in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:259`, including the one thing about it that is not
 * obvious: THE PLATE SHOWS THE BUILDING, NOT THE PUBLICATION. The drawing is seeded from
 * the related project's slug and steered by that project's types, so a press cutting about
 * Qeytarieh 08 carries the same picture the project itself does. An entry with no project
 * — four of the fourteen are about the practice rather than a building — falls back to its
 * own slug, which is why the seed is computed rather than assumed.
 *
 * `outlet` is bidi-isolated with `<Lat>`: it is Latin in some records and Persian in
 * others (`legacy/data/works.fa.js:283` keeps "ArchDaily"), and an un-isolated Latin run
 * inside Persian scrambles at a line boundary.
 */
import Link from 'next/link';
import { CardPlate } from '@/common/components/collection';
import { Lat } from '@/common/components/layout';
import { kindFor } from '@/common/lib/art';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Media } from '@/common/schemas/media';

export interface MediaCardProps {
  entry: Media;
  /** The related project's types, or empty when the entry has no project (or it is gone). */
  projectTypes: readonly string[];
  dictionary: Dictionary;
}

export function MediaCard({ entry, projectTypes, dictionary }: MediaCardProps) {
  const { t, num, term, locale } = dictionary;
  const seed = entry.projectSlug ?? entry.slug;
  const kind = kindFor(seed, projectTypes);

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/media/${entry.slug}`)}
      data-cursor={t('ui.view')}
    >
      {/* An entry with its own cover shows it; without one the drawing is seeded from the
          related PROJECT, which is the rule this card exists to preserve. */}
      <CardPlate image={entry.cover} kind={kind} seed={seed} />
      <span className="card__body">
        <span className="card__title">{entry.title}</span>
        <span className="card__year">{num(entry.year)}</span>
      </span>
      <span className="card__meta">
        <Lat>{entry.outlet}</Lat>
        {` — ${term('kind', entry.type)}`}
      </span>
      <span className="card__note">{entry.blurb}</span>
    </Link>
  );
}
