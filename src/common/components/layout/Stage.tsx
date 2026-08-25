// src/common/components/layout/Stage.tsx
'use client';
/**
 * The `#stage` element, and the one bit of chrome state that depends on WHERE you are.
 *
 * `shell.css` expresses "a section is open" as `.stage.is-open`: the wordmark's glyph
 * rotates, the closer appears, the columns collapse. On the static site a script added
 * that class. With real routes the answer is simply "is this a section route or the
 * index", which is the pathname — so this component reads it and nothing else.
 *
 * It is `'use client'` and its children are NOT. They arrive as a prop, which keeps the
 * entire masthead / page / footbar tree server-rendered; importing them here instead would
 * drag the whole site into the client bundle, generators included.
 *
 * `usePathname` deliberately rather than `useSearchParams`: the latter forces a Suspense
 * boundary on every consumer, and a filtered projects URL is still a section route.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isLocale } from '@/common/i18n/routing';

export interface StageProps {
  children: ReactNode;
}

/**
 * `/en` and `/fa` are the index; anything deeper is a section.
 *
 * Exported for the mark stepper, which needs the same answer one step more precisely.
 */
export function sectionSegment(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const rest = segments.length > 0 && isLocale(segments[0]) ? segments.slice(1) : segments;
  return rest[0] ?? null;
}

export function Stage({ children }: StageProps) {
  const open = sectionSegment(usePathname()) !== null;

  return (
    <div className={open ? 'stage is-open' : 'stage'} id="stage">
      {children}
    </div>
  );
}
