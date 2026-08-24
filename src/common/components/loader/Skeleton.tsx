// src/common/components/loader/Skeleton.tsx
/**
 * NO 'use client'. A skeleton is a static box, and keeping it hook-free is what
 * lets it render from `loading.tsx` and from a server `<Suspense fallback>`
 * without shipping JavaScript for it.
 */
import { cn } from '@/common/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      // `--s-3` is the same well the cards and plates use, so a skeleton reads
      // as the empty version of the thing rather than as a foreign grey.
      className={cn('animate-pulse bg-s-3', className)}
      {...props}
    />
  );
}
