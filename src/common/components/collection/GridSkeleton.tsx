// src/common/components/collection/GridSkeleton.tsx
/**
 * A card grid, shape-accurate and empty — the route fallback for the Design and Media
 * lists.
 *
 * SHAPE-ACCURATE is the requirement, not "a loading indicator": the same rail, the same
 * card count and the same 4:3 frames as the real screen, so nothing moves when the
 * content arrives. A spinner, or a skeleton with the wrong number of boxes, produces a
 * layout jump that reads as a bug and undoes the reason for streaming at all.
 *
 * Both lists are small and fixed (9 works, 14 entries), so `cards` is passed rather than
 * guessed — `ProjectsScreenSkeleton` renders one screenful of 76 because the rest are
 * below the fold, and these two have no fold.
 */
import { Skeleton } from '@/common/components/loader';

export interface GridSkeletonProps {
  cards: number;
  /** How many option rows the rail stands in for. */
  railOptions: number;
}

export function GridSkeleton({ cards, railOptions }: GridSkeletonProps) {
  return (
    <div className="route" aria-hidden="true">
      <div className="route__rail">
        <Skeleton className="mb-4 h-3 w-24" />
        <Skeleton className="mb-3 h-4 w-full" />
        {Array.from({ length: railOptions }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-3 w-3/4" />
        ))}
      </div>

      <div className="route__main">
        <div className="grid">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i}>
              {/* The same 4:3 box `.card__frame` reserves, so the row heights are settled
                  before a single drawing exists. */}
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="flex items-baseline justify-between gap-3 pt-3">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="mt-2 h-2 w-1/2" />
              <Skeleton className="mt-3 h-2 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
