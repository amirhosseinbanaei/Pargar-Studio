// src/app/robots.ts
/**
 * What a crawler may read.
 *
 * The public site is entirely indexable — that is the reason the locale is a URL segment
 * at all. Two things are not:
 *
 *  - `/dashboard` and everything under it, disallowed here since before it existed, on
 *    purpose: a private route that goes live in the same deploy as the rule that hides it
 *    is a private route that was public for one crawl. The authoritative gate is the
 *    session check on the route itself — `robots.txt` is a request, not a fence, and
 *    anything that relies on it for privacy is already broken.
 *  - `/api/`, which serves data rather than documents. Nothing there is a page, so
 *    indexing one is a result nobody can use.
 *
 * The `sitemap` line points at `app/sitemap.ts`, which enumerates exactly the URLs this
 * file allows. The two must not disagree: a URL that is listed and disallowed reports as a
 * coverage error, and one that is allowed and unlisted is found only by following links.
 */
import type { MetadataRoute } from 'next';
import { env } from '@/common/config/env';
import { PRIVATE_ROUTES } from '@/common/config/private-routes';

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /**
       * DERIVED FROM THE SAME ARRAY THE GATE READS, as prompt 6 promised when it left a
       * literal here. `src/proxy.ts` decides what needs a session from `PRIVATE_ROUTES`;
       * this file decides what a crawler is asked to skip from the same array, so the two
       * cannot disagree. Both spellings of each prefix are emitted — the bare path and the
       * subtree — because `Disallow: /dashboard/` alone leaves `/dashboard` itself
       * crawlable.
       */
      disallow: [...PRIVATE_ROUTES.flatMap(route => [route, `${route}/`]), '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
