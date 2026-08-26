// src/modules/dashboard/components/MessageListScreen.tsx
/**
 * The messages inbox: everything a stranger has sent through the public contact form,
 * newest first.
 *
 * ─── NO SORT, AND THAT IS DELIBERATE ──────────────────────────────────────────────
 * `listContactMessages()` already returns newest-first by `created_at` — the one order an
 * inbox actually wants — so this table renders `RecordTable` with `key: null` throughout:
 * no column declares a `sortValue`, which is what preserves that natural order (see
 * `RecordTable.sortRows`).
 *
 * ─── UNREAD IS A VISUAL WEIGHT, NOT JUST A DOT ────────────────────────────────────
 * An unread row's name and subject render at full weight (`text-t-hi`) with a small marker;
 * a read one steps down to `text-t-lo`. Colour alone is never the only signal — the marker
 * carries `aria-hidden` and the row's accessible name states "unread" as a word, in
 * `caption`-adjacent text a screen reader announces regardless of how the glyph renders.
 */
import Link from 'next/link';
import type { ContactMessage } from '@/common/schemas/contact-message';
import { RecordTable, type RecordTableColumn } from './RecordTable';
import { MessageRowActions } from './MessageRowActions';
import { formatReceivedAt } from '../lib/format-date';

const LIST_PATH = '/dashboard/messages';

export interface MessageListScreenProps {
  rows: readonly ContactMessage[];
}

export function MessageListScreen({ rows }: MessageListScreenProps) {
  const unreadCount = rows.filter(row => row.readAt === null).length;

  const columns: RecordTableColumn<ContactMessage>[] = [
    {
      key: 'from',
      header: 'From',
      cell: row => (
        <Link
          href={`${LIST_PATH}/${row.id}`}
          className="flex flex-col gap-0.5 transition-colors duration-[var(--d-xs)] ease-out-kavan"
        >
          <span
            className={`text-fs-sm tracking-flat-kavan ${row.readAt === null ? 'text-t-hi' : 'text-t-lo'}`}
          >
            {row.readAt === null && (
              <span aria-hidden className="me-1.5 inline-block size-1.5 rounded-full bg-a-1" />
            )}
            {row.name}
            {row.readAt === null && <span className="sr-only"> (unread)</span>}
          </span>
          <span className="text-fs-xs text-t-xlo">{row.email}</span>
        </Link>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      cell: row => (
        <span
          className={`text-fs-sm tracking-flat-kavan ${row.readAt === null ? 'text-t-hi' : 'text-t-lo'}`}
        >
          {row.subject}
        </span>
      ),
    },
    {
      key: 'received',
      header: 'Received',
      align: 'end',
      cell: row => <span className="text-fs-xs text-t-xlo">{formatReceivedAt(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'end',
      cell: row => (
        <MessageRowActions id={row.id} recordName={`the message from ${row.name || row.email}`} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Messages</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          contact_messages ·{' '}
          {unreadCount > 0 ? `${unreadCount} unread of ${rows.length}` : `${rows.length} total`}
        </p>
      </header>

      <RecordTable
        columns={columns}
        rows={rows}
        rowKey={row => String(row.id)}
        sort={{ key: null, direction: 'asc' }}
        sortHref={() => LIST_PATH}
        caption="Messages sent through the public contact form, newest first"
        empty="No messages yet."
      />
    </div>
  );
}
