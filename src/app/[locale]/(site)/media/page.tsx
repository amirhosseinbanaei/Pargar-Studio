// src/app/[locale]/(site)/media/page.tsx
/**
 * The media index. Routing and composition only.
 *
 * IT READS THE PROJECT ARCHIVE TOO, and that is not a layering slip: every card's drawing
 * is seeded from the building the piece is about, and choosing a generator needs that
 * project's types. Both reads are cached services, both are independent, so they run in
 * one `Promise.all` — and the module receives records, never a service.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/common/i18n';
import { isLocale, localeAlternates, localeHref } from '@/common/i18n/routing';
import { parseFacet, type RawSearchParams } from '@/common/utils/facets';
import { listMedia } from '@/common/services/media-service';
import { listProjects } from '@/common/services/project-service';
import { MediaScreen, MEDIA_FACET } from '@/modules/media';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getDictionary(locale);
  return {
    title: t('nav.media'),
    description: t('cap.media'),
    alternates: localeAlternates(locale, '/media'),
  };
}

export default async function MediaPage({ params, searchParams }: PageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [entries, projects] = await Promise.all([listMedia(locale), listProjects(locale)]);

  return (
    <MediaScreen
      entries={entries}
      projects={projects}
      type={parseFacet(rawSearchParams, MEDIA_FACET)}
      basePath={localeHref(locale, '/media')}
      dictionary={getDictionary(locale)}
    />
  );
}
