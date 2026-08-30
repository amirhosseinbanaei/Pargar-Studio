// src/modules/design/components/DesignCard.tsx
/**
 * One design work in the grid.
 *
 * Ported from `legacy/js/ui/panel.js:199`. Two differences from the projects card and both
 * come from the record: the meta line is the CATEGORY alone (a work has one, where a
 * project carries a type and a status), and there is a `.card__note` under it holding the
 * blurb — the design panel showed the sentence on the card, the projects grid did not.
 *
 * The picture is the work's uploaded cover, or an empty frame. It used to be a drawing
 * seeded by the slug and steered by the single category; prompt 14 reversed that, and
 * `CardPlate`'s header carries the argument. This file no longer calls the art layer.
 */
import Link from 'next/link';
import { CardPlate } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { DesignWork } from '@/common/schemas/design-work';

export interface DesignCardProps {
  work: DesignWork;
  dictionary: Dictionary;
}

export function DesignCard({ work, dictionary }: DesignCardProps) {
  const { t, num, term, locale } = dictionary;

  return (
    <Link
      className="card magnet"
      href={localeHref(locale, `/design/${work.slug}`)}
      data-cursor={t('ui.view')}
    >
      <CardPlate image={work.cover} />
      <span className="card__body">
        <span className="card__title">{work.title}</span>
        <span className="card__year">{num(work.year)}</span>
      </span>
      <span className="card__meta">{term('cat', work.category)}</span>
      <span className="card__note">{work.blurb}</span>
    </Link>
  );
}
