// src/modules/dashboard/components/DashboardShell.tsx
/**
 * The dashboard's chrome: a navigation rail down the side, a header saying who is signed in
 * with the logout control, and the content region.
 *
 * A SERVER COMPONENT, and it stays one. The only interactive thing in here is the logout
 * control, and that is a `<form action={logoutAction}>` — a Server Action posted by a native
 * form, which needs no client JavaScript at all and works before hydration. Putting
 * `'use client'` on the shell would pull every screen below it into the client bundle.
 *
 * It knows the current path from a REQUEST HEADER (`x-current-path`), injected by
 * `src/proxy.ts`. A Server Component has no request object and a layout cannot read the URL
 * of the child segment rendering inside it, so a request header is the supported channel —
 * and it is what lets the navigation mark the current area on the server rather than
 * shipping a `usePathname()` client leaf to do the same job.
 *
 * ─── IT IS BUILT ON THE SAME TOKEN LAYER AS THE PUBLIC SITE ───────────────────────
 * Champagne on near-black, the wide uppercase tracking, the hairline rules. Not a default
 * admin template: the tokens are the ones `globals.css` already declares, and there is no
 * colour literal anywhere in this module. The one thing it does NOT reuse is the ported
 * shell CSS — `shell.css` and `panel.css` describe a five-column editorial index, which is
 * the wrong geometry for a table of 76 rows, and AGENTS.md already reserves Tailwind
 * utilities for exactly this surface.
 */
import { headers } from 'next/headers';
import Link from 'next/link';
import { BRAND } from '@/common/constants/site';
import { DASHBOARD_AREAS, areaHref, currentArea } from '../lib/areas';
import { logoutAction } from '../actions/session-actions';

export interface DashboardShellProps {
  children: React.ReactNode;
}

export async function DashboardShell({ children }: DashboardShellProps) {
  /**
   * `?? '/dashboard'` is a real fallback, not defensive noise: the header only exists on a
   * request that passed through the proxy, and a route rendered outside one (a test, a
   * future prerender) must still produce a navigation rather than throwing.
   */
  const pathname = (await headers()).get('x-current-path') ?? '/dashboard';
  const active = currentArea(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-s-0 md:flex-row">
      {/*
        ─── THE RAIL STAYS IN VIEW ON DESKTOP (prompt 14) ────────────────────────────
        A 76-row projects table is several viewports tall and the navigation used to scroll
        away with it, so reaching another area meant scrolling back to the top first.

        STICKY, NOT FIXED. `position: fixed` takes the element out of flow, which would
        leave the content column sitting under it and need a matching inset — a second
        number to keep in sync with `md:w-64` forever, and one that is wrong at every width
        where the rail is not exactly that wide. Sticky keeps the element in flow, so the
        content column's own width is still computed from it.

        `md:h-screen` plus `md:overflow-y-auto` is the other half: without a height the
        sticky box is only as tall as its content and `top-0` has nothing to pin, and
        without its own scroller a navigation longer than the viewport would have entries
        that cannot be reached at all.

        BELOW `md` NOTHING STICKS. The rail is a horizontal band above the content there and
        scrolls away with it, exactly as before — `sticky` is applied at the `md:` breakpoint
        only, so the narrow layout is untouched.
      */}
      <nav
        aria-label="Content areas"
        className="flex shrink-0 flex-col gap-8 border-b border-rule bg-s-1 px-6 py-6 md:sticky md:top-0 md:h-screen md:w-64 md:overflow-y-auto md:border-e md:border-b-0 md:px-5 md:py-8"
      >
        <Link
          href="/dashboard"
          className="text-fs-md tracking-wide-kavan text-t-hi uppercase transition-colors duration-[var(--d-xs)] ease-out-kavan hover:text-a-1"
        >
          {BRAND.short}
        </Link>

        <ul className="flex flex-col gap-px">
          {DASHBOARD_AREAS.map(area => (
            <li key={area.segment}>
              {area.available ? (
                <Link
                  href={areaHref(area.segment)}
                  // `aria-current="page"` is the machine-readable half of the highlight.
                  // Colour alone tells a screen reader nothing about where it is.
                  aria-current={active?.segment === area.segment ? 'page' : undefined}
                  className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-fs-sm tracking-tight-kavan text-t-md uppercase transition-colors duration-[var(--d-xs)] ease-out-kavan hover:bg-s-2 hover:text-t-hi aria-[current=page]:bg-s-3 aria-[current=page]:text-a-1"
                >
                  {area.label}
                  <span className="font-mono text-fs-xs tracking-flat-kavan text-t-xlo lowercase">
                    {area.table}
                  </span>
                </Link>
              ) : (
                /*
                  Inert text, not a link. A disabled entry must not be focusable and must not
                  navigate — a `<Link>` with `pointer-events: none` is still in the tab order
                  and still reachable by a screen reader as a link that goes nowhere.
                  `aria-disabled` on a non-interactive element would be a lie of a different
                  kind, so the state is carried by the visible "soon" marker instead.
                */
                <p
                  className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-fs-sm tracking-tight-kavan text-t-xlo uppercase"
                  title="Not built yet"
                >
                  {area.label}
                  <span className="text-fs-xs tracking-flat-kavan lowercase">soon</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule px-6 py-4 md:px-10">
          <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
            Signed in as <span className="text-t-md">administrator</span>
          </p>

          {/*
            A native form posting a Server Action. No `onClick`, no client component, no
            fetch — it works with JavaScript disabled and cannot double-fire, and the cookie
            write happens where cookie writes are legal.
          */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="cursor-pointer border border-rule-md px-4 py-2 text-fs-xs tracking-mid-kavan text-t-md uppercase transition-colors duration-[var(--d-xs)] ease-out-kavan hover:border-rule-hi hover:text-t-hi focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-a-1"
            >
              Sign out
            </button>
          </form>
        </header>

        <main id="main" className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
