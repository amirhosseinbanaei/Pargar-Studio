// src/common/components/layout/Stage.tsx
'use client';
/**
 * The `#stage` element, and the one bit of chrome state that depends on WHERE you are.
 *
 * `shell.css` expresses "a section is open" as `.stage.is-open`: the wordmark's glyph
 * rotates, the columns collapse, and — since prompt 8 replaced the close button with the
 * language switch — the masthead's switch appears. On the static site a script added
 * that class. With real routes the answer is simply "is this a section route or the
 * index", which is the pathname — so this component reads it and nothing else.
 *
 * It is `'use client'` and its children are NOT. They arrive as a prop, which keeps the
 * entire masthead / page / footbar tree server-rendered; importing them here instead would
 * drag the whole site into the client bundle, generators included.
 *
 * `usePathname` deliberately rather than `useSearchParams`: the latter forces a Suspense
 * boundary on every consumer, and a filtered projects URL is still a section route.
 *
 * ─── THIS COMPONENT OWNS `is-open`. `shell.ts` ONLY ANTICIPATES IT (prompt 13) ────
 * Two things write that class and the rule between them is written down here because a
 * className with two owners is how a column ends up dead — React only writes `className`
 * when its own prop CHANGED between renders, so an imperative `classList` write it did not
 * make is invisible to it.
 *
 *  - THIS component owns the DURABLE value. It is a function of the pathname, which is the
 *    truth, and it has to be in the server HTML: rendering it in an effect instead would
 *    paint the index layout for one frame on every deep link to a section route.
 *  - `motion/shell.ts` adds it inside the FLIP's layout mutation, ~a second before the
 *    route commits, because that IS the transition — the columns have to collapse while
 *    the glyphs are measured. It is anticipating the pathname its own `onChange` is about
 *    to cause, never disagreeing with it.
 *  - Therefore `createShell`'s `destroy()` deliberately does NOT remove it. Removing a
 *    class this component's prop still claims is present would leave React unable to
 *    re-add it, and the section route would lose its chrome. See that function's header.
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
