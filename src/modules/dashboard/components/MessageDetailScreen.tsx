// src/modules/dashboard/components/MessageDetailScreen.tsx
/**
 * The full body of one message, and the read side effect of opening it.
 *
 * ─── MARKING READ IS A SERVER ACTION FIRED ON MOUNT, NOT A WRITE INSIDE THE PAGE'S RENDER ──
 * The obvious-looking alternative — have the ROUTE call `markContactMessageRead` directly
 * while it renders — has a real failure mode: `next/link` prefetches a route on
 * hover/viewport by default, so a reader scanning the inbox and merely pausing over a row
 * would silently mark it read before ever opening it, and "unread" would stop meaning what
 * it says. Firing the mutation from a mounted CLIENT component instead means it only runs
 * when the detail view actually renders in the browser, which prefetching a Server
 * Component payload does not trigger — and it keeps the write inside this module's one
 * write mechanism, an action, rather than carving out a second one for this single case.
 *
 * `useEffect` runs once (`id` is stable for the life of this view — a rename is impossible,
 * messages have no editable fields) and only when the message arrived unread, so re-opening
 * an already-read message costs nothing.
 */
'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ContactMessage } from '@/common/schemas/contact-message';
import {
  deleteContactMessageAction,
  markContactMessageReadAction,
} from '../actions/contact-message-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { formatReceivedAt } from '../lib/format-date';

const LIST_PATH = '/dashboard/messages';

export interface MessageDetailScreenProps {
  message: ContactMessage;
}

export function MessageDetailScreen({ message }: MessageDetailScreenProps) {
  const router = useRouter();
  const [read, setRead] = useState(message.readAt !== null);
  const [, startTransition] = useTransition();
  // Guards against the effect firing twice under React 18/19 Strict Mode's mount-unmount-
  // remount in development, which would otherwise fire the action twice — harmless given
  // `markRead` is idempotent, but a spurious second network call every dev reload is not a
  // signal worth reintroducing.
  const firedRef = useRef(false);

  useEffect(() => {
    if (message.readAt !== null || firedRef.current) return;
    firedRef.current = true;
    startTransition(async () => {
      const result = await markContactMessageReadAction(message.id);
      if (result.ok) setRead(true);
    });
  }, [message.id, message.readAt]);

  return (
    <div className="flex max-w-[48rem] flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={LIST_PATH}
          className="text-fs-xs tracking-mid-kavan text-t-lo uppercase transition-colors duration-[var(--d-xs)] ease-out-kavan hover:text-t-hi"
        >
          ← Messages
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">{message.subject}</h1>
          <span className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
            {read ? 'Read' : 'Unread'}
          </span>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-fs-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-t-xlo">From</dt>
            <dd className="text-t-hi">{message.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-t-xlo">Email</dt>
            <dd className="text-t-hi">
              <a href={`mailto:${message.email}`} className="hover:text-a-1">
                {message.email}
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-t-xlo">Received</dt>
            <dd className="text-t-md">{formatReceivedAt(message.createdAt)}</dd>
          </div>
        </dl>
      </header>

      <p className="max-w-none text-fs-sm leading-relaxed whitespace-pre-wrap text-t-hi">
        {message.body}
      </p>

      <div className="border-t border-rule pt-6">
        <DeleteRecordDialog
          recordName={`the message from ${message.name || message.email}`}
          recordKind="message"
          onConfirm={() => deleteContactMessageAction(message.id)}
          onDeleted={() => {
            router.replace(LIST_PATH);
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
