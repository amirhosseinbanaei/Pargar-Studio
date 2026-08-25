// src/app/(dashboard)/dashboard/(shell)/layout.tsx
/**
 * The chrome around every signed-in screen, and the second of the two gates in front of them.
 *
 * ─── WHY A `(shell)` GROUP INSIDE `(dashboard)` ───────────────────────────────────
 * `/dashboard/login` must render with no navigation and no "signed in as" header, and every
 * other `/dashboard/*` route must render with both. A layout cannot opt out of itself, so
 * the two need different layouts — and a route group is how the App Router expresses "these
 * siblings share chrome and that one does not" without changing anybody's URL. `(shell)`
 * adds no path segment: `(shell)/projects/page.tsx` is still `/dashboard/projects`.
 *
 * ─── THIS GATE IS NOT THE AUTHORIZATION EITHER ────────────────────────────────────
 * It stops a signed-out visitor from seeing a rendered dashboard, which the proxy has
 * usually already done — this catches the cases the proxy structurally cannot: a cookie that
 * is PRESENT but expired, malformed or forged. The proxy only checks presence, on purpose.
 *
 * Neither of them is what protects the DATA. Every write Server Action calls `readSession()`
 * itself, because an action is a public HTTP endpoint reachable with `curl` that never passes
 * through a layout or a proxy. Two UX gates and one real one.
 *
 * ─── `redirect()` RATHER THAN RENDERING A SIGN-IN PROMPT ──────────────────────────
 * And it is called at the top level, never inside a `try`: it signals by throwing a
 * control-flow exception the framework catches, so a `catch` around it cancels the
 * navigation and hands the caller a bogus success.
 *
 * ─── NO COOKIE IS WRITTEN HERE ────────────────────────────────────────────────────
 * `readSession` only reads. Clearing the dead cookie would be the tempting thing to do on the
 * way past — and it is illegal in a Server Component render, where the response headers are
 * already committed. The next successful login overwrites it; the next `logoutAction` deletes
 * it. Both of those are Server Actions, which is where cookie writes belong.
 */
import { redirect } from 'next/navigation';
import { SIGN_IN_PATH } from '@/common/config/private-routes';
import { readSession } from '@/common/services/session';
import { DashboardShell } from '@/modules/dashboard';

export default async function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (session.status !== 'valid') redirect(SIGN_IN_PATH);

  return <DashboardShell>{children}</DashboardShell>;
}
