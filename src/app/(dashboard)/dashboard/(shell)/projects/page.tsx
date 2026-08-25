// src/app/(dashboard)/dashboard/(shell)/projects/page.tsx
/**
 * `/dashboard/projects` — the list.
 *
 * The route reads the rows and hands them, plus the raw search parameters, to the module.
 * Parsing those parameters into a query is the MODULE's job (`lib/project-list.ts`), which
 * is what makes the search-and-filter logic unit-testable with no router and no request.
 *
 * `searchParams` is a promise on Next 16 — awaiting it is what marks this route dynamic,
 * which is correct: the whole screen is a function of the URL and of a table that changes
 * whenever an editor saves.
 */
import type { Metadata } from 'next';
import { listProjectRows } from '@/common/services/project-service';
import { ProjectListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Projects',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardProjectsPage({ searchParams }: PageProps) {
  // BEFORE the read, not beside it — see `requireDashboardSession`. Awaiting it here is
  // what keeps 76 rows out of the payload of a request whose cookie does not verify.
  await requireDashboardSession();

  const [rows, params] = await Promise.all([listProjectRows(), searchParams]);
  return <ProjectListScreen rows={rows} searchParams={params} />;
}
