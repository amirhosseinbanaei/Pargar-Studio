// src/app/[locale]/(site)/design/page.tsx
/**
 * The design index. Routing and composition only — the screen belongs to the module.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/common/i18n';
import { isLocale, localeAlternates, localeHref } from '@/common/i18n/routing';
import { parseFacet, type RawSearchParams } from '@/common/utils/facets';
import { listDesignWorks } from '@/common/services/design-work-service';
import { DesignScreen, DESIGN_FACET } from '@/modules/design';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getDictionary(locale);
  // A bare title; the root layout's template supplies the suffix.
  return {
    title: t('nav.design'),
    description: t('cap.design'),
    alternates: localeAlternates(locale, '/design'),
  };
}

export default async function DesignPage({ params, searchParams }: PageProps) {
  // Independent, so one `Promise.all` rather than a waterfall whose latency is the sum.
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const works = await listDesignWorks(locale);

  return (
    <DesignScreen
      works={works}
      category={parseFacet(rawSearchParams, DESIGN_FACET)}
      basePath={localeHref(locale, '/design')}
      dictionary={getDictionary(locale)}
    />
  );
}
