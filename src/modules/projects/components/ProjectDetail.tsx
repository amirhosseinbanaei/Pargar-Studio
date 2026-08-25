// src/modules/projects/components/ProjectDetail.tsx
/**
 * One project's page.
 *
 * Ported from `legacy/js/ui/panel.js:170`, which built this as a string and swapped it
 * into the open panel. It is a route now, statically generated, with a URL that can be
 * sent to a client.
 *
 * THE DRAWINGS. `drawingSet(slug, types)` picks three kinds deterministically from the
 * slug, and the first of them is `kindFor(slug, types)` — the same call the card makes.
 * That is not a coincidence to be preserved carefully; it falls out of the generators
 * being pure functions of the seed, and the seed being the slug. The card and the first
 * plate are the same picture because they are the same computation.
 *
 * Persian copy — title, blurb, description, location, client — comes out of the database
 * verbatim via `toLocaleProject`. Nothing here reshapes it. The vocabulary around it
 * (`Residential`, `Completed`, `Large`) is canonical English in the column and is
 * translated by `term()`, because it is interface, not content.
 */
import Link from 'next/link';
import { draw, drawingSet } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/routing';
import type { Project } from '@/common/schemas/project';

export interface ProjectDetailProps {
  project: Project;
  dictionary: Dictionary;
}

/** A specification row. Empty values are omitted, never printed as a blank line. */
function SpecRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="spec__row">
      <span className="spec__k">{label}</span>
      <span className="spec__v">{value}</span>
    </div>
  );
}

export function ProjectDetail({ project, dictionary }: ProjectDetailProps) {
  const { t, num, term, list, locale } = dictionary;
  const plates = drawingSet(project.slug, project.types);

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <article className="detail">
          <Link className="detail__back magnet" href={localeHref(locale, '/projects')}>
            <svg viewBox="0 0 14 8" aria-hidden="true">
              <path d="M13 4H1M1 4l3.5-3M1 4l3.5 3" />
            </svg>
            <span>{t('ui.allProjects')}</span>
          </Link>

          <h1 className="detail__title">{project.title}</h1>
          <p className="detail__blurb">{project.blurb}</p>

          <div className="detail__plates">
            {plates.map((kind, i) => (
              <figure className="detail__plate" key={kind}>
                {/*
                  The seed suffix is `legacy/js/ui/panel.js:97` exactly: the first plate
                  uses the bare slug — which is what makes it identical to the card — and
                  the other two are offset so three drawings of one project are three
                  drawings rather than one repeated at three angles.
                */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: draw(kind, i ? `${project.slug}:${i}` : project.slug, PLATE_RATIO),
                  }}
                />
                <figcaption>{term('kindName', kind)}</figcaption>
              </figure>
            ))}
          </div>

          <div className="detail__cols">
            <div className="spec">
              <SpecRow
                label={t('spec.type')}
                value={list(project.types.map(type => term('type', type)))}
              />
              <SpecRow label={t('spec.status')} value={term('status', project.status)} />
              <SpecRow label={t('spec.scale')} value={term('scale', project.scale)} />
              <SpecRow label={t('spec.year')} value={num(project.year)} />
              <SpecRow label={t('spec.location')} value={project.location} />
              {/* `num` over the whole string, not the number: "4,180 m²" keeps its
                  separator and its unit and gains Persian digits. */}
              <SpecRow label={t('spec.area')} value={num(project.area)} />
              <SpecRow label={t('spec.client')} value={project.client} />
            </div>
            <div className="prose">
              <p>{project.description}</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
