// src/common/lib/query-client.ts
/**
 * The QueryClient factory and accessor.
 *
 * What it must never do: hand the same client to two server requests. A module-level
 * singleton on the server means one user's cached, prefetched data is dehydrated into
 * another user's HTML — a cross-user data leak that no test catches because a dev server
 * usually serves one user at a time.
 *
 * The failure it prevents (browser side): a client that is recreated on every render, or
 * created with `useState` in a provider that suspends. React may throw away a suspended
 * component's state before committing it, so the `useState` initializer runs again and
 * the freshly-populated cache — including everything the server just dehydrated into it
 * — is discarded, producing a full refetch waterfall on first paint. A module-scoped
 * browser singleton survives that.
 *
 * Dependencies: `@tanstack/react-query` v5.
 */
import {
  QueryClient,
  QueryCache,
  MutationCache,
  defaultShouldDehydrateQuery,
  isServer,
} from '@tanstack/react-query';
import { logQueryError, logMutationError } from '@/common/observability/dev-log';

/**
 * Read a numeric `status` off an unknown error WITHOUT `instanceof`.
 *
 * Errors reach this policy after crossing at least one boundary: a Server Action result
 * rebuilt on the client, a dehydrated cache entry, a re-thrown wrapper. `instanceof`
 * fails across those boundaries (different realm, different class identity after
 * serialization), silently turning "never retry a 4xx" into "retry everything". A
 * structural read cannot fail that way.
 */
function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** Retries below this count; see `retry` for which statuses are eligible at all. */
const MAX_RETRIES = 1;

/**
 * 4xx means the server understood the request and refused it. Retrying it wastes a
 * round trip, delays the error the user is waiting for, and — on a mutation — risks a
 * duplicate write if the refusal was a timeout misreported as a 4xx. The two exceptions
 * are the statuses that explicitly mean "try again": 408 (request timeout) and 429
 * (rate limited).
 */
// This app's only "backend" is its own Server Actions, which answer with the
// normalized error shape and never 429. The set is kept as-is rather than
// emptied: an empty set reads as "retries are off" when the rule is actually
// "4xx is final, except the two statuses that literally mean try again".
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429]);

/**
 * Build a QueryClient with the app's tuned defaults.
 *
 * NOT a singleton — see `getQueryClient` for the per-environment lifetime rule.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    // Dev-only visibility: without these, a failed query is a silent `isError` with no
    // console trace and a failed mutation surfaces only as whatever toast the component
    // happens to render. Both helpers are no-ops in production.
    queryCache: new QueryCache({
      onError: (error, query) => logQueryError(error, query.queryKey),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        logMutationError(error, mutation.options.mutationKey),
    }),
    defaultOptions: {
      queries: {
        /**
         * MUST be > 0 for SSR/hydration to be worth anything. With the library default
         * of 0, every hydrated query is stale the instant it lands on the client and
         * refetches immediately — the prefetch you paid for on the server is thrown
         * away and the user sees a spinner over data that was already on screen.
         */
        // 60s suits this app's client-side lane. Public content is NOT here —
        // it comes from Server Components behind `'use cache'` with an explicit
        // tag, so it has no staleTime at all. What this governs is the
        // dashboard's own mutation flows in prompts 6 and 7.
        staleTime: 60_000,
        /**
         * How long an unused cache entry survives before eviction. Longer than
         * `staleTime` on purpose: a back-navigation should paint instantly from cache
         * and revalidate behind the scenes, not remount into a spinner.
         */
        gcTime: 5 * 60_000,
        retry: (failureCount: number, error: unknown) => {
          const status = statusOf(error);
          if (status !== undefined && status >= 400 && status < 500) {
            return RETRYABLE_CLIENT_STATUSES.has(status) && failureCount < MAX_RETRIES;
          }
          return failureCount < MAX_RETRIES;
        },
        /**
         * Refetch-on-focus turns every tab switch into a request storm and makes forms
         * flicker mid-edit. Opt in per query where freshness genuinely matters.
         */
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Never retry a write by default: without idempotency keys a retried mutation
        // can create the same record twice.
        retry: false,
      },
      dehydrate: {
        /**
         * Also dehydrate *pending* queries. That is what makes the non-awaited
         * (streaming) prefetch work: the server starts the query, ships the promise
         * placeholder with the HTML, and the client adopts it instead of starting a
         * second identical request.
         */
        shouldDehydrateQuery: query =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        /**
         * Errors crossing the boundary are already normalized to a safe shape by the
         * error system, so redaction would only replace a useful message with an opaque
         * placeholder the UI cannot act on.
         */
        // Safe to leave off HERE: every error that can reach dehydration has
        // already been through `mapError`, so it carries a user-facing message
        // and no backend internals. Flip to `true` the day a raw error can get
        // this far.
        shouldRedactErrors: () => false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The accessor every caller should use — the provider AND every Server Component
 * prefetch.
 *
 * Server: a fresh client per request (see the cross-user leak in the file header).
 * Browser: one stable client for the lifetime of the tab.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
