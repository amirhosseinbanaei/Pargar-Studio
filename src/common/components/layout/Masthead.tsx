// src/common/components/layout/Masthead.tsx
/**
 * Wordmark, mark stepper, language switch, closer.
 *
 * A Server Component. Two of its four children are `'use client'` leaves and each is a
 * leaf for a specific reason: `MarkStepper` measures a box, `LanguageSwitch` reads the
 * pathname. Nothing else here needs the browser, so nothing else is shipped to it.
 *
 * Ported from `legacy/index.html:82`.
 */
import Link from 'next/link';
import type { Locale } from '@/common/schemas/locale';
import { getDictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/routing';
import { Closer } from './Closer';
import { LanguageSwitch } from './LanguageSwitch';
import { MarkStepper } from './MarkStepper';

export interface MastheadProps {
  locale: Locale;
}

export function Masthead({ locale }: MastheadProps) {
  const { t, isRTL } = getDictionary(locale);
  const brand = t('brand.name');

  return (
    <header className="masthead">
      {/*
        A real link to the index, not the legacy `href="#"` that a script intercepted.
        Middle-click, open-in-new-tab and a crawler all work now, and with JavaScript off
        it is the way back from a section.
      */}
      <Link
        className="wordmark magnet"
        href={localeHref(locale)}
        id="home"
        aria-label={`${brand} — ${t('ui.home')}`}
      >
        <svg className="wordmark__glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 20V4M5 12l11-8M5 12l11 8" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="5" cy="12" r="1.75" fill="currentColor" stroke="none" />
        </svg>
        <span>{brand}</span>
      </Link>

      <MarkStepper isRTL={isRTL} />

      <LanguageSwitch current={locale} label={t('ui.language')} />

      {/*
        The closer means "leave this section", which is a navigation now rather than a
        transition played in reverse. See `Closer` for why it is a button and not a link.
      */}
      <Closer label={t('ui.close')} home={localeHref(locale)} />
    </header>
  );
}
