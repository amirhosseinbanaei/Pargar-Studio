// src/common/stores/session-store.ts
/**
 * The global session store — the single CLIENT source of truth for "is someone signed
 * in, and as what role".
 *
 * What it must never do:
 *  - hold a token. Access/refresh tokens live in httpOnly cookies written by the server;
 *    if a token is ever put in this store it is in `localStorage`, readable by any
 *    injected script, and the httpOnly protection was pointless.
 *  - hold server data. This is UI identity only. Anything fetched belongs in the query
 *    cache or in a Server Component — a store copy of server data is a second cache
 *    with no invalidation story.
 *  - claim authority. The cookie is authoritative; this store can only mirror it and
 *    must be able to DOWNGRADE itself (see `reconcile`).
 *
 * The failure it prevents: a hydration mismatch on every page load. Synchronous
 * `localStorage` rehydration runs during `create()` — before React hydrates — so the
 * first client render shows the signed-in header while the server rendered the
 * signed-out one. React then either warns and patches, or (worse) keeps the server
 * markup and the header is wrong until the next interaction. `skipHydration` + an
 * effect-time `rehydrate()` makes both renders agree, then updates.
 *
 * It lives in `common`, not a feature module, so any shared surface (header, guards,
 * role-gated UI) can read auth without importing a module — and so the state exists even
 * on routes whose module code was never loaded.
 *
 * Dependencies: `zustand` v5, `react`.
 */
'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Public identity the UI renders. Never tokens. */
// TODO(project): match this to the fields your identity endpoint actually returns.
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

// TODO(project): replace with your role set; keep it a union, never `string`.
export type UserRole = 'viewer' | 'editor' | 'admin';

interface SessionState {
  /** True only while we hold a persisted identity; the cookie stays authoritative. */
  isAuthenticated: boolean;
  user: SessionUser | null;
  /** `null` while signed out. */
  role: UserRole | null;
  /** Flips true once rehydration has run. Gate SSR-sensitive UI on this. */
  hydrated: boolean;
}

