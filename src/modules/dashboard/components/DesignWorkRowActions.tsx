// src/modules/dashboard/components/DesignWorkRowActions.tsx
/**
 * The per-row controls on the design-work list: reorder, edit, delete. Same shape as
 * `ProjectRowActions` — see that file for why this is its own tightly-drawn client leaf.
 */
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/common/components/ds';
import { deleteDesignWorkAction, moveDesignWorkAction } from '../actions/design-work-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { RowReorder } from './RowReorder';

export interface DesignWorkRowActionsProps {
  id: number;
  slug: string;
  title: string;
  editHref: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderDisabledReason?: string;
}

export function DesignWorkRowActions({
  id,
  slug,
  title,
  editHref,
  canMoveUp,
  canMoveDown,
  reorderDisabledReason,
}: DesignWorkRowActionsProps) {
  const router = useRouter();
  const name = title.trim() === '' ? slug : title;

  return (
    <div className="flex items-center justify-end gap-2">
      <RowReorder
        recordName={name}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        disabledReason={reorderDisabledReason}
        onMove={direction => moveDesignWorkAction({ id, direction })}
      />

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
