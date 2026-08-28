// src/common/components/layout/LanguageSwitch.tsx
'use client';
/**
 * EN / فا — and, since prompt 8, the last control in the masthead row.
 *
 * On the static site this was a pair of buttons that mutated a module-level `lang`,
 * re-rendered every panel and lazily imported ~60KB of Persian content
 * (`legacy/js/main.js:59`). Here it is two LINKS, because the locale is a URL segment: the
 * other language is the same route under the other prefix, so switching is a navigation
 * and the Persian page is a separately cached, separately crawlable document rather than a
 * client-side re-render.
 *
 * That is why `prefetchFa`, `loadFa` and `onLang` have no successor (AGENTS.md).
 *
 * BOTH APIS HERE ARE next-intl's, and that is what retired prompt 4's `switchLocale`.
 * `usePathname` returns the path WITHOUT the locale prefix, and `<Link locale={…}>`
 * re-applies the prefix for the locale being switched TO — so the swap is expressed once,
 * in `@/common/i18n/routing`, instead of by a second string-splitting helper that has to
 * be kept in step with the middleware's idea of a URL.
 *
 * `aria-current="true"` rather than the legacy `aria-pressed`: these are links now, and a
 * link that is the current page announces itself as such. The ported CSS keys the active
 * colour off `.lang__b[aria-current]`, added in `route.css` beside the original
 * `aria-pressed` rule rather than instead of it — prompt 5's contact form still uses
 * buttons.
 *
 * IT SITS AT THE END OF THE MASTHEAD ROW IN BOTH LANGUAGES, and nothing here says which
 * end that is. `.masthead` is a flex row and the document carries `dir`, so "last child"
 * resolves to the right edge in English and the left edge in Persian on its own — which is
 * why the closer this replaced needed `[dir="rtl"] .closer { right: auto; left: 0 }` and
 * this does not: the closer was absolutely positioned against a physical edge.
 *
 * QUERY STRINGS ARE NOT PRESERVED across the switch. Reading them would mean
 * `useSearchParams`, which forces a Suspense boundary onto every consumer of this
 * component — and it sits in the masthead, so that is every route in the site.
 */
import { Fragment } from 'react';
import { localeValues, type Locale } from '@/common/schemas/locale';
import { Link, usePathname } from '@/common/i18n/navigation';

const LABEL: Record<Locale, string> = { en: 'EN', fa: 'فا' };

export interface LanguageSwitchProps {
  current: Locale;
  /** `t('ui.language')` — the group's accessible name, passed in from the server. */
  label: string;
}

export function LanguageSwitch({ current, label }: LanguageSwitchProps) {
  const pathname = usePathname();

  return (
    <span className="lang" role="group" aria-label={label}>
      {/* A Fragment, not a wrapper element: `.lang` is a flex row with a `gap`, so an
          extra box around each pair would collapse the separator's spacing. */}
      {localeValues.map((locale, i) => (
        <Fragment key={locale}>
          {i > 0 && (
            <span className="lang__sep" aria-hidden="true">
              /
            </span>
          )}
          <Link
            className="lang__b magnet"
            href={pathname}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === current ? 'true' : undefined}
          >
            {LABEL[locale]}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}
