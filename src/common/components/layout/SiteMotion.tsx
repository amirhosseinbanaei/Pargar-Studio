// src/common/components/layout/SiteMotion.tsx
'use client';
/**
 * THE client boundary for the motion layer — one component, mounted once by the site
 * layout, and the only file in the app that carries `'use client'` on behalf of
 * `common/lib/motion/`.
 *
 * That is deliberate and load-bearing. None of the motion modules carries a directive of
 * its own: the directive marks a BOUNDARY, not a requirement, and putting it on a shared
 * library would drag every importer — including a Server Component that only wanted a type
 * — into the client graph. One boundary here, at the leaf that actually needs the DOM.
 *
 * It renders the two elements the modules look up by id (`#preload`, `#cursor`) because
 * they are pure chrome that must not exist before this component decides whether they
 * should: the preloader over a server-rendered page is a flourish, and a custom cursor for
 * a reduced-motion or touch visitor is a bug. Both modules answer that question
 * themselves; this component's job is to give them a DOM and to take it back.
 *
 * It lives in the LAYOUT, so it mounts once per document and survives every client
 * navigation. Mounting it per page would replay the preloader on every route change.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  endIntro,
  initCursor,
  revealShell,
  runPreload,
  smoothScroll,
  type CursorHandle,
} from '@/common/lib/motion';

const INTRO_DEADLINE_MS = 2600;

/**
 * The cursor handle, shared with whichever leaf needs to invalidate it.
 *
 * A context and not a module-level singleton: a singleton in a shared library is a second
 * source of truth that survives across React trees, and in dev — where Fast Refresh
 * remounts components without reloading the module — it hands the new tree the old,
 * destroyed handle. The value is a REF so that reading it never re-renders a consumer.
 */
const CursorContext = createContext<{ current: CursorHandle | null }>({ current: null });

/**
 * The cursor handle, or `null` when there is no custom cursor — on touch, under
 * `prefers-reduced-motion`, or before the effect has run. Every call site must tolerate
 * `null`; that is the normal case for a large share of visitors, not an error.
 */
export function useCursor(): CursorHandle | null {
  return useContext(CursorContext).current;
}

export interface SiteMotionProps {
  /** `t('brand.name')` and the tagline line — the preloader is above the React tree's copy. */
  brand: string;
  tagline: string;
  /**
   * The rest of the site. Taken as a PROP rather than imported, which is what keeps the
   * whole tree below this boundary server-rendered — the generators included.
   */
  children: ReactNode;
}

export function SiteMotion({ brand, tagline, children }: SiteMotionProps) {
  // A ref, not state: nothing renders from it, and setting state here would re-run the
  // effect that created it.
  const cursorRef = useRef<CursorHandle | null>(null);

  useEffect(() => {
    const cursor = initCursor();
    cursorRef.current = cursor;

    // Hard deadline, from `legacy/js/main.js:120`. Whatever the intro is doing — throttled
    // in a background tab, blocked on a stylesheet, or simply broken — the site is on
    // screen within 2.6s. `endIntro()` is idempotent, so racing it is safe.
    const deadline = setTimeout(endIntro, INTRO_DEADLINE_MS);

    // Someone who tabs away mid-intro should come back to a finished page, not a paused
    // one: a hidden document stops advancing its animation timeline, so an animation
    // started just before the switch never resolves on its own.
    const onVisibility = (): void => {
      if (document.hidden) endIntro();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let cancelled = false;
    void runPreload()
      .then(() => (cancelled ? undefined : revealShell()))
      .catch(() => {
        /* An intro that fails must not take the page with it — `endIntro` below still runs. */
      })
      .finally(() => {
        clearTimeout(deadline);
        endIntro();
      });

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      document.removeEventListener('visibilitychange', onVisibility);
      cursor.destroy();
      cursorRef.current = null;
      // If the visitor navigates away mid-intro, the mask must come off with us or the
      // next route inherits an `is-intro` html element with everything at opacity 0.
      endIntro();
    };
  }, []);

  return (
    <CursorContext.Provider value={cursorRef}>
      {/* The preloader. `runPreload` finds it by id, drives the bar, and hides it. */}
      <div className="preload" id="preload">
        <div className="preload__inner">
          <span className="preload__name">{brand}</span>
          <span className="preload__sub">{tagline}</span>
        </div>
        <div className="preload__meter">
          <i className="preload__bar" id="preloadBar" />
        </div>
        <span className="preload__num" id="preloadNum">
          00
        </span>
      </div>

      {/* The custom cursor. `initCursor` returns an inert handle and leaves this hidden on
          touch pointers and under `prefers-reduced-motion`. */}
      <div className="cursor" id="cursor" aria-hidden="true">
        <span className="cursor__ring" />
        <span className="cursor__dot" />
        <span className="cursor__label" id="cursorLabel" />
      </div>

      {children}
    </CursorContext.Provider>
  );
}

/**
 * Mount the inertia scroller on a scroll region.
 *
 * Exported here rather than as its own file because it is the same boundary: a component
 * that wants smooth scrolling is a client leaf, and this is the two lines it needs.
 */
export function useSmoothScroll(host: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const scroller = smoothScroll(node);
    return () => scroller?.destroy();
  }, [host]);
}
