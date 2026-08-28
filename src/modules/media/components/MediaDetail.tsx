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
 */
import Link from 'next/link';
import { BackLink, DetailPlates, SpecRow } from '@/common/components/collection';
import { Lat } from '@/common/components/layout';
import { draw, kindFor } from '@/common/lib/art';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Media } from '@/common/schemas/media';
import type { Project } from '@/common/schemas/project';

/** The ratio the related-project thumbnail is drawn at — `legacy/js/ui/panel.js:328`. */
const RELATE_RATIO = 0.62;

export interface MediaDetailProps {
  entry: Media;
  /** Resolved by the route. `null` when the entry names no project, or names a missing one. */
  project: Project | null;
  dictionary: Dictionary;
}

export function MediaDetail({ entry, project, dictionary }: MediaDetailProps) {
  const { t, num, term, locale } = dictionary;

  // The plate shows the building the piece is about, which ties the entry to the work
  // rather than to the publication. No project (or a missing one) falls back to the
  // entry's own slug, so the head of the page is never empty.
  const seed = project?.slug ?? entry.slug;
  const types = project?.types ?? [];

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

          {/* A cover if this entry has one; otherwise all three plates stay drawings seeded
              from the RELATED PROJECT, which is what makes a cutting carry the building. */}
          <DetailPlates
            seed={seed}
            types={types}
            dictionary={dictionary}
            images={entry.cover ? [entry.cover] : []}
          />

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
                    <span
                      className="relate__f"
                      dangerouslySetInnerHTML={{
                        __html: draw(
                          kindFor(project.slug, project.types),
                          project.slug,
                          RELATE_RATIO,
                        ),
                      }}
                    />
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
        </article>
      </div>
    </div>
  );
}
