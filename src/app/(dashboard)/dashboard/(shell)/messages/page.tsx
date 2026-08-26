// src/app/(dashboard)/dashboard/(shell)/messages/page.tsx
/**
 * `/dashboard/messages` — the inbox. `listContactMessages()` is deliberately UNCACHED
 * (`common/services/contact-message-service.ts`): a cached list would show "no new
 * messages" while one sits in the database.
 */
import type { Metadata } from 'next';
import { listContactMessages } from '@/common/services/contact-message-service';
import { MessageListScreen, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Messages',
};

export default async function DashboardMessagesPage() {
  await requireDashboardSession();

  const rows = await listContactMessages();
  return <MessageListScreen rows={rows} />;
}
