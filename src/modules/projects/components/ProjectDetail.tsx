// src/modules/projects/components/ProjectDetail.tsx
/**
 * One project's page.
 *
 * Ported from `legacy/js/ui/panel.js:170`, which built this as a string and swapped it
 * into the open panel. It is a route now, statically generated, with a URL that can be
 * sent to a client.
 *
 * THE PHOTOGRAPHS are `common/components/collection`'s: `DetailPlates` takes the first
 * three and `GalleryBand` takes every one after them, so a gallery longer than two is no
 * longer truncated. `HEAD_PLATE_COUNT` is the one number they share — splitting the list
 * with a literal `3` here is how a page ends up showing its third photograph twice.
 *
 * There are no generated drawings on this page any more (prompt 14). A project with no
 * photographs shows none, and the page starts at its title; `CardPlate`'s header carries
 * the argument that was reversed and the cost of reversing it.
 *
 * Persian copy — title, blurb, description, location, client — comes out of the database
 * verbatim via `toLocaleProject`. Nothing here reshapes it. The vocabulary around it
 * (`Residential`, `Completed`, `Large`) is canonical English in the column and is
 * translated by `term()`, because it is interface, not content.
 */
import {
  BackLink,
  DetailPlates,
  GalleryBand,
  HEAD_PLATE_COUNT,
  SpecRow,
} from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Project } from '@/common/schemas/project';

export interface ProjectDetailProps {
  project: Project;
  dictionary: Dictionary;
}

export function ProjectDetail({ project, dictionary }: ProjectDetailProps) {
  const { t, num, term, list, locale } = dictionary;

  // Cover first, then the gallery in its stored order — one list, split by the head's own
  // capacity so nothing is shown twice and nothing falls between the two components.
  const images = [...(project.cover ? [project.cover] : []), ...project.gallery];

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <article className="detail">
          <BackLink href={localeHref(locale, '/projects')} label={t('ui.allProjects')} />

          <h1 className="detail__title">{project.title}</h1>
          <p className="detail__blurb">{project.blurb}</p>

          <DetailPlates images={images} />

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

          {/* Everything past the head, in stored order. Renders nothing when there is
              nothing left, which is every project today. */}
          <GalleryBand images={images.slice(HEAD_PLATE_COUNT)} heading={t('ui.photographs')} />
        </article>
      </div>
    </div>
  );
}
