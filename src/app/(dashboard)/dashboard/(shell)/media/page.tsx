// src/app/(dashboard)/dashboard/(shell)/media/page.tsx
/** `/dashboard/media` — the list. */
import type { Metadata } from 'next';
import { listMediaRows } from '@/common/services/media-service';
import { MediaListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Media',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardMediaPage({ searchParams }: PageProps) {
  await requireDashboardSession();

  const [rows, params] = await Promise.all([listMediaRows(), searchParams]);
  return <MediaListScreen rows={rows} searchParams={params} />;
}
