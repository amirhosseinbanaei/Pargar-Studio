// src/modules/dashboard/schemas/reorder.ts
/**
 * THE REORDER WIRE SHAPE, spelled once for every list in the dashboard.
 *
 * Four actions parse this — projects, design works, media and taxonomy terms — and they parse
 * the SAME schema rather than four copies of it, because the shape is the contract and four
 * copies is four chances for one of them to accept an ordering, an index, or a missing
 * `afterId` that the others refuse.
 *
 * ─── `{ id, afterId }`, AND WHY IT IS NOT AN INDEX AND NOT AN ORDERING ────────────
 *  - `id` is the record that moved. It names the RECORD, not the caller — the distinction
 *    the "never accept an identity as an argument" rule is about.
 *  - `afterId` is the record it now FOLLOWS. `null` means first.
 *
 * A relative anchor names a row, so it means the same thing however the rows above it have
 * changed since the page was loaded; an absolute `toIndex` means a different position the
 * moment somebody deletes a row in another tab, and lands the move one place off with nothing
 * reporting it. And when the anchor itself has been deleted, the server can SEE that and
 * answer a stale request as a no-op — an index gives it nothing to notice.
 *
 * It is two ids, so `strictObject` re-validates the whole payload in two clauses. The
 * alternative a drag interface reaches for — posting every id in its new order — carries
 * seventy-six numbers to re-validate and silently reverts every change anyone else made since
 * the page loaded. The server still computes every position from the rows it holds; see
 * `common/utils/reorder.ts`.
 *
 * `strictObject` also means a payload carrying `sortOrder`, `direction` or an extra key is
 * REFUSED rather than ignored — the same mass-assignment guard every other write schema here
 * applies.
 */
import { z } from 'zod';

export const reorderSubmissionSchema = z.strictObject({
  id: z.number().int().positive(),
  /**
   * `.nullable()`, deliberately not `.nullish()`: "first" is spelled `null` and an ABSENT key
   * is a caller that forgot to say where the row went, which must be a 422 rather than a
   * silent move to the top of the list.
   */
  afterId: z.number().int().positive().nullable(),
});

export type ReorderSubmission = z.infer<typeof reorderSubmissionSchema>;
