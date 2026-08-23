// src/proxy.ts
/**
 * The request-interception layer: a COARSE auth gate, leg-1 pre-emptive token rotation,
 * and request-header injection.
 *
 * Next.js 16 names this file `proxy.ts` and expects a default-exported `proxy(request)`.
 * On 15.x the file is `src/middleware.ts` exporting `middleware(request)` — same body,
 * same `config`; it needs the Node.js runtime (this code decodes a JWT payload and calls
 * the transport module), which is the default for `proxy.ts` on 16 but must be requested
 * on 15.x (`export const runtime = 'nodejs'`, where supported) or the file must be
 * rewritten to Web-API-only code with `atob` instead of `Buffer`.
 *
 * ── THE BUG THIS FILE EXISTS TO DOCUMENT ────────────────────────────────────────────
 * Forwarding data to the render MUST go through `NextResponse.next({ request: { headers } })`.
 * `NextResponse.next({ headers })` sets RESPONSE headers. Doing that on a Server Action
 * POST overwrites the action response's `text/x-component` content-type with the
 * request's `text/plain`, and EVERY Server Action in the app then fails client-side with
 * "An unexpected response was received from the server" — with no server error, no stack,
 * and no clue pointing back here. The two spellings differ by one nested key.
 * ────────────────────────────────────────────────────────────────────────────────────
 *
 * What this file must never do:
 *  - be treated as authorization. It is a UX gate that avoids rendering a private page
 *    for an obviously signed-out visitor. The backend stays authoritative on every call;
 *    a forged cookie gets past this and is rejected there.
 *  - fetch data, read a database, or run per-user logic. It runs on EVERY matched
 *    request — navigation, RSC payload, and every `<Link>` prefetch.
 *  - clear cookies because a call failed. Only an explicit backend rejection may.
 *
 * The failure it prevents: without leg-1 rotation here, the only place left to refresh a
 * token is mid-render, where cookie writes are illegal — so the refreshed pair cannot be
 * persisted and EVERY subsequent request rotates again. Against single-use refresh
 * tokens that burns the token and signs the user out minutes after they signed in.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  rotateSession,
  isSecureRequest,
  accessCookieMaxAge,
  refreshCookieMaxAge,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE_BASE,
  type TokenPair,
} from './common/services/session';
import { isTokenExpired } from './common/services/jwt';
import { devLog } from './common/observability/dev-log';
import { isPrivateRoute, isAuthRoute, SIGN_IN_PATH } from './common/config/private-routes';

/**
 * Rotate this long BEFORE the access token's `exp`.
 *
 * Without a skew window a token that is valid at the gate can expire during the render
 * that follows, producing an intermittent 401 that only reproduces under load. The
 * window also absorbs clock drift between this process and the auth server — the two are
 * rarely synchronized to the second.
 */
// TODO(project): widen if your infrastructure has looser clock synchronization.
const REFRESH_SKEW_MS = 30_000;

