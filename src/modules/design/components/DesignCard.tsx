// src/modules/design/components/DesignCard.tsx
/**
 * One design work in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:199`. Two differences from the projects card and both
 * come from the record: the meta line is the CATEGORY alone (a work has one, where a
 * project carries a type and a status), and there is a `.card__note` under it holding the
 * blurb — the design panel showed the sentence on the card, the projects grid did not.
 *
 * The drawing is generated HERE, on the server, seeded by the slug and steered by the
 * single category, so the card and the detail page's first plate are the same picture.
 */
import Link from 'next/link';
import { draw, kindFor } from '@/common/lib/art';
import { PLATE_RATIO } from '@/common/constants/site';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { DesignWork } from '@/common/schemas/design-work';

export interface DesignCardProps {
  work: DesignWork;
  dictionary: Dictionary;
}

export function DesignCard({ work, dictionary }: DesignCardProps) {
  const { t, num, term, locale } = dictionary;
  // A single-element array, matching `legacy/js/ui/panel.js:204`: `kindFor` reads the
  // types as one lowercased string, so the category steers the generator the same way a
  // project's type list does.
  const kind = kindFor(work.slug, [work.category]);

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/design/${work.slug}`)}
      data-cursor={t('ui.view')}
    >
      <span
        className="card__frame"
        dangerouslySetInnerHTML={{ __html: draw(kind, work.slug, PLATE_RATIO) }}
      />
      <span className="card__body">
        <span className="card__title">{work.title}</span>
        <span className="card__year">{num(work.year)}</span>
      </span>
      <span className="card__meta">{term('cat', work.category)}</span>
      <span className="card__note">{work.blurb}</span>
    </Link>
  );
}
