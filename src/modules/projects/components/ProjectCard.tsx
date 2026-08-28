// src/modules/projects/components/ProjectCard.tsx
/**
 * One project in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:139`, with two changes that are the whole point of
 * this migration:
 *
 *  - It is a LINK to `/{locale}/projects/{slug}`, not a `<button data-slug>` that swapped a
 *    detail view into the same panel. The project has a URL now.
 *  - The drawing is IN THE HTML. `draw()` runs on the server, seeded by the slug — which is
 *    why the card's drawing and the detail page's first plate are the same picture: same
 *    seed, same pure function, and the detail page is the same bytes for every visitor.
 *
 * SINCE PROMPT 10 a project may carry a real photograph, and `CardPlate` chooses between
 * the two. `kindFor` is still called unconditionally, because the drawing is what a record
 * with no cover shows and that is most of them — the seed contract above is unchanged.
 *
 * `content-visibility: auto` with `contain-intrinsic-size` stays exactly as `panel.css`
 * has it. It is what makes 76 cards cost roughly what the dozen on screen cost: an
 * offscreen card skips layout and paint entirely, and the intrinsic size keeps the
 * scrollbar honest while it does.
 */
import Link from 'next/link';
import { CardPlate } from '@/common/components/collection';
import { kindFor } from '@/common/lib/art';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { Project } from '@/common/schemas/project';

export interface ProjectCardProps {
  project: Project;
  dictionary: Dictionary;
}

export function ProjectCard({ project, dictionary }: ProjectCardProps) {
  const { t, num, term, locale } = dictionary;
  const kind = kindFor(project.slug, project.types);

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/projects/${project.slug}`)}
      data-cursor={t('ui.view')}
    >
      {/* The uploaded cover if there is one, the drawing seeded from the slug if there is
          not — and 76 of them have not. `CardPlate` owns that choice for all three grids. */}
      <CardPlate image={project.cover} kind={kind} seed={project.slug} />
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
