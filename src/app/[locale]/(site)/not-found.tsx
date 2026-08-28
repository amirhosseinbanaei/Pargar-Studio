// src/app/[locale]/(site)/not-found.tsx
/**
 * What `notFound()` renders inside the public site — an unknown project slug today, and
 * every section route prompt 5 has not landed yet.
 *
 * A Server Component, so it costs nothing, and it renders inside the site chrome: a reader
 * who mistypes a slug lands somewhere that still looks like the studio and still has a way
 * out, rather than on a bare framework page.
 *
 * It cannot read `params` — `not-found.tsx` receives none — so the locale is not available
 * here and the copy is the English default. That is a real limitation and a small one: the
 * chrome around it is already in the right language, because the layout above it had the
 * segment.
 */
import Link from 'next/link';
import { getIntl } from '@/common/i18n';
import { DEFAULT_LOCALE } from '@/common/i18n/routing';
import { localeHref } from '@/common/i18n/navigation';

export default function NotFound() {
  const { t } = getIntl(DEFAULT_LOCALE);

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <div className="detail">
          <h1 className="detail__title">{t('error.notFound')}</h1>
          <Link className="detail__back magnet" href={localeHref(DEFAULT_LOCALE)}>
            <svg viewBox="0 0 14 8" aria-hidden="true">
              <path d="M13 4H1M1 4l3.5-3M1 4l3.5 3" />
            </svg>
            <span>{t('ui.home')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
