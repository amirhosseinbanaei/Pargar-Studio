// src/modules/dashboard/components/RowReorder.tsx
/**
 * The reorder control: two arrows, one row.
 *
 * ─── WHY ARROWS AND NOT DRAG-AND-DROP ─────────────────────────────────────────────
 * Three reasons, in the order they decided it. Drag-and-drop needs a library, and AGENTS.md
 * bans a new dependency for something the platform already does. A drag handle is a genuine
 * accessibility problem — a pointer-only affordance that needs a whole parallel keyboard
 * implementation to be usable at all, and the arrows ARE that implementation, so shipping
 * only the arrows is shipping the part that works for everyone. And dragging inside a
 * seventy-six-row scrolling table is a poor interaction even with a pointer: the target is
 * usually off-screen.
 *
 * ─── IT SENDS AN INTENT, NOT AN ORDER ─────────────────────────────────────────────
 * The action receives `{ id, direction }` and the SERVER works out what that means against
 * the current rows. The alternative — posting all seventy-six ids in their new order — would
 * silently revert every change made by anyone else since this page was loaded, and would
 * carry seventy-six numbers that all have to be re-validated. See `moveProject` in the
 * service.
 *
 * ─── DISABLED AT THE BOUNDARIES, AND WHILE SORTED ─────────────────────────────────
 * The first row cannot move up and the last cannot move down: those buttons are `disabled`
 * rather than present-and-inert, so a keyboard user tabs past them instead of into a control
 * that does nothing.
 *
 * More subtly, BOTH are disabled whenever the table is sorted by a column. "Move up" means
 * "one position earlier in `sort_order`", and in a list sorted by title that is a position
 * the reader cannot see — the row would appear to jump somewhere arbitrary, or not to move
 * at all. Disabling with a reason in the title attribute is the honest answer; silently
 * reordering something invisible is not.
 */
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/common/services/action-result';

export interface RowReorderProps {
  onMove: (direction: 'up' | 'down') => Promise<ActionResult>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The row's name, so each button has a distinct accessible name in a table of many. */
  recordName: string;
  /** Set when the table is sorted by a column; both arrows are then disabled. */
  disabledReason?: string;
}

/**
 * The arrow buttons' treatment, hoisted and exported so the gallery editor's LOCAL reorder
 * arrows look identical to these without a second copy of the string. Two copies of a class
 * list this long is how one control ends up with a focus ring the other lost.
 */
export const REORDER_BUTTON_CLASS =
  'flex size-7 cursor-pointer items-center justify-center border border-rule text-t-lo transition-colors duration-[var(--d-xs)] ease-out-kavan hover:border-rule-md hover:text-t-hi focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-a-1 disabled:cursor-not-allowed disabled:opacity-disabled disabled:hover:border-rule disabled:hover:text-t-lo';

export function RowReorder({
  onMove,
  canMoveUp,
  canMoveDown,
  recordName,
  disabledReason,
}: RowReorderProps) {
  const router = useRouter();
  /**
   * `useTransition` rather than a boolean, so `isPending` stays true until the SERVER has
   * re-rendered the list after `router.refresh()`. A plain flag would clear the moment the
   * action resolved, re-enabling the arrows while the table still showed the old order — and
   * a second click would then move the row twice.
   */
  const [pending, startTransition] = useTransition();

  const move = (direction: 'up' | 'down') => {
    startTransition(async () => {
      const result = await onMove(direction);
      // `refresh()` only on success. Re-rendering after a failed write costs a round trip to
      // display exactly what is already on screen.
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => move('up')}
        disabled={pending || !canMoveUp || Boolean(disabledReason)}
        // Names the ROW, not just the direction: "Move up" repeated seventy-six times is
        // seventy-six identically-named buttons to anyone navigating by control.
        aria-label={`Move ${recordName} up`}
        title={disabledReason ?? 'Move up'}
        className={REORDER_BUTTON_CLASS}
      >
        <span aria-hidden>↑</span>
      </button>
      <button
        type="button"
        onClick={() => move('down')}
        disabled={pending || !canMoveDown || Boolean(disabledReason)}
        aria-label={`Move ${recordName} down`}
        title={disabledReason ?? 'Move down'}
        className={REORDER_BUTTON_CLASS}
      >
        <span aria-hidden>↓</span>
      </button>
    </div>
  );
}
