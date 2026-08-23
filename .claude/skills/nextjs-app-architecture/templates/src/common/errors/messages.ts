// src/common/errors/messages.ts
/**
 * The default user-facing error copy, and the app's ONLY localization seam for it.
 *
 * These tables must NEVER be bypassed by a component hardcoding "Something went wrong":
 * hardcoded copy is invisible to translation and to copy review, and drifts into five
 * slightly different sentences across five screens.
 *
 * The failure it prevents: an empty or untranslated error. `GENERIC_MESSAGE` is the
 * unconditional last rung of the precedence chain in `mapError`, which is what guarantees
 * no UI ever renders "Error: " or an empty toast.
 *
 * LOCALIZATION SEAM — read before shipping a second locale:
 *  - Single-locale app: keep these as literals, written in YOUR app's language. They are
 *    in English here only because this template has to pick one.
 *  - Multi-locale app: make the values message KEYS resolved by your i18n runtime, and
 *    give `mapError` a locale argument. Do not localize inside call sites — that is how
 *    the seam is lost.
 *  - Backend strings are already-localized-or-not and you cannot tell from the outside.
 *    That is exactly why backend-derived messages rank BELOW per-call overrides in
 *    `mapError`: a call site that knows the endpoint answers in the wrong language pins
 *    a `byStatus` override and wins.
 */

/** Keyed by HTTP status. `0` means "no response at all" (network, timeout, JS throw). */
export const DEFAULT_BY_STATUS: Record<number, string> = {
  0: 'Network error. Check your connection.',
  400: 'The submitted data is not valid.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'Not found.',
  409: 'That item already exists.',
  422: 'The submitted data is not valid.',
  429: 'Too many requests. Try again shortly.',
  500: 'Server error. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
};

/**
 * Keyed by a backend/custom error `code` — the highest-priority default, because a code
 * is the only part of an error body that is stable enough to attach meaning to.
 * TODO(project): add the codes your backend documents. Keep the list short: a code
 * belongs here when several call sites need the same sentence for it.
 */
export const DEFAULT_BY_CODE: Record<string, string> = {
  already_registered: 'That email address is already registered.',
};

/** Absolute fallback when nothing else resolves — never returned empty. */
export const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
