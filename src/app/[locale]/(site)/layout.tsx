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
import { getDictionary } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { Footbar, Masthead, SiteMotion, SkipLink, Stage } from '@/common/components/layout';
import { listProjects } from '@/common/services/project-service';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function SiteLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = getDictionary(locale);
  // A cached read (`cacheLife('max')`, tagged `projects`), so the footer's figure is a
  // fact rather than a literal that goes stale the first time the dashboard saves.
  const projects = await listProjects(locale);

  return (
    <SiteMotion brand={t('brand.name')} tagline={`${t('brand.tagline')} — ${t('ui.tehran')}`}>
      <SkipLink label={t('ui.skip')} />

      <Stage>
        <Masthead locale={locale} />
        {children}
        <Footbar locale={locale} projectCount={projects.length} />
      </Stage>

      {/*
        The announcement channel. It lives in the LAYOUT so it survives navigation: a live
        region that is inserted at the same moment its text changes is not announced at
        all, because assistive technology has nothing to compare against.
      */}
      <div className="u-sr" role="status" aria-live="polite" id="live" />
    </SiteMotion>
  );
}
