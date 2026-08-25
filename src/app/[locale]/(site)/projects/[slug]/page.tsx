// src/app/[locale]/(site)/projects/[slug]/page.tsx
/**
 * One project, statically generated in both locales.
 *
 * THE OPEN DECISION, RESOLVED: fully static at build time, not on-demand-and-cached.
 * 76 slugs across two locales is 152 pages of pure computation — a few database reads and
 * some SVG — which is cheap to build and free to serve, and the dashboard writes in
 * prompts 6 and 7 purge by tag anyway, so nothing goes stale waiting for a rebuild.
 * See AGENTS.md.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/common/i18n';
import { isLocale, localeAlternates } from '@/common/i18n/routing';
import { localeValues } from '@/common/schemas/locale';
import { getProject, listProjects } from '@/common/services/project-service';
import { ProjectDetail } from '@/modules/projects';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  // The slug list is locale-independent — routes are English in both languages — so this
  // reads one locale and crosses it with both prefixes.
  const projects = await listProjects('en');
  return localeValues.flatMap(locale => projects.map(project => ({ locale, slug: project.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  // Deduplicated with the page's own call: same cached function, same arguments.
  const project = await getProject(slug, locale);
  if (!project) return { title: getDictionary(locale).t('nav.projects') };

  // `legacy/js/main.js:25`'s pattern — the thing you are looking at, then the practice.
  // The root layout's template supplies the second half.
  return {
    title: project.title,
    description: project.blurb,
    alternates: localeAlternates(locale, `/projects/${slug}`),
    openGraph: { title: project.title, description: project.blurb, type: 'article' },
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const project = await getProject(slug, locale);
  // The service answers `null` rather than throwing, so a missing record is a 404 and not
  // an exception path — a thrown error here would render the failure boundary instead.
  if (!project) notFound();

  return <ProjectDetail project={project} dictionary={getDictionary(locale)} />;
}
