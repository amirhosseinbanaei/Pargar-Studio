// src/app/[locale]/(site)/projects/page.tsx
/**
 * The projects index. Routing and composition only — the screen is the module's.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates, localeHref } from '@/common/i18n/navigation';
import { getProjectFilters, listProjects } from '@/common/services/project-service';
import { ProjectsScreen, parseProjectFilters, type RawSearchParams } from '@/modules/projects';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getIntl(locale);
  // A bare title; the root layout's template supplies the suffix.
  // `alternates` carries the canonical AND the `hreflang` pair, so each language's page
  // points at its counterpart rather than competing with it.
  return {
    title: t('nav.projects'),
    description: t('cap.projects'),
    alternates: localeAlternates(locale, '/projects'),
  };
}

export default async function ProjectsPage({ params, searchParams }: PageProps) {
  // One `Promise.all`, not two sequential awaits: they are independent, and awaiting them
  // in series is a waterfall whose latency is the sum rather than the max.
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [projects, taxonomy] = await Promise.all([listProjects(locale), getProjectFilters()]);

  return (
    <ProjectsScreen
      projects={projects}
      taxonomy={taxonomy}
      filters={parseProjectFilters(rawSearchParams)}
      basePath={localeHref(locale, '/projects')}
      dictionary={getIntl(locale)}
    />
  );
}
