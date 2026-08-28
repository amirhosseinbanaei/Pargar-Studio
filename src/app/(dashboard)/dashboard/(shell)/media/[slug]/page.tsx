// src/app/(dashboard)/dashboard/(shell)/media/[slug]/page.tsx
/** `/dashboard/media/<slug>` — the edit form. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMediaRow } from '@/common/services/media-service';
import { listProjectRows } from '@/common/services/project-service';
import { listTaxonomyRows } from '@/common/services/taxonomy-service';
import { MediaForm, requireDashboardSession } from '@/modules/dashboard';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const media = await getMediaRow(slug);
  return { title: media?.titleEn || slug };
}

export default async function EditMediaPage({ params }: PageProps) {
  await requireDashboardSession();

  const { slug } = await params;
  const [media, projects, terms] = await Promise.all([
    getMediaRow(slug),
    listProjectRows(),
    listTaxonomyRows('media'),
  ]);
  if (!media) notFound();

  return <MediaForm media={media} projectOptions={projects} terms={terms} />;
}
