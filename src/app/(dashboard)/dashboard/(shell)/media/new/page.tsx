// src/app/(dashboard)/dashboard/(shell)/media/new/page.tsx
/** `/dashboard/media/new` — the create form. */
import type { Metadata } from 'next';
import { listProjectRows } from '@/common/services/project-service';
import { listTaxonomyRows } from '@/common/services/taxonomy-service';
import { MediaForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'New media entry',
};

export default async function NewMediaPage() {
  await requireDashboardSession();

  const [projects, terms] = await Promise.all([listProjectRows(), listTaxonomyRows('media')]);
  return <MediaForm projectOptions={projects} terms={terms} />;
}
