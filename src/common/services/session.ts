// src/common/services/session.ts
/**
 * THE ONLY MODULE IN THIS CODEBASE THAT TOUCHES THE AUTH COOKIE.
 *
 * Its name, its attributes, its lifetime, the signature over it and the password it is
 * issued against all live here and nowhere else. A second module that reads
 * `cookies().get('kavan_session')` is a second definition of "signed in", and the two
 * drift the first time the cookie's name, path or expiry changes.
 *
 * ─── THE DEVIATION THIS FILE IMPLEMENTS ───────────────────────────────────────────
 * `references/03-server-data-layer.md` §6 specifies a three-legged JWT rotation against a
 * remote auth server: an access token, a single-use refresh token, single-flighted
 * rotation at the edge, and a three-state verdict so a backend blip cannot log everyone
 * out. NONE of that applies here. There is no remote auth server, no user table and no
 * refresh token — there is one administrator and one password in `ADMIN_PASSWORD` — so the
 * whole session ring collapses to a single signed HttpOnly cookie. Re-enable the full ring
 * only if multi-user auth arrives. Recorded in AGENTS.md.
 *
 * WHAT IS KEPT FROM §6, because it is cheap and load-bearing:
 *  - This module is the only one that touches the cookie.
 *  - `createSession` / `destroySession` are legal ONLY where cookie writes are legal —
 *    Server Actions, Route Handlers, and request interception. NEVER during a Server
 *    Component render, where the response headers are already committed: the write throws
 *    in the App Router, and the failure surfaces far from its cause.
 *  - `readSession` is legal anywhere on the server, and RETURNS a discriminated result
 *    rather than throwing. A page asking "is anyone signed in" is not an exceptional path.
 *  - `secure` is derived from the REQUEST, never from `NODE_ENV` (see `isSecureRequest`).
 *  - Nothing here is ever exposed to client JavaScript. The cookie is `httpOnly`, and no
 *    action, prop or endpoint may return the raw cookie value.
 *
 * ─── THE SIGNATURE ────────────────────────────────────────────────────────────────
 * `base64url(payload) . base64url(HMAC-SHA256(payload, SESSION_SECRET))`. The payload is
 * NOT encrypted and is not meant to be — it holds an issue time and an expiry, nothing
 * secret. What the HMAC buys is that the client cannot MINT one: without the secret it
 * cannot produce a matching tag, so it cannot extend its own expiry or fabricate a session
 * from nothing. Both the signature check and the password check use a constant-time
 * comparison, so neither leaks its answer through how long it took to say no.
 *
 * ─── WHY NOT A JWT LIBRARY ────────────────────────────────────────────────────────
 * A dependency for one HMAC over one field is the wrong trade, and AGENTS.md bans a new
 * dependency for something the platform already does. `node:crypto` is in the runtime;
 * this is thirty lines of it. There is no algorithm negotiation here, which also means
 * there is no `alg: none` to get wrong.
 */
import 'server-only';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { serverEnv } from '@/common/config/server-env';
import { SESSION_COOKIE, SESSION_COOKIE_BASE } from '@/common/config/session-cookie';

/**
 * The cookie's name and shared attributes live in `@/common/config/session-cookie` and are
 * re-exported here, so that everything ABOUT the session is reachable from this module
 * while `proxy.ts` — which cannot import `server-only` or `next/headers` — can still read
 * the name it needs. That file's header explains the split.
 */
export { SESSION_COOKIE, SESSION_COOKIE_BASE };

/**
 * How long a signed-in session lasts, in seconds.
 *
 * SEVEN DAYS. The reasoning, because the number is otherwise arbitrary: this is a studio's
 * content editor, not a bank. The cost of a short expiry is a person who opens the
 * dashboard twice a month being signed out every single time, which trains them to keep
 * the password somewhere convenient — a real security cost paid to buy a theoretical one.
 * The cost of a long expiry is a stolen cookie staying valid longer.
 *
 * THE REVOCATION STORY, stated because a single-cookie design has to have one: there is no
 * session table, so an individual session cannot be revoked. Rotating `SESSION_SECRET`
 * invalidates EVERY outstanding cookie at once, because every signature stops verifying.
 * That is the whole logout-everywhere mechanism and it is one environment variable.
 *
 * Recorded in AGENTS.md.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** What a valid cookie carries. Nothing secret, and nothing the client may choose. */
export interface AdminSession {
  /** There is one administrator; the subject exists so the payload is self-describing. */
  sub: 'admin';
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. */
  exp: number;
}

