// src/common/observability/dev-log.ts
/**
 * Development-only structured logging, plus the two React Query cache hooks that make
 * client-cache failures visible.
 *
 * What it must never do: print in production. Every helper is a no-op there, so backend
 * response bodies, request paths and internal codes can never reach a production console
 * (a browser console is user-visible; a server console ends up in shipped log storage).
 * It must also never be the app's error *reporting* channel — see §"production" below.
 *
 * The failure it prevents: two, symmetrical. In development, a failed query is a silent
 * `isError` flag with no stack and a failed mutation is a toast with no context, so
 * debugging degrades to guessing. In production, an ad-hoc `console.error(err)` left
 * behind leaks the backend's raw error body to anyone with devtools open.
 *
 * Runtime-agnostic: safe to import from server and client code alike.
 */
import { mapError } from '@/common/errors';

/**
 * The single gate for the whole module.
 *
 * `process.env.NODE_ENV` is statically replaced at build time, so with one constant the
 * bodies below become dead code the minifier drops and the module tree-shakes to
 * nothing. Reading the flag from a runtime config object, a store, or a dynamic key
 * defeats that elimination and ships the logging.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Generic namespaced dev log.
 *
 * `scope` is a namespace convention, not decoration — `api`, `query`, `mutation`,
 * `global`, `proxy:refresh`, `route:<segment>`. It is what makes the console greppable
 * when three subsystems fail during the same page load.
 */
export function devLog(scope: string, ...args: unknown[]): void {
  if (isDev) console.log(`[${scope}]`, ...args);
}

/**
 * Log a failure as a uniform one-line summary (status / code / message from the central
 * mapper) plus the raw error and any extra context for drill-down. Use it at every catch
 * site whose failure you want visible while developing.
 *
 * It deliberately reuses `mapError`, so the developer's console line and the user's
 * toast agree on status, code and message. A discrepancy between the two is itself a bug
 * signal — it means something re-derived the message instead of using the mapper.
 */
export function devError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  if (!isDev) return;
  const { status, code, message } = mapError(error);
  console.error(`[${scope}] ${status} ${code ?? ''} — ${message}`, { error, ...extra });
}

/* -------------------------------------------------------------------------- */
/* React Query cache hooks                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Wired into `makeQueryClient` via `QueryCache.onError`. Kept as a plain
 * `(error, key)` helper so the call site can forward the cache's own inferred callback
 * params instead of hand-writing the library's generic signatures — those differ between
 * the query cache `(error, query)` and the mutation cache
 * `(error, variables, context, mutation)` and have changed across majors.
 */
export function logQueryError(error: unknown, queryKey: unknown): void {
  devError('query', error, { queryKey });
}

/** Wired into `makeQueryClient` via `MutationCache.onError`. */
export function logMutationError(error: unknown, mutationKey: unknown): void {
  devError('mutation', error, { mutationKey });
}

/*
 * Production reporting is a DIFFERENT concern and does not belong in this file.
 * Report from three places, none of which print to the user:
 *   1. the `useEffect` in each error boundary (send `error` + `digest`),
 *   2. the server request hook (`onRequestError` in `instrumentation.ts`, Next 15+),
 *   3. the cache `onError` hooks above.
 * Always keep `digest` in the payload — it is the only handle that correlates a scrubbed
 * client-side error with the real server stack.
 */
// TODO(project): call your error tracker from those three places; leave this module dev-only.
