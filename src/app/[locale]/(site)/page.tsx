// src/app/[locale]/(site)/page.tsx
/**
 * The five-column index. Server-rendered, artwork included.
 *
 * Composition only: the columns are `ColumnShell`, the transition is `ShellTransition`,
 * and this file decides which locale they speak — which is also why the index cards are
 * read HERE and passed down. `ColumnShell` does not import the service: `app/` is
 * composition, this file already holds the locale, and a read inside the component would
 * be a second place deciding what language the front page is in.
 */
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { NAV } from '@/common/constants/site';
import { listIndexCards } from '@/common/services/index-card-service';
import { ColumnShell, ShellTransition } from '@/common/components/layout';

type PageProps = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getIntl(locale);
  const { t, isRTL } = dictionary;
  // Always five, in NAV order, with an empty card for any section that has no row — the
  // service guarantees both, so nothing below has to branch on a missing one.
  const cards = await listIndexCards(locale);

  return (
    <>
      <ColumnShell dictionary={dictionary} cards={cards} />
      <ShellTransition
        locale={locale}
        isRTL={isRTL}
        strings={{
          escToClose: t('ui.escToClose'),
          selectSection: t('ui.selectSection'),
          opened: t('ui.opened'),
          returned: t('ui.returned'),
          sectionLabels: Object.fromEntries(NAV.map(section => [section.id, t(section.labelKey)])),
        }}
      />
    </>
  );
}
