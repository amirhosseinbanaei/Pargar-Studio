// src/modules/projects/components/ProjectCard.tsx
/**
 * One project in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:139`, with two changes that are the whole point of
 * this migration:
 *
 *  - It is a LINK to `/{locale}/projects/{slug}`, not a `<button data-slug>` that swapped a
 *    detail view into the same panel. The project has a URL now.
 *  - The picture is IN THE HTML. Since prompt 10 that is the record's uploaded cover; since
 *    prompt 14 a project with no cover shows an EMPTY FRAME rather than the drawing seeded
 *    from its slug. `CardPlate` owns that rule and its header carries the argument that was
 *    reversed to get here — this file no longer calls the art layer at all.
 *
 * `content-visibility: auto` with `contain-intrinsic-size` stays exactly as `panel.css`
 * has it. It is what makes 76 cards cost roughly what the dozen on screen cost: an
 * offscreen card skips layout and paint entirely, and the intrinsic size keeps the
 * scrollbar honest while it does.
 */
import Link from 'next/link';
import { CardPlate } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Project } from '@/common/schemas/project';

export interface ProjectCardProps {
  project: Project;
  dictionary: Dictionary;
}

export function ProjectCard({ project, dictionary }: ProjectCardProps) {
  const { t, num, term, locale } = dictionary;

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/projects/${project.slug}`)}
      data-cursor={t('ui.view')}
    >
      {/* The uploaded cover, or an empty frame — 76 projects have no photograph today, and
          since prompt 14 that is what an empty frame means rather than a drawing. */}
      <CardPlate image={project.cover} />
      <span className="card__body">
        <span className="card__title">{project.title}</span>
        <span className="card__year">{num(project.year)}</span>
      </span>
      <span className="card__meta">
        {`${term('type', project.types[0] ?? '')} — ${term('status', project.status)}`}
      </span>
    </Link>
  );
}
