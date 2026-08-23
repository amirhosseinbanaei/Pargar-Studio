// src/common/lib/mock-ready.ts
/**
 * The "is the request-mock worker intercepting yet?" signal.
 *
 * DELETE THIS FILE (and the marked block in `app/providers.tsx`) if the project has no
 * request-mock front-db. Nothing else depends on it.
 *
 * What it must never do: gate the RENDER. The obvious implementation of "wait for the
 * worker" — `if (!ready) return null` around the provider's children — throws away every
 * server-rendered byte, so mock mode stops exercising the thing you built (streaming,
 * SSR HTML, instant shells) and every screen flashes blank before it paints. That gate is
 * banned; this context exists so nobody has to reinvent it.
 *
 * The failure it prevents: a client query that fires before the service worker has
 * registered goes to the REAL network. Against a mock-only setup that is a hard failure
 * on first paint which disappears on the next render — the classic "only fails on a hard
 * refresh, works when I retry" bug. A query with no server-provided data passes
 * `enabled: useMockReady()` and simply waits.
 *
 * The default is `true` — "nothing to wait for" — so every tree that is NOT under the
 * provider (a test, a story, a component rendered in isolation) behaves as if mocking is
 * off rather than deadlocking on a flag nobody will ever flip.
 *
 * Dependencies: `react`.
 */
'use client';

import { createContext, useContext } from 'react';

/** Provided by `app/providers.tsx`. Against a real backend it is permanently `true`. */
export const MockReadyContext = createContext(true);

/**
 * ```ts
 * // a client query with NO server-provided initial data
 * const mockReady = useMockReady();
 * const { data } = useQuery({ ...invoiceQuery(id), enabled: mockReady });
 * ```
 *
 * Queries that hydrate from a server prefetch need no gate: their data is already there,
 * and the revalidation that follows happens long after the worker has booted.
 */
export function useMockReady(): boolean {
  return useContext(MockReadyContext);
}
