// src/common/config/private-routes.ts
/**
 * The declarative list of route prefixes that require a session, and the two predicates
 * that read it. Adapted from
 * `.claude/skills/nextjs-app-architecture/templates/src/common/config/private-routes.ts`.
 *
 * ONE ARRAY, THREE READERS: `src/proxy.ts` (the coarse gate), `src/app/robots.ts` (which
 * must disallow exactly what the gate protects), and any client code that needs to leave a
 * route it may no longer view. Those live in different layers, so the list sits in
 * `common/` to keep the `app -> modules -> common` direction one-way.
 *
 * The failure it prevents is two copies of "which routes are private" that drift, and the
 * two halves fail asymmetrically: a route in the edge list but not in `robots.ts` is a
 * private route that gets crawled, and one in `robots.ts` but not the edge list is
 * reachable by typing the URL.
 *
 * WHAT THIS FILE IS NOT: an authorization decision. It answers "does this URL need a
 * session", never "may this caller do this". Every Server Action re-authorizes from the
 * session itself — see `src/common/services/session.ts`.
 *
 * Dependencies: none, deliberately. `proxy.ts` imports it, so anything pulled in here runs
 * on every matched request.
 */

/**
 * Prefix match, not exact: listing `/dashboard` protects `/dashboard`,
 * `/dashboard/projects` and every deeper segment.
 *
 * One entry, and that is the whole authenticated surface of this app. The public site is
 * `/[locale]/...` and is entirely anonymous.
 */
export const PRIVATE_ROUTES = ['/dashboard'] as const;

/**
 * Where an unauthenticated visitor to a private route is sent.
 *
 * INSIDE `/dashboard`, not at a bare `/login`, for two reasons. It keeps the entire admin
 * surface under one prefix that `robots.ts` disallows with one rule, and it keeps the
 * bare `/login` URL free of a locale prefix problem — every public route in this app lives
 * under `/[locale]/`, and a top-level `/login` would be redirected to `/en/login` by the
 * locale leg of the proxy.
 *
 * Because it is under the private prefix, `isPrivateRoute(SIGN_IN_PATH)` is TRUE. The
 * proxy must therefore test `isAuthRoute` FIRST, or an anonymous visitor to the login page
 * is redirected to the login page forever. That ordering is asserted by a test.
 */
export const SIGN_IN_PATH = '/dashboard/login';

/** Where an already-authenticated visitor is sent away from an auth surface. */
export const DASHBOARD_HOME = '/dashboard';

/**
 * Auth surfaces. Kept separate from `PRIVATE_ROUTES` because they are the one thing inside
 * the private prefix that an anonymous visitor MUST be able to reach.
 *
 * The mirror-image gate — "already signed in, bounce off the login page" — deliberately
 * does NOT live in the proxy, which can only see whether a cookie is present. An expired
 * cookie would be bounced to `/dashboard`, whose shell reads the session properly, finds it
 * dead, and sends the visitor back here: a redirect loop that first appears a week after
 * someone signs in. That bounce belongs on the login page, which calls `readSession()` and
 * can tell a valid session from a dead one. See `src/proxy.ts`.
 *
 * One entry: there is one administrator and one password, so there is no registration route
 * and no password-reset route to list. See AGENTS.md.
 */
export const AUTH_ROUTES = [SIGN_IN_PATH] as const;

/**
 * True when `pathname` is inside a private area.
 *
 * The `${route}/` suffix check is what stops a hypothetical `/dashboard-preview` from
 * matching `/dashboard` — a bare `startsWith(route)` gates unrelated sibling routes and
 * produces redirect loops on pages that were never meant to be private.
 */
export function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/** True when `pathname` is an auth surface (exact match — these have no sub-routes). */
export function isAuthRoute(pathname: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(pathname);
}

/**
 * Validate the `?next=` return path the gate appends before navigating to it.
 *
 * Reject absolute URLs and protocol-relative paths, or the login form becomes an open
 * redirect: `?next=https://evil.example` or `?next=//evil.example` would otherwise send a
 * freshly-authenticated administrator straight off-site.
 *
 * It also refuses anything outside the dashboard. The parameter only ever gets written by
 * the gate, which only ever fires on a private route, so a value pointing anywhere else
 * was supplied by hand — and "signed in, then bounced to a page chosen by whoever sent me
 * the link" is not a flow this app has.
 */
export function safeReturnPath(next: string | undefined, fallback = DASHBOARD_HOME): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (!isPrivateRoute(next) || isAuthRoute(next)) return fallback;
  return next;
}
