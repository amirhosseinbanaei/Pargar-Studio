// src/modules/dashboard/components/MediaRowActions.tsx
/** The per-row controls on the media list: reorder, edit, delete. See `ProjectRowActions`. */
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/common/components/ds';
import { deleteMediaAction } from '../actions/media-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { SortableDragHandle } from './SortableList';

export interface MediaRowActionsProps {
  id: number;
  slug: string;
  title: string;
  editHref: string;
}

export function MediaRowActions({ id, slug, title, editHref }: MediaRowActionsProps) {
  const router = useRouter();
  const name = title.trim() === '' ? slug : title;

  return (
    <div className="flex items-center justify-end gap-2">
      {/*
        THE DRAG HANDLE. It reaches its row through `SortableList`'s context rather than
        taking props, which is what lets it sit here — where the two arrows used to be —
        instead of forcing the table to grow a handle column. Whether it is disabled, and
        why, is the LIST's answer, not this row's.
      */}
      <SortableDragHandle />

      <Button variant="ghost" size="sm" asChild>
        <Link href={editHref}>Edit</Link>
      </Button>

      <DeleteRecordDialog
        recordName={name}
        recordKind="media entry"
        onConfirm={() => deleteMediaAction(id)}
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
