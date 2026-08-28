// src/common/i18n/routing.ts
/**
 * THE routing definition — one object, consumed by the proxy, by `./navigation` and by
 * `./request`, so the prefix strategy, the locale list and the default cannot disagree.
 *
 * THE DECISION THIS FILE ENCODES: the locale is a URL SEGMENT (`/en/...`, `/fa/...`), not
 * a cookie and not a client toggle. Three things follow, and they are the reason the
 * legacy language machinery has no successor:
 *
 *  1. Each language is independently cacheable and independently crawlable. The legacy
 *     site served one document at one URL for both languages, so Persian was invisible to
 *     a search engine and uncacheable per locale.
 *  2. Switching language is a NAVIGATION — the same path under the other prefix. There is
 *     no in-place re-render, so no `onLang` subscription, no `loadFa`, no `prefetchFa`.
 *  3. `lang`, `dir` and the `is-fa` class are decided by the route segment before the
 *     first byte, so a Persian visitor never watches the layout flip after the fact —
 *     which is precisely what the inline script at `legacy/index.html:29` existed to
 *     prevent, and what a Server Component gets for free.
 *
 * ROUTE SLUGS STAY ENGLISH IN BOTH LOCALES (`/fa/projects`, not `/fa/پروژه‌ها`). Persian
 * slugs would need a second slug column on every table and a second `generateStaticParams`
 * set keyed by it; the URL is an identifier here, not copy. That is why no `pathnames` map
 * is configured below — next-intl's localized-pathname feature is exactly the thing this
 * decision declines.
 *
 * THIS FILE MUST NOT IMPORT `next/navigation`. `src/proxy.ts` imports it to build the
 * locale middleware, and the proxy runs before route resolution where those APIs do not
 * exist. `createNavigation` therefore lives in `./navigation`, one import away.
 */
import { defineRouting } from 'next-intl/routing';
import { hasLocale } from 'next-intl';
import { localeValues, type Locale } from '@/common/schemas/locale';

export const routing = defineRouting({
  locales: localeValues,

  /**
   * English is the fallback, matching `legacy/js/core/i18n.js:97`, which fell back to
   * `'en'` unless the browser asked for Persian.
   */
  defaultLocale: 'en',

  /**
   * BOTH LOCALES ARE ALWAYS PREFIXED, including the default. Dropping the prefix for
   * English would change every canonical URL, every entry in `app/sitemap.ts` and both
   * `generateStaticParams` sets at once — `/en/projects/x` is the URL 152 prerendered
   * pages, the sitemap and the hreflang set are all written against.
   */
  localePrefix: 'always',

  /**
   * NO LOCALE COOKIE. next-intl writes `NEXT_LOCALE` and prefers it over `Accept-Language`
   * by default; that is a stored preference, and this app deliberately has none. The
   * legacy `kavan.lang` key in `localStorage` was dropped in prompt 4 for a reason that
   * applies identically to a cookie: the language is in the URL, which is a better memory
   * because it travels with a shared link, while a cookie is per-browser and invisible to
   * whoever the link is sent to. It would also make the bare-`/` redirect depend on
   * something the reader cannot see or change.
   */
  localeCookie: false,
});

/**
 * The bare `/` redirect target when the request expresses no usable preference. Sourced
 * from `routing` rather than declared beside it, so there is one default locale in the
 * repository and not two.
 */
export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

/**
 * Type guard for the `[locale]` segment, which arrives as an arbitrary string. A thin
 * wrapper over next-intl's `hasLocale` so the check reads against `routing.locales` — the
 * same list the middleware negotiates against.
 */
export function isLocale(value: unknown): value is Locale {
  return hasLocale(routing.locales, value);
}
