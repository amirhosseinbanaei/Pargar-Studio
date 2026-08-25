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
import { ProjectForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'New project',
};

export default async function NewProjectPage() {
  // This page reads nothing, so there is no payload to protect — the gate is here anyway,
  // so that "every dashboard page starts with this line" is a rule with no exceptions to
  // remember. An exception is what the next page copies.
  await requireDashboardSession();

  return <ProjectForm />;
}
