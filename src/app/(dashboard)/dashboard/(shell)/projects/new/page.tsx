// src/app/(dashboard)/dashboard/(shell)/projects/new/page.tsx
/**
 * `/dashboard/projects/new` — the create form.
 *
 * It renders the same component the edit route does, with no `project` prop. That is the
 * whole difference between the two screens, and keeping it to one prop is what stops a field
 * from being added to the edit form and forgotten on the create form.
 *
 * NOTE ON ROUTE PRECEDENCE: this static segment wins over the sibling `[slug]`, so a project
 * whose slug is literally `new` would be unreachable here. The slug pattern permits it, and
 * it is not worth a validation rule — but it is worth knowing, which is why it is written
 * down rather than left to be discovered.
 */
import type { Metadata } from 'next';
import { listTaxonomyRows } from '@/common/services/taxonomy-service';
import { ProjectForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'New project',
};

export default async function NewProjectPage() {
  // The gate FIRST, and before the read — see `requireDashboardSession`. This page reads the
  // taxonomy now, so the payload it protects is real rather than theoretical.
  await requireDashboardSession();

  // A client form cannot import a `server-only` service, so the route reads the terms and
  // hands them down. Uncached, so a term added a minute ago is selectable immediately.
  const terms = await listTaxonomyRows('project');
  return <ProjectForm terms={terms} />;
}
