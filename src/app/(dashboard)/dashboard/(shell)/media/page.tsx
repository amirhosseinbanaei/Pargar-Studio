// src/app/(dashboard)/dashboard/(shell)/media/page.tsx
/** `/dashboard/media` — the list. */
import type { Metadata } from 'next';
import { listMediaRows } from '@/common/services/media-service';
import { getTaxonomyUsage, listTaxonomyRows } from '@/common/services/taxonomy-service';
import { MediaListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Media',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardMediaPage({ searchParams }: PageProps) {
  await requireDashboardSession();

  const [rows, terms, usage, params] = await Promise.all([
    listMediaRows(),
    listTaxonomyRows('media'),
    getTaxonomyUsage('media'),
    searchParams,
  ]);
  return <MediaListScreen rows={rows} searchParams={params} terms={terms} usage={usage} />;
}
