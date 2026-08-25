// src/modules/dashboard/components/DeleteRecordDialog.tsx
/**
 * THE DELETE CONFIRMATION every dashboard area uses.
 *
 * ─── WHY A CONFIRMATION AT ALL ────────────────────────────────────────────────────
 * Deleting a project deletes the row outright. There is no `deleted_at` column and no undo
 * window — that would be a schema change, and it is recorded as a decision in AGENTS.md
 * rather than left implied. So this dialog IS the safety net, and it is built like one:
 *
 *  - It NAMES the record it is about to remove. "Delete this item?" is a question nobody can
 *    answer correctly from a list of seventy-six rows that all look alike.
 *  - It says what is irreversible, in those words, rather than relying on the reader to know.
 *  - Its confirm button is `variant="danger"` and its cancel button is the one that closes on
 *    Escape and on an overlay click — the safe action is the easy one.
 *
 * ─── IT RETURNS, IT NEVER THROWS ──────────────────────────────────────────────────
 * `onConfirm` hands back an `ActionResult`, so a failure keeps the dialog OPEN with the
 * reason visible. A dialog that closes on failure tells the reader the delete worked, and
 * the row reappearing on the next load reads as a bug in the list rather than a failed write.
 *
 * ─── `'use client'` ───────────────────────────────────────────────────────────────
 * It owns open/closed state and a pending flag. This is the only interactive leaf on the
 * list screen, which is otherwise entirely server-rendered.
 */
'use client';
import { useState, useTransition } from 'react';
import { Button, Dialog } from '@/common/components/ds';
import { mapError, type NormalizedError } from '@/common/errors';
import type { ActionResult } from '@/common/services/action-result';
import { ResultRegion } from './ResultRegion';

export interface DeleteRecordDialogProps {
  /** What is being deleted, in the reader's words — a project's title, not its id. */
  recordName: string;
  /** "project", "design work" — completes the sentence in the dialog body. */
  recordKind: string;
  onConfirm: () => Promise<ActionResult>;
  /** Runs only after the delete actually succeeded. Refresh or navigate here. */
  onDeleted?: () => void;
  /** Overrides the trigger, for a table row that wants something smaller. */
  trigger?: React.ReactNode;
}

export function DeleteRecordDialog({
  recordName,
  recordKind,
  onConfirm,
  onDeleted,
  trigger,
}: DeleteRecordDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /**
   * `useTransition` rather than a `useState` busy flag, because `onDeleted` usually calls
   * `router.refresh()` — and `isPending` then stays true until the SERVER has re-rendered the
   * list. A plain boolean would clear the moment the action resolved, so the dialog would
   * close onto a list still showing the row it just deleted.
   */
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await onConfirm();

      if (result.ok) {
        setOpen(false);
        onDeleted?.();
        return;
      }

      // Branch on status, never on message text. Each of these is a different situation with
      // a different next step for the reader.
      if (result.status === 401) {
        setMessage('Your session has expired. Reload the page and sign in again.');
        return;
      }
      if (result.status === 404) {
        // Already gone — the outcome the reader wanted, reached by someone else. Say so and
        // let them close the dialog, rather than reporting a failure for a row that is not
        // there any more.
        setMessage('That record no longer exists. Close this and refresh the list.');
        return;
      }
      setError(mapError({ status: result.status, body: result.body }));
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Never close while the write is in flight: the dialog is the only thing showing that
        // anything is happening, and a delete that is still running with no UI is how the
        // same row gets deleted twice.
        if (!pending) setOpen(next);
      }}
      size="sm"
      title={`Delete ${recordName}?`}
      description={`This removes the ${recordKind} from the database and from the public site immediately. It cannot be undone.`}
      trigger={
        trigger ?? (
          <Button variant="ghost" size="sm">
            Delete
          </Button>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirm} loading={pending}>
            Delete
          </Button>
        </>
      }
    >
      <ResultRegion error={error} message={message} />
    </Dialog>
  );
}
