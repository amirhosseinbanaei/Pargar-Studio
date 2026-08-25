// src/modules/dashboard/components/ProjectRowActions.tsx
/**
 * The per-row controls on the project list: reorder, edit, delete.
 *
 * ─── WHY THIS EXISTS AS ITS OWN COMPONENT ─────────────────────────────────────────
 * It is the `'use client'` boundary, and it is drawn as tightly as it can be. The list
 * screen, the table, the filters and every cell are Server Components; only these three
 * controls need a browser, because two of them call a Server Action and then refresh the
 * router. Putting the directive on the screen instead would ship all seventy-six rows' worth
 * of markup and the whole filter bar to the client to gain nothing.
 *
 * ─── THE ACTIONS ARE IMPORTED HERE, NOT PASSED DOWN ───────────────────────────────
 * A Server Component may pass a Server Action to a client component as a prop, and doing so
 * here would be worse: the action's reference would be serialized into the RSC payload once
 * per row. Importing it directly is one module reference in the client bundle regardless of
 * how many rows there are.
 */
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/common/components/ds';
import { deleteProjectAction, moveProjectAction } from '../actions/project-actions';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { RowReorder } from './RowReorder';

export interface ProjectRowActionsProps {
  id: number;
  slug: string;
  /** The English title — what the delete dialog names. Falls back to the slug if blank. */
  title: string;
  editHref: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Set when the table is sorted by a column, which makes "up" and "down" meaningless. */
  reorderDisabledReason?: string;
}

export function ProjectRowActions({
  id,
  slug,
  title,
  editHref,
  canMoveUp,
  canMoveDown,
  reorderDisabledReason,
}: ProjectRowActionsProps) {
  const router = useRouter();
  const name = title.trim() === '' ? slug : title;

  return (
    <div className="flex items-center justify-end gap-2">
      <RowReorder
        recordName={name}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        disabledReason={reorderDisabledReason}
        onMove={direction => moveProjectAction({ id, direction })}
      />

      <Button variant="ghost" size="sm" asChild>
        <Link href={editHref}>Edit</Link>
      </Button>

      <DeleteRecordDialog
        recordName={name}
        recordKind="project"
        onConfirm={() => deleteProjectAction(id)}
        /*
          `refresh()` rather than optimistically removing the row from a local copy. The list
          is server-rendered, so there is no client cache holding it — an optimistic removal
          would need one built for the purpose, and it would then be a second source of truth
          for something the server already knows. One round trip is the honest cost.
        */
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
