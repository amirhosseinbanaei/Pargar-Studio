// src/modules/media/components/MediaDetail.tsx
/**
 * One media entry — a publication, an award, a lecture or an exhibition.
 *
 * Ported from `legacy/js/ui/panel.js:293`. The excerpt is the centrepiece: the eyebrow
 * names the outlet, kind and year, the pull-quote carries the passage with its byline, and
 * the studio's own note on the piece sits beside the specification column.
 *
 * THE RELATED PROJECT IS A REAL LINK, and it is resolved before it is rendered. The route
 * looks the slug up and hands in the project or `null`; a record pointing at a project
 * that has been un-published or re-slugged renders the rest of the page with NO link
 * rather than an href that 404s. The join is deliberately not a foreign key
 * (`common/schemas/media.ts`) — a press cutting about a building does not stop existing
 * when the building leaves the site — so tolerating a miss is the read side of that
 * decision, not a defensive habit.
 *
 * `outlet` is bidi-isolated in all three places it appears. It is Latin in some records
 * and Persian in others, and the isolation is a no-op in English.
 *
 * `author` is empty for the five award records. `SpecRow` and the quote footer both drop
 * out on an empty value rather than printing a blank byline.
 *
 * ─── THE DRAWINGS ARE GONE, AND SO IS THE BORROWED SEED (prompt 14) ──────────────
 * Both pictures on this page used to be generated: the plates at the head and the
 * related-project thumbnail, each seeded from the PROJECT's slug so a cutting carried the
 * building. Prompt 14 removed the generated fallback for records, so both now show a real
 * photograph or nothing — the entry's own for the head, the project's own for the
 * thumbnail. An entry with no pictures starts at its eyebrow.
 */
import Link from 'next/link';
import {
  BackLink,
  DetailPlates,
  GalleryBand,
  HEAD_PLATE_COUNT,
  SpecRow,
} from '@/common/components/collection';
import Image from 'next/image';
import { Lat } from '@/common/components/layout';
import { mediaUrl } from '@/common/constants/uploads';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Media } from '@/common/schemas/media';
import type { Project } from '@/common/schemas/project';

/**
 * `.relate__f` is `width: 8.5rem` in `panel.css:705`, dropping to 6rem below 860px. Two
 * fixed widths and no fluid term at all, so the string is those two numbers and nothing is
 * derived — this is the one image on the site whose box never depends on the viewport.
 */
const RELATE_SIZES = '(max-width: 860px) 6rem, 8.5rem';

export interface MediaDetailProps {
  entry: Media;
  /** Resolved by the route. `null` when the entry names no project, or names a missing one. */
  project: Project | null;
  dictionary: Dictionary;
}

export function MediaDetail({ entry, project, dictionary }: MediaDetailProps) {
  const { t, num, term, locale } = dictionary;

  // Cover first, then the gallery this table gained in prompt 14 — one list, split by the
  // head's own capacity so nothing is shown twice. See `ProjectDetail`.
  const images = [...(entry.cover ? [entry.cover] : []), ...entry.gallery];

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <article className="detail">
          <BackLink href={localeHref(locale, '/media')} label={t('ui.allMedia')} />

          <p className="detail__eyebrow">
            <Lat>{entry.outlet}</Lat>
            {` · ${term('kind', entry.type)} · ${num(entry.year)}`}
          </p>
          <h1 className="detail__title">{entry.title}</h1>

          <blockquote className="quote">
            <p className="quote__t">{entry.excerpt}</p>
            {entry.author && (
              <footer className="quote__a">
                {`${entry.author}, `}
                <Lat>{entry.outlet}</Lat>
              </footer>
            )}
          </blockquote>

          <DetailPlates images={images} />

          <div className="detail__cols">
            <div className="spec">
              <SpecRow label={t('spec.outlet')} value={<Lat>{entry.outlet}</Lat>} />
              <SpecRow label={t('spec.year')} value={num(entry.year)} />
              <SpecRow label={t('filter.kind')} value={term('kind', entry.type)} />
              <SpecRow label={t('spec.author')} value={entry.author} />
              {/* Both halves of a fact are translated — see `DesignDetail` for why this
                  renders from the record rather than from a label list. */}
              {entry.facts.map(fact => (
                <SpecRow key={fact.k} label={fact.k} value={fact.v} />
              ))}
            </div>

            <div>
              <h2 className="sheet__h sheet__h--flush">{t('media.note')}</h2>
              <div className="prose">
                <p>{entry.context}</p>
              </div>

              {project && (
                <>
                  <h2 className="sheet__h">{t('media.related')}</h2>
                  <Link
                    className="relate magnet"
                    href={localeHref(locale, `/projects/${project.slug}`)}
                    data-cursor={t('ui.view')}
                  >
                    {/*
                      THE PROJECT'S OWN PHOTOGRAPH, OR AN EMPTY FRAME. This was a drawing
                      seeded from the project's slug until prompt 14 — the same rule the
                      cards followed, applied to a second slot outside `DetailPlates`. The
                      frame is kept for the same reason `CardPlate` keeps its own: it holds
                      the link's proportions, and dropping it would collapse the row.
                    */}
                    <span className="relate__f">
                      {project.cover && (
                        <Image
                          src={mediaUrl(project.cover.path)}
                          alt={project.cover.alt}
                          fill
                          sizes={RELATE_SIZES}
                          className="relate__photo"
                        />
                      )}
                    </span>
                    <span className="relate__b">
                      <span className="relate__t">{project.title}</span>
                      <span className="relate__m">
                        {`${term('type', project.types[0] ?? '')} — ${num(project.year)}`}
                      </span>
                    </span>
                  </Link>
                </>
              )}
            </div>
          </div>

          <GalleryBand images={images.slice(HEAD_PLATE_COUNT)} heading={t('ui.photographs')} />
        </article>
      </div>
    </div>
  );
}
