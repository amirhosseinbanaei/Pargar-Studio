// src/common/services/session.ts
/**
 * The ONLY module that touches the auth session cookies: their names, their attributes,
 * their lifetimes, and the single-flighted refresh-token rotation.
 *
 * Read it anywhere on the server. `writeSession` / `clearSession` are legal ONLY where
 * cookie writes are allowed — Server Actions, Route Handlers, and the request
 * interception layer — never during an RSC render, where the response headers are
 * already committed and the write silently does nothing.
 *
 * This file must NEVER expose a token to client JavaScript: no endpoint, no action and
 * no prop may return one. The cookies are `httpOnly`, so an XSS cannot read them; a
 * "convenient" token-returning endpoint hands that protection back.
 *
 * The failures it prevents (all of them production-only, all of them expensive):
 *  - `secure: NODE_ENV === 'production'` — a browser silently DISCARDS a `Secure` cookie
 *    delivered over plain http, so sign-in "succeeds" and every later call 401s. It
 *    passes review because `localhost` is exempt.
 *  - Concurrent rotation of a single-use refresh token — the losers of the race clear
 *    the session and throw a signed-in user back to the sign-in page.
 *  - A boolean refresh result — "token dead" and "backend unreachable" become
 *    indistinguishable, and the only safe behaviour left is the destructive one.
 *
 * Version note: `cookies()` / `headers()` are async in Next 15+ and the sync form was
 * removed in 16. On 14, drop the `await`s.
 *
 * TODO(project): if you deploy more than one server instance, the in-memory rotation
 * maps below are per-process. Use sticky sessions, or move both maps behind a shared
 * cache keyed by the refresh token.
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import { http } from './http';
import { HttpError } from './http-types';
import { getTokenExpiry } from './jwt';
import { API_URL } from '@/common/constants/api';

/** TODO(project): match your backend's token-refresh endpoint. */
const REFRESH_PATH = '/auth/token/refresh/';

/**
 * A hung refresh blocks every request behind it, including the interception layer that
 * runs before the page renders. Fail fast and let the next request try again.
 */
const REFRESH_TIMEOUT_MS = 10_000;

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/** Used only when a token's `exp` cannot be read — see `cookieMaxAge`. */
const ACCESS_FALLBACK_MAX_AGE = 60 * 15; // 15 minutes

/**
 * How long a signed-in session may survive with no visit. Caps the refresh cookie even
 * when the backend's refresh token itself lives far longer.
 * TODO(project): set this to your session policy.
 */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Attributes that never depend on the request. `secure` is added per request — see
 * `isSecureRequest` — because it is the one attribute that can silently make the browser
 * throw the cookie away.
 */
export const SESSION_COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const;

export interface Session {
  access: string | null;
  refresh: string | null;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/**
 * Whether the session cookies may carry `Secure`, decided from the request that is about
 * to receive them — NOT from `NODE_ENV`.
 *
 * Resolution order:
 *  1. An explicit override — the escape hatch for a TLS terminator that rewrites neither
 *     header below.
 *  2. `x-forwarded-proto` — what a reverse proxy reports the browser used. The header may
 *     be a comma-separated chain; the first hop wins.
 *  3. `origin`, else `referer` — sent by the browser itself, so this still works behind a
 *     terminator that forwards no `x-forwarded-*` at all.
 *  4. Nothing to go on -> omit `Secure`, preferring a working session over a stricter
 *     one. The cookies stay `httpOnly` + `SameSite=Lax` either way, so tokens remain
 *     unreachable from client JS and are not sent on cross-site requests.
 *
 * A client cannot use this to downgrade a real HTTPS session: browsers cannot set
 * `x-forwarded-proto`, and a browser on HTTPS always sends an `https://` origin.
 */
export function isSecureRequest(requestHeaders: Headers, requestUrl?: string): boolean {
  // TODO(project): rename this server-side variable to match your convention. It must
  // NOT be `NEXT_PUBLIC_`-prefixed — it is read on the server only.
  const override = process.env.SESSION_COOKIE_SECURE;
  if (override === 'true') return true;
  if (override === 'false') return false;

  const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) return forwardedProto.toLowerCase() === 'https';

