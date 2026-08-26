// src/app/(dashboard)/dashboard/(shell)/design/page.tsx
/** `/dashboard/design` — the list. See `projects/page.tsx` for the pattern this repeats. */
import type { Metadata } from 'next';
import { listDesignWorkRows } from '@/common/services/design-work-service';
import { DesignWorkListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Design',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardDesignPage({ searchParams }: PageProps) {
  await requireDashboardSession();

  const [rows, params] = await Promise.all([listDesignWorkRows(), searchParams]);
  return <DesignWorkListScreen rows={rows} searchParams={params} />;
}
