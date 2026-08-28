// src/common/components/layout/SectionEscape.tsx
'use client';
/**
 * Escape leaves an open section. Nothing is rendered.
 *
 * WHY THIS FILE EXISTS. Prompt 8 deleted `Closer`, whose `<button>` was one of two things
 * it did — the other was binding Escape at the ROUTE level. The assumption on the way in
 * was that `createShell`'s own `keydown` handler (`common/lib/motion/shell.ts`) already
 * covered that, so the key would survive the button. IT DOES NOT, and this was checked in
 * a browser rather than reasoned about:
 *
 *   - The shell is constructed by `ShellTransition`, which only the INDEX route renders.
 *   - Navigating to a section unmounts it and runs `destroy()`, which takes the `keydown`
 *     listener off `window` — by design, or every round trip would leave another one.
 *   - A reader who deep-links to `/en/projects` never had a shell in the first place.
 *
 * So on every section route — the only place Escape means anything — the shell's handler
 * is not bound. Pressing Escape on `/en/projects` did nothing at all, arriving by deep
 * link or by clicking through from the index. This restores the behaviour where `Closer`
 * had it: in the route tree, alive whether or not a transition is running.
 *
 * It renders `null` rather than a control because the affordance is gone on purpose. The
 * key is a shortcut for readers who already know it, and the visible ways out — the
 * wordmark, the back arrow on a detail page, the browser's own Back button — are the
 * discoverable ones.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sectionSegment } from './Stage';

export interface SectionEscapeProps {
  /** Where to land when there is no history to go back to. `localeHref(locale)`. */
  home: string;
}

export function SectionEscape({ home }: SectionEscapeProps) {
  const router = useRouter();
  const inSection = sectionSegment(usePathname()) !== null;

  useEffect(() => {
    if (!inSection) return;

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      // `history.length > 1` is the only signal available for "arrived here from inside
      // the site"; a deep link opened in a fresh tab has a length of 1 and must go to the
      // index rather than out of the site entirely. Same rule `Closer` used.
      if (window.history.length > 1) router.back();
      else router.push(home);
    };

    addEventListener('keydown', onKeydown);
    return () => removeEventListener('keydown', onKeydown);
  }, [inSection, home, router]);

  return null;
}
