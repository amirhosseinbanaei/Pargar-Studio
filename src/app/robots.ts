// src/app/robots.ts
/**
 * What a crawler may read.
 *
 * The public site is entirely indexable — that is the reason the locale is a URL segment
 * at all. Two things are not:
 *
 *  - `/dashboard` and everything under it, which PROMPT 6 creates. It is disallowed here
 *    BEFORE it exists, on purpose: a private route that goes live in the same deploy as
 *    the rule that hides it is a private route that was public for one crawl. The
 *    authoritative gate is the session check on the route itself — `robots.txt` is a
 *    request, not a fence, and anything that relies on it for privacy is already broken.
 *  - `/api/`, which serves data rather than documents. Nothing there is a page, so
 *    indexing one is a result nobody can use.
 *
 * The `sitemap` line points at `app/sitemap.ts`, which enumerates exactly the URLs this
 * file allows. The two must not disagree: a URL that is listed and disallowed reports as a
 * coverage error, and one that is allowed and unlisted is found only by following links.
 */
import type { MetadataRoute } from 'next';
import { env } from '@/common/config/env';

/**
 * Where the dashboard will live. A literal here and a literal in prompt 6's route folder
 * is one duplication too many — when that route lands it should export this path and this
 * file should import it, exactly as `references/10-routing-and-app-shell.md` §8 has
 * `robots.ts` reading the same list the gate uses.
 */
const DASHBOARD_PATH = '/dashboard';

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [`${DASHBOARD_PATH}/`, DASHBOARD_PATH, '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
