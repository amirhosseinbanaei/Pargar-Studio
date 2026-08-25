// src/app/(dashboard)/dashboard/(shell)/page.tsx
/**
 * `/dashboard` — the overview.
 *
 * A page composes; it does not query and it does not decide. It calls one service and hands
 * the result to the module's screen, exactly as every public route does.
 *
 * `listProjectRows` is the UNCACHED bilingual read. No `'use cache'` under `(dashboard)`,
 * ever: a count that is right on the public site and stale here is a count nobody trusts.
 */
import type { Metadata } from 'next';
import { listProjectRows } from '@/common/services/project-service';
import { DashboardOverview, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Overview',
};

export default async function DashboardPage() {
  // BEFORE the read, not beside it. The layout's gate runs concurrently with this
  // component, so only a check on this line keeps the query from running at all.
  await requireDashboardSession();

  const rows = await listProjectRows();
  return <DashboardOverview projectCount={rows.length} />;
}
