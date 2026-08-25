// src/app/(dashboard)/loading.tsx
/**
 * The dashboard's Suspense fallback.
 *
 * ─── IT IS NOT DECORATION; IT IS WHAT MAKES THE ROUTES WORK ───────────────────────
 * Cache Components is on (`cacheComponents: true`), and every screen under this group is
 * DYNAMIC by design: the shell reads a request header, the pages read the session and the
 * database with no `'use cache'` anywhere. Under Cache Components, dynamic work needs a
 * Suspense boundary above it — this file is that boundary for the whole group, declared once
 * rather than repeated per route.
 *
 * ─── IT IS SHAPE-ACCURATE ON PURPOSE ──────────────────────────────────────────────
 * The rail is 16rem wide because the real navigation is `md:w-64`, and the header strip is
 * the same height as the real one. A fallback whose geometry does not match the content
 * replacing it produces a layout shift at exactly the moment the reader has started looking
 * — which is worse than no fallback at all. `Skeleton` from the loader tier carries the
 * animation and the reduced-motion behaviour, so neither is re-decided here.
 *
 * `aria-hidden` on the whole thing, with one live region saying "Loading". A screen reader
 * announcing forty skeleton boxes is noise; announcing the state once is information.
 */
import { Skeleton } from '@/common/components/loader';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-s-0 md:flex-row">
      <p className="sr-only" role="status" aria-live="polite">
        Loading
      </p>

      <div
        aria-hidden
        className="flex shrink-0 flex-col gap-8 border-b border-rule bg-s-1 px-6 py-6 md:w-64 md:border-e md:border-b-0 md:px-5 md:py-8"
      >
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col gap-2">
          {/* Six, because there are six content areas. */}
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div aria-hidden className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-rule px-6 py-4 md:px-10">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="flex flex-col gap-6 px-6 py-8 md:px-10 md:py-10">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-11 w-full" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
