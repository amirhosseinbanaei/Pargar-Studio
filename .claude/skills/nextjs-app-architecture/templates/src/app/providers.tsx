// src/app/providers.tsx
/**
 * The single app-wide client provider tree, mounted once by the root layout.
 *
 * What it must never do:
 *  - be a Server Component. It holds context, so it is `'use client'` — but it takes
 *    `children` as a prop, which keeps the children SERVER-rendered. Importing page
 *    content here instead of receiving it as `children` drags the entire tree into the
 *    client bundle, and the RSC benefit disappears with no error to warn you.
 *  - create the QueryClient with `useState`. See `common/lib/query-client`: a provider
 *    that suspends can lose that state and throw away the dehydrated server cache.
 *  - fetch anything. Providers wire context and bootstrap; data belongs to Server
 *    Components and query hooks.
 *
 * The failure it prevents: two React trees each with their own QueryClient (one from a
 * nested provider someone added "just for this route"). Cache writes from one are
 * invisible to the other, so an invalidation after a mutation updates nothing and the
 * stale list survives until a reload. One provider, at the root, always.
 *
 * This file is also the ONE place in `app/` allowed to reach the mock layer — see the
 * matching exemption zone in the ESLint template. Everywhere else, an import of
 * `@/mocks/*` is a lint error.
 *
 * Dependencies: `@tanstack/react-query` v5, and (dev only, optional)
 * `@tanstack/react-query-devtools` — delete the marked block if you do not install it.
 */
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/common/lib/query-client';
import { useSessionBootstrap } from '@/common/stores/session-store';
/* ↓ delete the next two imports together with the mock block below. */
import { isMockEnabled } from '@/common/config/env';
import { MockReadyContext } from '@/common/lib/mock-ready';

/* ── devtools (delete this block if the package is not installed) ─────────────── */
/**
 * Loaded through `next/dynamic` so the devtools live in their own chunk that the
 * production bundle never requests. A static import would ship the panel's code to every
 * user even though the `NODE_ENV` check below hides it — the check controls RENDERING,
 * `dynamic` controls DOWNLOADING, and you want both.
 *
 * PACKAGING CONSTRAINT: `@tanstack/react-query-devtools` must be installed at BUILD time
 * even though the chunk is only ever fetched in development, because the bundler has to
 * resolve this dynamic import while compiling a module that is part of the production
 * render tree. If your build prunes dev dependencies (`npm ci --omit=dev`, a multi-stage
 * container build), either move the package to `dependencies` or delete this block —
 * otherwise the build fails with "Cannot find module", far from anything that looks
 * related.
 */
const QueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then(m => m.ReactQueryDevtools),
  { ssr: false },
);
/* ─────────────────────────────────────────────────────────────────────────────── */

/**
 * Client bootstrap slot: renders nothing, runs the effects that resolve app-wide client
 * state after mount. It must sit ABOVE `children` so every route inherits the same
 * resolved state — mounted inside a route, the state would only exist once that route
 * had been visited, and a user who deep-links anywhere else starts with nothing
 * resolved.
 *
 * Keep each concern in its own tiny `*Sync` component. They are effect-only and render
 * `null`, so their cost is one mount each and their failures stay isolated.
 */
function SessionSync(): null {
  useSessionBootstrap();
  return null;
}

export interface ProvidersProps {
  children: ReactNode;
  /**
   * Additional bootstrap `*Sync` components (theme, feature flags, a selected-workspace
   * store…). Passed as a slot rather than imported here so `app/` does not accumulate
   * imports from every module — the layering rule is `app -> modules -> common`, and a
   * provider that imports five modules inverts it.
   */
  // TODO(project): pass your own `*Sync` components from the root layout.
  bootstrap?: ReactNode;
}

export function Providers({ children, bootstrap }: ProvidersProps) {
  // Stable browser singleton (survives a provider suspend); on the server, a fresh
  // client per request so one user's cache can never be dehydrated into another's HTML.
  const queryClient = getQueryClient();

  /* ── mock front-db (delete this block, the two imports above, the Provider in the
   *    tree below, and `common/lib/mock-ready.ts`, if you have no mock layer) ──────
   *
   * NOTE: this block does not compile until `src/mocks/init.ts` exists — build it from
   * the mocking guide, or delete the block. It is left ACTIVE rather than commented out
   * because the reinvention it prevents (`if (!mockReady) return null`) is the exact
   * anti-pattern the mock-ready module documents, and a commented-out block does not
   * prevent anything.
   *
   * Starts `true` against a real backend, so the context value never changes and the
   * effect returns on its first line. (It is not eliminated at build time — `isMockEnabled`
   * is derived from the parsed env object, not a literal the bundler can fold — but the
   * mock module itself is still never fetched, which is the part that matters.)
   */
  const [mockReady, setMockReady] = useState(!isMockEnabled);

  useEffect(() => {
    if (!isMockEnabled) return;
    // `active` guards the state write: React double-invokes effects in development, and
    // a fast unmount (a redirect on first paint) would otherwise set state on a gone tree.
    let active = true;
    // `await import()` — NEVER a static import. A module whose side effect is starting a
    // worker cannot be tree-shaken, so a static import ships the entire seed dataset to
    // every production visitor even with the flag off.
    void import('@/mocks/init')
      .then(({ startMocking }) => startMocking())
      // `.finally`, not `.then`: if the worker fails to register, the flag must STILL
      // flip. Otherwise every gated query stays permanently disabled and mock mode
      // deadlocks with no error on screen to explain it.
      .finally(() => {
        if (active) setMockReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  /* ─────────────────────────────────────────────────────────────────────────────── */

  return (
    <QueryClientProvider client={queryClient}>
      {/* Wraps, never gates: `children` renders immediately in both modes. */}
      <MockReadyContext.Provider value={mockReady}>
        <SessionSync />
        {bootstrap}
        {children}
        {/* Rendered only in development; the chunk is never fetched in production. */}
        {process.env.NODE_ENV === 'development' && <QueryDevtools initialIsOpen={false} />}
      </MockReadyContext.Provider>
    </QueryClientProvider>
  );
}
