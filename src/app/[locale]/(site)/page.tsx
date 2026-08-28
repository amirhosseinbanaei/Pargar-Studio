// src/app/[locale]/(site)/page.tsx
/**
 * The five-column index. Server-rendered, artwork included.
 *
 * Composition only: the columns are `ColumnShell`, the transition is `ShellTransition`,
 * and this file decides which locale they speak.
 */
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { NAV } from '@/common/constants/site';
import { ColumnShell, ShellTransition } from '@/common/components/layout';

type PageProps = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getIntl(locale);
  const { t, isRTL } = dictionary;

  return (
    <>
      <ColumnShell dictionary={dictionary} />
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
