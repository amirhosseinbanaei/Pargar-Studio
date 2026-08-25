// src/app/(dashboard)/dashboard/login/page.tsx
/**
 * The login page. Deliberately OUTSIDE the `(shell)` group, so it renders on a bare document
 * with no navigation and no "signed in as" header — chrome that would be nonsense in front
 * of somebody who is not signed in.
 *
 * ─── THE ALREADY-SIGNED-IN BOUNCE LIVES HERE, NOT IN THE PROXY ────────────────────
 * The proxy can only see whether a session COOKIE IS PRESENT; it does not verify signatures,
 * by design (it is a coarse UX gate, never the authorization). So a bounce written there
 * would send someone holding an EXPIRED cookie to `/dashboard`, whose shell reads the session
 * properly, finds it dead, and sends them back here — an infinite redirect loop that first
 * appears seven days after somebody signs in, which is the worst possible time to discover it.
 *
 * `readSession()` here can tell a valid session from a dead one, so the bounce is correct.
 * A dead cookie simply falls through to the form, and a successful sign-in overwrites it.
 *
 * `redirect()` is called at the TOP LEVEL of the component and never inside a `try` — it
 * signals by throwing a control-flow exception the framework catches, and a `catch` around it
 * turns a navigation into a silently swallowed request.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DASHBOARD_HOME, safeReturnPath } from '@/common/config/private-routes';
import { readSession } from '@/common/services/session';
import { LoginForm } from '@/modules/dashboard';

export const metadata: Metadata = {
  title: 'Sign in',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await readSession();
  const params = await searchParams;

  const rawNext = typeof params.next === 'string' ? params.next : undefined;
  /**
   * Validated HERE as well as inside the action, and both are load-bearing rather than
   * duplicated. This call decides where an already-signed-in visitor is sent, which is a
   * navigation this page performs; the one in the action decides where a fresh sign-in
   * lands. Two navigations, two places the value is used, so two places it is checked —
   * an unchecked `?next=` is an open redirect at either of them.
   */
  const next = safeReturnPath(rawNext, DASHBOARD_HOME);

  if (session.status === 'valid') redirect(next);

  // The RAW value goes to the form, which passes it back to the action to be re-validated
  // server-side. Sanitizing it here and trusting it there would be validating it nowhere:
  // the action is a public endpoint and never sees this page's work.
  return <LoginForm next={rawNext} />;
}
