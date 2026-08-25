// src/common/components/layout/SectionHint.tsx
'use client';
/**
 * The one word of guidance in the footer bar: "Select a section" on the index, "Esc to
 * close" once you are inside one.
 *
 * A leaf, and a client one, for the same reason as `Stage`: the answer is the pathname.
 * The shell transition also writes this element mid-transition (`#hint` is the id it looks
 * up), which is why the two agree on both strings — they come from the same dictionary
 * keys, passed in from the server so no dictionary reaches the browser.
 */
import { usePathname } from 'next/navigation';
import { sectionSegment } from './Stage';

export interface SectionHintProps {
  /** `t('ui.selectSection')`. */
  index: string;
  /** `t('ui.escToClose')`. */
  section: string;
}

export function SectionHint({ index, section }: SectionHintProps) {
  const inSection = sectionSegment(usePathname()) !== null;
  return (
    <span className="footbar__hint" id="hint">
      {inSection ? section : index}
    </span>
  );
}
