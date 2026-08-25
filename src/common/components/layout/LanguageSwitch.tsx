// src/common/components/layout/LanguageSwitch.tsx
'use client';
/**
 * EN / فا.
 *
 * On the static site this was a pair of buttons that mutated a module-level `lang`,
 * re-rendered every panel and lazily imported ~60KB of Persian content
 * (`legacy/js/main.js:59`). Here it is two LINKS, because the locale is a URL segment: the
 * other language is the same route under the other prefix, so switching is a navigation
 * the router already knows how to prefetch, and the Persian page is a separately cached,
 * separately crawlable document rather than a client-side re-render.
 *
 * That is why `prefetchFa`, `loadFa` and `onLang` have no successor (AGENTS.md).
 *
 * `aria-current="true"` rather than the legacy `aria-pressed`: these are links now, and a
 * link that is the current page announces itself as such. The ported CSS keys the active
 * colour off `.lang__b[aria-current]`, added in `route.css` beside the original
 * `aria-pressed` rule rather than instead of it — prompt 5's contact form still uses
 * buttons.
 *
 * QUERY STRINGS ARE NOT PRESERVED across the switch. Reading them would mean
 * `useSearchParams`, which forces a Suspense boundary onto every consumer of this
 * component — and it sits in the masthead, so that is every route in the site.
 */
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localeValues, type Locale } from '@/common/schemas/locale';
import { switchLocale } from '@/common/i18n/routing';

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
            href={switchLocale(pathname, locale)}
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