/**
 * The result of reading the cookie.
 *
 * A discriminated union rather than `AdminSession | null`, and rather than a throw. The
 * caller that matters most — every write action — only needs `status === 'valid'`, but the
 * four cases are distinguishable so a log line or a test can say WHICH failure happened.
 * Collapsing "no cookie at all" and "cookie with a forged signature" into one `null` is
 * how a forgery attempt becomes indistinguishable from a first-time visitor.
 *
 * `reason` on the failure branch is for the server's own eyes. It must never be shown to
 * the client: "your signature is invalid" tells an attacker their forgery parsed.
 */
export type SessionResult =
  | { status: 'valid'; session: AdminSession }
  | { status: 'anonymous' }
  | { status: 'invalid'; reason: 'malformed' | 'bad-signature' }
  | { status: 'expired' };

/* ────────────────────────────────────────────────────────────────────────────────
   Constant-time comparison
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Compare two strings without leaking their contents through timing.
 *
 * `crypto.timingSafeEqual` THROWS when the two buffers differ in length, so feeding it raw
 * candidate values would turn "wrong length" into an exception and "right length, wrong
 * bytes" into a false — a length oracle implemented by accident. Hashing both sides first
 * makes every comparison exactly 32 bytes, so the function is total and the length of the
 * real secret is not observable.
 *
 * SHA-256 here is a length-equalizer, not a password hash. It is doing no key-stretching
 * work and is not meant to: `ADMIN_PASSWORD` is a deployment secret in an environment
 * variable, not a user-chosen password in a database that could leak. If a user table ever
 * arrives, that is the moment for a real KDF, and it belongs with the table.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}

/* ────────────────────────────────────────────────────────────────────────────────
   The credential
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether `candidate` is the administrator's password.
 *
 * The credential is read through `@/common/config/server-env`, never `process.env`, and it
 * has NO fallback. That is the difference between an app that refuses to boot with the
 * key named and an app that boots with `ADMIN_PASSWORD === undefined` and then compares
 * every attempt against an empty string. `server-env` zod-parses at import time with
 * `.min(1)`, so by the time this function runs the value is a non-empty string or the
 * process never started.
 *
 * It lives in the session module rather than in the login action because this is the file
 * that owns "what counts as the administrator". An action that read the password itself
 * would be a second place the credential appears.
 */
export function verifyAdminPassword(candidate: string): boolean {
  return constantTimeEquals(candidate, serverEnv.ADMIN_PASSWORD);
}

/* ────────────────────────────────────────────────────────────────────────────────
   Signing
   ──────────────────────────────────────────────────────────────────────────────── */

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

function sign(payload: string): string {
  return createHmac('sha256', serverEnv.SESSION_SECRET).update(payload).digest('base64url');
}

/**
 * Serialize and sign a payload into the cookie's value.
 *
 * Exported for the tests, which have to be able to mint a valid cookie and a cookie signed
 * with the wrong key without reaching into the crypto themselves. It is NOT part of the
 * surface any route or action uses — the only sanctioned way to create a session is
 * `createSession`, which also writes the cookie with the right attributes.
 */
