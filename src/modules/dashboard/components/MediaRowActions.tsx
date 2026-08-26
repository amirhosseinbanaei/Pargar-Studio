// src/modules/dashboard/components/MediaRowActions.tsx
/** The per-row controls on the media list: reorder, edit, delete. See `ProjectRowActions`. */
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/common/components/ds';
import { deleteMediaAction, moveMediaAction } from '../actions/media-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { RowReorder } from './RowReorder';

export interface MediaRowActionsProps {
  id: number;
  slug: string;
  title: string;
  editHref: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderDisabledReason?: string;
}

export function MediaRowActions({
  id,
  slug,
  title,
  editHref,
  canMoveUp,
  canMoveDown,
  reorderDisabledReason,
}: MediaRowActionsProps) {
  const router = useRouter();
  const name = title.trim() === '' ? slug : title;

  return (
    <div className="flex items-center justify-end gap-2">
      <RowReorder
        recordName={name}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        disabledReason={reorderDisabledReason}
        onMove={direction => moveMediaAction({ id, direction })}
      />

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