/** Where an authenticated visitor is sent away from an auth surface. */
// TODO(project): point at your post-sign-in landing route.
const HOME_PATH = '/';

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  const accessCookie = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshCookie = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  let rotated: TokenPair | null = null;
  /**
   * Only a backend that REJECTED the refresh token clears the session. A backend that
   * could not be reached leaves the cookies untouched and the user signed in — the next
   * request retries. Conflating "token dead" with "backend down" turns any transient
   * blip into a mass logout of everyone browsing at that moment.
   */
  let sessionRejected = false;

  /* ── Leg 1: pre-emptive rotation ───────────────────────────────────────────── */
  if (refreshCookie && isTokenExpired(accessCookie, REFRESH_SKEW_MS)) {
    const outcome = await rotateSession(refreshCookie);
    if (outcome.status === 'rotated') {
      rotated = outcome.pair;
      // Mutate the REQUEST cookie jar so the serialized header forwarded below carries
      // the fresh pair into THIS request's render. Without this the render still sees
      // the expired token and every server-side call 401s, even though the browser will
      // receive the new pair.
      request.cookies.set(ACCESS_COOKIE, rotated.access);
      request.cookies.set(REFRESH_COOKIE, rotated.refresh);
    } else {
      sessionRejected = outcome.status === 'rejected';
      devLog('proxy:refresh', `rotation ${outcome.status}`, { path: pathname });
    }
  }

  /* ── The coarse gate ───────────────────────────────────────────────────────── */
  // "Has any credential at all" — not "is valid". Validity is the backend's answer, and
  // asking it here would add a network round trip to every prefetch.
  const isAuthed = sessionRejected ? false : Boolean(rotated || accessCookie || refreshCookie);

  if (!isAuthed && isPrivateRoute(pathname)) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    // Carry the origin so the sign-in flow can return the user where they were going.
    // Use a path, never a full URL supplied by the request, or the parameter becomes an
    // open-redirect vector.
    signInUrl.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(signInUrl);
    // A dead refresh token must be cleared on the redirect too, or the browser keeps
    // replaying it and every subsequent request pays for another failed rotation.
    if (sessionRejected) clearSessionCookies(redirect);
    return redirect;
  }

  if (isAuthed && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  /* ── Request-header injection (see the file header) ────────────────────────── */
  const requestHeaders = new Headers(request.headers);
  // Expose the current path to Server Components, which cannot otherwise read it (a
  // layout has no access to the child segment's URL).
  requestHeaders.set('x-current-path', pathname);
  if (rotated) {
    // Forward the rotated pair to the current render via the serialized cookie header.
    requestHeaders.set('cookie', request.cookies.toString());
  }

  // `request: { headers }` — NOT `{ headers }`. See the file header.
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  /* ── Persist to the browser ────────────────────────────────────────────────── */
  if (rotated) {
    // `secure` is decided from THIS request, never from NODE_ENV: a browser silently
    // DISCARDS a `Secure` cookie that arrived over plain http, so a production build
    // served on http stores nothing and the user is signed out the moment the old
    // access token expires.
    const base = {
      ...SESSION_COOKIE_BASE,
      secure: isSecureRequest(request.headers, request.url),
    };
    response.cookies.set(ACCESS_COOKIE, rotated.access, {
      ...base,
      maxAge: accessCookieMaxAge(rotated.access),
    });
    response.cookies.set(REFRESH_COOKIE, rotated.refresh, {
      ...base,
      maxAge: refreshCookieMaxAge(rotated.refresh),
    });
  } else if (sessionRejected) {
    clearSessionCookies(response);
  }

  return response;
}

/**
 * Delete both cookies unconditionally. A half-present pair (the usual state after a
 * failed rotation) must still be fully cleared or the session gets stuck in a loop, and
 * the `path` must match the one they were written with — otherwise the expiry lands on a
 * different cookie and the browser keeps sending the real one.
 */
function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.delete({ name, path: SESSION_COOKIE_BASE.path });
  }
}

export const config = {
  /**
   * Matches every page request and excludes:
   *  - `api` — ROUTE HANDLERS MUST STAY OUT of a redirecting interceptor. They read the
   *    session themselves and answer with JSON (or a stream); a 307 to a sign-in HTML
   *    page in place of that payload gives the caller a parse error instead of a 401,
   *    and any client retry logic then misdiagnoses it.
   *  - `_next/static`, `_next/image` — build output and the image optimizer. Gating them
   *    costs a rotation attempt per asset and can break image optimization.
   *  - static files at the root (`favicon.ico` and friends) — never session-dependent.
   *  - `mockServiceWorker.js` — the request-mock worker script, served from `public/`.
   *    The browser fetches it BEFORE mocking is active, on every load; gating it costs a
   *    rotation attempt per load and gains nothing. Drop this entry with the mock layer.
   */
  // TODO(project): add any other root-level static file or public asset prefix.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|mockServiceWorker.js).*)'],
};
