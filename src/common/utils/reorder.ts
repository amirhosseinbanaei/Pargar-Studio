// src/common/utils/reorder.ts
/**
 * Turning a reorder INTENT into the renumbering it means, against the rows the server holds.
 *
 * Pure, and deliberately so: every `move*` service in `common/services/` runs this and then
 * writes what it returns, so a bug here is a bug in five places at once — and it is testable
 * in milliseconds with no database, which the services themselves are not.
 *
 * ─── THE INTENT IS `{ id, afterId }`, AND THE CLIENT NEVER POSTS AN ORDERING ──────
 * Prompt 6 sent `{ id, direction }` because the control was a pair of arrows. A drag from
 * position 3 to position 17 cannot be spelled as a direction, so the shape had to change —
 * and the property AGENTS.md records had to survive the change:
 *
 *  - **The SERVER computes the positions.** The client says which record moved and which
 *    record it now follows; everything else — what number each row ends up with, which rows
 *    have to be rewritten — is worked out here from the rows the database currently holds.
 *  - **A client posting the full ordering is still refused.** Seventy-six ids assembled from
 *    a page loaded five minutes ago silently revert every change anyone else made in between,
 *    and carry seventy-six numbers that all have to be re-validated. Two ids do not.
 *
 * ─── WHY A RELATIVE ANCHOR RATHER THAN AN ABSOLUTE INDEX ──────────────────────────
 * `{ id, toIndex: 17 }` would be the obvious alternative and it degrades badly under a
 * concurrent edit: if somebody deleted a row above the target in another tab, index 17 is now
 * a different position than the one the person was looking at, and the move lands one place
 * off with nothing anywhere reporting it. An anchor names a RECORD, so it means the same
 * thing whatever happened above it — and when the anchor itself is gone, that is detectable
 * (`null` below) rather than silently wrong.
 *
 * ─── AND WHY IT RENUMBERS BY INDEX RATHER THAN SWAPPING ───────────────────────────
 * Unchanged from `moveProject`'s original reasoning, and now the only copy of it: swapping
 * two `sortOrder` values is a silent no-op the moment two rows share one, and ties are the
 * NORMAL state of a freshly seeded taxonomy axis (every term starts at the column default of
 * 0). Renumbering by position is total — it repairs ties as a side effect — and only the rows
 * whose number actually changed are written, so a one-place move is still two updates.
 */

/** The only two columns this needs. Every reorderable row in the app has both. */
export interface OrderedRow {
  id: number;
  sortOrder: number;
}

export interface ReorderPlan<T extends OrderedRow> {
  /** The row that moved, as it was read. */
  moved: T;
  /** Every row in its new order — the renumbering, expressed positionally. */
  ordered: readonly T[];
  /**
   * Only the rows whose `sortOrder` does not already equal their new index, each paired with
   * the number to write. On a settled list this is the moved row plus the ones it passed;
   * on a list with ties it is however many it takes to make the order unambiguous again.
   */
  writes: ReadonlyArray<{ row: T; sortOrder: number }>;
}

/**
 * Work out what `{ id, afterId }` means against `rows`, which MUST already be in `sortOrder`
 * order — that is what makes index arithmetic here meaningful rather than a guess about how
 * the rows arrived.
 *
 * `afterId === null` means "first". Any other value names the row this one now follows.
 *
 * Returns `null` for every case that means NOTHING HAPPENED, and they are deliberately not
 * distinguished from each other:
 *
 *  - the moved id is not in the list — deleted in another tab;
 *  - the anchor is not in the list — the same, for the row that was dropped onto;
 *  - the anchor IS the moved row — a request nobody's interface can produce;
 *  - the row is already exactly there — a drop that travelled no distance.
 *
 * The caller answers all four the way `moveProjectAction` has always answered a no-op: a
 * success that purges nothing, and a client that refreshes and sees the truth. A stale drop
 * is not a failure worth an error screen, and a 404 for one would put a red message on screen
 * for a person who did nothing wrong.
 */
export function planReorder<T extends OrderedRow>(
  rows: readonly T[],
  id: number,
  afterId: number | null,
): ReorderPlan<T> | null {
  if (afterId === id) return null;

  const from = rows.findIndex(row => row.id === id);
  if (from === -1) return null;

  const moved = rows[from];
  const without = rows.filter(row => row.id !== id);

  let to: number;
  if (afterId === null) {
    to = 0;
  } else {
    const anchor = without.findIndex(row => row.id === afterId);
    if (anchor === -1) return null;
    to = anchor + 1;
  }

  /*
   * Removing the row at `from` and re-inserting it at the same index restores the input
   * exactly, so this one comparison covers every no-op — including a drop back where it
   * started, which a pointer produces constantly.
   */
  if (to === from) return null;

  const ordered = [...without];
  ordered.splice(to, 0, moved);

  const writes = ordered.flatMap((row, index) =>
    row.sortOrder === index ? [] : [{ row, sortOrder: index }],
  );

  return { moved, ordered, writes };
}
