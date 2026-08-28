// src/common/components/layout/Masthead.tsx
/**
 * Wordmark, mark stepper, language switch.
 *
 * A Server Component. Two of its three children are `'use client'` leaves and each is a
 * leaf for a specific reason: `MarkStepper` measures a box, `LanguageSwitch` reads the
 * pathname. Nothing else here needs the browser, so nothing else is shipped to it.
 *
 * Ported from `legacy/index.html:82`.
 *
 * THE CLOSER IS GONE, AND THE LANGUAGE SWITCH STANDS IN ITS PLACE (prompt 8). The X button
 * meant "leave this section", which every route already offers three other ways: the
 * wordmark links home, the browser's Back button does what `router.back()` did, and Escape
 * still closes an open section — `createShell`'s own `keydown` handler in
 * `common/lib/motion/shell.ts` binds that, so the behaviour did not live in the button.
 * Nothing replaces the closer; the switch simply moves into the end of the row, which is
 * where the reader's eye already went for it.
 */
import Link from 'next/link';
import type { Locale } from '@/common/schemas/locale';
import { getIntl } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import { LanguageSwitch } from './LanguageSwitch';
import { MarkStepper } from './MarkStepper';

export interface MastheadProps {
  locale: Locale;
}

export function Masthead({ locale }: MastheadProps) {
  const { t, isRTL } = getIntl(locale);
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

      {/*
        Last in the row, where the closer used to be. Which physical edge that is comes
        from the document's `dir`, not from a class — `.masthead` is a flex row, so the
        switch sits at the right in English and at the left in Persian with no rule of its
        own. The closer needed a mirrored `[dir="rtl"]` override precisely because it was
        absolutely positioned against `right: 0`; that rule is gone with it.
      */}
      <LanguageSwitch current={locale} label={t('ui.language')} />
    </header>
  );
}
