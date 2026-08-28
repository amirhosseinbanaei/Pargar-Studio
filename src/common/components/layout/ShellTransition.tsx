// src/common/components/layout/ShellTransition.tsx
'use client';
/**
 * The site's signature move, wired to the router.
 *
 * WHAT THIS FILE DECIDES. Opening a section used to expand a column in place over the same
 * document; it is a navigation now. The open decision was whether the per-glyph FLIP
 * survives that change, and it does: the transition plays on the outgoing view exactly as
 * before — same durations, same stagger, same FLIP — and the route commits at the moment
 * the old code would have mounted a panel. Nothing about `common/lib/motion/shell.ts`
 * changed to make that work; only what is injected into it did.
 *
 * The injection points, and why each is what it is:
 *
 *  - `onChange` NAVIGATES. It is the shell's "the transition has settled" callback and
 *    fires after the FLIP, so the URL changes when the animation lands rather than when
 *    the pointer went down. The route was already prefetched by then (see `onPointerDown`
 *    below and `<Link prefetch>` on every column title), so the swap is a paint, not a
 *    fetch.
 *  - `mountPanel` / `unmountPanel` are NO-OPS. There are no panels: a section is a route,
 *    and its content is a Server Component rendered by the framework.
 *  - `nav` returns an EMPTY array, and that is not laziness. `setTitles()` rewrites
 *    `.col__hit`'s `innerHTML` from it, which on the static site was how the titles got
 *    their `.ch` boxes at all. Those boxes are server-rendered now (`GlyphText`), and
 *    inside React-managed DOM — an `innerHTML` write there replaces nodes React still
 *    holds references to. An empty list means `setTitles` finds no entry for any column
 *    and leaves every one of them alone, which is exactly the required behaviour.
 *
 * WHAT DOES NOT SURVIVE: the reverse transition. Closing is a plain navigation — the
 * wordmark, the browser's Back button, or the Escape key `SectionEscape` binds — and its
 * outgoing view is a section route with no columns to fly back, so there is nothing on
 * screen to animate. A half-played reverse is worse than a clean cut, so closing is a
 * clean cut. (`Closer` was the button that used to start it; prompt 8 deleted it and the
 * language switch took its place in the masthead.) See AGENTS.md.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createShell } from '@/common/lib/motion';
import { NAV } from '@/common/constants/site';
import { localeHref } from '@/common/i18n/navigation';
import type { Locale } from '@/common/schemas/locale';
import { useCursor } from './SiteMotion';

/**
 * The handful of strings the transition speaks, passed in from the server rather than
 * looked up here. The catalog is two full tables; this is five strings.
 *
 * `close` was a sixth until prompt 8: `createShell`'s `relang()` re-labelled the masthead's
 * X button, and both the button and that line are gone.
 */
export interface ShellStrings {
  /** `t('ui.escToClose')` — written into `#hint` when a section opens. */
  escToClose: string;
  /** `t('ui.selectSection')` — written back into `#hint` on close. */
  selectSection: string;
  /** `t('ui.opened')` — the announcement suffix for the `aria-live` region. */
  opened: string;
  /** `t('ui.returned')`. */
  returned: string;
  /** `nav.<id>` for each of the five sections, for the same announcement. */
  sectionLabels: Record<string, string>;
}

export interface ShellTransitionProps {
  locale: Locale;
  isRTL: boolean;
  strings: ShellStrings;
}

export function ShellTransition({ locale, isRTL, strings }: ShellTransitionProps) {
  const router = useRouter();
  const cursor = useCursor();

  /**
   * The strings arrive as a fresh object on every render. Held in a ref and read through
   * it, so a re-render of this component cannot land in the effect's dependency list —
   * destroying and rebuilding the shell mid-transition would strand it with `busy` set and
   * the columns half-collapsed.
   *
   * Written in its own effect rather than during render: a ref write during render is
   * invisible to React's concurrent rendering and is what `react-hooks/refs` forbids. The
   * ordering is safe because this effect is declared FIRST, so it has already run by the
   * time the shell effect below reads the ref — and the shell only reads it inside a
   * callback the transition invokes much later anyway.
   */
  const stringsRef = useRef(strings);
  useEffect(() => {
    stringsRef.current = strings;
  }, [strings]);

  useEffect(() => {
    const hrefFor = (id: string): string => {
      const section = NAV.find(item => item.id === id);
      return localeHref(locale, section?.path ?? '/');
    };

    const shell = createShell({
      cursor,
      live: document.getElementById('live'),

      onChange({ id, push }) {
        // `push: false` means the shell was driven BY history rather than by a click —
        // no successor here, but navigating on it would fight the router.
        if (!push || !id) return;
        router.push(hrefFor(id));
      },

      // No panels. See the header.
      mountPanel: () => {},
      unmountPanel: () => {},
      nav: () => [],

      t: key => {
        const copy = stringsRef.current;
        if (key === 'ui.escToClose') return copy.escToClose;
        if (key === 'ui.selectSection') return copy.selectSection;
        if (key === 'ui.opened') return copy.opened;
        if (key === 'ui.returned') return copy.returned;
        if (key.startsWith('nav.')) return copy.sectionLabels[key.slice(4)] ?? '';
        return '';
      },
      num: value => value,
      isRTL: () => isRTL,
    });

    /**
     * Warm the destination while the animation plays.
     *
     * The transition takes about a second. Starting the fetch when it ENDS would spend
     * that second twice; starting it on pointer-down overlaps the two, so the route is
     * usually in the client cache before `onChange` asks for it. `router.prefetch` is
     * idempotent and deduplicated, so racing it with `<Link>`'s own viewport prefetch
     * costs nothing.
     *
     * `pointerdown` rather than `click`: it fires first, and on a slow tap that is tens of
     * milliseconds of head start for free.
     */
    const onPointerDown = (e: PointerEvent): void => {
      const hit = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-open]') : null;
      if (hit?.dataset.open) router.prefetch(hrefFor(hit.dataset.open));
    };
    const cols = document.getElementById('cols');
    cols?.addEventListener('pointerdown', onPointerDown);

    return () => {
      cols?.removeEventListener('pointerdown', onPointerDown);
      shell.destroy();
    };
  }, [locale, isRTL, router, cursor]);

  // The hairline that sweeps across the stage during the transition. Pure decoration —
  // every exit path in `shell.ts` clears it — but `createShell` refuses to construct
  // without it, because a missing `#wipe` means the markup and the module disagree.
  return <i className="wipe" id="wipe" aria-hidden="true" />;
}
