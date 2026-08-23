// src/common/errors/map-error.ts
/**
 * The single place any thrown value becomes a predictable `NormalizedError`.
 *
 * Nothing else in the app may interpret a thrown error. One file to change when the
 * backend adds an error shape; one file to test; one behaviour for every toast, form,
 * boundary and log line.
 *
 * This file must NEVER use `instanceof` to identify an error. An error that crossed a
 * Server Action RPC boundary, a structured clone, or a second copy of a module in
 * another bundle is no longer an instance of your class — and each failed check silently
 * downgrades a precise 403 into "network error, check your connection", the single most
 * misleading message in the table.
 */
import type { ErrorOverrides, FieldErrors, NormalizedError } from './types';
import { DEFAULT_BY_CODE, DEFAULT_BY_STATUS, GENERIC_MESSAGE } from './messages';
import { parseBody } from './parse-body';

/**
 * Pull `{ status, body }` off any thrown value by duck-typing rather than importing the
 * error classes. Every producer in this architecture satisfies `{ status: number }` —
 * the transport's `HttpError`, the client-side `ActionError`, and any hand-built
 * `{ status, body }` object — so one predicate covers them all without a bundle
 * dependency in either direction.
 */
function extractStatusBody(error: unknown): { status: number; body: unknown } {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') {
      return { status, body: (error as { body?: unknown }).body };
    }
  }
  return { status: 0, body: undefined };
}

/**
 * Message precedence (first non-empty wins):
 *   1. `overrides.byCode[code]`        — this call site, by machine code
 *   2. `overrides.byStatus[status]`    — this call site, by status
 *   3. `DEFAULT_BY_CODE[code]`         — app-wide meaning of a known code
 *   4. backend `detail`                — the backend's own single message
 *   5. backend form-level error        — validation not attributable to one field
 *   6. first backend field error       — most specific thing left
 *   7. `DEFAULT_BY_STATUS[status]`     — localized, safe, always understandable
 *   8. `GENERIC_MESSAGE`               — unconditional, so `message` is never empty
 *
 * Rungs 4–6 are trusted ONLY when `status > 0`, i.e. when a real backend actually
 * responded. At `status === 0` the "body" is an internal JS message (`fetch failed`,
 * `Cannot read properties of undefined`); showing it leaks implementation detail and
 * tells the user nothing. The raw error is still logged in development.
 *
 * Override rungs sit above backend rungs because the backend's copy is written for API
 * consumers, in the backend's language, and is edited without warning.
 */
export function mapError(error: unknown, overrides: ErrorOverrides = {}): NormalizedError {
  const { status, body } = extractStatusBody(error);
  const parsed = parseBody(body);
  const { code } = parsed;
  const fromBackend = status > 0;

  const candidates: Array<string | null | undefined> = [
    code ? overrides.byCode?.[code] : null,
    overrides.byStatus?.[status],
    code ? DEFAULT_BY_CODE[code] : null,
    fromBackend ? parsed.detail : null,
    fromBackend ? parsed.nonFieldErrors[0] : null,
    fromBackend ? Object.values(parsed.fieldErrors)[0] : null,
    DEFAULT_BY_STATUS[status],
    GENERIC_MESSAGE,
  ];

  // The non-null assertion is safe by construction: the last candidate is an
  // unconditional non-empty constant. That is the invariant "message is never empty".
  const message = candidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  )!;

  return { status, code, message, fieldErrors: parsed.fieldErrors };
}

/** Convenience: just the user-facing message. Never render `String(err)` instead. */
export function errorMessage(error: unknown, overrides?: ErrorOverrides): string {
  return mapError(error, overrides).message;
}

/**
 * Convenience: field -> message map, ready for a form `setError` loop.
 *
 * Bind these onto the inputs rather than showing a toast: the user sees WHICH field to
 * fix, and the message clears when they edit it.
 */
export function fieldErrors(error: unknown): FieldErrors {
  return mapError(error).fieldErrors;
}
