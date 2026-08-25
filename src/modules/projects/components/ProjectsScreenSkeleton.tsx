// src/modules/projects/components/ProjectsScreenSkeleton.tsx
/**
 * The projects index, shape-accurate and empty.
 *
 * SHAPE-ACCURATE is the requirement, not "a loading indicator": the fallback has the same
 * rail, the same grid, the same card count and the same 4:3 frames as the real screen, so
 * when the content arrives nothing moves. A spinner — or a skeleton with the wrong number
 * of boxes — produces a layout jump that reads as a bug and undoes the reason for
 * streaming in the first place.
 *
 * It lives beside the screen it stands in for, and is exported from the same barrel, so
 * the two change together. A skeleton parked in `app/` drifts from its component inside a
 * month.
 */
import { Skeleton } from '@/common/components/loader';

/** One screenful, matching `EAGER` in `CardReveal`. Below the fold nothing is visible. */
const CARDS = 12;
const GROUPS = 4;

export function ProjectsScreenSkeleton() {
  return (
    <div className="route" aria-hidden="true">
      <div className="route__rail">
        <Skeleton className="mb-4 h-3 w-24" />
        {Array.from({ length: GROUPS }, (_, i) => (
          <Skeleton key={i} className="mb-5 h-8 w-full" />
        ))}
      </div>

      <div className="route__main">
        <div className="grid">
          {Array.from({ length: CARDS }, (_, i) => (
            <div key={i}>
              {/* The same 4:3 box `.card__frame` reserves, so the grid's row heights are
                  settled before a single drawing exists. */}
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="flex items-baseline justify-between gap-3 pt-3">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="mt-2 h-2 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
