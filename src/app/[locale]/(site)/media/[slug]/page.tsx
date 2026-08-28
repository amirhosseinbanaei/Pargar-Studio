// src/app/[locale]/(site)/media/[slug]/page.tsx
/**
 * One media entry, statically generated in both locales.
 *
 * THE RELATED PROJECT IS RESOLVED HERE, and the resolution is allowed to fail. The join is
 * deliberately not a foreign key (`common/schemas/media.ts`): a press cutting about a
 * building does not stop existing when the building is un-published or re-slugged. So the
 * route looks the slug up and hands the component the project OR `null`, and the component
 * renders the related-project link only when there is something behind it. That is what
 * keeps "every link resolves to a real route" true for a link whose target is editorial
 * data rather than a route the build controls.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates } from '@/common/i18n/navigation';
import { localeValues } from '@/common/schemas/locale';
import { getMediaEntry, listMedia } from '@/common/services/media-service';
import { getProject } from '@/common/services/project-service';
import { MediaDetail } from '@/modules/media';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const entries = await listMedia('en');
  return localeValues.flatMap(locale => entries.map(entry => ({ locale, slug: entry.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const entry = await getMediaEntry(slug, locale);
  if (!entry) return { title: getIntl(locale).t('nav.media') };

  return {
    title: entry.title,
    description: entry.blurb,
    alternates: localeAlternates(locale, `/media/${slug}`),
    openGraph: { title: entry.title, description: entry.blurb, type: 'article' },
  };
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const entry = await getMediaEntry(slug, locale);
  if (!entry) notFound();

  // Sequential on purpose: which project to fetch is not known until the entry is, and an
  // entry with no project makes no second read at all.
  const project = entry.projectSlug ? await getProject(entry.projectSlug, locale) : null;

  return <MediaDetail entry={entry} project={project} dictionary={getIntl(locale)} />;
}
