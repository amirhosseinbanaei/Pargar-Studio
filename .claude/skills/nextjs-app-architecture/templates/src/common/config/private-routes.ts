// src/common/config/private-routes.ts
/**
 * The declarative list of route prefixes that require a session, plus the matcher both
 * consumers share.
 *
 * What it must never do: import from a feature module, or be duplicated. It is read by
 * the request-interception layer (`proxy.ts`) AND by client code that reacts to auth
 * transitions (redirecting away from a private page on sign-out). Those two live in
 * different layers, so the list must sit in `common` to keep the
 * `app -> modules -> common` dependency direction one-way.
 *
 * The failure it prevents: two copies of "which routes are private" that drift. A route
 * added to the edge gate but not to the client's list stays visible after sign-out until
 * a hard reload; added to the client's list but not the edge, and it is reachable by
 * typing the URL. One array, two readers.
 *
 * Dependencies: none.
 */

/**
 * Prefix match, not exact: listing `/billing` protects `/billing`, `/billing/invoices`
 * and every deeper segment. Order does not matter.
 */
// TODO(project): list your authenticated areas here.
export const PRIVATE_ROUTES = ['/dashboard', '/billing', '/accounts'] as const;

/** Where an unauthenticated visitor to a private route is sent. */
// TODO(project): point at your sign-in route.
export const SIGN_IN_PATH = '/sign-in';

/**
 * Sign-in surfaces an already-authenticated visitor has no business seeing. Kept
 * separate from `PRIVATE_ROUTES` because the gate runs the opposite way: authenticated
 * users are redirected AWAY from these.
 */
// TODO(project): list every entry point into your auth flow.
export const AUTH_ROUTES = ['/sign-in', '/sign-up', '/forgot-password'] as const;

/**
 * True when `pathname` is inside a private area.
 *
 * The `${route}/` suffix check is what stops `/billing-public` from matching `/billing`
 * — a bare `startsWith(route)` gates unrelated sibling routes and produces redirect
 * loops on pages that were never meant to be private.
 */
export function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/** True when `pathname` is an auth surface (exact match — these have no sub-routes). */
export function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}
