// src/common/utils/__tests__/reorder.test.ts
/**
 * `planReorder` is the arithmetic behind every reorderable list in the app — four services
 * call it and then write exactly what it returns. It is also the piece most likely to be
 * subtly wrong in a way nothing else in the gate would catch: an off-by-one in the anchor
 * arithmetic moves a row one place away from where somebody dropped it, which looks like a
 * flaky interface rather than a bug in a function.
 */
import { describe, expect, it } from 'vitest';
import { planReorder, type OrderedRow } from '../reorder';

/** Ids and positions only — that is the whole surface the planner reads. */
const rows = (...ids: number[]): OrderedRow[] => ids.map((id, index) => ({ id, sortOrder: index }));

const idsOf = (list: readonly OrderedRow[]) => list.map(row => row.id);

describe('planReorder', () => {
  it('moves a row down and renumbers only what changed', () => {
    // 1 goes after 3: [1,2,3,4] -> [2,3,1,4]. Positions 0..2 change; 4 keeps index 3.
    const plan = planReorder(rows(1, 2, 3, 4), 1, 3);

    expect(plan).not.toBeNull();
    expect(idsOf(plan!.ordered)).toEqual([2, 3, 1, 4]);
    expect(plan!.writes.map(write => [write.row.id, write.sortOrder])).toEqual([
      [2, 0],
      [3, 1],
      [1, 2],
    ]);
    expect(plan!.moved.id).toBe(1);
  });

  it('moves a row up', () => {
    const plan = planReorder(rows(1, 2, 3, 4), 4, 1);

    expect(idsOf(plan!.ordered)).toEqual([1, 4, 2, 3]);
  });

  it('treats a null anchor as FIRST', () => {
    const plan = planReorder(rows(1, 2, 3), 3, null);

    expect(idsOf(plan!.ordered)).toEqual([3, 1, 2]);
  });

  it('is a no-op when the row is already first and is dropped first', () => {
    expect(planReorder(rows(1, 2, 3), 1, null)).toBeNull();
  });

  it('is a no-op when the row is dropped back where it started', () => {
    // A pointer produces this constantly: press, wobble, release. It must not write.
    expect(planReorder(rows(1, 2, 3), 2, 1)).toBeNull();
  });

  it('is a no-op for an id that is not in the list', () => {
    expect(planReorder(rows(1, 2, 3), 99, 1)).toBeNull();
  });

  it('is a no-op when the ANCHOR is not in the list — deleted in another tab', () => {
    // The stale case the anchor shape exists to make detectable. An absolute index could not
    // notice it and would land the row somewhere plausible and wrong.
    expect(planReorder(rows(1, 2, 3), 1, 99)).toBeNull();
  });

  it('is a no-op when a row is asked to follow itself', () => {
    expect(planReorder(rows(1, 2, 3), 2, 2)).toBeNull();
  });

  it('REPAIRS TIES as a side effect, which a swap could not', () => {
    // Every taxonomy term starts at the column default of 0, so a freshly seeded axis is all
    // ties — and swapping two equal values is a silent no-op. Renumbering by position writes
    // every row that is not already at its index.
    const tied = [
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 0 },
      { id: 3, sortOrder: 0 },
    ];

    const plan = planReorder(tied, 3, null);

    expect(idsOf(plan!.ordered)).toEqual([3, 1, 2]);
    expect(plan!.writes.map(write => [write.row.id, write.sortOrder])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('does not mutate the rows it was given', () => {
    const original = rows(1, 2, 3);
    const snapshot = original.map(row => ({ ...row }));

    planReorder(original, 1, 3);

    expect(original).toEqual(snapshot);
  });

  it('lands a drop between two VISIBLE rows after that row in the full order', () => {
    // The filtered-view case. The screen shows 1, 4 and 7 of [1..7]; the row is dropped
    // between 4 and 7, so the anchor is 4 — and it lands directly after 4, which is after
    // everything the reader could see above it and before everything below.
    const plan = planReorder(rows(1, 2, 3, 4, 5, 6, 7), 1, 4);

    expect(idsOf(plan!.ordered)).toEqual([2, 3, 4, 1, 5, 6, 7]);
  });
});
