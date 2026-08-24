// src/app/providers.tsx
/**
 * The single app-wide client provider tree, mounted once by the root layout.
 *
 * What it must never do:
 *  - be a Server Component. It holds context, so it is `'use client'` — but it
 *    takes `children` as a PROP, which keeps the children server-rendered.
 *    Importing page content here instead of receiving it as `children` drags
 *    the entire tree into the client bundle, and the RSC benefit disappears
 *    with no error to warn you. That matters more in this app than in most:
 *    the drawings are server-rendered SVG, and pulling the tree client-side
 *    would put ~52KB of generators back in the browser.
 *  - create the QueryClient with `useState`. See `common/lib/query-client`: a
 *    provider that suspends can lose that state and throw away the dehydrated
 *    server cache.
 *  - fetch anything. Providers wire context; data belongs to Server Components
 *    and query hooks.
 *
 * The failure it prevents: two React trees each with their own QueryClient.
 * Cache writes from one are invisible to the other, so an invalidation after a
 * mutation updates nothing and the stale list survives until a reload. One
 * provider, at the root, always.
 *
 * WHAT REACT QUERY IS AND IS NOT FOR HERE. Server data never enters a client
 * store or a second cache: two copies of one record drift the moment either
 * refetches, and the UI shows whichever re-rendered last. Every public page and
 * every dashboard list reads through a Server Component, and every write goes
 * through a Server Action that purges its cache tag. React Query exists for the
 * CLIENT-SIDE MUTATION FLOWS prompts 6 and 7 add — optimistic updates, pending
 * state, retry — and not as a second source of truth for anything the server
 * already rendered.
 *
 * The template's mock-front-db block and `SessionSync` are deliberately absent:
 * this app has no MSW layer (AGENTS.md records why) and no session store until
 * prompt 6. The `bootstrap` slot below is where that one goes.
 */
'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/common/lib/query-client';

/**
 * Loaded through `next/dynamic` so the devtools live in their own chunk that
 * the production bundle never requests. A static import would ship the panel's
 * code to every visitor even though the `NODE_ENV` check below hides it — the
 * check controls RENDERING, `dynamic` controls DOWNLOADING, and you want both.
 *
 * PACKAGING CONSTRAINT: `@tanstack/react-query-devtools` must be installed at
 * BUILD time even though the chunk is only ever fetched in development, because
 * the bundler has to resolve this dynamic import while compiling a module that
 * is part of the production render tree. That is why it sits in `dependencies`
 * and not `devDependencies`: under `npm ci --omit=dev` — the normal production
 * install, and what a multi-stage container build does — a devDependency here
 * fails the build with "Cannot find module", far from anything that looks
 * related to it.
 */
const QueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then(m => m.ReactQueryDevtools),
  { ssr: false },
);

export interface ProvidersProps {
  children: ReactNode;
  /**
   * Additional bootstrap `*Sync` components (locale, session, feature flags).
   * Passed as a slot rather than imported here so `app/` does not accumulate
   * imports from every module — the layering rule is `app -> modules ->
   * common`, and a provider that imports five modules inverts it.
   *
   * It sits ABOVE `children` so every route inherits the same resolved state;
   * mounted inside a route, that state would only exist once the route had been
   * visited, and a deep link anywhere else would start with nothing resolved.
   */
  bootstrap?: ReactNode;
}

export function Providers({ children, bootstrap }: ProvidersProps) {
  // Stable browser singleton (survives a provider suspend); on the server, a
  // fresh client per request so one user's cache can never be dehydrated into
  // another's HTML.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {bootstrap}
      {children}
      {/* Rendered only in development; the chunk is never fetched in production. */}
      {process.env.NODE_ENV === 'development' && <QueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
