// src/app/(dashboard)/dashboard/(shell)/studio/page.tsx
/**
 * `/dashboard/studio` — the singleton editor. No `[id]` segment: there is one row, and the
 * form always edits it.
 */
import type { Metadata } from 'next';
import { getStudioRow } from '@/common/services/studio-service';
import { StudioForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Studio',
};

export default async function DashboardStudioPage() {
  await requireDashboardSession();

  const studio = await getStudioRow();
  if (!studio) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Studio</h1>
        <p className="text-fs-sm text-t-lo">
          The database has not been seeded yet, so there is no studio record to edit. Run{' '}
          <code className="font-mono text-t-md">npm run db:seed</code> and reload this page.
        </p>
      </div>
    );
  }

  return <StudioForm studio={studio} />;
}