interface SessionActions {
  /** Record a successful sign-in. Called by the flow that authenticated the user. */
  setSession: (user: SessionUser, role: UserRole) => void;
  /** Clear client state only — no server call. Used by `reconcile`. */
  clearLocalSession: () => void;
  /** Full sign-out: drop the server cookie, then the client state. */
  signOut: () => Promise<boolean>;
  /** Downgrade to signed-out if the server session is gone. NEVER upgrades. */
  reconcile: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

export type SessionStore = SessionState & SessionActions;

const SIGNED_OUT: SessionState = {
  isAuthenticated: false,
  user: null,
  role: null,
  hydrated: false,
};

/* -------------------------------------------------------------------------- */
/* Server bridge                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The store cannot import Server Actions directly without coupling `common` to a
 * feature module's auth flow, so the two server calls it needs are injected once at
 * app start.
 *
 * The defaults are deliberately the SAFE side of each failure: `isSignedIn` reports
 * `true`, so an unconfigured app never spuriously signs a user out; `signOut` resolves
 * without doing anything, so the UI still clears locally.
 */
export interface SessionBridge {
  /** Server Action that clears the session cookies. */
  signOut: () => Promise<void>;
  /** Server Action returning whether the httpOnly session cookie still exists. Boolean
   *  only — an action must never return the token itself. */
  isSignedIn: () => Promise<boolean>;
}

let bridge: SessionBridge = {
  signOut: async () => {},
  isSignedIn: async () => true,
};

/**
 * Wire the store to the app's Server Actions. Call once, at module scope, from a client
 * file that the root providers import.
 *
 * The actions MUST live in `common/actions/`, not in a feature module: this file sits in
 * `common/`, and `common/` may never import from `modules/`. Wiring the bridge to
 * `@/modules/<name>/...` inverts the dependency direction and the boundary lint rejects it.
 *
 * ```ts
 * // src/common/stores/session-bridge.ts
 * 'use client';
 * import { signOutAction, isAuthenticatedAction } from '@/common/actions/session';
 * import { configureSessionBridge } from './session-store';
 * configureSessionBridge({ signOut: signOutAction, isSignedIn: isAuthenticatedAction });
 * ```
 */
// TODO(project): call this once with your real session actions.
export function configureSessionBridge(next: SessionBridge): void {
  bridge = next;
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...SIGNED_OUT,

      setSession: (user, role) => {
        set({ isAuthenticated: true, user, role });
      },

      clearLocalSession: () => {
        set({ isAuthenticated: false, user: null, role: null });
      },

      signOut: async () => {
        // Clear client state FIRST so the UI reacts immediately, then drop the server
        // cookie. If the network call fails the user is still treated as signed out —
        // the alternative leaves someone staring at a signed-in header they just asked
        // to leave.
        set({ isAuthenticated: false, user: null, role: null });
        try {
          await bridge.signOut();
          return true;
        } catch {
          return false;
        }
      },

      reconcile: async () => {
        // Downgrade-only. The cookie is the source of truth for "still signed in", and
        // this covers sign-out in another tab, an expired refresh token cleared at the
        // edge, and hand-cleared cookies. It never UPGRADES: reconstructing an identity
        // from a cookie the client cannot read is impossible, so a signed-out store
        // stays signed out until a real sign-in populates it.
        if (!get().isAuthenticated) return;
        const stillSignedIn = await bridge.isSignedIn();
        if (!stillSignedIn) {
          set({ isAuthenticated: false, user: null, role: null });
        }
      },

      setHydrated: hydrated => {
        set({ hydrated });
      },
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => localStorage),
      // Persist identity only. Action closures are recreated on every load, and
      // `hydrated` must start false or the very first render would believe rehydration
      // already happened.
      partialize: state => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        role: state.role,
      }),
      // See the file header: defer reading storage until after mount so the first client
      // render matches the server HTML. `useSessionBootstrap` drives `rehydrate()`.
      skipHydration: true,
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Owns the client session lifecycle after mount:
 *  1. rehydrate the persisted store (deferred by `skipHydration`),
 *  2. reconcile against the real httpOnly cookie.
 *
 * Mount it ONCE, above `children` in the root providers, via a component that renders
 * nothing. Calling it in several places is harmless but pointless; calling it in none
 * means the store never leaves its signed-out default and every user looks logged out.
 */
export function useSessionBootstrap(): void {
  const reconcile = useSessionStore(s => s.reconcile);

  useEffect(() => {
    // `rehydrate()` may be sync (localStorage) or async (an IndexedDB adapter); wrapping
    // in `Promise.resolve` makes reconcile run after it either way.
    void Promise.resolve(useSessionStore.persist.rehydrate()).then(() => reconcile());
  }, [reconcile]);
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Always subscribe through a narrow selector. `useSessionStore()` with no selector
 * subscribes to the WHOLE store, so a role change re-renders every component that only
 * wanted the user's name — the classic "the whole app re-renders on login" report.
 *
 * Each selector must return a stable reference: derive booleans (as below) or use
 * `useShallow` for object/array results, or the new object identity re-renders on every
 * store write.
 */
export const useIsAuthenticated = (): boolean => useSessionStore(s => s.isAuthenticated);
export const useSessionUser = (): SessionUser | null => useSessionStore(s => s.user);
export const useSessionRole = (): UserRole | null => useSessionStore(s => s.role);
export const useSessionHydrated = (): boolean => useSessionStore(s => s.hydrated);
export const useIsAdmin = (): boolean => useSessionStore(s => s.role === 'admin');

/**
 * Non-reactive read for event handlers and non-React code. Using this inside render
 * would silently opt out of updates — that is what the hooks above are for.
 */
export function getSessionSnapshot(): SessionState {
  const { isAuthenticated, user, role, hydrated } = useSessionStore.getState();
  return { isAuthenticated, user, role, hydrated };
}
