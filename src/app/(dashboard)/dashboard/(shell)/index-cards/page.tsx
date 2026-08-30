// src/app/(dashboard)/dashboard/(shell)/index-cards/page.tsx
/**
 * `/dashboard/index-cards` — the five columns of the front page.
 *
 * No `new` route and no delete: the five rows are the schema's, and their identity is `NAV`.
 * The English fallback wording is resolved HERE rather than in the screen, for the same
 * reason `ColumnShell` takes its cards as a prop — `getIntl` is the route's to call, and the
 * dashboard's interface language is English (AGENTS.md), so this asks for `en` explicitly
 * rather than inheriting a locale it does not have.
 */
import type { Metadata } from 'next';
import { NAV } from '@/common/constants/site';
import { getIntl } from '@/common/i18n';
import { listIndexCardRows } from '@/common/services/index-card-service';
import {
  IndexCardListScreen,
  requireDashboardSession,
  type IndexCardListRow,
} from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Index cards',
};

export default async function DashboardIndexCardsPage() {
  await requireDashboardSession();

  const rows = await listIndexCardRows();
  const byId = new Map(rows.map(row => [row.sectionId, row]));
  const { t } = getIntl('en');

  const cards: IndexCardListRow[] = NAV.map(section => {
    const row = byId.get(section.id);
    return {
      sectionId: section.id,
      path: section.path,
      title: row?.titleEn ?? '',
      caption: row?.captionEn ?? '',
      fallbackTitle: t(section.labelKey),
      fallbackCaption: t(section.captionKey),
      hasImage: Boolean(row?.coverImage),
    };
  });

  return <IndexCardListScreen rows={cards} />;
}
