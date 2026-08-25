// src/modules/dashboard/lib/require-session.ts
/**
 * The gate every dashboard PAGE calls before it reads anything.
 *
 * ─── WHY A LAYOUT CHECK IS NOT ENOUGH ─────────────────────────────────────────────
 * `(shell)/layout.tsx` already redirects an invalid session, and that is not sufficient,
 * for a reason that is invisible in a browser and obvious with `curl`.
 *
 * A layout and the page inside it render CONCURRENTLY. The layout's `redirect()` throws its
 * control-flow signal, but by then the page has already awaited its own service call and
 * produced its payload — and with streaming the response is flushed as a 200 carrying both
 * the redirect instruction AND the page's rendered data. The client router honours the
 * redirect, so a person never sees that screen. The bytes still went over the wire.
 *
 * Reproduced during prompt 6's verification: a request to `/dashboard/projects` carrying a
 * FORGED session cookie came back 200 with all 76 project rows in the RSC payload, alongside
 * `NEXT_REDIRECT;replace;/dashboard/login`.
 *
 * For projects specifically the exposure is nil — every one of those rows is already public
 * at `/en/projects`. That is luck, not design. Prompt 7 puts `contact_messages` behind the
 * same chrome, and an inbox of messages strangers sent to the studio is not public. The gate
 * has to be fixed before that lands, not after.
 *
 * ─── THE FIX: GATE THE FETCH, NOT THE CHROME ──────────────────────────────────────
 * Called at the TOP of a page, before its service call, this makes the check and the read
 * sequential within one component — so an invalid session means the query never runs and
 * there is nothing to serialize. The layout keeps its own check: it is the cheaper gate on
 * navigation and it stops the chrome rendering, which is a different job.
 *
 * ─── WHY IT IS NOT A `'use server'` ACTION ────────────────────────────────────────
 * It is an ordinary server function called during a render. Putting it in an actions file
 * would publish it as a POST endpoint, and `redirect()` is not something a public endpoint
 * should do on anyone's behalf.
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { SIGN_IN_PATH } from '@/common/config/private-routes';
import { readSession, type AdminSession } from '@/common/services/session';

/**
 * Returns the session, or redirects. `redirect()` throws by design, so the return type is
 * honest: past this line there IS a valid session.
 *
 * Call it as the first statement of a page, and never inside a `try` — a `catch` would
 * swallow the control-flow signal and turn the redirect into a silently-dropped navigation
 * that then falls through to the read this function exists to prevent.
 */
export async function requireDashboardSession(): Promise<AdminSession> {
  const result = await readSession();
  if (result.status !== 'valid') redirect(SIGN_IN_PATH);
  return result.session;
}
