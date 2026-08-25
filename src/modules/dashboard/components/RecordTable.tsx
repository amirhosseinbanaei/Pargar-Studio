// src/modules/dashboard/components/RecordTable.tsx
/**
 * THE LIST TABLE every dashboard area uses, with sorting.
 *
 * ─── SORTING IS A URL, NOT CLIENT STATE ───────────────────────────────────────────
 * Every column header is a `<Link>` that flips `?sort=` and `?dir=`. No `useState`, no
 * `'use client'`, no JavaScript — which buys four things a client-side sort does not: a
 * sorted view is linkable, the back button undoes a sort, the sort survives a reload, and
 * the table is a Server Component so none of it ships to the browser. It is the same model
 * the public site's filter rail already uses (AGENTS.md, prompt 4), for the same reasons.
 *
 * Sorting HERE rather than in the query is deliberate at this size: 76 rows are already in
 * memory for the search and filter pass above, and a second trip to the database to reorder
 * an array that is already there costs more than it saves. That trade is stated in
 * `sortRows` and is the thing to revisit if a table ever gets big.
 *
 * ─── IT WRAPS `ds/Table`, IT DOES NOT REPLACE IT ──────────────────────────────────
 * The hairline treatment, the empty state and the density all come from the design system.
 * What this adds is the sortable header and the URL arithmetic behind it — the part that is
 * about being a dashboard rather than about being a table.
 */
import Link from 'next/link';
import { Table, type TableColumn } from '@/common/components/ds';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** The active column's key, or `null` for the collection's natural order. */
  key: string | null;
  direction: SortDirection;
}

export interface RecordTableColumn<T> extends TableColumn<T> {
  /**
   * Present = sortable. The function returns the value to compare, so a column that renders
   * markup can still sort on the string behind it — `undefined` here means the column is
   * decorative (a row's action buttons) and gets no header link.
   */
  sortValue?: (row: T) => string | number;
}

export interface RecordTableProps<T> {
  columns: ReadonlyArray<RecordTableColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  sort: SortState;
  /**
   * Builds the href for a given sort state, so this component never has to know which
   * search parameters the surrounding screen also cares about. The screen owns its URL.
   */
  sortHref: (sort: SortState) => string;
  caption: React.ReactNode;
  empty?: React.ReactNode;
}

export function RecordTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  sortHref,
  caption,
  empty,
}: RecordTableProps<T>) {
  const headed = columns.map(column => ({
    ...column,
    header: column.sortValue ? (
      <SortLink column={column} sort={sort} sortHref={sortHref} />
    ) : (
      column.header
    ),
  }));

  return (
    <Table
      columns={headed}
      rows={rows}
      rowKey={rowKey}
      caption={caption}
      empty={empty}
      density="compact"
    />
  );
}

function SortLink<T>({
  column,
  sort,
  sortHref,
}: {
  column: RecordTableColumn<T>;
  sort: SortState;
  sortHref: (sort: SortState) => string;
}) {
  const active = sort.key === column.key;
  /**
   * Clicking the active column reverses it; clicking a new one starts ascending. Starting a
   * fresh column descending is the other plausible choice and is worse here — most of these
   * columns are text, and a title list that opens at Z is disorienting.
   */
  const next: SortState = {
    key: column.key,
    direction: active && sort.direction === 'asc' ? 'desc' : 'asc',
  };

  return (
    <Link
      href={sortHref(next)}
      /**
       * `aria-sort` on the header cell is the machine-readable half of this control, and it
       * is what tells a screen-reader user the table is sorted at all. The arrow glyph is
       * decoration; without `aria-sort` the sort is invisible to anyone not looking at it.
       *
       * It belongs on the `<th>`, and `ds/Table` renders the header cell around whatever
       * this returns — so it is set here on the link and read by assistive tech through the
       * cell's contents. The visible arrow is `aria-hidden` for the same reason: it would
       * otherwise be announced as a character.
       */
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex items-center gap-1.5 text-t-lo transition-colors duration-[var(--d-xs)] ease-out-kavan hover:text-t-hi aria-[sort=ascending]:text-a-1 aria-[sort=descending]:text-a-1"
    >
      {column.header}
      <span aria-hidden className="text-fs-xs">
        {active ? (sort.direction === 'asc' ? '↑' : '↓') : '·'}
      </span>
    </Link>
  );
}

/**
 * Apply a `SortState` to a list of rows. Pure, exported, and unit-tested.
 *
 * `key: null` returns the input UNTOUCHED rather than falling back to some default column.
 * That is what preserves a collection's natural order — for projects, `sort_order`, which is
 * the order the reorder arrows write and the order the public site renders. A default sort
 * here would silently make those arrows appear to do nothing.
 *
 * `localeCompare` for strings, subtraction for numbers. A plain `<` on strings sorts by code
 * point, which puts every uppercase letter before every lowercase one and mis-sorts anything
 * accented — visible immediately in a list of project titles.
 */
export function sortRows<T>(
  rows: readonly T[],
  columns: ReadonlyArray<RecordTableColumn<T>>,
  sort: SortState,
): readonly T[] {
  if (sort.key === null) return rows;
  const column = columns.find(candidate => candidate.key === sort.key);
  if (!column?.sortValue) return rows;

  const { sortValue } = column;
  const sign = sort.direction === 'asc' ? 1 : -1;

  // Copy first: sorting the array a Server Component was handed mutates a value the caller
  // may still be using for a count or a filter pass.
  return [...rows].sort((a, b) => {
    const left = sortValue(a);
    const right = sortValue(b);
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
    return String(left).localeCompare(String(right)) * sign;
  });
}

/**
 * Read a sort state out of search parameters, refusing anything that is not a real column.
 *
 * Search parameters are attacker-controlled and, more usually, just stale — a bookmarked URL
 * naming a column that has since been renamed. Either way the answer is the natural order,
 * not a crash and not an empty table.
 */
export function parseSortState<T>(
  columns: ReadonlyArray<RecordTableColumn<T>>,
  rawKey: string | undefined,
  rawDirection: string | undefined,
): SortState {
  const sortable = columns.some(column => column.key === rawKey && column.sortValue);
  return {
    key: sortable && rawKey ? rawKey : null,
    direction: rawDirection === 'desc' ? 'desc' : 'asc',
  };
}
