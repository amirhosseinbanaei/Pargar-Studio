// src/app/(dashboard)/dashboard/(shell)/projects/[slug]/page.tsx
/**
 * `/dashboard/projects/<slug>` — the edit form.
 *
 * KEYED BY SLUG, NOT BY ID, so the dashboard's URL for a record is the same identifier the
 * public detail page uses: somebody comparing `/dashboard/projects/qeytarieh-08-residence`
 * with `/en/projects/qeytarieh-08-residence` can see at a glance that they are the same
 * record. A row id in a bug report is legible to nobody.
 *
 * The WRITE still goes by id (`project.id`), which the row carries. That matters on a rename:
 * the id is stable, so a save that changes the slug updates the record it was editing rather
 * than looking for one under a name that does not exist yet.
 *
 * `notFound()` for a slug that is not there — a HARD 404 here, unlike the public detail
 * route's documented soft 404, because this page is fully dynamic and nothing has been
 * flushed by the time the lookup answers.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProjectRow } from '@/common/services/project-service';
import { ProjectForm, requireDashboardSession } from '@/modules/dashboard';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectRow(slug);
  // The English title: this tool's interface language is English, and a Persian tab title on
  // an English document is the kind of small wrongness nobody reports and everybody notices.
  return { title: project?.titleEn || slug };
}

export default async function EditProjectPage({ params }: PageProps) {
  await requireDashboardSession();

  const { slug } = await params;
  const project = await getProjectRow(slug);
  if (!project) notFound();

  return <ProjectForm project={project} />;
}
