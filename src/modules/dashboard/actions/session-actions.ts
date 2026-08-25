// src/modules/dashboard/actions/session-actions.ts
'use server';
/**
 * Sign in and sign out — the only two places in this codebase where the auth cookie is
 * written, and the reason they are Server Actions rather than anything else.
 *
 * COOKIE WRITES ARE LEGAL ONLY IN A SERVER ACTION, A ROUTE HANDLER, OR REQUEST
 * INTERCEPTION. Never during a Server Component render: the response headers are already
 * committed by the time most of the tree runs, so the write throws, and the throw surfaces
 * in whatever component happened to trigger it rather than anywhere near the session code.
 * That is the whole reason a login form posts to an action instead of a page doing the work
 * on the way in.
 *
 * Both of these still delegate the cookie itself to `@/common/services/session`, which is
 * the only module that touches it. What lives here is the POLICY around the write —
 * validation, the rate limit, where to go afterwards — not the cookie.
 */
import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionResult } from '@/common/services/action-result';
import { createSession, destroySession, verifyAdminPassword } from '@/common/services/session';
import { safeReturnPath, SIGN_IN_PATH } from '@/common/config/private-routes';
import { loginSubmissionSchema } from '../schemas/login';
import { canAttemptLogin, clearLoginFailures, recordLoginFailure } from '../lib/login-rate-limit';

/**
 * The connection this attempt came from, used for nothing but the courtesy limit.
 *
 * `x-forwarded-for` is a LIST — `client, proxy1, proxy2` — and the client is the FIRST
 * entry. Taking the last would key the limit on the proxy and ration every visitor
 * together. It is also forgeable by anyone who can set a header, which is exactly why it
 * is never used for authorization: the password is the credential, this is a bucket name.
 *
 * `'unknown'` is a real bucket rather than a failure. A request with no forwarding header
 * (a direct hit, or local development) shares one window, which is the conservative answer.
 */
async function callerKey(): Promise<string> {
  const head = await headers();
  const forwarded = head.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || head.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * The result a successful login hands back: where the client should navigate.
 *
 * It is a value rather than a `redirect()` because the login form is tier 2 — the
 * navigation happens after `router.replace`, so the form can reset its own state first and
 * so a failed attempt leaves the page exactly where it was. `redirect()` inside an action
 * that can also return a failure would also mean carefully keeping it outside every `try`,
 * for no gain here.
 */
export interface LoginSuccess {
  redirectTo: string;
}

/**
 * IT RETURNS, IT NEVER THROWS. A wrong password is `{ ok: false, status: 401 }` — a plain
 * object that survives the RPC boundary intact — not an exception. A thrown error is
 * sanitized crossing that boundary: in production the client receives a generic `Error`
 * with an opaque digest, and the status the form branches on is simply gone.
 *
 * ORDER: rate limit, then parse, then compare. The limit runs first because a caller who
 * has spent their window must not be able to make the server do parsing work, and because
 * a 429 that arrived after a 422 would tell a script that its payload shape was accepted.
 *
 * WHAT IT DOES NOT DO: distinguish "no password sent" from "wrong password" in its 401. The
 * 422 branch below only fires on a payload the FORM could never produce, and both answers
 * are deliberately uninformative about the credential itself.
 */
export async function loginAction(input: unknown): Promise<ActionResult<LoginSuccess>> {
  const key = await callerKey();

  if (!canAttemptLogin(key).allowed) {
    // Status only. The client owns the sentence — see the form.
    return { ok: false, status: 429 };
  }

  const parsed = loginSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    // The canonical validation envelope, `{ field: [message] }`, which the error system's
    // `parseBody` already understands — so the form binds it onto the input with no adapter.
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /**
   * Constant-time, inside `session.ts`. A `===` here would answer a wrong password faster
   * the earlier it diverges, which over enough attempts is a byte-by-byte oracle on the
   * credential. That the comparison is cheap is exactly why there is no excuse for it.
   */
  if (!verifyAdminPassword(parsed.data.password)) {
    recordLoginFailure(key);
    return { ok: false, status: 401 };
  }

  /**
   * A correct password clears the window. Without this, an administrator who mistyped nine
   * times and then succeeded would start their next session one attempt from being locked
   * out of their own dashboard — the limiter resisting the person it exists to protect.
   */
  clearLoginFailures(key);
  await createSession();

  /**
   * `?next=` is attacker-supplied even though only the gate writes it, so it is re-validated
   * rather than trusted: `safeReturnPath` rejects absolute URLs, protocol-relative paths and
   * anything outside the dashboard. Without that check the login form is an open redirect —
   * `?next=https://evil.example` would send a freshly-authenticated administrator off-site.
   */
  return { ok: true, data: { redirectTo: safeReturnPath(parsed.data.next) } };
}

/**
 * Sign out, then leave.
 *
 * `redirect()` signals by THROWING a control-flow exception the framework catches, so it is
 * the last statement and sits outside any `try` — a `catch` around it would swallow the
 * signal, the navigation would silently never happen, and the caller would be handed a
 * bogus success. There is nothing to catch here anyway: `destroySession` deletes a cookie.
 *
 * It returns `never` rather than an `ActionResult`, and that is the right shape: signing out
 * has no expected failure for a caller to branch on. The cookie is deleted whether or not
 * one was there, which is what makes clicking "sign out" twice harmless.
 */
export async function logoutAction(): Promise<never> {
  await destroySession();
  redirect(SIGN_IN_PATH);
}
