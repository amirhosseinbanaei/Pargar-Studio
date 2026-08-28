// src/app/[locale]/(site)/design/[slug]/page.tsx
/**
 * One design work, statically generated in both locales — the same shape as the project
 * detail route, for the same reasons (AGENTS.md): nine slugs across two locales is
 * eighteen pages of pure computation, cheap to build and free to serve, and the dashboard
 * writes in prompts 6 and 7 purge by tag rather than waiting for a rebuild.
 *
 * `dynamicParams` stays at its default `true`, so a work the dashboard creates is
 * reachable before the next deploy. The price is the soft-404 recorded in AGENTS.md: an
 * unknown slug renders the not-found UI with a 200, because the static shell is flushed
 * before the lookup answers.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates } from '@/common/i18n/navigation';
import { localeValues } from '@/common/schemas/locale';
import { getDesignWork, listDesignWorks } from '@/common/services/design-work-service';
import { DesignDetail } from '@/modules/design';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  // Slugs are locale-independent — routes are English in both languages — so this reads
  // one locale and crosses it with both prefixes.
  const works = await listDesignWorks('en');
  return localeValues.flatMap(locale => works.map(work => ({ locale, slug: work.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  // Deduplicated with the page's own call: same cached function, same arguments.
  const work = await getDesignWork(slug, locale);
  if (!work) return { title: getIntl(locale).t('nav.design') };

  return {
    title: work.title,
    description: work.blurb,
    alternates: localeAlternates(locale, `/design/${slug}`),
    openGraph: { title: work.title, description: work.blurb, type: 'article' },
  };
}

export default async function DesignDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  // The service answers `null` rather than throwing, so a missing record is a 404 and not
  // an exception path — a throw here would render the failure boundary instead.
  const work = await getDesignWork(slug, locale);
  if (!work) notFound();

  return <DesignDetail work={work} dictionary={getIntl(locale)} />;
}
