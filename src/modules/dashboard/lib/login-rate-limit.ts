// src/modules/dashboard/lib/login-rate-limit.ts
/**
 * A window over FAILED login attempts, held in memory.
 *
 * ─── WHY THIS IS NOT `modules/contact/lib/rate-limit.ts` ──────────────────────────
 * It looks like the same function and it is a different one, deliberately, and not because
 * of a cross-module import ban that could be answered by promoting the shared piece to
 * `common/`. The two differ in the rule they encode, which is the part that matters:
 *
 *  - The contact limiter counts EVERY submission. A person legitimately sends one message,
 *    so five in ten minutes is already generous and a successful send should still cost an
 *    attempt — that is what makes it a flood limit.
 *  - This one counts only FAILURES, and a success clears the window entirely. An
 *    administrator who signs in correctly ten times in an afternoon must never be locked
 *    out of their own dashboard, and counting successes would do exactly that. What is
 *    being resisted here is guessing, and only a wrong answer is evidence of guessing.
 *
 * Promoting one of them to `common/` and parameterizing the difference would produce a
 * function with a `countSuccesses` flag whose two call sites are the only two that will
 * ever exist. Two twenty-line functions with different rules beat one forty-line function
 * with a mode.
 *
 * ─── THE HONEST FAILURE MODE ──────────────────────────────────────────────────────
 * In-memory and per-process, exactly as the contact limiter is. On a multi-instance deploy
 * the effective allowance is `MAX_FAILURES × instances` and a restart forgets everything.
 * This app deploys as one container (`output: 'standalone'`, AGENTS.md), so today it is
 * simply exact. It is also NOT the only thing standing between a guesser and the dashboard:
 * `ADMIN_PASSWORD` is a deployment secret rather than a human-chosen password, and the
 * comparison is constant-time. Re-evaluate alongside the contact limiter if the site is
 * ever fronted by more than one instance; the fix is a table behind the same function.
 */
import 'server-only';

/**
 * Ten failures per fifteen minutes.
 *
 * Deliberately looser than the contact form's five-per-ten. The person being limited here
 * is the one legitimate user of this app, typing a password they may genuinely mistype
 * several times; locking the studio out of its own dashboard is a worse outcome than
 * letting a guesser have ten tries at a secret with far more than ten possibilities.
 */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Module scope, so it lives as long as the server process. Keyed by caller; the value is
 * the failure timestamps still inside the window, which is what makes this a true sliding
 * window rather than a counter that resets on a boundary a script can simply wait for.
 */
const failures = new Map<string, number[]>();

/**
 * Bounded, because an unbounded Map keyed by a value the caller controls is a memory leak
 * with a remote trigger. Far past any real traffic; the oldest key is dropped first.
 */
const MAX_KEYS = 5000;

export interface LoginAttemptResult {
  allowed: boolean;
  /** Failures this key may still make inside the current window. */
  remaining: number;
}

/**
 * May this caller attempt a login? Reads the window; records nothing.
 *
 * Checking and recording are separate calls because only a FAILURE is recorded, and
 * whether the attempt failed is not known until after the password has been compared.
 */
export function canAttemptLogin(key: string, now: number = Date.now()): LoginAttemptResult {
  const recent = recentFailures(key, now);
  return {
    allowed: recent.length < MAX_FAILURES,
    remaining: Math.max(0, MAX_FAILURES - recent.length),
  };
}

/** Record one wrong password. */
export function recordLoginFailure(key: string, now: number = Date.now()): void {
  const recent = recentFailures(key, now);
  recent.push(now);
  failures.set(key, recent);

  if (failures.size > MAX_KEYS) {
    const oldest = failures.keys().next();
    if (!oldest.done) failures.delete(oldest.value);
  }
}

/**
 * Forget this caller's failures. Called on a SUCCESSFUL sign-in, which is what keeps a
 * correct password from being rationed: an administrator who mistyped nine times and then
 * got it right starts the next session with a full allowance rather than one attempt.
 */
export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

function recentFailures(key: string, now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return (failures.get(key) ?? []).filter(at => at > cutoff);
}

/** Test seam: forget every window. Never called by application code. */
export function resetLoginRateLimit(): void {
  failures.clear();
}