  const browserOrigin = requestHeaders.get('origin') ?? requestHeaders.get('referer');
  if (browserOrigin) return browserOrigin.startsWith('https://');

  return requestUrl?.startsWith('https://') ?? false;
}

/**
 * The full cookie attribute set for the current request. Every writer of the pair must
 * use it: a mismatched attribute set writes a SECOND cookie instead of replacing the
 * first, after which the browser keeps replaying the stale one and sign-out appears not
 * to work.
 */
export async function sessionCookieOptions(): Promise<
  typeof SESSION_COOKIE_BASE & { secure: boolean }
> {
  return { ...SESSION_COOKIE_BASE, secure: isSecureRequest(await headers()) };
}

/**
 * Keep a token in the browser exactly as long as it is actually valid, capped by policy.
 *
 * A cookie shorter than its token is not merely wasteful. Every premature expiry forces
 * a rotation, and where refresh tokens are single-use every rotation is another chance
 * to lose the session (see `rotateSession`). A flat 15-minute cookie in front of a
 * 24-hour token means four needless rotations an hour.
 */
function cookieMaxAge(token: string, cap: number, fallback: number): number {
  const exp = getTokenExpiry(token);
  if (exp == null) return fallback;
  const remaining = Math.floor(exp - Date.now() / 1000);
  // An already-expired token keeps the fallback: the cookie must still exist for the
  // rotation path to find the pair at all.
  return remaining > 0 ? Math.min(remaining, cap) : fallback;
}

/** Cookie lifetime for an access token — its own validity, bounded by session policy. */
export const accessCookieMaxAge = (access: string): number =>
  cookieMaxAge(access, SESSION_MAX_AGE, ACCESS_FALLBACK_MAX_AGE);

/** Cookie lifetime for a refresh token — its own validity, bounded by session policy. */
export const refreshCookieMaxAge = (refresh: string): number =>
  cookieMaxAge(refresh, SESSION_MAX_AGE, SESSION_MAX_AGE);

