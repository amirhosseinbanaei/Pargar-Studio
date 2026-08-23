// src/common/services/http-types.ts
/**
 * Transport-layer types: the options every request accepts, and the error every
 * non-2xx response becomes.
 *
 * This file must NEVER import `server-only`, `next/*`, a base URL, a schema, or
 * anything auth-related. It is the bottom of the stack and has to stay usable in a
 * Node server, an edge runtime, a browser, and a unit test with no framework loaded.
 *
 * The failure it prevents: an error type that carries only a message. Callers need the
 * *status* to decide policy (retry? sign out? show a field error?) and the *parsed body*
 * to bind per-field validation messages back onto inputs. A message-only error forces
 * every call site into string matching, which breaks the first time the backend edits
 * its copy.
 */

export interface RequestOptions extends RequestInit {
  /** Abort the request after this many ms (default 30s). */
  timeoutMs?: number;
  /** Retries on transient failures (408/429/502/503/504 or network). Default 0. */
  retries?: number;
  /** Base backoff between retries in ms (default 300); doubles each attempt. */
  retryBackoffMs?: number;
  /** Convenience: JSON-serialize this as the body and set `Content-Type`. */
  json?: unknown;
}

/**
 * Thrown for any non-2xx response. Carries the parsed error body so callers can read
 * the backend's field errors without re-reading a consumed stream.
 *
 * `instanceof HttpError` is only reliable inside the module tree that threw it. Once an
 * error crosses a Server Action / RPC boundary or a second copy of this module is loaded
 * in another bundle, the prototype no longer matches — everything downstream must
 * duck-type `{ status: number }` instead (see `@/common/errors/map-error`).
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly url: string;

  constructor(status: number, statusText: string, body: unknown, url: string) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.url = url;
  }
}
