// src/app/sitemap.ts
/**
 * Every public URL on the site, in both locales, enumerated from the DATA rather than
 * from a list somebody maintains.
 *
 * WHY IT READS THE SERVICES. A hand-written sitemap is wrong the first time the dashboard
 * publishes a project: the page exists, is cached, is linked from the grid, and is invisible
 * to a crawler until someone remembers this file. Reading the same cached services the
 * pages read means the sitemap is a projection of the site, not a description of it — and
 * it costs nothing, because those reads are already warm.
 *
 * BOTH LOCALES ARE LISTED AS SEPARATE URLS, with `alternates.languages` pointing each at
 * its counterpart. That is the point of the locale segment: the legacy site served one
 * document at one URL for two languages, so Persian was uncrawlable. Each entry declares
 * the pair so a search engine indexes both and serves the right one.
 *
 * NOTHING GATED IS LISTED. The dashboard prompt 6 adds is excluded here AND disallowed in
 * `robots.ts` — listing a route a crawler cannot reach wastes crawl budget and reports as
 * a coverage error in a search console.
 *
 * `lastModified` is deliberately absent. The records carry `updatedAt`, but the locale
 * mapper does not project it, and a `lastModified` that is really "the moment this file
 * ran" is worse than none: it tells a crawler every page changed on every build.
 */
import type { MetadataRoute } from 'next';
import { env } from '@/common/config/env';
import { localeHref } from '@/common/i18n/navigation';
import { localeValues } from '@/common/schemas/locale';
import { listDesignWorks } from '@/common/services/design-work-service';
import { listMedia } from '@/common/services/media-service';
import { listProjects } from '@/common/services/project-service';

/** The five sections, plus the index. Priorities rank the index above its sections. */
const SECTIONS: ReadonlyArray<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/projects', priority: 0.9 },
  { path: '/design', priority: 0.8 },
  { path: '/media', priority: 0.8 },
  { path: '/studio', priority: 0.7 },
  { path: '/contact', priority: 0.7 },
];

/** A detail page ranks below its section but is still the substance of the archive. */
const DETAIL_PRIORITY = 0.6;

const BASE = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

/** One entry per locale for a locale-less path, each carrying the whole `hreflang` set. */
function entries(path: string, priority: number): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    localeValues.map(locale => [locale, `${BASE}${localeHref(locale, path)}`]),
  );
  return localeValues.map(locale => ({
    url: `${BASE}${localeHref(locale, path)}`,
    priority,
    changeFrequency: 'monthly' as const,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Slugs are the same in both locales — routes are English everywhere — so one read of
  // each collection answers for both prefixes.
  const [projects, works, media] = await Promise.all([
    listProjects('en'),
    listDesignWorks('en'),
    listMedia('en'),
  ]);

  return [
    ...SECTIONS.flatMap(section => entries(section.path, section.priority)),
    ...projects.flatMap(project => entries(`/projects/${project.slug}`, DETAIL_PRIORITY)),
    ...works.flatMap(work => entries(`/design/${work.slug}`, DETAIL_PRIORITY)),
    ...media.flatMap(entry => entries(`/media/${entry.slug}`, DETAIL_PRIORITY)),
  ];
}