export function serializeSession(session: AdminSession): string {
  const payload = encode(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a cookie value and return what it says.
 *
 * The order is deliberate: SIGNATURE FIRST, then shape, then expiry. Parsing an unverified
 * payload means running `JSON.parse` on a string an attacker fully controls before
 * establishing that it came from us — the parse is safe on its own, but the habit is how
 * an unverified claim ends up being read one refactor later. Nothing here trusts the
 * payload until the tag over it matches.
 *
 * The expiry is checked against the payload's own `exp` and NOT against the cookie's
 * `maxAge`. A cookie's lifetime is enforced by the browser, which is the party being
 * authenticated; the signed `exp` is enforced here, which is the party that matters.
 */
export function verifySession(raw: string): SessionResult {
  const dot = raw.indexOf('.');
  if (dot < 1 || dot === raw.length - 1) return { status: 'invalid', reason: 'malformed' };

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  if (!constantTimeEquals(signature, sign(payload))) {
    return { status: 'invalid', reason: 'bad-signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
  } catch {
    // A payload that carries our own signature and still will not parse means the secret
    // is shared with something that writes a different format. `malformed`, not
    // `bad-signature`: the tag was fine.
    return { status: 'invalid', reason: 'malformed' };
  }

  if (!isAdminSession(parsed)) return { status: 'invalid', reason: 'malformed' };
  if (parsed.exp <= nowSeconds()) return { status: 'expired' };

  return { status: 'valid', session: parsed };
}

/**
 * Duck-typed, not cast. The value came out of `JSON.parse`, so its static type is a claim
 * nobody checked; `as AdminSession` there would make every field below a lie the compiler
 * agrees with.
 */
function isAdminSession(value: unknown): value is AdminSession {
  if (typeof value !== 'object' || value === null) return false;
  const { sub, iat, exp } = value as Record<string, unknown>;
  return sub === 'admin' && typeof iat === 'number' && typeof exp === 'number';
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/* ────────────────────────────────────────────────────────────────────────────────
   Cookie attributes
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the cookie may carry `Secure`, decided from the request that is about to receive
 * it — NOT from `NODE_ENV`.
 *
 * `secure: process.env.NODE_ENV === 'production'` is the spelling that passes review and
 * fails in production: a browser SILENTLY DISCARDS a `Secure` cookie delivered over plain
 * http, so a production build served on http behind a terminator that does not forward
 * `x-forwarded-proto` stores nothing at all — sign-in "succeeds" and the very next request
 * is anonymous, with no error anywhere. It passes review because `localhost` is exempt
 * from the rule, so development works perfectly.
 *
 * Resolution order:
 *  1. `x-forwarded-proto` — what a reverse proxy reports the browser used. It may be a
 *     comma-separated chain; the first hop is the browser's.
 *  2. `origin`, else `referer` — sent by the browser itself, so this still works behind a
 *     terminator that forwards no `x-forwarded-*` at all.
 *  3. Nothing to go on -> omit `Secure`, preferring a working session over a stricter one.
 *     The cookie is `httpOnly` + `SameSite=Lax` either way.
 *
 * A client cannot downgrade a real HTTPS session this way: browsers cannot set
 * `x-forwarded-proto`, and a browser on HTTPS always sends an `https://` origin.
 */
export function isSecureRequest(requestHeaders: Headers): boolean {
  const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) return forwardedProto.toLowerCase() === 'https';

  const browserOrigin = requestHeaders.get('origin') ?? requestHeaders.get('referer');
  if (browserOrigin) return browserOrigin.startsWith('https://');

  return false;
}

/* ────────────────────────────────────────────────────────────────────────────────
   The three operations
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Read the cookie and say what it means. Legal ANYWHERE on the server — a layout, a page,
 * an action, a route handler — because it only reads.
 *
 * Every write Server Action in the dashboard calls this first and returns 401 on anything
 * but `'valid'`. The proxy's redirect is a UX convenience; THIS is the authorization.
 */
export async function readSession(): Promise<SessionResult> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return { status: 'anonymous' };
  return verifySession(raw);
}

/**
 * Convenience for the common question. Kept beside `readSession` so no caller invents its
 * own spelling of "is anyone signed in".
 */
export async function isSignedIn(): Promise<boolean> {
  return (await readSession()).status === 'valid';
}

/**
 * Issue a session and write the cookie.
 *
 * LEGAL ONLY IN A SERVER ACTION, A ROUTE HANDLER, OR REQUEST INTERCEPTION. Calling it
 * during a Server Component render throws — the response headers are already committed by
 * the time most of the tree runs — and the throw surfaces as a render error in a file that
 * has nothing to do with authentication.
 *
 * `maxAge` on the cookie matches the signed `exp`, so the browser stops sending a cookie
 * at the same moment this module would stop accepting it. A mismatch is not a security
 * hole in either direction, but it does produce the confusing state where the browser
 * faithfully replays a cookie that is rejected on arrival.
 */
export async function createSession(): Promise<AdminSession> {
  const iat = nowSeconds();
  const session: AdminSession = { sub: 'admin', iat, exp: iat + SESSION_MAX_AGE_SECONDS };

  const store = await cookies();
  store.set({
    ...SESSION_COOKIE_BASE,
    name: SESSION_COOKIE,
    value: serializeSession(session),
    secure: isSecureRequest(await headers()),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return session;
}

/**
 * Clear the session. Same legality rule as `createSession`.
 *
 * Deletes by `{ name, path }` rather than by name alone: the `path` must match the one the
 * cookie was written with, or the expiry lands on a different cookie and the browser keeps
 * replaying the real one — which is exactly what "logout does nothing" looks like.
 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: SESSION_COOKIE_BASE.path });
}
