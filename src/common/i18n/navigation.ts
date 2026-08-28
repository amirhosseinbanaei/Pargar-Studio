// src/common/i18n/navigation.ts
/**
 * Locale-aware navigation, from next-intl's `createNavigation`.
 *
 * Every internal href in the app is built here. A hand-written `/en/projects` is a link
 * that silently keeps an English page one click away from a Persian reader the first time
 * it is copied into a Persian-rendered component.
 *
 * `Link` and `usePathname` are next-intl's: `usePathname()` returns the path WITHOUT the
 * locale prefix, and `<Link href={path} locale={other} />` re-prefixes it — which is the
 * whole of the language switch, and the reason prompt 4's hand-rolled `switchLocale` has
 * no successor. Both are React APIs and resolve the current locale from context, so they
 * belong to the render, not to `./routing`, which `src/proxy.ts` imports.
 *
 * `localeHref` and `localeAlternates` below are THIN WRAPPERS over `getPathname`, not a
 * second implementation of the prefix rule: both compile down to the one `routing` object,
 * so a page's canonical URL, its hreflang set, the sitemap and the middleware's redirect
 * cannot disagree about what a URL looks like.
 */
import { createNavigation } from 'next-intl/navigation';
import type { Locale } from '@/common/schemas/locale';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * Build a locale-prefixed path. `localeHref('fa', '/projects')` -> `/fa/projects`, and
 * `localeHref('en', '/')` -> `/en`.
 *
 * Kept as a named helper because fifteen call sites need the STRING rather than a `Link` —
 * `basePath` props on the filter rails, `app/sitemap.ts`'s absolute URLs, and the shell
 * transition's imperative `router.push`. Where a component is rendering an anchor, use
 * `Link` above and give it the locale-less path.
 */
export function localeHref(locale: Locale, path = '/'): string {
  return getPathname({ href: path, locale });
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
 * Since prompt 8 both halves come from `getPathname`, so they cannot disagree with the
 * middleware's own idea of a URL either — next-intl also emits an `alternateLinks` `Link`
 * response header from the same `routing` object, and a header that contradicted the
 * document's `<link rel="alternate">` would be the same bug one layer down.
 *
 * `path` is locale-less (`/design/kavan-identity`), because route slugs are English in
 * both locales.
 */
export function localeAlternates(
  locale: Locale,
  path = '/',
): { canonical: string; languages: Record<string, string> } {
  return {
    canonical: localeHref(locale, path),
    languages: Object.fromEntries(routing.locales.map(other => [other, localeHref(other, path)])),
  };
}