export async function readSession(): Promise<Session> {
  const store = await cookies();
  return {
    access: store.get(ACCESS_COOKIE)?.value ?? null,
    refresh: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}

/** Legal only in a Server Action, a Route Handler, or the interception layer. */
export async function writeSession(access: string, refresh: string): Promise<void> {
  const store = await cookies();
  const base = await sessionCookieOptions();
  store.set({ ...base, name: ACCESS_COOKIE, value: access, maxAge: accessCookieMaxAge(access) });
  store.set({
    ...base,
    name: REFRESH_COOKIE,
    value: refresh,
    maxAge: refreshCookieMaxAge(refresh),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  // Delete unconditionally — a half-present pair (e.g. after a failed refresh) must
  // still be fully cleared, or the session gets stuck in a state that never recovers.
  // The path must match the one they were written with, or the expiry lands on a
  // different cookie and the browser keeps replaying the real one.
  store.delete({ name: ACCESS_COOKIE, path: SESSION_COOKIE_BASE.path });
  store.delete({ name: REFRESH_COOKIE, path: SESSION_COOKIE_BASE.path });
}

/**
 * Why a rotation did not produce a new pair. The distinction decides whether the session
 * may be destroyed: only the backend saying "this refresh token is no longer valid"
 * means the user is really signed out. A backend that is unreachable, slow, or 500ing
 * must leave the cookies alone — otherwise one blip signs every active user out at once.
 */
export type RotationOutcome =
  | { status: 'rotated'; pair: TokenPair }
  | { status: 'rejected' }
  | { status: 'unavailable' };

/**
 * Rotations already performed for a given refresh token, and rotations still in flight.
 * Both are keyed by the OLD refresh token and both expire after `ROTATION_TTL_MS`.
 *
 * With rotating + blacklist-on-rotation refresh tokens (the default in many auth stacks)
 * a refresh token is SINGLE-USE: the moment one request exchanges it, every other
 * request still holding it gets a 401. A production page load fires many requests at
 * once — the navigation, its RSC payload, link prefetches (which exist only in a
 * production build), and any bootstrap Server Action — and each one runs the
 * interception layer. Without this guard they all read the same stale access cookie, all
 * call the refresh endpoint with the same token, one wins, and the losers clear the
 * session. Development never reproduces it, because prefetching is production-only.
 */
const ROTATION_TTL_MS = 30_000;
const inFlightRotations = new Map<string, Promise<RotationOutcome>>();
const completedRotations = new Map<string, { pair: TokenPair; at: number }>();

function rememberRotation(oldRefresh: string, pair: TokenPair): void {
  const now = Date.now();
  for (const [key, entry] of completedRotations) {
    if (now - entry.at >= ROTATION_TTL_MS) completedRotations.delete(key);
  }
  completedRotations.set(oldRefresh, { pair, at: now });
}

/**
 * The refresh response is the one payload that is written straight into a cookie, so it
 * is shape-checked before it can poison the session with `undefined`.
 * TODO(project): map your backend's field names here (`access_token`/`refresh_token`,
 * `token`/`refreshToken`, …) — this is the only place they appear.
 */
function toTokenPair(raw: unknown): TokenPair | null {
  if (!raw || typeof raw !== 'object') return null;
  const { access, refresh } = raw as { access?: unknown; refresh?: unknown };
  if (typeof access !== 'string' || !access) return null;
  if (typeof refresh !== 'string' || !refresh) return null;
  return { access, refresh };
}

async function exchangeRefresh(refresh: string): Promise<RotationOutcome> {
  try {
    const pair = toTokenPair(
      await http.json<unknown>(`${API_URL}${REFRESH_PATH}`, { refresh }, {
        timeoutMs: REFRESH_TIMEOUT_MS,
      }),
    );
    // A 200 whose body we cannot read is a backend problem, not a dead session:
    // treating it as `rejected` would sign the user out over a serializer change.
    if (!pair) return { status: 'unavailable' };
    rememberRotation(refresh, pair);
    return { status: 'rotated', pair };
  } catch (err) {
    // 400/401 = "this token is dead" (expired, or already spent and blacklisted).
    // Anything else — timeout, DNS, 5xx — says nothing about the session.
    // `instanceof` is safe here: this module constructed nothing, but the error came
    // from `http` one stack frame away, with no serialization boundary in between.
    const rejected = err instanceof HttpError && (err.status === 400 || err.status === 401);
    return rejected ? { status: 'rejected' } : { status: 'unavailable' };
  }
}

/**
 * Exchange a refresh token for a fresh pair, at most once per token.
 *
 * Does NOT persist cookies, which is what makes it callable mid-render: the caller uses
 * the returned access token for that request only, and the interception layer performs
 * the persistent rotation. Concurrent callers holding the same refresh token share one
 * exchange, and a caller that arrives just after a rotation is replayed the pair it
 * produced instead of spending an already-dead token.
 */
export async function rotateSession(refresh: string): Promise<RotationOutcome> {
  const done = completedRotations.get(refresh);
  if (done && Date.now() - done.at < ROTATION_TTL_MS) {
    return { status: 'rotated', pair: done.pair };
  }

  const pending = inFlightRotations.get(refresh);
  if (pending) return pending;

  const rotation = exchangeRefresh(refresh).finally(() => inFlightRotations.delete(refresh));
  inFlightRotations.set(refresh, rotation);
  return rotation;
}

/** `rotateSession` for callers that only care whether they got a usable pair. */
export async function refreshAccess(refresh: string): Promise<TokenPair | null> {
  const outcome = await rotateSession(refresh);
  return outcome.status === 'rotated' ? outcome.pair : null;
}
