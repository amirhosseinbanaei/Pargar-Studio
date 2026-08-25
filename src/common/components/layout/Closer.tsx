// src/common/components/layout/Closer.tsx
'use client';
/**
 * The Close control, and the Escape key that does the same thing.
 *
 * On the static site closing was the shell transition played in reverse over the same
 * document. Here a section is a ROUTE, so closing is a navigation back to the index —
 * which is also what the browser's Back button does, and the two now agree by
 * construction instead of by a `popstate` handler that had to keep them in sync
 * (`legacy/js/main.js:106`).
 *
 * It renders a `<button>` rather than a link because it means "leave this section", not
 * "go to that URL": `router.back()` when there is somewhere to go back to preserves the
 * reader's scroll position and history depth, and the index is the fallback for a deep
 * link that has no history behind it. `shell.css` already hides it entirely unless
 * `.stage.is-open`.
 *
 * On the index it is inert and hidden, and the shell transition's own `#closer` handler —
 * which is still bound there — resolves to a no-op because nothing is open.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sectionSegment } from './Stage';

export interface CloserProps {
  /** `t('ui.close')`. */
  label: string;
  /** Where to land when there is no history to go back to. */
  home: string;
}

export function Closer({ label, home }: CloserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inSection = sectionSegment(pathname) !== null;

  const close = (): void => {
    // `history.length > 1` is the only signal available for "arrived here from inside the
    // site"; a deep link opened in a fresh tab has a length of 1 and must go to the index
    // rather than out of the site entirely.
    if (window.history.length > 1) router.back();
    else router.push(home);
  };

  useEffect(() => {
    if (!inSection) return;
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
    };
    addEventListener('keydown', onKeydown);
    return () => removeEventListener('keydown', onKeydown);
    // `close` is stable for the life of a route: it closes over `router` and `home`, both
    // of which are stable, and re-binding on every render would churn the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSection, home, router]);

  return (
    <button
      className="closer magnet"
      id="closer"
      type="button"
      onClick={close}
      // Hidden from assistive technology on the index, where it is also visually hidden —
      // a button announced as "Close" with nothing to close is noise.
      aria-hidden={inSection ? undefined : true}
      tabIndex={inSection ? undefined : -1}
    >
      <span>{label}</span>
      <svg className="closer__x" viewBox="0 0 12 12" aria-hidden="true">
        <line x1="1" y1="1" x2="11" y2="11" />
        <line x1="11" y1="1" x2="1" y2="11" />
      </svg>
    </button>
  );
}
