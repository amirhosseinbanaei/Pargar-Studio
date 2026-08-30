// src/app/[locale]/(site)/layout.tsx
/**
 * The public site's chrome: masthead, footer bar, the motion boundary, and the live
 * region.
 *
 * A Server Component, and it stays one. The four things here that need a browser are each
 * their own `'use client'` leaf inside `common/components/layout/` — a directive on this
 * file would pull every page below it into the client bundle, generators and all.
 *
 * The `(site)` group exists because prompts 6 and 7 add a dashboard whose chrome and whose
 * failure copy are both different: "your data didn't load" is not the same sentence as
 * "this section is unavailable", and one boundary cannot say both.
 */
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import {
  Footbar,
  Masthead,
  SectionEscape,
  SiteMotion,
  SkipLink,
  Stage,
} from '@/common/components/layout';
import { localeHref } from '@/common/i18n/navigation';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function SiteLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = getIntl(locale);

  return (
    <SiteMotion brand={t('brand.name')} tagline={`${t('brand.tagline')} — ${t('ui.tehran')}`}>
      <SkipLink label={t('ui.skip')} />

      <Stage>
        <Masthead locale={locale} />
        {children}
        <Footbar locale={locale} />
      </Stage>

      {/*
        Renders nothing. It restores the Escape key the deleted `Closer` used to bind —
        the shell's own handler is only alive on the index, where there is no section to
        leave. See `SectionEscape` for what was measured. It sits in the LAYOUT so it
        survives navigation between sections.
      */}
      <SectionEscape home={localeHref(locale)} />

      {/*
        The announcement channel. It lives in the LAYOUT so it survives navigation: a live
        region that is inserted at the same moment its text changes is not announced at
        all, because assistive technology has nothing to compare against.
      */}
      <div className="u-sr" role="status" aria-live="polite" id="live" />
    </SiteMotion>
  );
}
