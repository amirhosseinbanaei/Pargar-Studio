// src/modules/media/components/MediaCard.tsx
/**
 * One media entry in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:259`.
 *
 * ─── THE SEEDED-FROM-THE-PROJECT DRAWING IS GONE (prompt 14) ──────────────────────
 * This card used to draw a picture seeded from the RELATED project's slug and steered by
 * that project's types, so a press cutting about Qeytarieh 08 carried the same picture the
 * project itself did. Prompt 14 removed the generated fallback for records, so an entry
 * shows its own uploaded cover or an empty frame.
 *
 * `projectTypes` therefore has no consumer here and is gone with it. The RULE it served is
 * not lost, only its implementation: an entry with no cover of its own now shows nothing
 * rather than borrowing the building's drawing, and an editor who wants the building's
 * photograph on a cutting uploads it. That is a real change and is recorded in AGENTS.md.
 *
 * `outlet` is bidi-isolated with `<Lat>`: it is Latin in some records and Persian in
 * others (`legacy/data/works.fa.js:283` keeps "ArchDaily"), and an un-isolated Latin run
 * inside Persian scrambles at a line boundary.
 */
import Link from 'next/link';
import { CardPlate } from '@/common/components/collection';
import { Lat } from '@/common/components/layout';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Media } from '@/common/schemas/media';

export interface MediaCardProps {
  entry: Media;
  dictionary: Dictionary;
}

export function MediaCard({ entry, dictionary }: MediaCardProps) {
  const { t, num, term, locale } = dictionary;

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/media/${entry.slug}`)}
      data-cursor={t('ui.view')}
    >
      {/* The entry's own cover, or an empty frame — since prompt 14 there is no drawing to
          fall back to. */}
      <CardPlate image={entry.cover} />
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
