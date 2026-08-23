// src/common/services/action-result.ts
/**
 * The contract between write Server Actions and the client code that calls them.
 *
 * Write actions RETURN a result; they must NEVER throw for an expected failure. An error
 * thrown inside a Server Action is serialized and sanitized before it reaches the
 * browser: in production the client receives a generic `Error` with an opaque `digest`,
 * and the HTTP status, the response body, the error class identity and the backend's
 * `code`/`detail` are all gone. Rollback can then no longer tell "409, refetch" from
 * "422, keep the form open", and field errors can no longer be bound back onto inputs.
 *
 * A plain object survives serialization intact — that is the entire reason this contract
 * is a value rather than an exception. It also makes the failure path type-checked:
 * `if (!result.ok)` narrows, so a caller cannot forget the failure branch the way it can
 * forget a `catch`.
 *
 * What may still throw: `redirect()` / `notFound()` (they work by throwing), read
 * actions whose consumer only needs "it failed", and genuine server bugs — let those
 * reach an error boundary rather than disguising them as `ok: false`.
 */
import { HttpError } from './http-types';

/**
 * `data` is REQUIRED on the success branch, including at the default `T = void`. So the
 * commonest case — a write action with no payload — is spelled with an explicit
 * `undefined`:
 *
 * ```ts
 * async function archiveInvoice(id: number): Promise<ActionResult> {
 *   // ...
 *   return { ok: true, data: undefined };
 *   // or, better, let the helper build it: return toActionResult(() => service(id));
 * }
 * ```
 *
 * It is NOT `data?: T`, and must not become that: an optional property makes
 * `{ ok: false }` structurally assignable to the success branch, which destroys the
 * `if (!result.ok)` narrowing this whole contract exists to provide. One extra word at
 * the return statement buys a compiler-checked failure path at every call site.
 */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; status: number; body?: unknown };

/**
 * Thrown client-side by `unwrap` so a mutation's `onError` can inspect `status`/`body`.
 * Deliberately shaped like `HttpError` (`{ status, body }`) so the normalizer in
 * `@/common/errors` handles both by duck-typing, without importing either class.
 */
export class ActionError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body?: unknown) {
    super(`Action failed with status ${status}`);
    this.name = 'ActionError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Client-side: turn an `ActionResult` into its value, or throw `ActionError`.
 *
 * This is the one place a returned failure becomes a throw again, and it exists so the
 * mutation library's own machinery — optimistic rollback, retry, `onError` — keeps
 * working, with the status and body preserved instead of sanitized away.
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionError(result.status, result.body);
  return result.data;
}

/**
 * Server-side: run a service call and normalize it into an `ActionResult`. The single
 * place a server-side throw becomes a result, so no action hand-rolls its own catch.
 */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, status: err.status, body: err.body };
    // status 0 = the request never reached the backend (network failure, timeout, a
    // schema rejection, a thrown JS error). Downstream, `mapError` refuses to show a
    // status-0 body to the user, because that "body" is an internal message.
    return { ok: false, status: 0, body: err instanceof Error ? err.message : undefined };
  }
}
