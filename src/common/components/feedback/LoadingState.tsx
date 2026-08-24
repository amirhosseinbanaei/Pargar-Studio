// src/common/components/feedback/LoadingState.tsx
/**
 * The route-level loading announcement.
 *
 * NO 'use client' — it renders from `loading.tsx` and from server `<Suspense>`.
 *
 * `role="status" aria-live="polite"` is not decoration: without it a non-visual
 * user gets SILENCE during a load, with no indication that anything is
 * happening at all.
 *
 * Prefer a shape-matched skeleton (`loader/TableSkeleton`) wherever the shape of
 * what is arriving is known. Use this for a region whose contents genuinely have
 * no fixed geometry, and pass the skeleton as `children` when they do.
 */
import { cn } from '@/common/lib/utils';

export interface LoadingStateProps {
  label?: string;
  /** A shape-matched skeleton to show under the announcement. */
  children?: React.ReactNode;
  className?: string;
}

export function LoadingState({ label = 'Loading', children, className }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn('flex w-full flex-col gap-4', className)}>
      <span className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">{label}</span>
      {children}
    </div>
  );
}
