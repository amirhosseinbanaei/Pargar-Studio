// src/app/[locale]/(site)/contact/page.tsx
/**
 * The contact page — the `contact` singleton, plus the site's only form.
 *
 * The form's Server Action lives in the module and is imported by the form itself, not by
 * this file: a page composes, it does not invoke a write.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIntl } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates } from '@/common/i18n/navigation';
import { getContact } from '@/common/services/contact-service';
import { ContactScreen } from '@/modules/contact';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = getIntl(locale);
  return {
    title: t('nav.contact'),
    description: t('cap.contact'),
    alternates: localeAlternates(locale, '/contact'),
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const contact = await getContact(locale);
  // `null` only on an unseeded database — the row is pinned to id 1 by a CHECK.
  if (!contact) notFound();

  return <ContactScreen contact={contact} dictionary={getIntl(locale)} />;
}
