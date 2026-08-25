// src/app/[locale]/(site)/projects/page.tsx
/**
 * The projects index. Routing and composition only — the screen is the module's.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/common/i18n';
import { isLocale, localeHref } from '@/common/i18n/routing';
import { getProjectFilters, listProjects } from '@/common/services/project-service';
import { ProjectsScreen, parseProjectFilters, type RawSearchParams } from '@/modules/projects';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getDictionary(locale);
  // A bare title; the root layout's template supplies the suffix.
  return { title: t('nav.projects'), alternates: { canonical: localeHref(locale, '/projects') } };
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
      dictionary={getDictionary(locale)}
    />
  );
}
