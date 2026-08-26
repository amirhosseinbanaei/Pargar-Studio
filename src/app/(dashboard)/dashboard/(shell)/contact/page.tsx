// src/app/(dashboard)/dashboard/(shell)/contact/page.tsx
/** `/dashboard/contact` — the singleton editor for the public contact page's CONTENT. */
import type { Metadata } from 'next';
import { getContactRow } from '@/common/services/contact-service';
import { ContactForm, requireDashboardSession } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Contact',
};

export default async function DashboardContactPage() {
  await requireDashboardSession();

  const contact = await getContactRow();
  if (!contact) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Contact</h1>
        <p className="text-fs-sm text-t-lo">
          The database has not been seeded yet, so there is no contact record to edit. Run{' '}
          <code className="font-mono text-t-md">npm run db:seed</code> and reload this page.
        </p>
      </div>
    );
  }

  return <ContactForm contact={contact} />;
}
