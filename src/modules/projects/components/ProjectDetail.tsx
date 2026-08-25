// src/modules/projects/components/ProjectDetail.tsx
/**
 * One project's page.
 *
 * Ported from `legacy/js/ui/panel.js:170`, which built this as a string and swapped it
 * into the open panel. It is a route now, statically generated, with a URL that can be
 * sent to a client.
 *
 * THE DRAWINGS live in `common/components/collection/DetailPlates`, promoted there in
 * prompt 5 when Design and Media grew the same three-plate head. The seed contract it
 * carries — first plate at the bare slug, so the card and the page draw the same picture —
 * is documented in that file and pinned by `__tests__/drawing-identity.test.ts` here.
 *
 * Persian copy — title, blurb, description, location, client — comes out of the database
 * verbatim via `toLocaleProject`. Nothing here reshapes it. The vocabulary around it
 * (`Residential`, `Completed`, `Large`) is canonical English in the column and is
 * translated by `term()`, because it is interface, not content.
 */
import { BackLink, DetailPlates, SpecRow } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/routing';
import type { Project } from '@/common/schemas/project';

export interface ProjectDetailProps {
  project: Project;
  dictionary: Dictionary;
}

export function ProjectDetail({ project, dictionary }: ProjectDetailProps) {
  const { t, num, term, list, locale } = dictionary;

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <article className="detail">
          <BackLink href={localeHref(locale, '/projects')} label={t('ui.allProjects')} />

          <h1 className="detail__title">{project.title}</h1>
          <p className="detail__blurb">{project.blurb}</p>

          <DetailPlates seed={project.slug} types={project.types} dictionary={dictionary} />

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
