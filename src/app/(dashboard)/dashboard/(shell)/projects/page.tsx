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
import { getTaxonomyUsage, listTaxonomyRows } from '@/common/services/taxonomy-service';
import { ProjectListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Projects',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardProjectsPage({ searchParams }: PageProps) {
  // BEFORE the read, not beside it — see `requireDashboardSession`. Awaiting it here is
  // what keeps 76 rows out of the payload of a request whose cookie does not verify.
  await requireDashboardSession();

  /**
   * The terms and their use counts feed the taxonomy editor above the list. Both come from
   * the UNCACHED dashboard half of the service, like every other read on this route — an
   * editor shown the label they just replaced cannot tell a stale cache from a failed save.
   */
  const [rows, terms, usage, params] = await Promise.all([
    listProjectRows(),
    listTaxonomyRows('project'),
    getTaxonomyUsage('project'),
    searchParams,
  ]);
  return <ProjectListScreen rows={rows} searchParams={params} terms={terms} usage={usage} />;
}
