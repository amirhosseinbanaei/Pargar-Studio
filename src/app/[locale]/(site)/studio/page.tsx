// src/app/[locale]/(site)/studio/page.tsx
/**
 * The studio page — one editorial document, driven by the `studio` singleton.
 *
 * IT READS THE RECORD TWICE, in the requested locale and in English, and that is the whole
 * reason this page is more than three lines. Portraits are seeded from a person's ENGLISH
 * name: `seedOf` keeps only `[a-z0-9]`, so a Persian name reduces to an empty string and
 * every member of the studio would share one portrait on the Persian page — a bug
 * invisible to anyone testing in English. `legacy/js/ui/panel.js:396` solved it by reading
 * the untranslated record beside the translated one; this does the same, through the
 * service. On `/en` the two calls are the same cached call and cost one read.
 *
 * A component may not call a service, so the ROUTE zips them and hands the module a plain
 * array of seeds.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates } from '@/common/i18n/navigation';
import { getStudio } from '@/common/services/studio-service';
import { StudioScreen, studioSeeds } from '@/modules/studio';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getIntl(locale);
  return {
    title: t('nav.studio'),
    description: t('cap.studio'),
    alternates: localeAlternates(locale, '/studio'),
  };
}

export default async function StudioPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [studio, english] = await Promise.all([getStudio(locale), getStudio('en')]);
  // `null` on an unseeded database. A 404 is the honest answer — the page has no content —
  // and it keeps an empty database out of the failure boundary, where it would read as a
  // crash rather than as a database nobody has seeded.
  if (!studio || !english) notFound();

  return <StudioScreen studio={studio} seeds={studioSeeds(english)} dictionary={getIntl(locale)} />;
}
