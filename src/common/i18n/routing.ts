// src/common/i18n/routing.ts
/**
 * Locale-prefixed URLs.
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
 * set keyed by it; the URL is an identifier here, not copy.
 */
import { localeValues, type Locale } from '@/common/schemas/locale';

/**
 * The bare `/` redirect target when the request expresses no usable preference.
 *
 * English, matching the current site: `legacy/js/core/i18n.js:97` falls back to `'en'`
 * unless the browser asks for Persian. That function ALSO honours `navigator.language`,
 * so `resolveLocale` below preserves the intent by reading `Accept-Language` — the server
 * equivalent, and the only one available before a document exists.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/** Type guard for the `[locale]` segment, which arrives as an arbitrary string. */
export function isLocale(value: string): value is Locale {
  return (localeValues as readonly string[]).includes(value);
}

/**
 * Build a locale-prefixed path. `localeHref('fa', '/projects')` -> `/fa/projects`, and
 * `localeHref('en', '/')` -> `/en`.
 *
 * Every internal href in the app goes through this. A hand-written `/en/projects` is a
 * link that silently keeps an English page one click away from a Persian reader the first
 * time it is copied into a Persian-rendered component.
 */
export function localeHref(locale: Locale, path = '/'): string {
  const rest = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${rest}`;
}

/**
 * Swap the locale on a path that already carries one, preserving everything after it.
 * This is what the language switch links to: the same route, the other language.
 */
export function switchLocale(pathname: string, next: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) segments[0] = next;
  else segments.unshift(next);
  return `/${segments.join('/')}`;
}

/**
 * Pick a locale from an `Accept-Language` header.
 *
 * Ported intent, not ported code: `legacy/js/core/i18n.js:97` tested
 * `/^fa|^pe/.test(navigator.language)`. The same two prefixes are tested here — `pe` is
 * the obsolete-but-still-emitted tag for Persian — against each language range in
 * quality order.
 *
 * `null` rather than `DEFAULT_LOCALE` on no match, so a caller can tell "asked for
 * something we do not have" apart from "asked for English".
 */
export function resolveLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  const ranges = acceptLanguage
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find(p => p.trim().startsWith('q='));
      // A range with no `q` is q=1. A malformed one sorts last rather than throwing.
      const weight = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter(range => range.tag.length > 0 && range.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranges) {
    if (/^fa\b|^fa-|^pe\b|^pe-/.test(tag)) return 'fa';
    if (/^en\b|^en-/.test(tag)) return 'en';
  }
  return null;
}

/**
 * The `alternates` block every public route's metadata carries: this page's canonical URL,
 * plus one `hreflang` entry per locale pointing at its counterpart.
 *
 * WHY IT IS A HELPER AND NOT TWO LINES PER ROUTE. The two halves have to agree — the
 * canonical for `/fa/design/x` must be the Persian URL while `languages.en` points at the
 * English one — and hand-writing them per route is how a page ends up declaring the other
 * language's URL as its own canonical, which asks a search engine to drop one of the two
 * documents this whole locale scheme exists to publish separately.
 *
 * `path` is locale-less (`/design/kavan-identity`), the same shape `localeHref` takes,
 * because route slugs are English in both locales.
 */
export function localeAlternates(
  locale: Locale,
  path = '/',
): { canonical: string; languages: Record<string, string> } {
  return {
    canonical: localeHref(locale, path),
    languages: Object.fromEntries(localeValues.map(other => [other, localeHref(other, path)])),
  };
}
