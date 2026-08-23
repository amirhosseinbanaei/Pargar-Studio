// src/common/services/http.ts
/**
 * The transport primitive: native `fetch` plus an AbortController timeout, opt-in
 * retry-with-exponential-backoff on transient failures, external-signal merging,
 * content-type-aware body parsing, and a typed `HttpError` on non-2xx.
 *
 * This file must NEVER know about auth, base URLs, schemas, cookies, or the framework.
 * It carries no `server-only` marker on purpose: it has to run in a server render, an
 * edge runtime, a browser, and a plain unit test.
 *
 * The failure it prevents: a bare `fetch()` at a call site has no timeout (a hung
 * upstream pins a render until the platform kills it and the user sees a blank page),
 * no typed error (the status and the validation body are lost), and no empty-body
 * handling (`res.json()` on a 204 throws a `SyntaxError` that masquerades as a schema
 * bug). Fixing those once here is why no other module is allowed to call `fetch`.
 */
import { HttpError, type RequestOptions } from './http-types';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Statuses worth retrying: the request may succeed unchanged a moment later.
 * Every other 4xx is deterministic — retrying only delays the error and doubles load.
 * TODO(project): add a status here only if your backend genuinely returns it transiently.
 */
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function parseSuccess<T>(res: Response): Promise<T> {
  // A 204 or an explicitly empty body has nothing to parse; calling res.json() on it
  // throws a SyntaxError that looks like a backend bug. DELETE endpoints hit this daily.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}

async function parseError(res: Response): Promise<unknown> {
  // Error bodies are the least trustworthy bytes in the system: an HTML page from a
  // reverse proxy, a truncated stream, or nothing at all. Never let parsing the error
  // replace the error — a throw here would hide the status the caller needs.
  try {
    const contentType = res.headers.get('content-type') ?? '';
    return contentType.includes('application/json') ? await res.json() : await res.text();
  } catch {
    return undefined;
  }
}

async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryBackoffMs = 300,
    json,
    headers,
    signal: externalSignal,
    ...init
  } = options;

  const mergedHeaders = new Headers(headers);
  let body = init.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    // Only set it if the caller didn't: a multipart/FormData body must keep the
    // boundary the runtime generated for it, or the server cannot split the parts.
    if (!mergedHeaders.has('Content-Type')) mergedHeaders.set('Content-Type', 'application/json');
  }

  let attempt = 0;
  for (;;) {
    // A fresh controller per attempt — an aborted signal stays aborted, so reusing one
    // would make every retry fail instantly.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    // Check `aborted` first: a signal that was already aborted before we subscribed
    // never fires the event, and the request would run to completion uncancelled.
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(url, {
        ...init,
        body,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      if (!res.ok) {
        if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
          attempt += 1;
          await delay(retryBackoffMs * 2 ** (attempt - 1));
          continue;
        }
        throw new HttpError(res.status, res.statusText, await parseError(res), url);
      }

      return await parseSuccess<T>(res);
    } catch (err) {
      if (err instanceof HttpError) throw err; // already classified — don't retry twice
      // The caller cancelled (navigation away, an upstream abort): retrying would
      // resurrect work nobody is waiting for.
      if (externalSignal?.aborted) throw err;
      // Network failure or timeout — retry if attempts remain, else rethrow.
      if (attempt < retries) {
        attempt += 1;
        await delay(retryBackoffMs * 2 ** (attempt - 1));
        continue;
      }
      throw err;
    } finally {
      // Always release the timer and the listener, on every path including `continue`,
      // or a retrying request leaks one timer and one listener per attempt.
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
}

interface HttpFn {
  <T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  /**
   * JSON-body convenience: defaults to POST and serializes `body` for you.
   * `http.json(url, payload)` is the same call as
   * `http(url, { method: 'POST', json: payload })` — use whichever reads better; pass
   * `{ method: 'PATCH' }` for other verbs.
   */
  json<T = unknown>(
    url: string,
    body: unknown,
    options?: Omit<RequestOptions, 'json' | 'body'>,
  ): Promise<T>;
}

export const http: HttpFn = Object.assign(request, {
  json: <T = unknown>(
    url: string,
    body: unknown,
    options: Omit<RequestOptions, 'json' | 'body'> = {},
  ): Promise<T> => request<T>(url, { method: 'POST', ...options, json: body }),
});
