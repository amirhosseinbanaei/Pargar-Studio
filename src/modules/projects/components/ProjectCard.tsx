// src/modules/projects/components/ProjectCard.tsx
/**
 * One project in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:139`, with two changes that are the whole point of
 * this migration:
 *
 *  - It is a LINK to `/{locale}/projects/{slug}`, not a `<button data-slug>` that swapped a
 *    detail view into the same panel. The project has a URL now.
 *  - The drawing is IN THE HTML. `draw()` runs here, on the server, seeded by the slug —
 *    which is why the card's drawing and the detail page's first plate are the same
 *    picture: same seed, same pure function, and the detail page is the same bytes for
 *    every visitor.
 *
 * `content-visibility: auto` with `contain-intrinsic-size` stays exactly as `panel.css`
 * has it. It is what makes 76 cards cost roughly what the dozen on screen cost: an
 * offscreen card skips layout and paint entirely, and the intrinsic size keeps the
 * scrollbar honest while it does.
 */
import Link from 'next/link';
import { draw, kindFor } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/routing';
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
      <span
        className="card__frame"
        // Pure, seeded by the slug, and nothing user-supplied reaches it — see
        // `ColumnShell` for the full note on why this is the right way in.
        dangerouslySetInnerHTML={{ __html: draw(kind, project.slug, PLATE_RATIO) }}
      />
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
