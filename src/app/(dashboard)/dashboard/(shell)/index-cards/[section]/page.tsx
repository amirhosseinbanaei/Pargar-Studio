// src/app/(dashboard)/dashboard/(shell)/index-cards/[section]/page.tsx
/**
 * `/dashboard/index-cards/<section>` — one column's words and picture.
 *
 * THE SECTION ID IS VALIDATED ON THE ROUTE, not in the form. A segment that is not one of
 * the five NAV ids is a URL that does not exist, and `notFound()` is what says so — a form
 * rendered for a made-up section would offer a save that writes a row nothing renders. The
 * ACTION checks it again with the same helper, because it is a public endpoint that never
 * passes through this file.
 *
 * A `null` row is NOT a 404 here, unlike the studio editor's. There is nothing to
 * reconstruct: the column has been rendering from the message catalog all along, so the
 * editor gets an empty form and the first save inserts the row.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NAV } from '@/common/constants/site';
import { getIntl } from '@/common/i18n';
import { getIndexCardRow } from '@/common/services/index-card-service';
import { IndexCardForm, requireDashboardSession } from '@/modules/dashboard';

type PageProps = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params;
  const entry = NAV.find(item => item.id === section);
  return { title: entry ? getIntl('en').t(entry.labelKey) : section };
}

export default async function EditIndexCardPage({ params }: PageProps) {
  await requireDashboardSession();

  const { section } = await params;
  const entry = NAV.find(item => item.id === section);
  if (!entry) notFound();

  const card = await getIndexCardRow(entry.id);
  const { t } = getIntl('en');

  return (
    <IndexCardForm
      sectionId={entry.id}
      card={card}
      path={entry.path}
      fallbackTitle={t(entry.labelKey)}
      fallbackCaption={t(entry.captionKey)}
    />
  );
}
