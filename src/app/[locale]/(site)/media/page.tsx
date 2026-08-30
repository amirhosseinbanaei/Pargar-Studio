// src/app/[locale]/(site)/media/page.tsx
/**
 * The media index. Routing and composition only.
 *
 * IT USED TO READ THE PROJECT ARCHIVE TOO, to seed each card's generated drawing from the
 * building the piece was about. Prompt 14 removed that fallback, so this route makes one
 * cached read fewer — see `MediaScreen`'s header.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates, localeHref } from '@/common/i18n/navigation';
import { parseFacet, type RawSearchParams } from '@/common/utils/facets';
import { getMediaFilters, listMedia } from '@/common/services/media-service';
import { MediaScreen, MEDIA_FACET } from '@/modules/media';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getIntl(locale);
  return {
    title: t('nav.media'),
    description: t('cap.media'),
    alternates: localeAlternates(locale, '/media'),
  };
}

export default async function MediaPage({ params, searchParams }: PageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [entries, filters] = await Promise.all([listMedia(locale), getMediaFilters(locale)]);

  return (
    <MediaScreen
      entries={entries}
      kinds={filters.types}
      type={parseFacet(rawSearchParams, MEDIA_FACET)}
      basePath={localeHref(locale, '/media')}
      dictionary={getIntl(locale)}
    />
  );
}
