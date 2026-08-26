// src/app/(dashboard)/dashboard/(shell)/design/new/page.tsx
/** `/dashboard/design/new` — the create form. See `projects/new/page.tsx`. */
import type { Metadata } from 'next';
import { DesignWorkForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'New design work',
};

export default async function NewDesignWorkPage() {
  await requireDashboardSession();

  return <DesignWorkForm />;
}
