// src/common/config/session-cookie.ts
/**
 * The auth cookie's IDENTITY — its name and the attributes every write of it must share.
 *
 * ─── WHY THIS IS NOT INSIDE `session.ts` ──────────────────────────────────────────
 * `src/common/services/session.ts` is the only module that READS OR WRITES the cookie, and
 * it stays that way. But it imports `server-only` and `next/headers`, neither of which is
 * available in the request-interception layer — `proxy.ts` runs before any render and has
 * no cookie store, only the request's own jar. So the proxy cannot import that module at
 * all, and the one thing it needs from it is a single string.
 *
 * This is the same split the architecture's own template makes for the token reader
 * (`references/03-server-data-layer.md` §6.1: "carries no `server-only`, so the edge can
 * import it"). The rule that matters is preserved exactly: the proxy reads the NAME from
 * here and checks the request jar for PRESENCE, which is a UX gate, not an authorization
 * decision. Verifying the signature, reading the payload and writing the cookie all remain
 * in `session.ts` and happen nowhere else.
 *
 * The failure the split prevents: a proxy that hardcodes `'kavan_session'` and a session
 * module that renames the cookie. Nothing errors — the gate simply stops seeing sessions
 * that exist, and every signed-in visitor is bounced to the login page by a file that
 * looks correct.
 *
 * Dependencies: none, and it must stay that way. `proxy.ts` imports it, so anything pulled
 * in here runs on every matched request.
 */

/**
 * Prefixed with the project so it cannot collide with anything else on a shared
 * development host, and deliberately NOT named `token`, `session` or `auth`: the name is
 * visible to anyone with the browser open, and a boring one attracts less scripted probing
 * than a familiar one.
 */
export const SESSION_COOKIE = 'kavan_session';

/**
 * Attributes shared by every write of this cookie. `secure` is NOT here — it is decided
 * per request in `session.ts`, because it is the one attribute that can silently make the
 * browser throw the cookie away.
 *
 * `sameSite: 'lax'` rather than `'strict'`: `strict` withholds the cookie on a top-level
 * navigation that originated elsewhere, so following a bookmark or a link straight to
 * `/dashboard/projects` would land on the login page while genuinely signed in. `lax`
 * still withholds it on cross-site POSTs, which is the CSRF case that matters for a form.
 *
 * One object, shared by every writer. A mismatched attribute set writes a SECOND cookie
 * instead of replacing the first, after which the browser keeps replaying the stale one —
 * which is what "logging out does nothing" looks like from the outside. The `path` is why
 * `destroySession` deletes by `{ name, path }` rather than by name alone.
 */
export const SESSION_COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const;
