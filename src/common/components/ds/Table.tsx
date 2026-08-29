// src/common/components/ds/Table.tsx
/**
 * A declarative table: pass columns and rows, get the archive's own hairline
 * treatment. No 'use client' — this is markup, and the dashboard's list pages
 * are Server Components. `onRowClick` is the one thing that needs a client
 * boundary, so a caller that passes it must itself be a Client Component.
 */
import * as React from 'react';
import {
  BaseTable,
  BaseTableBody,
  BaseTableCaption,
  BaseTableCell,
  BaseTableHead,
  BaseTableHeader,
  BaseTableRow,
} from '@/common/components/ui/table';
import {
  tableCellVariants,
  tableHeadVariants,
  tableRowVariants,
  tableVariants,
  type TableVariantProps,
} from '@/common/components/variants/table';
import { cn } from '@/common/lib/utils';

export interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Rendered per row. Keep it pure — this may run on the server. */
  cell: (row: T) => React.ReactNode;
  /** Numeric columns read better trailing; text reads better leading. */
  align?: 'start' | 'end';
  className?: string;
}

/**
 * One row, as this component prepared it: the record, its key, the class list the variants
 * decided, and its cells already rendered.
 *
 * Handed to `renderRows` so a caller can supply its own row ELEMENT — the drag-and-drop list
 * needs the `<tr>` to carry a ref and a transform — without owning, or copying, the cell
 * markup. Copying it is how one table ends up with a different padding from the rest.
 */
export interface TableRowRender<T> {
  row: T;
  key: string;
  className: string;
  cells: React.ReactNode;
}

export interface TableProps<T> extends TableVariantProps {
  columns: ReadonlyArray<TableColumn<T>>;
  rows: readonly T[];
  /** Stable identity per row. Never the array index — a re-sort reuses state. */
  rowKey: (row: T) => string;
  /** Rendered instead of an empty <tbody>, which reads as a broken page. */
  empty?: React.ReactNode;
  /** A visually-hidden caption is what names the table for a screen reader. */
  caption?: React.ReactNode;
  captionVisible?: boolean;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  /**
   * Takes over rendering of the body's ROWS — not their contents. Given every row already
   * reduced to `{ row, key, className, cells }`, it returns whatever goes inside `<tbody>`.
   *
   * It exists for one thing this component cannot do itself: a sortable table needs its
   * `<tr>` to be rendered by a Client Component that can attach a drag ref to it, while the
   * cells stay server-rendered. Without the slot the only alternative is a second copy of the
   * cell markup outside the design system. The empty state is NOT routed through it — an
   * empty list has no rows to render and no order to change.
   */
  renderRows?: (rows: ReadonlyArray<TableRowRender<T>>) => React.ReactNode;
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  captionVisible = false,
  onRowClick,
  isRowSelected,
  renderRows,
  density,
  className,
}: TableProps<T>) {
  const body: TableRowRender<T>[] = rows.map(row => ({
    row,
    key: rowKey(row),
    className: cn(
      tableRowVariants({
        interactive: !!onRowClick,
        selected: isRowSelected?.(row) ?? false,
      }),
    ),
    cells: (
      <>
        {columns.map(column => (
          <BaseTableCell
            key={column.key}
            className={cn(
              tableCellVariants(),
              column.align === 'end' ? 'text-end' : 'text-start',
              column.className,
            )}
          >
            {column.cell(row)}
          </BaseTableCell>
        ))}
      </>
    ),
  }));

  return (
    <BaseTable className={cn(tableVariants({ density }), className)}>
      {caption && (
        <BaseTableCaption
          className={cn(
            'text-fs-xs tracking-mid-kavan text-t-lo uppercase',
            captionVisible ? 'pb-3 text-start' : 'sr-only',
          )}
        >
          {caption}
        </BaseTableCaption>
      )}
      <BaseTableHeader className={cn(tableHeadVariants())}>
        <BaseTableRow>
          {columns.map(column => (
            <BaseTableHead
              key={column.key}
              className={cn(
                'px-3 font-normal first:ps-0 last:pe-0',
                column.align === 'end' ? 'text-end' : 'text-start',
                column.className,
              )}
            >
              {column.header}
            </BaseTableHead>
          ))}
        </BaseTableRow>
      </BaseTableHeader>
      <BaseTableBody>
        {rows.length === 0 ? (
          <BaseTableRow>
            <BaseTableCell
              colSpan={columns.length}
              className="px-0 py-12 text-center text-fs-sm tracking-tight-kavan text-t-lo uppercase"
            >
              {empty ?? 'Nothing here yet'}
            </BaseTableCell>
          </BaseTableRow>
        ) : renderRows ? (
          renderRows(body)
        ) : (
          body.map(item => (
            <BaseTableRow
              key={item.key}
              onClick={onRowClick ? () => onRowClick(item.row) : undefined}
              className={item.className}
            >
              {item.cells}
            </BaseTableRow>
          ))
        )}
      </BaseTableBody>
    </BaseTable>
  );
}
Table.displayName = 'Table';
