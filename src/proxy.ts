// src/proxy.ts
/**
 * The request-interception layer. Two legs, in this order: the dashboard's coarse auth
 * gate, then locale routing.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the body and the matcher are the same.
 * This project is on 16.3, so the file is `proxy.ts`.
 *
 * ─── THE BUG THIS FILE EXISTS TO DOCUMENT ───────────────────────────────────────────
 * Forwarding data to the render MUST go through `NextResponse.next({ request: { headers } })`.
 * `NextResponse.next({ headers })` sets RESPONSE headers. Doing that on a Server Action
 * POST overwrites the action response's `text/x-component` content-type with the request's
 * `text/plain`, and EVERY Server Action in the app then fails client-side with "An
 * unexpected response was received from the server" — no server error, no stack, and no
 * clue pointing back here. Pages still render, so it reads as a forms bug rather than a
 * proxy bug, and the two spellings differ by one nested key.
 * ────────────────────────────────────────────────────────────────────────────────────
 *
 * ORDER IS LOAD-BEARING. The dashboard leg runs FIRST because `/dashboard` must never be
 * locale-prefixed: it is an admin tool with one interface language, deliberately outside
 * the `[locale]` segment (see AGENTS.md), and the locale leg below would happily redirect
 * it to `/en/dashboard`, a route that does not exist.
 */
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/common/i18n/routing';
import { SESSION_COOKIE } from '@/common/config/session-cookie';
import { isAuthRoute, isPrivateRoute, SIGN_IN_PATH } from '@/common/config/private-routes';

/**
 * LEG 2, built once at module scope rather than per request: `createMiddleware` compiles
 * the routing config, and doing that on every request would pay for it on every
 * navigation, RSC payload and `<Link>` prefetch.
 *
 * It is COMPOSED INSIDE `proxy` below, never exported as the file's own default. next-intl
 * ships a middleware that is meant to BE the whole file, and taking that shape here would
 * lose leg 1 entirely — and its matcher would then see `/dashboard`, which is exactly the
 * request that must never be locale-prefixed.
 */
const routeLocale = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The dashboard, including its login page — `isPrivateRoute` matches the whole prefix.
  if (isPrivateRoute(pathname)) return gateDashboard(request, pathname);

  return routeLocale(request);
}

/* ══════════════════════════════════════════════════════════════════════════════════ *
 *  LEG 1 — the dashboard gate                                                         *
 * ══════════════════════════════════════════════════════════════════════════════════ */

/**
 * A COARSE UX GATE. It is never the authorization decision.
 *
 * What it answers is "does this request carry a session cookie at all" — not "is that
 * cookie valid", and emphatically not "may this caller perform this write". Two reasons
 * that division is not negotiable:
 *
 *  1. **A Server Action is a public HTTP endpoint.** It has a stable id baked into the
 *     client bundle and can be POSTed to directly with `curl`, without ever passing
 *     through this function. So every write action re-authorizes by calling `readSession()`
 *     itself. If this gate were the authorization, the app would have an authorization
 *     bypass reachable by anyone who read the bundle.
 *  2. **A gate you can see is a gate you can forge.** Cookie PRESENCE is trivially
 *     satisfied by setting any value at all. Verifying the signature here as well would
 *     put the rule in two places that drift, and buy nothing the real check does not
 *     already provide.
 *
 * What it does buy: an anonymous visitor gets the login page instead of a dashboard shell
 * that renders, queries the session, and redirects — one round trip instead of two, and no
 * flash of chrome they were never allowed to see.
 *
 * WHY THE LOGIN PAGE IS NOT REDIRECTED AWAY FROM HERE. The mirror-image gate — "already
 * authenticated, bounce off the login page" — is deliberately NOT implemented in this
 * function, and that is a bug fix rather than an omission. This gate can only see presence,
 * so a cookie that is present but EXPIRED would be bounced from the login page to
 * `/dashboard`; the shell there reads the session properly, finds it expired, and sends the
 * visitor back to the login page — an infinite redirect loop that only appears seven days
 * after someone signs in. The bounce therefore lives on the login page itself
 * (`app/(dashboard)/dashboard/login/page.tsx`), which calls `readSession()` and so can tell
 * a valid session from a dead one.
 */
function gateDashboard(request: NextRequest, pathname: string) {
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSessionCookie && !isAuthRoute(pathname)) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    /**
     * Carry the origin so the login form can return the visitor where they were going.
     * A PATH, never a full URL from the request: `safeReturnPath` in
     * `common/config/private-routes.ts` re-validates it before anything navigates to it,
     * because an unchecked `?next=` is an open redirect.
     */
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  /**
   * REQUEST headers — see the file header for what the other spelling costs.
   *
   * A Server Component has no request object, and a layout cannot read the URL of the
   * child segment rendering inside it. A request header is the supported channel, and it
   * is what lets the dashboard navigation mark the current area on the server, with no
   * client component and no JavaScript.
   */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-current-path', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/* ══════════════════════════════════════════════════════════════════════════════════ *
 *  LEG 2 — locale routing (next-intl since prompt 8)                                  *
 * ══════════════════════════════════════════════════════════════════════════════════ */

/**
 * WHY THE REDIRECT LIVES HERE. Every public route in this app is under `/[locale]/`, so
 * `app/[locale]/layout.tsx` is the one root layout for the site — the only place `lang`,
 * `dir` and the `is-fa` class can be set before the first byte, which is the whole reason
 * the legacy site ran an inline script in `<head>` (`legacy/index.html:29`). That leaves
 * nothing at `/` to render a redirect from, and rendering one would need a second root
 * layout anyway. A rewrite before route resolution is exactly what this hook is for.
 *
 * (The dashboard DOES have its own root layout, at `app/(dashboard)/layout.tsx`. That is
 * not a contradiction — it is a second, deliberately monolingual document tree, which is
 * why it is gated above and never reaches `routeLocale`.)
 *
 * WHAT PROMPT 8 REPLACED, and what it kept:
 *
 *  - The hand-rolled `Accept-Language` parser is gone. next-intl negotiates through
 *    `Negotiator` + `@formatjs/intl-localematcher` against `routing.locales`, which is the
 *    same list `[locale]` validates and the sitemap enumerates. `legacy/js/core/i18n.js:97`
 *    chose the starting language from `navigator.language`; `Accept-Language` is the
 *    server-side form of the same signal, and that intent is unchanged.
 *  - The redirect is still a 307. `NextResponse.redirect` defaults to 307 and next-intl
 *    passes no status, so the mapping stays non-permanent: it depends on a request header,
 *    and a 308 would pin a reader to whichever language they resolved to on their very
 *    first visit, in their browser's redirect cache where they cannot see it.
 *  - No stored preference, still. `localeCookie: false` in `@/common/i18n/routing` turns
 *    off next-intl's `NEXT_LOCALE` cookie, which would otherwise outrank `Accept-Language`
 *    and reintroduce exactly the `kavan.lang` memory prompt 4 deliberately dropped.
 */

export const config = {
  /**
   * Everything except the paths a redirect would corrupt or make more expensive:
   *
   *  - `api` — a 307 is a valid answer to a document request and a corrupt one to a data
   *    request; a `fetch` follows it and parses HTML as JSON. A route handler reads the
   *    session itself and answers with a status code instead.
   *  - `_next/static`, `_next/image` — running this on every byte the page loads adds
   *    latency to all of them for a decision that can never apply.
   *  - anything with a file extension — `favicon.ico`, `icon.svg`, `robots.txt`,
   *    `sitemap.xml`. A locale prefix on an asset URL is a 404.
   */
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[^/]+$).*)'],
};
