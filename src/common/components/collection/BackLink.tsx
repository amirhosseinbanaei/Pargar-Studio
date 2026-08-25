// src/common/components/collection/BackLink.tsx
/**
 * The arrow that leads out of a detail page and back to its list.
 *
 * PROMOTED IN PROMPT 5 out of `modules/projects/components/ProjectDetail.tsx`; ported
 * from `legacy/js/ui/panel.js:87`, where it was a `<button data-back>` that swapped the
 * list back into the open panel. It is a real `<Link>` to a real route now, so it is
 * middle-clickable, prefetchable and correct with JavaScript off — and `route.css`
 * restates `panel.css`'s button rule for the anchor.
 */
import Link from 'next/link';

export interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link className="detail__back magnet" href={href}>
      <svg viewBox="0 0 14 8" aria-hidden="true">
        <path d="M13 4H1M1 4l3.5-3M1 4l3.5 3" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
