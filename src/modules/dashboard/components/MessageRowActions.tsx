// src/modules/dashboard/components/MessageRowActions.tsx
/**
 * The per-row control on the messages list: delete. No reorder — an inbox has no order an
 * editor sets, it is newest-first by `created_at` — and no separate "edit": the row's own
 * title already links to the read view.
 */
'use client';
import { useRouter } from 'next/navigation';
import { deleteContactMessageAction } from '../actions/contact-message-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';

export interface MessageRowActionsProps {
  id: number;
  /** What is being deleted, in the reader's words — "the message from <name>". */
  recordName: string;
}

export function MessageRowActions({ id, recordName }: MessageRowActionsProps) {
  const router = useRouter();

  return (
    <DeleteRecordDialog
      recordName={recordName}
      recordKind="message"
      onConfirm={() => deleteContactMessageAction(id)}
      onDeleted={() => router.refresh()}
    />
  );
}
