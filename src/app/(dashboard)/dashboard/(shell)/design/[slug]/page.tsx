// src/app/(dashboard)/dashboard/(shell)/design/[slug]/page.tsx
/** `/dashboard/design/<slug>` — the edit form. See `projects/[slug]/page.tsx`. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDesignWorkRow } from '@/common/services/design-work-service';
import { listTaxonomyRows } from '@/common/services/taxonomy-service';
import { DesignWorkForm, requireDashboardSession } from '@/modules/dashboard';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const designWork = await getDesignWorkRow(slug);
  return { title: designWork?.titleEn || slug };
}

export default async function EditDesignWorkPage({ params }: PageProps) {
  await requireDashboardSession();

  const { slug } = await params;
  const [designWork, terms] = await Promise.all([
    getDesignWorkRow(slug),
    listTaxonomyRows('design'),
  ]);
  if (!designWork) notFound();

  return <DesignWorkForm designWork={designWork} terms={terms} />;
}
