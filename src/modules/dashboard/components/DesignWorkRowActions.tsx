// src/modules/dashboard/components/DesignWorkRowActions.tsx
/**
 * The per-row controls on the design-work list: reorder, edit, delete. Same shape as
 * `ProjectRowActions` — see that file for why this is its own tightly-drawn client leaf.
 */
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/common/components/ds';
import { deleteDesignWorkAction } from '../actions/design-work-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { SortableDragHandle } from './SortableList';

export interface DesignWorkRowActionsProps {
  id: number;
  slug: string;
  title: string;
  editHref: string;
}

export function DesignWorkRowActions({ id, slug, title, editHref }: DesignWorkRowActionsProps) {
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
        recordKind="design work"
        onConfirm={() => deleteDesignWorkAction(id)}
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
