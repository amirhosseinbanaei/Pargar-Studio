// src/app/(dashboard)/dashboard/(shell)/messages/[id]/page.tsx
/**
 * `/dashboard/messages/<id>` — the read view. Keyed by the numeric id: messages have no
 * slug, and there is no public page this URL needs to mirror the way `projects/<slug>`
 * mirrors `/en/projects/<slug>`.
 *
 * Marking the message read happens client-side, on mount — see `MessageDetailScreen` for
 * why this route's own render does not do it.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContactMessageById } from '@/common/services/contact-message-service';
import { MessageDetailScreen, requireDashboardSession } from '@/modules/dashboard';

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseId(id);
  const message = parsed ? await getContactMessageById(parsed) : null;
  return { title: message?.subject || 'Message' };
}

export default async function MessageDetailPage({ params }: PageProps) {
  await requireDashboardSession();

  const { id } = await params;
  const parsed = parseId(id);
  const message = parsed ? await getContactMessageById(parsed) : null;
  if (!message) notFound();

  return <MessageDetailScreen message={message} />;
}
