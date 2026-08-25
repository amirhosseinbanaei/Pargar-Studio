// src/common/components/layout/SkipLink.tsx
'use client';
/**
 * "Skip to navigation" — the first focusable thing in the document.
 *
 * Ported from `legacy/index.html:62`, where its target was always `#cols` because there
 * was only ever one page. With real routes there are two things worth skipping to: the
 * column index on the front page, and the content region on a section route. A skip link
 * pointing at an element that is not in the document does nothing at all, silently, which
 * is worse than not having one — so the target follows the route.
 *
 * This is the whole reason it is a client leaf. It reads the pathname and nothing else.
 */
import { usePathname } from 'next/navigation';
import { sectionSegment } from './Stage';

export interface SkipLinkProps {
  /** `t('ui.skip')`. */
  label: string;
}

export function SkipLink({ label }: SkipLinkProps) {
  const target = sectionSegment(usePathname()) !== null ? '#main' : '#cols';
  return (
    <a className="u-skip" href={target}>
      {label}
    </a>
  );
}
