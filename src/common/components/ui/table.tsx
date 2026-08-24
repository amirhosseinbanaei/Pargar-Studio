// src/common/components/ui/table.tsx
/**
 * REGENERABLE — see ui/button.tsx.
 *
 * No 'use client' on this one, deliberately: a table is markup with no state
 * and no handlers, so it renders on the server. The `ds/` wrapper adds the
 * directive only if a caller passes an interactive row.
 */
import { cn } from '@/common/lib/utils';

export function BaseTable({ className, ...props }: React.ComponentProps<'table'>) {
  // The wrapper is what scrolls, not the page: a wide table must never make the
  // document scroll sideways.
  return (
    <div data-slot="table-wrapper" className="w-full overflow-x-auto">
      <table data-slot="table" className={cn(className)} {...props} />
    </div>
  );
}

export function BaseTableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

export function BaseTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

export function BaseTableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn(className)} {...props} />;
}

export function BaseTableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th data-slot="table-head" scope="col" className={cn(className)} {...props} />;
}

export function BaseTableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn(className)} {...props} />;
}

export function BaseTableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn(className)} {...props} />;
}
