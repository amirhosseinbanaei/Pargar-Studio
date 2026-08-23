// src/common/services/pending-backend.ts
/**
 * Fixture data for endpoints the backend has not built yet, quarantined behind ONE
 * greppable wrapper.
 *
 * Why it exists: a screen whose feed does not exist yet renders an empty list, which is
 * indistinguishable from a frontend bug — you cannot work on the layout, the card
 * design, or the loading states. Wrapping only those call sites keeps the failure
 * visible in the log while the UI stays buildable.
 *
 * Why it is narrow, and must stay narrow:
 *  - Only the wrapped call sites fall back — never the api-client at large, so a real
 *    endpoint that breaks still surfaces as an error.
 *  - Only "the endpoint isn't there" failures qualify: 404/405/5xx, a transport failure,
 *    or a body that does not match the schema at all (both report status 0).
 *  - 401/403 is RETHROWN. A session problem is not a missing endpoint, and masking it
 *    renders fixtures to a signed-out user, which looks like a data leak in a screenshot.
 *  - One env flag disables the whole mechanism, so anyone can see the true state of the
 *    API in one command.
 *
 * This file must NEVER grow a second consumer pattern (no `if (!data) return FAKE_ROWS`
 * inside a service). Inline fixtures are undeletable: nobody can find them all later,
 * and they eventually ship. Delete each wrapper as its endpoint ships; the module is
 * done when `grep -r withPendingBackendFallback src/` returns nothing.
 */
import 'server-only';
import { mapError } from '@/common/errors';
import { env } from '@/common/config/env';
import { devLog } from '@/common/observability/dev-log';

/**
 * True when not-yet-implemented endpoints may serve fixture data.
 *
 * Lives here rather than in the env module so the flag and the only mechanism that reads
 * it are deleted together. Server-side only, by virtue of this module's `server-only`
 * import — no client code should branch on it.
 */
export const isPendingApiMockEnabled = env.NEXT_PUBLIC_PENDING_API_MOCKS === 'enabled';

/** Statuses that plausibly mean "this endpoint does not exist yet". */
const UNAVAILABLE_STATUSES = new Set([404, 405, 500, 501, 502, 503, 504]);

export async function withPendingBackendFallback<T>(
  /** A greppable removal key, e.g. `'GET /catalog/featured/'`. */
  endpoint: string,
  fetcher: () => Promise<T>,
  fixture: () => T,
): Promise<T> {
  if (!isPendingApiMockEnabled) return fetcher();

  try {
    return await fetcher();
  } catch (error) {
    // `mapError` reports status 0 for anything that never got an HTTP status: a
    // transport failure, or a schema rejection of an unexpected body.
    const { status } = mapError(error);
    if (status !== 0 && !UNAVAILABLE_STATUSES.has(status)) throw error;

    devLog(
      'pending-api',
      `${endpoint} is not available (status ${status || 'no response'}) — serving fixture data. ` +
        'Remove this fallback once the backend implements it.',
    );
    return fixture();
  }
}
