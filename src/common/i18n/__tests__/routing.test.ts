// @vitest-environment node
/**
 * REWRITTEN IN PROMPT 8, when next-intl took over locale routing.
 *
 * What each of prompt 4's three subjects became, and where its coverage went:
 *
 *  - `localeHref` is still here. It is a thin wrapper over next-intl's `getPathname` now
 *    rather than string concatenation, and the URLs it must produce are unchanged —
 *    which is exactly what these assertions pin.
 *  - `switchLocale` has NO successor to test. The language switch asks next-intl's
 *    `usePathname()` for the locale-less path and hands `<Link locale={…}>` the swap, so
 *    there is no helper left to unit-test; `localeAlternates` below covers the same
 *    "same route, other prefix" arithmetic that `switchLocale` did.
 *  - `resolveLocale` moved into the middleware. Its cases were not dropped — they are in
 *    `src/__tests__/proxy.test.ts`, driven through the composed proxy, which is a
 *    stronger test than the old one: it asserts the negotiation AND the 307 AND that the
 *    dashboard never reaches it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, routing } from '../routing';
import { localeAlternates, localeHref } from '../navigation';

describe('localeHref', () => {
  it('prefixes a path', () => {
    expect(localeHref('fa', '/projects')).toBe('/fa/projects');
    expect(localeHref('en', '/projects/qeytarieh-08-residence')).toBe(
      '/en/projects/qeytarieh-08-residence',
    );
  });

  it('produces a bare prefix for the index, not a trailing slash', () => {
    // `/en/` and `/en` are two URLs for one page.
    expect(localeHref('en')).toBe('/en');
    expect(localeHref('en', '/')).toBe('/en');
  });

  it('prefixes the DEFAULT locale too', () => {
    // `localePrefix: 'always'`. Dropping the prefix for English would change every
    // canonical URL, the sitemap and both `generateStaticParams` sets at once.
    expect(localeHref(DEFAULT_LOCALE, '/studio')).toBe('/en/studio');
  });
});

describe('localeAlternates', () => {
  it('declares this locale as canonical and the other as its alternate', () => {
    // The failure this helper exists to prevent: a page naming the OTHER language's URL
    // as its own canonical, which asks a search engine to drop one of the two documents
    // the whole locale scheme exists to publish separately.
    expect(localeAlternates('fa', '/design/kavan-identity')).toEqual({
      canonical: '/fa/design/kavan-identity',
      languages: {
        en: '/en/design/kavan-identity',
        fa: '/fa/design/kavan-identity',
      },
    });
  });

  it('agrees with localeHref for every locale, so the two cannot drift', () => {
    for (const locale of routing.locales) {
      const alternates = localeAlternates(locale, '/media');
      expect(alternates.canonical).toBe(localeHref(locale, '/media'));
      expect(alternates.languages[locale]).toBe(alternates.canonical);
    }
  });

  it('covers the index', () => {
    expect(localeAlternates('en')).toEqual({
      canonical: '/en',
      languages: { en: '/en', fa: '/fa' },
    });
  });
});

describe('isLocale / DEFAULT_LOCALE', () => {
  it('narrows an arbitrary segment', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fa')).toBe(true);
    expect(isLocale('projects')).toBe(false);
    // The `[locale]` segment is a catch-all for unmatched URLs, so it sees these too.
    expect(isLocale('unknown.txt')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('defaults to English, matching legacy/js/core/i18n.js:97', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(routing.defaultLocale).toBe(DEFAULT_LOCALE);
  });

  it('keeps both locales prefixed and stores no locale preference', () => {
    // Both are load-bearing decisions rather than defaults — see `../routing`.
    expect(routing.localePrefix).toBe('always');
    expect(routing.localeCookie).toBe(false);
  });
});
