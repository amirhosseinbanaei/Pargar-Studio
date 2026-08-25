// src/common/components/loader/TableSkeleton.tsx
/**
 * The shape-matched fallback for `ds/Table`.
 *
 * It reproduces the table's wrapper, its hairline rules, its row height and its
 * column count. A centred spinner instead would collapse the container to zero
 * height and drop everything below it up the page; when the data lands it all
 * jumps back down. That is a layout-shift regression, and it makes the load
 * FEEL slower than the skeleton does.
 *
 * Keep this file beside the component it stands in for, so a layout change to
 * one visibly demands a change to the other.
 */
import { Skeleton } from './Skeleton';
import { cn } from '@/common/lib/utils';

export interface TableSkeletonProps {
  /** Match the real table's column count, or the widths line up with nothing. */
  columns?: number;
  /** Match the real list's page size. */
  rows?: number;
  className?: string;
}

export function TableSkeleton({ columns = 4, rows = 6, className }: TableSkeletonProps) {
  return (
    // `aria-hidden` because the route's `role="status"` already announces the
    // load; without it a screen reader narrates a tree of empty boxes.
    <div aria-hidden="true" className={cn('w-full', className)}>
      <div className="flex gap-3 border-b border-rule py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-rule py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              // Varied widths, deterministic per cell: identical bars read as a
              // loading GRAPHIC, staggered ones read as text that has not
              // arrived. No RNG — this renders on the server and must match.
              className="h-4 flex-1"
              style={{ maxWidth: `${[92, 68, 80, 55][(r + c) % 4]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
