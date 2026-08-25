// src/modules/contact/lib/rate-limit.ts
/**
 * A per-IP window over the contact form, held in memory.
 *
 * ─── THE OPEN DECISION, RESOLVED: IN-MEMORY, NOT A TABLE ──────────────────────────
 * A database-backed limiter would be shared across instances and would survive a restart;
 * an in-memory one is neither. It is still the right trade here, and the reasoning is
 * about what is being protected rather than about effort: this is a studio's contact form,
 * not a credential endpoint. What abuse looks like is a script posting the same form a
 * thousand times, and one bounded window per process stops that at a cost of a `Map`. What
 * a table would buy — a limit that holds across a fleet — costs a write on every submission
 * (so the flood now writes to the database whether or not it is allowed through), a
 * migration, and a second thing for the dashboard to prune.
 *
 * The honest failure mode: on a multi-instance serverless deploy the effective limit is
 * `MAX_PER_WINDOW × instances`, and a cold start forgets everything. Both are acceptable
 * for a form whose worst case is a spammed inbox that a human deletes. On a single-instance
 * deploy — which this is, `output: 'standalone'` behind one container — the limit is simply
 * exact. Re-evaluate if the site is ever fronted by more than one instance AND the inbox
 * actually gets flooded; the fix is a table with the same interface, not a rewrite.
 *
 * WHY NOT A CAPTCHA. Explicitly ruled out: a third-party captcha is a third-party script on
 * every contact page, a consent question, and an accessibility tax paid by every honest
 * reader to inconvenience a bot that a honeypot already catches.
 */
import 'server-only';

/** Five in ten minutes. Generous for a person, useless to a script. */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Module scope, so it lives as long as the server process. Keyed by IP; the value is the
 * timestamps still inside the window, which is what makes the limit a true sliding window
 * rather than a counter that resets on a boundary a script can wait for.
 */
const hits = new Map<string, number[]>();

/**
 * Bounded, because an unbounded Map keyed by a value the caller controls is a memory leak
 * with a remote trigger. Well past any real traffic; the oldest key is dropped first.
 */
const MAX_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  /** How many more submissions this key may make inside the current window. */
  remaining: number;
}

/**
 * Record one attempt and say whether it is allowed. `now` is a parameter so the behaviour
 * is testable without faking the clock globally.
 */
export function rateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter(at => at > cutoff);

  if (recent.length >= MAX_PER_WINDOW) {
    // The rejected attempt is NOT recorded. Recording it would extend the window on every
    // retry, so a reader who hit the limit once could never get back in by waiting.
    hits.set(key, recent);
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next();
    if (!oldest.done) hits.delete(oldest.value);
  }

  return { allowed: true, remaining: MAX_PER_WINDOW - recent.length };
}

/** Test seam: forget every window. Never called by application code. */
export function resetRateLimit(): void {
  hits.clear();
}
